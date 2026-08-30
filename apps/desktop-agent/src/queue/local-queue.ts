import os from 'os';

export interface LocalTask {
  id: string;
  jobData: any;
  dispatchedAt: number;
}

export class LocalJobQueue {
  private queue: LocalTask[] = [];
  private isProcessing = false;
  private maxConcurrency = 1;
  private executorFn: (task: LocalTask) => Promise<void>;

  constructor(executor: (task: LocalTask) => Promise<void>) {
    this.executorFn = executor;
  }

  public enqueue(task: LocalTask) {
    this.queue.push(task);
    console.log(`📥 [LocalQueue] Enqueued task #${task.id}. Queue depth: ${this.queue.length}`);
    this.processNext();
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
      freeMemoryMB: Math.round(os.freemem() / (1024 * 1024)),
    };
  }
}
