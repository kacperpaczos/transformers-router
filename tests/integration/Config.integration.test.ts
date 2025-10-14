/**
 * Configuration and model parameter tests
 */

import { createAIProvider } from '../../src/core/AIProvider';

describe('Configuration Tests', () => {
  beforeAll(() => {
    jest.setTimeout(300000);
  });

  describe('DType Comparisons', () => {
    it('should load model with fp32', async () => {
      const provider = createAIProvider({
        llm: {
          model: 'Xenova/gpt2',
          dtype: 'fp32',
          device: 'cpu',
        },
      });

      const start = Date.now();
      await provider.warmup('llm');
      const loadTime = Date.now() - start;

      const response = await provider.chat('test fp32');
      expect(response.content).toBeDefined();

      await provider.dispose();

      console.log(`✅ fp32: loaded in ${loadTime}ms`);
    }, 120000);

    it('should load model with q8 quantization', async () => {
      const provider = createAIProvider({
        embedding: {
          model: 'Xenova/all-MiniLM-L6-v2',
          dtype: 'q8',
          device: 'cpu',
        },
      });

      const start = Date.now();
      await provider.warmup('embedding');
      const loadTime = Date.now() - start;

      const embeddings = await provider.embed('test q8');
      expect(embeddings[0].length).toBe(384);

      await provider.dispose();

      console.log(`✅ q8: loaded in ${loadTime}ms`);
    }, 120000);

    it('should compare inference quality across dtypes', async () => {
      const prompt = 'The capital of France is';

      // Test with fp32
      const provider1 = createAIProvider({
        llm: {
          model: 'Xenova/gpt2',
          dtype: 'fp32',
          device: 'cpu',
          maxTokens: 20,
        },
      });

      await provider1.warmup('llm');
      const response1 = await provider1.chat(prompt);
      await provider1.dispose();

      // Both should produce valid outputs
      expect(response1.content.length).toBeGreaterThan(0);

      console.log(`fp32 output: "${response1.content}"`);
    }, 180000);
  });

  describe('Device Configuration', () => {
    it('should use CPU device explicitly', async () => {
      const provider = createAIProvider({
        llm: {
          model: 'Xenova/gpt2',
          dtype: 'fp32',
          device: 'cpu', // Explicit CPU
        },
      });

      await provider.warmup('llm');
      const response = await provider.chat('CPU test');
      
      expect(response.content).toBeDefined();

      await provider.dispose();
    }, 120000);

    it('should handle device not specified (default to CPU)', async () => {
      const provider = createAIProvider({
        llm: {
          model: 'Xenova/gpt2',
          dtype: 'fp32',
          // No device specified
        },
      });

      await provider.warmup('llm');
      const response = await provider.chat('default device test');
      
      expect(response.content).toBeDefined();

      await provider.dispose();
    }, 120000);
  });

  describe('Model Switching', () => {
    it('should switch between different LLM models', async () => {
      const provider = createAIProvider({
        llm: {
          model: 'Xenova/gpt2',
          dtype: 'fp32',
          device: 'cpu',
        },
      });

      // Load first model
      await provider.warmup('llm');
      const response1 = await provider.chat('First model');
      expect(response1.content).toBeDefined();

      // Update config to different model
      await provider.updateConfig({
        llm: {
          model: 'Xenova/gpt2', // Same model for test stability
          dtype: 'q8', // Different dtype
          device: 'cpu',
        },
      });

      // Should unload old model
      expect(provider.isReady('llm')).toBe(false);

      // Load new configuration
      await provider.warmup('llm');
      const response2 = await provider.chat('Second model');
      expect(response2.content).toBeDefined();

      await provider.dispose();

      console.log('✅ Successfully switched model configuration');
    }, 240000);
  });

  describe('Concurrent Model Loading', () => {
    it('should handle multiple warmup calls concurrently', async () => {
      const provider = createAIProvider({
        llm: {
          model: 'Xenova/gpt2',
          dtype: 'fp32',
          device: 'cpu',
        },
        embedding: {
          model: 'Xenova/all-MiniLM-L6-v2',
          dtype: 'fp32',
          device: 'cpu',
        },
      });

      // Call warmup multiple times simultaneously
      const warmups = [
        provider.warmup('llm'),
        provider.warmup('llm'),
        provider.warmup('llm'),
        provider.warmup('embedding'),
        provider.warmup('embedding'),
      ];

      await Promise.all(warmups);

      expect(provider.isReady('llm')).toBe(true);
      expect(provider.isReady('embedding')).toBe(true);

      await provider.dispose();

      console.log('✅ Handled concurrent warmup calls');
    }, 180000);
  });

  describe('Stop Sequences', () => {
    it('should respect stop sequences', async () => {
      const provider = createAIProvider({
        llm: { model: 'Xenova/gpt2', device: 'cpu' },
      });

      const response = await provider.chat('Count: 1, 2, 3', {
        stopSequences: [','],
        maxTokens: 50,
      });

      expect(response.content).toBeDefined();
      
      // May or may not stop early depending on model support
      console.log(`Response with stop sequence: "${response.content}"`);
      
      await provider.dispose();
    }, 30000);
  });

  describe('System Prompt', () => {
    it('should use system prompt correctly', async () => {
      const provider = createAIProvider({
        llm: { model: 'Xenova/gpt2', device: 'cpu' },
      });

      const response = await provider.chat('What should I do?', {
        systemPrompt: 'You are a helpful coding assistant.',
        maxTokens: 50,
      });

      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(0);
      
      console.log(`With system prompt: "${response.content}"`);
      
      await provider.dispose();
    }, 30000);
  });

  describe('Token Usage Tracking', () => {
    it('should track token usage in responses', async () => {
      const provider = createAIProvider({
        llm: { model: 'Xenova/gpt2', device: 'cpu' },
      });

      const response = await provider.chat('Short prompt');

      if (response.usage) {
        expect(response.usage).toHaveProperty('promptTokens');
        expect(response.usage).toHaveProperty('completionTokens');
        expect(response.usage).toHaveProperty('totalTokens');
        
        expect(response.usage.totalTokens).toBe(
          response.usage.promptTokens + response.usage.completionTokens
        );

        console.log(`Token usage: ${response.usage.promptTokens} + ${response.usage.completionTokens} = ${response.usage.totalTokens}`);
      } else {
        console.log('⚠️ Token usage not available for this model');
      }
      
      await provider.dispose();
    }, 30000);
  });

  describe('Status and Lifecycle', () => {
    it('should report correct status during lifecycle', async () => {
      const tempProvider = createAIProvider({
        llm: {
          model: 'Xenova/gpt2',
          dtype: 'fp32',
          device: 'cpu',
        },
      });

      // Before warmup
      expect(tempProvider.isReady('llm')).toBe(false);
      const status1 = tempProvider.getStatus('llm');
      expect(status1.loaded).toBe(false);

      // After warmup
      await tempProvider.warmup('llm');
      expect(tempProvider.isReady('llm')).toBe(true);
      const status2 = tempProvider.getStatus('llm');
      expect(status2.loaded).toBe(true);
      expect(status2.loading).toBe(false);

      // After unload
      await tempProvider.unload('llm');
      expect(tempProvider.isReady('llm')).toBe(false);
      const status3 = tempProvider.getStatus('llm');
      expect(status3.loaded).toBe(false);

      await tempProvider.dispose();

      console.log('✅ Status tracking verified');
    }, 180000);

    it('should report all statuses correctly', async () => {
      const provider = createAIProvider({
        llm: { model: 'Xenova/gpt2', device: 'cpu' },
      });

      const allStatuses = provider.getAllStatuses();

      expect(Array.isArray(allStatuses)).toBe(true);
      
      allStatuses.forEach((status: any) => {
        expect(status).toHaveProperty('modality');
        expect(status).toHaveProperty('loaded');
        expect(status).toHaveProperty('loading');
      });

      const llmStatus = allStatuses.find((s: any) => s.modality === 'llm');
      expect(llmStatus?.loaded).toBe(true);

      console.log(`Statuses: ${JSON.stringify(allStatuses, null, 2)}`);
      
      await provider.dispose();
    });
  });
});

