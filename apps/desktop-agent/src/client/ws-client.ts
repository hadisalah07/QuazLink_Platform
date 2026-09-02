import WebSocket from 'ws';
import crypto from 'crypto';
import { LocalJobQueue, LocalTask } from '../queue/local-queue';
import { PlaywrightRunner } from '../executor/playwright-runner';

export interface RunnerWSOptions {
  token?: string;
  pairingToken?: string;
  onStatusChange?: (status: 'online' | 'offline' | 'pairing', info?: any) => void;
  onConnectRequest?: (platform: string, accountId: string) => void;
  // Interactive prompts are injected by the host so this client stays Electron-free
  // (Electron main supplies dialogs; the headless CLI supplies auto-approve). Returning
  // a resolved boolean decides whether the runner acts on the message.
  confirmJob?: (payload: any) => Promise<boolean>;
  confirmSync?: (count: number) => Promise<boolean>;
}

// Freshness window for signed dispatches. The server stamps `timestamp = Date.now()` but
// enforces NO TTL of its own, so this is our only clock-skew guard; it also bounds how long
// the nonce-replay cache must retain entries. 120s tolerates real desktop clock drift.
const HMAC_WINDOW_MS = 120_000;
// Max time to wait for a cloud AI `job:heal_action` reply before failing the step. The server
// has no healing deadline (and silently drops malformed heal requests), so without this the
// single-slot queue could deadlock forever.
const HEAL_TIMEOUT_MS = 45_000;
// Reconnect backoff bounds (exponential + jitter, reset on a successful open).
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export class RunnerWSClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private token: string | null = null;
  private pairingToken: string | null = null;
  private queue: LocalJobQueue;
  private runner: PlaywrightRunner;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectDelay = RECONNECT_BASE_MS;
  private otaSelectors: any = {};
  private onStatusChange?: (status: 'online' | 'offline' | 'pairing', info?: any) => void;
  private onConnectRequest?: (platform: string, accountId: string) => void;
  private confirmJob?: (payload: any) => Promise<boolean>;
  private confirmSync?: (count: number) => Promise<boolean>;
  private isCleanedUp = false;
  // Replay cache: nonce -> timestamp. The server tracks no nonces, so replay protection lives
  // here. Swept against HMAC_WINDOW_MS so it stays bounded.
  private seenNonces = new Map<string, number>();

  constructor(serverUrl: string, options: RunnerWSOptions) {
    this.serverUrl = serverUrl;
    this.token = options.token || null;
    this.pairingToken = options.pairingToken || null;
    this.onStatusChange = options.onStatusChange;
    this.onConnectRequest = options.onConnectRequest;
    this.confirmJob = options.confirmJob;
    this.confirmSync = options.confirmSync;

    this.runner = new PlaywrightRunner();
    this.queue = new LocalJobQueue(this.handleTaskExecution.bind(this));

    // NOTE: process-signal (SIGINT/SIGTERM/exit) handlers are intentionally NOT registered
    // here. A new RunnerWSClient is created on every (re)pair, and per-instance process
    // listeners accumulate and leak. The entry points (main.ts / cli.ts) own signal handling
    // and call cleanup() on the current instance.
  }

  public connect() {
    if (!this.token && !this.pairingToken) {
      console.log('⚠️ [WSClient] No tokens found. Skipping connection to Cloud Gateway.');
      if (this.onStatusChange) this.onStatusChange('offline');
      return;
    }

    // SECURITY NOTE: the token/pairingToken is sent as a URL query parameter because the
    // server gateway currently reads auth from the query string only. Query params can leak
    // into server/proxy access logs. A future server-coordinated change should accept
    // `Authorization: Bearer <token>` on the upgrade request (with a query fallback for
    // rollout); at that point move this to the `headers` option of `new WebSocket(...)`.
    let wsEndpoint = `${this.serverUrl}/ws/runner`;
    if (this.token) {
      wsEndpoint += `?token=${this.token}`;
    } else if (this.pairingToken) {
      wsEndpoint += `?pairingToken=${this.pairingToken}`;
    }

    console.log(`🔌 [WSClient] Connecting to Cloud Gateway: ${this.serverUrl}/ws/runner`);
    this.ws = new WebSocket(wsEndpoint);

    this.ws.on('open', () => {
      console.log('🟢 [WSClient] Connected to QuazLink Cloud Gateway (Zero-Trust TLS)');
      this.reconnectDelay = RECONNECT_BASE_MS; // reset backoff on a healthy connection
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
          const approved = this.confirmSync ? await this.confirmSync(msg.count) : true;
          if (approved) {
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

    this.ws.on('close', (code: number) => {
      console.warn(`🔴 [WSClient] Disconnected from Cloud Gateway (Code: ${code}).`);
      this.stopHeartbeat();

      // If server explicitly rejects the token as invalid (4003), wipe it and do NOT reconnect.
      if (code === 4003) {
        console.error('⛔ [WSClient] Token is invalid or device was deleted. Unpairing...');
        this.token = null;
        this.pairingToken = null;
        if (this.onStatusChange) {
          this.onStatusChange('offline', { forceUnpair: true });
        }
        return;
      }

      if (this.onStatusChange) {
        this.onStatusChange('offline');
      }

      // Reconnect with exponential backoff + jitter, unless this instance was cleaned up.
      if (!this.isCleanedUp) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err) => {
      console.error('⚠️ [WSClient] WebSocket error:', err.message);
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.isCleanedUp) return;
    const base = Math.min(this.reconnectDelay, RECONNECT_MAX_MS);
    const delay = base + Math.floor(Math.random() * 1000); // jitter to avoid thundering herd
    console.warn(`🔁 [WSClient] Reconnecting in ~${Math.round(delay / 1000)}s...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
  }

  private async handleIncomingJob(msg: any) {
    const { nonce, timestamp, signature, payload } = msg;

    // ── Zero-Trust verification ──────────────────────────────────────────────────────────
    // The server signs every dispatch with HMAC-SHA256 over `${nonce}:${timestamp}:${payload}`
    // using the device token as the key, but enforces NO freshness/replay checks itself. So we
    // verify strictly here, and REJECT anything that fails — never "proceed anyway".
    const secret = this.token;
    if (!secret) {
      console.error('❌ [WSClient] Cannot verify dispatch: deviceToken not set. Dropping.');
      return;
    }

    // (1) Signature — strict + constant-time. Recompute over the RECEIVED payload object as-is
    //     (do NOT reorder/normalize keys: V8 preserves insertion order through parse→stringify,
    //     and the server has two dispatch key-orders — re-stringifying the received object
    //     matches both byte-for-byte).
    if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature)) {
      console.error('⛔ [WSClient] Rejected dispatch: missing/malformed signature. Dropping.');
      return;
    }
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${nonce}:${timestamp}:${JSON.stringify(payload)}`)
      .digest('hex');
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      console.error('⛔ [WSClient] Rejected dispatch: HMAC signature mismatch (forged?). Dropping.');
      // Do NOT emit job:failed here — on an unsigned/forged message payload.id is untrusted.
      return;
    }

    // Signature is valid from here on → payload fields are authentic.

    // (2) Freshness — the server enforces no TTL, so this is our clock-skew guard.
    if (typeof timestamp !== 'number' || Math.abs(Date.now() - timestamp) > HMAC_WINDOW_MS) {
      const delta = typeof timestamp === 'number' ? Math.abs(Date.now() - timestamp) : NaN;
      console.error(`⛔ [WSClient] Rejected dispatch: expired (Δ=${delta}ms > ${HMAC_WINDOW_MS}ms).`);
      // Signature was valid, so payload.id is authentic and it is safe to report back.
      if (msg.type === 'job:dispatch' && payload?.id) {
        this.send({
          type: 'job:failed',
          jobId: payload.id,
          error: 'Dispatch expired — check the runner machine system clock.',
        });
      }
      return;
    }

    // (3) Replay — the server tracks no nonces, so keep a bounded local cache.
    this.sweepNonces();
    if (typeof nonce !== 'string' || this.seenNonces.has(nonce)) {
      console.warn('⚠️ [WSClient] Rejected dispatch: replayed/duplicate nonce. Dropping.');
      return;
    }
    this.seenNonces.set(nonce, timestamp);

    // ── Verified & fresh. Route the job. ───────────────────────────────────────────────────
    if (msg.type === 'job:connect') {
      console.log(`📥 [WSClient] Verified HMAC. Enqueuing Connect Job for ${payload.platform}`);
      if (this.onConnectRequest) {
        this.onConnectRequest(payload.platform, payload.accountId);
      } else {
        console.warn('⚠️ [WSClient] Received job:connect but no onConnectRequest handler is registered!');
      }
      return;
    }

    // job:dispatch → ask the host whether to run now (Electron dialog, or CLI auto-approve).
    const approved = this.confirmJob ? await this.confirmJob(payload) : true;
    if (approved) {
      const enqueued = this.queue.enqueue({
        id: payload.id,
        jobData: payload,
        dispatchedAt: Date.now(),
      });
      if (enqueued) {
        console.log(`📥 [WSClient] Verified HMAC and approved. Enqueued Job #${payload.id}`);
      } else {
        // Queue at capacity — fail honestly so the cloud doesn't keep waiting on a dropped job.
        console.warn(`⛔ [WSClient] Local queue full. Rejecting job #${payload.id}.`);
        this.send({
          type: 'job:failed',
          jobId: payload.id,
          error: 'Local runner queue is full — please retry shortly.',
        });
      }
    } else {
      console.log(`🚫 [WSClient] User rejected job #${payload.id}`);
      this.send({
        type: 'job:failed',
        jobId: payload.id,
        error: 'User manually rejected execution on the local runner.',
      });
    }
  }

  private sweepNonces() {
    const cutoff = Date.now() - HMAC_WINDOW_MS;
    for (const [nonce, ts] of this.seenNonces) {
      if (ts < cutoff) this.seenNonces.delete(nonce);
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
      },
      async (screenshotBase64: string, goal: string, stepIndex: number, history: any[]) => {
        // Capture the current socket so cleanup targets the right instance across reconnects.
        const ws = this.ws;
        if (!ws) {
          throw new Error('Cannot request AI driver: socket is not connected.');
        }
        return new Promise((resolve, reject) => {
          let settled = false;
          let timer: NodeJS.Timeout;

          const finish = () => {
            ws.off('message', aiResponseHandler);
            clearTimeout(timer);
          };

          const aiResponseHandler = (raw: WebSocket.RawData) => {
            try {
              const m = JSON.parse(raw.toString());
              if (m.type === 'job:driver_action' && m.jobId === id) {
                if (settled) return;
                settled = true;
                finish();
                resolve(m.instruction);
              }
            } catch (e) {
              // ignore non-JSON / unrelated frames
            }
          };

          ws.on('message', aiResponseHandler);

          // Guard against a cloud that never replies
          timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            finish();
            reject(new Error(`AI driver timed out after ${HEAL_TIMEOUT_MS}ms with no cloud response.`));
          }, HEAL_TIMEOUT_MS);

          this.send({
            type: 'job:request_driver_action',
            jobId: id,
            goal,
            stepIndex,
            history,
            screenshot: screenshotBase64,
          });
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
    console.log('🧹 [WSClient] Cleaning up runner and closing connection...');
    this.isCleanedUp = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.onStatusChange = undefined; // prevent sending events after cleanup
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
  }
}
