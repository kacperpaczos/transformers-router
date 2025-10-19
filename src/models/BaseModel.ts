/**
 * Base Model class for all AI models
 */

import type { Modality, ModelConfig } from '../core/types';

export abstract class BaseModel<TConfig extends ModelConfig = ModelConfig> {
  protected pipeline: unknown | null = null;
  protected config: TConfig;
  protected modality: Modality;
  protected loaded = false;
  protected loading = false;

  constructor(modality: Modality, config: TConfig) {
    this.modality = modality;
    this.config = config;
  }

  /**
   * Load the model
   */
  abstract load(
    progressCallback?: (progress: {
      status: string;
      file?: string;
      progress?: number;
      loaded?: number;
      total?: number;
    }) => void
  ): Promise<void>;

  /**
   * Unload the model and free resources
   */
  async unload(): Promise<void> {
    this.pipeline = null;
    this.loaded = false;
    this.loading = false;
  }

  /**
   * Check if model is loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Check if model is currently loading
   */
  isLoading(): boolean {
    return this.loading;
  }

  /**
   * Get model configuration
   */
  getConfig(): TConfig {
    return this.config;
  }

  /**
   * Get modality
   */
  getModality(): Modality {
    return this.modality;
  }

  /**
   * Get the underlying pipeline
   */
  protected getPipeline(): unknown {
    if (!this.pipeline) {
      throw new Error(`Model not loaded: ${this.config.model}`);
    }
    return this.pipeline;
  }

  /**
   * Set the pipeline (for cache restoration)
   */
  setPipeline(pipeline: unknown): void {
    this.pipeline = pipeline;
    this.loaded = true;
  }

  /**
   * Get the raw pipeline (for caching)
   */
  getRawPipeline(): unknown {
    return this.pipeline;
  }

  /**
   * Ensure model is loaded before operation
   */
  protected async ensureLoaded(): Promise<void> {
    if (!this.loaded && !this.loading) {
      await this.load();
    }

    // Wait for loading to complete if in progress
    while (this.loading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!this.loaded) {
      throw new Error(`Failed to load model: ${this.config.model}`);
    }
  }
}
