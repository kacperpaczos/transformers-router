import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('LLM Progress UI (Browser)', () => {
  test('powinien pokazać status i progres ładowania aż do ready', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/tests/integration-browser/__app__/llm-progress/index.html');
    await page.waitForFunction(() => (window as any).testReady === true, { timeout: 10_000 });

    const status = page.getByTestId('status');
    const progress = page.getByTestId('progress');
    const file = page.getByTestId('file');

    // Start warmup przez UI, aby symulować realny przepływ DOM
    await page.getByTestId('start-warmup').click();

    // Oczekuj stanu przejściowego downloading/loading
    await expect(status).toHaveText(/downloading|loading/, { timeout: 20_000 });

    // Zbierz dwie próbki progresu i aserty nie-degresji
    const readProgress = async () => {
      const txt = (await progress.textContent()) || '0';
      const val = parseInt(txt, 10);
      return Number.isFinite(val) ? val : 0;
    };

    // Zwiększamy odporność: jeśli cache powoduje szybki skok do 100,
    // akceptujemy każdy z [0,100], ale preferujemy nie-degresję.
    const p1 = await readProgress();
    await page.waitForTimeout(500);
    const p2 = await readProgress();
    expect(p2).toBeGreaterThanOrEqual(p1);

    // Plik powinien być niepusty w trakcie pobierania (jeśli raportowany)
    // Plik może być czasem '-' gdy brak raportowania; wówczas pomijamy tę asercję
    const fileTxt = (await file.textContent()) || '';
    if (fileTxt !== '-') {
      expect(fileTxt.length).toBeGreaterThan(0);
    }

    // Finalnie status ready i progres 100
    await expect(status).toHaveText('ready', { timeout: 20_000 });
    await expect(progress).toHaveText('100');
  });
});


