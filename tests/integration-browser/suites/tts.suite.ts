import { chromium, Browser, Page, test, expect } from '@playwright/test';
import { navigateAndWaitReady, ensureProvider } from '../utils/pageSetup';

test.describe.serial('@tts TTS suite — jedna strona, wiele testów', () => {
  let browser: Browser;
  let page: Page;

  test.beforeAll(async () => {
    browser = await chromium.launch();
    const context = await browser.newContext();
    page = await context.newPage();
    await navigateAndWaitReady(page, '/tests/integration-browser/__app__/provider/index.html');
    await ensureProvider(page, 'tts', { tts: { model: 'Xenova/speecht5_tts', device: 'wasm', dtype: 'fp32' } });
  });

  test.afterAll(async () => {
    await page?.context().close();
    await browser?.close();
  });

  test('synthesizes WAV from text', async () => {
    const result = await page.evaluate(async () => {
      const blob: Blob = await (window as any).app.speak('Hello world');
      const sizeEl = document.querySelector('[data-testid="tts-size"]') as HTMLElement;
      if (sizeEl) sizeEl.textContent = String(blob.size);
      return { size: blob.size, type: blob.type, isBlob: blob instanceof Blob };
    });
    expect(result.isBlob).toBe(true);
    expect(result.size).toBeGreaterThan(0);
    expect(result.type).toContain('audio');
  });

  test('różne długości tekstu', async () => {
    const out = await page.evaluate(async () => {
      const short = await (window as any).app.speak('Hi');
      const medium = await (window as any).app.speak('This is a medium length sentence for testing.');
      const long = await (window as any).app.speak('This is a much longer text that contains multiple sentences and should generate significantly more audio content than the shorter texts.');
      return { s: short.size, m: medium.size, l: long.size };
    });
    expect(out.s).toBeGreaterThan(0);
    expect(out.m).toBeGreaterThan(out.s);
    expect(out.l).toBeGreaterThan(out.m);
  });

  test('współbieżność', async () => {
    const res = await page.evaluate(async () => {
      const texts = ['First', 'Second', 'Third'];
      const blobs: Blob[] = await Promise.all(texts.map((t: string) => (window as any).app.speak(t)));
      return { c: blobs.length, all: blobs.every(b => b.size > 0 && b instanceof Blob) };
    });
    expect(res.c).toBe(3);
    expect(res.all).toBe(true);
  });
});


