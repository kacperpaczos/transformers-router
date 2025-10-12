/**
 * Edge cases and error handling tests
 */

import { createAIProvider } from '../../src/core/AIProvider';

describe('Edge Cases and Error Handling', () => {
  const provider = createAIProvider({
    llm: {
      model: 'Xenova/distilgpt2',
      dtype: 'fp32',
      device: 'cpu',
      maxTokens: 100,
    },
    embedding: {
      model: 'Xenova/all-MiniLM-L6-v2',
      dtype: 'fp32',
      device: 'cpu',
    },
  });

  beforeAll(async () => {
    jest.setTimeout(300000);
    await provider.warmup();
  });

  afterAll(async () => {
    await provider.dispose();
  });

  describe('Invalid Input', () => {
    it('should handle empty string input', async () => {
      await expect(provider.chat('')).rejects.toThrow();
    });

    it('should handle empty message array', async () => {
      await expect(provider.chat([])).rejects.toThrow();
    });

    it('should handle null/undefined gracefully', async () => {
      await expect(provider.chat(null as any)).rejects.toThrow();
      await expect(provider.chat(undefined as any)).rejects.toThrow();
    });

    it('should handle empty embedding input', async () => {
      await expect(provider.embed('')).rejects.toThrow();
      await expect(provider.embed([])).rejects.toThrow();
    });
  });

  describe('Invalid Parameters', () => {
    it('should handle invalid temperature', async () => {
      // Temperature should be 0-1 or 0-2 depending on implementation
      const response = await provider.chat('test', { temperature: -1 });
      expect(response).toBeDefined();
    }, 30000);

    it('should handle zero maxTokens', async () => {
      const response = await provider.chat('test', { maxTokens: 0 });
      expect(response.content).toBeDefined();
    }, 30000);

    it('should handle very high maxTokens', async () => {
      const response = await provider.chat('test', { maxTokens: 10000 });
      expect(response.content).toBeDefined();
    }, 60000);
  });

  describe('Very Long Input', () => {
    it('should handle very long prompt', async () => {
      // Create 2000+ token prompt
      const longPrompt = 'word '.repeat(2000);

      try {
        const response = await provider.chat(longPrompt, { maxTokens: 10 });
        expect(response).toBeDefined();
        console.log(`✅ Handled ${longPrompt.length} character prompt`);
      } catch (error) {
        // May fail due to context length - that's acceptable
        expect((error as Error).message).toMatch(/context|length|token/i);
        console.log(`⚠️ Long prompt rejected (expected): ${(error as Error).message}`);
      }
    }, 60000);

    it('should handle very long text for embedding', async () => {
      const longText = 'word '.repeat(5000);

      const embeddings = await provider.embed(longText);
      
      expect(embeddings.length).toBe(1);
      expect(embeddings[0].length).toBe(384);
      
      console.log(`✅ Embedded ${longText.length} character text`);
    }, 60000);
  });

  describe('Special Characters', () => {
    it('should handle Unicode characters', async () => {
      const unicodeText = 'Hello 世界 🌍 Привет مرحبا';
      
      const response = await provider.chat(unicodeText);
      expect(response.content).toBeDefined();
      
      const embeddings = await provider.embed(unicodeText);
      expect(embeddings[0].length).toBe(384);
      
      console.log(`✅ Handled Unicode: "${response.content}"`);
    }, 30000);

    it('should handle special formatting characters', async () => {
      const text = 'Line 1\nLine 2\tTabbed\r\nWindows line';
      
      const response = await provider.chat(text);
      expect(response.content).toBeDefined();
    }, 30000);

    it('should handle HTML/code in input', async () => {
      const code = '<html><body>console.log("test")</body></html>';
      
      const response = await provider.chat(code);
      expect(response.content).toBeDefined();
    }, 30000);
  });

  describe('Model State Management', () => {
    it('should handle inference during model loading', async () => {
      const tempProvider = createAIProvider({
        llm: {
          model: 'Xenova/distilgpt2',
          dtype: 'fp32',
          device: 'cpu',
        },
      });

      // Start warmup (async)
      const warmupPromise = tempProvider.warmup('llm');

      // Try to use immediately (should wait for warmup)
      const chatPromise = tempProvider.chat('test');

      await warmupPromise;
      const response = await chatPromise;

      expect(response.content).toBeDefined();

      await tempProvider.dispose();
    }, 120000);

    it('should handle unload during inference', async () => {
      // Start long-running inference
      const inferencePromise = provider.chat('Write a very long story about space exploration', {
        maxTokens: 100,
      });

      // Wait a bit then unload
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        // Unload while generating - may fail or succeed depending on timing
        await provider.unload('llm');
      } catch (error) {
        // Expected - can't unload during use
        console.log(`⚠️ Unload during inference: ${(error as Error).message}`);
      }

      // Inference should still complete or fail gracefully
      try {
        const response = await inferencePromise;
        expect(response).toBeDefined();
      } catch (error) {
        // May fail if model was unloaded
        console.log(`⚠️ Inference interrupted: ${(error as Error).message}`);
      }

      // Ensure model is ready for next tests
      if (!provider.isReady('llm')) {
        await provider.warmup('llm');
      }
    }, 120000);
  });

  describe('Concurrent Operations', () => {
    it('should handle mixed operations concurrently', async () => {
      const operations = [
        provider.chat('Question 1'),
        provider.embed('Text for embedding 1'),
        provider.chat('Question 2'),
        provider.embed(['Text 2', 'Text 3']),
        provider.complete('Complete this'),
      ];

      const results = await Promise.all(operations);

      expect(results.length).toBe(5);
      expect(results[0]).toHaveProperty('content'); // chat response
      expect(Array.isArray(results[1])).toBe(true); // embeddings
      expect(results[2]).toHaveProperty('content'); // chat response
      expect(Array.isArray(results[3])).toBe(true); // embeddings
      expect(typeof results[4]).toBe('string'); // completion

      console.log('✅ 5 concurrent mixed operations completed');
    }, 120000);
  });

  describe('Error Recovery', () => {
    it('should recover from failed inference', async () => {
      // Try invalid operation
      try {
        await provider.chat('', { maxTokens: -1 });
      } catch (error) {
        // Expected error
      }

      // Next operation should work fine
      const response = await provider.chat('Recovery test');
      expect(response.content).toBeDefined();
      
      console.log('✅ Recovered from error successfully');
    }, 30000);

    it('should handle rapid successive errors', async () => {
      const invalidOperations = Array.from({ length: 10 }, () => 
        provider.chat('').catch(() => 'error')
      );

      const results = await Promise.all(invalidOperations);
      
      expect(results.every(r => r === 'error')).toBe(true);

      // Provider should still work
      const validResponse = await provider.chat('test');
      expect(validResponse.content).toBeDefined();
      
      console.log('✅ Handled 10 rapid errors and recovered');
    }, 60000);
  });

  describe('Boundary Conditions', () => {
    it('should handle single character input', async () => {
      const response = await provider.chat('a');
      expect(response.content).toBeDefined();
    }, 30000);

    it('should handle repeated characters', async () => {
      const response = await provider.chat('a'.repeat(100));
      expect(response.content).toBeDefined();
    }, 30000);

    it('should handle very short maxTokens', async () => {
      const response = await provider.chat('test', { maxTokens: 1 });
      expect(response.content).toBeDefined();
      expect(response.content.length).toBeLessThan(20);
    }, 30000);
  });

  describe('Configuration Edge Cases', () => {
    it('should handle model without explicit dtype', async () => {
      const tempProvider = createAIProvider({
        llm: {
          model: 'Xenova/distilgpt2',
          // No dtype specified - should use default
        },
      });

      await tempProvider.warmup('llm');
      const response = await tempProvider.chat('test');
      
      expect(response.content).toBeDefined();

      await tempProvider.dispose();
    }, 120000);

    it('should handle unconfigured modality gracefully', async () => {
      const minimalProvider = createAIProvider({
        llm: {
          model: 'Xenova/distilgpt2',
          dtype: 'fp32',
          device: 'cpu',
        },
      });

      // Try to use unconfigured TTS
      await expect(minimalProvider.speak('test')).rejects.toThrow('TTS not configured');

      await minimalProvider.dispose();
    }, 60000);
  });
});

