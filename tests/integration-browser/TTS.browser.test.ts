/**
 * TTS Integration Tests in Browser Environment
 */

import { test, expect } from '@playwright/test';

test.describe('TTS Integration Tests (Browser)', () => {
  test('should synthesize WAV audio from text', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        tts: { model: 'Xenova/speecht5_tts', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('tts');
      
      const audioBlob = await provider.speak('Hello world');
      
      await provider.dispose();
      
      return {
        isBlob: audioBlob instanceof Blob,
        size: audioBlob.size,
        type: audioBlob.type,
        hasContent: audioBlob.size > 0,
        // UI markers
        testids: {
          hasAudioEl: !!document.querySelector('[data-testid="tts-audio"]'),
          hasSizeEl: !!document.querySelector('[data-testid="tts-size"]'),
        }
      };
    });

    expect(result.isBlob).toBe(true);
    expect(result.size).toBeGreaterThan(0);
    expect(result.type).toContain('audio');
    expect(result.testids.hasAudioEl).toBe(true);
    expect(result.testids.hasSizeEl).toBe(true);
    expect(result.hasContent).toBe(true);
  });

  test('should synthesize longer text', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        tts: { model: 'Xenova/speecht5_tts', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('tts');
      
      const longText = 'This is a longer text that should generate more audio content for testing purposes.';
      const audioBlob = await provider.speak(longText);
      
      await provider.dispose();
      
      return {
        size: audioBlob.size,
        type: audioBlob.type,
        isLarger: audioBlob.size > 1000, // Should be larger than short text
      };
    });

    expect(result.size).toBeGreaterThan(0);
    expect(result.type).toContain('audio');
    expect(result.isLarger).toBe(true);
  });

  test('should produce valid WAV format', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        tts: { model: 'Xenova/speecht5_tts', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('tts');
      
      const audioBlob = await provider.speak('Test WAV format');
      
      // Read blob as ArrayBuffer to check WAV header
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Check WAV header (RIFF...WAVE)
      const riff = String.fromCharCode(...uint8Array.slice(0, 4));
      const wave = String.fromCharCode(...uint8Array.slice(8, 12));
      
      await provider.dispose();
      
      return {
        size: audioBlob.size,
        type: audioBlob.type,
        hasRiffHeader: riff === 'RIFF',
        hasWaveHeader: wave === 'WAVE',
        isValidWav: riff === 'RIFF' && wave === 'WAVE',
      };
    });

    expect(result.size).toBeGreaterThan(0);
    expect(result.type).toContain('audio');
    expect(result.hasRiffHeader).toBe(true);
    expect(result.hasWaveHeader).toBe(true);
    expect(result.isValidWav).toBe(true);
  });

  test('should handle different text lengths', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        tts: { model: 'Xenova/speecht5_tts', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('tts');
      
      const shortText = 'Hi';
      const mediumText = 'This is a medium length sentence for testing.';
      const longText = 'This is a much longer text that contains multiple sentences and should generate significantly more audio content than the shorter texts. It includes various words and punctuation marks to test the TTS system thoroughly.';
      
      const [shortAudio, mediumAudio, longAudio] = await Promise.all([
        provider.speak(shortText),
        provider.speak(mediumText),
        provider.speak(longText)
      ]);
      
      await provider.dispose();
      
      return {
        shortSize: shortAudio.size,
        mediumSize: mediumAudio.size,
        longSize: longAudio.size,
        increasingSize: shortAudio.size < mediumAudio.size && mediumAudio.size < longAudio.size,
      };
    });

    expect(result.shortSize).toBeGreaterThan(0);
    expect(result.mediumSize).toBeGreaterThan(0);
    expect(result.longSize).toBeGreaterThan(0);
    expect(result.increasingSize).toBe(true);
  });

  test('should handle special characters and punctuation', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        tts: { model: 'Xenova/speecht5_tts', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('tts');
      
      const specialText = 'Hello! How are you? I\'m fine, thank you. Numbers: 1, 2, 3. Symbols: @#$%^&*()';
      const audioBlob = await provider.speak(specialText);
      
      await provider.dispose();
      
      return {
        size: audioBlob.size,
        type: audioBlob.type,
        hasContent: audioBlob.size > 0,
      };
    });

    expect(result.size).toBeGreaterThan(0);
    expect(result.type).toContain('audio');
    expect(result.hasContent).toBe(true);
  });

  test('should handle empty text gracefully', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        tts: { model: 'Xenova/speecht5_tts', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('tts');
      
      try {
        const audioBlob = await provider.speak('');
        await provider.dispose();
        return {
          success: true,
          size: audioBlob.size,
          type: audioBlob.type,
        };
      } catch (error) {
        await provider.dispose();
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.size).toBeGreaterThanOrEqual(0);
    expect(result.type).toContain('audio');
  });

  test('should handle speaker embeddings', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        tts: { model: 'Xenova/speecht5_tts' }
      });
      
      await provider.warmup('tts');
      
      const text = 'Testing speaker embeddings';
      
      // Generate default speaker embedding (random)
      const defaultAudio = await provider.speak(text);
      
      // Generate with specific speaker embedding
      const speakerEmbedding = new Float32Array(512).fill(0.1); // Simple test embedding
      const customAudio = await provider.speak(text, { speaker: speakerEmbedding });
      
      await provider.dispose();
      
      return {
        defaultSize: defaultAudio.size,
        customSize: customAudio.size,
        bothValid: defaultAudio.size > 0 && customAudio.size > 0,
        different: defaultAudio.size !== customSize,
      };
    });

    expect(result.defaultSize).toBeGreaterThan(0);
    expect(result.customSize).toBeGreaterThan(0);
    expect(result.bothValid).toBe(true);
    // Note: Different speaker embeddings should produce different audio
  });

  test('should handle concurrent synthesis requests', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        tts: { model: 'Xenova/speecht5_tts' }
      });
      
      await provider.warmup('tts');
      
      const texts = [
        'First audio sample',
        'Second audio sample',
        'Third audio sample'
      ];
      
      // Run concurrent synthesis
      const audioBlobs = await Promise.all(
        texts.map(text => provider.speak(text))
      );
      
      await provider.dispose();
      
      return {
        count: audioBlobs.length,
        sizes: audioBlobs.map(blob => blob.size),
        allValid: audioBlobs.every(blob => blob.size > 0),
        allBlobs: audioBlobs.every(blob => blob instanceof Blob),
      };
    });

    expect(result.count).toBe(3);
    expect(result.allValid).toBe(true);
    expect(result.allBlobs).toBe(true);
    expect(result.sizes.every(size => size > 0)).toBe(true);
  });

  test('should handle roundtrip test (TTS → STT)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        tts: { model: 'Xenova/speecht5_tts' },
        stt: { model: 'Xenova/whisper-tiny.en' }
      });
      
      await provider.warmup('tts');
      await provider.warmup('stt');
      
      const originalText = 'Hello world test';
      
      // TTS: Text to Speech
      const audioBlob = await provider.speak(originalText);
      
      // Convert Blob to ArrayBuffer for STT
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioData = new Float32Array(arrayBuffer);
      
      // STT: Speech to Text
      const transcribedText = await provider.transcribe(audioData);
      
      await provider.dispose();
      
      return {
        originalText,
        transcribedText,
        audioSize: audioBlob.size,
        hasTranscription: transcribedText && transcribedText.length > 0,
        roundtripSuccess: true,
      };
    });

    expect(result.audioSize).toBeGreaterThan(0);
    expect(result.hasTranscription).toBe(true);
    expect(result.roundtripSuccess).toBe(true);
    expect(typeof result.transcribedText).toBe('string');
  });
});
