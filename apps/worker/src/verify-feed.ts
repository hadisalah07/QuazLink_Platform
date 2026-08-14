import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { decrypt } from './lib/crypto';

dotenv.config();
const prisma = new PrismaClient();

// READ-ONLY verification: open the page's feed with the saved session and read
// the most recent posts. Never writes, never clicks Post. Answers one question:
// "did the last auto-post actually go live?"
(async () => {
  const account = await prisma.socialAccount.findFirst({
    where: { platform: 'facebook', status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
  if (!account?.encryptedStorageState) throw new Error('No active facebook account with a saved session.');

  // Pull the most recent job's post text — that's the needle we search for in
  // the live feed. If it's there, the post really went live.
  const lastJob = await prisma.job.findFirst({
    where: { status: { in: ['completed', 'posted_unconfirmed'] } },
    orderBy: { completedAt: 'desc' },
    include: { post: true },
  });
  const adCopy = lastJob?.post?.content || '';
  const needle = adCopy.replace(/\s+/g, ' ').trim().slice(0, 40);
  console.log(`🔎 Looking for this post text on the page:\n   "${needle}${adCopy.length > 40 ? '…' : ''}"\n`);

  const targetUrl = process.argv[2] || 'https://www.facebook.com/al3shour';
  const storageState = JSON.parse(decrypt(account.encryptedStorageState));
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    storageState,
  });
  const page = await context.newPage();

  try {
    console.log(`🔎 Opening page feed (read-only): ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);

    // Enter the Page's own view (same as the processor) so we see its posts.
    try {
      const switchBtn = page.getByRole('button', { name: /Switch Now/i }).first();
      await switchBtn.waitFor({ state: 'visible', timeout: 4000 });
      await switchBtn.click();
      console.log('🔄 Switched into the Page view.');
      await page.waitForTimeout(5000);
    } catch {
      console.log('ℹ️ No "Switch Now" — already in a usable view.');
    }

    // Scroll past the header/Intro so the actual posts render.
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 1400);
      await page.waitForTimeout(1500);
    }

    // Dump each post body. Facebook renders post text inside a stable
    // data-ad-preview="message" node — the most reliable needle for "what did
    // this page actually publish".
    const posts = await page.evaluate(() => {
      const nodes = Array.from(
        document.querySelectorAll('[data-ad-preview="message"], [data-ad-comet-preview="message"]')
      );
      return nodes.slice(0, 8).map((n) => (n as HTMLElement).innerText.replace(/\s+/g, ' ').trim().slice(0, 160));
    });

    console.log(`\n📋 Found ${posts.length} post message block(s). Top ones:`);
    posts.forEach((p, i) => console.log(`   [${i + 1}] ${p || '(empty / image-only)'}`));

    // Is the exact post text present anywhere on the page?
    let found = false;
    if (needle) {
      const bodyText = await page.evaluate(() => document.body.innerText || '');
      found = bodyText.replace(/\s+/g, ' ').includes(needle);
    }
    console.log('\n' + (found
      ? '✅ FOUND the post text on the page — it IS published.'
      : '❌ Did NOT find the post text on the page.'));

    const shot = path.join(process.cwd(), 'verify-feed.png');
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    console.log(`\n📸 Full-page screenshot: ${shot}`);
    console.log('👀 Leaving the browser open 30s — check the top post yourself.');
    await page.waitForTimeout(30000);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
})().catch(async (e) => {
  console.error('VERIFY ERROR:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
