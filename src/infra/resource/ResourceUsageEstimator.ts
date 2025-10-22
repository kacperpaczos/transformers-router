/**
 * Resource Usage Estimator for tracking system resources during vectorization
 */

import type { ResourceUsageSnapshot } from '../../core/types';

export type ResourceLevel = 'warn' | 'high' | 'critical';

export interface ResourceUsageEventData {
  level: ResourceLevel;
  usage: ResourceUsageSnapshot;
}

export interface VectorizationErrorEventData {
  stage: 'preprocess' | 'embed' | 'store' | 'query';
  error: string;
  metadata?: Record<string, unknown>;
}

export interface VectorIndexedEventData {
  count: number;
  modality: import('../../core/types').VectorModality;
}

export interface VectorQueriedEventData {
  k: number;
  modality: import('../../core/types').VectorModality;
}

export interface VectorDeletedEventData {
  count: number;
}

export interface ResourceUsageEstimator {
  /**
   * Initialize the estimator
   */
  initialize(): Promise<void>;

  /**
   * Get current resource usage snapshot
   */
  getUsageSnapshot(): Promise<ResourceUsageSnapshot>;

  /**
   * Check if usage exceeds thresholds
   */
  checkThresholds(usage: ResourceUsageSnapshot): { level: ResourceLevel; exceeded: string[] };

  /**
   * Start measuring resource usage for an operation
   */
  startMeasurement(operation: string): () => void;

  /**
   * Register event handlers
   */
  on<T>(event: string, handler: (data: T) => void): () => void;

  /**
   * Emit events
   */
  emit(event: string, data: unknown): void;

  /**
   * Close and cleanup
   */
  close(): Promise<void>;
}
