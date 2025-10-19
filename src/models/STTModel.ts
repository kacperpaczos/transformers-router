/**
 * STT Model for speech-to-text transcription (Whisper)
 */

import type { STTConfig, STTOptions } from '../core/types';
import { BaseModel } from './BaseModel';
import { audioConverter, type AudioInput } from '../utils/AudioConverter';
import { getConfig } from '../app/state';
import { ModelLoadError, InferenceError } from '@domain/errors';

// Dynamically import Transformers.js
let transformersModule: typeof import('@huggingface/transformers') | null = null;

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
      const { pipeline, env } = await getTransformers();

      const desiredDevice = (this.config.device as string | undefined) || 'webgpu';
      const tryOrder = desiredDevice === 'webgpu'
        ? ['webgpu', 'wasm', 'cpu']
        : [desiredDevice, ...(desiredDevice !== 'wasm' ? ['wasm'] : []), 'cpu'];

      const dtype = this.config.dtype || 'q8';

      let lastError: Error | null = null;
      for (const dev of tryOrder) {
        try {
          if (dev === 'wasm' && env?.backends?.onnx?.wasm) {
            try {
              env.backends.onnx.wasm.simd = true;
              const cores = (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 2) || 2;
              env.backends.onnx.wasm.numThreads = Math.min(4, Math.max(1, cores - 1));
            } catch {
              /* ignore WASM tuning errors */
            }
          }

          const pipelineDevice = dev === 'wasm' ? 'cpu' : (dev as 'cpu' | 'gpu' | 'webgpu');
          const logger = getConfig().logger;
          logger.debug('[transformers-router] load STT try', { device: dev, dtype });
          this.pipeline = await pipeline(
            'automatic-speech-recognition',
            this.config.model,
            {
              dtype,
              device: pipelineDevice,
              progress_callback: progressCallback,
            }
          );

          this.loaded = true;
          lastError = null;
          break;
        } catch (err) {
          const logger = getConfig().logger;
          logger.debug('[transformers-router] load STT fallback', { from: dev, error: (err as Error)?.message });
          lastError = err instanceof Error ? err : new Error(String(err));
        }
      }

      if (!this.loaded) {
        throw lastError || new ModelLoadError('Unknown error during STT model load', this.config.model, 'stt');
      }
    } catch (error) {
      this.loaded = false;
      throw new ModelLoadError(
        `Failed to load STT model ${this.config.model}: ${(error as Error).message}`,
        this.config.model,
        'stt',
        error as Error
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
      throw new InferenceError(`STT transcription failed: ${(error as Error).message}`, 'stt', error as Error);
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

