/**
 * Unit tests for init() and dispose() functions
 */

import { init, dispose } from '../../src/app/init';
import { isInitialized, getConfig, resetState } from '../../src/app/state';
import type { Logger } from '../../src/domain/logging/Logger';
import type { InitOptions } from '../../src/domain/config/Config';

// Mock the logger to capture calls
const mockLogger: Logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock the createDefaultLogger function
jest.mock('../../src/infra/logging/defaultLogger', () => ({
  createDefaultLogger: jest.fn((debug: boolean) => mockLogger),
}));

describe('init() and dispose()', () => {
  beforeEach(() => {
    // Reset state before each test
    resetState();
    jest.clearAllMocks();
  });

  describe('init()', () => {
    it('should initialize with default options', async () => {
      await init();

      expect(isInitialized()).toBe(true);
      const config = getConfig();
      expect(config.debug).toBe(false);
      expect(config.logger).toBeDefined();
      expect(config.logger.info).toHaveBeenCalledWith('Library initialized successfully');
    });

    it('should be idempotent - multiple calls should not fail', async () => {
      await init();
      await init();
      await init();

      expect(isInitialized()).toBe(true);
      const config = getConfig();
      expect(config.logger.info).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should accept custom debug option', async () => {
      await init({ debug: true });

      const config = getConfig();
      expect(config.debug).toBe(true);
    });

    it('should accept custom logger', async () => {
      await init({ logger: mockLogger });

      const config = getConfig();
      expect(config.logger).toBe(mockLogger);
    });

    it('should handle models array option', async () => {
      await init({ models: ['model1', 'model2'] });

      const config = getConfig();
      expect(config.logger.debug).toHaveBeenCalledWith('Registering model: model1');
      expect(config.logger.debug).toHaveBeenCalledWith('Registering model: model2');
    });

    it('should throw error when accessing config before init', () => {
      expect(() => getConfig()).toThrow('Library not initialized');
    });
  });

  describe('dispose()', () => {
    it('should reset state after dispose', async () => {
      await init();
      expect(isInitialized()).toBe(true);

      await dispose();
      expect(isInitialized()).toBe(false);

      // Should be able to initialize again after dispose
      await init();
      expect(isInitialized()).toBe(true);
    });

    it('should handle multiple dispose calls gracefully', async () => {
      await init();
      await dispose();
      await dispose();
      await dispose();

      expect(isInitialized()).toBe(false);
    });
  });

  describe('integration with logger', () => {
    it('should use default logger when debug=true', async () => {
      await init({ debug: true });

      const config = getConfig();
      expect(config.debug).toBe(true);
      expect(config.logger).toBeDefined();
    });

    it('should override default logger with custom one', async () => {
      await init({ debug: true, logger: mockLogger });

      const config = getConfig();
      expect(config.logger).toBe(mockLogger);
      expect(config.debug).toBe(true);
    });

    it('should use custom logger even when debug=false', async () => {
      await init({ debug: false, logger: mockLogger });

      const config = getConfig();
      expect(config.logger).toBe(mockLogger);
      expect(config.debug).toBe(false);
    });
  });
});
