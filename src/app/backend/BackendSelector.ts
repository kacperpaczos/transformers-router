/**
 * Backend Selector - wybór i konfiguracja backendu dla modeli AI
 *
 * Zawiera logikę wykrywania środowiska, określania kolejności fallbacku
 * oraz konfiguracji ONNX backendu (SIMD, threads, backendHint).
 */

import type { Device } from '../../core/types';

export interface EnvironmentInfo {
  isBrowser: boolean;
  hasWebGPU: boolean;
  cores: number;
}

export interface ONNXBackends {
  backendHint?: string;
  wasm?: {
    simd?: boolean;
    numThreads?: number;
  };
}

export interface TransformersEnv {
  backends?: {
    onnx?: ONNXBackends;
  };
}

export class BackendSelector {
  private environmentInfo: EnvironmentInfo | null = null;

  /**
   * Wykrywa środowisko i capabilities systemu
   */
  detectEnvironment(): EnvironmentInfo {
    if (this.environmentInfo) {
      return this.environmentInfo;
    }

    const isBrowser = typeof navigator !== 'undefined';
    let hasWebGPU = false;
    let cores = 2;

    if (isBrowser) {
      // Sprawdź WebGPU support
      hasWebGPU = 'gpu' in navigator;

      // Pobierz liczbę rdzeni CPU
      cores = navigator.hardwareConcurrency || 2;
    }

    this.environmentInfo = {
      isBrowser,
      hasWebGPU,
      cores,
    };

    return this.environmentInfo;
  }

  /**
   * Określa kolejność próbowania backendów na podstawie środowiska i żądanego urządzenia
   */
  getDeviceFallbackOrder(desiredDevice: Device | 'wasm'): string[] {
    const env = this.detectEnvironment();

    if (env.isBrowser) {
      // W przeglądarce: preferuj WebGPU, fallback do WASM, nigdy CPU
      if (desiredDevice === 'webgpu') {
        return env.hasWebGPU ? ['webgpu', 'wasm'] : ['wasm'];
      }
      if (desiredDevice === 'wasm') {
        return ['wasm'];
      }
      // Jeśli ktoś podał 'cpu' w przeglądarce, wymuś WASM
      return ['wasm'];
    } else {
      // Node.js: pozwól na fallback do CPU
      if (desiredDevice === 'webgpu') {
        return ['webgpu', 'cpu'];
      }
      if (desiredDevice === 'gpu') {
        return ['gpu', 'cpu'];
      }
      if (desiredDevice === 'cpu') {
        return ['cpu'];
      }
      // Dla innych wartości, dodaj fallback do CPU
      return [desiredDevice, 'cpu'];
    }
  }

  /**
   * Konfiguruje ONNX backend dla danego urządzenia
   */
  configureONNXBackend(device: string, env: TransformersEnv): void {
    if (!env?.backends?.onnx) {
      return;
    }

    const onnxBackends = env.backends.onnx as ONNXBackends;
    const environmentInfo = this.detectEnvironment();

    if (device === 'wasm') {
      // Konfiguracja WASM backendu
      if ('backendHint' in onnxBackends) {
        onnxBackends.backendHint = 'wasm';
      }

      if (onnxBackends.wasm) {
        onnxBackends.wasm.simd = true;
        onnxBackends.wasm.numThreads = Math.min(
          4,
          Math.max(1, environmentInfo.cores - 1)
        );
      }
    } else if (device === 'webgpu') {
      // Konfiguracja WebGPU backendu
      if ('backendHint' in onnxBackends) {
        onnxBackends.backendHint = 'webgpu';
      }
    }
  }

  /**
   * Konwertuje urządzenie dla pipeline API
   * 'wasm' → 'cpu' (pipeline API nie rozpoznaje 'wasm')
   */
  getPipelineDevice(device: string): Device {
    return device === 'wasm' ? 'cpu' : (device as Device);
  }

  /**
   * Resetuje cache informacji o środowisku (głównie do testów)
   */
  resetEnvironmentCache(): void {
    this.environmentInfo = null;
  }
}
