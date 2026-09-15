import { app, BrowserWindow, Tray, Menu, powerSaveBlocker, ipcMain, nativeImage, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { RunnerWSClient } from './client/ws-client';
import { openLoginBrowser } from './executor/login-browser';

const CONFIG_DIR = path.join(os.homedir(), '.quazlink');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const LOG_FILE = path.join(CONFIG_DIR, 'runner.log');

function logToFile(msg: string) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] [PID:${process.pid}] ${msg}\n`);
  } catch {}
  console.log(msg);
}

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
}

function loadConfig(): LocalConfig {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch {}
  }
  return {
    serverUrl: process.env.CLOUD_GATEWAY_URL || 'wss://api.quazlink.site',
    keepAwake: true,
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
  try {
    fs.watch(CONFIG_DIR, (_event, filename) => {
      if (filename && filename.includes('pending_pair')) {
        checkPendingPair();
      }
    });
  } catch {}

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
    height: 620,
    show: true,
    frame: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    icon: icon.isEmpty() ? undefined : icon,
    backgroundColor: '#0a0d14',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const htmlPath = fs.existsSync(path.join(__dirname, 'ui', 'index.html'))
    ? path.join(__dirname, 'ui', 'index.html')
    : path.join(__dirname, '..', 'src', 'ui', 'index.html');

  mainWindow.loadFile(htmlPath);
  mainWindow.center();
  mainWindow.focus();

  try {
    const hwnd = mainWindow.getNativeWindowHandle().readInt32LE(0);
    console.log('🪟 [Window] Native HWND allocated:', hwnd, 'Visible:', mainWindow.isVisible());
  } catch (err: any) {
    console.error('❌ [Window] Failed to get HWND:', err.message);
  }

  setTimeout(() => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(false);
      }
    } catch {}
  }, 1200);

  mainWindow.on('close', (e) => {
    if (!(app as any).isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

function getTrayIcon(): Electron.NativeImage {
  const possiblePaths = [
    path.join(__dirname, 'assets', 'icon.png'),
    path.join(__dirname, '..', 'src', 'assets', 'icon.png'),
    path.join(__dirname, '..', 'assets', 'icon.png'),
    path.join(process.cwd(), 'src', 'assets', 'icon.png'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const img = nativeImage.createFromPath(p);
        if (!img.isEmpty()) {
          return img.resize({ width: 24, height: 24 });
        }
      } catch {}
    }
  }
  return nativeImage.createEmpty();
}

function setupTray() {
  const icon = getTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('QuazLink Local Automation Runner');

  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.center();
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `QuazLink Runner: ${currentStatus === 'online' ? '🟢 Online' : '🔴 Offline'}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Open Agent Control Panel',
      click: () => mainWindow?.show(),
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
    { type: 'separator' },
    {
      label: 'Quit Agent',
      click: () => {
        wsClient?.cleanup();
        app.quit();
      },
    },
  ]);

  tray?.setContextMenu(contextMenu);
}

function applyPowerManagement() {
  if (appConfig.keepAwake && !powerBlockerId) {
    powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    console.log('⚡ [PowerManager] Keep-Awake enabled (Preventing OS sleep)');
  } else if (!appConfig.keepAwake && powerBlockerId) {
    powerSaveBlocker.stop(powerBlockerId);
    powerBlockerId = null;
    console.log('⚡ [PowerManager] Keep-Awake disabled');
  }
}

function initializeRunnerClient() {
  wsClient = new RunnerWSClient(appConfig.serverUrl, {
    token: appConfig.deviceToken,
    pairingToken: appConfig.pairingToken,
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
      openLoginBrowser(platform, accountId, wsClient);
    },
    // Auto-approve publishing jobs dispatched from paired cloud account
    confirmJob: async (payload) => {
      console.log(`🤖 [Desktop] Auto-approving ${payload?.platform || 'social'} job #${payload?.id}.`);
      return true;
    },
    confirmSync: async (count) => {
      console.log(`🤖 [Desktop] Auto-approving sync of ${count} pending post(s).`);
      return true;
    },
  });

  wsClient.connect();
}

if (gotTheLock) {
  app.whenReady().then(() => {
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

  // Always show the window on startup so the user sees the control panel
  showAppWindow();

  // IPC handlers for mini UI
  ipcMain.on('get-state', (event) => {
    event.reply('status-updated', { status: currentStatus, config: appConfig });
  });

  ipcMain.on('pair-device', (_, pairingCode) => {
    console.log(`🔑 [Main] Received pair-device request with code: ${pairingCode}`);
    appConfig.deviceToken = undefined; // Crucial: clear old rejected token so ws-client pairs with new code
    appConfig.pairingToken = pairingCode.trim();
    saveConfig(appConfig);
    wsClient?.cleanup();
    initializeRunnerClient();
  });

  ipcMain.on('unpair-device', () => {
    console.log('🔴 [Main] Received unpair-device request. Clearing tokens.');
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
      openLoginBrowser(payload.platform, payload.accountId, wsClient);
    }
  });
});
}

app.on('window-all-closed', () => {
  // Keep alive in system tray on all platforms
});

// §7: process-signal handling lives here (once), not inside RunnerWSClient — a new client is
// created on every pair/unpair/deep-link, so per-instance listeners used to accumulate and leak.
// This references the module-level `wsClient`, so it always cleans up the current instance.
const shutdown = (signal: string) => {
  console.log(`\n🛑 [Main] Received ${signal}. Cleaning up runner and quitting...`);
  wsClient?.cleanup();
  app.quit();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
