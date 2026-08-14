import WebSocket from 'ws';
import crypto from 'crypto';
import { LocalJobQueue, LocalTask } from '../queue/local-queue';
import { PlaywrightRunner } from '../executor/playwright-runner';

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

  constructor(
    serverUrl: string,
    options: {
      token?: string;
      pairingToken?: string;
      onStatusChange?: (status: 'online' | 'offline' | 'pairing', info?: any) => void;
    }
  ) {
    this.serverUrl = serverUrl;
    this.token = options.token || null;
    this.pairingToken = options.pairingToken || null;
    this.onStatusChange = options.onStatusChange;

    this.runner = new PlaywrightRunner();
    this.queue = new LocalJobQueue(this.handleTaskExecution.bind(this));

    // Handle process termination to kill any zombie browser processes
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
    process.on('exit', () => this.cleanup());
  }

  public connect() {
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

        if (msg.type === 'job:dispatch') {
          await this.handleIncomingJob(msg);
        }
      } catch (err: any) {
        console.error('❌ [WSClient] Message parsing error:', err.message);
      }
    });

    this.ws.on('close', () => {
      console.warn('🔴 [WSClient] Disconnected from Cloud Gateway. Reconnecting in 5s...');
      this.stopHeartbeat();
      if (this.onStatusChange) this.onStatusChange('offline');
      setTimeout(() => this.connect(), 5000);
    });

    this.ws.on('error', (err) => {
      console.error('⚠️ [WSClient] WebSocket error:', err.message);
    });
  }

  private async handleIncomingJob(msg: any) {
    const { nonce, timestamp, signature, payload } = msg;

    // Zero-Trust Security Verification: Check HMAC signature and 30s TTL
    const secret = process.env.ENCRYPTION_KEY || 'default_runner_secret_key_32_bytes_len';
    const payloadString = JSON.stringify(payload);
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${nonce}:${timestamp}:${payloadString}`)
      .digest('hex');

    const isExpired = Math.abs(Date.now() - timestamp) > 30000;
    if (isExpired || signature !== expectedSig) {
      console.error('⛔ [WSClient] REJECTED FORGED OR EXPIRED JOB PAYLOAD (Security Alert)');
      return;
    }

    console.log(`📥 [WSClient] Verified HMAC signature. Enqueuing Job #${payload.id}`);
    this.queue.enqueue({
      id: payload.id,
      jobData: payload,
      dispatchedAt: Date.now(),
    });
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

  private send(data: any) {
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
    console.log('🧹 [WSClient] Cleaning up runner processes...');
    this.runner.terminateZombieProcesses();
  }
}
