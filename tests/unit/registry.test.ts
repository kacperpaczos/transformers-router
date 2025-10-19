/**
 * Unit tests for model registry functions
 */

import {
  registerModel,
  getRegisteredModels,
  getRegisteredModel,
  resetState
} from '../../src/app/state';
import type { ModelConfig } from '../../src/core/types';

describe('Model Registry', () => {
  const testModelConfig: ModelConfig = {
    model: 'test-model',
    dtype: 'q4',
    device: 'cpu',
  };

  beforeEach(() => {
    // Reset state before each test
    resetState();
  });

  describe('registerModel', () => {
    it('should register a model with name and config', () => {
      registerModel('test-model', testModelConfig);

      const registered = getRegisteredModel('test-model');
      expect(registered).toEqual(testModelConfig);
    });

    it('should allow overwriting existing model', () => {
      const config1 = { ...testModelConfig, model: 'model1' };
      const config2 = { ...testModelConfig, model: 'model2' };

      registerModel('test-model', config1);
      registerModel('test-model', config2);

      const registered = getRegisteredModel('test-model');
      expect(registered).toEqual(config2);
    });

    it('should register multiple different models', () => {
      const config1 = { ...testModelConfig, model: 'model1' };
      const config2 = { ...testModelConfig, model: 'model2' };

      registerModel('model1', config1);
      registerModel('model2', config2);

      expect(getRegisteredModel('model1')).toEqual(config1);
      expect(getRegisteredModel('model2')).toEqual(config2);
    });

    it('should handle empty model name', () => {
      registerModel('', testModelConfig);

      const registered = getRegisteredModel('');
      expect(registered).toEqual(testModelConfig);
    });

    it('should handle complex model configs', () => {
      const complexConfig: ModelConfig = {
        model: 'complex-model',
        dtype: 'fp16',
        device: 'gpu',
        performanceMode: 'auto',
        maxTokens: 100,
        temperature: 0.7,
      };

      registerModel('complex', complexConfig);

      const registered = getRegisteredModel('complex');
      expect(registered).toEqual(complexConfig);
    });
  });

  describe('getRegisteredModel', () => {
    it('should return undefined for non-existent model', () => {
      const result = getRegisteredModel('non-existent');
      expect(result).toBeUndefined();
    });

    it('should return correct model when it exists', () => {
      registerModel('test-model', testModelConfig);

      const result = getRegisteredModel('test-model');
      expect(result).toEqual(testModelConfig);
    });

    it('should return exact reference (not copy)', () => {
      registerModel('test-model', testModelConfig);

      const result1 = getRegisteredModel('test-model');
      const result2 = getRegisteredModel('test-model');

      expect(result1).toBe(result2); // Same reference
      expect(result1).toEqual(testModelConfig);
    });
  });

  describe('getRegisteredModels', () => {
    it('should return empty map when no models registered', () => {
      const models = getRegisteredModels();
      expect(models.size).toBe(0);
      expect(models).toBeInstanceOf(Map);
    });

    it('should return all registered models', () => {
      const config1 = { ...testModelConfig, model: 'model1' };
      const config2 = { ...testModelConfig, model: 'model2' };

      registerModel('model1', config1);
      registerModel('model2', config2);

      const models = getRegisteredModels();
      expect(models.size).toBe(2);
      expect(models.get('model1')).toEqual(config1);
      expect(models.get('model2')).toEqual(config2);
    });

    it('should return new Map instance each time (defensive copy)', () => {
      registerModel('test-model', testModelConfig);

      const models1 = getRegisteredModels();
      const models2 = getRegisteredModels();

      expect(models1).not.toBe(models2); // Different instances
      expect(models1.get('test-model')).toEqual(models2.get('test-model'));
    });

    it('should handle many models', () => {
      const models: Record<string, ModelConfig> = {};

      // Register 100 models
      for (let i = 0; i < 100; i++) {
        const config = { ...testModelConfig, model: `model-${i}` };
        models[`model-${i}`] = config;
        registerModel(`model-${i}`, config);
      }

      const registered = getRegisteredModels();
      expect(registered.size).toBe(100);

      // Verify all are present
      for (let i = 0; i < 100; i++) {
        expect(registered.get(`model-${i}`)).toEqual(models[`model-${i}`]);
      }
    });
  });

  describe('state management', () => {
    it('should persist models across multiple operations', () => {
      registerModel('model1', testModelConfig);
      registerModel('model2', { ...testModelConfig, model: 'model2' });

      // Multiple get operations
      expect(getRegisteredModel('model1')).toBeDefined();
      expect(getRegisteredModel('model2')).toBeDefined();

      const allModels = getRegisteredModels();
      expect(allModels.size).toBe(2);
    });

    it('should be cleared by resetState', () => {
      registerModel('test-model', testModelConfig);

      expect(getRegisteredModel('test-model')).toBeDefined();

      resetState();

      expect(getRegisteredModel('test-model')).toBeUndefined();
      expect(getRegisteredModels().size).toBe(0);
    });

    it('should handle register after reset', () => {
      registerModel('test-model', testModelConfig);
      resetState();

      registerModel('new-model', { ...testModelConfig, model: 'new-model' });

      expect(getRegisteredModel('test-model')).toBeUndefined();
      expect(getRegisteredModel('new-model')).toEqual({ ...testModelConfig, model: 'new-model' });
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined model config', () => {
      // This should not crash, but config will be null
      registerModel('null-config', null as any);

      const registered = getRegisteredModel('null-config');
      expect(registered).toBeNull();
    });

    it('should handle very long model names', () => {
      const longName = 'a'.repeat(1000);
      registerModel(longName, testModelConfig);

      expect(getRegisteredModel(longName)).toEqual(testModelConfig);
    });

    it('should handle special characters in model names', () => {
      const specialNames = ['model-with-dashes', 'model_with_underscores', 'model.with.dots', 'model/with/slashes'];

      specialNames.forEach(name => {
        registerModel(name, { ...testModelConfig, model: name });
        expect(getRegisteredModel(name)).toEqual({ ...testModelConfig, model: name });
      });
    });
  });
});

