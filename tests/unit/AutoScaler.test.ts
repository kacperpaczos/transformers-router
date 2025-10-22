import { AutoScaler } from '../../src/app/autoscaler/AutoScaler';
import { BackendSelector } from '../../src/app/backend/BackendSelector';
import type { LLMConfig, TTSConfig, STTConfig, EmbeddingConfig } from '../../src/core/types';

describe('AutoScaler', () => {
  let autoScaler: AutoScaler;
  let mockBackendSelector: jest.Mocked<BackendSelector>;

  beforeEach(() => {
    mockBackendSelector = {
      detectEnvironment: jest.fn().mockReturnValue({
        isBrowser: true,
        hasWebGPU: true,
        cores: 4
      })
    } as any;

    autoScaler = new AutoScaler(mockBackendSelector);
  });

  describe('autoScale', () => {
    describe('with performanceMode=auto', () => {
      it('should scale LLM config with browser and WebGPU', () => {
        const config: LLMConfig = {
          model: 'test-model',
          performanceMode: 'auto'
        };

        const scaled = autoScaler.autoScale('llm', config);

        expect(scaled).toEqual({
          model: 'test-model',
          performanceMode: 'auto',
          device: 'webgpu',
          dtype: 'q4',
          maxTokens: 20
        });
      });

      it('should scale LLM config with browser without WebGPU', () => {
        mockBackendSelector.detectEnvironment.mockReturnValue({
          isBrowser: true,
          hasWebGPU: false,
          cores: 4
        });

        const config: LLMConfig = {
          model: 'test-model',
          performanceMode: 'auto'
        };

        const scaled = autoScaler.autoScale('llm', config);

        expect(scaled).toEqual({
          model: 'test-model',
          performanceMode: 'auto',
          device: 'cpu',
          dtype: 'q4',
          maxTokens: 20
        });
      });

      it('should scale LLM config with Node.js environment', () => {
        mockBackendSelector.detectEnvironment.mockReturnValue({
          isBrowser: false,
          hasWebGPU: false,
          cores: 2
        });

        const config: LLMConfig = {
          model: 'test-model',
          performanceMode: 'auto'
        };

        const scaled = autoScaler.autoScale('llm', config);

        expect(scaled).toEqual({
          model: 'test-model',
          performanceMode: 'auto',
          device: 'cpu',
          dtype: 'q4',
          maxTokens: 20
        });
      });

      it('should not scale TTS config (no performanceMode)', () => {
        const config: TTSConfig = {
          model: 'test-tts-model'
        };

        const scaled = autoScaler.autoScale('tts', config);

        expect(scaled).toBe(config); // Same reference, no changes
        expect((scaled as any).maxTokens).toBeUndefined();
      });

      it('should scale STT config without maxTokens', () => {
        const config: STTConfig = {
          model: 'test-stt-model',
          performanceMode: 'auto'
        };

        const scaled = autoScaler.autoScale('stt', config);

        expect(scaled).toEqual({
          model: 'test-stt-model',
          performanceMode: 'auto',
          device: 'webgpu',
          dtype: 'q4'
        });
        expect((scaled as any).maxTokens).toBeUndefined();
      });

      it('should scale Embedding config without maxTokens', () => {
        const config: EmbeddingConfig = {
          model: 'test-embedding-model',
          performanceMode: 'auto'
        };

        const scaled = autoScaler.autoScale('embedding', config);

        expect(scaled).toEqual({
          model: 'test-embedding-model',
          performanceMode: 'auto',
          device: 'webgpu',
          dtype: 'q4'
        });
        expect((scaled as any).maxTokens).toBeUndefined();
      });

      it('should not override explicit device setting', () => {
        const config: LLMConfig = {
          model: 'test-model',
          performanceMode: 'auto',
          device: 'cpu'
        };

        const scaled = autoScaler.autoScale('llm', config);

        expect(scaled).toEqual({
          model: 'test-model',
          performanceMode: 'auto',
          device: 'cpu',
          dtype: 'q4',
          maxTokens: 20
        });
      });

      it('should not override explicit dtype setting', () => {
        const config: LLMConfig = {
          model: 'test-model',
          performanceMode: 'auto',
          dtype: 'fp32'
        };

        const scaled = autoScaler.autoScale('llm', config);

        expect(scaled).toEqual({
          model: 'test-model',
          performanceMode: 'auto',
          dtype: 'fp32',
          device: 'webgpu',
          maxTokens: 20
        });
      });

      it('should not override explicit maxTokens for LLM', () => {
        const config: LLMConfig = {
          model: 'test-model',
          performanceMode: 'auto',
          maxTokens: 100
        };

        const scaled = autoScaler.autoScale('llm', config);

        expect(scaled).toEqual({
          model: 'test-model',
          performanceMode: 'auto',
          maxTokens: 100,
          device: 'webgpu',
          dtype: 'q4'
        });
      });
    });

    describe('without performanceMode=auto', () => {
      it('should not scale when performanceMode is fast', () => {
        const config: LLMConfig = {
          model: 'test-model',
          performanceMode: 'fast'
        };

        const scaled = autoScaler.autoScale('llm', config);

        expect(scaled).toBe(config); // Same reference, no changes
      });

      it('should not scale when performanceMode is quality', () => {
        const config: LLMConfig = {
          model: 'test-model',
          performanceMode: 'quality'
        };

        const scaled = autoScaler.autoScale('llm', config);

        expect(scaled).toBe(config); // Same reference, no changes
      });

      it('should not scale when performanceMode is undefined', () => {
        const config: LLMConfig = {
          model: 'test-model'
        };

        const scaled = autoScaler.autoScale('llm', config);

        expect(scaled).toBe(config); // Same reference, no changes
      });
    });

    describe('modality-specific behavior', () => {
      it('should set maxTokens=20 for LLM modality', () => {
        const config: LLMConfig = {
          model: 'test-model',
          performanceMode: 'auto'
        };

        const scaled = autoScaler.autoScale('llm', config);

        expect((scaled as LLMConfig).maxTokens).toBe(20);
      });

      it('should not scale TTS modality (no performanceMode)', () => {
        const config: TTSConfig = {
          model: 'test-model'
        };

        const scaled = autoScaler.autoScale('tts', config);

        expect(scaled).toBe(config); // Same reference, no changes
        expect((scaled as any).maxTokens).toBeUndefined();
      });

      it('should not set maxTokens for STT modality', () => {
        const config: STTConfig = {
          model: 'test-model',
          performanceMode: 'auto'
        };

        const scaled = autoScaler.autoScale('stt', config);

        expect((scaled as any).maxTokens).toBeUndefined();
      });

      it('should not set maxTokens for Embedding modality', () => {
        const config: EmbeddingConfig = {
          model: 'test-model',
          performanceMode: 'auto'
        };

        const scaled = autoScaler.autoScale('embedding', config);

        expect((scaled as any).maxTokens).toBeUndefined();
      });
    });

    describe('edge cases', () => {
      it('should handle config with null maxTokens for LLM', () => {
        const config: LLMConfig = {
          model: 'test-model',
          performanceMode: 'auto',
          maxTokens: null as any
        };

        const scaled = autoScaler.autoScale('llm', config);

        expect((scaled as LLMConfig).maxTokens).toBe(20);
      });

      it('should handle config with undefined maxTokens for LLM', () => {
        const config: LLMConfig = {
          model: 'test-model',
          performanceMode: 'auto',
          maxTokens: undefined
        };

        const scaled = autoScaler.autoScale('llm', config);

        expect((scaled as LLMConfig).maxTokens).toBe(20);
      });

      it('should preserve all original config properties', () => {
        const config: LLMConfig = {
          model: 'test-model',
          performanceMode: 'auto',
          temperature: 0.7,
          topP: 0.9,
          repetitionPenalty: 1.1
        };

        const scaled = autoScaler.autoScale('llm', config);

        expect(scaled).toEqual({
          model: 'test-model',
          performanceMode: 'auto',
          temperature: 0.7,
          topP: 0.9,
          repetitionPenalty: 1.1,
          device: 'webgpu',
          dtype: 'q4',
          maxTokens: 20
        });
      });
    });
  });

  describe('setBackendSelector', () => {
    it('should allow setting a new BackendSelector', () => {
      const newBackendSelector = {
        detectEnvironment: jest.fn().mockReturnValue({
          isBrowser: false,
          hasWebGPU: false,
          cores: 8
        })
      } as any;

      autoScaler.setBackendSelector(newBackendSelector);

      const config: LLMConfig = {
        model: 'test-model',
        performanceMode: 'auto'
      };

      const scaled = autoScaler.autoScale('llm', config);

      expect(scaled.device).toBe('cpu'); // Node.js environment
      expect(newBackendSelector.detectEnvironment).toHaveBeenCalled();
    });
  });

  describe('integration with BackendSelector', () => {
    it('should use BackendSelector for device selection', () => {
      const config: LLMConfig = {
        model: 'test-model',
        performanceMode: 'auto'
      };

      autoScaler.autoScale('llm', config);

      expect(mockBackendSelector.detectEnvironment).toHaveBeenCalled();
    });

    it('should handle BackendSelector errors gracefully', () => {
      mockBackendSelector.detectEnvironment.mockImplementation(() => {
        throw new Error('BackendSelector error');
      });

      const config: LLMConfig = {
        model: 'test-model',
        performanceMode: 'auto'
      };

      expect(() => {
        autoScaler.autoScale('llm', config);
      }).toThrow('BackendSelector error');
    });
  });
});
