import { app, BrowserWindow, Tray, Menu, powerSaveBlocker, ipcMain, nativeImage, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { RunnerWSClient } from './client/ws-client';
import { openLoginBrowser } from './executor/login-browser';

const CONFIG_DIR = path.join(os.homedir(), '.quazlink');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

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
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.center();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(true);
  }
}

function handleDeepLink(urlStr: string) {
  try {
    const cleanUrl = urlStr.trim().replace(/^["']|["']$/g, '');
    const parsed = new URL(cleanUrl);
    const token = (parsed.searchParams.get('token') || parsed.searchParams.get('pairingToken'))?.trim();
    showAppWindow();
    if (token) {
      console.log('🔑 [DeepLink] Received auto-pairing request for code:', token);
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
    console.error('DeepLink error:', e.message);
    showAppWindow();
  }
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    showAppWindow();
    const deepLinkUrl = commandLine.find((arg) => arg.startsWith('quazlink://'));
    if (deepLinkUrl) {
      handleDeepLink(deepLinkUrl);
    }
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 540,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    backgroundColor: '#0a0d14',
    webPreferences: {
      // Security: isolate the renderer. It can no longer require() Electron/Node — it reaches
      // main only through the whitelisted `window.quazlink` bridge defined in preload.ts.
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
      const trayBounds = tray?.getBounds();
      if (trayBounds && mainWindow) {
        const x = Math.round(trayBounds.x + (trayBounds.width / 2) - 190);
        const y = Math.round(trayBounds.y - 550);
        mainWindow.setPosition(x > 0 ? x : 50, y > 0 ? y : 50);
        mainWindow.show();
      }
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

app.whenReady().then(() => {
  createWindow();
  setupTray();
  applyPowerManagement();

  // Check if launched directly with a deep link argument
  const initialDeepLink = process.argv.find((arg) => arg.startsWith('quazlink://'));
  if (initialDeepLink) {
    handleDeepLink(initialDeepLink);
  } else {
    initializeRunnerClient();
  }

  // If unpaired, show the window immediately so the user sees the control panel
  if (!appConfig.deviceToken) {
    showAppWindow();
  }

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
