/**
 * Embedding Model for text embeddings (for RAG, semantic search)
 */

import type { EmbeddingConfig, EmbeddingOptions } from '../core/types';
import { BaseModel } from './BaseModel';

// Interface for Tensor from Transformers.js
interface Tensor {
  data: Float32Array | number[];
  dims: number[];
  tolist?: () => number[][];
  ort_tensor?: unknown; // ONNX Runtime tensor
}

// Dynamically import Transformers.js
let transformersModule: typeof import('@huggingface/transformers') | null =
  null;

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
  async load(
    progressCallback?: (progress: {
      status: string;
      file?: string;
      progress?: number;
      loaded?: number;
      total?: number;
    }) => void
  ): Promise<void> {
    if (this.loaded) {
      return;
    }

    if (this.loading) {
      while (this.loading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.loading = true;

    try {
      const { pipeline, env } = await getTransformers();

      const isBrowser =
        typeof window !== 'undefined' && typeof navigator !== 'undefined';
      const supportsWebGPU =
        isBrowser &&
        typeof (navigator as unknown as { gpu?: unknown }).gpu !== 'undefined';
      let webgpuAdapterAvailable = false;
      if (supportsWebGPU) {
        try {
          const navWithGpu = navigator as unknown as {
            gpu?: { requestAdapter?: () => Promise<unknown> };
          };
          const adapter = await (navWithGpu.gpu?.requestAdapter?.() ||
            Promise.resolve(null));
          webgpuAdapterAvailable = !!adapter;
        } catch {
          webgpuAdapterAvailable = false;
        }
      }

      const desiredDevice =
        (this.config.device as string | undefined) ||
        (isBrowser ? (webgpuAdapterAvailable ? 'webgpu' : 'wasm') : 'cpu');
      const tryOrder = (() => {
        if (isBrowser) {
          if (desiredDevice === 'webgpu')
            return webgpuAdapterAvailable ? ['webgpu', 'wasm'] : ['wasm'];
          if (desiredDevice === 'wasm') return ['wasm'];
          return ['wasm'];
        }
        return desiredDevice === 'webgpu'
          ? ['webgpu', 'cpu']
          : [desiredDevice, ...(desiredDevice !== 'cpu' ? ['cpu'] : [])];
      })();
      if (typeof console !== 'undefined' && console.log) {
        console.log('[EmbeddingModel] load(): env', {
          isBrowser,
          supportsWebGPU,
          webgpuAdapterAvailable,
          desiredDevice,
          tryOrder,
        });
      }

      const dtype = this.config.dtype || 'fp32';

      let lastError: Error | null = null;
      for (const dev of tryOrder) {
        try {
          if (typeof console !== 'undefined' && console.log) {
            console.log('[EmbeddingModel] attempting device:', dev);
          }
          if (env?.backends?.onnx) {
            const onnxBackends = env.backends.onnx as {
              backendHint?: string;
              wasm?: { simd?: boolean; numThreads?: number };
            };
            if (dev === 'wasm') {
              if ('backendHint' in onnxBackends)
                onnxBackends.backendHint = 'wasm';
              if (onnxBackends.wasm) {
                onnxBackends.wasm.simd = true;
                const cores =
                  (typeof navigator !== 'undefined'
                    ? navigator.hardwareConcurrency
                    : 2) || 2;
                onnxBackends.wasm.numThreads = Math.min(
                  4,
                  Math.max(1, cores - 1)
                );
                if (typeof console !== 'undefined' && console.log) {
                  console.log('[EmbeddingModel] WASM config:', {
                    backendHint: onnxBackends.backendHint,
                    simd: onnxBackends.wasm.simd,
                    numThreads: onnxBackends.wasm.numThreads,
                  });
                }
              }
            } else if (dev === 'webgpu') {
              if ('backendHint' in onnxBackends)
                onnxBackends.backendHint = 'webgpu';
              if (typeof console !== 'undefined' && console.log) {
                console.log('[EmbeddingModel] WebGPU config:', {
                  backendHint: onnxBackends.backendHint,
                  adapterAvailable: webgpuAdapterAvailable,
                });
              }
            }
          }

          this.pipeline = await pipeline(
            'feature-extraction',
            this.config.model,
            {
              dtype,
              device: dev as unknown as 'webgpu' | 'wasm' | 'gpu' | 'cpu',
              progress_callback: progressCallback,
            }
          );

          this.loaded = true;
          if (typeof console !== 'undefined' && console.log) {
            console.log(
              '[EmbeddingModel] loaded successfully with device:',
              dev
            );
          }
          lastError = null;
          break;
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
          if (typeof console !== 'undefined' && console.log) {
            console.log(
              '[EmbeddingModel] device failed:',
              dev,
              '| error:',
              (lastError as Error).message
            );
          }
        }
      }

      if (!this.loaded) {
        throw (
          lastError || new Error('Unknown error during Embedding model load')
        );
      }
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
    ) => Promise<Tensor | number[][]>;

    try {
      const result = await pipeline(text, {
        pooling: options.pooling || this.config.pooling || 'mean',
        normalize: options.normalize ?? this.config.normalize ?? true,
      });

      // Type-safe conversion
      return this.tensorToArray(result);
    } catch (error) {
      throw new Error(
        `Embedding generation failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Convert Tensor to 2D array
   * Handles different tensor formats from Transformers.js
   */
  private tensorToArray(tensor: Tensor | number[][]): number[][] {
    // Already an array
    if (Array.isArray(tensor)) {
      return tensor;
    }

    // Has tolist method
    if (tensor.tolist && typeof tensor.tolist === 'function') {
      return tensor.tolist();
    }

    // Manual conversion from tensor data
    if (tensor.data && tensor.dims) {
      const data = Array.from(tensor.data);
      const [rows, cols] = tensor.dims;

      const result: number[][] = [];
      for (let i = 0; i < rows; i++) {
        result.push(data.slice(i * cols, (i + 1) * cols));
      }
      return result;
    }

    throw new Error('Unsupported tensor format');
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
