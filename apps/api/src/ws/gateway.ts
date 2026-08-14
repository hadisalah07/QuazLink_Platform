import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import crypto from 'crypto';
import prisma from '../prisma';

interface AuthenticatedSocket extends WebSocket {
  deviceId?: string;
  userId?: string;
  isAlive?: boolean;
  platform?: string;
}

// In-memory active device sockets map: userId -> Map<deviceId, AuthenticatedSocket>
const activeDevices = new Map<string, Map<string, AuthenticatedSocket>>();

// Dynamic OTA Selectors Bundle (Updated on cloud, pulled by runners)
const CURRENT_OTA_SELECTORS = {
  version: '2026.08.14-v1',
  timestamp: Date.now(),
  platforms: {
    facebook: {
      composerDialog: '[role="dialog"]',
      postButton: 'div[aria-label="Post"], div[aria-label="نشر"], button:has-text("Post")',
      photoUploadInput: 'input[type="file"][accept*="image"]',
      textArea: '[contenteditable="true"][role="textbox"]',
    },
    instagram: {
      newPostButton: 'svg[aria-label="New post"], svg[aria-label="منشور جديد"]',
      fileInput: 'input[type="file"]',
      captionArea: 'div[aria-label="Write a caption..."], div[aria-label="أكتب شرحاً توضيحياً..."]',
      shareButton: 'div[role="button"]:has-text("Share"), div[role="button"]:has-text("مشاركة")',
    },
    tiktok: {
      uploadButton: 'a[href*="/upload"]',
      captionInput: '.notranslate.public-DraftEditor-content',
      postButton: 'button:has-text("Post"), button:has-text("نشر")',
    },
  },
};

export function setupWebSocketGateway(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/ws/runner' });

  console.log('🛡️ WebSocket Gateway initialized on /ws/runner (Secure Zero-Trust Channel)');

  wss.on('connection', async (ws: AuthenticatedSocket, req) => {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      const pairingToken = url.searchParams.get('pairingToken');

      if (!token && !pairingToken) {
        ws.close(4001, 'Authentication token required');
        return;
      }

      let device;
      if (token) {
        device = await prisma.device.findUnique({
          where: { deviceToken: token },
          include: { user: true },
        });
      } else if (pairingToken) {
        // Pairing handshake: generate a permanent deviceToken
        device = await prisma.device.findUnique({
          where: { pairingToken },
          include: { user: true },
        });

        if (device) {
          const newDeviceToken = 'ql_dev_' + crypto.randomBytes(24).toString('hex');
          device = await prisma.device.update({
            where: { id: device.id },
            data: { deviceToken: newDeviceToken, status: 'online' },
            include: { user: true },
          });

          // Send confirmation with permanent token
          ws.send(JSON.stringify({
            type: 'pairing:success',
            deviceToken: newDeviceToken,
            deviceId: device.id,
            deviceName: device.name,
          }));
        }
      }

      if (!device) {
        ws.close(4003, 'Invalid or expired device credentials');
        return;
      }

      ws.deviceId = device.id;
      ws.userId = device.userId;
      ws.isAlive = true;
      ws.platform = device.platform;

      // Register active socket
      if (!activeDevices.has(device.userId)) {
        activeDevices.set(device.userId, new Map());
      }
      activeDevices.get(device.userId)!.set(device.id, ws);

      // Update DB presence
      await prisma.device.update({
        where: { id: device.id },
        data: { status: 'online', lastHeartbeat: new Date() },
      });

      console.log(`🟢 Desktop Runner Connected: [${device.name}] (User: ${device.user.email})`);

      // 1. Send OTA Selectors ruleset
      ws.send(JSON.stringify({
        type: 'ota:selectors',
        data: CURRENT_OTA_SELECTORS,
      }));

      // 2. Check for Missed / Pending Scheduled Jobs (Reconciliation)
      reconcilePendingJobs(device.userId, device.id);

      // Message Handling
      ws.on('message', async (raw) => {
        try {
          const msg = JSON.parse(raw.toString());

          if (msg.type === 'heartbeat:ping') {
            ws.isAlive = true;
            await prisma.device.update({
              where: { id: ws.deviceId },
              data: { status: 'online', lastHeartbeat: new Date() },
            });
            ws.send(JSON.stringify({ type: 'heartbeat:pong', time: Date.now() }));
          }

          if (msg.type === 'job:progress') {
            console.log(`⏳ Job #${msg.jobId} Progress from Runner: ${msg.message}`);
          }

          if (msg.type === 'job:completed') {
            console.log(`✅ Job #${msg.jobId} Completed by Desktop Runner!`);
            await prisma.job.update({
              where: { id: msg.jobId },
              data: {
                status: 'completed',
                completedAt: new Date(),
                screenshotUrl: msg.screenshotUrl || null,
                result: msg.result || 'Published successfully via Local Runner',
              },
            });
          }

          if (msg.type === 'job:failed') {
            console.error(`❌ Job #${msg.jobId} Failed on Runner: ${msg.error}`);
            await prisma.job.update({
              where: { id: msg.jobId },
              data: {
                status: 'failed',
                completedAt: new Date(),
                result: msg.error || 'Execution failed on local runner',
              },
            });
          }
        } catch (e: any) {
          console.error('Error handling WebSocket message:', e.message);
        }
      });

      ws.on('close', async () => {
        if (ws.userId && ws.deviceId) {
          const userMap = activeDevices.get(ws.userId);
          if (userMap) {
            userMap.delete(ws.deviceId);
            if (userMap.size === 0) activeDevices.delete(ws.userId);
          }
          await prisma.device.update({
            where: { id: ws.deviceId },
            data: { status: 'offline' },
          }).catch(() => {});
          console.log(`🔴 Desktop Runner Disconnected: ID ${ws.deviceId}`);
        }
      });
    } catch (err: any) {
      console.error('WebSocket connection error:', err.message);
      ws.close(4000, 'Server error');
    }
  });

  // Heartbeat interval to prune dead sockets every 30s
  setInterval(() => {
    wss.clients.forEach((ws: AuthenticatedSocket) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
}

// Function to dispatch a signed job payload to the user's active desktop runner
export async function dispatchJobToLocalRunner(userId: string, jobData: any): Promise<boolean> {
  const userDevices = activeDevices.get(userId);
  if (!userDevices || userDevices.size === 0) {
    return false; // No device currently online
  }

  // Pick the first available active socket
  const [deviceId, socket] = Array.from(userDevices.entries())[0];
  if (socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  // Security: Generate HMAC signature with timestamp TTL (30 seconds)
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  const payloadString = JSON.stringify(jobData);
  const secret = process.env.ENCRYPTION_KEY || 'default_runner_secret_key_32_bytes_len';
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${nonce}:${timestamp}:${payloadString}`)
    .digest('hex');

  socket.send(JSON.stringify({
    type: 'job:dispatch',
    nonce,
    timestamp,
    signature,
    payload: jobData,
  }));

  console.log(`🚀 Dispatched signed job #${jobData.id} to Desktop Runner [${deviceId}]`);
  return true;
}

// Check device status helper
export function isUserDeviceOnline(userId: string): boolean {
  const userDevices = activeDevices.get(userId);
  return !!userDevices && userDevices.size > 0;
}

// Missed Jobs Reconciliation
async function reconcilePendingJobs(userId: string, deviceId: string) {
  try {
    const pendingJobs = await prisma.job.findMany({
      where: {
        status: 'pending',
        post: { campaign: { userId } },
      },
      include: {
        post: true,
        socialAccount: true,
      },
      take: 5,
    });

    if (pendingJobs.length > 0) {
      console.log(`🔄 Reconciling ${pendingJobs.length} pending job(s) for reconnected user ${userId}...`);
      for (const job of pendingJobs) {
        await dispatchJobToLocalRunner(userId, {
          id: job.id,
          postId: job.postId,
          content: job.post.content,
          mediaUrls: job.post.mediaUrls,
          targetUrl: job.targetUrl,
          platform: job.socialAccount.platform,
          socialAccountId: job.socialAccountId,
        });
      }
    }
  } catch (err: any) {
    console.error('Error during missed jobs reconciliation:', err.message);
  }
}
