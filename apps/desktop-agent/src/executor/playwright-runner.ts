import { chromium, Browser, BrowserContext } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import https from 'https';
import { MacroCache } from './macro-cache';
import { PlatformNodeRegistry } from './nodes/node-registry';

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
  private registry: PlatformNodeRegistry;

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
    this.registry = new PlatformNodeRegistry(this.macroCache);
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

    const normPlatform = (platform || 'facebook').toLowerCase().trim();
    this.debugLog(`\n======================================================\n🚀 NEW JOB #${jobId} FOR ${normPlatform.toUpperCase()}\n======================================================`);
    onProgress(`Initializing isolated node runner for ${normPlatform.toUpperCase()}...`);

    const sessionFile = path.join(this.storageDir, `${socialAccountId}_${normPlatform}_session.json`);
    const storageState = fs.existsSync(sessionFile) ? sessionFile : undefined;

    try {
      const node = this.registry.getNode(normPlatform);

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

      // Delegate directly to the isolated platform node
      const nodeResult = await node.execute({
        jobId,
        content,
        images: downloadedFiles,
        targetUrl,
        socialAccountId,
        context,
        page,
        otaSelectors,
        onProgress,
        requestDriverAction,
      });

      await context.storageState({ path: sessionFile });
      try { fs.chmodSync(sessionFile, 0o600); } catch {}

      onProgress('Capturing publication proof screenshot...');
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 75, fullPage: false });
      const screenshotBase64 = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      onProgress(`Execution finished successfully for ${normPlatform}!`);
      return {
        success: nodeResult.success,
        screenshotBase64,
        resultMessage: nodeResult.resultMessage || `Post published successfully to ${normPlatform} via Local Isolated Node`,
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
