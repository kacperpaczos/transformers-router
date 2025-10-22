/**
 * Progress Tracker for vectorization jobs with detailed stage tracking
 */

import type {
  VectorizationStage,
  JobStatus,
  ProgressEventData,
  VectorModality,
  VectorizeOptions,
  QueryVectorizeOptions,
} from '../core/types';

export interface JobMetadata {
  jobId: string;
  input: File | string | ArrayBuffer;
  options: VectorizeOptions | QueryVectorizeOptions;
  startTime: number;
  status: JobStatus;
  currentStage: VectorizationStage;
  stageWeights: Record<VectorizationStage, number>;
  totalStages: number;
  stageStartTimes: Map<VectorizationStage, number>;
  bytesProcessed: number;
  itemsProcessed: number;
  chunksTotal?: number;
  warnings: string[];
  partialResult: {
    indexedIds: string[];
    failedItems: string[];
  };
}

export interface StageProgress {
  stage: VectorizationStage;
  progress: number; // 0-1
  message?: string;
  itemsProcessed?: number;
  bytesProcessed?: number;
  etaMs?: number;
}

export class ProgressTracker {
  private jobs: Map<string, JobMetadata> = new Map();
  private eventListeners: Map<string, Set<(data: ProgressEventData) => void>> =
    new Map();
  private nextJobId = 0;

  /**
   * Create a new vectorization job
   */
  createJob(
    input: File | string | ArrayBuffer,
    options: VectorizeOptions | QueryVectorizeOptions,
    stageWeights: Record<VectorizationStage, number>
  ): string {
    const jobId = `job_${++this.nextJobId}`;
    const totalStages = Object.keys(stageWeights).length;

    const job: JobMetadata = {
      jobId,
      input,
      options,
      startTime: performance.now(),
      status: 'queued',
      currentStage: 'queued',
      stageWeights,
      totalStages,
      stageStartTimes: new Map(),
      bytesProcessed: 0,
      itemsProcessed: 0,
      warnings: [],
      partialResult: {
        indexedIds: [],
        failedItems: [],
      },
    };

    this.jobs.set(jobId, job);

    // Emit job start
    this.emit('job:start', {
      jobId,
      inputMeta: this.getInputMeta(input),
      stage: 'queued',
      stageIndex: 0,
      totalStages,
      stageProgress: 0,
      progress: 0,
    });

    return jobId;
  }

  /**
   * Start a stage for a job
   */
  startStage(jobId: string, stage: VectorizationStage): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.currentStage = stage;
    job.stageStartTimes.set(stage, performance.now());

    const stageIndex = this.getStageIndex(stage, job.stageWeights);

    this.emit('stage:start', {
      jobId,
      inputMeta: this.getInputMeta(job.input),
      stage,
      stageIndex,
      totalStages: job.totalStages,
      stageProgress: 0,
      progress: this.calculateGlobalProgress(job),
    });
  }

  /**
   * Update progress for current stage
   */
  updateProgress(
    jobId: string,
    stageProgress: number,
    options: {
      message?: string;
      itemsProcessed?: number;
      bytesProcessed?: number;
      etaMs?: number;
    } = {}
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    if (options.itemsProcessed !== undefined) {
      job.itemsProcessed = options.itemsProcessed;
    }
    if (options.bytesProcessed !== undefined) {
      job.bytesProcessed = options.bytesProcessed;
    }

    const stageIndex = this.getStageIndex(job.currentStage, job.stageWeights);

    this.emit('stage:progress', {
      jobId,
      inputMeta: this.getInputMeta(job.input),
      stage: job.currentStage,
      stageIndex,
      totalStages: job.totalStages,
      stageProgress,
      progress: this.calculateGlobalProgress(job),
      etaMs: options.etaMs,
      itemsProcessed: job.itemsProcessed,
      bytesProcessed: job.bytesProcessed,
      message: options.message,
    });
  }

  /**
   * Complete current stage
   */
  completeStage(
    jobId: string,
    partialResult?: { indexedIds?: string[]; failedItems?: string[] }
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    if (partialResult?.indexedIds) {
      job.partialResult.indexedIds.push(...partialResult.indexedIds);
    }
    if (partialResult?.failedItems) {
      job.partialResult.failedItems.push(...partialResult.failedItems);
    }

    const stageIndex = this.getStageIndex(job.currentStage, job.stageWeights);

    this.emit('stage:end', {
      jobId,
      inputMeta: this.getInputMeta(job.input),
      stage: job.currentStage,
      stageIndex,
      totalStages: job.totalStages,
      stageProgress: 1,
      progress: this.calculateGlobalProgress(job),
      partialResult: { ...job.partialResult },
    });
  }

  /**
   * Add warning to job
   */
  addWarning(jobId: string, warning: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.warnings.push(warning);

    this.emit('warning', {
      jobId,
      inputMeta: this.getInputMeta(job.input),
      stage: job.currentStage,
      stageIndex: this.getStageIndex(job.currentStage, job.stageWeights),
      totalStages: job.totalStages,
      stageProgress: 0,
      progress: this.calculateGlobalProgress(job),
      warnings: job.warnings,
    });
  }

  /**
   * Complete job with error
   */
  completeWithError(
    jobId: string,
    stage: VectorizationStage,
    error: string,
    retriable = false
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'error';

    this.emit('error', {
      jobId,
      inputMeta: this.getInputMeta(job.input),
      stage,
      stageIndex: this.getStageIndex(stage, job.stageWeights),
      totalStages: job.totalStages,
      stageProgress: 0,
      progress: this.calculateGlobalProgress(job),
      error: {
        stage,
        message: error,
        retriable,
      },
    });

    this.emit('job:complete', {
      jobId,
      inputMeta: this.getInputMeta(job.input),
      stage,
      stageIndex: this.getStageIndex(stage, job.stageWeights),
      totalStages: job.totalStages,
      stageProgress: 0,
      progress: this.calculateGlobalProgress(job),
      partialResult: { ...job.partialResult },
      error: {
        stage,
        message: error,
        retriable,
      },
    });
  }

  /**
   * Complete job successfully
   */
  completeJob(
    jobId: string,
    finalResult?: { indexedIds?: string[]; failedItems?: string[] }
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'completed';

    if (finalResult?.indexedIds) {
      job.partialResult.indexedIds.push(...finalResult.indexedIds);
    }
    if (finalResult?.failedItems) {
      job.partialResult.failedItems.push(...finalResult.failedItems);
    }

    const stageIndex = this.getStageIndex('finalizing', job.stageWeights);

    this.emit('job:complete', {
      jobId,
      inputMeta: this.getInputMeta(job.input),
      stage: 'completed',
      stageIndex,
      totalStages: job.totalStages,
      stageProgress: 1,
      progress: 1,
      partialResult: { ...job.partialResult },
    });

    // Clean up job after completion
    setTimeout(() => {
      this.jobs.delete(jobId);
    }, 5000); // Keep for 5s to allow final events
  }

  /**
   * Cancel job
   */
  cancelJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'cancelled';

    const stageIndex = this.getStageIndex(job.currentStage, job.stageWeights);

    this.emit('job:complete', {
      jobId,
      inputMeta: this.getInputMeta(job.input),
      stage: 'cancelled',
      stageIndex,
      totalStages: job.totalStages,
      stageProgress: 0,
      progress: this.calculateGlobalProgress(job),
      partialResult: { ...job.partialResult },
    });

    this.jobs.delete(jobId);
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): JobMetadata | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Register progress event listener
   */
  on<T extends keyof ProgressEventData>(
    event: T,
    handler: (data: ProgressEventData) => void
  ): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);

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

  /**
   * Get stage weights for a modality
   */
  getStageWeights(
    modality: VectorModality
  ): Record<VectorizationStage, number> {
    const baseWeights: Record<
      VectorModality,
      Record<VectorizationStage, number>
    > = {
      text: {
        queued: 0,
        initializing: 5,
        extracting: 20,
        sanitizing: 5,
        chunking: 10,
        embedding: 45,
        upserting: 13,
        finalizing: 2,
      },
      audio: {
        queued: 0,
        initializing: 7,
        extracting: 18,
        sanitizing: 0,
        chunking: 10,
        embedding: 50,
        upserting: 13,
        finalizing: 2,
      },
      image: {
        queued: 0,
        initializing: 5,
        extracting: 20,
        sanitizing: 5,
        chunking: 10,
        embedding: 45,
        upserting: 13,
        finalizing: 2,
      },
      video: {
        queued: 0,
        initializing: 8,
        extracting: 24,
        sanitizing: 0,
        chunking: 8,
        embedding: 46,
        upserting: 12,
        finalizing: 2,
      },
    };

    return baseWeights[modality];
  }

  private calculateGlobalProgress(job: JobMetadata): number {
    let totalProgress = 0;

    // Add progress from completed stages (full weight)
    for (const [stage, weight] of Object.entries(job.stageWeights)) {
      if (job.stageStartTimes.has(stage as VectorizationStage)) {
        const stageStartTime = job.stageStartTimes.get(
          stage as VectorizationStage
        )!;
        const stageEndTime =
          job.currentStage === stage
            ? performance.now()
            : stageStartTime + 1000; // Assume 1s if not current
        const stageDuration = stageEndTime - stageStartTime;
        const isCompleted = stage !== job.currentStage || stageDuration > 1000; // Rough heuristic

        if (isCompleted) {
          totalProgress += weight;
        }
      }
    }

    // Add current stage progress
    if (job.currentStage !== 'queued') {
      totalProgress += job.stageWeights[job.currentStage] * 0.5; // Assume 50% of current stage
    }

    return Math.min(totalProgress / 100, 1);
  }

  private getStageIndex(
    stage: VectorizationStage,
    weights: Record<VectorizationStage, number>
  ): number {
    const stages = Object.keys(weights) as VectorizationStage[];
    return stages.indexOf(stage);
  }

  private getInputMeta(input: File | string | ArrayBuffer): {
    modality: VectorModality;
    mime: string;
    sizeBytes: number;
    url?: string;
  } {
    if (input instanceof File) {
      return {
        modality: this.detectModalityFromMime(input.type),
        mime: input.type,
        sizeBytes: input.size,
      };
    } else if (typeof input === 'string') {
      if (input.startsWith('http')) {
        return {
          modality: 'text',
          mime: 'text/html',
          sizeBytes: 0,
          url: input,
        };
      } else {
        return {
          modality: 'text',
          mime: 'text/plain',
          sizeBytes: input.length,
        };
      }
    } else {
      return {
        modality: 'text',
        mime: 'application/octet-stream',
        sizeBytes: input.byteLength,
      };
    }
  }

  private detectModalityFromMime(mime: string): VectorModality {
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    return 'text';
  }

  private emit(event: keyof ProgressEventData, data: ProgressEventData): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(
            `Error in progress event listener for ${event}:`,
            error
          );
        }
      });
    }
  }
}
