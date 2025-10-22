/**
 * Vector Store interface for storing and querying embeddings
 */

import type { VectorDocMeta, QueryOptions } from '../../core/types';

export type { QueryOptions };

export interface VectorDocument {
  id: string;
  vector: Float32Array;
  metadata: VectorDocMeta;
}

export interface VectorQueryResult {
  id: string;
  score: number;
  metadata: VectorDocMeta;
}

export interface VectorStore {
  /**
   * Initialize the vector store
   */
  initialize(): Promise<void>;

  /**
   * Store vectors in the vector store
   */
  upsert(documents: VectorDocument[]): Promise<void>;

  /**
   * Query the vector store for similar vectors
   */
  query(queryVector: Float32Array, options?: QueryOptions): Promise<VectorQueryResult[]>;

  /**
   * Delete vectors from the store
   */
  delete(ids: string[]): Promise<void>;

  /**
   * Get total number of stored vectors
   */
  count(): Promise<number>;

  /**
   * Clear all vectors from the store
   */
  clear(): Promise<void>;

  /**
   * Close the vector store and cleanup resources
   */
  close(): Promise<void>;
}
