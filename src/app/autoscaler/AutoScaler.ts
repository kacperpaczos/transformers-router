/**
 * AutoScaler - automatyczne skalowanie konfiguracji modeli AI
 *
 * Wybiera optymalne ustawienia device, dtype i maxTokens na podstawie
 * capabilities systemu i trybu wydajności.
 */

import type {
  Modality,
  ModelConfig,
  LLMConfig,
  TTSConfig,
  STTConfig,
  EmbeddingConfig,
  Device,
  DType,
} from '../../core/types';
import { BackendSelector } from '../backend/BackendSelector';

export class AutoScaler {
  private backendSelector: BackendSelector;

  constructor(backendSelector?: BackendSelector) {
    this.backendSelector = backendSelector || new BackendSelector();
  }

  /**
   * Główna metoda skalowania konfiguracji modelu
   */
  autoScale(modality: Modality, config: ModelConfig): ModelConfig {
    const cfg = config as Partial<
      LLMConfig & TTSConfig & STTConfig & EmbeddingConfig
    > & {
      performanceMode?: 'auto' | 'fast' | 'quality';
    };

    // Jeśli performanceMode nie jest 'auto', nie skaluj
    if (!this.shouldAutoScale(cfg)) {
      return config;
    }

    // Utwórz nową konfigurację z domyślnymi wartościami
    const scaledConfig: Partial<
      LLMConfig & TTSConfig & STTConfig & EmbeddingConfig
    > = {
      ...cfg,
    };

    // Wybierz device jeśli nie został podany
    if (!scaledConfig.device) {
      scaledConfig.device = this.selectDevice();
    }

    // Wybierz dtype jeśli nie został podany
    if (!scaledConfig.dtype) {
      scaledConfig.dtype = this.selectDType();
    }

    // Wybierz maxTokens dla LLM jeśli nie został podany
    if (modality === 'llm') {
      const llmConfig = scaledConfig as LLMConfig;
      if (llmConfig.maxTokens == null) {
        llmConfig.maxTokens = this.selectMaxTokens(modality);
      }
    }

    return scaledConfig as ModelConfig;
  }

  /**
   * Sprawdza czy konfiguracja powinna być skalowana automatycznie
   */
  private shouldAutoScale(
    config: Partial<LLMConfig & TTSConfig & STTConfig & EmbeddingConfig>
  ): boolean {
    // TTS nie ma performanceMode, więc nie skaluj automatycznie
    if ('speaker' in config || 'sampleRate' in config) {
      return false;
    }
    return config.performanceMode === 'auto';
  }

  /**
   * Wybiera optymalne urządzenie na podstawie środowiska
   */
  private selectDevice(): Device {
    const env = this.backendSelector.detectEnvironment();

    if (env.isBrowser) {
      return env.hasWebGPU ? 'webgpu' : 'cpu';
    } else {
      return 'cpu';
    }
  }

  /**
   * Wybiera optymalny typ danych
   */
  private selectDType(): DType {
    return 'q4';
  }

  /**
   * Wybiera maksymalną liczbę tokenów dla LLM
   */
  private selectMaxTokens(modality: Modality): number | undefined {
    if (modality === 'llm') {
      return 20;
    }
    return undefined;
  }

  /**
   * Ustawia nowy BackendSelector (głównie do testów)
   */
  setBackendSelector(backendSelector: BackendSelector): void {
    this.backendSelector = backendSelector;
  }
}
