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

  it('should synthesize WAV audio from text', async () => {
    const blob = await provider.speak('hello from real tts test');

    expect(blob).toBeInstanceOf(Blob);

    const buf = await blob.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(1000);
    expect(bufferStartsWithRIFF(buf)).toBe(true);
  }, 180000);
});


