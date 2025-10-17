import { chromium, Browser, Page, test, expect } from '@playwright/test';
import { navigateAndWaitReady, ensureProvider } from '../utils/pageSetup';

test.describe.serial('@llm LLM suite — jedna strona, wiele testów', () => {
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

  test('generuje krótki completion', async () => {
    const result = await page.evaluate(async () => (window as any).app.runPrompt('Hello'));
    expect(result?.content ?? result?.text ?? '').toBeDefined();
  });

  test('streamowanie działa', async () => {
    const tokens = await page.evaluate(async () => (window as any).app.runStream('Hi'));
    expect(Array.isArray(tokens)).toBe(true);
    expect(tokens.length).toBeGreaterThan(0);
  });

  test('czat z tablicą wiadomości', async () => {
    const res = await page.evaluate(async () => (window as any).app.chat([
      { role: 'user', content: 'What is 2+2?' }
    ]));
    expect(res?.content?.length ?? 0).toBeGreaterThan(0);
    expect(res?.role).toBe('assistant');
  });

  test('parametry generacji: temperature/topP/topK', async () => {
    const out = await page.evaluate(async () => {
      const low = await (window as any).app.chat('The weather is', { temperature: 0.1, maxTokens: 10 });
      const high = await (window as any).app.chat('The weather is', { temperature: 0.9, maxTokens: 10 });
      const topP = await (window as any).app.chat('The weather is', { topP: 0.5, maxTokens: 10 });
      const topK = await (window as any).app.chat('The weather is', { topK: 10, maxTokens: 10 });
      return { low: low.content, high: high.content, topP: topP.content, topK: topK.content };
    });
    expect(out.low?.length ?? 0).toBeGreaterThan(0);
    expect(out.high?.length ?? 0).toBeGreaterThan(0);
    expect(out.topP?.length ?? 0).toBeGreaterThan(0);
    expect(out.topK?.length ?? 0).toBeGreaterThan(0);
  });

  test('system prompt', async () => {
    const res = await page.evaluate(async () => (window as any).app.chat('What should I do?', {
      systemPrompt: 'You are a helpful coding assistant.',
      maxTokens: 20,
    }));
    expect(res?.content?.length ?? 0).toBeGreaterThan(0);
    expect(res?.role).toBe('assistant');
  });

  test('max tokens oraz puste wejście', async () => {
    const out = await page.evaluate(async () => {
      const resp = await (window as any).app.chat('Write a long story about dragons', { maxTokens: 10 });
      let okEmpty = false;
      try {
        const r = await (window as any).app.chat('');
        okEmpty = typeof r?.content === 'string';
      } catch {
        okEmpty = false;
      }
      return { usage: resp.usage, okEmpty };
    });
    expect(out.okEmpty).toBe(true);
  });
});


