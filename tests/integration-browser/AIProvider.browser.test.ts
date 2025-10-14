/**
 * Integration tests for AIProvider in browser environment
 */

import { test, expect } from '@playwright/test';

// Use very small, fast models for testing
const testConfig = {
  llm: {
    model: 'Xenova/gpt2', // Public, fast model
    dtype: 'fp32',
    device: 'wasm', // Use WebAssembly in browser
    maxTokens: 50,
  },
};

test.describe('AIProvider Integration Tests (Browser)', () => {
  test('should load LLM model successfully in browser', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async (config) => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider(config);
      
      const progressEvents: string[] = [];
      provider.on('progress', ({ modality, status, file, progress }: any) => {
        if (modality === 'llm') {
          progressEvents.push(`${status}: ${file || ''}`);
        }
        console.log(`Loading ${modality}: ${file ?? ''} ${progress ?? ''}`);
      });

      provider.on('ready', ({ modality }: any) => {
        console.log(`✅ ${modality} ready for testing`);
      });

      await provider.warmup('llm');
      
      const isReady = provider.isReady('llm');
      await provider.dispose();
      
      return {
        ready: isReady,
        eventsCount: progressEvents.length,
      };
    }, testConfig);

    expect(result.ready).toBe(true);
    expect(result.eventsCount).toBeGreaterThan(0);
  });

  test('should generate text with string input', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async (config) => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider(config);
      
      await provider.warmup('llm');
      
      const response = await provider.chat('Hello, how are you?');
      
      await provider.dispose();
      
      return {
        content: response.content,
        role: response.role,
        hasUsage: !!response.usage,
        usage: response.usage,
      };
    }, testConfig);

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.role).toBe('assistant');
    expect(result.hasUsage).toBe(true);
    expect(result.usage?.totalTokens).toBeGreaterThan(0);
  });

  test('should generate text with message array', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async (config) => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider(config);
      
      await provider.warmup('llm');
      
      const messages = [
        { role: 'user' as const, content: 'What is 2+2?' }
      ];
      
      const response = await provider.chat(messages);
      
      await provider.dispose();
      
      return {
        content: response.content,
        role: response.role,
        hasUsage: !!response.usage,
      };
    }, testConfig);

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.role).toBe('assistant');
    expect(result.hasUsage).toBe(true);
  });

  test('should complete a prompt', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async (config) => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider(config);
      
      await provider.warmup('llm');
      
      const completion = await provider.complete('The weather today is');
      
      await provider.dispose();
      
      return {
        completion,
        hasContent: completion && completion.length > 0,
      };
    }, testConfig);

    expect(result.completion).toBeDefined();
    expect(result.hasContent).toBe(true);
  });

  test('should handle different temperatures', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async (config) => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider(config);
      
      await provider.warmup('llm');
      
      const response1 = await provider.chat('Tell me a story', { temperature: 0.1 });
      const response2 = await provider.chat('Tell me a story', { temperature: 0.9 });
      
      await provider.dispose();
      
      return {
        lowTemp: response1.content,
        highTemp: response2.content,
        different: response1.content !== response2.content,
      };
    }, testConfig);

    expect(result.lowTemp).toBeDefined();
    expect(result.highTemp).toBeDefined();
    expect(result.lowTemp.length).toBeGreaterThan(0);
    expect(result.highTemp.length).toBeGreaterThan(0);
    // Note: With small models, responses might be similar even with different temperatures
  });

  test('should respect max tokens', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async (config) => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider(config);
      
      await provider.warmup('llm');
      
      const response = await provider.chat('Write a long story about dragons', { 
        maxTokens: 10 
      });
      
      await provider.dispose();
      
      return {
        content: response.content,
        usage: response.usage,
        respectsMaxTokens: response.usage?.completionTokens <= 10,
      };
    }, testConfig);

    expect(result.content).toBeDefined();
    expect(result.usage).toBeDefined();
    expect(result.respectsMaxTokens).toBe(true);
  });

  test('should handle empty input', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async (config) => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider(config);
      
      await provider.warmup('llm');
      
      try {
        const response = await provider.chat('');
        await provider.dispose();
        return {
          success: true,
          content: response.content,
        };
      } catch (error) {
        await provider.dispose();
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }, testConfig);

    // Should handle empty input gracefully
    expect(result.success).toBe(true);
    expect(result.content).toBeDefined();
  });

  test('should unload models', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async (config) => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider(config);
      
      await provider.warmup('llm');
      const wasReady = provider.isReady('llm');
      
      await provider.unload('llm');
      const isUnloaded = !provider.isReady('llm');
      
      await provider.dispose();
      
      return {
        wasReady,
        isUnloaded,
      };
    }, testConfig);

    expect(result.wasReady).toBe(true);
    expect(result.isUnloaded).toBe(true);
  });

  test('should reload models after unloading', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async (config) => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider(config);
      
      const progressEvents: string[] = [];
      provider.on('progress', ({ modality, status }: any) => {
        if (modality === 'llm') {
          progressEvents.push(status);
        }
      });
      
      await provider.warmup('llm');
      const eventsBefore = progressEvents.length;
      
      await provider.unload('llm');
      await provider.warmup('llm');
      const eventsAfter = progressEvents.length;
      
      await provider.dispose();
      
      return {
        eventsBefore,
        eventsAfter,
        ready: provider.isReady('llm'),
      };
    }, testConfig);

    expect(result.ready).toBe(true);
    expect(result.eventsAfter).toBeGreaterThanOrEqual(result.eventsBefore);
  });

  test('should handle multiple provider instances', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async (config) => {
      const { createAIProvider } = (window as any);
      
      const provider1 = createAIProvider(config);
      const provider2 = createAIProvider(config);
      
      await Promise.all([
        provider1.warmup('llm'),
        provider2.warmup('llm')
      ]);
      
      const response1 = await provider1.chat('Hello from provider 1');
      const response2 = await provider2.chat('Hello from provider 2');
      
      await Promise.all([
        provider1.dispose(),
        provider2.dispose()
      ]);
      
      return {
        provider1Ready: provider1.isReady('llm'),
        provider2Ready: provider2.isReady('llm'),
        response1: response1.content,
        response2: response2.content,
        different: response1.content !== response2.content,
      };
    }, testConfig);

    expect(result.provider1Ready).toBe(true);
    expect(result.provider2Ready).toBe(true);
    expect(result.response1).toBeDefined();
    expect(result.response2).toBeDefined();
    expect(result.response1.length).toBeGreaterThan(0);
    expect(result.response2.length).toBeGreaterThan(0);
  });
});
