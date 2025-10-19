/**
 * Worker Pool for managing Web Workers
 */

import { getConfig } from '../../app/state';

export interface WorkerTask<T = unknown> {
  id: string;
  type: string;
  data: unknown;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

export interface WorkerMessage {
  id: string;
  type: string;
  data?: unknown;
  error?: string;
  progress?: {
    status: string;
    file?: string;
    progress?: number;
    loaded?: number;
    total?: number;
  };
}

export class WorkerPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private activeTasks: Map<string, WorkerTask> = new Map();
  private workerScript: string | URL;
  private poolSize: number;
  private taskIdCounter = 0;

  constructor(workerScript: string | URL, poolSize: number = navigator.hardwareConcurrency || 4) {
    this.workerScript = workerScript;
    this.poolSize = Math.min(poolSize, 8); // Max 8 workers
    this.initialize();
  }

  /**
   * Initialize worker pool
   */
  private initialize(): void {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(this.workerScript, { type: 'module' });
      
      worker.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
        this.handleWorkerMessage(worker, event.data);
      });

      worker.addEventListener('error', (error) => {
        const logger = getConfig().logger;
        logger.error('Worker error:', error);
        this.handleWorkerError(worker, error);
      });

      this.workers.push(worker);
      this.availableWorkers.push(worker);
    }
  }

  /**
   * Execute a task on an available worker
   */
  async execute<T = unknown>(type: string, data?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const taskId = this.generateTaskId();
      const task: WorkerTask = {
        id: taskId,
        type,
        data,
        resolve: resolve as (value: unknown) => void,
        reject,
      };

      const worker = this.getAvailableWorker();
      if (worker) {
        this.executeTask(worker, task);
      } else {
        this.taskQueue.push(task);
      }
    });
  }

  /**
   * Execute a task on a specific worker
   */
  private executeTask(worker: Worker, task: WorkerTask): void {
    this.activeTasks.set(task.id, task);
    this.removeFromAvailable(worker);

    worker.postMessage({
      id: task.id,
      type: task.type,
      data: task.data,
    });
  }

  /**
   * Handle message from worker
   */
  private handleWorkerMessage(worker: Worker, message: WorkerMessage): void {
    const task = this.activeTasks.get(message.id);
    
    if (!task) {
      return;
    }

    // Progress update
    if (message.progress) {
      // Emit progress event if needed
      return;
    }

    // Task completion
    if (message.error) {
      task.reject(new Error(message.error));
    } else {
      task.resolve(message.data);
    }

    // Cleanup
    this.activeTasks.delete(message.id);
    this.makeAvailable(worker);

    // Process next task in queue
    this.processQueue();
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(worker: Worker, error: ErrorEvent): void {
    // Find and reject all tasks from this worker
    for (const [taskId, task] of this.activeTasks.entries()) {
      task.reject(new Error(`Worker error: ${error.message}`));
      this.activeTasks.delete(taskId);
    }

    // Restart worker
    this.restartWorker(worker);
  }

  /**
   * Restart a failed worker
   */
  private restartWorker(oldWorker: Worker): void {
    const index = this.workers.indexOf(oldWorker);
    if (index === -1) return;

    oldWorker.terminate();

    const newWorker = new Worker(this.workerScript, { type: 'module' });
    
    newWorker.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
      this.handleWorkerMessage(newWorker, event.data);
    });

    newWorker.addEventListener('error', (error) => {
      this.handleWorkerError(newWorker, error);
    });

    this.workers[index] = newWorker;
    this.availableWorkers.push(newWorker);
  }

  /**
   * Get an available worker from the pool
   */
  private getAvailableWorker(): Worker | null {
    return this.availableWorkers.shift() || null;
  }

  /**
   * Mark worker as available
   */
  private makeAvailable(worker: Worker): void {
    if (!this.availableWorkers.includes(worker)) {
      this.availableWorkers.push(worker);
    }
  }

  /**
   * Remove worker from available list
   */
  private removeFromAvailable(worker: Worker): void {
    const index = this.availableWorkers.indexOf(worker);
    if (index !== -1) {
      this.availableWorkers.splice(index, 1);
    }
  }

  /**
   * Process queued tasks
   */
  private processQueue(): void {
    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const task = this.taskQueue.shift();
      const worker = this.getAvailableWorker();
      
      if (task && worker) {
        this.executeTask(worker, task);
      }
    }
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task-${Date.now()}-${this.taskIdCounter++}`;
  }

  /**
   * Terminate all workers
   */
  terminate(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
    this.activeTasks.clear();
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      total: this.workers.length,
      available: this.availableWorkers.length,
      busy: this.workers.length - this.availableWorkers.length,
      queued: this.taskQueue.length,
      active: this.activeTasks.size,
    };
  }
}

