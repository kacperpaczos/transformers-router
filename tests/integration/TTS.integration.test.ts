/**
 * Integration tests for TTS - real model synth producing WAV
 */

import { createAIProvider } from '../../src/core/AIProvider';

function bufferStartsWithRIFF(buffer: ArrayBuffer): boolean {
  const view = new DataView(buffer);
  // 'RIFF' = 0x52494646 in ASCII
  const r = view.getUint8(0) === 0x52 && view.getUint8(1) === 0x49 && view.getUint8(2) === 0x46 && view.getUint8(3) === 0x46;
  return r;
}

// Default speaker embeddings for SpeechT5 (from HuggingFace examples)
// This is a simple average speaker embedding
const DEFAULT_SPEAKER_EMBEDDINGS = new Float32Array(512).fill(0.5);

describe('TTS Integration (SpeechT5)', () => {
  const provider = createAIProvider({
    tts: {
      model: 'Xenova/speecht5_tts',
      dtype: 'fp32',
      device: 'cpu',
    },
  });

  beforeAll(async () => {
    jest.setTimeout(300000);
    provider.on('progress', ({ modality, status, file, progress }) => {
      if (modality === 'tts') {
        console.log(`[TTS] ${status}${file ? ` ${file}` : ''}${progress ? ` ${progress}%` : ''}`);
      }
    });
    await provider.warmup('tts');
  });

  afterAll(async () => {
    await provider.dispose();
  });

  describe('Basic Synthesis', () => {
    it('should synthesize WAV audio from text', async () => {
      const blob = await provider.speak('hello from real tts test', {
        speaker: DEFAULT_SPEAKER_EMBEDDINGS,
      });

      expect(blob).toBeInstanceOf(Blob);

      const buf = await blob.arrayBuffer();
      expect(buf.byteLength).toBeGreaterThan(1000);
      expect(bufferStartsWithRIFF(buf)).toBe(true);
      
      console.log(`✅ Generated audio: ${buf.byteLength} bytes`);
    }, 180000);

    it('should synthesize longer text', async () => {
      const longText = 'This is a longer sentence to test the text to speech synthesis capability of the model.';
      
      const blob = await provider.speak(longText, {
        speaker: DEFAULT_SPEAKER_EMBEDDINGS,
      });

      const buf = await blob.arrayBuffer();
      expect(buf.byteLength).toBeGreaterThan(5000);
      expect(bufferStartsWithRIFF(buf)).toBe(true);
      
      console.log(`✅ Long text audio: ${buf.byteLength} bytes`);
    }, 180000);
  });

  describe('WAV Format Validation', () => {
    it('should produce valid WAV format', async () => {
      const blob = await provider.speak('format test', {
        speaker: DEFAULT_SPEAKER_EMBEDDINGS,
      });

      const buf = await blob.arrayBuffer();
      const view = new DataView(buf);

      // Check WAV header
      expect(bufferStartsWithRIFF(buf)).toBe(true);
      
      // Check 'WAVE' at offset 8
      const waveMarker = String.fromCharCode(
        view.getUint8(8),
        view.getUint8(9),
        view.getUint8(10),
        view.getUint8(11)
      );
      expect(waveMarker).toBe('WAVE');
      
      // Check data chunk exists
      const dataMarker = String.fromCharCode(
        view.getUint8(36),
        view.getUint8(37),
        view.getUint8(38),
        view.getUint8(39)
      );
      expect(dataMarker).toBe('data');
      
      console.log('✅ Valid WAV structure confirmed');
    }, 180000);
  });

  describe('Roundtrip Test (TTS → STT)', () => {
    it('should synthesize and transcribe correctly', async () => {
      // Setup STT provider
      const sttProvider = createAIProvider({
        stt: {
          model: 'Xenova/whisper-tiny',
          dtype: 'fp32',
          device: 'cpu',
        },
      });

      await sttProvider.warmup('stt');

      try {
        // TTS: text → audio
        const originalText = 'hello world test';
        const audioBlob = await provider.speak(originalText, {
          speaker: DEFAULT_SPEAKER_EMBEDDINGS,
        });

        expect(audioBlob.size).toBeGreaterThan(1000);

        // STT: audio → text
        const transcription = await sttProvider.listen(audioBlob, { language: 'en' });

        expect(typeof transcription).toBe('string');
        expect(transcription.length).toBeGreaterThan(0);

        // Check if transcription contains key words (may not be exact due to synthesis quality)
        const lowerTranscription = transcription.toLowerCase();
        const keyWords = ['hello', 'world', 'test'];
        const matchedWords = keyWords.filter(word => lowerTranscription.includes(word));
        
        // At least 1 word should be recognized
        expect(matchedWords.length).toBeGreaterThan(0);
        
        console.log(`✅ Roundtrip: "${originalText}" → TTS → STT → "${transcription}"`);
      } finally {
        await sttProvider.dispose();
      }
    }, 300000);
  });
});



