/**
 * TTS Model for text-to-speech synthesis
 */

import type { TTSConfig, TTSOptions } from '../core/types';
import { BaseModel } from './BaseModel';

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
      const result = await pipeline(text, {
        speaker_embeddings: options.speaker,
      });

      // Convert Float32Array to WAV blob
      const wavBlob = this.audioToWavBlob(
        result.audio,
        result.sampling_rate,
        options
      );

      return wavBlob;
    } catch (error) {
      throw new Error(`TTS synthesis failed: ${(error as Error).message}`);
    }
  }

  /**
   * Convert audio data to WAV Blob
   */
  private audioToWavBlob(
    audioData: Float32Array,
    sampleRate: number,
    options: TTSOptions
  ): Blob {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;

    const dataLength = audioData.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // WAV header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // PCM format
    view.setUint16(20, 1, true); // Audio format (PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Audio data
    const volume = 0x7fff;
    let offset = 44;
    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      view.setInt16(offset, sample * volume, true);
      offset += 2;
    }

    const mimeType = this.getMimeType(options.format || 'wav');
    return new Blob([buffer], { type: mimeType });
  }

  /**
   * Write string to DataView
   */
  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Get MIME type for audio format
   */
  private getMimeType(format: string): string {
    switch (format) {
      case 'mp3':
        return 'audio/mpeg';
      case 'ogg':
        return 'audio/ogg';
      case 'wav':
      default:
        return 'audio/wav';
    }
  }
}

