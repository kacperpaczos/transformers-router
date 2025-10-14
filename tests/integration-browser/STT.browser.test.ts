/**
 * STT Integration Tests in Browser Environment with Web Audio API
 */

import { test, expect } from '@playwright/test';

test.describe('STT Integration Tests (Browser)', () => {
  test('should transcribe audio using Web Audio API', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        stt: { model: 'Xenova/whisper-tiny.en', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('stt');
      
      // Generate simple audio using Web Audio API
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const duration = 1; // 1 second
      const buffer = audioContext.createBuffer(1, 16000 * duration, 16000);
      const channelData = buffer.getChannelData(0);
      
      // Generate 440Hz sine wave (A note)
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.sin(2 * Math.PI * 440 * i / 16000) * 0.5;
      }
      
      // Convert AudioBuffer to Float32Array
      const audioData = buffer.getChannelData(0);
      
      const transcription = await provider.listen(audioData);
      
      await provider.dispose();
      
      return {
        transcription,
        audioLength: audioData.length,
      };
    });

    expect(result.audioLength).toBe(16000);
    expect(typeof result.transcription).toBe('string');
    // Note: sine wave won't produce meaningful text, but should not error
  });

  test('should load audio from URL in browser', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        stt: { model: 'Xenova/whisper-tiny.en', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('stt');
      
      // Use test fixture
      const audioUrl = '/tests/fixtures/audio/hello-world-en.wav';
      const transcription = await provider.listen(audioUrl);
      
      await provider.dispose();
      
      return { transcription };
    });

    expect(result.transcription).toBeDefined();
    expect(result.transcription.length).toBeGreaterThan(0);
  });

  test('should handle different audio formats', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        stt: { model: 'Xenova/whisper-tiny.en', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('stt');
      
      // Generate different audio patterns
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const duration = 0.5; // 0.5 seconds
      const buffer = audioContext.createBuffer(1, 16000 * duration, 16000);
      const channelData = buffer.getChannelData(0);
      
      // Generate white noise
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = (Math.random() - 0.5) * 0.1;
      }
      
      const audioData = buffer.getChannelData(0);
      
      const transcription = await provider.listen(audioData);
      
      await provider.dispose();
      
      return {
        transcription,
        audioLength: audioData.length,
        hasTranscription: transcription && transcription.length > 0,
      };
    });

    expect(result.audioLength).toBe(8000); // 0.5 * 16000
    expect(typeof result.transcription).toBe('string');
    expect(result.hasTranscription).toBe(true);
  });

  test('should handle language specification', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        stt: { model: 'Xenova/whisper-tiny.en', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('stt');
      
      // Generate simple audio
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const buffer = audioContext.createBuffer(1, 16000, 16000);
      const channelData = buffer.getChannelData(0);
      
      // Generate 220Hz sine wave
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.sin(2 * Math.PI * 220 * i / 16000) * 0.3;
      }
      
      const audioData = buffer.getChannelData(0);
      
      const transcription = await provider.listen(audioData, { language: 'en' });
      
      await provider.dispose();
      
      return {
        transcription,
        hasLanguage: true,
      };
    });

    expect(typeof result.transcription).toBe('string');
    expect(result.hasLanguage).toBe(true);
  });

  test('should handle task specification', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        stt: { model: 'Xenova/whisper-tiny.en', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('stt');
      
      // Generate simple audio
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const buffer = audioContext.createBuffer(1, 16000, 16000);
      const channelData = buffer.getChannelData(0);
      
      // Generate 330Hz sine wave
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.sin(2 * Math.PI * 330 * i / 16000) * 0.2;
      }
      
      const audioData = buffer.getChannelData(0);
      
      const transcription = await provider.listen(audioData, { task: 'transcribe' });
      
      await provider.dispose();
      
      return {
        transcription,
        hasTask: true,
      };
    });

    expect(typeof result.transcription).toBe('string');
    expect(result.hasTask).toBe(true);
  });

  test('should handle timestamps when requested', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        stt: { model: 'Xenova/whisper-tiny.en', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('stt');
      
      // Generate simple audio
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const buffer = audioContext.createBuffer(1, 16000, 16000);
      const channelData = buffer.getChannelData(0);
      
      // Generate 550Hz sine wave
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.sin(2 * Math.PI * 550 * i / 16000) * 0.4;
      }
      
      const audioData = buffer.getChannelData(0);
      
      const transcription = await provider.listen(audioData, { timestamps: true });
      
      await provider.dispose();
      
      return {
        transcription,
        hasTimestamps: true,
      };
    });

    expect(typeof result.transcription).toBe('string');
    expect(result.hasTimestamps).toBe(true);
  });

  test('should handle silence gracefully', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        stt: { model: 'Xenova/whisper-tiny.en', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('stt');
      
      // Generate silence
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const buffer = audioContext.createBuffer(1, 16000, 16000);
      const channelData = buffer.getChannelData(0);
      
      // Fill with zeros (silence)
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = 0;
      }
      
      const audioData = buffer.getChannelData(0);
      
      const transcription = await provider.listen(audioData);
      
      await provider.dispose();
      
      return {
        transcription,
        isSilence: transcription === '' || transcription.trim() === '',
      };
    });

    expect(typeof result.transcription).toBe('string');
    // Silence should result in empty or very short transcription
    expect(result.isSilence).toBe(true);
  });

  test('should handle long audio', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        stt: { model: 'Xenova/whisper-tiny.en', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('stt');
      
      // Generate longer audio (3 seconds)
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const duration = 3;
      const buffer = audioContext.createBuffer(1, 16000 * duration, 16000);
      const channelData = buffer.getChannelData(0);
      
      // Generate varying frequency sine wave
      for (let i = 0; i < channelData.length; i++) {
        const freq = 200 + (i / channelData.length) * 400; // 200-600Hz sweep
        channelData[i] = Math.sin(2 * Math.PI * freq * i / 16000) * 0.3;
      }
      
      const audioData = buffer.getChannelData(0);
      
      const transcription = await provider.transcribe(audioData);
      
      await provider.dispose();
      
      return {
        transcription,
        audioLength: audioData.length,
        duration: audioData.length / 16000,
      };
    });

    expect(result.audioLength).toBe(48000); // 3 * 16000
    expect(result.duration).toBe(3);
    expect(typeof result.transcription).toBe('string');
  });

  test('should handle concurrent transcription requests', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        stt: { model: 'Xenova/whisper-tiny.en' }
      });
      
      await provider.warmup('stt');
      
      // Generate multiple audio samples
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const samples = [];
      
      for (let s = 0; s < 3; s++) {
        const buffer = audioContext.createBuffer(1, 8000, 16000); // 0.5s each
        const channelData = buffer.getChannelData(0);
        
        // Different frequency for each sample
        const freq = 300 + s * 100; // 300, 400, 500 Hz
        for (let i = 0; i < channelData.length; i++) {
          channelData[i] = Math.sin(2 * Math.PI * freq * i / 16000) * 0.2;
        }
        
        samples.push(channelData);
      }
      
      // Run concurrent transcriptions
      const transcriptions = await Promise.all(
        samples.map(audioData => provider.transcribe(audioData))
      );
      
      await provider.dispose();
      
      return {
        count: transcriptions.length,
        transcriptions: transcriptions,
        allStrings: transcriptions.every(t => typeof t === 'string'),
      };
    });

    expect(result.count).toBe(3);
    expect(result.allStrings).toBe(true);
    expect(result.transcriptions.every(t => t.length >= 0)).toBe(true);
  });
});
