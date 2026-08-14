import { Queue } from 'bullmq';
import Redis from 'ioredis';
import 'dotenv/config';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let redisConnection: Redis | null = null;
let publishQueue: Queue | null = null;
let connectQueue: Queue | null = null;

export function getRedis(): Redis | null {
  if (!redisConnection) {
    try {
      redisConnection = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
        retryStrategy(times) {
          return Math.min(times * 500, 3000);
        },
      });
      redisConnection.on('error', (err) => {
        console.warn('Redis connection notice (non-fatal):', err.message);
      });
      redisConnection.connect().catch((err) => {
        console.warn('Redis connect initial notice:', err.message);
      });
    } catch (e: any) {
      console.warn('Redis init error (non-fatal):', e.message);
    }
  }
  return redisConnection;
}

export function getPublishQueue(): Queue | null {
  if (!publishQueue) {
    const conn = getRedis();
    if (conn) {
      try {
        publishQueue = new Queue('post-publish-queue', {
          connection: conn,
          skipVersionCheck: true,
          defaultJobOptions: {
            attempts: 1,
            removeOnComplete: 100,
            removeOnFail: 200,
          },
        });
      } catch (err: any) {
        console.warn('Publish queue init notice:', err.message);
      }
    }
  }
  return publishQueue;
}

export function getConnectQueue(): Queue | null {
  if (!connectQueue) {
    const conn = getRedis();
    if (conn) {
      try {
        connectQueue = new Queue('account-connect-queue', {
          connection: conn,
          skipVersionCheck: true,
        });
      } catch (err: any) {
        console.warn('Connect queue init notice:', err.message);
      }
    }
  }
  return connectQueue;
}

export async function addJobToQueue(jobData: any) {
  const q = getPublishQueue();
  if (!q) throw new Error('Publish queue currently initializing');
  return q.add('publish-post', jobData);
}

export async function addConnectJob(data: { socialAccountId: string; platform?: string }) {
  const q = getConnectQueue();
  if (!q) throw new Error('Connect queue currently initializing');
  return q.add('connect-account', data);
}

export async function addRedetectJob(data: { socialAccountId: string }) {
  const q = getConnectQueue();
  if (!q) throw new Error('Connect queue currently initializing');
  return q.add('redetect-pages', data);
}
