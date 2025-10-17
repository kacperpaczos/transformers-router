/**
 * TTS Model for text-to-speech synthesis
 */

import type { TTSConfig, TTSOptions } from '../core/types';
import { BaseModel } from './BaseModel';
import { audioConverter } from '../utils/AudioConverter';

// Dynamically import Transformers.js
let transformersModule: typeof import('@huggingface/transformers') | null = null;

async function getTransformers() {
  if (!transformersModule) {
    transformersModule = await import('@huggingface/transformers');
  }
  return transformersModule;
}

export class TTSModel extends BaseModel<TTSConfig> {
  constructor(config: TTSConfig) {
    super('tts', config);
  }

  /**
   * Load the TTS model
   */
  async load(progressCallback?: (progress: {
    status: string;
    file?: string;
    progress?: number;
    loaded?: number;
    total?: number;
  }) => void): Promise<void> {
    if (this.loaded) {
      if (typeof console !== 'undefined' && console.log) {
        console.log('[TTSModel] load(): early-return, already loaded');
      }
      return;
    }

    if (this.loading) {
      if (typeof console !== 'undefined' && console.log) {
        console.log('[TTSModel] load(): waiting for concurrent load');
      }
      while (this.loading) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (typeof console !== 'undefined' && console.log) {
        console.log('[TTSModel] load(): concurrent load finished');
      }
      return;
    }

    this.loading = true;

    try {
      const { pipeline, env } = await getTransformers();
      if (typeof console !== 'undefined' && console.log) {
        console.log('[TTSModel] load(): transformers loaded');
      }

      const isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined';
      const supportsWebGPU = isBrowser && typeof (navigator as unknown as { gpu?: unknown }).gpu !== 'undefined';
      let webgpuAdapterAvailable = false;
      if (supportsWebGPU) {
        try {
          const navWithGpu = navigator as unknown as { gpu?: { requestAdapter?: () => Promise<unknown> } };
          const adapter = await (navWithGpu.gpu?.requestAdapter?.() || Promise.resolve(null));
          webgpuAdapterAvailable = !!adapter;
        } catch {
          webgpuAdapterAvailable = false;
        }
      }

      const desiredDevice = (this.config.device as string | undefined) || (isBrowser ? (webgpuAdapterAvailable ? 'webgpu' : 'wasm') : 'cpu');
      const tryOrder = (() => {
        if (isBrowser) {
          if (desiredDevice === 'webgpu') return webgpuAdapterAvailable ? ['webgpu', 'wasm'] : ['wasm'];
          if (desiredDevice === 'wasm') return ['wasm'];
          return ['wasm'];
        }
        return desiredDevice === 'webgpu' ? ['webgpu', 'cpu'] : [desiredDevice, ...(desiredDevice !== 'cpu' ? ['cpu'] : [])];
      })();

      if (typeof console !== 'undefined' && console.log) {
        console.log('[TTSModel] load(): env', { isBrowser, supportsWebGPU, webgpuAdapterAvailable, desiredDevice, tryOrder });
      }

      const dtype = this.config.dtype || 'fp32';
      if (typeof console !== 'undefined' && console.log) {
        console.log('[TTSModel] load(): dtype resolved:', dtype);
      }

      let lastError: Error | null = null;
      for (const dev of tryOrder) {
        try {
          if (typeof console !== 'undefined' && console.log) {
            console.log('[TTSModel] attempting device:', dev);
          }

          if (env?.backends?.onnx) {
            const onnxBackends = env.backends.onnx as { backendHint?: string; wasm?: { simd?: boolean; numThreads?: number } };
            if (dev === 'wasm') {
              if ('backendHint' in onnxBackends) onnxBackends.backendHint = 'wasm';
              if (onnxBackends.wasm) {
                onnxBackends.wasm.simd = true;
                const cores = (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 2) || 2;
                onnxBackends.wasm.numThreads = Math.min(4, Math.max(1, cores - 1));
                if (typeof console !== 'undefined' && console.log) {
                  console.log('[TTSModel] WASM config:', { backendHint: onnxBackends.backendHint, simd: onnxBackends.wasm.simd, numThreads: onnxBackends.wasm.numThreads });
                }
              }
            } else if (dev === 'webgpu') {
              if ('backendHint' in onnxBackends) onnxBackends.backendHint = 'webgpu';
              if (typeof console !== 'undefined' && console.log) {
                console.log('[TTSModel] WebGPU config:', { backendHint: onnxBackends.backendHint, adapterAvailable: webgpuAdapterAvailable });
              }
            }
          }

          this.pipeline = await pipeline('text-to-speech', this.config.model, {
            dtype,
            device: dev as unknown as 'webgpu' | 'wasm' | 'gpu' | 'cpu',
            progress_callback: progressCallback,
          });

          this.loaded = true;
          if (typeof console !== 'undefined' && console.log) {
            console.log('[TTSModel] loaded successfully with device:', dev);
          }
          lastError = null;
          break;
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
          if (typeof console !== 'undefined' && console.log) {
            console.log('[TTSModel] device failed:', dev, '| error:', (lastError as Error).message);
          }
        }
      }

      if (!this.loaded) {
        throw lastError || new Error('Unknown error during TTS model load');
      }

      this.loaded = true;
    } catch (error) {
      this.loaded = false;
      throw new Error(
        `Failed to load TTS model ${this.config.model}: ${(error as Error).message}`
      );
    } finally {
      this.loading = false;
    }
  }

  /**
   * Synthesize speech from text
   */
  async synthesize(
    text: string,
    options: TTSOptions = {}
  ): Promise<Blob> {
    await this.ensureLoaded();

    const pipeline = this.getPipeline() as (
      input: string,
      opts?: unknown
    ) => Promise<{
      audio: Float32Array;
      sampling_rate: number;
    }>;

    try {
      // Domyślne speaker embeddings dla SpeechT5, jeśli nie podano
      // (zgodnie z testami integracyjnymi: wektor 512 x 0.5)
      const defaultSpeaker = new Float32Array(512).fill(0.5);
      const speakerEmbeddings =
        (options && typeof options === 'object' && options.speaker !== undefined
          ? options.speaker
          : this.config.speaker) ?? defaultSpeaker;

      const inferOptions = { speaker_embeddings: speakerEmbeddings } as Record<string, unknown>;
      if (typeof console !== 'undefined' && console.log) {
        const speakerType = speakerEmbeddings instanceof Float32Array || speakerEmbeddings instanceof Float64Array
          ? 'typed-array'
          : typeof speakerEmbeddings;
        console.log('[TTSModel] synthesize(): using speaker embeddings type:', speakerType);
      }

      const result = await pipeline(text, inferOptions);

      // Use AudioConverter instead of own implementation
      return audioConverter.toWavBlob(
        result.audio,
        result.sampling_rate,
        { channels: 1, bitDepth: 16 }
      );
    } catch (error) {
      throw new Error(`TTS synthesis failed: ${(error as Error).message}`);
    }
  }

}

