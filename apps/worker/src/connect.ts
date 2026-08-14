import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { chromium } from 'playwright';
import { PrismaClient, Prisma } from '@prisma/client';
import * as dotenv from 'dotenv';
import { encrypt, decrypt } from './lib/crypto';
import { detectDestinations } from './lib/detect-pages';

dotenv.config();

const prisma = new PrismaClient();

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });

// Facebook sets the `c_user` cookie only after a successful login, so polling
// for it is the most reliable "you're logged in now" signal.
const LOGIN_COOKIE = 'c_user';
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 1000;

console.log('🔗 Connect worker starting. Listening to account-connect-queue...');

// Re-detect pages on an already-connected account using the SAVED session.
// No manual login: we open the stored storageState, refresh `destinations`,
// and leave the session untouched. Best-effort — detection never throws.
async function handleRedetect(socialAccountId: string) {
  console.log(`\n=============================================`);
  console.log(`🔄 Re-detecting pages for SocialAccount: ${socialAccountId}`);
  console.log(`=============================================`);

  const account = await prisma.socialAccount.findUnique({ where: { id: socialAccountId } });
  if (!account?.encryptedStorageState) {
    throw new Error(`SocialAccount ${socialAccountId} has no saved session to re-detect with.`);
  }

  const storageState = JSON.parse(decrypt(account.encryptedStorageState));
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    storageState,
  });
  const page = await context.newPage();

  try {
    const destinations = await detectDestinations(page);
    console.log(`✅ Detected ${destinations.length} destination(s).`);
    await prisma.socialAccount.update({
      where: { id: socialAccountId },
      data: { destinations: destinations as unknown as Prisma.InputJsonValue },
    });
    console.log(`🎉 Destinations refreshed for account ${socialAccountId}.`);
  } finally {
    await browser.close();
  }
}

const worker = new Worker(
  'account-connect-queue',
  async (job: Job) => {
    const { socialAccountId } = job.data;

    if (job.name === 'redetect-pages') {
      await handleRedetect(socialAccountId);
      return;
    }

    const account = await prisma.socialAccount.findUnique({ where: { id: socialAccountId } });
    const platform = (job.data.platform || account?.platform || 'facebook').toLowerCase();

    console.log(`\n=============================================`);
    console.log(`🔐 Connecting SocialAccount [${platform.toUpperCase()}]: ${socialAccountId}`);
    console.log(`=============================================`);

    await prisma.socialAccount.update({
      where: { id: socialAccountId },
      data: { status: 'connecting', platform },
    });

    const targetUrl =
      platform === 'instagram'
        ? 'https://www.instagram.com'
        : platform === 'tiktok'
        ? 'https://www.tiktok.com'
        : 'https://www.facebook.com';

    const loginCookies =
      platform === 'instagram'
        ? ['sessionid', 'ds_user_id']
        : platform === 'tiktok'
        ? ['sessionid', 'sid_tt', 'uid_tt', 'passport_csrf_token']
        : ['c_user'];

    console.log(`🌐 Opening browser for ${platform} login: ${targetUrl}...`);
    const browser = await chromium.launch({ headless: false });

    // Blank context on purpose: this is a fresh login, no prior session.
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await context.newPage();

    try {
      await page.goto(targetUrl);

      console.log(`🕒 Waiting for ${platform} login (up to 5 min)...`);
      const deadline = Date.now() + LOGIN_TIMEOUT_MS;
      let loggedIn = false;
      while (Date.now() < deadline) {
        const cookies = await context.cookies();
        if (cookies.some((c) => loginCookies.includes(c.name))) {
          loggedIn = true;
          break;
        }
        await page.waitForTimeout(POLL_INTERVAL_MS);
      }

      if (!loggedIn) {
        throw new Error(`Login timed out — ${platform} login cookies never appeared.`);
      }

      console.log(`✅ ${platform} login detected! Saving session...`);
      const storageState = await context.storageState();

      let destinations = [{ name: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Profile`, url: targetUrl }];
      if (platform === 'facebook') {
        console.log('🔍 Detecting associated Facebook Pages...');
        destinations = await detectDestinations(page);
      }
      console.log(`✅ Detected ${destinations.length} destination(s).`);

      await prisma.socialAccount.update({
        where: { id: socialAccountId },
        data: {
          status: 'active',
          platform,
          encryptedStorageState: encrypt(JSON.stringify(storageState)),
          destinations: destinations as unknown as Prisma.InputJsonValue,
          lastUsedAt: new Date(),
        },
      });

      console.log(`🎉 Account ${socialAccountId} (${platform}) connected and session saved.`);
    } catch (err: any) {
      console.error('❌ Connect failed:', err.message);
      await prisma.socialAccount.update({
        where: { id: socialAccountId },
        data: { status: 'error' },
      });
      throw err;
    } finally {
      await browser.close();
    }
  },
  { connection: redisConnection }
);

worker.on('completed', (job) => {
  console.log(`✅ Connect job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.log(`❌ Connect job ${job?.id} has failed with ${err.message}`);
});
