import { test, expect } from '@playwright/test';

test.describe('Browser Test Pages', () => {
  test('każda strona raportuje progres i osiąga ready', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/tests/integration-browser/__assets__/index.html');

    // Zbierz linki do podstron testowych
    const links = await page.$$('[data-test-link]');
    const hrefs = await Promise.all(links.map(el => el.getAttribute('href')));
    const uniqueHrefs = Array.from(new Set((hrefs.filter(Boolean) as string[])));
    expect(uniqueHrefs.length).toBeGreaterThan(0);

    for (const href of uniqueHrefs) {
      await page.goto(href);
      await page.waitForFunction(() => (window as any).testReady === true, { timeout: 10_000 });

      const status = page.getByTestId('status');
      const progress = page.getByTestId('progress');

      // Start warmup
      await page.getByTestId('start-warmup').click();

      // Spodziewany stan przejściowy
      await expect(status).toHaveText(/downloading|loading/, { timeout: 20_000 });

      // Progres nie maleje
      const readProgress = async () => {
        const txt = (await progress.textContent()) || '0';
        const val = parseInt(txt, 10);
        return Number.isFinite(val) ? val : 0;
      };

      const p1 = await readProgress();
      await page.waitForTimeout(500);
      const p2 = await readProgress();
      expect(p2).toBeGreaterThanOrEqual(p1);

      // Finalny stan
      await expect(status).toHaveText('ready', { timeout: 20_000 });
      await expect(progress).toHaveText('100');
    }
  });
});


