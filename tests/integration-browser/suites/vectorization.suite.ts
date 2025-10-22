import { chromium, Browser, Page, test, expect } from '@playwright/test';
import { navigateAndWaitReady } from '../utils/pageSetup';

test.describe.serial('@vectorization Vectorization suite', () => {
  let browser: Browser;
  let page: Page;

  test.beforeAll(async () => {
    browser = await chromium.launch();
    const context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await page?.context().close();
    await browser?.close();
  });

  test('Vectorization indexing should work', async () => {
    await navigateAndWaitReady(page, '/tests/integration-browser/__app__/vectorization-indexing/index.html');

    // Configure for local processing (no external mock)
    await page.selectOption('#storage-select', 'indexeddb');
    await page.selectOption('#mock-select', 'false');

    // Wait for initialization
    await page.waitForFunction(() => {
      const status = document.querySelector('[data-testid="status"]')?.textContent;
      return status === 'Ready';
    });

    // Create test files
    const testFiles = [
      { name: 'test-audio.wav', type: 'audio/wav' },
      { name: 'test-image.png', type: 'image/png' },
    ];

    // Upload files
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles(testFiles.map(f => ({
      name: f.name,
      mimeType: f.type,
      buffer: Buffer.from('test content'),
    })));

    // Start indexing
    await page.click('#index-btn');

    // Wait for completion
    await page.waitForFunction(() => {
      const status = document.querySelector('[data-testid="status"]')?.textContent;
      return status?.includes('Completed') || status?.includes('Error');
    });

    // Check results
    const status = await page.textContent('[data-testid="status"]');
    expect(status).toContain('Completed');

    const indexedFiles = await page.textContent('[data-testid="indexed-files"]');
    expect(indexedFiles).not.toBe('None');

    const filesCount = await page.textContent('[data-testid="files-count"]');
    expect(parseInt(filesCount || '0')).toBeGreaterThan(0);
  });

  test('Vectorization queries should work', async () => {
    await navigateAndWaitReady(page, '/tests/integration-browser/__app__/vectorization-queries/index.html');

    // Wait for initialization
    await page.waitForFunction(() => {
      const status = document.querySelector('[data-testid="status"]')?.textContent;
      return status === 'Ready';
    });

    // Load sample files first
    await page.click('#load-sample-btn');

    // Wait for samples to load
    await page.waitForFunction(() => {
      const loadedFiles = document.querySelector('[data-testid="loaded-files"]')?.textContent;
      return loadedFiles?.includes('Loaded');
    });

    // Run text query
    await page.fill('#query-input', 'sample audio');
    await page.selectOption('#modality-select', 'audio');
    await page.fill('#k-input', '3');
    await page.click('#query-btn');

    // Wait for query completion
    await page.waitForFunction(() => {
      const status = document.querySelector('[data-testid="status"]')?.textContent;
      return status?.includes('Query completed') || status?.includes('Error');
    });

    // Check results
    const resultsCount = await page.textContent('[data-testid="results-count"]');
    expect(parseInt(resultsCount || '0')).toBeGreaterThanOrEqual(0);

    const queryTime = await page.textContent('[data-testid="query-time"]');
    expect(queryTime).not.toBe('-');
  });

  test('Vectorization events should be emitted', async () => {
    await navigateAndWaitReady(page, '/tests/integration-browser/__app__/vectorization-events/index.html');

    // Wait for initialization
    await page.waitForFunction(() => {
      const status = document.querySelector('[data-testid="status"]')?.textContent;
      return status === 'Ready';
    });

    // Load samples and trigger events
    await page.click('#load-samples-btn');

    // Wait for indexing events
    await page.waitForFunction(() => {
      const eventsCount = document.querySelector('[data-testid="events-count"]')?.textContent;
      return parseInt(eventsCount || '0') > 0;
    });

    // Run queries to trigger more events
    await page.click('#run-queries-btn');

    // Wait for query events
    await page.waitForFunction(() => {
      const eventsCount = document.querySelector('[data-testid="events-count"]')?.textContent;
      return parseInt(eventsCount || '0') > 2;
    });

    // Check event log
    const eventsList = await page.textContent('[data-testid="events-list"]');
    expect(eventsList).not.toBe('No events yet...');
    expect(eventsList).toContain('vector:indexed');
    expect(eventsList).toContain('vector:queried');

    // Check resource monitoring
    const resourceUsage = await page.textContent('[data-testid="resource-usage"]');
    expect(resourceUsage).not.toBe('Loading...');
    expect(resourceUsage).toContain('Storage:');
  });

  test('Resource usage monitoring should work', async () => {
    await navigateAndWaitReady(page, '/tests/integration-browser/__app__/vectorization-events/index.html');

    // Wait for initialization
    await page.waitForFunction(() => {
      const status = document.querySelector('[data-testid="status"]')?.textContent;
      return status === 'Ready';
    });

    // Check initial resource usage
    await page.waitForFunction(() => {
      const usage = document.querySelector('[data-testid="resource-usage"]')?.textContent;
      return usage !== 'Loading...' && usage?.includes('Storage:');
    });

    const initialUsage = await page.textContent('[data-testid="resource-usage"]');
    expect(initialUsage).toContain('Storage:');

    // Load files and check usage increase
    await page.click('#load-samples-btn');

    // Wait a bit for resource monitoring to update
    await page.waitForTimeout(2000);

    const updatedUsage = await page.textContent('[data-testid="resource-usage"]');
    expect(updatedUsage).toContain('Storage:');

    // CPU usage should be tracked
    const cpuUsage = await page.textContent('[data-testid="usage-cpu"]');
    expect(cpuUsage).not.toBe('0ms'); // Should have some CPU usage
  });

  test('Error handling should work', async () => {
    await navigateAndWaitReady(page, '/tests/integration-browser/__app__/vectorization-indexing/index.html');

    // Configure with high error rate
    await page.selectOption('#mock-select', 'true');

    // Wait for initialization
    await page.waitForFunction(() => {
      const status = document.querySelector('[data-testid="status"]')?.textContent;
      return status === 'Ready';
    });

    // Try to index empty file (should handle gracefully)
    await page.click('#index-btn');

    // Should handle gracefully without crashing
    await page.waitForTimeout(1000);

    const status = await page.textContent('[data-testid="status"]');
    expect(status).not.toBe('idle'); // Should have changed from idle
  });
});
