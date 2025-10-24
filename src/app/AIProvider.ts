/**
 * AI Provider - Main interface for agent frameworks
 */

import type {
  AIProviderConfig,
  Message,
  ChatResponse,
  ChatOptions,
  CompletionOptions,
  TTSOptions,
  STTOptions,
  EmbeddingOptions,
  Modality,
  EventType,
  EventCallback,
  ModelStatus,
} from '../core/types';
import { ValidationError } from '@domain/errors';
import { ModelManager } from './ModelManager';
import { EventEmitter } from '@infra/events/EventEmitter';
import { LLMModel } from '../models/LLMModel';
import { TTSModel } from '../models/TTSModel';
import { STTModel } from '../models/STTModel';
import { EmbeddingModel } from '../models/EmbeddingModel';
import { VectorizationService } from './vectorization/VectorizationService';
import type {
  VectorizationServiceConfig,
  VectorModality,
  QueryOptions,
  VectorizeOptions,
  QueryVectorizeOptions,
  VectorizationProgressEventData,
} from '../core/types';

export class AIProvider {
  private modelManager: ModelManager;
  private config: AIProviderConfig;
  private eventEmitter: EventEmitter;
  private vectorizationService?: VectorizationService;

  constructor(config: AIProviderConfig = {}) {
    this.config = config;
    this.eventEmitter = new EventEmitter();
    this.modelManager = new ModelManager(this.eventEmitter);
  }

  // ==================== LLM Methods ====================

  /**
   * Chat with the LLM (supports message history)
   */
  async chat(
    messages: Message[] | string,
    options: ChatOptions = {}
  ): Promise<ChatResponse> {
    if (!this.config.llm) {
      throw new ValidationError(
        'LLM not configured. Please provide llm config in AIProvider constructor.',
        'llm'
      );
    }

    const model = await this.modelManager.getOrLoadModel(
      'llm',
      this.config.llm
    );
    return (model as LLMModel).chat(messages, options);
  }

  /**
   * Complete a prompt with the LLM
   */
  async complete(
    prompt: string,
    options: CompletionOptions = {}
  ): Promise<string> {
    if (!this.config.llm) {
      throw new ValidationError('LLM not configured', 'llm');
    }

    const model = await this.modelManager.getOrLoadModel(
      'llm',
      this.config.llm
    );
    return (model as LLMModel).complete(prompt, options);
  }

  /**
   * Stream chat responses
   */
  async *stream(
    messages: Message[] | string,
    options: ChatOptions = {}
  ): AsyncGenerator<string> {
    if (!this.config.llm) {
      throw new ValidationError('LLM not configured', 'llm');
    }

    const model = await this.modelManager.getOrLoadModel(
      'llm',
      this.config.llm
    );
    yield* (model as LLMModel).stream(messages, options);
  }

  // ==================== Speech Methods ====================

  /**
   * Synthesize speech from text (TTS)
   */
  async speak(text: string, options: TTSOptions = {}): Promise<Blob> {
    if (!this.config.tts) {
      throw new ValidationError(
        'TTS not configured. Please provide tts config in AIProvider constructor.',
        'tts'
      );
    }

    const model = await this.modelManager.getOrLoadModel(
      'tts',
      this.config.tts
    );
    return (model as TTSModel).synthesize(text, options);
  }

  /**
   * Transcribe audio to text (STT)
   */
  async listen(
    audio: Blob | Float32Array | string,
    options: STTOptions = {}
  ): Promise<string> {
    if (!this.config.stt) {
      throw new ValidationError(
        'STT not configured. Please provide stt config in AIProvider constructor.',
        'stt'
      );
    }

    const model = await this.modelManager.getOrLoadModel(
      'stt',
      this.config.stt
    );
    return (model as STTModel).transcribe(audio, options);
  }

  // ==================== Embedding Methods ====================

  /**
   * Generate embeddings for text(s)
   */
  async embed(
    text: string | string[],
    options: EmbeddingOptions = {}
  ): Promise<number[][]> {
    if (!this.config.embedding) {
      throw new ValidationError(
        'Embedding not configured. Please provide embedding config in AIProvider constructor.',
        'embedding'
      );
    }

    const model = await this.modelManager.getOrLoadModel(
      'embedding',
      this.config.embedding
    );
    return (model as EmbeddingModel).embed(text, options);
  }

  /**
   * Calculate cosine similarity between texts
   */
  async similarity(text1: string, text2: string): Promise<number> {
    const embeddings = await this.embed([text1, text2]);
    const model = this.modelManager.getModel('embedding') as EmbeddingModel;
    return model.cosineSimilarity(embeddings[0], embeddings[1]);
  }

  /**
   * Find most similar text from a list
   */
  async findSimilar(
    query: string,
    texts: string[],
    options: EmbeddingOptions = {}
  ): Promise<{ text: string; similarity: number; index: number }> {
    if (!this.config.embedding) {
      throw new ValidationError('Embedding not configured', 'embedding');
    }

    const model = await this.modelManager.getOrLoadModel(
      'embedding',
      this.config.embedding
    );
    return (model as EmbeddingModel).findMostSimilar(query, texts, options);
  }

  // ==================== Lifecycle Methods ====================

  /**
   * Warmup (pre-load) a model
   */
  async warmup(modality?: Modality): Promise<void> {
    if (modality) {
      const config = this.config[modality];
      if (!config) {
        throw new ValidationError(`${modality} not configured`, modality);
      }
      await this.modelManager.loadModel(modality, config);
    } else {
      // Warmup all configured models
      const promises: Promise<unknown>[] = [];

      if (this.config.llm) {
        promises.push(this.modelManager.loadModel('llm', this.config.llm));
      }
      if (this.config.tts) {
        promises.push(this.modelManager.loadModel('tts', this.config.tts));
      }
      if (this.config.stt) {
        promises.push(this.modelManager.loadModel('stt', this.config.stt));
      }
      if (this.config.embedding) {
        promises.push(
          this.modelManager.loadModel('embedding', this.config.embedding)
        );
      }

      await Promise.all(promises);
    }
  }

  /**
   * Unload a model to free resources
   */
  async unload(modality?: Modality): Promise<void> {
    if (modality) {
      await this.modelManager.unloadModel(modality);
    } else {
      await this.modelManager.clearAll();
    }
  }

  /**
   * Check if a model is ready
   */
  isReady(modality: Modality): boolean {
    return this.modelManager.isLoaded(modality);
  }

  /**
   * Get status of a model
   */
  getStatus(modality: Modality): ModelStatus {
    return this.modelManager.getStatus(modality);
  }

  /**
   * Get status of all models
   */
  getAllStatuses(): ModelStatus[] {
    return this.modelManager.getAllStatuses();
  }

  // ==================== Event Methods ====================

  /**
   * Register event listener (type-safe)
   */
  on<T extends EventType>(event: T, callback: EventCallback<T>): void {
    this.eventEmitter.on(event, callback);
  }

  /**
   * Register one-time event listener (type-safe)
   */
  once<T extends EventType>(event: T, callback: EventCallback<T>): void {
    this.eventEmitter.once(event, callback);
  }

  /**
   * Remove event listener (type-safe)
   */
  off<T extends EventType>(event: T, callback: EventCallback<T>): void {
    this.eventEmitter.off(event, callback);
  }

  // ==================== Config Methods ====================

  /**
   * Get current configuration
   */
  getConfig(): AIProviderConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (will unload affected models)
   */
  async updateConfig(config: Partial<AIProviderConfig>): Promise<void> {
    const updates: Promise<void>[] = [];

    if (config.llm && config.llm !== this.config.llm) {
      updates.push(this.modelManager.unloadModel('llm'));
      this.config.llm = config.llm;
    }

    if (config.tts && config.tts !== this.config.tts) {
      updates.push(this.modelManager.unloadModel('tts'));
      this.config.tts = config.tts;
    }

    if (config.stt && config.stt !== this.config.stt) {
      updates.push(this.modelManager.unloadModel('stt'));
      this.config.stt = config.stt;
    }

    if (config.embedding && config.embedding !== this.config.embedding) {
      updates.push(this.modelManager.unloadModel('embedding'));
      this.config.embedding = config.embedding;
    }

    await Promise.all(updates);
  }

  // ==================== Vectorization Methods ====================

  /**
   * Initialize vectorization service
   */
  async initializeVectorization(
    config: VectorizationServiceConfig
  ): Promise<void> {
    this.vectorizationService = new VectorizationService(config);
    await this.vectorizationService.initialize();
  }

  /**
   * Index files for vector search
   */
  async indexFiles(
    files: File[]
  ): Promise<{ indexed: string[]; failed: string[] }> {
    if (!this.vectorizationService) {
      throw new ValidationError(
        'Vectorization service not initialized. Call initializeVectorization first.'
      );
    }
    return await this.vectorizationService.indexFiles(files);
  }

  /**
   * Query for similar vectors
   */
  async queryVectors(
    input: string | File,
    modality?: VectorModality,
    options?: QueryOptions
  ): Promise<{ ids: string[]; scores: number[] }> {
    if (!this.vectorizationService) {
      throw new ValidationError(
        'Vectorization service not initialized. Call initializeVectorization first.'
      );
    }
    return await this.vectorizationService.query(input, modality, options);
  }

  /**
   * Delete vectors by IDs
   */
  async deleteVectors(ids: string[]): Promise<void> {
    if (!this.vectorizationService) {
      throw new ValidationError(
        'Vectorization service not initialized. Call initializeVectorization first.'
      );
    }
    await this.vectorizationService.delete(ids);
  }

  /**
   * Get resource usage snapshot
   */
  async getVectorizationUsage() {
    if (!this.vectorizationService) {
      throw new ValidationError(
        'Vectorization service not initialized. Call initializeVectorization first.'
      );
    }
    return await this.vectorizationService.getUsageSnapshot();
  }

  /**
   * Register vectorization event listener
   */
  onVectorizationEvent<T = unknown>(
    event: string,
    handler: (payload: T) => void
  ): () => void {
    if (!this.vectorizationService) {
      throw new ValidationError(
        'Vectorization service not initialized. Call initializeVectorization first.'
      );
    }
    return this.vectorizationService.on(event, handler);
  }

  /**
   * Vectorize with detailed progress tracking (AsyncGenerator)
   */
  async *vectorizeWithProgress(
    input: File | string | ArrayBuffer,
    options: VectorizeOptions = {}
  ): AsyncGenerator<
    VectorizationProgressEventData,
    { indexed: string[]; failed: string[] }
  > {
    if (!this.vectorizationService) {
      throw new ValidationError(
        'Vectorization service not initialized. Call initializeVectorization first.'
      );
    }
    yield* this.vectorizationService.vectorizeWithProgress(input, options);
  }

  /**
   * Query with detailed progress tracking (AsyncGenerator)
   */
  async *queryWithProgress(
    input: string | File | ArrayBuffer,
    options: QueryVectorizeOptions = {}
  ): AsyncGenerator<
    VectorizationProgressEventData,
    { ids: string[]; scores: number[] }
  > {
    if (!this.vectorizationService) {
      throw new ValidationError(
        'Vectorization service not initialized. Call initializeVectorization first.'
      );
    }
    yield* this.vectorizationService.queryWithProgress(input, options);
  }

  /**
   * Cleanup and dispose
   */
  async dispose(): Promise<void> {
    if (this.vectorizationService) {
      await this.vectorizationService.close();
    }
    await this.modelManager.clearAll();
    this.eventEmitter.removeAllListeners();
  }
}

/**
 * Helper function to create AIProvider
 */
export function createAIProvider(config: AIProviderConfig = {}): AIProvider {
  return new AIProvider(config);
}
