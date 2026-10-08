import { app, BrowserWindow, Menu, nativeImage, NativeImage, ipcMain } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { PosServer } from '../server/api-server.js';
import { PosDatabase } from '../database/connection.js';

// Dedicated Persistent Log Engine for QuazLink POS Client
const CONFIG_DIR = path.join(os.homedir(), '.quazlink');
const LOG_FILE = path.join(CONFIG_DIR, 'pos_electron.log');
const USER_DATA_DIR = path.join(CONFIG_DIR, 'pos_electron_data');

try {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  if (!fs.existsSync(USER_DATA_DIR)) fs.mkdirSync(USER_DATA_DIR, { recursive: true });
} catch {}

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
    const text = args
      .map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ');
    logToFile(text);
  } catch {}
};
console.error = (...args: any[]) => {
  origErr(...args);
  try {
    const text = args
      .map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ');
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

// Explicitly set clean app name and userData to prevent invalid named pipes/paths on Windows
try {
  app.name = 'quazlink-pos-erp';
  app.setPath('userData', USER_DATA_DIR);
  logToFile(`📁 [Storage] userData set to: ${USER_DATA_DIR}`);
} catch (err: any) {
  logToFile(`⚠️ [Storage] Failed setting userData: ${err?.message || err}`);
}

// Robust Chromium flags for Windows POS terminals
try {
  app.commandLine.appendSwitch('no-sandbox');
} catch {}

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
      const DB_PATH = path.join(USER_DATA_DIR, 'pos.sqlite');
      const db = PosDatabase.getInstance(DB_PATH);
      logToFile(`✅ [SQLite] Database connection ready at: ${DB_PATH}`);

      posServer = new PosServer({ port: 3030, dbPath: DB_PATH });
      serverPort = await posServer.start();
      logToFile(`🚀 [Server] Embedded POS Server listening on port ${serverPort}`);

      // 3. Create Native Desktop Window
      createMainWindow();

      // 4. Setup IPC Handlers
      setupIpcHandlers();

      // 5. Secondary instance watcher (Fail-safe activation across Windows integrity levels)
      const checkPendingActivate = () => {
        try {
          if (fs.existsSync(PENDING_ACTIVATE_FILE)) {
            fs.unlinkSync(PENDING_ACTIVATE_FILE);
            logToFile('🔔 [Primary] Secondary instance requested activation via signal file.');
            showMainWindow();
          }
        } catch {}
      };
      setInterval(checkPendingActivate, 400);

      // 6. On-Demand Live Screenshot Trigger Watcher
      const SNAPSHOT_TRIGGER_FILE = path.join(CONFIG_DIR, 'pos_snapshot_trigger.json');
      const checkSnapshotTrigger = async () => {
        try {
          if (fs.existsSync(SNAPSHOT_TRIGGER_FILE) && mainWindow && !mainWindow.isDestroyed()) {
            const raw = fs.readFileSync(SNAPSHOT_TRIGGER_FILE, 'utf-8');
            try { fs.unlinkSync(SNAPSHOT_TRIGGER_FILE); } catch {}
            const data = JSON.parse(raw || '{}');
            if (data.evalScript) {
              await mainWindow.webContents.executeJavaScript(data.evalScript);
              await new Promise((r) => setTimeout(r, 400));
            }
            const img = await mainWindow.webContents.capturePage();
            const savePath = path.join(CONFIG_DIR, data.filename || 'pos_window_capture.png');
            fs.writeFileSync(savePath, img.toPNG());
            const artifactPath = path.join(
              'C:\\Users\\Mohamed\\.gemini\\antigravity-ide\\brain\\7685dd5f-c044-462d-9e10-84db37890ff1',
              data.filename || 'pos_window_capture.png'
            );
            fs.writeFileSync(artifactPath, img.toPNG());
            logToFile(`📸 [Snapshot Trigger] Captured page: ${savePath}`);
          }
        } catch (err: any) {
          logToFile(`⚠️ [Snapshot Trigger] Error: ${err?.message}`);
        }
      };
      setInterval(checkSnapshotTrigger, 400);
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
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }

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
  const appIcon = getAppIcon();
  mainWindow = new BrowserWindow({
    title: 'QuazLink POS & ERP',
    icon: appIcon.isEmpty() ? undefined : appIcon,
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#0a0e17',
    show: true, // Visible immediately with native dark theme
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false, // Seamless local API and asset integration
      devTools: process.env.NODE_ENV === 'development',
    },
  });

  const htmlPath = fs.existsSync(path.join(__dirname, '..', 'ui', 'index.html'))
    ? path.join(__dirname, '..', 'ui', 'index.html')
    : path.join(process.cwd(), 'src', 'ui', 'index.html');

  logToFile(`🪟 [Window] Loading UI from: ${htmlPath}`);
  mainWindow.loadFile(htmlPath).catch((err) => {
    logToFile(`❌ [Window] loadFile error: ${err.message}, falling back to local server`);
    mainWindow?.loadURL(`http://localhost:${serverPort}`).catch(() => {});
  });

  // Smooth Reveal once DOM is painted and ready
  mainWindow.once('ready-to-show', () => {
    logToFile('🪟 [Window] ready-to-show event received.');
    showMainWindow();
  });

  // Safety fallback: reveal window after 1200ms if ready-to-show didn't fire
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      logToFile('🪟 [Window] Safety fallback timer revealing window.');
      showMainWindow();
    }
  }, 1200);

  // Capture rendered snapshot after DOM is fully painted
  setTimeout(async () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const img = await mainWindow.webContents.capturePage();
        const savePath = path.join(CONFIG_DIR, 'pos_window_capture.png');
        fs.writeFileSync(savePath, img.toPNG());
        const artifactPath = path.join(
          'C:\\Users\\Mohamed\\.gemini\\antigravity-ide\\brain\\7685dd5f-c044-462d-9e10-84db37890ff1',
          'pos_window_capture.png'
        );
        fs.writeFileSync(artifactPath, img.toPNG());
        logToFile(`📸 [Snapshot] Captured window view to: ${savePath}`);
      }
    } catch (e: any) {
      logToFile(`⚠️ [Snapshot] Failed capturing snapshot: ${e?.message || e}`);
    }
  }, 1800);

  // Forward Renderer Console Messages to Pos Electron Log
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    logToFile(`🖥️ [Renderer Console][lvl:${level}] ${message} (${sourceId}:${line})`);
  });

  // Crash and Fail-Load Safety Guards
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logToFile(`❌ [Window] did-fail-load: code=${errorCode} desc=${errorDescription} url=${validatedURL}`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logToFile(`💥 [Window] render-process-gone: reason=${details.reason} exitCode=${details.exitCode}`);
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

  // Register Global Keyboard Accelerators (F11 Fullscreen, Zoom In/Out/Reset)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    if (input.key === 'F11') {
      if (mainWindow) {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
      }
      event.preventDefault();
      return;
    }

    if (input.control) {
      // Zoom In: Ctrl + = or Ctrl + + or NumpadAdd or Equal
      if (
        input.key === '=' ||
        input.key === '+' ||
        input.code === 'Equal' ||
        input.code === 'NumpadAdd'
      ) {
        if (mainWindow) {
          const currentZoom = mainWindow.webContents.getZoomFactor();
          const newZoom = Math.min(2.5, Math.round((currentZoom + 0.1) * 10) / 10);
          mainWindow.webContents.setZoomFactor(newZoom);
          logToFile(`🔍 [Zoom] Zoom In: factor=${newZoom}`);
          mainWindow.webContents.send('zoom-changed', newZoom);
        }
        event.preventDefault();
        return;
      }

      // Zoom Out: Ctrl + - or Ctrl + _ or NumpadSubtract or Minus
      if (
        input.key === '-' ||
        input.key === '_' ||
        input.code === 'Minus' ||
        input.code === 'NumpadSubtract'
      ) {
        if (mainWindow) {
          const currentZoom = mainWindow.webContents.getZoomFactor();
          const newZoom = Math.max(0.5, Math.round((currentZoom - 0.1) * 10) / 10);
          mainWindow.webContents.setZoomFactor(newZoom);
          logToFile(`🔍 [Zoom] Zoom Out: factor=${newZoom}`);
          mainWindow.webContents.send('zoom-changed', newZoom);
        }
        event.preventDefault();
        return;
      }

      // Reset Zoom: Ctrl + 0 or Numpad0 or Digit0
      if (
        input.key === '0' ||
        input.code === 'Digit0' ||
        input.code === 'Numpad0'
      ) {
        if (mainWindow) {
          mainWindow.webContents.setZoomFactor(1.0);
          logToFile('🔍 [Zoom] Reset to 1.0 (100%)');
          mainWindow.webContents.send('zoom-changed', 1.0);
        }
        event.preventDefault();
        return;
      }
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

  ipcMain.on('window-set-zoom', (_event, factor: number) => {
    if (mainWindow && typeof factor === 'number') {
      const clamped = Math.min(2.5, Math.max(0.5, factor));
      mainWindow.webContents.setZoomFactor(clamped);
      logToFile(`🔍 [Zoom] IPC setZoomFactor: ${clamped}`);
    }
  });

  ipcMain.handle('window-get-zoom', () => {
    return mainWindow ? mainWindow.webContents.getZoomFactor() : 1.0;
  });
}

app.on('child-process-gone', (_event, details) => {
  logToFile(`⚠️ [Process] Child process gone: type=${details.type} reason=${details.reason} exitCode=${details.exitCode} name=${details.name || 'unnamed'}`);
});

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
