/**
 * Progress Tracker for monitoring model download and loading
 */

import type { Modality, ProgressInfo } from '../core/types';
import { EventEmitter } from '@infra/events/EventEmitter';

export class ProgressTracker {
  private eventEmitter: EventEmitter;
  private currentProgress: Map<string, ProgressInfo>;

  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;
    this.currentProgress = new Map();
  }

  /**
   * Create a progress callback for Transformers.js
   */
  createCallback(modality: Modality, model: string) {
    return (progress: {
      status: string;
      file?: string;
      progress?: number;
      loaded?: number;
      total?: number;
    }) => {
      const file = progress.file || 'model';
      const key = `${modality}:${model}:${file}`;

      let progressPercent = 0;
      let loaded = 0;
      let total = 0;

      if (progress.progress !== undefined) {
        progressPercent = progress.progress;
      } else if (progress.loaded !== undefined && progress.total !== undefined) {
        loaded = progress.loaded;
        total = progress.total;
        progressPercent = total > 0 ? (loaded / total) * 100 : 0;
      }

      const progressInfo: ProgressInfo = {
        modality,
        model,
        file,
        progress: Math.round(progressPercent),
        loaded,
        total,
        status: this.mapStatus(progress.status),
      };

      this.currentProgress.set(key, progressInfo);
      this.eventEmitter.emit('progress', progressInfo);
    };
  }

  /**
   * Map Transformers.js status to our status
   */
  private mapStatus(
    status: string
  ): 'downloading' | 'loading' | 'ready' | 'error' {
    switch (status) {
      case 'downloading':
      case 'download':
        return 'downloading';
      case 'progress':
      case 'loading':
      case 'initiate':
        return 'loading';
      case 'ready':
      case 'done':
        return 'ready';
      case 'error':
        return 'error';
      default:
        return 'loading';
    }
  }

  /**
   * Get current progress for a model
   */
  getProgress(modality: Modality, model: string): ProgressInfo[] {
    const prefix = `${modality}:${model}:`;
    const progress: ProgressInfo[] = [];

    for (const [key, info] of this.currentProgress.entries()) {
      if (key.startsWith(prefix)) {
        progress.push(info);
      }
    }

    return progress;
  }

  /**
   * Clear progress for a model
   */
  clearProgress(modality: Modality, model: string): void {
    const prefix = `${modality}:${model}:`;
    const keysToDelete: string[] = [];

    for (const key of this.currentProgress.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.currentProgress.delete(key));
  }

  /**
   * Clear all progress
   */
  clearAll(): void {
    this.currentProgress.clear();
  }
}

