import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { chromium, Page } from 'playwright';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as http from 'http';
import { decrypt } from './lib/crypto';
import dns from 'dns/promises';

dotenv.config();

const prisma = new PrismaClient();

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

// Where we save proof screenshots
const screenshotsDir = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

console.log('🚀 Worker starting. Listening to post-publish-queue...');

async function downloadToTemp(url: string): Promise<string> {
  // Basic SSRF Guard before downloading
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '0.0.0.0' || parsed.hostname.endsWith('.internal')) {
      throw new Error('Local/Internal IPs are blocked (SSRF Guard)');
    }
    const resolved = await dns.lookup(parsed.hostname);
    if (resolved.address.startsWith('127.') || resolved.address.startsWith('10.') || resolved.address.startsWith('192.168.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(resolved.address)) {
      throw new Error('Resolved to a private IP space (SSRF Guard)');
    }
  } catch (e: any) {
    throw new Error(`SSRF Validation failed for image URL: ${e.message}`);
  }

  return new Promise((resolve, reject) => {
    const ext = path.extname(new URL(url).pathname) || '.jpg';
    const tmpPath = path.join(os.tmpdir(), `fb-post-${Date.now()}${ext}`);
    const file = fs.createWriteStream(tmpPath);
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(tmpPath);
      });
    }).on('error', (err) => {
      fs.unlink(tmpPath, () => {});
      reject(err);
    });
  });
}

async function resolveMedia(urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const u of urls) {
    if (/^https?:\/\//i.test(u)) {
      try {
        console.log(`⬇️ Downloading remote image: ${u}`);
        const localPath = await downloadToTemp(u);
        out.push(localPath);
      } catch (e: any) {
        console.error(`⚠️ Failed to download ${u}: ${e.message}`);
      }
    } else if (fs.existsSync(u)) {
      out.push(u);
    }
  }
  return out;
}

// Anti-bot paste: inject into clipboard and Ctrl/Cmd+V instead of typing char-by-char
async function writePostAntiBot(page: Page, text: string) {
  await page.waitForTimeout(2000);
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${modifier}+v`);
  await page.waitForTimeout(1000);
}

// After clicking Post, Facebook sometimes interjects a promo dialog
// ("Speak With People Directly" / add a Call Now button, Boost this post, etc.).
// These are NOT the publish step — the post is already going out. Dismissing them
// ("Not now" / "Skip") lets the flow finish. We only ever click clearly-safe
// "skip the optional extra" buttons — never Cancel/Discard, which could kill it.
async function dismissPostInterstitials(page: Page) {
  const dismissNames = /^(Not now|Not Now|Skip|Maybe later|ليس الآن|لاحقًا|لاحقاً|تخطي|تخطى)$/i;
  for (let i = 0; i < 4; i++) {
    const btn = page.getByRole('button', { name: dismissNames }).first();
    const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) break;
    const label = ((await btn.textContent().catch(() => '')) || '').trim();
    console.log(`👋 [AUTO-POST] Dismissing a promo dialog via "${label}"...`);
    await btn.click().catch(() => {});
    await page.waitForTimeout(2500);
  }
}

// Ground truth for "did it actually publish": reload the page feed and look for
// the exact post text. "The composer closed" is NOT proof — a promo dialog can
// replace the composer and fool that heuristic (which is exactly what bit us).
// The post text appearing in the live feed is the only trustworthy signal.
async function verifyPostOnFeed(page: Page, feedUrl: string, adCopy: string): Promise<boolean> {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const copy = norm(adCopy);
  if (!copy) return false;
  // Several candidate needles so a leading emoji/hashtag can't cause a false miss.
  const needles = [copy.slice(0, 30), copy.slice(10, 45), copy.slice(0, 15)].filter((n) => n.length >= 10);
  if (needles.length === 0) needles.push(copy);

  try {
    console.log('🔎 [VERIFY] Reloading the page feed to confirm the post is live...');
    await page.goto(feedUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    // Enter the Page's own view if Facebook is showing the visitor view.
    const switchBtn = page.getByRole('button', { name: /Switch Now/i }).first();
    if (await switchBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await switchBtn.click().catch(() => {});
      await page.waitForTimeout(4000);
    }

    // Scroll down a few times so the real posts render, checking after each pass.
    for (let i = 0; i < 6; i++) {
      const body = norm(await page.evaluate(() => document.body.innerText || '').catch(() => ''));
      if (needles.some((n) => body.includes(n))) return true;
      await page.mouse.wheel(0, 1400);
      await page.waitForTimeout(1500);
    }
  } catch (e: any) {
    console.log(`⚠️ [VERIFY] Feed check errored (${e.message}) — treating as unconfirmed.`);
  }
  return false;
}

// Upload local media files to the Facebook composer
async function uploadImagesToPost(page: Page, imagePaths: string[]) {
  console.log(`🖼️ Uploading ${imagePaths.length} image(s)...`);
  const modal = page.getByRole('dialog').first();

  try {
    console.log('ℹ️ Opening dropzone by clicking the green Photo icon...');
    const photoIcon = modal.locator('div[aria-label*="Photo"], div[aria-label*="صورة"]').first();
    if (await photoIcon.isVisible({ timeout: 3000 })) {
      await photoIcon.click({ force: true });
      await page.waitForTimeout(1500); // Wait for the dropzone to expand
    }

    console.log('ℹ️ Attempting to open FileChooser from the dropzone...');
    const addPhotosBtn = modal.locator('div[role="button"]').filter({ hasText: /Add photos|إضافة صور/i }).first();
    
    // Wait for the button to appear inside the dropzone
    const hasAddBtn = await addPhotosBtn.isVisible({ timeout: 4000 }).catch(() => false);
    const targetBtn = hasAddBtn ? addPhotosBtn : modal.locator('input[type="file"]').first().locator('..');

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 8000 }),
      targetBtn.click({ force: true })
    ]);
    
    await fileChooser.setFiles(imagePaths);
    console.log('✅ Images uploaded via FileChooser!');
    await page.waitForTimeout(5000); // Wait for preview
    return;
  } catch (e) {
    console.log('⚠️ FileChooser method failed, falling back to hidden inputs blast...');
  }

  // FALLBACK METHOD: Blast the files into ALL file inputs on the page
  const fileInputs = await page.locator('input[type="file"]').all();
  let successCount = 0;
  for (const input of fileInputs) {
    try {
      await input.setInputFiles(imagePaths, { timeout: 1000 });
      successCount++;
    } catch (e) {}
  }

  if (successCount === 0) {
    throw new Error('All image upload methods (FileChooser and Input Blast) failed.');
  }

  console.log(`✅ Images injected into ${successCount} file input(s)!`);
  await page.waitForTimeout(5000);
}

const worker = new Worker(
  'post-publish-queue',
  async (job: Job) => {
    const { jobId, postId, socialAccountId, targetUrl } = job.data;
    console.log(`\n=============================================`);
    console.log(`💼 Processing Job ID: ${jobId} | Post ID: ${postId}`);
    console.log(`=============================================`);

    // IDEMPOTENCY GUARD — publishing is irreversible. If this job already
    // reached a published/terminal state, NEVER run it again: a re-run (BullMQ
    // retry, stall recovery, or a stray duplicate) would re-click Post and
    // duplicate the post on the client's real page.
    const existing = await prisma.job.findUnique({ where: { id: jobId } });
    if (existing && ['completed', 'posted_unconfirmed', 'failed'].includes(existing.status)) {
      console.log(`⏭️ Job ${jobId} is already "${existing.status}" — skipping to avoid double-posting.`);
      return;
    }

    // Mark job active in the DB
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'active', startedAt: new Date() },
    });

    // Fetch the real content + session from the DB
    const post = await prisma.post.findUnique({ where: { id: postId } });
    const account = await prisma.socialAccount.findUnique({ where: { id: socialAccountId } });

    if (!post) throw new Error(`Post ${postId} not found`);
    if (!account) throw new Error(`SocialAccount ${socialAccountId} not found`);
    if (!account.encryptedStorageState) {
      throw new Error(`SocialAccount ${socialAccountId} has no saved session (storageState)`);
    }

    const adCopy = post.content || '';
    const mediaFiles = await resolveMedia(post.mediaUrls || []);

    console.log('🌐 Starting Browser Automation...');
    const browser = await chromium.launch({ headless: false });

    // Session comes from the DB. Decrypt the storageState.
    const decryptedState = decrypt(account.encryptedStorageState);
    const storageState = JSON.parse(decryptedState);

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      permissions: ['clipboard-read', 'clipboard-write'],
      storageState,
    });
    const page = await context.newPage();

    try {
      const destination = targetUrl || 'https://www.facebook.com';
      console.log(`Navigating to destination: ${destination}`);
      await page.goto(destination);
      await page.waitForTimeout(4000);

      // ---------------------------------------------------------
      // HANDLE PROFILE SWITCHING (if navigating to a Page)
      // ---------------------------------------------------------
      try {
        console.log('🔄 Checking if we need to switch into the Page profile...');
        const switchBtn = page.getByRole('button', { name: /Switch Now/i }).first();
        await switchBtn.waitFor({ state: 'visible', timeout: 3000 });
        await switchBtn.click();
        console.log('✅ Clicked "Switch Now" to enter the Page profile.');
        await page.waitForTimeout(5000); // Wait for the switch to complete
      } catch (e) {
        console.log('ℹ️ No profile switch needed (or button not found). Continuing...');
      }

      // ---------------------------------------------------------
      // POST CREATION (Hybrid Agent)
      // ---------------------------------------------------------
      let actionSucceeded = false;
      console.log('\n⚡ [PHASE 1] Attempting Fast Path (DOM Template)...');
      try {
        const searchKeyword = "What's on your mind|Write something|Create post|بم تفكر|اكتب|إنشاء منشور";
        const postInput = page.getByText(new RegExp(searchKeyword, 'i')).first();
        await postInput.waitFor({ state: 'visible', timeout: 4000 });
        await postInput.click();

        console.log('✅ Fast Path Success! Modal opening...');
        await page.waitForTimeout(3000); // Wait for modal to fully open

        // Wait for the modal's text area to appear and click it to activate React state
        const modal = page.getByRole('dialog').first();
        const textBox = modal.locator('[contenteditable="true"]').first();
        await textBox.waitFor({ state: 'visible', timeout: 5000 });
        await textBox.click();
        await page.waitForTimeout(1000);

        // Upload images first (as requested)
        if (mediaFiles.length > 0) {
          await uploadImagesToPost(page, mediaFiles);
        }

        // Re-focus the text area and write text
        console.log('🔄 Focusing the text area...');
        await textBox.click();
        await writePostAntiBot(page, adCopy);

        // NOTE: no Escape here. Pasting text (Ctrl+V) never opens Facebook's
        // hashtag dropdown — that only appears while typing char-by-char. So
        // Escape has nothing to dismiss and instead closes the whole composer,
        // dropping the post into an inline "What's on your mind" draft (exactly
        // the bug we saw). Just let the composer settle.
        await page.waitForTimeout(1000);

        actionSucceeded = true;
      } catch (e) {
        console.log('⚠️ Fast Path Failed.');
      }

      if (!actionSucceeded) {
        console.log('\n🚨 [PHASE 2] Initiating Spatial Vision AI Fallback...');
        const screenshotBuffer = await page.screenshot();

        const prompt = `Look at this screenshot of a Facebook page.
Find the button to create a new post (usually says "What's on your mind?").
Return ONLY a JSON object:
{
  "explanation": "brief explanation",
  "action": "click",
  "bounding_box_1000": [ymin, xmin, ymax, xmax]
}
If not found, return an empty array [].`;

        const imagePart = {
          inlineData: { data: screenshotBuffer.toString('base64'), mimeType: 'image/png' },
        };

        const result = await model.generateContent([prompt, imagePart]);
        let jsonStr = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        
        let jsonResponse: any = {};
        try {
          jsonResponse = JSON.parse(jsonStr);
        } catch (err) {
          console.log('⚠️ AI returned invalid JSON. Skipping spatial click.');
        }

        if (jsonResponse.bounding_box_1000 && jsonResponse.bounding_box_1000.length === 4) {
          const [ymin, xmin, ymax, xmax] = jsonResponse.bounding_box_1000;
          const viewport = page.viewportSize();
          if (viewport) {
            const x = ((xmin + xmax) / 2 / 1000) * viewport.width;
            const y = ((ymin + ymax) / 2 / 1000) * viewport.height;
            await page.mouse.click(x, y);
            console.log('✅ Clicked successfully using AI Spatial Coordinates!');
            await page.waitForTimeout(3000); // Wait for modal to open

            const modal = page.getByRole('dialog').first();
            const textBox = modal.locator('[contenteditable="true"]').first();
            await textBox.waitFor({ state: 'visible', timeout: 5000 });
            await textBox.click();
            await page.waitForTimeout(1000);

            if (mediaFiles.length > 0) {
              await uploadImagesToPost(page, mediaFiles);
            }
            
            // Re-focus and write text
            await textBox.click();
            await writePostAntiBot(page, adCopy);

            // No Escape — see the note in the Fast Path above. Pasting doesn't
            // open the hashtag dropdown, so Escape would just close the modal.
            await page.waitForTimeout(1000);

            actionSucceeded = true;
          }
        }
      }

      if (!actionSucceeded) {
        throw new Error('Both Fast Path and Vision AI Fallback failed to find the target element.');
      }

      // ---------------------------------------------------------
      // AI VISUAL VALIDATION (Proof Check) — non-fatal
      // ---------------------------------------------------------
      console.log('\n🤖 [PHASE 3] AI Visual Validation: Checking if post is correctly filled...');
      let validationWarning = '';
      try {
        const validationShot = await page.screenshot();
        const validationPrompt = `Look at this screenshot of a Facebook "Create post" modal.
Is there any text written inside the post composer? Are there any images attached to the post?
Return ONLY a JSON object exactly like this:
{
  "text_present": true or false,
  "images_present": true or false,
  "explanation": "brief reason"
}`;
        const vResult = await model.generateContent([
          validationPrompt,
          { inlineData: { data: validationShot.toString('base64'), mimeType: 'image/png' } }
        ]);
        const vJsonStr = vResult.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const validation = JSON.parse(vJsonStr);

        console.log(`🤖 AI Validation Result: Text: ${validation.text_present} | Images: ${validation.images_present}`);

        if (!validation.text_present || (mediaFiles.length > 0 && !validation.images_present)) {
          validationWarning = `AI validation warning: ${validation.explanation}`;
          console.log(`⚠️ ${validationWarning} (non-fatal — leaving it for human review)`);
        } else {
          console.log('✅ AI Validation Passed! The post is correctly prepared.');
        }
      } catch (e: any) {
        validationWarning = `AI validation skipped (invalid JSON or vision error): ${e.message}`;
        console.log(`⚠️ ${validationWarning}`);
      }

      // ---------------------------------------------------------
      // PROOF: screenshot of the prepared composer
      // ---------------------------------------------------------
      const shotPath = path.join(screenshotsDir, `job-${jobId}.png`);
      await page.screenshot({ path: shotPath });
      console.log(`📸 Proof screenshot saved: ${shotPath}`);

      // ---------------------------------------------------------
      // AUTO-POST (opt-in via AUTO_POST=true) — Next → Post, DOM-only.
      // Publishing is IRREVERSIBLE, so we only click buttons we can find
      // deterministically inside the composer dialog. No Vision guessing here:
      // if the Post button isn't found, we fall back to manual review instead
      // of clicking blindly.
      // ---------------------------------------------------------
      const autoPost = process.env.AUTO_POST === 'true';
      if (autoPost) {
        console.log('\n🚀 [AUTO-POST] Enabled — attempting to publish automatically...');
        let modal = page.getByRole('dialog').first();

        // Safety net: with the Escape bug fixed the composer should still be
        // open. But if anything closed it, the post is sitting as an inline
        // draft in the page composer. Clicking that draft re-opens the full
        // composer with text + images restored (exactly what a human does),
        // so we can still reach the Post button.
        let modalOpen = await modal.isVisible({ timeout: 3000 }).catch(() => false);
        if (!modalOpen) {
          console.log('⚠️ [AUTO-POST] Composer not open — trying to re-open the draft...');
          const snippet = adCopy.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).slice(0, 3).join(' ');
          const reopened = await page.getByText(snippet, { exact: false }).first()
            .click({ timeout: 4000 }).then(() => true).catch(() => false);
          if (reopened) {
            await page.waitForTimeout(3000);
            modal = page.getByRole('dialog').first();
            modalOpen = await modal.isVisible({ timeout: 4000 }).catch(() => false);
          }
          console.log(modalOpen ? '✅ [AUTO-POST] Re-opened the composer from the draft.'
                                : '⚠️ [AUTO-POST] Could not re-open the composer.');
        }

        // Some composers have intermediate "Next" steps (e.g. after adding photos).
        // Click "Next" up to 3 times until only the final Post button remains.
        for (let i = 0; i < 3; i++) {
          const nextBtn = modal.getByRole('button', { name: /^(Next|التالي)$/i }).first();
          const hasNext = await nextBtn.isVisible({ timeout: 2000 }).catch(() => false);
          if (!hasNext) break;
          console.log(`➡️ [AUTO-POST] Clicking "Next" (step ${i + 1})...`);
          await nextBtn.click();
          await page.waitForTimeout(2500);
        }

        // Final publish button — scoped INSIDE the dialog to avoid the wrong one.
        const postBtn = modal.getByRole('button', { name: /^(Post|Publish|Share Now|Share|نشر|مشاركة)$/i }).first();
        const canPost = await postBtn.isVisible({ timeout: 5000 }).catch(() => false);

        if (!canPost) {
          // Dump the buttons we DID see so we can tune the selector if Facebook
          // renamed the publish button (e.g. locale or A/B variant).
          const seen = await modal.getByRole('button').evaluateAll(
            (els) => els.map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim())
                        .filter(Boolean).slice(0, 40)
          ).catch(() => [] as string[]);
          console.log('⚠️ [AUTO-POST] Post button not found — falling back to manual review.');
          console.log('🔎 [AUTO-POST] Buttons seen in composer:', JSON.stringify(seen));
          validationWarning = (validationWarning ? validationWarning + ' | ' : '') +
            'Auto-post skipped: Post button not found — please post manually.';
        } else {
          await postBtn.click();
          console.log('🖱️ [AUTO-POST] Clicked "Post". Facebook is publishing (this can take a while with images)...');

          // Give Facebook a moment to start publishing, then clear any promo
          // dialog it throws up ("Call Now" button, Boost, etc.). These are NOT
          // the publish step — they appear AFTER the post is already on its way,
          // and previously fooled us into reporting a false success.
          await page.waitForTimeout(6000);
          await dismissPostInterstitials(page);

          // Truth check: don't trust "the composer closed". Go to the feed and
          // look for the actual post text. Retry the reload a couple of times to
          // give a slow publish (3 images) time to appear.
          let posted = false;
          for (let attempt = 0; attempt < 3 && !posted; attempt++) {
            if (attempt > 0) {
              console.log(`⏳ [VERIFY] Not visible yet — waiting before re-checking (attempt ${attempt + 1}/3)...`);
              await page.waitForTimeout(8000);
            }
            posted = await verifyPostOnFeed(page, destination, adCopy);
          }

          const doneShot = path.join(screenshotsDir, `job-${jobId}-posted.png`);
          await page.screenshot({ path: doneShot }).catch(() => {});

          if (posted) {
            console.log('✅ [AUTO-POST] Verified LIVE — found the post text in the page feed.');
            await prisma.job.update({
              where: { id: jobId },
              data: {
                status: 'completed',
                result: 'Auto-posted and verified live in the feed.' + (validationWarning ? ` (${validationWarning})` : ''),
                screenshotUrl: doneShot,
                completedAt: new Date(),
              },
            });
          } else {
            // We DID click Post, but the text never showed up in the feed. It may
            // still have gone through (slow render, different layout) — so we must
            // NEVER re-run this job (that risks a duplicate on a real client page).
            // Flag it for a human to eyeball instead of falsely claiming success.
            console.log('⚠️ [AUTO-POST] Clicked Post but could NOT find it in the feed. NOT retrying — flagged for manual verification.');
            await prisma.job.update({
              where: { id: jobId },
              data: {
                status: 'posted_unconfirmed',
                result: 'Clicked Post but could not confirm it in the page feed. Check the page manually — it may already be live. Do NOT re-run this job.'
                  + (validationWarning ? ` (${validationWarning})` : ''),
                screenshotUrl: doneShot,
                completedAt: new Date(),
              },
            });
          }
          return; // Post was clicked — never continue to the manual-review fallback.
        }
      }

      // ---------------------------------------------------------
      // STOP BEFORE POST — human reviews and clicks Post manually
      // (reached when AUTO_POST is off, or auto-post could not confirm)
      // ---------------------------------------------------------
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'prepared',
          result: validationWarning
            ? `Composer filled — awaiting manual Post click. ${validationWarning}`
            : 'Composer filled — awaiting manual Post click',
          screenshotUrl: shotPath,
        },
      });

      console.log('\n🎉 Post is PREPARED with text' + (mediaFiles.length ? ' + images' : '') + '.');
      console.log('👀 Review it in the browser, then click "Post" YOURSELF.');
      console.log('🪟 Close the browser window when done — the worker is waiting...');

      // Wait until you close the window manually (up to 10 min), instead of closing instantly
      await page.waitForEvent('close', { timeout: 10 * 60 * 1000 }).catch(() => {
        console.log('⌛ Review window timed out (10 min) — cleaning up.');
      });
    } catch (err: any) {
      console.error('❌ Job Failed:', err.message);

      // Save an error screenshot for debugging, if the page is still alive
      try {
        const errShot = path.join(screenshotsDir, `job-${jobId}-error.png`);
        await page.screenshot({ path: errShot });
        await prisma.job.update({
          where: { id: jobId },
          data: { status: 'failed', result: err.message, screenshotUrl: errShot, completedAt: new Date() },
        });
      } catch {
        await prisma.job.update({
          where: { id: jobId },
          data: { status: 'failed', result: err.message, completedAt: new Date() },
        });
      }

      throw err; // let BullMQ record the failure
    } finally {
      await browser.close();
    }
  },
  {
    connection: redisConnection,
    // This job keeps a real browser open for a long time: auto-post (Next→Post
    // can take ~30s) or up to a 10-min human-review wait. BullMQ's default 30s
    // lock would flag such a healthy job as "stalled" and fail it — exactly what
    // killed job 25. Raise the lock past the longest wait so it isn't killed.
    lockDuration: 11 * 60 * 1000, // 11 min > the 10-min manual review window
  }
);

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.log(`❌ Job ${job?.id} has failed with ${err.message}`);
});
