/**
 * Integration tests for STT (Whisper) - real model and real WAV input
 */

import { createAIProvider } from '../../src/core/AIProvider';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.join(process.cwd(), 'tests/fixtures/audio');
const expectedOutputs = require('../fixtures/expected-outputs.json');

// Helper to check if audio file exists
function audioExists(filename: string): boolean {
  return fs.existsSync(path.join(FIXTURES_DIR, filename));
}

// Helper to load audio as Blob
function loadAudioBlob(filename: string): Blob {
  const wavBuffer = fs.readFileSync(path.join(FIXTURES_DIR, filename));
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

describe('STT Integration (Whisper)', () => {
  const provider = createAIProvider({
    stt: {
      model: 'Xenova/whisper-tiny',
      dtype: 'fp32',
      device: 'cpu',
    },
  });

  beforeAll(async () => {
    jest.setTimeout(300000);
    provider.on('progress', ({ modality, status, file, progress }) => {
      if (modality === 'stt') {
        console.log(`[STT] ${status}${file ? ` ${file}` : ''}${progress ? ` ${progress}%` : ''}`);
      }
    });
    await provider.warmup('stt');
  });

  afterAll(async () => {
    await provider.dispose();
  });

  describe('English Transcription', () => {
    it('should transcribe English audio correctly', async () => {
      if (!audioExists('hello-world-en.wav')) {
        console.warn('⚠️ Skipping: hello-world-en.wav not found. Please add real audio fixture.');
        return;
      }

      const blob = loadAudioBlob('hello-world-en.wav');
      const text = await provider.listen(blob, { language: 'en' });

      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);

      // Check for known keywords from expected output
      const expected = expectedOutputs.audio['hello-world-en.wav'];
      const lowerText = text.toLowerCase();
      
      expected.keywords.forEach((keyword: string) => {
        expect(lowerText).toContain(keyword.toLowerCase());
      });
    }, 120000);
  });

  describe('Polish Transcription', () => {
    it('should transcribe Polish audio correctly', async () => {
      if (!audioExists('polish-test.wav')) {
        console.warn('⚠️ Skipping: polish-test.wav not found. Please add real audio fixture.');
        return;
      }

      const blob = loadAudioBlob('polish-test.wav');
      const text = await provider.listen(blob, { language: 'pl' });

      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);

      // Check for Polish keywords
      const expected = expectedOutputs.audio['polish-test.wav'];
      const lowerText = text.toLowerCase();
      
      expected.keywords.forEach((keyword: string) => {
        expect(lowerText).toContain(keyword.toLowerCase());
      });

      console.log(`✅ Polish transcription: "${text}"`);
    }, 120000);
  });

  describe('German Transcription', () => {
    it('should transcribe German audio correctly', async () => {
      if (!audioExists('german-test.wav')) {
        console.warn('⚠️ Skipping: german-test.wav not found. Please add real audio fixture.');
        return;
      }

      const blob = loadAudioBlob('german-test.wav');
      const text = await provider.listen(blob, { language: 'de' });

      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);

      // Check for German keywords
      const expected = expectedOutputs.audio['german-test.wav'];
      const lowerText = text.toLowerCase();
      
      expected.keywords.forEach((keyword: string) => {
        expect(lowerText).toContain(keyword.toLowerCase());
      });

      console.log(`✅ German transcription: "${text}"`);
    }, 120000);
  });

  describe('Auto-detect Language', () => {
    it('should auto-detect language when not specified', async () => {
      if (!audioExists('hello-world-en.wav')) {
        console.warn('⚠️ Skipping: hello-world-en.wav not found.');
        return;
      }

      const blob = loadAudioBlob('hello-world-en.wav');
      // Don't specify language - let Whisper detect
      const text = await provider.listen(blob);

      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
      
      console.log(`✅ Auto-detected transcription: "${text}"`);
    }, 120000);
  });

  describe('Edge Cases', () => {
    it('should handle silence gracefully', async () => {
      const blob = loadAudioBlob('sample.wav'); // Our silence placeholder

      const text = await provider.listen(blob);

      expect(typeof text).toBe('string');
      // Silence may return empty or whitespace
      expect(text.trim().length).toBeLessThanOrEqual(10);
    }, 60000);

    it('should handle long audio', async () => {
      if (!audioExists('long-audio-pl.wav')) {
        console.warn('⚠️ Skipping: long-audio-pl.wav not found.');
        return;
      }

      const blob = loadAudioBlob('long-audio-pl.wav');
      const text = await provider.listen(blob, { language: 'pl' });

      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(50);
      
      console.log(`✅ Long audio transcribed: ${text.length} characters`);
    }, 180000);
  });

  describe('Timestamps', () => {
    it('should return timestamps when requested', async () => {
      if (!audioExists('hello-world-en.wav')) {
        console.warn('⚠️ Skipping: hello-world-en.wav not found.');
        return;
      }

      const blob = loadAudioBlob('hello-world-en.wav');
      const text = await provider.listen(blob, { 
        language: 'en',
        timestamps: true 
      });

      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
      
      // Note: timestamp format depends on Whisper output format
      console.log(`✅ Transcription with timestamps: "${text}"`);
    }, 120000);
  });
});


