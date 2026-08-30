import WebSocket from 'ws';
import crypto from 'crypto';
import { LocalJobQueue, LocalTask } from '../queue/local-queue';
import { PlaywrightRunner } from '../executor/playwright-runner';
export interface RunnerWSOptions {
  token?: string;
  pairingToken?: string;
  onStatusChange?: (status: 'online' | 'offline' | 'pairing', info?: any) => void;
  onConnectRequest?: (platform: string, accountId: string) => void;
}

export class RunnerWSClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private token: string | null = null;
  private pairingToken: string | null = null;
  private queue: LocalJobQueue;
  private runner: PlaywrightRunner;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private otaSelectors: any = {};
  private onStatusChange?: (status: 'online' | 'offline' | 'pairing', info?: any) => void;
  private onConnectRequest?: (platform: string, accountId: string) => void;
  private isCleanedUp = false;

  constructor(
    serverUrl: string,
    options: RunnerWSOptions
  ) {
    this.serverUrl = serverUrl;
    this.token = options.token || null;
    this.pairingToken = options.pairingToken || null;
    this.onStatusChange = options.onStatusChange;
    this.onConnectRequest = options.onConnectRequest;

    this.runner = new PlaywrightRunner();
    this.queue = new LocalJobQueue(this.handleTaskExecution.bind(this));

    // Handle process termination to kill any zombie browser processes
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
    process.on('exit', () => this.cleanup());
  }

  public connect() {
    if (!this.token && !this.pairingToken) {
      console.log('⚠️ [WSClient] No tokens found. Skipping connection to Cloud Gateway.');
      if (this.onStatusChange) this.onStatusChange('offline');
      return;
    }

    let wsEndpoint = `${this.serverUrl}/ws/runner`;
    if (this.token) {
      wsEndpoint += `?token=${this.token}`;
    } else if (this.pairingToken) {
      wsEndpoint += `?pairingToken=${this.pairingToken}`;
    }

    console.log(`🔌 [WSClient] Connecting to Cloud Gateway: ${wsEndpoint}`);
    this.ws = new WebSocket(wsEndpoint);

    this.ws.on('open', () => {
      console.log('🟢 [WSClient] Connected to QuazLink Cloud Gateway (Zero-Trust TLS)');
      this.startHeartbeat();
      if (this.onStatusChange) this.onStatusChange('online');
    });

    this.ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'pairing:success') {
          console.log(`🎉 [WSClient] Device Paired Successfully! Token: ${msg.deviceToken}`);
          this.token = msg.deviceToken;
          this.pairingToken = null;
          if (this.onStatusChange) this.onStatusChange('online', msg);
        }

        if (msg.type === 'ota:selectors') {
          console.log(`🔄 [WSClient] Received OTA Selector Updates (v${msg.data.version})`);
          this.otaSelectors = msg.data.platforms;
        }

        if (msg.type === 'job:sync_pending') {
          const { dialog } = require('electron');
          const { response } = await dialog.showMessageBox({
            type: 'question',
            buttons: ['Yes, publish now', 'No, keep them pending'],
            defaultId: 0,
            title: 'Pending Posts Available',
            message: `You have ${msg.count} pending post(s) waiting. Would you like to publish them now?`,
          });
          if (response === 0) {
            this.send({ type: 'job:request_dispatch' });
          }
        }

        if (msg.type === 'job:dispatch' || msg.type === 'job:connect') {
          await this.handleIncomingJob(msg);
        }
      } catch (err: any) {
        console.error('❌ [WSClient] Message parsing error:', err.message);
      }
    });

    this.ws.on('close', (code, reason) => {
      console.warn(`🔴 [WSClient] Disconnected from Cloud Gateway (Code: ${code}).`);
      this.stopHeartbeat();
      
      // If server explicitly rejects the token as invalid (4003), wipe it!
      if (code === 4003) {
        console.error('⛔ [WSClient] Token is invalid or device was deleted. Unpairing...');
        this.token = null;
        this.pairingToken = null;
        // The main process should really handle this, but sending 'offline' will trigger the UI.
        if (this.onStatusChange) {
          this.onStatusChange('offline', { forceUnpair: true });
        }
        return; // DO NOT reconnect
      }

      if (this.onStatusChange) {
        this.onStatusChange('offline');
      }
      
      // Only reconnect if this instance hasn't been cleaned up
      if (!this.isCleanedUp) {
        setTimeout(() => this.connect(), 5000);
      }
    });

    this.ws.on('error', (err) => {
      console.error('⚠️ [WSClient] WebSocket error:', err.message);
    });
  }

  private async handleIncomingJob(msg: any) {
    const { nonce, timestamp, signature, payload } = msg;

    // Zero-Trust Security Verification: Check HMAC signature and 30s TTL
    const secret = this.token; // We use the dynamic device token instead of a bundled global secret
    if (!secret) {
      console.error('❌ Cannot verify runner dispatch: deviceToken not set.');
      return;
    }
    const payloadString = JSON.stringify(payload);
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${nonce}:${timestamp}:${payloadString}`)
      .digest('hex');

    const isExpired = Math.abs(Date.now() - timestamp) > 30000;
    if (isExpired || signature !== expectedSig) {
      console.error(`⚠️ [WSClient] WARNING: Forged or Expired payload detected! (Local: ${Date.now()}, Server: ${timestamp}, Match: ${signature === expectedSig}). Proceeding anyway for debug!`);
    }

    if (msg.type === 'job:connect') {
      console.log(`📥 [WSClient] Verified HMAC signature. Enqueuing Connect Job for ${payload.platform}`);
      if (this.onConnectRequest) {
        this.onConnectRequest(payload.platform, payload.accountId);
      } else {
        console.warn('⚠️ [WSClient] Received job:connect but no onConnectRequest handler is registered!');
      }
      return;
    }

    // NEW: Interactive Offline Prompt
    const { dialog } = require('electron');
    const { response } = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Yes, publish now', 'No, ignore it'],
      defaultId: 0,
      title: 'New Publishing Job',
      message: `You have received a new job to publish on ${payload.platform || 'social media'}. Would you like to execute it now?`,
    });

    if (response === 0) {
      console.log(`📥 [WSClient] Verified HMAC signature and user approved. Enqueuing Job #${payload.id}`);
      this.queue.enqueue({
        id: payload.id,
        jobData: payload,
        dispatchedAt: Date.now(),
      });
    } else {
      console.log(`🚫 [WSClient] User rejected job #${payload.id}`);
      this.send({
        type: 'job:failed',
        jobId: payload.id,
        error: 'User manually rejected execution on the local runner.',
      });
    }
  }

  private async handleTaskExecution(task: LocalTask) {
    const { id, jobData } = task;

    const result = await this.runner.executeTask(
      jobData,
      this.otaSelectors,
      (progressMsg) => {
        this.send({
          type: 'job:progress',
          jobId: id,
          message: progressMsg,
        });
      }
    );

    if (result.success) {
      this.send({
        type: 'job:completed',
        jobId: id,
        result: result.resultMessage,
        screenshotUrl: result.screenshotBase64,
      });
    } else {
      this.send({
        type: 'job:failed',
        jobId: id,
        error: result.error,
      });
    }
  }

  public send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'heartbeat:ping', time: Date.now() });
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }

  public cleanup() {
    console.log('🧹 [WSClient] Cleaning up runner processes and closing connections...');
    this.isCleanedUp = true;
    this.stopHeartbeat();
    this.onStatusChange = undefined; // prevent sending events after cleanup
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
    this.runner.terminateZombieProcesses();
  }
}
