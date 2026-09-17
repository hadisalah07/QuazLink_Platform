import { chromium, Browser, BrowserContext } from 'playwright';
import fs from 'fs';
import path from 'path';

export type LogCallback = (message: string, type?: 'highlight' | 'success' | 'warn' | 'red') => void;

/**
 * Returns candidate Chromium channels to launch in order of preference.
 * Prioritizes installed system browsers (Google Chrome, Microsoft Edge)
 * so that end-user Windows machines run instantly without needing Playwright binary downloads.
 */
export function getAvailableBrowserChannels(): (string | undefined)[] {
  const detected: string[] = [];

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    const chromePaths = [
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ];
    if (chromePaths.some((p) => fs.existsSync(p))) {
      detected.push('chrome');
    }

    const edgePaths = [
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ];
    if (edgePaths.some((p) => fs.existsSync(p))) {
      detected.push('msedge');
    }
  } else if (process.platform === 'darwin') {
    if (fs.existsSync('/Applications/Google Chrome.app')) detected.push('chrome');
    if (fs.existsSync('/Applications/Microsoft Edge.app')) detected.push('msedge');
  } else {
    // Linux checks
    const linuxChrome = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium'];
    if (linuxChrome.some((p) => fs.existsSync(p))) detected.push('chrome');
  }

  // Ensure 'chrome' and 'msedge' are always attempted as fallbacks even if heuristic path didn't detect them
  if (!detected.includes('chrome')) detected.push('chrome');
  if (!detected.includes('msedge')) detected.push('msedge');

  // Final fallback: Playwright bundled Chromium (channel: undefined)
  const channels: (string | undefined)[] = [...detected, undefined];
  return channels;
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
 * Launch a persistent browser context with automatic channel fallback.
 */
export async function launchPersistentBrowserContext(
  userDataDir: string,
  options: any,
  logger?: LogCallback
): Promise<{ context: BrowserContext; channelUsed: string }> {
  cleanOrphanProfileLocks(userDataDir);

  const channels = getAvailableBrowserChannels();
  let lastError: any = null;

  for (const channel of channels) {
    try {
      const launchOpts = { ...options };
      if (channel) {
        launchOpts.channel = channel;
      } else {
        delete launchOpts.channel;
      }

      const channelLabel = channel ? channel.toUpperCase() : 'Bundled Chromium';
      logger?.(`Attempting to launch browser (${channelLabel})...`, 'highlight');

      const context = await chromium.launchPersistentContext(userDataDir, launchOpts);
      logger?.(`Browser context launched successfully via ${channelLabel}.`, 'success');
      return { context, channelUsed: channel || 'chromium' };
    } catch (err: any) {
      lastError = err;
      const channelLabel = channel ? channel.toUpperCase() : 'Bundled Chromium';
      console.warn(`⚠️ [BrowserLauncher] Channel ${channelLabel} failed: ${err.message}`);
    }
  }

  const errText = `Could not launch browser context on any channel (Chrome/Edge/Chromium). Error: ${lastError?.message || 'Unknown'}`;
  logger?.(errText, 'red');
  throw new Error(errText);
}

/**
 * Launch a standard browser instance with automatic channel fallback.
 */
export async function launchStandardBrowser(
  options: any,
  logger?: LogCallback
): Promise<{ browser: Browser; channelUsed: string }> {
  const channels = getAvailableBrowserChannels();
  let lastError: any = null;

  for (const channel of channels) {
    try {
      const launchOpts = { ...options };
      if (channel) {
        launchOpts.channel = channel;
      } else {
        delete launchOpts.channel;
      }

      const channelLabel = channel ? channel.toUpperCase() : 'Bundled Chromium';
      logger?.(`Attempting to launch browser (${channelLabel})...`, 'highlight');

      const browser = await chromium.launch(launchOpts);
      logger?.(`Browser launched successfully via ${channelLabel}.`, 'success');
      return { browser, channelUsed: channel || 'chromium' };
    } catch (err: any) {
      lastError = err;
      const channelLabel = channel ? channel.toUpperCase() : 'Bundled Chromium';
      console.warn(`⚠️ [BrowserLauncher] Channel ${channelLabel} failed: ${err.message}`);
    }
  }

  const errText = `Could not launch browser on any channel (Chrome/Edge/Chromium). Error: ${lastError?.message || 'Unknown'}`;
  logger?.(errText, 'red');
  throw new Error(errText);
}
