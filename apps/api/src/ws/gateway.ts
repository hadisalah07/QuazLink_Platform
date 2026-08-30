import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { verify } from 'jsonwebtoken';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

          if (msg.type === 'job:completed' && typeof msg.jobId === 'string') {
            console.log(`✅ Job #${msg.jobId} Completed by Desktop Runner!`);
            // Scope the update to jobs THIS device's user owns — a runner must not
            // be able to mutate another tenant's job by guessing an id.
            const scoped = await prisma.job.updateMany({
              where: { id: msg.jobId, post: { campaign: { userId: ws.userId } } },
              data: {
                status: 'completed',
                completedAt: new Date(),
                screenshotUrl: msg.screenshotUrl || null,
                result: msg.result || 'Published successfully via Local Runner',
              },
            });
            if (scoped.count === 0) {
              console.warn(`⚠️ Device ${ws.deviceId} reported completion for job ${msg.jobId} it does not own — ignored.`);
            }
          }

          if (msg.type === 'job:failed' && typeof msg.jobId === 'string') {
            console.error(`❌ Job #${msg.jobId} Failed on Runner: ${msg.error}`);
            // Check if it's a connect job (accountId instead of jobId)
            if (msg.isConnectJob) {
              await prisma.socialAccount.updateMany({
                where: { id: msg.jobId, userId: ws.userId },
                data: { status: 'failed' },
              });
            } else {
              const scoped = await prisma.job.updateMany({
                where: { id: msg.jobId, post: { campaign: { userId: ws.userId } } },
                data: {
                  status: 'failed',
                  completedAt: new Date(),
                  result: msg.error || 'Execution failed on local runner',
                },
              });
              if (scoped.count === 0) {
                console.warn(`⚠️ Device ${ws.deviceId} reported failure for job ${msg.jobId} it does not own — ignored.`);
              }
            }
          }

          if (msg.type === 'job:cancelled' && typeof msg.jobId === 'string') {
            console.error(`🚫 Job #${msg.jobId} Cancelled on Runner: ${msg.error}`);
            if (msg.isConnectJob) {
              await prisma.socialAccount.deleteMany({
                where: { id: msg.jobId, userId: ws.userId },
              });
            }
          }

          if (msg.type === 'job:connect_success' && typeof msg.jobId === 'string') {
            console.log(`✅ [WS] Runner reported connect success for account ${msg.jobId}`);
            
            // Set a default destination for personal timeline if it's facebook, etc.
            const defaultUrl = msg.platform === 'instagram' ? 'https://www.instagram.com/' : 
                               msg.platform === 'tiktok' ? 'https://www.tiktok.com/upload' : 
                               'https://www.facebook.com/';
                               
            const defaultDest = [{ name: 'Personal Profile (Timeline)', url: defaultUrl }];

            await prisma.socialAccount.updateMany({
              where: { id: msg.jobId, userId: ws.userId },
              data: { 
                status: 'active',
                destinations: defaultDest,
              },
            });
          }

          if (msg.type === 'job:request_dispatch') {
            console.log(`🚀 Runner [${ws.deviceId}] requested dispatch of pending jobs.`);
            await triggerDispatchForUser(ws.userId!, ws.deviceId!);
          }

          if (msg.type === 'job:request_healing' && typeof msg.screenshot === 'string') {
            console.log(`🤖 [WS] Received AI Healing request for job #${msg.jobId}`);
            try {
              const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
              const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

              const prompt = `You are an expert Playwright automation agent. The automation is currently stuck trying to execute: "${msg.currentStep}".
              The error is: "${msg.error}".
              Look at this screenshot of the browser. Find the element the user needs to interact with.
              Return ONLY a JSON object with this exact format (no markdown, no backticks, no other text):
              {"action": "click", "selector": "CSS selector to click"} OR {"action": "fail", "reason": "why it failed"}`;

              const imageParts = [
                {
                  inlineData: {
                    data: msg.screenshot,
                    mimeType: "image/jpeg"
                  }
                }
              ];

              const result = await model.generateContent([prompt, ...imageParts]);
              const response = await result.response;
              const text = response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
              
              let aiInstruction;
              try {
                aiInstruction = JSON.parse(text);
              } catch (e) {
                console.error('AI returned invalid JSON:', text);
                aiInstruction = { action: 'fail', reason: 'AI returned invalid JSON' };
              }

              ws.send(JSON.stringify({
                type: 'job:heal_action',
                jobId: msg.jobId,
                instruction: aiInstruction
              }));
            } catch (err: any) {
              console.error('❌ AI Healing failed:', err.message);
              ws.send(JSON.stringify({
                type: 'job:heal_action',
                jobId: msg.jobId,
                instruction: { action: 'fail', reason: err.message }
              }));
            }
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

  // Find the first available active socket
  let targetSocket: AuthenticatedSocket | null = null;
  let targetDeviceId: string | null = null;
  
  for (const [deviceId, socket] of userDevices.entries()) {
    if (socket.readyState === WebSocket.OPEN) {
      targetSocket = socket;
      targetDeviceId = deviceId;
      break;
    }
  }

  if (!targetSocket || !targetDeviceId) {
    return false;
  }

  const deviceId = targetDeviceId;
  const socket = targetSocket;

  // ATOMIC CLAIM — flip pending -> dispatched before sending. If the job is no
  // longer pending (another path already took it, or a duplicate reconnect is
  // re-dispatching), do NOT send it again — this prevents a double dispatch.
  const claim = await prisma.job.updateMany({
    where: { id: jobData.id, status: 'pending' },
    data: { status: 'dispatched' },
  });
  if (claim.count === 0) {
    console.log(`⏭️ Job ${jobData.id} not pending — skipping runner dispatch (already claimed).`);
    return false;
  }

  // Security: Generate HMAC signature with timestamp TTL (30 seconds)
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  const payloadString = JSON.stringify(jobData);
  
  // Fetch deviceToken directly from DB to sign the payload securely
  const deviceRecord = await prisma.device.findUnique({ where: { id: deviceId } });
  const secret = deviceRecord?.deviceToken;
  if (!secret) {
    console.error(`❌ Cannot sign runner dispatch: no deviceToken found for device ${deviceId}.`);
    return false;
  }
  
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

export async function dispatchConnectJobToLocalRunner(userId: string, accountId: string, platform: string): Promise<boolean> {
  const userDevices = activeDevices.get(userId);
  if (!userDevices || userDevices.size === 0) {
    return false; // No device currently online
  }

  // Find the first available active socket
  let targetSocket: AuthenticatedSocket | null = null;
  let targetDeviceId: string | null = null;
  
  for (const [deviceId, socket] of userDevices.entries()) {
    if (socket.readyState === WebSocket.OPEN) {
      targetSocket = socket;
      targetDeviceId = deviceId;
      break;
    }
  }

  if (!targetSocket || !targetDeviceId) {
    return false;
  }

  const deviceId = targetDeviceId;
  const socket = targetSocket;

  // Security: Generate HMAC signature with timestamp TTL (30 seconds)
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = { accountId, platform, type: 'connect' };
  const payloadString = JSON.stringify(payload);
  
  // Fetch deviceToken directly from DB to sign the payload securely
  const deviceRecord = await prisma.device.findUnique({ where: { id: deviceId } });
  const secret = deviceRecord?.deviceToken;
  if (!secret) {
    console.error(`❌ Cannot sign connect dispatch: no deviceToken found for device ${deviceId}.`);
    return false;
  }
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${nonce}:${timestamp}:${payloadString}`)
    .digest('hex');

  socket.send(JSON.stringify({
    type: 'job:connect',
    nonce,
    timestamp,
    signature,
    payload,
  }));

  console.log(`🚀 Dispatched connect job for account #${accountId} to Desktop Runner [${deviceId}]`);
  return true;
}

// Missed Jobs Reconciliation
async function reconcilePendingJobs(userId: string, deviceId: string) {
  try {
    const pendingCount = await prisma.job.count({
      where: {
        status: 'pending',
        post: { campaign: { userId } },
      }
    });

    if (pendingCount > 0) {
      console.log(`🔄 User ${userId} has ${pendingCount} pending job(s). Sending sync_pending...`);
      const userDevices = activeDevices.get(userId);
      if (userDevices && userDevices.has(deviceId)) {
        userDevices.get(deviceId)!.send(JSON.stringify({
          type: 'job:sync_pending',
          count: pendingCount
        }));
      }
    }
  } catch (err: any) {
    console.error('Error during missed jobs reconciliation:', err.message);
  }
}

async function triggerDispatchForUser(userId: string, deviceId: string) {
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
      take: 10,
    });

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
  } catch (err: any) {
    console.error('Error triggering dispatch:', err.message);
  }
}
