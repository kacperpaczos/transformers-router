/**
 * TTS Model for text-to-speech synthesis
 */

import type { TTSConfig, TTSOptions } from '../core/types';
import { BaseModel } from './BaseModel';
import { audioConverter } from '../utils/AudioConverter';
import { ModelLoadError, InferenceError } from '@domain/errors';

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

      this.pipeline = await pipeline('text-to-speech', this.config.model, {
        dtype: this.config.dtype || 'fp32',
        device: this.config.device || 'cpu',
        progress_callback: progressCallback,
      });

      this.loaded = true;
    } catch (error) {
      this.loaded = false;
      throw new ModelLoadError(
        `Failed to load TTS model ${this.config.model}: ${(error as Error).message}`,
        this.config.model,
        'tts',
        error as Error
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
      // Nie przekazuj speaker_embeddings, jeśli nie zostały podane
      const inferOptions =
        options && typeof options === 'object' && options.speaker !== undefined
          ? { speaker_embeddings: options.speaker }
          : undefined;

      const result = await pipeline(text, inferOptions);

      // Use AudioConverter instead of own implementation
      return audioConverter.toWavBlob(
        result.audio,
        result.sampling_rate,
        { channels: 1, bitDepth: 16 }
      );
    } catch (error) {
      throw new InferenceError(`TTS synthesis failed: ${(error as Error).message}`, 'tts', error as Error);
    }
  }

}

