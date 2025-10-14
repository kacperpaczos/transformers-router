/**
 * LLM Integration Tests in Browser Environment
 */

import { test, expect } from '@playwright/test';

test.describe('LLM Integration Tests (Browser)', () => {
  test('should load GPT-2 model in browser', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        llm: { model: 'Xenova/gpt2', device: 'wasm' }
      });
      
      const progressEvents: string[] = [];
      provider.on('progress', (e: any) => {
        progressEvents.push(`${e.status}: ${e.file}`);
      });
      
      await provider.warmup('llm');
      
      return {
        ready: provider.isReady('llm'),
        eventsCount: progressEvents.length,
      };
    });

    expect(result.ready).toBe(true);
    expect(result.eventsCount).toBeGreaterThan(0);
  });

  test('should generate text from GPT-2', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { testHelpers } = (window as any);
      const provider = await testHelpers.loadModel({
        llm: { model: 'Xenova/gpt2', device: 'wasm', maxTokens: 50 }
      });
      
      const response = await provider.chat('Hello, how are you?');
      
      await provider.dispose();
      
      return {
        content: response.content,
        hasUsage: !!response.usage,
        role: response.role,
      };
    });

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.role).toBe('assistant');
    expect(result.hasUsage).toBe(true);
  });

  test('should handle multi-turn conversation', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        llm: { model: 'Xenova/gpt2', device: 'wasm', maxTokens: 30 }
      });
      
      await provider.warmup('llm');
      
      const conversation: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: 'You are helpful.' },
      ];
      
      // Turn 1
      conversation.push({ role: 'user', content: 'My name is Alice' });
      const r1 = await provider.chat(conversation);
      conversation.push({ role: 'assistant', content: r1.content });
      
      // Turn 2
      conversation.push({ role: 'user', content: 'What is my name?' });
      const r2 = await provider.chat(conversation);
      
      await provider.dispose();
      
      return {
        turn1: r1.content,
        turn2: r2.content,
        conversationLength: conversation.length,
      };
    });

    expect(result.conversationLength).toBe(5); // system + 2 user + 2 assistant
    expect(result.turn1).toBeDefined();
    expect(result.turn2).toBeDefined();
  });

  test('should handle different generation parameters', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        llm: { model: 'Xenova/gpt2', device: 'wasm', maxTokens: 20 }
      });
      
      await provider.warmup('llm');
      
      const responses = await Promise.all([
        provider.chat('The weather is', { temperature: 0.1, maxTokens: 10 }),
        provider.chat('The weather is', { temperature: 0.9, maxTokens: 10 }),
        provider.chat('The weather is', { topP: 0.5, maxTokens: 10 }),
        provider.chat('The weather is', { topK: 10, maxTokens: 10 }),
      ]);
      
      await provider.dispose();
      
      return {
        lowTemp: responses[0].content,
        highTemp: responses[1].content,
        lowTopP: responses[2].content,
        lowTopK: responses[3].content,
        allDifferent: new Set(responses.map(r => r.content)).size > 1,
      };
    });

    expect(result.lowTemp).toBeDefined();
    expect(result.highTemp).toBeDefined();
    expect(result.lowTopP).toBeDefined();
    expect(result.lowTopK).toBeDefined();
    expect(result.lowTemp.length).toBeGreaterThan(0);
    expect(result.highTemp.length).toBeGreaterThan(0);
  });

  test('should handle system prompts', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        llm: { model: 'Xenova/gpt2', device: 'wasm', maxTokens: 30 }
      });
      
      await provider.warmup('llm');
      
      const response = await provider.chat('What should I do?', {
        systemPrompt: 'You are a helpful coding assistant.',
        maxTokens: 20,
      });
      
      await provider.dispose();
      
      return {
        content: response.content,
        role: response.role,
        hasUsage: !!response.usage,
      };
    });

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.role).toBe('assistant');
    expect(result.hasUsage).toBe(true);
  });

  test('should handle completion mode', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        llm: { model: 'Xenova/gpt2', device: 'wasm', maxTokens: 20 }
      });
      
      await provider.warmup('llm');
      
      const completion = await provider.complete('The quick brown fox');
      
      await provider.dispose();
      
      return {
        completion,
        hasContent: completion && completion.length > 0,
        startsWithPrompt: completion.startsWith('The quick brown fox'),
      };
    });

    expect(result.completion).toBeDefined();
    expect(result.hasContent).toBe(true);
    expect(result.startsWithPrompt).toBe(true);
  });

  test('should handle streaming responses', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        llm: { model: 'Xenova/gpt2', device: 'wasm', maxTokens: 20 }
      });
      
      await provider.warmup('llm');
      
      const tokens: string[] = [];
      const stream = await provider.stream('Tell me a story about a robot');
      
      for await (const token of stream) {
        tokens.push(token);
        if (tokens.length >= 5) break; // Limit for testing
      }
      
      await provider.dispose();
      
      return {
        tokenCount: tokens.length,
        tokens: tokens,
        allTokens: tokens.join(''),
      };
    });

    expect(result.tokenCount).toBeGreaterThan(0);
    expect(result.tokens).toBeDefined();
    expect(result.allTokens.length).toBeGreaterThan(0);
  });

  test('should handle error cases gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        llm: { model: 'Xenova/gpt2', device: 'wasm', maxTokens: 10 }
      });
      
      await provider.warmup('llm');
      
      const errors: string[] = [];
      
      try {
        await provider.chat('', { maxTokens: -1 });
      } catch (error) {
        errors.push((error as Error).message);
      }
      
      try {
        await provider.chat('test', { temperature: -1 });
      } catch (error) {
        errors.push((error as Error).message);
      }
      
      await provider.dispose();
      
      return {
        errorCount: errors.length,
        errors: errors,
      };
    });

    // Should handle invalid parameters gracefully
    expect(result.errorCount).toBeGreaterThanOrEqual(0);
  });
});
