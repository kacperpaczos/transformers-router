/**
 * Vectorization Service - main facade for multimedia embeddings
 */

import type {
  VectorModality,
  VectorizationServiceConfig,
  VectorDocMeta,
  QueryOptions,
  ResourceUsageSnapshot,
  VectorizeOptions,
  QueryVectorizeOptions,
  ProgressEventData,
  VectorizationProgressEventData,
  ChunkingOptions,
} from '../../core/types';
import { LocalVectorStoreIndexedDB } from '../../infra/vectorstore/LocalVectorStoreIndexedDB';
import { LocalResourceUsageEstimator } from '../../infra/resource/LocalResourceUsageEstimator';
import { AudioEmbeddingAdapter } from './adapters/AudioEmbeddingAdapter';
import { ImageEmbeddingAdapter } from './adapters/ImageEmbeddingAdapter';
import { VideoAsAudioAdapter } from './adapters/VideoAsAudioAdapter';
import { ExternalEmbeddingBackendMock } from '../backend/external/ExternalEmbeddingBackendMock';
import type { VectorStore } from '../../infra/vectorstore/VectorStore';
import type { ResourceUsageEstimator } from '../../infra/resource/ResourceUsageEstimator';
import type { EmbeddingAdapter } from './adapters/EmbeddingAdapter';
import { ProgressTracker } from '../../utils/ProgressTracker';

export interface VectorizationResult {
  indexed: string[];
  failed: string[];
}

export interface QueryResult {
  ids: string[];
  scores: number[];
  metadata?: VectorDocMeta[];
}

export class VectorizationService {
  private config: VectorizationServiceConfig;
  private initialized = false;
  private vectorStore: VectorStore;
  private resourceEstimator: ResourceUsageEstimator;
  private adapters: Map<VectorModality, EmbeddingAdapter> = new Map();
  private externalMock?: ExternalEmbeddingBackendMock;
  private eventListeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private progressTracker: ProgressTracker;

  constructor(config: VectorizationServiceConfig) {
    this.config = config;
    this.vectorStore = new LocalVectorStoreIndexedDB();
    this.resourceEstimator = new LocalResourceUsageEstimator(
      config.quotaThresholds || { warn: 0.7, high: 0.85, critical: 0.95 }
    );
    this.progressTracker = new ProgressTracker();

    // Setup external mock if enabled
    if (config.externalMock?.enabled) {
      this.externalMock = new ExternalEmbeddingBackendMock(config.externalMock);
    }
  }

  /**
   * Initialize the service and all dependencies
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize vector store
      await this.vectorStore.initialize();

      // Initialize resource estimator
      await this.resourceEstimator.initialize();

      // Initialize adapters
      await this.initializeAdapters();

      // Setup event forwarding
      this.setupEventForwarding();

      this.initialized = true;
    } catch (error) {
      this.resourceEstimator.emit('vector:error', {
        stage: 'preprocess',
        error: `Initialization failed: ${error}`,
      });
      throw error;
    }
  }

  /**
   * Vectorize input with detailed progress tracking
   */
  async *vectorizeWithProgress(
    input: File | string | ArrayBuffer,
    options: VectorizeOptions = {}
  ): AsyncGenerator<VectorizationProgressEventData, VectorizationResult> {
    await this.ensureInitialized();

    const modality = options.modality || this.detectModalityFromInput(input);
    const stageWeights = this.progressTracker.getStageWeights(modality);
    const jobId = this.progressTracker.createJob(input, options, stageWeights);

    // Setup progress forwarding
    const unsubscribe = this.progressTracker.on('stage:progress', event => {
      this.emit('vectorization:progress', event);
    });

    try {
      // Check signal for cancellation
      if (options.signal?.aborted) {
        this.progressTracker.cancelJob(jobId);
        throw new Error('Operation cancelled');
      }

      // Stage 1: Initializing
      this.progressTracker.startStage(jobId, 'initializing');
      yield this.getProgressEvent(jobId, 'initializing', 0.1);

      // Initialize adapter if needed
      const adapter = this.getAdapter(modality);
      if (adapter) {
        await adapter.initialize();
      }

      this.progressTracker.completeStage(jobId);
      yield this.getProgressEvent(jobId, 'initializing', 1);

      // Stage 2: Extracting
      this.progressTracker.startStage(jobId, 'extracting');
      yield this.getProgressEvent(jobId, 'extracting', 0.1);

      let extractedContent: string | ArrayBuffer;
      let extractedMetadata: Record<string, unknown> = {};

      if (typeof input === 'string' && input.startsWith('http')) {
        extractedContent = await this.extractFromUrl(input);
        extractedMetadata = { url: input };
      } else if (input instanceof File) {
        extractedContent = await this.extractFromFile(input, modality);
        extractedMetadata = { fileName: input.name, sizeBytes: input.size };
      } else {
        extractedContent = input;
      }

      this.progressTracker.completeStage(jobId);
      yield this.getProgressEvent(jobId, 'extracting', 1);

      // Stage 3: Sanitizing (for text content)
      if (typeof extractedContent === 'string') {
        this.progressTracker.startStage(jobId, 'sanitizing');
        yield this.getProgressEvent(jobId, 'sanitizing', 0.5);

        extractedContent = this.sanitizeText(extractedContent);

        this.progressTracker.completeStage(jobId);
        yield this.getProgressEvent(jobId, 'sanitizing', 1);
      }

      // Stage 4: Chunking
      this.progressTracker.startStage(jobId, 'chunking');
      yield this.getProgressEvent(jobId, 'chunking', 0.1);

      const chunks = await this.chunkContent(
        extractedContent,
        options.chunking,
        modality
      );
      this.progressTracker.updateProgress(jobId, 0.5, {
        chunksTotal: chunks.length,
      });

      this.progressTracker.completeStage(jobId);
      yield this.getProgressEvent(jobId, 'chunking', 1);

      // Stage 5: Embedding
      this.progressTracker.startStage(jobId, 'embedding');
      yield this.getProgressEvent(jobId, 'embedding', 0.1);

      const embeddings = await this.embedChunks(chunks, modality, jobId);
      this.progressTracker.updateProgress(jobId, 0.5, {
        itemsProcessed: embeddings.length,
      });

      this.progressTracker.completeStage(jobId);
      yield this.getProgressEvent(jobId, 'embedding', 1);

      // Stage 6: Upserting
      this.progressTracker.startStage(jobId, 'upserting');
      yield this.getProgressEvent(jobId, 'upserting', 0.1);

      const result = await this.upsertEmbeddings(
        embeddings,
        modality,
        input,
        extractedMetadata,
        jobId
      );
      this.progressTracker.updateProgress(jobId, 0.5, {
        itemsProcessed: result.indexed.length,
        partialResult: { indexedIds: result.indexed },
      });

      this.progressTracker.completeStage(jobId);
      yield this.getProgressEvent(jobId, 'upserting', 1);

      // Stage 7: Finalizing
      this.progressTracker.startStage(jobId, 'finalizing');
      yield this.getProgressEvent(jobId, 'finalizing', 0.5);

      this.progressTracker.completeJob(jobId, result);
      yield this.getProgressEvent(jobId, 'finalizing', 1);

      return result;
    } catch (error) {
      this.progressTracker.completeWithError(
        jobId,
        'embedding',
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    } finally {
      unsubscribe();
    }
  }

  /**
   * Query with progress tracking
   */
  async *queryWithProgress(
    input: string | File | ArrayBuffer,
    options: QueryVectorizeOptions = {}
  ): AsyncGenerator<VectorizationProgressEventData, QueryResult> {
    await this.ensureInitialized();

    const modality = options.modality || this.detectModalityFromInput(input);
    const jobId = this.progressTracker.createJob(input, options, {
      queued: 0,
      initializing: 10,
      extracting: 20,
      embedding: 50,
      upserting: 18,
      finalizing: 2,
    });

    const unsubscribe = this.progressTracker.on('stage:progress', event => {
      this.emit('vectorization:progress', event);
    });

    try {
      // Stage 1: Initializing
      this.progressTracker.startStage(jobId, 'initializing');
      yield this.getProgressEvent(jobId, 'initializing', 1);
      this.progressTracker.completeStage(jobId);

      // Stage 2: Extracting (if file input)
      if (input instanceof File || input instanceof ArrayBuffer) {
        this.progressTracker.startStage(jobId, 'extracting');
        yield this.getProgressEvent(jobId, 'extracting', 1);
        this.progressTracker.completeStage(jobId);
      }

      // Stage 3: Embedding query
      this.progressTracker.startStage(jobId, 'embedding');
      yield this.getProgressEvent(jobId, 'embedding', 0.5);

      let queryVector: Float32Array;
      if (typeof input === 'string') {
        queryVector = await this.embedText(input, modality);
      } else {
        queryVector = await this.embedFile(input, modality);
      }

      this.progressTracker.updateProgress(jobId, 1, { itemsProcessed: 1 });
      this.progressTracker.completeStage(jobId);
      yield this.getProgressEvent(jobId, 'embedding', 1);

      // Stage 4: Searching
      this.progressTracker.startStage(jobId, 'upserting'); // Using upserting as search stage
      yield this.getProgressEvent(jobId, 'upserting', 0.5);

      const results = await this.vectorStore.query(queryVector, options);

      this.progressTracker.updateProgress(jobId, 1, {
        itemsProcessed: results.length,
      });
      this.progressTracker.completeStage(jobId);
      yield this.getProgressEvent(jobId, 'upserting', 1);

      // Stage 5: Finalizing
      this.progressTracker.startStage(jobId, 'finalizing');
      yield this.getProgressEvent(jobId, 'finalizing', 1);

      const result: QueryResult = {
        ids: results.map(r => r.id),
        scores: results.map(r => r.score),
        metadata: results.map(r => r.metadata),
      };

      this.progressTracker.completeJob(jobId);
      yield this.getProgressEvent(jobId, 'finalizing', 1);

      return result;
    } catch (error) {
      this.progressTracker.completeWithError(
        jobId,
        'embedding',
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    } finally {
      unsubscribe();
    }
  }

  /**
   * Index files and extract embeddings
   */
  async indexFiles(
    files: File[],
    meta?: Partial<VectorDocMeta>
  ): Promise<VectorizationResult> {
    await this.ensureInitialized();

    const result: VectorizationResult = {
      indexed: [],
      failed: [],
    };

    const endMeasurement = this.resourceEstimator.startMeasurement('indexing');

    try {
      for (const file of files) {
        try {
          const fileMeta: VectorDocMeta = {
            id: this.generateId(),
            modality: this.detectModality(file),
            mime: file.type,
            sizeBytes: file.size,
            createdAt: Date.now(),
            ...meta,
          };

          // Process file through appropriate adapter
          const adapter = this.getAdapter(fileMeta.modality);
          if (!adapter) {
            throw new Error(
              `No adapter available for modality: ${fileMeta.modality}`
            );
          }

          // Use external mock if enabled, otherwise local adapter
          let embeddingResult;
          if (this.externalMock) {
            const request = {
              id: fileMeta.id,
              data: file,
              modality: fileMeta.modality,
              metadata: fileMeta,
            };
            const response = await this.externalMock.processEmbedding(request);
            embeddingResult = {
              vector: new Float32Array(response.vector),
              metadata: {
                modality: response.modality,
                processingTimeMs: response.processingTimeMs,
              },
            };
          } else {
            embeddingResult = await adapter.process(file);
          }

          // Store in vector store
          await this.vectorStore.upsert([
            {
              id: fileMeta.id,
              vector: embeddingResult.vector,
              metadata: fileMeta,
            },
          ]);

          result.indexed.push(file.name);

          // Emit events
          this.emit('vector:indexed', {
            count: 1,
            modality: fileMeta.modality,
          });
        } catch (error) {
          result.failed.push(file.name);
          this.emit('vector:error', {
            stage: 'embed',
            error: `Failed to process ${file.name}: ${error}`,
            metadata: { fileName: file.name },
          });
        }
      }

      // Get usage snapshot and emit
      const usage = await this.resourceEstimator.getUsageSnapshot();
      this.resourceEstimator.emitResourceUsage(usage);
    } finally {
      endMeasurement();
    }

    return result;
  }

  /**
   * Query for similar vectors
   */
  async query(
    input: string | File,
    modality?: VectorModality,
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    await this.ensureInitialized();

    const endMeasurement = this.resourceEstimator.startMeasurement('querying');

    try {
      let queryVector: Float32Array;
      let queryModality = modality;

      if (typeof input === 'string') {
        // Text query - use appropriate adapter
        if (!queryModality) {
          throw new Error('Modality must be specified for text queries');
        }

        const adapter = this.getAdapter(queryModality);
        if (!adapter) {
          throw new Error(
            `No adapter available for modality: ${queryModality}`
          );
        }

        if (adapter.processText) {
          queryVector = await adapter.processText(input);
        } else {
          throw new Error(
            `Text processing not supported for modality: ${queryModality}`
          );
        }
      } else {
        // File query
        const fileModality = this.detectModality(input);
        queryModality = queryModality || fileModality;

        const adapter = this.getAdapter(queryModality);
        if (!adapter) {
          throw new Error(
            `No adapter available for modality: ${queryModality}`
          );
        }

        const embeddingResult = await adapter.process(input);
        queryVector = embeddingResult.vector;
      }

      // Query vector store
      const results = await this.vectorStore.query(queryVector, options);

      // Emit events
      this.emit('vector:queried', {
        k: options.k || 10,
        modality: queryModality,
      });

      // Get usage snapshot
      const usage = await this.resourceEstimator.getUsageSnapshot();
      this.resourceEstimator.emitResourceUsage(usage);

      return {
        ids: results.map(r => r.id),
        scores: results.map(r => r.score),
        metadata: results.map(r => r.metadata),
      };
    } catch (error) {
      this.emit('vector:error', {
        stage: 'query',
        error: `Query failed: ${error}`,
      });
      throw error;
    } finally {
      endMeasurement();
    }
  }

  /**
   * Delete vectors by IDs
   */
  async delete(ids: string[]): Promise<void> {
    await this.ensureInitialized();

    const endMeasurement = this.resourceEstimator.startMeasurement('deletion');

    try {
      await this.vectorStore.delete(ids);
      this.emit('vector:deleted', { count: ids.length });

      // Get usage snapshot
      const usage = await this.resourceEstimator.getUsageSnapshot();
      this.resourceEstimator.emitResourceUsage(usage);
    } catch (error) {
      this.emit('vector:error', {
        stage: 'store',
        error: `Delete failed: ${error}`,
      });
      throw error;
    } finally {
      endMeasurement();
    }
  }

  /**
   * Get current resource usage snapshot
   */
  async getUsageSnapshot(): Promise<ResourceUsageSnapshot> {
    return await this.resourceEstimator.getUsageSnapshot();
  }

  /**
   * Register event listener
   */
  on<T = unknown>(event: string, handler: (payload: T) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(handler);
        if (listeners.size === 0) {
          this.eventListeners.delete(event);
        }
      }
    };
  }

  /**
   * Close and cleanup resources
   */
  async close(): Promise<void> {
    // Close vector store
    await this.vectorStore.close();

    // Close resource estimator
    await this.resourceEstimator.close();

    // Dispose adapters
    for (const adapter of this.adapters.values()) {
      await adapter.dispose();
    }
    this.adapters.clear();

    // Clear event listeners
    this.eventListeners.clear();

    this.initialized = false;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async initializeAdapters(): Promise<void> {
    // Initialize all adapters
    const adapters = [
      new AudioEmbeddingAdapter(),
      new ImageEmbeddingAdapter(),
      new VideoAsAudioAdapter(),
    ];

    for (const adapter of adapters) {
      await adapter.initialize();
      // Map first supported modality to adapter
      const modalities = adapter.getSupportedModalities();
      for (const modality of modalities) {
        this.adapters.set(modality, adapter);
      }
    }
  }

  private getAdapter(modality: VectorModality): EmbeddingAdapter | undefined {
    return this.adapters.get(modality);
  }

  private detectModality(file: File): VectorModality {
    if (file.type.startsWith('audio/')) {
      return 'audio';
    } else if (file.type.startsWith('image/')) {
      return 'image';
    } else if (file.type.startsWith('video/')) {
      return 'video';
    } else {
      throw new Error(`Unsupported file type: ${file.type}`);
    }
  }

  private generateId(): string {
    return `vec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Helper methods for progress tracking
  private getProgressEvent(
    jobId: string,
    _stage: string,
    _stageProgress: number
  ): ProgressEventData {
    const job = this.progressTracker.getJobStatus(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const inputMeta = this.progressTracker.getInputMeta(job.input);
    const globalProgress = this.progressTracker.calculateGlobalProgress(job);

    return {
      modality: 'embedding',
      model: inputMeta.mime,
      file:
        job.input instanceof File
          ? job.input.name
          : typeof job.input === 'string'
            ? job.input
            : 'buffer',
      progress: globalProgress,
      loaded: Math.floor(globalProgress * 100),
      total: 100,
      status:
        job.status === 'completed'
          ? 'ready'
          : job.status === 'error'
            ? 'error'
            : 'loading',
    };
  }

  private detectModalityFromInput(
    input: File | string | ArrayBuffer
  ): VectorModality {
    if (input instanceof File) {
      return this.detectModality(input);
    } else if (typeof input === 'string') {
      if (input.startsWith('http')) {
        return 'text'; // Assume HTML
      } else {
        return 'text';
      }
    } else {
      return 'text';
    }
  }

  private async extractFromUrl(_url: string): Promise<string> {
    // TODO: Implement URL extraction with Readability
    // This would use fetch + @mozilla/readability + DOMPurify
    throw new Error('URL extraction not implemented yet');
  }

  private async extractFromFile(
    _file: File,
    _modality: VectorModality
  ): Promise<string | ArrayBuffer> {
    // TODO: Implement file extraction based on modality
    // For now, just return the file content as ArrayBuffer
    return await _file.arrayBuffer();
  }

  private sanitizeText(text: string): string {
    // Basic text sanitization - remove extra whitespace, normalize
    return text.replace(/\s+/g, ' ').trim();
  }

  private async chunkContent(
    content: string | ArrayBuffer,
    chunkingOptions?: ChunkingOptions,
    _modality?: VectorModality
  ): Promise<string[]> {
    // TODO: Implement chunking with LangChain TextSplitter
    // For now, simple fixed-size chunks
    if (typeof content === 'string') {
      const chunkSize = chunkingOptions?.chunkSize || 1000;
      const overlap = chunkingOptions?.chunkOverlap || 100;
      const chunks: string[] = [];

      for (let i = 0; i < content.length; i += chunkSize - overlap) {
        chunks.push(content.slice(i, i + chunkSize));
      }

      return chunks;
    } else {
      // For binary content, return as single chunk
      return ['binary_data'];
    }
  }

  private async embedChunks(
    chunks: string[],
    _modality: VectorModality,
    jobId: string
  ): Promise<Float32Array[]> {
    // TODO: Implement embedding with Transformers.js adapters
    const embeddings: Float32Array[] = [];

    for (let i = 0; i < chunks.length; i++) {
      // Update progress for each chunk
      this.progressTracker.updateProgress(jobId, (i + 1) / chunks.length, {
        itemsProcessed: i + 1,
        message: `Embedding chunk ${i + 1}/${chunks.length}`,
      });

      // For now, return dummy embeddings
      const dummyEmbedding = new Float32Array(384); // 384 dimensions for MiniLM
      dummyEmbedding.fill((0.1 * (i + 1)) / chunks.length);
      embeddings.push(dummyEmbedding);
    }

    return embeddings;
  }

  private async embedText(
    _text: string,
    _modality: VectorModality
  ): Promise<Float32Array> {
    // TODO: Implement text embedding
    const embedding = new Float32Array(384);
    embedding.fill(0.5);
    return embedding;
  }

  private async embedFile(
    _file: File | ArrayBuffer,
    _modality: VectorModality
  ): Promise<Float32Array> {
    // TODO: Implement file embedding
    const embedding = new Float32Array(384);
    embedding.fill(0.7);
    return embedding;
  }

  private async upsertEmbeddings(
    embeddings: Float32Array[],
    _modality: VectorModality,
    input: File | string | ArrayBuffer,
    _metadata: Record<string, unknown>,
    jobId: string
  ): Promise<VectorizationResult> {
    const result: VectorizationResult = { indexed: [], failed: [] };

    for (let i = 0; i < embeddings.length; i++) {
      this.progressTracker.updateProgress(jobId, (i + 1) / embeddings.length, {
        itemsProcessed: i + 1,
        message: `Upserting chunk ${i + 1}/${embeddings.length}`,
      });

      const docId = this.generateId();
      const docMeta: VectorDocMeta = {
        id: docId,
        modality: _modality,
        mime: this.getMimeFromInput(input),
        sizeBytes: this.getSizeFromInput(input),
        createdAt: Date.now(),
        ..._metadata,
      };

      try {
        await this.vectorStore.upsert([
          {
            id: docId,
            vector: embeddings[i],
            metadata: docMeta,
          },
        ]);

        result.indexed.push(docId);
      } catch {
        result.failed.push(`chunk_${i}`);
      }
    }

    return result;
  }

  private getMimeFromInput(input: File | string | ArrayBuffer): string {
    if (input instanceof File) {
      return input.type;
    } else if (typeof input === 'string') {
      return input.startsWith('http') ? 'text/html' : 'text/plain';
    } else {
      return 'application/octet-stream';
    }
  }

  private getSizeFromInput(input: File | string | ArrayBuffer): number {
    if (input instanceof File) {
      return input.size;
    } else if (typeof input === 'string') {
      return input.length;
    } else {
      return input.byteLength;
    }
  }

  private setupEventForwarding(): void {
    // Forward resource estimator events
    this.resourceEstimator.on('resource:usage', data => {
      this.emit('resource:usage', data);
    });

    this.resourceEstimator.on('resource:quota-warning', data => {
      this.emit('resource:quota-warning', data);
    });

    this.resourceEstimator.on('vector:error', data => {
      this.emit('vector:error', data);
    });

    this.resourceEstimator.on('vector:indexed', data => {
      this.emit('vector:indexed', data);
    });

    this.resourceEstimator.on('vector:queried', data => {
      this.emit('vector:queried', data);
    });

    this.resourceEstimator.on('vector:deleted', data => {
      this.emit('vector:deleted', data);
    });

    // Forward progress tracker events
    this.progressTracker.on('stage:progress', data => {
      this.emit('vectorization:progress', data);
    });

    this.progressTracker.on('stage:start', data => {
      this.emit('vectorization:stage:start', data);
    });

    this.progressTracker.on('stage:end', data => {
      this.emit('vectorization:stage:end', data);
    });

    this.progressTracker.on('warning', data => {
      this.emit('vectorization:warning', data);
    });

    this.progressTracker.on('error', data => {
      this.emit('vectorization:error', data);
    });
  }

  private emit(event: string, data: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }
}
