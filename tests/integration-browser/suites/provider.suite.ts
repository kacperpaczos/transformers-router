import { chromium, Browser, Page, test, expect } from '@playwright/test';
import { navigateAndWaitReady, ensureProvider } from '../utils/pageSetup';

test.describe.serial('@provider Provider lifecycle suite', () => {
  let browser: Browser;
  let page: Page;

  test.beforeAll(async () => {
    browser = await chromium.launch();
    const context = await browser.newContext();
    page = await context.newPage();
    await navigateAndWaitReady(page, '/tests/integration-browser/__app__/provider/index.html');
    await ensureProvider(page, 'llm', { llm: { model: 'onnx-community/Qwen2.5-0.5B-Instruct', performanceMode: 'auto' } });
  });

  test.afterAll(async () => {
    await page?.context().close();
    await browser?.close();
  });

  test('warmup/unload/reload', async () => {
    const res = await page.evaluate(async () => {
      const provider = (window as any).__provider;
      const events: string[] = [];
      provider.on?.('progress', ({ modality, status }: any) => {
        if (modality === 'llm') events.push(status);
      });
      await provider.warmup('llm');
      const ready1 = provider.isReady('llm');
      await provider.unload('llm');
      const readyAfterUnload = provider.isReady('llm');
      await provider.warmup('llm');
      const ready2 = provider.isReady('llm');
      return { ready1, readyAfterUnload, ready2, eventsCount: events.length };
    });
    expect(res.ready1).toBe(true);
    expect(res.readyAfterUnload).toBe(false);
    expect(res.ready2).toBe(true);
    expect(res.eventsCount).toBeGreaterThanOrEqual(0);
  });

  test('wiele instancji', async () => {
    const out = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const p1 = createAIProvider({ llm: { model: 'onnx-community/Qwen2.5-0.5B-Instruct', performanceMode: 'auto' } });
      const p2 = createAIProvider({ llm: { model: 'onnx-community/Qwen2.5-0.5B-Instruct', performanceMode: 'auto' } });
      await Promise.all([p1.warmup('llm'), p2.warmup('llm')]);
      const r1 = await p1.chat('Hello from provider 1');
      const r2 = await p2.chat('Hello from provider 2');
      await Promise.all([p1.dispose(), p2.dispose()]);
      return { a: r1.content, b: r2.content };
    });
    expect((out.a || '').length).toBeGreaterThan(0);
    expect((out.b || '').length).toBeGreaterThan(0);
  });
});


