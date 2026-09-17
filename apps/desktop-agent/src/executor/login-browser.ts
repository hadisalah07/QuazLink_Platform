import { Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  launchPersistentBrowserContext,
  launchStandardBrowser,
  LogCallback,
} from './browser-launcher';

export interface WSClientMessenger {
  send(payload: any): void;
}

export async function openLoginBrowser(
  platform: string,
  accountId: string,
  client: WSClientMessenger | null,
  logger?: LogCallback
): Promise<void> {
  const targetPlatform = platform.toLowerCase();
  try {
    console.log(`\n🔑 [LoginBrowser] Launching interactive login window for ${targetPlatform.toUpperCase()} (Account ID: ${accountId})...`);
    logger?.(`🔑 [Login] Launching login window for ${targetPlatform.toUpperCase()}...`, 'highlight');

    const sessionDir = path.join(os.homedir(), '.quazlink', 'sessions');
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    if (targetPlatform === 'whatsapp') {
      const profileDir = path.join(sessionDir, `profile_${accountId}_whatsapp`);
      const res = await launchPersistentBrowserContext(
        profileDir,
        {
          headless: false,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--start-maximized',
          ],
          viewport: null,
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
        logger
      );
      context = res.context;
      page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    } else {
      const res = await launchStandardBrowser(
        {
          headless: false,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--start-maximized',
          ],
        },
        logger
      );
      browser = res.browser;
      context = await browser.newContext({
        viewport: null, // Use full maximized window size
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      });
      page = await context.newPage();
    }

    const url =
      targetPlatform === 'instagram'
        ? 'https://www.instagram.com/accounts/login/'
        : targetPlatform === 'tiktok'
        ? 'https://www.tiktok.com/login'
        : targetPlatform === 'whatsapp'
        ? 'https://web.whatsapp.com/'
        : 'https://www.facebook.com/login';

    console.log(`🌐 [LoginBrowser] Navigating to ${url}...`);
    logger?.(`🌐 [Login] Navigating to ${url}...`, 'highlight');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((e: any) => {
      console.warn(`⚠️ [LoginBrowser] Initial page.goto notice: ${e.message}`);
    });

    if (targetPlatform === 'whatsapp') {
      console.log(`📱 [LoginBrowser] Please scan the WhatsApp Web QR code with your mobile phone.`);
      logger?.(`📱 [WhatsApp] Please scan the QR code on your screen using your phone.`, 'warn');
    } else {
      console.log(`👁️ [LoginBrowser] Login window is now open on your screen! Please enter your credentials.`);
      logger?.(`👁️ [Login] Please enter your credentials in the browser window.`, 'warn');
    }

    const closeBrowser = async () => {
      if (browser) await browser.close().catch(() => {});
      else if (context) await context.close().catch(() => {});
    };

    // 10-Minute Timeout logic
    const timeoutTimer = setTimeout(() => {
      console.warn('⏱️ [LoginTimeout] Login window was open for more than 10 minutes without success.');
      logger?.('⏱️ [Login] Window timeout exceeded 10 minutes.', 'warn');
      cleanup();
      closeBrowser();
    }, 10 * 60 * 1000);

    let isSuccess = false;

    const handleSuccess = async () => {
      if (isSuccess || !context) return;
      isSuccess = true;
      cleanup();

      console.log(`\n🎉 [Login] Authentication detected for ${targetPlatform}! Saving session...`);
      logger?.(`🎉 [Login] Authentication detected for ${targetPlatform.toUpperCase()}! Saving session...`, 'success');
      try {
        const sessionFile = path.join(sessionDir, `${accountId}_${targetPlatform}_session.json`);
        await context.storageState({ path: sessionFile }).catch(() => {});
        try {
          fs.chmodSync(sessionFile, 0o600);
        } catch {}

        console.log(`✅ [Login] Successfully saved authenticated session for ${targetPlatform}`);
        logger?.(`✅ [Login] Session saved! Cloud account is now ACTIVE.`, 'success');
        if (client) {
          client.send({
            type: 'job:connect_success',
            jobId: accountId,
            platform: targetPlatform,
          });
        }

        // Graceful automatic close after 3 seconds so user sees confirmation
        setTimeout(() => {
          closeBrowser();
        }, 3500);
      } catch (err: any) {
        console.error('❌ [Login] Error writing storage state:', err.message);
        logger?.(`❌ [Login] Failed to save session: ${err.message}`, 'red');
      }
    };

    // Check 1: Listen for frame navigation (for platforms with URL redirects)
    page.on('framenavigated', async (frame: any) => {
      if (!page) return;
      if (frame === page.mainFrame()) {
        const u = frame.url();
        const isNotLoginPage =
          targetPlatform === 'instagram'
            ? !u.includes('/accounts/login') && !u.includes('/login') && u.includes('instagram.com')
            : targetPlatform === 'tiktok'
            ? !u.includes('/login') && u.includes('tiktok.com')
            : targetPlatform === 'whatsapp'
            ? false
            : !u.includes('login') && !u.includes('/login') && u.includes('facebook.com');

        if (isNotLoginPage) {
          await handleSuccess();
        }
      }
    });

    // Check 2: Polling cookie and DOM check (vital for React/SPA & WhatsApp QR login)
    const pollInterval = setInterval(async () => {
      if (isSuccess || !page || !context) return;
      try {
        if (targetPlatform === 'whatsapp') {
          const isWhatsAppReady = await page.evaluate(() => {
            const hasQr = !!document.querySelector('canvas[aria-label="Scan this QR code to link a device!"]') || !!document.querySelector('div[data-ref]');
            const hasChatList = !!document.querySelector('#pane-side') || !!document.querySelector('div[aria-label="Chat list"]') || !!document.querySelector('header');
            return hasChatList && !hasQr;
          }).catch(() => false);

          if (isWhatsAppReady) {
            await handleSuccess();
            return;
          }
        }

        const cookies = await context.cookies();
        const hasSessionCookie = cookies.some((c: any) => {
          if (targetPlatform === 'instagram') return c.name === 'sessionid' || c.name === 'ds_user_id';
          if (targetPlatform === 'facebook') return c.name === 'c_user' || c.name === 'xs';
          return false;
        });

        const currentUrl = page.url();
        const isNotLoginPage =
          targetPlatform === 'instagram'
            ? !currentUrl.includes('/accounts/login') && !currentUrl.includes('/login') && currentUrl.includes('instagram.com')
            : targetPlatform === 'tiktok'
            ? !currentUrl.includes('/login') && currentUrl.includes('tiktok.com')
            : targetPlatform === 'whatsapp'
            ? false
            : !currentUrl.includes('login') && !currentUrl.includes('/login') && currentUrl.includes('facebook.com');

        if (hasSessionCookie || isNotLoginPage) {
          await handleSuccess();
        }
      } catch {}
    }, 2000);

    const cleanup = () => {
      clearTimeout(timeoutTimer);
      clearInterval(pollInterval);
    };

    // Cancellation detection
    const onDisconnect = async () => {
      cleanup();
      if (!isSuccess && client) {
        console.log(`🚫 [Login] User closed browser without completing login for ${targetPlatform}.`);
        logger?.(`🚫 [Login] Browser closed before completing login for ${targetPlatform.toUpperCase()}.`, 'warn');
        client.send({
          type: 'job:cancelled',
          jobId: accountId,
          isConnectJob: true,
          error: 'User manually closed the browser before completing login.',
        });
      }
    };

    if (browser) {
      browser.on('disconnected', onDisconnect);
    } else if (context) {
      context.on('close', onDisconnect);
    }
  } catch (err: any) {
    console.error('❌ [LoginBrowser] Error launching login window:', err.message);
    logger?.(`❌ [Login Error] Could not open browser: ${err.message}`, 'red');
    if (client) {
      client.send({
        type: 'job:cancelled',
        jobId: accountId,
        isConnectJob: true,
        error: `Browser launch failed: ${err.message}`,
      });
    }
  }
}
