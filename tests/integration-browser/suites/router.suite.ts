import { chromium, Browser, Page, test, expect } from '@playwright/test';

test.describe.serial('@router Router suite — jedna strona, wiele testów', () => {
  let browser: Browser;
  let page: Page;

  test.beforeAll(async () => {
    browser = await chromium.launch();
    const context = await browser.newContext();
    page = await context.newPage();
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);
    await page.evaluate(async () => {
      const { TransformersRouter } = await import('/dist/router.js');
      (window as any).TransformersRouter = TransformersRouter;
    });
  });

  test.afterAll(async () => {
    await page?.context().close();
    await browser?.close();
  });

  test('rejestruje i wykonuje trasę', async () => {
    const res = await page.evaluate(async () => {
      const router = new (window as any).TransformersRouter();
      router.addRoute('/ping', () => 'pong');
      const out = await router.execute('/ping');
      return { out, has: !!router.getRoute('/ping') };
    });
    expect(res.out).toBe('pong');
    expect(res.has).toBe(true);
  });

  test('normalizuje ścieżki bez trailing slash', async () => {
    const ok = await page.evaluate(async () => {
      const router = new (window as any).TransformersRouter();
      router.addRoute('/a/b/', () => 123);
      return !!router.getRoute('/a/b') && !!router.getRoute('/A/B');
    });
    expect(ok).toBe(true);
  });
});


