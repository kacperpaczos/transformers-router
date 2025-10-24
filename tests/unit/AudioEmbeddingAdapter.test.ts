import { AudioEmbeddingAdapter } from '../../src/app/vectorization/adapters/AudioEmbeddingAdapter';
import { loadTestFile } from '../fixtures/loadTestFile';

// Mock @huggingface/transformers
jest.mock('@huggingface/transformers', () => ({
  pipeline: jest.fn().mockResolvedValue(
    jest.fn().mockResolvedValue({
      // Mock CLAP pipeline output
      pooled_output: {
        data: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]),
      },
    })
  ),
}));

// Mock Web Audio API
const mockAudioBuffer = {
  getChannelData: jest.fn().mockReturnValue(new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5])),
  numberOfChannels: 1,
  sampleRate: 16000,
  length: 5,
  duration: 0.0003125,
};

global.AudioContext = jest.fn().mockImplementation(() => ({
  decodeAudioData: jest.fn().mockImplementation((arrayBuffer: ArrayBuffer) => {
    // Check if this looks like a valid audio file by checking the first few bytes
    const view = new Uint8Array(arrayBuffer);
    const isValidAudio = view.length > 44 && (
      // Check for RIFF (WAV) header
      (view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46) ||
      // Check for MP3 frame sync
      (view[0] === 0xFF && (view[1] & 0xE0) === 0xE0)
    );

    if (!isValidAudio) {
      return Promise.reject(new Error('Not a valid audio file'));
    }

    return Promise.resolve(mockAudioBuffer);
  }),
  close: jest.fn(),
}));

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

    it('should handle audio files', async () => {
      const audioFile = await loadTestFile('audio/test.mp3');
      expect(adapter.canHandle(audioFile)).toBe(true);
    });

    it('should handle various audio formats', async () => {
      const formats = ['test.wav', 'test.ogg', 'test.mp4', 'test.aac', 'test.flac'];
      for (const filename of formats) {
        const file = await loadTestFile(`audio/${filename}`);
        expect(adapter.canHandle(file)).toBe(true);
      }
    });

    it('should reject non-audio files', async () => {
      const imageFile = await loadTestFile('images/test.jpg');
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
      const audioFile = await loadTestFile('audio/test.wav');

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
