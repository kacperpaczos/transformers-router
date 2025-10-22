import { BackendSelector } from '../../src/app/backend/BackendSelector';
import type { TransformersEnv } from '../../src/app/backend/BackendSelector';

describe('BackendSelector', () => {
  let backendSelector: BackendSelector;

  beforeEach(() => {
    backendSelector = new BackendSelector();
    // Reset environment cache before each test
    backendSelector.resetEnvironmentCache();
  });

  describe('detectEnvironment', () => {
    it('should detect browser environment with WebGPU', () => {
      // Mock browser environment with WebGPU
      const originalNavigator = global.navigator;
      const mockNavigator = {
        hardwareConcurrency: 8,
        gpu: {
          requestAdapter: jest.fn().mockResolvedValue({})
        }
      };
      Object.defineProperty(global, 'navigator', {
        value: mockNavigator,
        writable: true
      });

      const env = backendSelector.detectEnvironment();

      expect(env.isBrowser).toBe(true);
      expect(env.hasWebGPU).toBe(true);
      expect(env.cores).toBe(8);

      // Restore original navigator
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true
      });
    });

    it('should detect browser environment without WebGPU', () => {
      // Mock browser environment without WebGPU
      const originalNavigator = global.navigator;
      const mockNavigator = {
        hardwareConcurrency: 4
      };
      Object.defineProperty(global, 'navigator', {
        value: mockNavigator,
        writable: true
      });

      const env = backendSelector.detectEnvironment();

      expect(env.isBrowser).toBe(true);
      expect(env.hasWebGPU).toBe(false);
      expect(env.cores).toBe(4);

      // Restore original navigator
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true
      });
    });

    it('should detect Node.js environment', () => {
      // Mock Node.js environment (no navigator)
      const originalNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true
      });

      const env = backendSelector.detectEnvironment();

      expect(env.isBrowser).toBe(false);
      expect(env.hasWebGPU).toBe(false);
      expect(env.cores).toBe(2);

      // Restore original navigator
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true
      });
    });

    it('should handle missing hardwareConcurrency', () => {
      // Mock browser environment without hardwareConcurrency
      const originalNavigator = global.navigator;
      const mockNavigator = {
        gpu: {
          requestAdapter: jest.fn().mockResolvedValue({})
        }
      };
      Object.defineProperty(global, 'navigator', {
        value: mockNavigator,
        writable: true
      });

      const env = backendSelector.detectEnvironment();

      expect(env.isBrowser).toBe(true);
      expect(env.hasWebGPU).toBe(true);
      expect(env.cores).toBe(2); // Default value

      // Restore original navigator
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true
      });
    });

    it('should cache environment info', () => {
      // Mock browser environment
      const originalNavigator = global.navigator;
      const mockNavigator = {
        hardwareConcurrency: 6,
        gpu: {
          requestAdapter: jest.fn().mockResolvedValue({})
        }
      };
      Object.defineProperty(global, 'navigator', {
        value: mockNavigator,
        writable: true
      });

      const env1 = backendSelector.detectEnvironment();
      const env2 = backendSelector.detectEnvironment();

      expect(env1).toBe(env2); // Same object reference

      // Restore original navigator
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true
      });
    });
  });

  describe('getDeviceFallbackOrder', () => {
    beforeEach(() => {
      // Mock browser environment for these tests
      const originalNavigator = global.navigator;
      const mockNavigator = {
        hardwareConcurrency: 4,
        gpu: {
          requestAdapter: jest.fn().mockResolvedValue({})
        }
      };
      Object.defineProperty(global, 'navigator', {
        value: mockNavigator,
        writable: true
      });
    });

    afterEach(() => {
      // Restore original navigator
      const originalNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true
      });
    });

    it('should return correct order for browser with WebGPU and webgpu request', () => {
      const order = backendSelector.getDeviceFallbackOrder('webgpu');
      expect(order).toEqual(['webgpu', 'wasm']);
    });

    it('should return correct order for browser with WebGPU and wasm request', () => {
      const order = backendSelector.getDeviceFallbackOrder('wasm');
      expect(order).toEqual(['wasm']);
    });

    it('should return correct order for browser with WebGPU and cpu request', () => {
      const order = backendSelector.getDeviceFallbackOrder('cpu');
      expect(order).toEqual(['wasm']); // Browser coerces CPU to WASM
    });

    it('should return correct order for browser without WebGPU and webgpu request', () => {
      // Mock browser without WebGPU
      const originalNavigator = global.navigator;
      const mockNavigator = {
        hardwareConcurrency: 4
      };
      Object.defineProperty(global, 'navigator', {
        value: mockNavigator,
        writable: true
      });

      const order = backendSelector.getDeviceFallbackOrder('webgpu');
      expect(order).toEqual(['wasm']);

      // Restore original navigator
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true
      });
    });

    it('should return correct order for Node.js with webgpu request', () => {
      // Mock Node.js environment
      const originalNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true
      });

      const order = backendSelector.getDeviceFallbackOrder('webgpu');
      expect(order).toEqual(['webgpu', 'cpu']);

      // Restore original navigator
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true
      });
    });

    it('should return correct order for Node.js with gpu request', () => {
      // Mock Node.js environment
      const originalNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true
      });

      const order = backendSelector.getDeviceFallbackOrder('gpu');
      expect(order).toEqual(['gpu', 'cpu']);

      // Restore original navigator
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true
      });
    });

    it('should return correct order for Node.js with cpu request', () => {
      // Mock Node.js environment
      const originalNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true
      });

      const order = backendSelector.getDeviceFallbackOrder('cpu');
      expect(order).toEqual(['cpu']);

      // Restore original navigator
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true
      });
    });
  });

  describe('configureONNXBackend', () => {
    let mockEnv: TransformersEnv;

    beforeEach(() => {
      mockEnv = {
        backends: {
          onnx: {
            backendHint: 'cpu',
            wasm: {
              simd: false,
              numThreads: 1
            }
          }
        }
      };
    });

    it('should configure WASM backend correctly', () => {
      // Mock browser environment with 8 cores
      const originalNavigator = global.navigator;
      const mockNavigator = {
        hardwareConcurrency: 8
      };
      Object.defineProperty(global, 'navigator', {
        value: mockNavigator,
        writable: true
      });

      backendSelector.configureONNXBackend('wasm', mockEnv);

      expect(mockEnv.backends?.onnx?.backendHint).toBe('wasm');
      expect(mockEnv.backends?.onnx?.wasm?.simd).toBe(true);
      expect(mockEnv.backends?.onnx?.wasm?.numThreads).toBe(4); // min(4, 8-1) = 4

      // Restore original navigator
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true
      });
    });

    it('should configure WASM backend with limited cores', () => {
      // Mock browser environment with 2 cores
      const originalNavigator = global.navigator;
      const mockNavigator = {
        hardwareConcurrency: 2
      };
      Object.defineProperty(global, 'navigator', {
        value: mockNavigator,
        writable: true
      });

      backendSelector.configureONNXBackend('wasm', mockEnv);

      expect(mockEnv.backends?.onnx?.backendHint).toBe('wasm');
      expect(mockEnv.backends?.onnx?.wasm?.simd).toBe(true);
      expect(mockEnv.backends?.onnx?.wasm?.numThreads).toBe(1); // min(4, 2-1) = 1

      // Restore original navigator
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true
      });
    });

    it('should configure WebGPU backend correctly', () => {
      backendSelector.configureONNXBackend('webgpu', mockEnv);

      expect(mockEnv.backends?.onnx?.backendHint).toBe('webgpu');
      // WASM config should remain unchanged
      expect(mockEnv.backends?.onnx?.wasm?.simd).toBe(false);
      expect(mockEnv.backends?.onnx?.wasm?.numThreads).toBe(1);
    });

    it('should handle missing ONNX backends', () => {
      const envWithoutONNX: TransformersEnv = {
        backends: {}
      };

      expect(() => {
        backendSelector.configureONNXBackend('wasm', envWithoutONNX);
      }).not.toThrow();
    });

    it('should handle missing backends entirely', () => {
      const envWithoutBackends: TransformersEnv = {};

      expect(() => {
        backendSelector.configureONNXBackend('wasm', envWithoutBackends);
      }).not.toThrow();
    });
  });

  describe('getPipelineDevice', () => {
    it('should convert wasm to cpu', () => {
      const device = backendSelector.getPipelineDevice('wasm');
      expect(device).toBe('cpu');
    });

    it('should pass through other devices', () => {
      expect(backendSelector.getPipelineDevice('webgpu')).toBe('webgpu');
      expect(backendSelector.getPipelineDevice('gpu')).toBe('gpu');
      expect(backendSelector.getPipelineDevice('cpu')).toBe('cpu');
    });
  });

  describe('resetEnvironmentCache', () => {
    it('should reset cached environment info', () => {
      // Mock browser environment
      const originalNavigator = global.navigator;
      const mockNavigator = {
        hardwareConcurrency: 4,
        gpu: {
          requestAdapter: jest.fn().mockResolvedValue({})
        }
      };
      Object.defineProperty(global, 'navigator', {
        value: mockNavigator,
        writable: true
      });

      const env1 = backendSelector.detectEnvironment();
      backendSelector.resetEnvironmentCache();
      const env2 = backendSelector.detectEnvironment();

      expect(env1).not.toBe(env2); // Different object references
      expect(env1).toEqual(env2); // But same content

      // Restore original navigator
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true
      });
    });
  });
});
