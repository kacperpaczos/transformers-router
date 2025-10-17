/**
 * Audio Converter Utility - handles conversion between audio formats
 * Follows Single Responsibility Principle
 *
 * This utility provides a centralized way to convert audio between different formats,
 * ensuring consistency across all AI models that handle audio data.
 *
 * @author transformers-router
 * @version 1.0.0
 */

import type { Blob as NodeBlob } from 'buffer';

export type AudioInput = Blob | NodeBlob | Float32Array | Float64Array | string;
export type AudioOutput = Float32Array;

export interface AudioMetadata {
  sampleRate: number;
  channels: number;
  duration?: number;
}

/**
 * Converts various audio formats to Float32Array for ML models
 * Uses @huggingface/transformers read_audio for Node.js compatibility
 *
 * @example
 * ```typescript
 * const converter = new AudioConverter();
 * const audioData = await converter.toFloat32Array(blob, 16000);
 * ```
 */
export class AudioConverter {
  private transformersModule:
    | typeof import('@huggingface/transformers')
    | null = null;

  private async getTransformers() {
    if (!this.transformersModule) {
      this.transformersModule = await import('@huggingface/transformers');
    }
    return this.transformersModule;
  }

  /**
   * Convert audio input to Float32Array
   *
   * @param audio - Audio input in various formats (Blob, Float32Array, Float64Array, URL)
   * @param targetSampleRate - Target sample rate (default: 16000 for Whisper)
   * @returns Float32Array audio data ready for ML models
   *
   * @example
   * ```typescript
   * // From Blob
   * const audioData = await converter.toFloat32Array(audioBlob, 16000);
   *
   * // From URL
   * const audioData = await converter.toFloat32Array('https://example.com/audio.wav');
   *
   * // Already Float32Array (passthrough)
   * const audioData = await converter.toFloat32Array(existingFloat32Array);
   * ```
   */
  async toFloat32Array(
    audio: AudioInput,
    targetSampleRate: number = 16000
  ): Promise<AudioOutput> {
    // Already in correct format
    if (audio instanceof Float32Array) {
      return audio;
    }

    // Float64Array - convert to Float32Array
    if (audio instanceof Float64Array) {
      return new Float32Array(audio);
    }

    // String URL - use Transformers.js read_audio
    if (typeof audio === 'string') {
      return this.fromUrl(audio, targetSampleRate);
    }

    // Blob - convert to ArrayBuffer then process
    if (this.isBlob(audio)) {
      return this.fromBlob(audio, targetSampleRate);
    }

    throw new Error(`Unsupported audio input type: ${typeof audio}`);
  }

  /**
   * Convert Blob to Float32Array
   * Uses Transformers.js read_audio for proper decoding
   *
   * @private
   * @param blob - Audio blob (WAV, MP3, etc.)
   * @param sampleRate - Target sample rate
   * @returns Float32Array audio data
   */
  private async fromBlob(
    blob: Blob | NodeBlob,
    sampleRate: number
  ): Promise<Float32Array> {
    const { read_audio } = await this.getTransformers();

    // Convert Blob to ArrayBuffer
    const arrayBuffer = await blob.arrayBuffer();

    // Use Transformers.js read_audio for proper WAV/audio decoding
    // This handles resampling, channel conversion, etc.
    // Note: read_audio expects ArrayBuffer in some versions
    const audioData = await read_audio(arrayBuffer as any, sampleRate);

    return audioData;
  }

  /**
   * Load audio from URL
   *
   * @private
   * @param url - Audio file URL
   * @param sampleRate - Target sample rate
   * @returns Float32Array audio data
   */
  private async fromUrl(
    url: string,
    sampleRate: number
  ): Promise<Float32Array> {
    const { read_audio } = await this.getTransformers();
    return read_audio(url, sampleRate);
  }

  /**
   * Type guard for Blob
   *
   * @private
   * @param input - Unknown input to check
   * @returns true if input is a Blob-like object
   */
  private isBlob(input: unknown): input is Blob {
    return (
      input !== null &&
      typeof input === 'object' &&
      'arrayBuffer' in input &&
      typeof (input as Blob).arrayBuffer === 'function'
    );
  }

  /**
   * Convert Float32Array to WAV Blob
   * Useful for TTS output
   *
   * @param audioData - Float32Array audio data
   * @param sampleRate - Sample rate of audio data
   * @param options - WAV encoding options
   * @returns WAV format Blob
   *
   * @example
   * ```typescript
   * const wavBlob = converter.toWavBlob(audioData, 22050, {
   *   channels: 1,
   *   bitDepth: 16
   * });
   * ```
   */
  toWavBlob(
    audioData: Float32Array,
    sampleRate: number,
    options: { channels?: number; bitDepth?: 16 | 32 } = {}
  ): Blob {
    const channels = options.channels || 1;
    const bitDepth = options.bitDepth || 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = channels * bytesPerSample;

    const dataLength = audioData.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // WAV header (RIFF)
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    this.writeString(view, 8, 'WAVE');

    // fmt chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // data chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Audio samples
    const volume = bitDepth === 16 ? 0x7fff : 0x7fffffff;
    let offset = 44;

    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      if (bitDepth === 16) {
        view.setInt16(offset, sample * volume, true);
        offset += 2;
      } else {
        view.setInt32(offset, sample * volume, true);
        offset += 4;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Write string to DataView at specified offset
   *
   * @private
   * @param view - DataView to write to
   * @param offset - Offset in bytes
   * @param string - String to write
   */
  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

// Singleton instance for reuse across the application
// This follows the Singleton pattern to ensure consistent behavior
// and avoid multiple instances of the same converter
export const audioConverter = new AudioConverter();
