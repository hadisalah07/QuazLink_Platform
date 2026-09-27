import { chromium, Browser, BrowserContext } from 'playwright';
import fs from 'fs';
import path from 'path';

export type LogCallback = (message: string, type?: 'highlight' | 'success' | 'warn' | 'red') => void;

export interface BrowserCandidate {
  channel?: string;
  executablePath?: string;
  name: string;
}

/**
 * Returns candidate Chromium browsers to launch in order of preference.
 * Prioritizes direct system executable paths (Google Chrome, Microsoft Edge)
 * so that end-user Windows machines run reliably without depending on registry lookups.
 */
export function getBrowserCandidates(): BrowserCandidate[] {
  const candidates: BrowserCandidate[] = [];

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    // 1. Direct Chrome executable paths
    const chromePaths = [
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    for (const p of chromePaths) {
      if (fs.existsSync(p)) {
        candidates.push({ executablePath: p, name: `Google Chrome (${p})` });
        break;
      }
    }

    // 2. Direct Edge executable paths
    const edgePaths = [
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    for (const p of edgePaths) {
      if (fs.existsSync(p)) {
        candidates.push({ executablePath: p, name: `Microsoft Edge (${p})` });
        break;
      }
    }

    // 3. Direct Brave executable paths (common privacy Chromium alternative)
    const bravePaths = [
      path.join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      path.join(programFilesX86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    ];
    for (const p of bravePaths) {
      if (fs.existsSync(p)) {
        candidates.push({ executablePath: p, name: `Brave Browser (${p})` });
        break;
      }
    }
  } else if (process.platform === 'darwin') {
    const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const macEdge = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
    if (fs.existsSync(macChrome)) candidates.push({ executablePath: macChrome, name: 'Google Chrome' });
    if (fs.existsSync(macEdge)) candidates.push({ executablePath: macEdge, name: 'Microsoft Edge' });
  } else {
    // Linux checks
    const linuxPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/microsoft-edge',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) {
        candidates.push({ executablePath: p, name: path.basename(p) });
        break;
      }
    }
  }

  // Registry / Named channels fallback
  candidates.push({ channel: 'chrome', name: 'Google Chrome (Channel Registry)' });
  candidates.push({ channel: 'msedge', name: 'Microsoft Edge (Channel Registry)' });

  // Final fallback: Bundled Chromium
  candidates.push({ name: 'Playwright Bundled Chromium' });

  return candidates;
}

// Retain legacy export for backwards compatibility
export function getAvailableBrowserChannels(): (string | undefined)[] {
  return ['chrome', 'msedge', undefined];
}

/**
 * Clean lock files left by previous abruptly terminated Chromium sessions
 * to prevent the "Profile in use" hang on Windows.
 */
export function cleanOrphanProfileLocks(profileDir: string): void {
  if (!fs.existsSync(profileDir)) return;
  const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
  for (const lock of lockFiles) {
    const lockPath = path.join(profileDir, lock);
    try {
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
      }
    } catch {}
  }
}

/**
 * Launch a persistent browser context with automatic channel and executable fallback.
 */
export async function launchPersistentBrowserContext(
  userDataDir: string,
  options: any,
  logger?: LogCallback
): Promise<{ context: BrowserContext; channelUsed: string }> {
  cleanOrphanProfileLocks(userDataDir);

  const candidates = getBrowserCandidates();
  let lastError: any = null;

  for (const candidate of candidates) {
    try {
      const launchOpts = { ...options };
      if (candidate.executablePath) {
        launchOpts.executablePath = candidate.executablePath;
        delete launchOpts.channel;
      } else if (candidate.channel) {
        launchOpts.channel = candidate.channel;
        delete launchOpts.executablePath;
      } else {
        delete launchOpts.channel;
        delete launchOpts.executablePath;
      }

      logger?.(`Attempting to launch browser (${candidate.name})...`, 'highlight');

      const context = await chromium.launchPersistentContext(userDataDir, launchOpts);
      logger?.(`Browser context launched successfully via ${candidate.name}.`, 'success');
      return { context, channelUsed: candidate.name };
    } catch (err: any) {
      lastError = err;
      console.warn(`⚠️ [BrowserLauncher] Candidate ${candidate.name} failed: ${err.message}`);
    }
  }

  const errText = `Could not launch browser context on any channel (Chrome/Edge/Chromium). Error: ${lastError?.message || 'No browser found'}. Please ensure Google Chrome is installed on this machine (https://www.google.com/chrome).`;
  logger?.(errText, 'red');
  throw new Error(errText);
}

/**
 * Launch a standard browser instance with automatic channel and executable fallback.
 */
export async function launchStandardBrowser(
  options: any,
  logger?: LogCallback
): Promise<{ browser: Browser; channelUsed: string }> {
  const candidates = getBrowserCandidates();
  let lastError: any = null;

  for (const candidate of candidates) {
    try {
      const launchOpts = { ...options };
      if (candidate.executablePath) {
        launchOpts.executablePath = candidate.executablePath;
        delete launchOpts.channel;
      } else if (candidate.channel) {
        launchOpts.channel = candidate.channel;
        delete launchOpts.executablePath;
      } else {
        delete launchOpts.channel;
        delete launchOpts.executablePath;
      }

      logger?.(`Attempting to launch browser (${candidate.name})...`, 'highlight');

      const browser = await chromium.launch(launchOpts);
      logger?.(`Browser launched successfully via ${candidate.name}.`, 'success');
      return { browser, channelUsed: candidate.name };
    } catch (err: any) {
      lastError = err;
      console.warn(`⚠️ [BrowserLauncher] Candidate ${candidate.name} failed: ${err.message}`);
    }
  }

  const errText = `Could not launch browser on any channel (Chrome/Edge/Chromium). Error: ${lastError?.message || 'No browser found'}. Please ensure Google Chrome is installed on this machine (https://www.google.com/chrome).`;
  logger?.(errText, 'red');
  throw new Error(errText);
}

