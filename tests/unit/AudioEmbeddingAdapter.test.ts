import { AudioEmbeddingAdapter } from '../../src/app/vectorization/adapters/AudioEmbeddingAdapter';

describe('AudioEmbeddingAdapter', () => {
  let adapter: AudioEmbeddingAdapter;

  beforeEach(() => {
    adapter = new AudioEmbeddingAdapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  describe('Modality Support', () => {
    it('should support audio modality', () => {
      const modalities = adapter.getSupportedModalities();
      expect(modalities).toContain('audio');
    });

    it('should handle audio files', () => {
      const audioFile = new File(['audio content'], 'test.mp3', {
        type: 'audio/mpeg',
      });
      expect(adapter.canHandle(audioFile)).toBe(true);
    });

    it('should handle various audio formats', () => {
      const formats = ['audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/flac'];
      formats.forEach(format => {
        const file = new File(['content'], `test.${format.split('/')[1]}`, { type: format });
        expect(adapter.canHandle(file)).toBe(true);
      });
    });

    it('should reject non-audio files', () => {
      const imageFile = new File(['image content'], 'test.jpg', {
        type: 'image/jpeg',
      });
      expect(adapter.canHandle(imageFile)).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(adapter.initialize()).resolves.not.toThrow();
    });

    it('should handle multiple initializations', async () => {
      await adapter.initialize();
      await expect(adapter.initialize()).resolves.not.toThrow();
    });

    it('should be initialized after init', async () => {
      await adapter.initialize();
      // Should not throw on subsequent operations
      expect(() => adapter.getSupportedModalities()).not.toThrow();
    });
  });

  describe('Audio Processing', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should process audio file successfully', async () => {
      // Create a mock audio file (WAV format for simplicity)
      const sampleRate = 16000;
      const duration = 1; // 1 second
      const samples = sampleRate * duration;
      const audioData = new Float32Array(samples);

      // Generate simple sine wave
      for (let i = 0; i < samples; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
      }

      // Create WAV file (simplified)
      const wavHeader = new ArrayBuffer(44);
      const view = new DataView(wavHeader);
      // Simplified WAV header creation
      view.setUint32(0, 0x52494646, false); // "RIFF"
      view.setUint32(4, samples * 2 + 36, true); // File size
      view.setUint32(8, 0x57415645, false); // "WAVE"
      view.setUint32(12, 0x666d7420, false); // "fmt "
      view.setUint32(16, 16, true); // Format chunk size
      view.setUint16(20, 1, true); // PCM format
      view.setUint16(22, 1, true); // Mono
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true); // Byte rate
      view.setUint16(32, 2, true); // Block align
      view.setUint16(34, 16, true); // Bits per sample
      view.setUint32(36, 0x64617461, false); // "data"
      view.setUint32(40, samples * 2, true); // Data size

      const audioBuffer = new ArrayBuffer(wavHeader.byteLength + audioData.byteLength * 2);
      const audioView = new Uint8Array(audioBuffer);
      audioView.set(new Uint8Array(wavHeader), 0);

      // Convert Float32 to Int16
      const dataView = new DataView(audioBuffer, wavHeader.byteLength);
      for (let i = 0; i < samples; i++) {
        const sample = Math.max(-1, Math.min(1, audioData[i]));
        dataView.setInt16(i * 2, sample * 32767, true);
      }

      const audioFile = new File([audioBuffer], 'test.wav', { type: 'audio/wav' });

      const result = await adapter.process(audioFile);

      expect(result).toBeDefined();
      expect(result.vector).toBeInstanceOf(Float32Array);
      expect(result.vector.length).toBeGreaterThan(0);
      expect(result.metadata.modality).toBe('audio');
      expect(result.metadata.originalSize).toBe(audioFile.size);
      expect(result.metadata.processingTimeMs).toBeGreaterThan(0);
    });

    it('should throw error for unsupported file format', async () => {
      const textFile = new File(['text content'], 'test.txt', {
        type: 'text/plain',
      });

      await expect(adapter.process(textFile)).rejects.toThrow();
    });

    it('should throw error when not initialized', async () => {
      const uninitializedAdapter = new AudioEmbeddingAdapter();
      const audioFile = new File(['audio'], 'test.wav', { type: 'audio/wav' });

      await expect(uninitializedAdapter.process(audioFile)).rejects.toThrow();
    });
  });

  describe('Text Processing', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should throw error for text processing (not implemented)', async () => {
      await expect(adapter.processText('test text')).rejects.toThrow(
        'Text processing not implemented for audio adapter'
      );
    });
  });

  describe('Cleanup', () => {
    it('should dispose without errors', async () => {
      await adapter.initialize();
      await expect(adapter.dispose()).resolves.not.toThrow();
    });

    it('should handle multiple dispose calls', async () => {
      await adapter.initialize();
      await adapter.dispose();
      await expect(adapter.dispose()).resolves.not.toThrow();
    });

    it('should cleanup pipeline on dispose', async () => {
      await adapter.initialize();
      await adapter.dispose();

      const audioFile = new File(['audio'], 'test.wav', { type: 'audio/wav' });
      await expect(adapter.process(audioFile)).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should handle corrupted audio files', async () => {
      const corruptedFile = new File(['corrupted'], 'test.wav', {
        type: 'audio/wav',
      });

      await expect(adapter.process(corruptedFile)).rejects.toThrow();
    });

    it('should handle empty audio files', async () => {
      const emptyFile = new File([''], 'test.wav', { type: 'audio/wav' });

      await expect(adapter.process(emptyFile)).rejects.toThrow();
    });
  });
});
