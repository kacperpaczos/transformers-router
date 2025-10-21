/**
 * Unit tests for logger functionality
 */

import { createDefaultLogger } from '../../src/infra/logging/defaultLogger';
import type { Logger } from '../../src/domain/logging/Logger';

// Mock console methods
const mockConsole = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock console globally
Object.defineProperty(global, 'console', {
  value: mockConsole,
  writable: true,
});

describe('Default Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createDefaultLogger', () => {
    it('should create logger with all required methods', () => {
      const logger = createDefaultLogger(true);

      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    describe('when debug=false', () => {
      const logger = createDefaultLogger(false);

      it('should not log debug messages', () => {
        logger.debug('test debug message');

        expect(mockConsole.debug).not.toHaveBeenCalled();
      });

      it('should not log info messages', () => {
        logger.info('test info message');

        expect(mockConsole.info).not.toHaveBeenCalled();
      });

      it('should not log warn messages', () => {
        logger.warn('test warn message');

        expect(mockConsole.warn).not.toHaveBeenCalled();
      });

      it('should log error messages', () => {
        logger.error('test error message');

        expect(mockConsole.error).toHaveBeenCalledWith('[ERROR]', 'test error message');
      });

      it('should log error with multiple arguments', () => {
        logger.error('Error:', 'details', { code: 500 });

        expect(mockConsole.error).toHaveBeenCalledWith('[ERROR]', 'Error:', 'details', { code: 500 });
      });
    });

    describe('when debug=true', () => {
      const logger = createDefaultLogger(true);

      it('should log debug messages', () => {
        logger.debug('test debug message');

        expect(mockConsole.debug).toHaveBeenCalledWith('[DEBUG]', 'test debug message');
      });

      it('should log info messages', () => {
        logger.info('test info message');

        expect(mockConsole.info).toHaveBeenCalledWith('[INFO]', 'test info message');
      });

      it('should log warn messages', () => {
        logger.warn('test warn message');

        expect(mockConsole.warn).toHaveBeenCalledWith('[WARN]', 'test warn message');
      });

      it('should log error messages', () => {
        logger.error('test error message');

        expect(mockConsole.error).toHaveBeenCalledWith('[ERROR]', 'test error message');
      });

      it('should handle complex debug messages', () => {
        logger.debug('User login attempt', { userId: 123, timestamp: Date.now() });

        expect(mockConsole.debug).toHaveBeenCalledWith('[DEBUG]', 'User login attempt', { userId: 123, timestamp: expect.any(Number) });
      });

      it('should handle empty arguments', () => {
        logger.info();

        expect(mockConsole.info).toHaveBeenCalledWith('[INFO]');
      });
    });

    describe('logger method signatures', () => {
      const logger = createDefaultLogger(true);

      it('should accept variable number of arguments', () => {
        logger.info('Message with', 'multiple', 'arguments', { data: 'test' });

        expect(mockConsole.info).toHaveBeenCalledWith('[INFO]', 'Message with', 'multiple', 'arguments', { data: 'test' });
      });

      it('should handle non-string arguments', () => {
        logger.warn(123, null, undefined, true, { complex: 'object' });

        expect(mockConsole.warn).toHaveBeenCalledWith('[WARN]', 123, null, undefined, true, { complex: 'object' });
      });
    });

    describe('logger consistency', () => {
      it('should maintain consistent behavior across debug modes', () => {
        const debugLogger = createDefaultLogger(true);
        const noDebugLogger = createDefaultLogger(false);

        // Test that both loggers have same interface
        expect(typeof debugLogger.debug).toBe(typeof noDebugLogger.debug);
        expect(typeof debugLogger.info).toBe(typeof noDebugLogger.info);
        expect(typeof debugLogger.warn).toBe(typeof noDebugLogger.warn);
        expect(typeof debugLogger.error).toBe(typeof noDebugLogger.error);

        // Test that error always logs regardless of debug mode
        debugLogger.error('test error');
        noDebugLogger.error('test error');

        expect(mockConsole.error).toHaveBeenCalledTimes(2);
        expect(mockConsole.error).toHaveBeenNthCalledWith(1, '[ERROR]', 'test error');
        expect(mockConsole.error).toHaveBeenNthCalledWith(2, '[ERROR]', 'test error');
      });
    });
  });

  describe('logger integration', () => {
    it('should be usable as Logger interface', () => {
      const logger = createDefaultLogger(true);

      // Type check - should satisfy Logger interface
      const loggerInterface: Logger = logger;

      expect(loggerInterface.debug).toBeDefined();
      expect(loggerInterface.info).toBeDefined();
      expect(loggerInterface.warn).toBeDefined();
      expect(loggerInterface.error).toBeDefined();
    });

    it('should work with different debug settings in sequence', () => {
      const debugLogger = createDefaultLogger(true);
      const noDebugLogger = createDefaultLogger(false);

      debugLogger.info('debug mode');
      noDebugLogger.info('no debug mode');
      debugLogger.error('error always shown');

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      expect(mockConsole.info).toHaveBeenCalledWith('[INFO]', 'debug mode');

      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      expect(mockConsole.error).toHaveBeenCalledWith('[ERROR]', 'error always shown');
    });
  });
});

