import { app, BrowserWindow, Tray, Menu, powerSaveBlocker, ipcMain, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { RunnerWSClient } from './client/ws-client';

const CONFIG_DIR = path.join(os.homedir(), '.quazlink');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Register custom protocol 'quazlink'
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('quazlink', process.execPath, [path.resolve(process.argv[1])]);
  }
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

function handleDeepLink(urlStr: string) {
  try {
    const parsed = new URL(urlStr);
    const token = parsed.searchParams.get('token') || parsed.searchParams.get('pairingToken');
    if (token) {
      console.log('🔑 [DeepLink] Received auto-pairing token:', token);
      appConfig.pairingToken = token.trim();
      saveConfig(appConfig);
      wsClient?.cleanup();
      initializeRunnerClient();
    }
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  } catch (e) {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  }
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
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
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const htmlPath = fs.existsSync(path.join(__dirname, 'ui', 'index.html'))
    ? path.join(__dirname, 'ui', 'index.html')
    : path.join(__dirname, '..', 'src', 'ui', 'index.html');

  mainWindow.loadFile(htmlPath);

  mainWindow.on('blur', () => {
    mainWindow?.hide();
  });
}

function setupTray() {
  const iconPath = path.join(__dirname, '..', 'src', 'assets', 'icon.png');
  let icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

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
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('status-updated', { status, info, config: appConfig });
      }
      if (info?.deviceToken) {
        appConfig.deviceToken = info.deviceToken;
        appConfig.pairingToken = undefined;
        saveConfig(appConfig);
      }
    },
  });

  wsClient.connect();
}

app.whenReady().then(() => {
  createWindow();
  setupTray();
  applyPowerManagement();
  initializeRunnerClient();

  // IPC handlers for mini UI
  ipcMain.on('get-state', (event) => {
    event.reply('status-updated', { status: currentStatus, config: appConfig });
  });

  ipcMain.on('pair-device', (_, pairingCode) => {
    appConfig.pairingToken = pairingCode.trim();
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
});

app.on('window-all-closed', () => {
  // Keep alive in system tray on all platforms
});
