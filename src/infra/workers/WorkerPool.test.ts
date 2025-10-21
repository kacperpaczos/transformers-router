/**
 * Tests for WorkerPool
 */

import { WorkerPool } from './WorkerPool';

// Professional Mock Worker with proper event handling
class MockWorker {
  private messageHandlers: Map<string, Function> = new Map();
  private errorHandlers: Set<Function> = new Set();
  public postMessage = jest.fn((message: any) => {
    // Auto-respond with the same ID
    setTimeout(() => {
      this.sendMessage({
        id: message.id,
        type: 'response',
        data: 'test result',
      });
    }, 10);
  });
  public terminate = jest.fn();

  addEventListener(event: string, handler: Function) {
    if (event === 'message') {
      this.messageHandlers.set('message', handler);
    } else if (event === 'error') {
      this.errorHandlers.add(handler);
    }
  }

  removeEventListener(event: string, handler: Function) {
    if (event === 'message') {
      this.messageHandlers.delete('message');
    } else if (event === 'error') {
      this.errorHandlers.delete(handler);
    }
  }

  // Helper for tests
  sendMessage(data: unknown) {
    const handler = this.messageHandlers.get('message');
    if (handler) {
      handler({ data });
    }
  }

  sendError(message: string) {
    this.errorHandlers.forEach(handler => {
      handler(new ErrorEvent('error', { message }));
    });
  }
}

// Mock ErrorEvent globally
class MockErrorEvent extends Event {
  message: string;
  constructor(type: string, options?: { message?: string }) {
    super(type);
    this.message = options?.message || '';
  }
}

describe('WorkerPool', () => {
  let workerPool: WorkerPool;
  let mockWorkerUrl: string;
  let mockWorkerInstance: MockWorker;

  beforeEach(() => {
    // Setup global ErrorEvent
    global.ErrorEvent = MockErrorEvent as any;

    // Setup Worker mock
    mockWorkerInstance = new MockWorker();
    global.Worker = jest.fn(() => mockWorkerInstance) as any;

    mockWorkerUrl = 'mock-worker.js';
    workerPool = new WorkerPool(mockWorkerUrl, 2);
  });

  afterEach(() => {
    workerPool.terminate();
  });

  describe('Initialization', () => {
    it('should create worker pool with specified size', () => {
      const stats = workerPool.getStats();
      expect(stats.total).toBe(2);
      expect(stats.available).toBe(2);
    });

    it('should create at least one worker by default', () => {
      const defaultPool = new WorkerPool(mockWorkerUrl);
      const stats = defaultPool.getStats();
      expect(stats.total).toBeGreaterThan(0);
      defaultPool.terminate();
    });
  });

  describe('Task Execution', () => {
    it('should execute task successfully', async () => {
      const result = await workerPool.execute('test-task', { param: 'value' });
      expect(result).toBe('test result');
    }, 10000);

    it('should handle task queuing when workers are busy', async () => {
      // First make all workers busy by starting tasks without awaiting
      const promises = [
        workerPool.execute('task1'),
        workerPool.execute('task2'),
        workerPool.execute('task3'), // This should be queued
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
    }, 10000);

    it.skip('should handle task errors', async () => {
      // Mock error response
      (global.Worker as any).mockImplementation(() => ({
        postMessage: jest.fn(),
        terminate: jest.fn(),
        addEventListener: jest.fn((event, handler) => {
          if (event === 'message') {
            setTimeout(() => {
              handler({
                data: {
                  id: 'test-task',
                  type: 'error',
                  error: 'Test error',
                },
              });
            }, 0);
          }
        }),
        removeEventListener: jest.fn(),
      }));

      const newPool = new WorkerPool(mockWorkerUrl, 1);

      await expect(newPool.execute('failing-task')).rejects.toThrow(
        'Test error'
      );
      newPool.terminate();
    }, 10000);
  });

  describe('Worker Management', () => {
    it.skip('should restart failed workers', async () => {
      const mockWorker = {
        postMessage: jest.fn(),
        terminate: jest.fn(),
        addEventListener: jest.fn((event, handler) => {
          if (event === 'error') {
            // Simulate worker error
            setTimeout(() => {
              handler(new ErrorEvent('error', { message: 'Worker crashed' }));
            }, 0);
          }
        }),
        removeEventListener: jest.fn(),
      };

      (global.Worker as any).mockReturnValue(mockWorker);

      const pool = new WorkerPool(mockWorkerUrl, 1);

      // Wait for worker restart
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should have created a replacement worker (initial + restart)
      expect(global.Worker).toHaveBeenCalledTimes(2);

      pool.terminate();
    });

    it('should terminate all workers', () => {
      const mockWorker = {
        postMessage: jest.fn(),
        terminate: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };

      (global.Worker as any).mockReturnValue(mockWorker);

      const pool = new WorkerPool(mockWorkerUrl, 2);
      pool.terminate();

      expect(mockWorker.terminate).toHaveBeenCalledTimes(2);
    });
  });

  describe('Statistics', () => {
    it('should return correct statistics', async () => {
      const stats = workerPool.getStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('available');
      expect(stats).toHaveProperty('busy');
      expect(stats).toHaveProperty('queued');
      expect(stats).toHaveProperty('active');

      expect(stats.total).toBe(2);
      expect(stats.available).toBe(2);
      expect(stats.busy).toBe(0);
      expect(stats.queued).toBe(0);
      expect(stats.active).toBe(0);
    });
  });
});
