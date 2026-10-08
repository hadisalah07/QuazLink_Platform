import { app, BrowserWindow, Menu, nativeImage, NativeImage, ipcMain } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { PosServer } from '../server/api-server.js';
import { PosDatabase } from '../database/connection.js';

// Dedicated Persistent Log Engine for QuazLink POS Client
const CONFIG_DIR = path.join(os.homedir(), '.quazlink');
const LOG_FILE = path.join(CONFIG_DIR, 'pos_electron.log');

function logToFile(msg: string) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] [PID:${process.pid}] ${msg}\n`);
  } catch {}
}

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

logToFile(`🚀 QuazLink POS launching with argv: ${JSON.stringify(process.argv)}`);

app.name = 'quazlink-pos-client';
const userDataPath = path.join(CONFIG_DIR, 'pos_electron_data');
app.setPath('userData', userDataPath);

let mainWindow: BrowserWindow | null = null;
let posServer: PosServer | null = null;
let serverPort: number = 3030;
let isQuitting = false;

const PENDING_ACTIVATE_FILE = path.join(CONFIG_DIR, 'pending_pos_activate.json');

// 1. Single Instance Guard
const gotSingleInstanceLock = app.requestSingleInstanceLock();
logToFile(`🔒 [Instance Lock] gotSingleInstanceLock=${gotSingleInstanceLock}`);
if (!gotSingleInstanceLock) {
  logToFile('⚠️ Another instance is already running. Signaling primary instance and quitting.');
  try {
    fs.writeFileSync(PENDING_ACTIVATE_FILE, JSON.stringify({ activate: true, time: Date.now() }));
  } catch {}
  app.quit();
} else {
  // Secondary instance watcher (Fail-safe activation across Windows integrity levels)
  const checkPendingActivate = () => {
    try {
      if (fs.existsSync(PENDING_ACTIVATE_FILE)) {
        fs.unlinkSync(PENDING_ACTIVATE_FILE);
        logToFile('🔔 [Primary] Secondary instance requested activation via signal file.');
        showMainWindow();
      }
    } catch {}
  };
  setInterval(checkPendingActivate, 300);

  app.on('second-instance', () => {
    logToFile('🔔 [Instance] Second instance detected via Electron IPC, restoring main window.');
    showMainWindow();
  });

  app.whenReady().then(async () => {
    logToFile('⚡ [Electron] app.whenReady fired');
    try {
      // 2. Start Embedded POS Server
      await PosDatabase.initializeEngine();
      logToFile('✅ [SQLite] initializeEngine finished');
      const db = PosDatabase.getInstance();
      logToFile('✅ [SQLite] Database connection ready');

      posServer = new PosServer({ port: 3030 });
      serverPort = await posServer.start();
      logToFile(`🚀 [Server] Embedded POS Server listening on port ${serverPort}`);

      // 3. Create Native Desktop Window
      createMainWindow();

      // 4. Setup IPC Handlers
      setupIpcHandlers();
    } catch (err: any) {
      logToFile(`💥 Fatal Electron startup error: ${err?.stack || err?.message || err}`);
    }
  });
}

function getAppIcon(): NativeImage {
  const isWin = process.platform === 'win32';
  const iconNames = isWin ? ['icon.ico', 'icon.png'] : ['icon.png', 'icon.ico'];
  const possibleDirs = [
    path.join(__dirname, '..', 'assets'),
    path.join(__dirname, '..', '..', 'src', 'assets'),
    path.join(process.cwd(), 'apps', 'pos-client', 'src', 'assets'),
    path.join(process.cwd(), 'src', 'assets'),
    path.join(process.cwd(), 'dist', 'assets'),
  ];

  for (const dir of possibleDirs) {
    for (const name of iconNames) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) {
        try {
          const img = nativeImage.createFromPath(p);
          if (!img.isEmpty()) return img;
        } catch {}
      }
    }
  }

  return nativeImage.createEmpty();
}

function showMainWindow(): void {
  logToFile(`🪟 [Window] showMainWindow invoked (hasWindow=${!!mainWindow})`);
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.center();
  mainWindow.focus();

  // Temporarily force to top to break Windows 11 focus stealing restrictions
  mainWindow.setAlwaysOnTop(true);
  setTimeout(() => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(false);
      }
    } catch {}
  }, 400);
}

function createMainWindow(): void {
  const icon = getAppIcon();

  mainWindow = new BrowserWindow({
    title: 'QuazLink POS & ERP — نظام إدارة التجارة والكاشير',
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    icon: icon.isEmpty() ? undefined : icon,
    backgroundColor: '#0a0e17',
    show: false, // Prevents white unrendered flash on startup
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: process.env.NODE_ENV === 'development',
    },
  });

  // Remove default Chromium menu bar
  mainWindow.removeMenu();
  Menu.setApplicationMenu(null);

  // Load local POS server URL
  const targetUrl = `http://localhost:${serverPort}`;
  logToFile(`🪟 [Window] Loading URL: ${targetUrl}`);
  mainWindow.loadURL(targetUrl).catch((err) => {
    logToFile(`❌ [Window] loadURL error: ${err.message}`);
  });

  // Smooth Reveal once DOM is ready
  mainWindow.once('ready-to-show', () => {
    logToFile('🪟 [Window] ready-to-show event received.');
    showMainWindow();
  });

  // Fallback safety timeout: guarantee window is visible within 1.2 seconds
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      logToFile('🪟 [Window] Safety fallback timer revealing window.');
      showMainWindow();
    }
  }, 1200);

  // Crash and Fail-Load Safety Guards
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logToFile(`❌ [Window] did-fail-load: code=${errorCode} desc=${errorDescription} url=${validatedURL}`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logToFile(`❌ [Window] render-process-gone: reason=${details.reason} exitCode=${details.exitCode}`);
  });

  // Standard Window Close Event - terminates app cleanly
  mainWindow.on('close', () => {
    isQuitting = true;
    logToFile('🪟 [Window] Window close initiated.');
  });

  mainWindow.on('closed', () => {
    logToFile('🪟 [Window] Closed event received, exiting app.');
    mainWindow = null;
    app.quit();
  });

  // Register F11 for Fullscreen / Kiosk Toggle
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      if (mainWindow) {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
      }
      event.preventDefault();
    }
  });
}

function setupIpcHandlers(): void {
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.on('window-toggle-fullscreen', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });
}

// Clean Graceful Shutdown
app.on('before-quit', async () => {
  isQuitting = true;
  logToFile('🛑 [Electron] Shutting down QuazLink POS cleanly...');

  try {
    if (posServer) {
      await posServer.stop();
      logToFile('✅ [Electron] Embedded server stopped.');
    }
    const db = PosDatabase.getInstance();
    db.close();
    logToFile('✅ [Electron] Database connection closed.');
  } catch (err: any) {
    logToFile(`Error during shutdown: ${err?.message || err}`);
  }
});

app.on('window-all-closed', () => {
  logToFile('🪟 [Electron] window-all-closed event.');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
