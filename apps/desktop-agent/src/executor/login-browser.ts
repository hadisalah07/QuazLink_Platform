import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface WSClientMessenger {
  send(payload: any): void;
}

export async function openLoginBrowser(
  platform: string,
  accountId: string,
  client: WSClientMessenger | null
): Promise<void> {
  try {
    const targetPlatform = platform.toLowerCase();
    console.log(`\n🔑 [LoginBrowser] Launching interactive login window for ${targetPlatform.toUpperCase()} (Account ID: ${accountId})...`);
    
    const sessionDir = path.join(os.homedir(), '.quazlink', 'sessions');
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    let browser: any = null;
    let context: any = null;
    let page: any = null;

    if (targetPlatform === 'whatsapp') {
      const profileDir = path.join(sessionDir, `profile_${accountId}_whatsapp`);
      context = await chromium.launchPersistentContext(profileDir, {
        headless: false,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--start-maximized',
        ],
        viewport: null,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      });
      page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    } else {
      browser = await chromium.launch({
        headless: false,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--start-maximized',
        ],
      });
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
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((e: any) => {
      console.warn(`⚠️ [LoginBrowser] Initial page.goto notice: ${e.message}`);
    });

    if (targetPlatform === 'whatsapp') {
      console.log(`📱 [LoginBrowser] Please scan the WhatsApp Web QR code with your mobile phone.`);
    } else {
      console.log(`👁️ [LoginBrowser] Login window is now open on your screen! Please enter your credentials.`);
    }

    const closeBrowser = async () => {
      if (browser) await browser.close().catch(() => {});
      else if (context) await context.close().catch(() => {});
    };

    // 10-Minute Timeout logic
    const timeoutTimer = setTimeout(() => {
      console.warn('⏱️ [LoginTimeout] Login window was open for more than 10 minutes without success.');
      cleanup();
      closeBrowser();
    }, 10 * 60 * 1000);

    let isSuccess = false;

    const handleSuccess = async () => {
      if (isSuccess) return;
      isSuccess = true;
      cleanup();

      console.log(`\n🎉 [Login] Authentication detected for ${targetPlatform}! Saving session...`);
      try {
        const sessionFile = path.join(sessionDir, `${accountId}_${targetPlatform}_session.json`);
        await context.storageState({ path: sessionFile }).catch(() => {});
        try {
          fs.chmodSync(sessionFile, 0o600);
        } catch {}

        console.log(`✅ [Login] Successfully saved authenticated session for ${targetPlatform}`);
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
      }
    };

    // Check 1: Listen for frame navigation (for platforms with URL redirects)
    page.on('framenavigated', async (frame: any) => {
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
      if (isSuccess) return;
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
  }
}
