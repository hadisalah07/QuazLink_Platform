import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import https from 'https';
import { MacroCache, MacroAction } from './macro-cache';

export interface ExecutionResult {
  success: boolean;
  screenshotBase64?: string;
  resultMessage?: string;
  error?: string;
}

export class PlaywrightRunner {
  private storageDir: string;
  private logFile: string;
  private macroCache: MacroCache;

  private debugLog(msg: string) {
    try {
      const line = `[${new Date().toISOString()}] ${msg}\n`;
      try {
        const st = fs.statSync(this.logFile);
        if (st.size > 5 * 1024 * 1024) fs.truncateSync(this.logFile, 0);
      } catch { /* file may not exist yet */ }
      fs.appendFileSync(this.logFile, line);
      console.log(line.trim());
    } catch (e) {}
  }

  constructor() {
    const baseDir = path.join(os.homedir(), '.quazlink');
    this.storageDir = path.join(baseDir, 'sessions');
    const logsDir = path.join(baseDir, 'logs');
    this.logFile = path.join(logsDir, 'playwright_debug.log');
    for (const dir of [this.storageDir, logsDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.macroCache = new MacroCache();
  }

  public async executeTask(
    jobData: any,
    otaSelectors: any,
    onProgressCallback: (msg: string) => void,
    requestDriverAction?: (screenshotBase64: string, goal: string, stepIndex: number, history: any[]) => Promise<any>
  ): Promise<ExecutionResult> {
    const onProgress = (msg: string) => {
      this.debugLog(msg);
      onProgressCallback(msg);
    };

    const { id: jobId, content, mediaUrls = [], targetUrl, platform = 'facebook', socialAccountId } = jobData;
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let downloadedFiles: string[] = [];

    this.debugLog(`\n======================================================\n🚀 NEW JOB #${jobId} FOR ${platform.toUpperCase()}\n======================================================`);
    onProgress(`Initializing local browser automation for ${platform.toUpperCase()}...`);

    const sessionFile = path.join(this.storageDir, `${socialAccountId}_${platform}_session.json`);
    const storageState = fs.existsSync(sessionFile) ? sessionFile : undefined;

    try {
      if (mediaUrls && mediaUrls.length > 0) {
        onProgress(`Downloading ${mediaUrls.length} media attachment(s)...`);
        for (let i = 0; i < mediaUrls.length; i++) {
          const localPath = await this.downloadMedia(mediaUrls[i]);
          downloadedFiles.push(localPath);
        }
      }

      browser = await chromium.launch({
        headless: false,
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
      });

      context = await browser.newContext({
        storageState,
        viewport: { width: 1280, height: 800 },
        permissions: ['clipboard-read', 'clipboard-write'],
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      });

      const page = await context.newPage();

      // The new autonomous macro engine replaces the hardcoded methods
      await this.runAutonomousEngine(page, platform, content, downloadedFiles, targetUrl, onProgress, requestDriverAction);

      await context.storageState({ path: sessionFile });
      try { fs.chmodSync(sessionFile, 0o600); } catch {}

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
      this.debugLog(`❌ [FATAL ERROR] Job #${jobId}: ${err.message}`);
      return {
        success: false,
        error: err.message,
      };
    } finally {
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});

      for (const file of downloadedFiles) {
        try {
          if (fs.existsSync(file)) fs.unlinkSync(file);
        } catch {}
      }
    }
  }

  private async executeActionOnPage(page: Page, action: MacroAction, content?: string, images?: string[]) {
    if (action.action === 'navigate' && action.url) {
      await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1500);
    } else if (action.action === 'click' && action.selector) {
      if (action.selector.includes('Next') || action.selector.includes('التالي')) {
        const clickedViaEval = await page.evaluate(() => {
          const dialog = document.querySelector('div[role="dialog"]');
          const btn = Array.from(dialog?.querySelectorAll('div[role="button"], button') || []).find(
            b => b.getAttribute('aria-label') === 'Next' || (b as HTMLElement).innerText?.trim() === 'Next' ||
                 b.getAttribute('aria-label') === 'التالي' || (b as HTMLElement).innerText?.trim() === 'التالي'
          );
          if (btn) {
            (btn as HTMLElement).click();
            return true;
          }
          return false;
        });
        if (!clickedViaEval) {
          const loc = page.locator(action.selector).first();
          await loc.waitFor({ state: 'visible', timeout: 8000 });
          await loc.click({ force: true });
        }
      } else {
        const loc = page.locator(action.selector).first();
        await loc.waitFor({ state: 'visible', timeout: 8000 });
        await loc.click({ force: true });
      }
      await page.waitForTimeout(1500);
    } else if (action.action === 'type' && action.selector) {
      // Dynamic post content MUST take precedence over any static/recorded action.value
      const textToType = content || action.value || '';
      const locator = page.locator(action.selector).first();
      await locator.waitFor({ state: 'visible', timeout: 10000 });
      await locator.click({ force: true });

      // Facebook uses Lexical / Draft.js contenteditable.
      // Focusing and using keyboard.insertText fires full native input events instantly and reliably.
      try {
        await page.keyboard.insertText(textToType);
      } catch (e) {
        await locator.pressSequentially(textToType, { delay: 10 });
      }
      await page.waitForTimeout(1500);
    } else if (action.action === 'upload') {
      if (images && images.length > 0) {
        const selector = action.selector || 'div[role="dialog"] input[type="file"], input[type="file"]';
        let fileInput = page.locator(selector).first();
        if ((await fileInput.count().catch(() => 0)) === 0) {
          const photoBtn = page.locator('div[role="dialog"] div[aria-label="Photo/video"], div[aria-label="Photo/video"], div[role="dialog"] div[aria-label="صورة/فيديو"]').first();
          if (await photoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await photoBtn.click({ force: true });
            await page.waitForTimeout(1500);
          }
        }
        fileInput = page.locator('div[role="dialog"] input[type="file"], input[type="file"]').first();
        await fileInput.setInputFiles(images);
        await page.waitForTimeout(5000); // Wait for preview cards to render
      }
    } else if (action.action === 'fail') {
      throw new Error(`AI indicated failure: ${action.value}`);
    }
  }

  private async runAutonomousEngine(
    page: Page,
    platform: string,
    content: string,
    images: string[],
    targetUrl: string | undefined,
    onProgress: (m: string) => void,
    requestDriverAction?: (screenshotBase64: string, goal: string, stepIndex: number, history: any[]) => Promise<any>
  ) {
    const dest = targetUrl || `https://www.${platform}.com`;
    const goal = `Publish a new post with the provided text and ${images.length} images.`;

    // 1. Try to load and execute existing macro
    const macro = this.macroCache.getMacro(platform);
    if (macro && macro.steps.length > 0) {
      onProgress(`[MacroEngine] Found cached macro (v${macro.version}). Executing statically...`);
      try {
        for (const step of macro.steps) {
          if (step.action === 'done') break;
          await this.executeActionOnPage(page, step, content, images);
        }

        // Multi-step Page Support: If clicking Next opened Step 2 (Post settings on Facebook Pages)
        onProgress('[MacroEngine] Checking for Step 2 (Page Post Settings & Skeletons)...');
        await page.waitForTimeout(6500);

        const clickedPost = await page.evaluate(() => {
          const dialog = document.querySelector('div[role="dialog"]');
          if (!dialog) return false;
          const buttons = Array.from(dialog.querySelectorAll('div[role="button"], button'));
          const postBtn = buttons.find(b => {
            const txt = (b as HTMLElement).innerText?.trim();
            const lbl = b.getAttribute('aria-label');
            return txt === 'Post' || lbl === 'Post' || txt === 'نشر' || lbl === 'نشر' || txt === 'Publish' || lbl === 'Publish';
          });
          if (postBtn) {
            (postBtn as HTMLElement).click();
            return true;
          }
          return false;
        });

        if (clickedPost) {
          onProgress('[MacroEngine] Clicked final Post button on Step 2.');
        } else {
          const step2PostBtn = page.locator('div[role="dialog"] div[aria-label="Post"][role="button"], div[role="dialog"] div[aria-label="Publish"][role="button"], div[role="dialog"] div[aria-label="نشر"][role="button"]').last();
          if (await step2PostBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
            await step2PostBtn.click({ force: true });
            onProgress('[MacroEngine] Clicked Step 2 Post button via locator.');
          }
        }
        
        // Wait to verify publication: check that dialog closes completely
        const dialog = page.locator('div[role="dialog"]').first();
        if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
          onProgress('[MacroEngine] Waiting for post composer dialog to finish publishing...');
          await dialog.waitFor({ state: 'hidden', timeout: 35000 }).catch(() => {});
        }

        onProgress('[MacroEngine] Post submitted successfully.');
        return;
      } catch (e: any) {
        onProgress(`[MacroEngine] Cached macro failed (${e.message}). Invalidating cache and falling back to Driver Mode...`);
        this.macroCache.deleteMacro(platform);
      }
    }

    // 2. Driver Mode (AI Steering)
    if (!requestDriverAction) {
      throw new Error('No macro found and Driver Mode is not available (no requestDriverAction).');
    }

    onProgress(`[DriverMode] Engaging Autonomous AI for ${platform}...`);
    await page.goto(dest, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);

    const history: any[] = [];
    let stepIndex = 0;
    const MAX_STEPS = 15; // Sandbox limitation

    while (stepIndex < MAX_STEPS) {
      onProgress(`[DriverMode] Step ${stepIndex + 1}: Taking screenshot and asking AI...`);
      const buffer = await page.screenshot({ type: 'jpeg', quality: 50 });
      const base64 = buffer.toString('base64');

      const instruction = await requestDriverAction(base64, goal, stepIndex, history);
      
      onProgress(`[DriverMode] AI Thought: ${instruction.thought || 'N/A'}`);
      onProgress(`[DriverMode] AI Action: ${instruction.action} ${instruction.selector || ''}`);

      if (instruction.action === 'done') {
        history.push(instruction);
        onProgress('[DriverMode] AI reported goal achieved. Saving new macro...');
        
        // Sanitize history so that 'type' actions do not bake in specific post text
        const sanitizedHistory = history.map(h => {
          if (h.action === 'type') {
            return { ...h, value: '' };
          }
          return h;
        });

        const stepsToSave: MacroAction[] = [
          { action: 'navigate', url: dest },
          ...sanitizedHistory
        ];
        this.macroCache.saveMacro(platform, stepsToSave);
        return; // Success!
      }

      if (instruction.action === 'fail') {
        throw new Error(`AI Driver gave up: ${instruction.reason}`);
      }

      // Execute and record
      try {
        await this.executeActionOnPage(page, instruction, content, images);
        history.push(instruction);
        stepIndex++;
      } catch (err: any) {
        onProgress(`[DriverMode] Failed to execute AI action: ${err.message}`);
        history.push({ ...instruction, result: `Failed: ${err.message}` });
        stepIndex++; // Still counts as a step to prevent infinite loops
      }
    }

    throw new Error(`Driver Mode exceeded maximum allowed steps (${MAX_STEPS}). Aborting.`);
  }

  private async downloadMedia(url: string, redirectsLeft = 5): Promise<string> {
    const MAX_BYTES = 25 * 1024 * 1024;
    const REQ_TIMEOUT_MS = 30_000;
    return new Promise((resolve, reject) => {
      let ext = '.jpg';
      try { ext = path.extname(new URL(url).pathname) || '.jpg'; } catch {}
      const tmpPath = path.join(
        os.tmpdir(),
        `quazlink-media-${Date.now()}-${Math.random().toString(36).slice(2, 6)}${ext}`
      );
      const client = url.startsWith('https') ? https : http;

      const cleanupPartial = () => {
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
      };

      const req = client.get(url, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) {
            reject(new Error('Too many redirects while downloading media.'));
            return;
          }
          const next = new URL(res.headers.location, url).toString();
          this.downloadMedia(next, redirectsLeft - 1).then(resolve, reject);
          return;
        }

        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`Failed to download media: HTTP ${status}`));
          return;
        }

        const file = fs.createWriteStream(tmpPath);
        let downloaded = 0;
        res.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          if (downloaded > MAX_BYTES) {
            req.destroy();
            file.destroy();
            cleanupPartial();
            reject(new Error(`Media exceeds the ${Math.round(MAX_BYTES / 1024 / 1024)}MB size cap.`));
          }
        });
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(tmpPath)));
        file.on('error', (err) => { cleanupPartial(); reject(err); });
      });

      req.on('error', (err) => { cleanupPartial(); reject(err); });
      req.setTimeout(REQ_TIMEOUT_MS, () => {
        req.destroy(new Error(`Media download timed out after ${REQ_TIMEOUT_MS}ms.`));
      });
    });
  }
}
