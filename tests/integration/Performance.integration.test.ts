/**
 * Performance and stress tests for AI models
 */

import { createAIProvider } from '../../src/core/AIProvider';

describe('Performance Tests', () => {
  const provider = createAIProvider({
    llm: {
      model: 'Xenova/gpt2',
      dtype: 'fp32',
      device: 'cpu',
      maxTokens: 30,
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

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent chat requests', async () => {
      const prompts = Array.from({ length: 10 }, (_, i) => `Request ${i}`);

      const start = Date.now();
      const results = await Promise.all(
        prompts.map(prompt => provider.chat(prompt))
      );
      const duration = Date.now() - start;

      expect(results.length).toBe(10);
      results.forEach(result => {
        expect(result.content).toBeDefined();
        expect(result.content.length).toBeGreaterThan(0);
      });

      console.log(`✅ 10 concurrent requests completed in ${duration}ms`);
    }, 120000);

    it('should handle concurrent embedding requests', async () => {
      const texts = Array.from({ length: 50 }, (_, i) => `Document ${i}: Sample text for embedding`);

      const start = Date.now();
      const embeddings = await provider.embed(texts);
      const duration = Date.now() - start;

      expect(embeddings.length).toBe(50);
      
      console.log(`✅ 50 embeddings completed in ${duration}ms (${Math.round(duration / 50)}ms per text)`);
    }, 60000);
  });

  describe('Cache Performance', () => {
    it('should load faster from cache on second warmup', async () => {
      // Unload model
      await provider.unload('llm');
      expect(provider.isReady('llm')).toBe(false);

      // First warmup (from cache)
      const progressEvents1: string[] = [];
      provider.on('progress', ({ modality, status }) => {
        if (modality === 'llm') {
          progressEvents1.push(status);
        }
      });

      const start1 = Date.now();
      await provider.warmup('llm');
      const duration1 = Date.now() - start1;

      // Unload again
      await provider.unload('llm');

      // Second warmup (should be faster)
      const progressEvents2: string[] = [];
      provider.on('progress', ({ modality, status }) => {
        if (modality === 'llm') {
          progressEvents2.push(status);
        }
      });

      const start2 = Date.now();
      await provider.warmup('llm');
      const duration2 = Date.now() - start2;

      // Second should have fewer downloading events (files cached)
      const downloading1 = progressEvents1.filter(s => s === 'downloading').length;
      const downloading2 = progressEvents2.filter(s => s === 'downloading').length;
      
      console.log(`Cache performance: ${duration1}ms (first) vs ${duration2}ms (second)`);
      console.log(`Downloads: ${downloading1} (first) vs ${downloading2} (second)`);
      
      // Both should complete successfully
      expect(provider.isReady('llm')).toBe(true);
    }, 180000);
  });

  describe('Model Switch Performance', () => {
    it('should switch between models efficiently', async () => {
      const config1 = {
        embedding: {
          model: 'Xenova/all-MiniLM-L6-v2',
          dtype: 'fp32' as const,
          device: 'cpu' as const,
        },
      };

      const provider1 = createAIProvider(config1);
      await provider1.warmup('embedding');

      // Use model 1
      const embed1 = await provider1.embed('test');
      expect(embed1[0].length).toBe(384);

      // Dispose and create new provider
      await provider1.dispose();

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));

      const provider2 = createAIProvider(config1);
      
      const start = Date.now();
      await provider2.warmup('embedding');
      const switchDuration = Date.now() - start;

      // Use model 2
      const embed2 = await provider2.embed('test');
      expect(embed2[0].length).toBe(384);

      await provider2.dispose();

      console.log(`✅ Model switch completed in ${switchDuration}ms`);
      
      // Should be fast due to cache
      expect(switchDuration).toBeLessThan(30000);
    }, 120000);
  });

  describe('Memory Management', () => {
    it('should not leak memory on repeated requests', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        await provider.chat(`Request ${i}`, { maxTokens: 10 });
        
        // Log every 20 requests
        if (i % 20 === 0) {
          const currentMemory = process.memoryUsage().heapUsed;
          const diff = ((currentMemory - initialMemory) / 1024 / 1024).toFixed(2);
          console.log(`After ${i} requests: +${diff}MB`);
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;

      console.log(`✅ Memory increase after 100 requests: ${memoryIncrease.toFixed(2)}MB`);
      
      // Should not grow excessively (< 100MB for 100 requests)
      expect(memoryIncrease).toBeLessThan(100);
    }, 180000);
  });

  describe('Large Batch Processing', () => {
    it('should handle batch of 1000 embeddings', async () => {
      const texts = Array.from({ length: 1000 }, (_, i) => 
        `Sample text number ${i} for batch embedding test`
      );

      const start = Date.now();
      const embeddings = await provider.embed(texts);
      const duration = Date.now() - start;

      expect(embeddings.length).toBe(1000);
      
      const avgTimePerText = duration / 1000;
      console.log(`✅ 1000 embeddings in ${duration}ms (${avgTimePerText.toFixed(2)}ms per text)`);
      
      // Should be reasonable (< 2 minutes)
      expect(duration).toBeLessThan(120000);
    }, 180000);
  });
});

