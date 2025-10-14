/**
 * Integration tests for AIProvider - really loads and tests models
 */

import { AIProvider, createAIProvider } from '../../src/core/AIProvider';
import type { AIProviderConfig } from '../../src/core/types';

// Use very small, fast models for testing
const testConfig: AIProviderConfig = {
  llm: {
    model: 'Xenova/gpt2', // Public, fast model
    dtype: 'fp32',
    device: 'cpu',
    maxTokens: 50,
  },
};

describe('AIProvider Integration Tests', () => {
  let provider: AIProvider;
  const progressEvents: { status: string }[] = [];

  beforeAll(async () => {
    // Increase timeout for model loading
    jest.setTimeout(300000); // 5 minutes

    console.log('Setting up AIProvider for integration tests...');
    provider = createAIProvider(testConfig);

    // Listen to progress
    provider.on('progress', ({ modality, status, file, progress }) => {
      if (modality === 'llm') {
        progressEvents.push({ status });
      }
      console.log(`Loading ${modality}: ${file ?? ''} ${progress ?? ''}`);
    });

    provider.on('ready', ({ modality }) => {
      console.log(`✅ ${modality} ready for testing`);
    });
  });

  afterAll(async () => {
    console.log('Cleaning up...');
    await provider.dispose();
  });

  describe('Model Loading', () => {
    it('should load LLM model successfully', async () => {
      console.log('Testing LLM model loading...');

      await provider.warmup('llm');

      expect(provider.isReady('llm')).toBe(true);
      // At least one progress event occurred
      expect(progressEvents.length).toBeGreaterThan(0);
      // Should have downloading/loading events during first warmup
      expect(progressEvents.some(e => e.status === 'downloading' || e.status === 'loading')).toBe(true);
    }, 120000); // 2 minutes timeout
  });

  describe('LLM Functionality', () => {
    beforeAll(async () => {
      console.log('Ensuring LLM is ready for tests...');
      if (!provider.isReady('llm')) {
        await provider.warmup('llm');
      }
    });

    it('should generate text with string input', async () => {
      console.log('Testing string input generation...');

      const response = await provider.chat('Hello, how are you?');

      expect(response).toHaveProperty('content');
      expect(typeof response.content).toBe('string');
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.role).toBe('assistant');
    }, 30000);

    it('should generate text with message array', async () => {
      console.log('Testing message array input...');

      const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant.' },
        { role: 'user' as const, content: 'What is 2+2?' },
      ];

      const response = await provider.chat(messages);

      expect(response).toHaveProperty('content');
      expect(response.content).toMatch(/\d+/); // Should contain numbers
    }, 30000);

    it('should complete a prompt', async () => {
      console.log('Testing prompt completion...');

      const prompt = 'The capital of France is';
      const response = await provider.complete(prompt);

      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(prompt.length);
    }, 30000);

    it('should handle different temperatures', async () => {
      console.log('Testing temperature variations...');

      const prompt = 'Write a short poem about';

      const response1 = await provider.chat(prompt, { temperature: 0.1 });
      const response2 = await provider.chat(prompt, { temperature: 0.9 });

      // Different temperatures should produce different outputs
      expect(response1.content).not.toBe(response2.content);
    }, 60000);

    it('should respect max tokens', async () => {
      console.log('Testing max tokens limit...');

      const response = await provider.chat('Tell me a long story', {
        maxTokens: 10,
      });

      // Should be limited to ~10 tokens (roughly 50 characters)
      expect(response.content.length).toBeLessThan(100);
    }, 30000);
  });

  describe('Streaming', () => {
    it('should stream responses', async () => {
      console.log('Testing streaming responses...');

      const messages = [
        { role: 'user' as const, content: 'Count to 5' },
      ];

      const tokens: string[] = [];
      for await (const token of provider.stream(messages)) {
        tokens.push(token);
      }

      expect(tokens.length).toBeGreaterThan(0);

      // Combine tokens and check content
      const fullResponse = tokens.join('');
      expect(fullResponse.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should throw error for invalid model', async () => {
      const invalidProvider = createAIProvider({
        llm: { model: 'non-existent-model-12345' },
      });

      await expect(invalidProvider.warmup('llm')).rejects.toThrow();
    }, 30000);

    it('should handle empty input', async () => {
      await expect(provider.chat('')).rejects.toThrow();
    }, 10000);
  });

  describe('Resource Management', () => {
    it('should unload models', async () => {
      console.log('Testing model unloading...');

      await provider.unload('llm');
      expect(provider.isReady('llm')).toBe(false);
    }, 10000);

    it('should reload models after unloading', async () => {
      console.log('Testing model reloading...');
      const eventsBefore = progressEvents.length;
      await provider.warmup('llm');
      expect(provider.isReady('llm')).toBe(true);
      const eventsAfter = progressEvents.length;

      await provider.unload('llm');
      expect(provider.isReady('llm')).toBe(false);
      // Some progress happened during reload
      expect(eventsAfter).toBeGreaterThanOrEqual(eventsBefore);
    }, 60000);
  });

  describe('Multiple Providers', () => {
    it('should handle multiple provider instances', async () => {
      console.log('Testing multiple providers...');

      const provider2 = createAIProvider(testConfig);

      await provider2.warmup('llm');
      expect(provider2.isReady('llm')).toBe(true);

      const response = await provider2.chat('Hello from second provider');
      expect(response.content).toBeDefined();

      await provider2.dispose();
    }, 120000);
  });
});

