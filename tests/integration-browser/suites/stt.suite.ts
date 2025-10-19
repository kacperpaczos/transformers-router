import { chromium, Browser, Page, test, expect } from '@playwright/test';
import { navigateAndWaitReady, ensureProvider } from '../utils/pageSetup';

test.describe.serial('@stt STT suite — jedna strona, wiele testów', () => {
  let browser: Browser;
  let page: Page;

  test.beforeAll(async () => {
    browser = await chromium.launch();
    const context = await browser.newContext();
    page = await context.newPage();
    await navigateAndWaitReady(page, '/tests/integration-browser/__app__/provider/index.html');
    await ensureProvider(page, 'stt', { stt: { model: 'Xenova/whisper-tiny.en', device: 'wasm', dtype: 'fp32' } });
  });

  test.afterAll(async () => {
    await page?.context().close();
    await browser?.close();
  });

  test('transkrybuje generowany sinus 440Hz', async () => {
    const result = await page.evaluate(async () => {
      const audioContext = new (window as any).AudioContext({ sampleRate: 16000 });
      const buffer = audioContext.createBuffer(1, 16000, 16000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.sin((2 * Math.PI * 440 * i) / 16000) * 0.5;
      }
      const audioData = buffer.getChannelData(0);
      const text = await (window as any).app.transcribe(audioData);
      return { text, len: audioData.length };
    });
    expect(result.len).toBe(16000);
    expect(typeof result.text).toBe('string');
  });

  test('transkrybuje z URL fixtury (MP3)', async () => {
    const text = await page.evaluate(async () => {
      // Używamy pliku MP3 zamiast WAV
      return (window as any).app.transcribe('/tests/integration-browser/__assets__/audio/She’s been working here long enough to know what’s what.mp3');
    });
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  test('language/task/timestamps', async () => {
    const res = await page.evaluate(async () => {
      const audioContext = new (window as any).AudioContext({ sampleRate: 16000 });
      const buffer = audioContext.createBuffer(1, 16000, 16000);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.sin((2 * Math.PI * 330 * i) / 16000) * 0.2;
      const withLang = await (window as any).app.listen(data, { language: 'en' });
      const withTask = await (window as any).app.listen(data, { task: 'transcribe' });
      const withTs = await (window as any).app.listen(data, { timestamps: true });
      return { l: typeof withLang, t: typeof withTask, s: typeof withTs };
    });
    expect(res.l).toBe('string');
    expect(res.t).toBe('string');
    expect(res.s).toBe('string');
  });

  test('cisza i długi audio', async () => {
    const out = await page.evaluate(async () => {
      const ac = new (window as any).AudioContext({ sampleRate: 16000 });
      const short = ac.createBuffer(1, 16000, 16000).getChannelData(0);
      short.fill(0);
      const silence = await (window as any).app.listen(short);
      const long = ac.createBuffer(1, 16000 * 3, 16000).getChannelData(0);
      for (let i = 0; i < long.length; i++) long[i] = Math.sin((2 * Math.PI * (200 + (i / long.length) * 400) * i) / 16000) * 0.3;
      const longTx = await (window as any).app.transcribe(long);
      return { silence, longLen: long.length, longTxType: typeof longTx };
    });
    expect(out.longLen).toBe(48000);
    expect(typeof out.silence).toBe('string');
    expect(out.longTxType).toBe('string');
  });

  test('współbieżność', async () => {
    const res = await page.evaluate(async () => {
      const ac = new (window as any).AudioContext({ sampleRate: 16000 });
      const samples: Float32Array[] = [];
      for (let s = 0; s < 3; s++) {
        const b = ac.createBuffer(1, 8000, 16000).getChannelData(0);
        const f = 300 + s * 100;
        for (let i = 0; i < b.length; i++) b[i] = Math.sin((2 * Math.PI * f * i) / 16000) * 0.2;
        samples.push(b);
      }
      const ts = await Promise.all(samples.map(a => (window as any).app.transcribe(a)));
      return { count: ts.length, allStrings: ts.every((t: any) => typeof t === 'string') };
    });
    expect(res.count).toBe(3);
    expect(res.allStrings).toBe(true);
  });
});


