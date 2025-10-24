/**
 * Video as Audio Embedding Adapter - extracts audio from video files and processes as audio
 */

import type { EmbeddingAdapter, EmbeddingResult } from './EmbeddingAdapter';
import type { VectorModality } from '../../../core/types';
import { AudioEmbeddingAdapter } from './AudioEmbeddingAdapter';

export class VideoAsAudioAdapter implements EmbeddingAdapter {
  private audioAdapter: AudioEmbeddingAdapter;
  private ffmpegLoaded = false;

  constructor() {
    this.audioAdapter = new AudioEmbeddingAdapter();
  }

  getSupportedModalities(): VectorModality[] {
    return ['video'];
  }

  canHandle(file: File): boolean {
    const videoTypes = [
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/wmv',
      'video/flv',
      'video/webm',
      'video/mkv',
    ];
    return videoTypes.some(type => file.type.startsWith(type));
  }

  async initialize(): Promise<void> {
    // Initialize audio adapter first
    await this.audioAdapter.initialize();

    // Load FFmpeg if not already loaded
    if (!this.ffmpegLoaded) {
      await this.loadFFmpeg();
      this.ffmpegLoaded = true;
    }
  }

  async process(file: File): Promise<EmbeddingResult> {
    await this.ensureInitialized();

    try {
      // Extract audio from video using FFmpeg
      const audioData = await this.extractAudioFromVideo(file);

      // Create a temporary audio file-like object
      const audioFile = new File([audioData], 'extracted_audio.wav', {
        type: 'audio/wav',
      });

      // Process through audio adapter
      return await this.audioAdapter.process(audioFile);
    } catch (error) {
      throw new Error(`Video audio extraction failed: ${error}`);
    }
  }

  async processText(text: string): Promise<Float32Array> {
    return await this.audioAdapter.processText(text);
  }

  async dispose(): Promise<void> {
    await this.audioAdapter.dispose();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.ffmpegLoaded) {
      await this.initialize();
    }
  }

  private async loadFFmpeg(): Promise<void> {
    try {
      // Dynamically import FFmpeg.wasm
      const { createFFmpeg, fetchFile } = await import('@ffmpeg/ffmpeg');

      const ffmpeg = createFFmpeg({
        log: false,
        progress: p => {
          if (p.ratio > 0) {
            console.log(`FFmpeg progress: ${Math.round(p.ratio * 100)}%`);
          }
        },
      });

      await ffmpeg.load();

      // Store ffmpeg instance for later use
      (this as any).ffmpeg = ffmpeg;
      (this as any).fetchFile = fetchFile;
    } catch (error) {
      throw new Error(`Failed to load FFmpeg: ${error}`);
    }
  }

  private async extractAudioFromVideo(file: File): Promise<ArrayBuffer> {
    const ffmpeg = (this as any).ffmpeg;
    const fetchFile = (this as any).fetchFile;

    if (!ffmpeg || !fetchFile) {
      throw new Error('FFmpeg not initialized');
    }

    try {
      // Write input file to FFmpeg filesystem
      ffmpeg.FS('writeFile', 'input_video', await fetchFile(file));

      // Extract audio using FFmpeg
      await ffmpeg.run(
        '-i',
        'input_video', // Input file
        '-vn', // No video
        '-acodec',
        'pcm_s16le', // PCM 16-bit little-endian
        '-ar',
        '16000', // Sample rate 16kHz (good for speech)
        '-ac',
        '1', // Mono channel
        'output_audio.wav' // Output file
      );

      // Read the extracted audio
      const data = ffmpeg.FS('readFile', 'output_audio.wav');

      // Clean up files
      ffmpeg.FS('unlink', 'input_video');
      ffmpeg.FS('unlink', 'output_audio.wav');

      return data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      );
    } catch (error) {
      throw new Error(`FFmpeg audio extraction failed: ${error}`);
    }
  }
}
