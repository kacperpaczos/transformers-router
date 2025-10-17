import { chromium, Browser, Page, test, expect } from '@playwright/test';
import { navigateAndWaitReady, ensureProvider } from '../utils/pageSetup';

test.describe.serial('@embeddings Embeddings suite — jedna strona, wiele testów', () => {
  let browser: Browser;
  let page: Page;

  test.beforeAll(async () => {
    browser = await chromium.launch();
    const context = await browser.newContext();
    page = await context.newPage();
    await navigateAndWaitReady(page, '/tests/integration-browser/__app__/provider/index.html');
    await ensureProvider(page, 'embedding', { embedding: { model: 'Xenova/all-MiniLM-L6-v2', device: 'wasm', dtype: 'fp32' } });
  });

  test.afterAll(async () => {
    await page?.context().close();
    await browser?.close();
  });

  test('generuje embedding dla dwóch tekstów', async () => {
    const res = await page.evaluate(async () => (window as any).app.embed(['Hello world', 'Goodbye world']));
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBe(2);
    expect(Array.isArray(res[0])).toBe(true);
  });

  test('cosine similarity i deterministyczność', async () => {
    const out = await page.evaluate(async () => {
      const app = (window as any).app;
      const [emb1] = await app.embed('The cat sits on the mat');
      const [emb2] = await app.embed('The cat is on the mat');
      const [emb3] = await app.embed('The dog runs in the park');
      const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
      const mag = (a: number[]) => Math.sqrt(a.reduce((s, v) => s + v * v, 0));
      const cos = (a: number[], b: number[]) => dot(a, b) / (mag(a) * mag(b));
      return { sim12: cos(emb1, emb2), sim13: cos(emb1, emb3) };
    });
    expect(out.sim12).toBeGreaterThan(out.sim13);
  });

  test('normalizacja', async () => {
    const res = await page.evaluate(async () => {
      const app = (window as any).app;
      const [norm] = await app.embed('Test normalization', { normalize: true });
      const [unnorm] = await app.embed('Test normalization', { normalize: false });
      const mag = (a: number[]) => Math.sqrt(a.reduce((s, v) => s + v * v, 0));
      return { nm: mag(norm), um: mag(unnorm) };
    });
    expect(Math.abs(res.nm - 1)).toBeLessThan(0.05);
    expect(res.um).toBeGreaterThan(1);
  });
});


