import { app, BrowserWindow, Tray, Menu, powerSaveBlocker, ipcMain, nativeImage, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { RunnerWSClient } from './client/ws-client';
import { openLoginBrowser } from './executor/login-browser';
import { AppUpdater } from './updater/app-updater';

const CONFIG_DIR = path.join(os.homedir(), '.quazlink');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const LOG_FILE = path.join(CONFIG_DIR, 'runner.log');

function logToFile(msg: string) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] [PID:${process.pid}] ${msg}\n`);
  } catch {}
}

// Redirect console logs to runner.log as well
const origLog = console.log;
const origErr = console.error;
console.log = (...args: any[]) => {
  origLog(...args);
  try {
    const text = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    logToFile(text);
  } catch {}
};
console.error = (...args: any[]) => {
  origErr(...args);
  try {
    const text = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    logToFile(`ERROR: ${text}`);
  } catch {}
};

process.on('uncaughtException', (err) => {
  logToFile(`💥 [Process] Uncaught Exception: ${err?.stack || err?.message || err}`);
});

process.on('unhandledRejection', (reason: any) => {
  logToFile(`💥 [Process] Unhandled Rejection: ${reason?.stack || reason?.message || reason}`);
});

logToFile(`🚀 App launched with argv: ${JSON.stringify(process.argv)}`);

app.name = 'quazlink-desktop-runner';
const userDataPath = path.join(CONFIG_DIR, 'electron_data');
app.setPath('userData', userDataPath);

// Register custom protocol 'quazlink'
const appEntry = path.resolve(__dirname, '..');
if (process.defaultApp) {
  app.setAsDefaultProtocolClient('quazlink', process.execPath, [appEntry]);
} else {
  app.setAsDefaultProtocolClient('quazlink');
}

interface LocalConfig {
  serverUrl: string;
  deviceToken?: string;
  pairingToken?: string;
  keepAwake?: boolean;
  showBrowser?: boolean;
}

function loadConfig(): LocalConfig {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (cfg.showBrowser === undefined) cfg.showBrowser = false;
      return cfg;
    } catch {}
  }
  return {
    serverUrl: process.env.CLOUD_GATEWAY_URL || 'wss://api.quazlink.site',
    keepAwake: true,
    showBrowser: false,
  };
}

function saveConfig(cfg: LocalConfig) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let wsClient: RunnerWSClient | null = null;
let powerBlockerId: number | null = null;
let appConfig = loadConfig();
let currentStatus: 'online' | 'offline' | 'pairing' = 'offline';

function showAppWindow() {
  logToFile(`🪟 [Window] showAppWindow invoked (hasWindow=${!!mainWindow})`);
  if (!mainWindow || mainWindow.isDestroyed()) {
    logToFile('🪟 [Window] Window missing or destroyed, recreating...');
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.center();
  mainWindow.focus();
  mainWindow.setAlwaysOnTop(true);
  setTimeout(() => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(false);
      }
    } catch {}
  }, 1200);
}

function handleDeepLink(urlStr: string) {
  try {
    logToFile(`🔗 [DeepLink] Raw URL received: ${urlStr}`);
    const cleanUrl = urlStr.trim().replace(/^["']|["']$/g, '');
    const parsed = new URL(cleanUrl);
    const token = (parsed.searchParams.get('token') || parsed.searchParams.get('pairingToken'))?.trim();
    showAppWindow();
    if (token) {
      logToFile(`🔑 [DeepLink] Auto-pairing request for code: ${token}`);
      appConfig.deviceToken = undefined;
      appConfig.pairingToken = token;
      saveConfig(appConfig);
      wsClient?.cleanup();
      initializeRunnerClient();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('status-updated', { status: 'pairing', config: appConfig });
      }
    }
  } catch (e: any) {
    logToFile(`❌ [DeepLink] Parse error: ${e.message}`);
    showAppWindow();
  }
}

const PENDING_PAIR_FILE = path.join(CONFIG_DIR, 'pending_pair.json');

const gotTheLock = app.requestSingleInstanceLock();
logToFile(`🔒 [Lock] gotTheLock=${gotTheLock}`);
if (!gotTheLock) {
  const deepLinkArg = process.argv.find((arg) => arg.includes('quazlink://'));
  if (deepLinkArg) {
    try {
      logToFile(`📝 [Secondary] Forwarding deep-link to primary: ${deepLinkArg}`);
      fs.writeFileSync(PENDING_PAIR_FILE, JSON.stringify({ url: deepLinkArg, time: Date.now() }));
    } catch (e: any) {
      logToFile(`❌ [Secondary] Error writing pending pair: ${e.message}`);
    }
  } else {
    // Secondary was opened without URL (just user clicking desktop icon again)
    try {
      fs.writeFileSync(PENDING_PAIR_FILE, JSON.stringify({ showOnly: true, time: Date.now() }));
    } catch {}
  }
  logToFile(`👋 [Instance] Secondary instance notifying primary and quitting.`);
  app.quit();
} else {
  // Watch for pending requests from secondary instances (fail-safe IPC on Windows)
  const checkPendingPair = () => {
    try {
      if (fs.existsSync(PENDING_PAIR_FILE)) {
        const raw = fs.readFileSync(PENDING_PAIR_FILE, 'utf-8');
        try { fs.unlinkSync(PENDING_PAIR_FILE); } catch {}
        const data = JSON.parse(raw);
        logToFile(`📥 [Primary] Picked up secondary request: ${raw.trim()}`);
        showAppWindow();
        if (data.url) {
          handleDeepLink(data.url);
        }
      }
    } catch {}
  };

  setInterval(checkPendingPair, 350);

  app.on('second-instance', (event, commandLine) => {
    logToFile(`⚡ [SecondInstance] Caught second instance with args: ${JSON.stringify(commandLine)}`);
    showAppWindow();
    const deepLinkUrl = commandLine.find((arg) => arg.includes('quazlink://'));
    if (deepLinkUrl) {
      handleDeepLink(deepLinkUrl);
    }
  });

  app.on('open-url', (event, url) => {
    logToFile(`🌐 [OpenUrl] Caught URL: ${url}`);
    event.preventDefault();
    handleDeepLink(url);
  });
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showAppWindow();
    return;
  }

  const icon = getTrayIcon();
  mainWindow = new BrowserWindow({
    title: 'QuazLink Desktop Runner',
    width: 420,
    height: 670,
    show: false, // Prevents white unrendered flash on startup
    frame: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    icon: icon.isEmpty() ? undefined : icon,
    backgroundColor: '#070a10',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const htmlPath = fs.existsSync(path.join(__dirname, 'ui', 'index.html'))
    ? path.join(__dirname, 'ui', 'index.html')
    : path.join(__dirname, '..', 'src', 'ui', 'index.html');

  logToFile(`🪟 [Window] Loading UI from: ${htmlPath}`);

  mainWindow.loadFile(htmlPath).catch((err) => {
    logToFile(`❌ [Window] loadFile failed: ${err.message}`);
  });

  mainWindow.once('ready-to-show', () => {
    logToFile('🪟 [Window] ready-to-show event received');
    showAppWindow();
  });

  // Fallback: If ready-to-show takes too long, ensure window becomes visible
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      logToFile('🪟 [Window] Fallback timeout showing window');
      showAppWindow();
    }
  }, 1500);

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logToFile(`❌ [Window] did-fail-load: code=${errorCode} desc=${errorDescription} url=${validatedURL}`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logToFile(`❌ [Window] render-process-gone: reason=${details.reason} exitCode=${details.exitCode}`);
  });

  mainWindow.on('close', (e) => {
    if (!(app as any).isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

function getTrayIcon(): Electron.NativeImage {
  const isWin = process.platform === 'win32';
  const iconNames = isWin ? ['icon.ico', 'icon.png'] : ['icon.png', 'icon.ico'];
  const possibleDirs = [
    path.join(__dirname, 'assets'),
    path.join(__dirname, '..', 'src', 'assets'),
    path.join(__dirname, '..', 'assets'),
    path.join(process.cwd(), 'src', 'assets'),
    path.join(process.cwd(), 'dist', 'assets'),
  ];
  for (const name of iconNames) {
    for (const dir of possibleDirs) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) {
        try {
          const img = nativeImage.createFromPath(p);
          if (!img.isEmpty()) {
            return isWin && name.endsWith('.ico') ? img : img.resize({ width: 24, height: 24 });
          }
        } catch {}
      }
    }
  }
  return nativeImage.createEmpty();
}

function setupTray() {
  try {
    const icon = getTrayIcon();
    if (icon.isEmpty()) {
      logToFile('⚠️ [Tray] Tray icon is empty, skipping tray creation');
      return;
    }
    tray = new Tray(icon);
    tray.setToolTip('QuazLink Local Automation Runner');

    updateTrayMenu();

    tray.on('click', () => {
      if (mainWindow?.isVisible()) {
        mainWindow.hide();
      } else {
        showAppWindow();
      }
    });
  } catch (err: any) {
    logToFile(`❌ [Tray] Tray setup failed: ${err?.message || err}`);
  }
}

function updateTrayMenu() {
  if (!tray) return;
  try {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: `QuazLink Runner: ${currentStatus === 'online' ? '🟢 Online' : '🔴 Offline'}`,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Open Agent Control Panel',
        click: () => showAppWindow(),
      },
      {
        label: 'Keep System Awake (Anti-Sleep)',
        type: 'checkbox',
        checked: !!appConfig.keepAwake,
        click: (item) => {
          appConfig.keepAwake = item.checked;
          saveConfig(appConfig);
          applyPowerManagement();
        },
      },
      {
        label: 'Show Browser Window (Live Mode)',
        type: 'checkbox',
        checked: !!appConfig.showBrowser,
        click: (item) => {
          appConfig.showBrowser = item.checked;
          saveConfig(appConfig);
          wsClient?.setShowBrowser(appConfig.showBrowser);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('status-updated', { status: currentStatus, config: appConfig });
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit Agent',
        click: () => {
          wsClient?.cleanup();
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);
  } catch (err: any) {
    logToFile(`❌ [Tray] Failed to update tray menu: ${err?.message || err}`);
  }
}

function applyPowerManagement() {
  try {
    if (appConfig.keepAwake && !powerBlockerId) {
      powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');
      logToFile('⚡ [PowerManager] Keep-Awake enabled (Preventing OS sleep)');
    } else if (!appConfig.keepAwake && powerBlockerId) {
      powerSaveBlocker.stop(powerBlockerId);
      powerBlockerId = null;
      logToFile('⚡ [PowerManager] Keep-Awake disabled');
    }
  } catch (err: any) {
    logToFile(`❌ [PowerManager] Error: ${err?.message || err}`);
  }
}

function logToTerminal(message: string, type: 'highlight' | 'success' | 'warn' | 'red' = 'highlight') {
  logToFile(`[UI] ${message}`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('terminal-log', { message, type });
  }
}

function initializeRunnerClient() {
  try {
    wsClient = new RunnerWSClient(appConfig.serverUrl, {
      token: appConfig.deviceToken,
      pairingToken: appConfig.pairingToken,
      showBrowser: !!appConfig.showBrowser,
      onLog: (msg, type) => {
        logToTerminal(msg, type);
      },
      onStatusChange: (status, info) => {
        currentStatus = status;
        updateTrayMenu();

        if (info?.forceUnpair) {
          appConfig.deviceToken = undefined;
          appConfig.pairingToken = undefined;
          saveConfig(appConfig);
        } else if (info?.deviceToken) {
          appConfig.deviceToken = info.deviceToken;
          appConfig.pairingToken = undefined;
          saveConfig(appConfig);
        } else if (info?.pairingError) {
          appConfig.pairingToken = undefined;
          saveConfig(appConfig);
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('status-updated', { status, info, config: appConfig });
        }
      },
      onConnectRequest: (platform, accountId) => {
        logToTerminal(`[CONNECT] Received request to connect ${platform.toUpperCase()}`, 'highlight');
        openLoginBrowser(platform, accountId, wsClient, (msg, type) => logToTerminal(msg, type));
      },
      // Auto-approve publishing jobs dispatched from paired cloud account
      confirmJob: async (payload) => {
        logToFile(`🤖 [Desktop] Auto-approving ${payload?.platform || 'social'} job #${payload?.id}.`);
        return true;
      },
      confirmSync: async (count) => {
        logToFile(`🤖 [Desktop] Auto-approving sync of ${count} pending post(s).`);
        return true;
      },
    });

    wsClient.connect();
  } catch (err: any) {
    logToFile(`❌ [RunnerClient] Failed to initialize: ${err?.message || err}`);
  }
}

if (gotTheLock) {
  app.whenReady().then(() => {
    logToFile('🚀 [Main] App ready, launching window and services...');
    createWindow();
    setupTray();
    applyPowerManagement();

    // Check if launched directly with a deep link argument
    const initialDeepLink = process.argv.find((arg) => arg.includes('quazlink://'));
    if (initialDeepLink) {
      handleDeepLink(initialDeepLink);
    } else {
      initializeRunnerClient();
    }

    // IPC handlers for mini UI
    ipcMain.on('get-state', (event) => {
      event.reply('status-updated', { status: currentStatus, config: appConfig });
    });

    ipcMain.on('pair-device', (_, pairingCode) => {
      logToFile(`🔑 [Main] Received pair-device request with code: ${pairingCode}`);
      appConfig.deviceToken = undefined; // Crucial: clear old rejected token so ws-client pairs with new code
      appConfig.pairingToken = pairingCode.trim();
      saveConfig(appConfig);
      wsClient?.cleanup();
      initializeRunnerClient();
    });

    ipcMain.on('unpair-device', () => {
      logToFile('🔴 [Main] Received unpair-device request. Clearing tokens.');
      appConfig.deviceToken = undefined;
      appConfig.pairingToken = undefined;
      saveConfig(appConfig);
      wsClient?.cleanup();
      initializeRunnerClient();
    });

    ipcMain.on('toggle-keep-awake', (_, enabled) => {
      appConfig.keepAwake = enabled;
      saveConfig(appConfig);
      applyPowerManagement();
      updateTrayMenu();
    });

    ipcMain.on('toggle-show-browser', (_, enabled) => {
      appConfig.showBrowser = enabled;
      saveConfig(appConfig);
      wsClient?.setShowBrowser(enabled);
      updateTrayMenu();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('status-updated', { status: currentStatus, config: appConfig });
      }
    });

    ipcMain.on('close-window', () => {
      mainWindow?.hide();
    });

    // §5: the renderer can no longer reach `shell` directly. Open external links here, but only
    // after validating the URL — https (or http on localhost for dev) to a known QuazLink host.
    ipcMain.on('open-external', (_event, url: unknown) => {
      if (typeof url !== 'string') return;
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return;
      }
      const ALLOWED_HOSTS = new Set([
        'quazlink.site',
        'www.quazlink.site',
        'app.quazlink.site',
        'localhost',
        '127.0.0.1',
      ]);
      const isHttps = parsed.protocol === 'https:';
      const isLocalDev =
        parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
      if ((isHttps || isLocalDev) && ALLOWED_HOSTS.has(parsed.hostname)) {
        shell.openExternal(parsed.toString());
      } else {
        console.warn(`⛔ [Security] Blocked open-external to a disallowed URL: ${url}`);
      }
    });

    ipcMain.on('open-login-window', async (event, payload: { platform: string; accountId: string }) => {
      // Optional manual fallback from the desktop UI itself
      if (wsClient) {
        openLoginBrowser(payload.platform, payload.accountId, wsClient, (msg, type) => logToTerminal(msg, type));
      }
    });

    // ── In-App Auto-Updater ─────────────────────────────────────────────
    const appUpdater = new AppUpdater();

    ipcMain.handle('check-update', async () => {
      try {
        const result = await appUpdater.checkForUpdates(app.getVersion(), (msg, type) => {
          logToTerminal(msg, type);
        });
        return result;
      } catch (err: any) {
        logToTerminal(`[UPDATE] Check failed: ${err.message}`, 'red');
        return { hasUpdate: false, error: err.message };
      }
    });

    ipcMain.on('start-update', async () => {
      try {
        logToTerminal('[UPDATE] 📥 Starting update package download...', 'highlight');
        await appUpdater.downloadAndInstall(
          undefined,
          (percent, downloadedMB, totalMB) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('update-progress', { percent, downloadedMB, totalMB });
            }
          },
          (msg, type) => logToTerminal(msg, type),
          async () => {
            wsClient?.cleanup();
            if (powerBlockerId) {
              try {
                powerSaveBlocker.stop(powerBlockerId);
              } catch {}
            }
          }
        );
      } catch (err: any) {
        logToTerminal(`[UPDATE] ❌ Installation failed: ${err.message}`, 'red');
      }
    });

    // Silent background check 4.5s after launch
    setTimeout(async () => {
      try {
        const check = await appUpdater.checkForUpdates(app.getVersion());
        if (check.hasUpdate && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-available', check);
          logToTerminal(`[UPDATE] 🚀 Update ${check.latestVersion} available! Click 'Update Now' in the runner.`, 'success');
        }
      } catch {}
    }, 4500);
  });
}

app.on('window-all-closed', () => {
  // Keep alive in system tray on all platforms
});

const shutdown = (signal: string) => {
  logToFile(`🛑 [Main] Received ${signal}. Cleaning up runner and quitting...`);
  wsClient?.cleanup();
  app.quit();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

