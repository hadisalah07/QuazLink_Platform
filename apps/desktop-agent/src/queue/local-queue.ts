export interface LocalTask {
  id: string;
  jobData: any;
  dispatchedAt: number;
}

export class LocalJobQueue {
  // Single-slot FIFO: exactly one job runs at a time (anti-detection + resource safety).
  // Hard cap on how many jobs may wait, so a dispatch flood can't grow memory unbounded.
  private static readonly MAX_QUEUE_DEPTH = 100;

  private queue: LocalTask[] = [];
  private isProcessing = false;
  private executorFn: (task: LocalTask) => Promise<void>;

  constructor(executor: (task: LocalTask) => Promise<void>) {
    this.executorFn = executor;
  }

  /**
   * Enqueue a task. Returns false if the queue is at capacity and the task was rejected — the
   * caller should report job:failed so the cloud doesn't keep waiting on a dropped job.
   */
  public enqueue(task: LocalTask): boolean {
    if (this.queue.length >= LocalJobQueue.MAX_QUEUE_DEPTH) {
      console.warn(`⛔ [LocalQueue] Queue full (${this.queue.length}). Rejecting task #${task.id}.`);
      return false;
    }
    this.queue.push(task);
    console.log(`📥 [LocalQueue] Enqueued task #${task.id}. Queue depth: ${this.queue.length}`);
    this.processNext();
    return true;
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    // RAM Guard removed: os.freemem() is unreliable on Windows (returns 0 due to SuperFetch/Standby cache)
    // We will spawn the browser immediately.

    this.isProcessing = true;
    const task = this.queue.shift()!;

    try {
      console.log(`▶️ [LocalQueue] Starting execution of task #${task.id}`);
      await this.executorFn(task);
    } catch (err: any) {
      console.error(`❌ [LocalQueue] Task #${task.id} execution failed:`, err.message);
    } finally {
      this.isProcessing = false;

      // Smart anti-detection jitter: random 5-15s cool-off between consecutive tasks
      if (this.queue.length > 0) {
        const jitterMs = Math.floor(Math.random() * 10000) + 5000;
        console.log(`⏳ [LocalQueue] Cooling off for ${Math.round(jitterMs / 1000)}s before next task...`);
        setTimeout(() => this.processNext(), jitterMs);
      }
    }
  }

  public getDepth(): number {
    return this.queue.length;
  }

  public getStatus() {
    return {
      isProcessing: this.isProcessing,
      pendingCount: this.queue.length,
      // NOTE (§13): freeMemoryMB removed — os.freemem() is unreliable on Windows (misleading
      // values from the standby/SuperFetch cache), so it was never a trustworthy signal.
    };
  }
}
