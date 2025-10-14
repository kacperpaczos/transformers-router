import { test as base } from '@playwright/test';

// Extend base test with custom fixtures
export const test = base.extend({
  // Auto-cleanup provider after each test
  aiProvider: async ({ page }, use) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).testReady === true);
    
    // Helper to create provider
    const createProvider = async (config: any) => {
      return await page.evaluate(async (cfg) => {
        const { createAIProvider } = (window as any);
        (window as any).currentProvider = createAIProvider(cfg);
        await (window as any).currentProvider.warmup();
        return true;
      }, config);
    };
    
    await use(createProvider);
    
    // Cleanup
    await page.evaluate(() => {
      if ((window as any).currentProvider) {
        (window as any).currentProvider.dispose();
      }
    });
  },
});
