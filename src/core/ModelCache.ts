/**
 * Model Cache for managing loaded Transformers.js models
 */

import type { Modality, CachedModel, ModelConfig } from './types';

export interface ModelCacheOptions {
  maxSize?: number; // Maximum number of cached models
  ttl?: number; // Time to live in milliseconds (0 = no expiration)
}

export class ModelCache {
  private cache: Map<string, CachedModel>;
  private options: Required<ModelCacheOptions>;

  constructor(options: ModelCacheOptions = {}) {
    this.cache = new Map();
    this.options = {
      maxSize: options.maxSize ?? 5,
      ttl: options.ttl ?? 0, // No expiration by default
    };
  }

  /**
   * Generate cache key from modality and config
   */
  private getCacheKey(modality: Modality, config: ModelConfig): string {
    const modelId = (config as { model: string }).model;
    return `${modality}:${modelId}`;
  }

  /**
   * Set a model in the cache
   */
  set(modality: Modality, config: ModelConfig, pipeline: unknown): void {
    const key = this.getCacheKey(modality, config);
    const now = Date.now();

    // Check if we need to evict old entries
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }

    const cachedModel: CachedModel = {
      modality,
      pipeline,
      config,
      loadedAt: now,
      lastUsedAt: now,
    };

    this.cache.set(key, cachedModel);
  }

  /**
   * Get a model from the cache
   */
  get(modality: Modality, config: ModelConfig): CachedModel | undefined {
    const key = this.getCacheKey(modality, config);
    const cachedModel = this.cache.get(key);

    if (!cachedModel) {
      return undefined;
    }

    // Check TTL
    if (this.options.ttl > 0) {
      const age = Date.now() - cachedModel.loadedAt;
      if (age > this.options.ttl) {
        this.cache.delete(key);
        return undefined;
      }
    }

    // Update last used time
    cachedModel.lastUsedAt = Date.now();

    return cachedModel;
  }

  /**
   * Check if a model is in the cache
   */
  has(modality: Modality, config: ModelConfig): boolean {
    return this.get(modality, config) !== undefined;
  }

  /**
   * Delete a model from the cache
   */
  delete(modality: Modality, config: ModelConfig): boolean {
    const key = this.getCacheKey(modality, config);
    return this.cache.delete(key);
  }

  /**
   * Clear all cached models
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Evict the oldest (least recently used) model
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, model] of this.cache.entries()) {
      if (model.lastUsedAt < oldestTime) {
        oldestTime = model.lastUsedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get all cached models
   */
  getAll(): CachedModel[] {
    return Array.from(this.cache.values());
  }

  /**
   * Get cached models by modality
   */
  getByModality(modality: Modality): CachedModel[] {
    return Array.from(this.cache.values()).filter(
      (model) => model.modality === modality
    );
  }

  /**
   * Clean up expired models based on TTL
   */
  cleanup(): void {
    if (this.options.ttl === 0) {
      return;
    }

    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, model] of this.cache.entries()) {
      const age = now - model.loadedAt;
      if (age > this.options.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
  }
}

