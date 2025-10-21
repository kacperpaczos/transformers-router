/**
 * Unit tests for domain errors
 */

import {
  ValidationError,
  ModelUnavailableError,
  ModelLoadError,
  ModelNotLoadedError,
  InferenceError,
  InitializationError,
  ConfigurationError,
} from '../../src/domain/errors';

describe('Domain Errors', () => {
  describe('ValidationError', () => {
    it('should create error with message and field', () => {
      const error = new ValidationError('Invalid field value', 'fieldName');

      expect(error.message).toBe('Invalid field value');
      expect(error.name).toBe('ValidationError');
      expect(error.field).toBe('fieldName');
    });

    it('should create error without field', () => {
      const error = new ValidationError('General validation error');

      expect(error.message).toBe('General validation error');
      expect(error.name).toBe('ValidationError');
      expect(error.field).toBeUndefined();
    });
  });

  describe('ModelUnavailableError', () => {
    it('should create error with model and modality', () => {
      const error = new ModelUnavailableError('Model not found', 'gpt2', 'llm');

      expect(error.message).toBe('Model not found');
      expect(error.name).toBe('ModelUnavailableError');
      expect(error.model).toBe('gpt2');
      expect(error.modality).toBe('llm');
    });
  });

  describe('ModelLoadError', () => {
    it('should create error with model, modality and original error', () => {
      const originalError = new Error('Network timeout');
      const error = new ModelLoadError('Failed to load model', 'gpt2', 'llm', originalError);

      expect(error.message).toBe('Failed to load model');
      expect(error.name).toBe('ModelLoadError');
      expect(error.model).toBe('gpt2');
      expect(error.modality).toBe('llm');
      expect(error.originalError).toBe(originalError);
    });

    it('should create error without original error', () => {
      const error = new ModelLoadError('Failed to load model', 'gpt2', 'llm');

      expect(error.message).toBe('Failed to load model');
      expect(error.name).toBe('ModelLoadError');
      expect(error.model).toBe('gpt2');
      expect(error.modality).toBe('llm');
      expect(error.originalError).toBeUndefined();
    });
  });

  describe('ModelNotLoadedError', () => {
    it('should create error with model and modality', () => {
      const error = new ModelNotLoadedError('Model not ready', 'gpt2', 'llm');

      expect(error.message).toBe('Model not ready');
      expect(error.name).toBe('ModelNotLoadedError');
      expect(error.model).toBe('gpt2');
      expect(error.modality).toBe('llm');
    });
  });

  describe('InferenceError', () => {
    it('should create error with modality and original error', () => {
      const originalError = new Error('GPU memory error');
      const error = new InferenceError('Inference failed', 'llm', originalError);

      expect(error.message).toBe('Inference failed');
      expect(error.name).toBe('InferenceError');
      expect(error.modality).toBe('llm');
      expect(error.originalError).toBe(originalError);
    });

    it('should create error without original error', () => {
      const error = new InferenceError('Inference failed', 'llm');

      expect(error.message).toBe('Inference failed');
      expect(error.name).toBe('InferenceError');
      expect(error.modality).toBe('llm');
      expect(error.originalError).toBeUndefined();
    });
  });

  describe('InitializationError', () => {
    it('should create error with original error', () => {
      const originalError = new Error('Config file not found');
      const error = new InitializationError('Init failed', originalError);

      expect(error.message).toBe('Init failed');
      expect(error.name).toBe('InitializationError');
      expect(error.originalError).toBe(originalError);
    });

    it('should create error without original error', () => {
      const error = new InitializationError('Init failed');

      expect(error.message).toBe('Init failed');
      expect(error.name).toBe('InitializationError');
      expect(error.originalError).toBeUndefined();
    });
  });

  describe('ConfigurationError', () => {
    it('should create error with config field', () => {
      const error = new ConfigurationError('Invalid config value', 'llm.model');

      expect(error.message).toBe('Invalid config value');
      expect(error.name).toBe('ConfigurationError');
      expect(error.configField).toBe('llm.model');
    });

    it('should create error without config field', () => {
      const error = new ConfigurationError('General config error');

      expect(error.message).toBe('General config error');
      expect(error.name).toBe('ConfigurationError');
      expect(error.configField).toBeUndefined();
    });
  });

  describe('Error inheritance', () => {
    it('should be instanceof Error', () => {
      const error = new ValidationError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ValidationError);
    });

    it('should have proper prototype chain', () => {
      const error = new ModelLoadError('Test error', 'model', 'llm');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ModelLoadError);
    });
  });
});

