/**
 * Integration tests for STT (Whisper) - real model and real WAV input
 */

import { createAIProvider } from '../../src/core/AIProvider';
import * as fs from 'fs';
import * as path from 'path';

const WAV_PATH = process.env.WAV_PATH || path.join(process.cwd(), 'tests/fixtures/audio/sample.wav');

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

  it('should transcribe WAV audio file', async () => {
    const wavBuffer = fs.readFileSync(WAV_PATH);
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });

    const text = await provider.listen(blob, { language: 'en' });
    // Require a non-empty transcription – provide a real WAV file instead of a placeholder
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  }, 120000);
});


