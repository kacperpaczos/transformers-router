/**
 * Local Resource Usage Estimator for tracking system resources during vectorization
 */

import type {
  ResourceUsageSnapshot,
  VectorModality,
} from '../../core/types';
import type {
  ResourceUsageEstimator,
  ResourceLevel,
  ResourceUsageEventData,
  VectorizationErrorEventData,
  VectorIndexedEventData,
  VectorQueriedEventData,
  VectorDeletedEventData,
} from './ResourceUsageEstimator';

export class LocalResourceUsageEstimator implements ResourceUsageEstimator {
  private eventListeners: Map<string, Set<(data: any) => void>> = new Map();
  private measurementStartTimes: Map<string, number> = new Map();
  private quotaThresholds: { warn: number; high: number; critical: number };

  constructor(quotaThresholds: { warn: number; high: number; critical: number } = {
    warn: 0.7,
    high: 0.85,
    critical: 0.95,
  }) {
    this.quotaThresholds = quotaThresholds;
  }

  async initialize(): Promise<void> {
    // Setup periodic resource monitoring
    this.startPeriodicMonitoring();
  }

  async getUsageSnapshot(): Promise<ResourceUsageSnapshot> {
    const cpuMs = this.getCpuUsage();
    const memoryInfo = this.getMemoryInfo();
    const storageInfo = await this.getStorageInfo();
    const gpuInfo = this.getGpuInfo();

    return {
      cpuMs,
      memoryMB: memoryInfo?.usedMB,
      storageUsedMB: storageInfo.usedMB,
      storageLimitMB: storageInfo.limitMB,
      modelDownloadsMB: await this.getModelDownloadsSize(),
      gpu: gpuInfo,
      timestamp: Date.now(),
    };
  }

  checkThresholds(usage: ResourceUsageSnapshot): { level: ResourceLevel; exceeded: string[] } {
    const exceeded: string[] = [];
    let level: ResourceLevel = 'warn';

    // Check storage quota
    if (usage.storageLimitMB && usage.storageUsedMB) {
      const storageRatio = usage.storageUsedMB / usage.storageLimitMB;

      if (storageRatio >= this.quotaThresholds.critical) {
        level = 'critical';
        exceeded.push('storage');
      } else if (storageRatio >= this.quotaThresholds.high) {
        level = 'high';
        exceeded.push('storage');
      } else if (storageRatio >= this.quotaThresholds.warn) {
        level = 'warn';
        exceeded.push('storage');
      }
    }

    // Check memory usage
    if (usage.memoryMB) {
      const memoryRatio = usage.memoryMB / (navigator as any).deviceMemory * 1024; // Approximate max memory

      if (memoryRatio >= this.quotaThresholds.critical) {
        level = 'critical';
        exceeded.push('memory');
      } else if (memoryRatio >= this.quotaThresholds.high) {
        if (level !== 'critical') level = 'high';
        exceeded.push('memory');
      } else if (memoryRatio >= this.quotaThresholds.warn) {
        if (level === 'warn') level = 'warn';
        exceeded.push('memory');
      }
    }

    return { level, exceeded };
  }

  startMeasurement(operation: string): () => void {
    const startTime = performance.now();
    this.measurementStartTimes.set(operation, startTime);

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      this.measurementStartTimes.delete(operation);

      // Emit CPU usage event
      this.emit('resource:usage', {
        cpuMs: duration,
        timestamp: Date.now(),
      });
    };
  }

  on<T>(event: string, handler: (data: T) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(handler);
        if (listeners.size === 0) {
          this.eventListeners.delete(event);
        }
      }
    };
  }

  emit(event: string, data: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  async close(): Promise<void> {
    // Cleanup any resources
    this.eventListeners.clear();
    this.measurementStartTimes.clear();
  }

  // Event emission helpers
  emitResourceUsage(usage: ResourceUsageSnapshot): void {
    this.emit('resource:usage', usage);

    const { level, exceeded } = this.checkThresholds(usage);
    if (exceeded.length > 0) {
      this.emit('resource:quota-warning', { level, usage } as ResourceUsageEventData);
    }
  }

  emitVectorizationError(stage: 'preprocess' | 'embed' | 'store' | 'query', error: string, metadata?: Record<string, unknown>): void {
    this.emit('vector:error', { stage, error, metadata } as VectorizationErrorEventData);
  }

  emitVectorIndexed(count: number, modality: VectorModality): void {
    this.emit('vector:indexed', { count, modality } as VectorIndexedEventData);
  }

  emitVectorQueried(k: number, modality: VectorModality): void {
    this.emit('vector:queried', { k, modality } as VectorQueriedEventData);
  }

  emitVectorDeleted(count: number): void {
    this.emit('vector:deleted', { count } as VectorDeletedEventData);
  }

  private startPeriodicMonitoring(): void {
    // Monitor resources every 5 seconds
    setInterval(async () => {
      try {
        const usage = await this.getUsageSnapshot();
        this.emitResourceUsage(usage);
      } catch (error) {
        console.error('Error during resource monitoring:', error);
      }
    }, 5000);
  }

  private getCpuUsage(): number {
    // Measure CPU time since last measurement
    let totalTime = 0;
    for (const [operation, startTime] of this.measurementStartTimes) {
      totalTime += performance.now() - startTime;
    }
    return totalTime;
  }

  private getMemoryInfo(): { usedMB?: number; limitMB?: number } | null {
    // Use Performance API if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        usedMB: memory.usedJSHeapSize / (1024 * 1024),
        limitMB: memory.jsHeapSizeLimit / (1024 * 1024),
      };
    }

    // Fallback: estimate based on device memory
    if ('deviceMemory' in navigator) {
      return {
        usedMB: (navigator as any).deviceMemory * 1024 * 0.1, // Rough estimate
      };
    }

    return null;
  }

  private async getStorageInfo(): Promise<{ usedMB: number; limitMB?: number }> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          usedMB: (estimate.usage || 0) / (1024 * 1024),
          limitMB: estimate.quota ? estimate.quota / (1024 * 1024) : undefined,
        };
      }
    } catch (error) {
      console.warn('Storage estimation not available:', error);
    }

    // Fallback: estimate based on IndexedDB size
    return await this.estimateIndexedDBSize();
  }

  private async estimateIndexedDBSize(): Promise<{ usedMB: number; limitMB?: number }> {
    try {
      const databases = await indexedDB.databases?.() || [];

      let totalSize = 0;
      for (const db of databases) {
        if (db.name?.includes('TransformersRouterVectors')) {
          // Estimate size based on number of records (rough approximation)
          // In a real implementation, you'd track this more accurately
          totalSize += 50 * 1024 * 1024; // 50MB estimate for vector DB
          break;
        }
      }

      return {
        usedMB: totalSize / (1024 * 1024),
        limitMB: 100, // 100MB default limit
      };
    } catch (error) {
      return { usedMB: 0 };
    }
  }

  private async getModelDownloadsSize(): Promise<number> {
    // Estimate size of downloaded models
    // This would need to be tracked by the model loading system
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        // Rough estimate: models are typically 50-200MB
        return Math.max(0, (estimate.usage || 0) / (1024 * 1024) - 10); // Subtract ~10MB for app data
      }
    } catch (error) {
      console.warn('Model size estimation not available:', error);
    }

    return 0;
  }

  private getGpuInfo(): { backend: 'webgpu' | 'wasm'; usedMB?: number } | undefined {
    // Check if WebGPU is available and being used
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      return {
        backend: 'webgpu',
        usedMB: this.estimateGpuMemoryUsage(),
      };
    }

    return {
      backend: 'wasm',
    };
  }

  private estimateGpuMemoryUsage(): number | undefined {
    // This is a rough estimate - WebGPU doesn't expose memory usage directly
    // In practice, you'd need to track allocations
    return undefined;
  }
}
