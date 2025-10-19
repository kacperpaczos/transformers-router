/**
 * Model Manager for managing all AI models
 */

import type {
  Modality,
  ModelConfig,
  LLMConfig,
  TTSConfig,
  STTConfig,
  EmbeddingConfig,
  ModelStatus,
  Device,
} from '../core/types';
import { ModelCache } from './cache/ModelCache';
import { BaseModel } from '../models/BaseModel';
import { LLMModel } from '../models/LLMModel';
import { TTSModel } from '../models/TTSModel';
import { STTModel } from '../models/STTModel';
import { EmbeddingModel } from '../models/EmbeddingModel';
import { ProgressTracker } from '../utils/ProgressTracker';
import { EventEmitter } from '@infra/events/EventEmitter';
import { getConfig } from './state';
import { ModelUnavailableError } from '@domain/errors';

export class ModelManager {
  private cache: ModelCache;
  private models: Map<Modality, BaseModel>;
  private configs: Map<Modality, ModelConfig>;
  private progressTracker: ProgressTracker;
  private eventEmitter: EventEmitter;

  constructor(eventEmitter: EventEmitter) {
    this.cache = new ModelCache();
    this.models = new Map();
    this.configs = new Map();
    this.eventEmitter = eventEmitter;
    this.progressTracker = new ProgressTracker(eventEmitter);
  }

  /**
   * Load a model for a specific modality
   */
  async loadModel(
    modality: Modality,
    config: ModelConfig
  ): Promise<BaseModel> {
    // Check if model is already loaded with the same config
    const existingModel = this.models.get(modality);
    if (existingModel && this.isSameConfig(modality, config)) {
      return existingModel;
    }

    // Check cache
    const cached = this.cache.get(modality, config);
    if (cached) {
      const model = this.createModelInstance(modality, config);
      // Restore from cache
      model.setPipeline(cached.pipeline);
      this.models.set(modality, model);
      this.configs.set(modality, config);
      return model;
    }

    // Auto-scaler: optionally adjust config based on capabilities and performanceMode
    const scaledConfig = this.autoScaleConfig(modality, config);
    if (scaledConfig !== config) {
      const logger = getConfig().logger;
      logger.debug('[transformers-router] autoscale', {
        modality,
        from: config,
        to: scaledConfig,
      });
    }

    // Create and load new model
    const model = this.createModelInstance(modality, scaledConfig);

    // Create progress callback
    const progressCallback = this.progressTracker.createCallback(
      modality,
      config.model
    );

    try {
      await model.load(progressCallback);

      // Cache the model
      const pipeline = model.getRawPipeline();
      this.cache.set(modality, scaledConfig, pipeline);

      // Store in active models
      this.models.set(modality, model);
      this.configs.set(modality, scaledConfig);

      // Emit ready event
      this.eventEmitter.emit('ready', {
        modality,
        model: scaledConfig.model,
      });

      return model;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.eventEmitter.emit('error', {
        modality,
        error: err,
      });
      throw error;
    }
  }

  /**
   * Get a loaded model
   */
  getModel(modality: Modality): BaseModel | undefined {
    return this.models.get(modality);
  }

  /**
   * Get model or load it if not loaded
   */
  async getOrLoadModel(
    modality: Modality,
    config: ModelConfig
  ): Promise<BaseModel> {
    const existing = this.getModel(modality);
    if (existing && this.isSameConfig(modality, config)) {
      return existing;
    }
    return this.loadModel(modality, config);
  }

  /**
   * Unload a model
   */
  async unloadModel(modality: Modality): Promise<void> {
    const model = this.models.get(modality);
    if (model) {
      await model.unload();
      this.models.delete(modality);
      this.configs.delete(modality);

      this.eventEmitter.emit('unload', {
        modality,
      });
    }
  }

  /**
   * Check if a model is loaded
   */
  isLoaded(modality: Modality): boolean {
    const model = this.models.get(modality);
    return model?.isLoaded() ?? false;
  }

  /**
   * Get model status
   */
  getStatus(modality: Modality): ModelStatus {
    const model = this.models.get(modality);
    const config = this.configs.get(modality);

    if (!model) {
      return {
        modality,
        loaded: false,
        loading: false,
      };
    }

    return {
      modality,
      loaded: model.isLoaded(),
      loading: model.isLoading(),
      model: config?.model,
    };
  }

  /**
   * Get all model statuses
   */
  getAllStatuses(): ModelStatus[] {
    const modalities: Modality[] = ['llm', 'tts', 'stt', 'embedding'];
    return modalities.map((modality) => this.getStatus(modality));
  }

  /**
   * Clear all models and cache
   */
  async clearAll(): Promise<void> {
    const modalities = Array.from(this.models.keys());
    await Promise.all(modalities.map((modality) => this.unloadModel(modality)));
    this.cache.clear();
    this.progressTracker.clearAll();
  }

  /**
   * Clear cache only (keep loaded models)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Create model instance based on modality
   */
  private createModelInstance(
    modality: Modality,
    config: ModelConfig
  ): BaseModel {
    switch (modality) {
      case 'llm':
        return new LLMModel(config as LLMConfig);
      case 'tts':
        return new TTSModel(config as TTSConfig);
      case 'stt':
        return new STTModel(config as STTConfig);
      case 'embedding':
        return new EmbeddingModel(config as EmbeddingConfig);
      default:
        throw new ModelUnavailableError(`Unknown modality: ${modality}`, modality, modality);
    }
  }

  /**
   * Check if config is the same as currently loaded
   */
  private isSameConfig(modality: Modality, config: ModelConfig): boolean {
    const currentConfig = this.configs.get(modality);
    if (!currentConfig) {
      return false;
    }
    return currentConfig.model === config.model;
  }

  /**
   * Auto-scale config: choose device/dtype/maxTokens based on capabilities
   * Non-invasive: respects explicit user settings unless performanceMode === 'auto'
   */
  private autoScaleConfig(modality: Modality, config: ModelConfig): ModelConfig {
    const cfg = config as Partial<LLMConfig & TTSConfig & STTConfig & EmbeddingConfig> & { performanceMode?: 'auto' | 'fast' | 'quality' };
    const perfMode = cfg.performanceMode;
    if (perfMode !== 'auto') {
      return config;
    }

    const isBrowser = typeof navigator !== 'undefined';
    const hasWebGPU = isBrowser && 'gpu' in navigator;
    const cores = isBrowser ? (navigator.hardwareConcurrency || 2) : 2;
    const targetDevice: Device | 'wasm' = hasWebGPU ? 'webgpu' : 'wasm';

    const next: Partial<LLMConfig & TTSConfig & STTConfig & EmbeddingConfig> = { ...cfg };
    if (!next.device) next.device = targetDevice as Device;

    if (!next.dtype) {
      next.dtype = 'q4';
    }

    if (modality === 'llm' && (next as LLMConfig).maxTokens == null) {
      (next as LLMConfig).maxTokens = 20;
    }

    void cores; // reserved for future heuristics

    return next as ModelConfig;
  }
}
