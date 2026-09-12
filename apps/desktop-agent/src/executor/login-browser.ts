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
    console.log(`\n🔑 [LoginBrowser] Opening interactive login browser for ${platform.toUpperCase()} (Account: ${accountId})...`);
    const browser = await chromium.launch({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    const targetPlatform = platform.toLowerCase();
    const url =
      targetPlatform === 'instagram'
        ? 'https://www.instagram.com/accounts/login/'
        : targetPlatform === 'tiktok'
        ? 'https://www.tiktok.com/login'
        : 'https://www.facebook.com/login';

    await page.goto(url);

    // 10-Minute Timeout logic
    const timeoutTimer = setTimeout(() => {
      console.warn('⏱️ [LoginTimeout] Login window was open for more than 10 minutes without success.');
      browser.close().catch(() => {});
    }, 10 * 60 * 1000);

    let isSuccess = false;

    // Check for success via navigation
    page.on('framenavigated', async (frame) => {
      if (frame === page.mainFrame()) {
        const u = frame.url();
        // Navigation away from login pages indicates successful authentication
        const isNotLoginPage =
          targetPlatform === 'instagram'
            ? !u.includes('/accounts/login') && !u.includes('/login')
            : targetPlatform === 'tiktok'
            ? !u.includes('/login')
            : !u.includes('login') && !u.includes('/login');

        if (isNotLoginPage) {
          try {
            isSuccess = true;
            clearTimeout(timeoutTimer);
            const sessionDir = path.join(os.homedir(), '.quazlink', 'sessions');
            if (!fs.existsSync(sessionDir)) {
              fs.mkdirSync(sessionDir, { recursive: true });
            }
            const sessionFile = path.join(sessionDir, `${accountId}_${targetPlatform}_session.json`);
            await context.storageState({ path: sessionFile });
            try {
              fs.chmodSync(sessionFile, 0o600);
            } catch {}

            // Notify API that login succeeded
            console.log(`\n✅ [Login] Successfully saved authenticated session for ${targetPlatform} (Account: ${accountId})!`);
            if (client) {
              client.send({
                type: 'job:connect_success',
                jobId: accountId,
                platform: targetPlatform,
              });
            }

            // Close browser automatically after 3 seconds of success
            setTimeout(() => {
              browser.close().catch(() => {});
            }, 3000);
          } catch (err) {
            console.error('❌ [Login] Error saving storage state:', err);
          }
        }
      }
    });

    // Cancellation detection
    browser.on('disconnected', async () => {
      clearTimeout(timeoutTimer);
      if (!isSuccess && client) {
        console.log(`🚫 [Login] User closed browser without completing login for ${targetPlatform}.`);
        client.send({
          type: 'job:cancelled',
          jobId: accountId,
          isConnectJob: true,
          error: 'User manually closed the browser before completing login.',
        });
      }
    });
  } catch (err: any) {
    console.error('❌ [LoginBrowser] Error launching login window:', err.message);
  }
}
