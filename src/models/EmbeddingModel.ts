/**
 * Embedding Model for text embeddings (for RAG, semantic search)
 */

import type { EmbeddingConfig, EmbeddingOptions } from '../core/types';
import { BaseModel } from './BaseModel';

// Dynamically import Transformers.js
let transformersModule: typeof import('@huggingface/transformers') | null = null;

async function getTransformers() {
  if (!transformersModule) {
    transformersModule = await import('@huggingface/transformers');
  }
  return transformersModule;
}

export class EmbeddingModel extends BaseModel<EmbeddingConfig> {
  constructor(config: EmbeddingConfig) {
    super('embedding', config);
  }

  /**
   * Load the embedding model
   */
  async load(progressCallback?: (progress: {
    status: string;
    file?: string;
    progress?: number;
    loaded?: number;
    total?: number;
  }) => void): Promise<void> {
    if (this.loaded) {
      return;
    }

    if (this.loading) {
      while (this.loading) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }

    this.loading = true;

    try {
      const { pipeline } = await getTransformers();

      this.pipeline = await pipeline('feature-extraction', this.config.model, {
        dtype: this.config.dtype || 'fp32',
        device: this.config.device || 'cpu',
        progress_callback: progressCallback,
      });

      this.loaded = true;
    } catch (error) {
      this.loaded = false;
      throw new Error(
        `Failed to load Embedding model ${this.config.model}: ${(error as Error).message}`
      );
    } finally {
      this.loading = false;
    }
  }

  /**
   * Generate embeddings for text(s)
   */
  async embed(
    text: string | string[],
    options: EmbeddingOptions = {}
  ): Promise<number[][]> {
    await this.ensureLoaded();

    const pipeline = this.getPipeline() as (
      input: string | string[],
      opts?: unknown
    ) => Promise<{ tolist: () => number[][] }>;

    try {
      const embeddingOptions = {
        pooling: options.pooling || this.config.pooling || 'mean',
        normalize: options.normalize ?? this.config.normalize ?? true,
      };

      const result = await pipeline(text, embeddingOptions);

      // Convert to array if needed
      const embeddings = result.tolist ? result.tolist() : (result as unknown as number[][]);

      return embeddings;
    } catch (error) {
      throw new Error(`Embedding generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Find most similar text from a list
   */
  async findMostSimilar(
    query: string,
    texts: string[],
    options: EmbeddingOptions = {}
  ): Promise<{ text: string; similarity: number; index: number }> {
    const allTexts = [query, ...texts];
    const embeddings = await this.embed(allTexts, options);

    const queryEmbedding = embeddings[0];
    let maxSimilarity = -1;
    let maxIndex = -1;

    for (let i = 1; i < embeddings.length; i++) {
      const similarity = this.cosineSimilarity(queryEmbedding, embeddings[i]);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        maxIndex = i - 1;
      }
    }

    return {
      text: texts[maxIndex],
      similarity: maxSimilarity,
      index: maxIndex,
    };
  }
}

