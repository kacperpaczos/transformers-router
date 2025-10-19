/**
 * STT Model for speech-to-text transcription (Whisper)
 */

import type { STTConfig, STTOptions } from '../core/types';
import { BaseModel } from './BaseModel';
import { audioConverter, type AudioInput } from '../utils/AudioConverter';

// Dynamically import Transformers.js
let transformersModule: typeof import('@huggingface/transformers') | null =
  null;

async function getTransformers() {
  if (!transformersModule) {
    transformersModule = await import('@huggingface/transformers');
  }
  return transformersModule;
}

export class STTModel extends BaseModel<STTConfig> {
  constructor(config: STTConfig) {
    super('stt', config);
  }

  /**
   * Load the STT model
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
      if (typeof console !== 'undefined' && console.log) {
        console.log('[STTModel] load(): early-return, already loaded');
      }
      return;
    }

    if (this.loading) {
      if (typeof console !== 'undefined' && console.log) {
        console.log('[STTModel] load(): waiting for concurrent load');
      }
      while (this.loading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (typeof console !== 'undefined' && console.log) {
        console.log('[STTModel] load(): concurrent load finished');
      }
      return;
    }

    this.loading = true;

    try {
      const { pipeline, env } = await getTransformers();
      if (typeof console !== 'undefined' && console.log) {
        console.log('[STTModel] load(): transformers loaded');
      }

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
        console.log('[STTModel] load(): env', {
          isBrowser,
          supportsWebGPU,
          webgpuAdapterAvailable,
          desiredDevice,
          tryOrder,
        });
      }

      const dtype = this.config.dtype || 'q8';
      if (typeof console !== 'undefined' && console.log) {
        console.log('[STTModel] load(): dtype resolved:', dtype);
      }

      let lastError: Error | null = null;
      for (const dev of tryOrder) {
        try {
          if (typeof console !== 'undefined' && console.log) {
            console.log('[STTModel] attempting device:', dev);
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
                  console.log('[STTModel] WASM config:', {
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
                console.log('[STTModel] WebGPU config:', {
                  backendHint: onnxBackends.backendHint,
                  adapterAvailable: webgpuAdapterAvailable,
                });
              }
            }
          }

          const pipelineDevice = dev === 'wasm' ? 'cpu' : (dev as 'cpu' | 'gpu' | 'webgpu');
          console.log('[transformers-router] load STT try', { device: dev, dtype });
          this.pipeline = await pipeline(
            'automatic-speech-recognition',
            this.config.model,
            {
              dtype,
              device: dev as unknown as 'webgpu' | 'wasm' | 'gpu' | 'cpu',
              progress_callback: progressCallback,
            }
          );

          this.loaded = true;
          if (typeof console !== 'undefined' && console.log) {
            console.log('[STTModel] loaded successfully with device:', dev);
          }
          lastError = null;
          break;
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
          if (typeof console !== 'undefined' && console.log) {
            console.log(
              '[STTModel] device failed:',
              dev,
              '| error:',
              (lastError as Error).message
            );
          }
        }
      }

      if (!this.loaded) {
        throw lastError || new Error('Unknown error during STT model load');
      }
    } catch (error) {
      this.loaded = false;
      throw new Error(
        `Failed to load STT model ${this.config.model}: ${(error as Error).message}`
      );
    } finally {
      this.loading = false;
    }
  }

  /**
   * Transcribe audio to text
   */
  async transcribe(
    audio: AudioInput, // Use AudioConverter type
    options: STTOptions = {}
  ): Promise<string> {
    await this.ensureLoaded();

    const pipeline = this.getPipeline() as (
      input: Float32Array,
      opts?: unknown
    ) => Promise<{ text: string }>;

    try {
      // Convert audio to Float32Array using AudioConverter
      const audioData = await audioConverter.toFloat32Array(audio, 16000);

      const transcriptionOptions: {
        language?: string;
        task?: string;
        return_timestamps?: boolean;
      } = {};

      if (options.language) {
        transcriptionOptions.language = options.language;
      }

      if (options.task) {
        transcriptionOptions.task = options.task;
      }

      if (options.timestamps) {
        transcriptionOptions.return_timestamps = true;
      }

      const result = await pipeline(audioData, transcriptionOptions);

      return result.text;
    } catch (error) {
      throw new Error(`STT transcription failed: ${(error as Error).message}`);
    }
  }

  /**
   * Transcribe audio from URL
   */
  async transcribeFromUrl(
    url: string,
    options: STTOptions = {}
  ): Promise<string> {
    return this.transcribe(url, options);
  }

  /**
   * Transcribe audio from file
   */
  async transcribeFromFile(
    file: File,
    options: STTOptions = {}
  ): Promise<string> {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    return this.transcribe(blob, options);
  }
}
