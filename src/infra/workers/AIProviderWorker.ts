/**
 * AIProviderWorker - Non-blocking AI Provider using Web Workers
 */

import type {
  AIProviderConfig,
  Message,
  ChatResponse,
  ChatOptions,
  CompletionOptions,
  EventType,
  EventCallback,
} from '../../core/types';
import { WorkerPool } from './WorkerPool';
import { EventEmitter } from '../events/EventEmitter';
import { getConfig } from '../../app/state';
import { ValidationError } from '@domain/errors';

export class AIProviderWorker {
  private workerPool: WorkerPool | null = null;
  private config: AIProviderConfig;
  private eventEmitter: EventEmitter;
  private modelLoaded = false;

  constructor(config: AIProviderConfig = {}) {
    this.config = config;
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Initialize worker pool
   */
  private async ensureWorkerPool(): Promise<WorkerPool> {
    if (!this.workerPool) {
      // Create worker pool with LLM worker
      // Note: In production, this would need proper worker URL resolution
      // In Node.js (tests), skip worker initialization
      if (typeof import.meta !== 'undefined' && import.meta.url) {
        const workerUrl = new URL('./llm.worker.ts', import.meta.url);
        this.workerPool = new WorkerPool(workerUrl, 2); // 2 workers for LLM

        // Wait a bit for workers to initialize
        await new Promise((resolve) => setTimeout(resolve, 100));
      } else {
        throw new ValidationError('WorkerPool requires browser environment with import.meta.url support', 'environment');
      }
    }
    return this.workerPool;
  }

  /**
   * Load model in worker
   */
  private async loadModel(): Promise<void> {
    if (this.modelLoaded) {
      return;
    }

    if (!this.config.llm) {
      throw new ValidationError('LLM not configured', 'llm');
    }

    const pool = await this.ensureWorkerPool();

    try {
      await pool.execute('load', {
        model: this.config.llm.model,
        dtype: this.config.llm.dtype,
        device: this.config.llm.device,
      });

      this.modelLoaded = true;
      this.eventEmitter.emit('ready', {
        modality: 'llm',
        model: this.config.llm.model,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.eventEmitter.emit('error', {
        modality: 'llm',
        error: err,
      });
      throw error;
    }
  }

  /**
   * Chat with LLM (non-blocking)
   */
  async chat(
    messages: Message[] | string,
    options: ChatOptions = {}
  ): Promise<ChatResponse> {
    if (!this.config.llm) {
      throw new ValidationError('LLM not configured', 'llm');
    }

    // Ensure model is loaded
    await this.loadModel();

    const pool = await this.ensureWorkerPool();

    try {
      const result = await pool.execute<{
        content: string;
        role: 'assistant';
      }>('chat', {
        messages,
        options: {
          maxTokens: options.maxTokens,
          temperature: options.temperature,
          topP: options.topP,
        },
      });

      return {
        content: result.content,
        role: 'assistant',
        finishReason: 'stop',
      };
    } catch (error) {
      throw new ValidationError(`Chat failed: ${(error as Error).message}`, 'llm');
    }
  }

  /**
   * Complete prompt (non-blocking)
   */
  async complete(
    prompt: string,
    options: CompletionOptions = {}
  ): Promise<string> {
    if (!this.config.llm) {
      throw new ValidationError('LLM not configured', 'llm');
    }

    await this.loadModel();

    const pool = await this.ensureWorkerPool();

    try {
      const result = await pool.execute<{ text: string }>('complete', {
        prompt,
        options: {
          maxTokens: options.maxTokens,
          temperature: options.temperature,
          topP: options.topP,
        },
      });

      return result.text;
    } catch (error) {
      throw new ValidationError(`Completion failed: ${(error as Error).message}`, 'llm');
    }
  }

  /**
   * Warmup - preload model
   */
  async warmup(): Promise<void> {
    await this.loadModel();
  }

  /**
   * Check if ready
   */
  isReady(): boolean {
    return this.modelLoaded;
  }

  /**
   * Unload model
   */
  async unload(): Promise<void> {
    if (!this.workerPool) {
      return;
    }

    try {
      await this.workerPool.execute('unload', {});
      this.modelLoaded = false;
      this.eventEmitter.emit('unload', { modality: 'llm' });
    } catch (error) {
      const logger = getConfig().logger;
      logger.error('Error unloading model:', error);
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return this.workerPool?.getStats() || null;
  }

  /**
   * Dispose and cleanup
   */
  async dispose(): Promise<void> {
    await this.unload();
    
    if (this.workerPool) {
      this.workerPool.terminate();
      this.workerPool = null;
    }

    this.eventEmitter.removeAllListeners();
  }

  /**
   * Event listeners
   */
  on(event: EventType, callback: EventCallback): void {
    this.eventEmitter.on(event, callback);
  }

  once(event: EventType, callback: EventCallback): void {
    this.eventEmitter.once(event, callback);
  }

  off(event: EventType, callback: EventCallback): void {
    this.eventEmitter.off(event, callback);
  }

  /**
   * Get configuration
   */
  getConfig(): AIProviderConfig {
    return { ...this.config };
  }
}

/**
 * Helper function to create AIProviderWorker
 */
export function createAIProviderWorker(
  config: AIProviderConfig = {}
): AIProviderWorker {
  return new AIProviderWorker(config);
}

