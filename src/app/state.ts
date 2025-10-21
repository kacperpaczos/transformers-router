import type { RuntimeConfig } from '@domain/config/Config';
import type { ModelConfig } from '../core/types';
import { InitializationError } from '@domain/errors';

let runtimeConfig: RuntimeConfig | null = null;
let initialized = false;
let registeredModels: Map<string, ModelConfig> = new Map();

export function setConfig(config: RuntimeConfig): void {
  runtimeConfig = config;
}

export function getConfig(): RuntimeConfig {
  if (!runtimeConfig) {
    throw new InitializationError('Library not initialized. Call init() first.');
  }
  return runtimeConfig;
}

export function isInitialized(): boolean {
  return initialized;
}

export function markInitialized(): void {
  initialized = true;
}

export function resetState(): void {
  runtimeConfig = null;
  initialized = false;
  registeredModels.clear();
}

export function registerModel(name: string, config: ModelConfig): void {
  registeredModels.set(name, config);
}

export function getRegisteredModels(): Map<string, ModelConfig> {
  return new Map(registeredModels);
}

export function getRegisteredModel(name: string): ModelConfig | undefined {
  return registeredModels.get(name);
}


