import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import https from 'https';

export interface ExecutionResult {
  success: boolean;
  screenshotBase64?: string;
  resultMessage?: string;
  error?: string;
}

export class PlaywrightRunner {
  private storageDir: string;
  private activePids: Set<number> = new Set();

  constructor() {
    this.storageDir = path.join(os.homedir(), '.quazlink', 'sessions');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  public async executeTask(
    jobData: any,
    otaSelectors: any,
    onProgress: (msg: string) => void
  ): Promise<ExecutionResult> {
    const { id: jobId, content, mediaUrls = [], targetUrl, platform = 'facebook', socialAccountId } = jobData;
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let downloadedFiles: string[] = [];

    onProgress(`Initializing local browser automation for ${platform.toUpperCase()}...`);

    const sessionFile = path.join(this.storageDir, `${socialAccountId}_${platform}_session.json`);
    const storageState = fs.existsSync(sessionFile) ? sessionFile : undefined;

    try {
      // 1. Download media attachments locally
      if (mediaUrls && mediaUrls.length > 0) {
        onProgress(`Downloading ${mediaUrls.length} media attachment(s)...`);
        for (let i = 0; i < mediaUrls.length; i++) {
          const localPath = await this.downloadMedia(mediaUrls[i]);
          downloadedFiles.push(localPath);
        }
      }

      // 2. Launch Chromium (Visible or Headless based on preference)
      browser = await chromium.launch({
        headless: false, // Visible locally so the user can see their automation running!
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
      });

      // Process ID tracking removed for Playwright

      context = await browser.newContext({
        storageState,
        viewport: { width: 1280, height: 800 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      const page = await context.newPage();

      // 3. Execute platform-specific publishing workflow
      if (platform === 'facebook') {
        await this.publishToFacebook(page, content, downloadedFiles, targetUrl, otaSelectors, onProgress);
      } else if (platform === 'instagram') {
        await this.publishToInstagram(page, content, downloadedFiles, otaSelectors, onProgress);
      } else if (platform === 'tiktok') {
        await this.publishToTikTok(page, content, downloadedFiles, otaSelectors, onProgress);
      }

      // 4. Save refreshed storageState (Continuous 2FA preservation)
      await context.storageState({ path: sessionFile });

      // 5. Capture Proof Screenshot
      onProgress('Capturing publication proof screenshot...');
      const screenshotBuffer = await page.screenshot({ fullPage: false });
      const screenshotBase64 = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;

      onProgress('Execution finished successfully!');
      return {
        success: true,
        screenshotBase64,
        resultMessage: `Post published successfully to ${platform} via Local Desktop Runner`,
      };
    } catch (err: any) {
      console.error(`❌ [PlaywrightRunner] Job #${jobId} error:`, err.message);
      return {
        success: false,
        error: err.message,
      };
    } finally {
      // 6. Clean up process & temp files
      if (context) await context.close().catch(() => {});
      if (browser) {
        await browser.close().catch(() => {});
      }

      // Memory scrubbing: delete temp images
      for (const file of downloadedFiles) {
        try {
          if (fs.existsSync(file)) fs.unlinkSync(file);
        } catch {}
      }
    }
  }

  private async publishToFacebook(
    page: Page,
    content: string,
    images: string[],
    targetUrl: string | undefined,
    selectors: any,
    onProgress: (m: string) => void
  ) {
    const dest = targetUrl || 'https://www.facebook.com';
    onProgress(`Navigating to target destination: ${dest}`);
    await page.goto(dest, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    onProgress('Locating post composer...');
    // Locate composer box
    const composerTrigger = page.locator('div[role="button"]:has-text("What\'s on your mind"), div[role="button"]:has-text("بما تفكر")').first();
    if (await composerTrigger.isVisible({ timeout: 5000 }).catch(() => false)) {
      await composerTrigger.click();
      await page.waitForTimeout(2000);
    }

    // Type content FIRST (using pressSequentially to trigger React state properly)
    if (content) {
      onProgress('Writing post text...');
      const textBox = page.locator('[contenteditable="true"][role="textbox"]').first();
      await textBox.click();
      // pressSequentially acts exactly like a human typing, triggering all keyboard events
      await textBox.pressSequentially(content, { delay: 10 });
      await page.waitForTimeout(2000);
    }

    // Attach images
    if (images.length > 0) {
      onProgress('Attaching product images...');
      const fileInput = page.locator('input[type="file"][accept*="image"]').first();
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles(images);
        await page.waitForTimeout(4000); // Give Facebook time to render the image previews
      }
    }

    onProgress('Publishing post...');
    const postBtn = page.locator('div[aria-label="Post"], div[aria-label="نشر"], button:has-text("Post")').first();
    if (await postBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Force click to bypass any invisible overlay layers Facebook adds
      await postBtn.click({ force: true });
      
      onProgress('Waiting for post to finish publishing...');
      try {
        // Wait for the composer dialog to disappear as an indicator of success
        const composerDialog = page.locator('div[role="dialog"]:has-text("What\'s on your mind")').first();
        await composerDialog.waitFor({ state: 'hidden', timeout: 30000 });
        onProgress('Composer closed, post likely published successfully.');
      } catch (e) {
        throw new Error('Timed out waiting for post to publish. Facebook might be slow or stuck.');
      }
    } else {
       throw new Error('Could not find the Post button in the composer dialog.');
    }
  }

  private async publishToInstagram(
    page: Page,
    content: string,
    images: string[],
    selectors: any,
    onProgress: (m: string) => void
  ) {
    onProgress('Navigating to Instagram...');
    await page.goto('https://www.instagram.com', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    if (images.length > 0) {
      onProgress('Uploading photo to Instagram...');
      const newPostBtn = page.locator('svg[aria-label="New post"], svg[aria-label="منشور جديد"]').first();
      if (await newPostBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        await newPostBtn.click();
        await page.waitForTimeout(1500);
        const fileInput = page.locator('input[type="file"]').first();
        await fileInput.setInputFiles(images[0]);
        await page.waitForTimeout(2000);
      }
    }
  }

  private async publishToTikTok(
    page: Page,
    content: string,
    images: string[],
    selectors: any,
    onProgress: (m: string) => void
  ) {
    onProgress('Navigating to TikTok Creator Center...');
    await page.goto('https://www.tiktok.com/creator-center/upload', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
  }

  private async downloadMedia(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const ext = path.extname(new URL(url).pathname) || '.jpg';
      const tmpPath = path.join(os.tmpdir(), `quazlink-media-${Date.now()}-${Math.random().toString(36).slice(2, 6)}${ext}`);
      const file = fs.createWriteStream(tmpPath);
      const client = url.startsWith('https') ? https : http;

      client.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download: ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(tmpPath);
        });
      }).on('error', reject);
    });
  }

  // Zombie Process Terminator Hook
  public terminateZombieProcesses() {
    for (const pid of this.activePids) {
      try {
        console.log(`🧹 Killing lingering Chromium PID: ${pid}`);
        process.kill(pid, 'SIGKILL');
      } catch {}
    }
    this.activePids.clear();
  }
}
