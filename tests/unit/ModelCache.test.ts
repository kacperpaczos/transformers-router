import { ModelCache } from '../../src/app/cache/ModelCache';
import type { LLMConfig } from '../../src/core/types';

describe('ModelCache', () => {
  let cache: ModelCache;

  const mockConfig: LLMConfig = {
    model: 'test-model',
    dtype: 'q4',
  };

  const mockPipeline = { mock: 'pipeline' };

  beforeEach(() => {
    cache = new ModelCache();
  });

  describe('Basic Operations', () => {
    it('should set and get a model', () => {
      cache.set('llm', mockConfig, mockPipeline);

      const cached = cache.get('llm', mockConfig);
      expect(cached).toBeDefined();
      expect(cached?.pipeline).toEqual(mockPipeline);
      expect(cached?.modality).toBe('llm');
    });

    it('should return undefined for non-existent model', () => {
      const cached = cache.get('llm', mockConfig);
      expect(cached).toBeUndefined();
    });

    it('should check if model exists', () => {
      cache.set('llm', mockConfig, mockPipeline);
      expect(cache.has('llm', mockConfig)).toBe(true);
    });

    it('should delete a model', () => {
      cache.set('llm', mockConfig, mockPipeline);
      const deleted = cache.delete('llm', mockConfig);

      expect(deleted).toBe(true);
      expect(cache.has('llm', mockConfig)).toBe(false);
    });

    it('should return false when deleting non-existent model', () => {
      const deleted = cache.delete('llm', mockConfig);
      expect(deleted).toBe(false);
    });
  });

  describe('Cache Size', () => {
    it('should return cache size', () => {
      expect(cache.size()).toBe(0);

      cache.set('llm', mockConfig, mockPipeline);
      expect(cache.size()).toBe(1);

      cache.set('tts', { model: 'tts-model' }, mockPipeline);
      expect(cache.size()).toBe(2);
    });

    it('should respect max size', () => {
      const limitedCache = new ModelCache({ maxSize: 2 });

      limitedCache.set('llm', { model: 'model-1' }, mockPipeline);
      limitedCache.set('tts', { model: 'model-2' }, mockPipeline);
      limitedCache.set('stt', { model: 'model-3' }, mockPipeline);

      // Should have evicted the oldest
      expect(limitedCache.size()).toBe(2);
    });
  });

  describe('Cache Clearing', () => {
    it('should clear all models', () => {
      cache.set('llm', mockConfig, mockPipeline);
      cache.set('tts', { model: 'tts-model' }, mockPipeline);

      cache.clear();

      expect(cache.size()).toBe(0);
    });
  });

  describe('Get All Models', () => {
    it('should get all cached models', () => {
      cache.set('llm', mockConfig, mockPipeline);
      cache.set('tts', { model: 'tts-model' }, mockPipeline);

      const all = cache.getAll();
      expect(all).toHaveLength(2);
    });

    it('should get models by modality', () => {
      cache.set('llm', { model: 'llm-1' }, mockPipeline);
      cache.set('llm', { model: 'llm-2' }, mockPipeline);
      cache.set('tts', { model: 'tts-1' }, mockPipeline);

      const llmModels = cache.getByModality('llm');
      expect(llmModels).toHaveLength(2);

      const ttsModels = cache.getByModality('tts');
      expect(ttsModels).toHaveLength(1);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire models based on TTL', async () => {
      const ttlCache = new ModelCache({ ttl: 100 }); // 100ms TTL

      ttlCache.set('llm', mockConfig, mockPipeline);
      expect(ttlCache.has('llm', mockConfig)).toBe(true);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      const cached = ttlCache.get('llm', mockConfig);
      expect(cached).toBeUndefined();
    });

    it('should not expire with TTL=0', async () => {
      cache.set('llm', mockConfig, mockPipeline);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(cache.has('llm', mockConfig)).toBe(true);
    });

    it('should cleanup expired models', async () => {
      const ttlCache = new ModelCache({ ttl: 100 });

      ttlCache.set('llm', { model: 'model-1' }, mockPipeline);
      ttlCache.set('tts', { model: 'model-2' }, mockPipeline);

      await new Promise((resolve) => setTimeout(resolve, 150));

      ttlCache.cleanup();
      expect(ttlCache.size()).toBe(0);
    });
  });

  describe('Last Used Time', () => {
    it('should update last used time on get', () => {
      cache.set('llm', mockConfig, mockPipeline);

      const first = cache.get('llm', mockConfig);
      const firstTime = first?.lastUsedAt;

      setTimeout(() => {
        const second = cache.get('llm', mockConfig);
        const secondTime = second?.lastUsedAt;

        expect(secondTime).toBeGreaterThanOrEqual(firstTime!);
      }, 10);
    });
  });
});

