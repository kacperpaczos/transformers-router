/**
 * Vectorization Service - main facade for multimedia embeddings
 */

import type {
  VectorModality,
  VectorizationServiceConfig,
  VectorDocMeta,
  QueryOptions,
  ResourceUsageSnapshot,
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

  constructor(config: VectorizationServiceConfig) {
    this.config = config;
    this.vectorStore = new LocalVectorStoreIndexedDB();
    this.resourceEstimator = new LocalResourceUsageEstimator(
      config.quotaThresholds || { warn: 0.7, high: 0.85, critical: 0.95 }
    );

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
