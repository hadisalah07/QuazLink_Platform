import { Queue } from 'bullmq';
import Redis from 'ioredis';
import 'dotenv/config';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
export const redisConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });

export const publishQueue = new Queue('post-publish-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    // Publishing is irreversible. Never auto-retry a publish job: a retry would
    // re-open the composer and risk posting twice on the client's real page.
    // The worker also has its own idempotency guard as a second line of defense.
    attempts: 1,
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export const connectQueue = new Queue('account-connect-queue', {
  connection: redisConnection,
});

export async function addJobToQueue(jobData: any) {
  return publishQueue.add('publish-post', jobData);
}

export async function addConnectJob(data: { socialAccountId: string; platform?: string }) {
  return connectQueue.add('connect-account', data);
}

// Re-detect pages on an already-connected account: opens the SAVED session
// (no manual login) and refreshes `destinations`. Same queue, different name —
// the connect worker branches on it.
export async function addRedetectJob(data: { socialAccountId: string }) {
  return connectQueue.add('redetect-pages', data);
}
