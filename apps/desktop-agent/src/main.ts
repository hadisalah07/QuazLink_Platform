import { app, BrowserWindow, Tray, Menu, powerSaveBlocker, ipcMain, nativeImage, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { RunnerWSClient } from './client/ws-client';
import { chromium } from 'playwright';

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
      console.log('🔑 [DeepLink] Received auto-pairing request via deep link.');
      // SECURITY (§6): any website can invoke quazlink://… — never pair silently on its say-so.
      // Require an explicit human confirmation before binding this machine to an account.
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
      const opts = {
        type: 'warning' as const,
        buttons: ['Pair this machine', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
        title: 'Confirm Device Pairing',
        message: 'A website is asking to pair this runner to a QuazLink account.',
        detail:
          'Only continue if you just started pairing from the QuazLink dashboard yourself. ' +
          'Pairing lets that account send publishing jobs to this machine.',
      };
      const choice = mainWindow
        ? dialog.showMessageBoxSync(mainWindow, opts)
        : dialog.showMessageBoxSync(opts);
      if (choice === 0) {
        appConfig.pairingToken = token.trim();
        saveConfig(appConfig);
        wsClient?.cleanup();
        initializeRunnerClient();
      } else {
        console.log('🚫 [DeepLink] User declined the pairing request.');
      }
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

  mainWindow.on('blur', () => {
    mainWindow?.hide();
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
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('status-updated', { status, info, config: appConfig });
      }
    },
    onConnectRequest: (platform, accountId) => {
      openLoginBrowser(platform, accountId, wsClient);
    },
    // §14: interactive prompts are injected by the host (the WS client is now Electron-free).
    // The desktop app backs them with native dialogs; the headless CLI supplies auto-approve.
    confirmJob: async (payload) => {
      const opts = {
        type: 'question' as const,
        buttons: ['Run now', 'Reject'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
        title: 'New Publishing Job',
        message: `QuazLink wants to publish a ${payload?.platform || 'social'} post on this machine.`,
        detail: 'This will open an automated browser and post to your connected account.',
      };
      const { response } = mainWindow
        ? await dialog.showMessageBox(mainWindow, opts)
        : await dialog.showMessageBox(opts);
      return response === 0;
    },
    confirmSync: async (count) => {
      const opts = {
        type: 'question' as const,
        buttons: ['Fetch & run', 'Not now'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
        title: 'Pending Posts Available',
        message: `You have ${count} pending post${count === 1 ? '' : 's'} waiting to publish.`,
        detail: 'Fetch them from the cloud and run them on this machine now?',
      };
      const { response } = mainWindow
        ? await dialog.showMessageBox(mainWindow, opts)
        : await dialog.showMessageBox(opts);
      return response === 0;
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

  ipcMain.on('unpair-device', () => {
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

async function openLoginBrowser(platform: string, accountId: string, client: RunnerWSClient | null) {
  try {
    const browser = await chromium.launch({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    
    const url = platform === 'instagram' ? 'https://www.instagram.com/accounts/login/' 
              : platform === 'tiktok' ? 'https://www.tiktok.com/login' 
              : 'https://www.facebook.com/login';
    await page.goto(url);

    // 10-Minute Timeout logic
    const timeoutTimer = setTimeout(() => {
      console.warn('⏱️ [LoginTimeout] Login window was open for more than 10 minutes without success.');
      browser.close().catch(() => {}); // This will trigger the close event
    }, 10 * 60 * 1000);

    let isSuccess = false;

    // Check for success via navigation
    page.on('framenavigated', async (frame) => {
      if (frame === page.mainFrame()) {
        const u = frame.url();
        // Simple success criteria: navigated away from login pages
        if (!u.includes('login') && !u.includes('/accounts/login')) {
          try {
            isSuccess = true;
            clearTimeout(timeoutTimer);
            const sessionDir = path.join(os.homedir(), '.quazlink', 'sessions');
            if (!fs.existsSync(sessionDir)) {
              fs.mkdirSync(sessionDir, { recursive: true });
            }
            const sessionFile = path.join(sessionDir, `${accountId}_${platform}_session.json`);
            await context.storageState({ path: sessionFile });
            // NOTE (§12): chmod is effectively a no-op on Windows (the runner's primary OS);
            // real per-user locking would need an ACL (icacls). Best-effort, and must never
            // throw past this point or it would skip the job:connect_success below.
            try { fs.chmodSync(sessionFile, 0o600); } catch {}
            
            // Notify API that login succeeded
            console.log(`✅ [Login] Successfully saved session for account ${accountId}`);
            if (client) {
              client.send({
                type: 'job:connect_success',
                jobId: accountId,
                platform: platform,
              });
            }
            
            // Optional: Close browser automatically after 3 seconds of success
            setTimeout(() => { browser.close().catch(() => {}); }, 3000);
          } catch (err) {}
        }
      }
    });
    
    // Cancellation detection
    browser.on('disconnected', async () => {
      clearTimeout(timeoutTimer);
      if (!isSuccess && client) {
        console.log(`🚫 [Login] User closed the browser without logging in.`);
        client.send({
          type: 'job:cancelled',
          jobId: accountId,
          isConnectJob: true,
          error: 'User manually closed the browser before completing login.'
        });
      }
    });
    
  } catch (error: any) {
    console.error('Failed to open login window:', error.message);
    if (client) {
      client.send({
        type: 'job:failed',
        jobId: accountId,
        isConnectJob: true,
        error: 'Failed to launch Playwright browser on runner.'
      });
    }
  }
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
