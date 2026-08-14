import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

// Load apps/api/.env regardless of the current working directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

// The text that will be pasted into the Facebook composer.
// Change this to whatever you want to test with.
const POST_TEXT =
  'مرحباً من QuazLink! ده بوست تجريبي اتجهّز أوتوماتيك بالـ AI Browser Agent. 🚀';

// Dev credentials for the seeded account (log in with these locally).
const SEED_EMAIL = 'test@quazlink.local';
const SEED_PASSWORD = 'quazlink123';

async function main() {
  // 1. Load the POC session (Playwright storageState JSON) as-is.
  //    Stored plaintext for this local test — encrypt (AES-256) before any deploy.
  const sessionPath = path.join(__dirname, '..', '..', '..', 'poc', 'session.json');
  if (!fs.existsSync(sessionPath)) {
    throw new Error(`session.json not found at ${sessionPath} — run the POC first to generate it.`);
  }
  const storageState = fs.readFileSync(sessionPath, 'utf-8');
  // Validate it parses so the worker won't choke later
  JSON.parse(storageState);

  // 2. User (idempotent by unique email) — now with a real password hash so
  //    you can actually log in as the seeded account in dev.
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: SEED_EMAIL },
    update: { passwordHash },
    create: { email: SEED_EMAIL, name: 'Test User', passwordHash },
  });

  // 3. Social account carrying the Facebook session
  const account = await prisma.socialAccount.create({
    data: {
      userId: user.id,
      platform: 'facebook',
      status: 'active',
      encryptedStorageState: storageState,
      lastUsedAt: new Date(),
    },
  });

  // 4. Campaign + Post holding the content to publish
  const campaign = await prisma.campaign.create({
    data: { userId: user.id, name: 'First E2E Test', status: 'active' },
  });

  const post = await prisma.post.create({
    data: {
      campaignId: campaign.id,
      content: POST_TEXT,
      mediaUrls: [], // text-only for the first run
      status: 'scheduled',
    },
  });

  console.log('\n✅ Seed complete.\n');
  console.log(`  Login:  ${SEED_EMAIL} / ${SEED_PASSWORD}\n`);
  console.log('  Use these IDs to trigger a job:');
  console.log(`  postId          = ${post.id}`);
  console.log(`  socialAccountId = ${account.id}\n`);
  console.log('curl example:');
  console.log(
    `  curl -X POST http://localhost:3001/api/jobs -H "Content-Type: application/json" -d '{"postId":"${post.id}","socialAccountId":"${account.id}"}'\n`
  );
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
