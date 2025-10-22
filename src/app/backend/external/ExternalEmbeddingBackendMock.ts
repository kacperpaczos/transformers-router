/**
 * External Embedding Backend Mock for testing and hybrid scenarios
 */

import type { VectorModality } from '../../../core/types';
import type { EmbeddingResult } from '../../vectorization/adapters/EmbeddingAdapter';

export interface MockConfig {
  enabled: boolean;
  latencyMs?: number;
  errorRate?: number; // 0-1
  baseEmbeddingSize?: number;
}

export interface EmbeddingRequest {
  id: string;
  data: File | string;
  modality: VectorModality;
  metadata?: Record<string, unknown>;
}

export interface EmbeddingResponse {
  id: string;
  vector: number[];
  modality: VectorModality;
  processingTimeMs: number;
  metadata?: Record<string, unknown>;
}

export interface QueryRequest {
  query: string | Float32Array;
  modality?: VectorModality;
  k?: number;
  filter?: Record<string, unknown>;
}

export interface QueryResponse {
  results: Array<{
    id: string;
    score: number;
    metadata: Record<string, unknown>;
  }>;
  processingTimeMs: number;
}

export class ExternalEmbeddingBackendMock {
  private config: MockConfig;
  private requestCount = 0;
  private storedEmbeddings: Map<string, EmbeddingResponse> = new Map();

  constructor(config: MockConfig) {
    this.config = {
      baseEmbeddingSize: 512,
      ...config,
    };
  }

  /**
   * Process embedding request with simulated latency and errors
   */
  async processEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (!this.config.enabled) {
      throw new Error('Mock backend is disabled');
    }

    // Simulate random errors
    if (this.config.errorRate && Math.random() < this.config.errorRate) {
      throw new Error('Mock backend error: simulated failure');
    }

    // Simulate latency
    if (this.config.latencyMs) {
      await this.delay(this.config.latencyMs);
    }

    const processingTime = this.config.latencyMs || Math.random() * 1000 + 100;

    // Generate deterministic embedding based on content
    const vector = this.generateEmbedding(request);

    const response: EmbeddingResponse = {
      id: request.id,
      vector,
      modality: request.modality,
      processingTimeMs: processingTime,
      metadata: request.metadata,
    };

    // Store for later querying
    this.storedEmbeddings.set(request.id, response);

    this.requestCount++;
    return response;
  }

  /**
   * Query embeddings with similarity search
   */
  async queryEmbeddings(request: QueryRequest): Promise<QueryResponse> {
    if (!this.config.enabled) {
      throw new Error('Mock backend is disabled');
    }

    // Simulate random errors
    if (this.config.errorRate && Math.random() < this.config.errorRate) {
      throw new Error('Mock backend error: simulated failure');
    }

    // Simulate latency
    if (this.config.latencyMs) {
      await this.delay(this.config.latencyMs);
    }

    const processingTime = this.config.latencyMs || Math.random() * 500 + 50;
    const queryVector = this.generateQueryVector(request);

    // Simple similarity search (brute force)
    const results = Array.from(this.storedEmbeddings.values())
      .filter(embedding => {
        // Apply modality filter
        if (request.modality && embedding.modality !== request.modality) {
          return false;
        }
        // Apply metadata filters
        if (request.filter) {
          for (const [key, value] of Object.entries(request.filter)) {
            if (embedding.metadata?.[key] !== value) {
              return false;
            }
          }
        }
        return true;
      })
      .map(embedding => ({
        id: embedding.id,
        score: this.cosineSimilarity(queryVector, new Float32Array(embedding.vector)),
        metadata: {
          id: embedding.id,
          modality: embedding.modality,
          metadata: embedding.metadata || {},
        },
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, request.k || 10);

    this.requestCount++;
    return {
      results,
      processingTimeMs: processingTime,
    };
  }

  /**
   * Get statistics about mock usage
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      storedEmbeddings: this.storedEmbeddings.size,
      config: this.config,
    };
  }

  /**
   * Clear all stored embeddings
   */
  clear(): void {
    this.storedEmbeddings.clear();
    this.requestCount = 0;
  }

  private generateEmbedding(request: EmbeddingRequest): number[] {
    // Generate deterministic but varied embeddings based on content
    const seed = this.hashString(request.id + request.modality);

    // Use base embedding size or default
    const size = this.config.baseEmbeddingSize || 512;
    const vector = new Array(size);

    // Simple pseudo-random generation with deterministic seed
    let hash = seed;
    for (let i = 0; i < size; i++) {
      hash = ((hash * 9301 + 49297) % 233280) / 233280; // Simple LCG
      vector[i] = (hash - 0.5) * 2; // Scale to [-1, 1]
    }

    return vector;
  }

  private generateQueryVector(request: QueryRequest): Float32Array {
    if (typeof request.query === 'string') {
      // Generate embedding from text query
      const seed = this.hashString(request.query + (request.modality || ''));
      const size = this.config.baseEmbeddingSize || 512;
      const vector = new Array(size);

      let hash = seed;
      for (let i = 0; i < size; i++) {
        hash = ((hash * 9301 + 49297) % 233280) / 233280;
        vector[i] = (hash - 0.5) * 2;
      }

      return new Float32Array(vector);
    } else {
      // Use provided vector directly
      return request.query;
    }
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private hashString(str: string): number {
    // Simple hash function for deterministic pseudo-random generation
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
