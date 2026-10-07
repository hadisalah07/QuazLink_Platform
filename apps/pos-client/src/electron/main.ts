import { app, BrowserWindow, Menu, Tray, nativeImage, NativeImage, ipcMain } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { PosServer } from '../server/api-server.js';
import { PosDatabase } from '../database/connection.js';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let posServer: PosServer | null = null;
let serverPort: number = 3030;
let isQuitting = false;

// 1. Single Instance Guard (منع تشغيل أكثر من نسخة لتفادي قفل قاعدة بيانات SQLite)
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  console.log('⚠️ [Electron] Another instance of QuazLink POS is already running. Exiting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      // 2. Start Embedded POS Server (تشغيل السيرفر المحلي المدمج)
      await PosDatabase.initializeEngine();
      const db = PosDatabase.getInstance();
      posServer = new PosServer({ port: 3030 });
      serverPort = await posServer.start();
      console.log(`🚀 [Electron] Embedded POS Server started on port ${serverPort}`);

      // 3. Create Native Desktop Window
      createMainWindow();

      // 4. Create System Tray Icon
      createSystemTray();

      // 5. Setup IPC Handlers
      setupIpcHandlers();
    } catch (err) {
      console.error('Fatal Electron startup error:', err);
    }
  });
}

function getAppIcon(): NativeImage {
  const possiblePaths = [
    path.join(__dirname, '..', 'assets', 'icon.png'),
    path.join(__dirname, '..', '..', 'src', 'assets', 'icon.png'),
    path.join(process.cwd(), 'apps', 'pos-client', 'src', 'assets', 'icon.png'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return nativeImage.createFromPath(p);
    }
  }

  // Fallback transparent empty image
  return nativeImage.createEmpty();
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
    show: false, // Prevent white flicker on startup
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: process.env.NODE_ENV === 'development',
    },
  });

  // Remove default Chromium menu bar
  mainWindow.removeMenu();
  Menu.setApplicationMenu(null);

  // Load local POS server URL
  mainWindow.loadURL(`http://localhost:${serverPort}`);

  // Smooth Reveal once DOM is ready
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Handle Close Event (Minimize to tray on window close, or quit)
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      if (mainWindow) mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
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

function createSystemTray(): void {
  const icon = getAppIcon();
  if (icon.isEmpty()) return;

  const trayIcon = icon.resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip('QuazLink POS & ERP — متصل وجاهز للعمل');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '🛒 عرض شاشة الكاشير (Show POS)',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: '🖥️ وضع ملء الشاشة (F11)',
      click: () => {
        if (mainWindow) {
          mainWindow.setFullScreen(!mainWindow.isFullScreen());
        }
      },
    },
    {
      label: '🔄 إعادة تحميل الصفحة (Reload)',
      click: () => {
        if (mainWindow) {
          mainWindow.reload();
        }
      },
    },
    { type: 'separator' },
    {
      label: '❌ خروج نهائي من النظام (Exit)',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
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
}

// Clean Graceful Shutdown
app.on('before-quit', async () => {
  isQuitting = true;
  console.log('🛑 [Electron] Shutting down QuazLink POS cleanly...');

  try {
    if (posServer) {
      await posServer.stop();
      console.log('✅ [Electron] Embedded server stopped.');
    }
    const db = PosDatabase.getInstance();
    db.close();
    console.log('✅ [Electron] Database connection closed.');
  } catch (err) {
    console.warn('Error during shutdown:', err);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
