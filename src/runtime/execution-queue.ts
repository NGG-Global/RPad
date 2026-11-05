/**
 * A strict FIFO queue so that R operations never overlap. Every call that
 * touches the R session (user code, environment refresh, data paging, file
 * sync) goes through here; WebR itself is single threaded, and interleaving
 * requests would produce inconsistent state.
 */
export interface QueuedTask<T = unknown> {
  id: string;
  label: string;
  run: () => Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
  cancelled: boolean;
}

export class ExecutionQueue {
  private tasks: QueuedTask[] = [];
  private running: QueuedTask | null = null;
  private counter = 0;
  private listeners = new Set<() => void>();

  get pending(): number {
    return this.tasks.length;
  }

  get current(): QueuedTask | null {
    return this.running;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn();
  }

  /**
   * Add a task. With `front: true` the task runs before other pending tasks
   * (used for quick editor lookups such as expression-extent parsing).
   */
  enqueue<T>(label: string, run: () => Promise<T>, opts: { front?: boolean } = {}): Promise<T> & { taskId: string } {
    const id = `t${++this.counter}`;
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    }) as Promise<T> & { taskId: string };
    promise.taskId = id;
    const task = { id, label, run, resolve, reject, cancelled: false } as QueuedTask;
    if (opts.front) this.tasks.unshift(task);
    else this.tasks.push(task);
    this.notify();
    void this.pump();
    return promise;
  }

  /** Remove a not-yet-started task. Returns true if it was removed. */
  cancel(id: string): boolean {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    const [task] = this.tasks.splice(idx, 1);
    task.cancelled = true;
    task.reject(new Error('cancelled'));
    this.notify();
    return true;
  }

  cancelAllPending(): number {
    const n = this.tasks.length;
    for (const t of this.tasks.splice(0)) {
      t.cancelled = true;
      t.reject(new Error('cancelled'));
    }
    this.notify();
    return n;
  }

  private async pump() {
    if (this.running) return;
    const task = this.tasks.shift();
    if (!task) return;
    this.running = task;
    this.notify();
    try {
      const v = await task.run();
      task.resolve(v);
    } catch (e) {
      task.reject(e);
    } finally {
      this.running = null;
      this.notify();
      void this.pump();
    }
  }
}
