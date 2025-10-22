/**
 * Base interface for embedding adapters
 */

import type { VectorModality } from '../../../core/types';

export interface EmbeddingResult {
  vector: Float32Array;
  metadata: {
    modality: VectorModality;
    originalSize?: number;
    processedSize?: number;
    processingTimeMs: number;
  };
}

export interface EmbeddingAdapter {
  /**
   * Check if adapter can handle the given file
   */
  canHandle(file: File): boolean;

  /**
   * Get supported modalities
   */
  getSupportedModalities(): VectorModality[];

  /**
   * Initialize the adapter (load models, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Process file and extract embedding
   */
  process(file: File): Promise<EmbeddingResult>;

  /**
   * Process text query for similarity search
   */
  processText?(text: string): Promise<Float32Array>;

  /**
   * Cleanup resources
   */
  dispose(): Promise<void>;
}
