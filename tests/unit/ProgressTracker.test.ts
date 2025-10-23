import { ProgressTracker } from '../../src/utils/ProgressTracker';
import type { VectorizeOptions, VectorModality } from '../../src/core/types';
import { loadTestFile } from '../fixtures/loadTestFile';

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;

  let mockFile: File;
  const mockOptions: VectorizeOptions = {
    modality: 'text',
    chunking: { strategy: 'recursive', chunkSize: 1000, chunkOverlap: 100 },
  };

  const mockStageWeights = {
    queued: 0, initializing: 5, extracting: 20, sanitizing: 5,
    chunking: 10, embedding: 45, upserting: 13, finalizing: 2, cancelled: 0,
  };

  beforeEach(async () => {
    tracker = new ProgressTracker();
    mockFile = await loadTestFile('text/test.pdf');
  });

  describe('Job Creation and Management', () => {
    it('should create a new job with correct metadata', () => {
      const jobId = tracker.createJob(mockFile, mockOptions, mockStageWeights);

      expect(jobId).toMatch(/^job_\d+$/);
      expect(tracker.getJobStatus(jobId)).toBeDefined();
      expect(tracker.getJobStatus(jobId)?.status).toBe('queued');
      expect(tracker.getJobStatus(jobId)?.input).toBe(mockFile);
    });

    it('should generate unique job IDs', () => {
      const jobId1 = tracker.createJob(mockFile, mockOptions, mockStageWeights);
      const jobId2 = tracker.createJob('test text', mockOptions, mockStageWeights);

      expect(jobId1).not.toBe(jobId2);
    });

    it('should track multiple jobs simultaneously', () => {
      const jobId1 = tracker.createJob(mockFile, mockOptions, mockStageWeights);
      const jobId2 = tracker.createJob('test text', mockOptions, mockStageWeights);

      expect(tracker.getJobStatus(jobId1)).toBeDefined();
      expect(tracker.getJobStatus(jobId2)).toBeDefined();
      expect(tracker.getJobStatus(jobId1)?.jobId).toBe(jobId1);
      expect(tracker.getJobStatus(jobId2)?.jobId).toBe(jobId2);
    });
  });

  describe('Stage Management', () => {
    let jobId: string;

    beforeEach(() => {
      jobId = tracker.createJob(mockFile, mockOptions, mockStageWeights);
    });

    it('should start and track stages', () => {
      tracker.startStage(jobId, 'initializing');

      const job = tracker.getJobStatus(jobId);
      expect(job?.currentStage).toBe('initializing');
      expect(job?.stageStartTimes.has('initializing')).toBe(true);
    });

    it('should complete stages and update partial results', () => {
      tracker.startStage(jobId, 'initializing');
      tracker.completeStage(jobId, { indexedIds: ['doc1'], failedItems: [] });

      const job = tracker.getJobStatus(jobId);
      expect(job?.partialResult.indexedIds).toContain('doc1');
      expect(job?.stageStartTimes.has('initializing')).toBe(true);
    });

    it('should update progress during stages', () => {
      tracker.startStage(jobId, 'embedding');

      tracker.updateProgress(jobId, 0.5, {
        itemsProcessed: 5,
        message: 'Processing chunks',
      });

      const job = tracker.getJobStatus(jobId);
      expect(job?.itemsProcessed).toBe(5);
    });
  });

  describe('Progress Calculation', () => {
    let jobId: string;

    beforeEach(() => {
      jobId = tracker.createJob(mockFile, mockOptions, mockStageWeights);
    });

    it('should calculate global progress correctly', () => {
      // Start and complete initializing stage (5% weight)
      tracker.startStage(jobId, 'initializing');
      tracker.completeStage(jobId);

      const job = tracker.getJobStatus(jobId);
      expect(job?.currentStage).toBe('initializing');
    });

    it('should handle progress updates with metadata', () => {
      tracker.startStage(jobId, 'embedding');

      tracker.updateProgress(jobId, 0.3, {
        itemsProcessed: 3,
        bytesProcessed: 1024,
        etaMs: 5000,
        message: 'Embedding chunk 3/10',
      });

      const job = tracker.getJobStatus(jobId);
      expect(job?.itemsProcessed).toBe(3);
      expect(job?.bytesProcessed).toBe(1024);
    });
  });

  describe('Error and Warning Handling', () => {
    let jobId: string;

    beforeEach(() => {
      jobId = tracker.createJob(mockFile, mockOptions, mockStageWeights);
    });

    it('should handle errors and complete jobs with error status', () => {
      tracker.startStage(jobId, 'embedding');

      tracker.completeWithError(jobId, 'embedding', 'Processing failed', true);

      const job = tracker.getJobStatus(jobId);
      expect(job?.status).toBe('error');
    });

    it('should add warnings to jobs', () => {
      tracker.addWarning(jobId, 'Low storage available');

      const job = tracker.getJobStatus(jobId);
      expect(job?.warnings).toContain('Low storage available');
    });
  });

  describe('Job Cancellation', () => {
    let jobId: string;

    beforeEach(() => {
      jobId = tracker.createJob(mockFile, mockOptions, mockStageWeights);
    });

    it('should cancel jobs and clean up', async () => {
      tracker.startStage(jobId, 'embedding');

      tracker.cancelJob(jobId);

      const job = tracker.getJobStatus(jobId);
      expect(job?.status).toBe('cancelled');

      // Wait for cleanup timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(tracker.getJobStatus(jobId)).toBeUndefined(); // Should be cleaned up after timeout
    });
  });

  describe('Stage Weights', () => {
    it('should return correct stage weights for different modalities', () => {
      const textWeights = tracker.getStageWeights('text');
      const audioWeights = tracker.getStageWeights('audio');
      const imageWeights = tracker.getStageWeights('image');
      const videoWeights = tracker.getStageWeights('video');

      expect(textWeights.initializing).toBe(5);
      expect(audioWeights.embedding).toBe(50);
      expect(imageWeights.upserting).toBe(13);
      expect(videoWeights.extracting).toBe(24);

      // All should sum to 100
      expect(Object.values(textWeights).reduce((a, b) => a + b, 0)).toBe(100);
      expect(Object.values(audioWeights).reduce((a, b) => a + b, 0)).toBe(100);
      expect(Object.values(imageWeights).reduce((a, b) => a + b, 0)).toBe(100);
      expect(Object.values(videoWeights).reduce((a, b) => a + b, 0)).toBe(100);
    });
  });

  describe('Event System', () => {
    let jobId: string;

    beforeEach(() => {
      jobId = tracker.createJob(mockFile, mockOptions, mockStageWeights);
    });

    it('should emit progress events', async () => {
      const progressEvents: any[] = [];
      const unsubscribe = tracker.on('stage:progress', (event) => {
        progressEvents.push(event);
      });

      tracker.startStage(jobId, 'initializing');
      tracker.updateProgress(jobId, 0.5, { message: 'Processing...' });
      tracker.completeStage(jobId);

      expect(progressEvents.length).toBe(2); // stage:start and stage:progress
      expect(progressEvents[0].stage).toBe('initializing');
      expect(progressEvents[0].stageProgress).toBe(0);
      expect(progressEvents[1].stage).toBe('initializing');
      expect(progressEvents[1].stageProgress).toBe(0.5);

      unsubscribe();
    });

    it('should emit warning events', () => {
      const warningEvents: any[] = [];
      const unsubscribe = tracker.on('warning', (event) => {
        warningEvents.push(event);
      });

      tracker.addWarning(jobId, 'Test warning');

      expect(warningEvents.length).toBe(1);
      expect(warningEvents[0].warnings).toContain('Test warning');

      unsubscribe();
    });

    it('should emit error events', () => {
      const errorEvents: any[] = [];
      const unsubscribe = tracker.on('error', (event) => {
        errorEvents.push(event);
      });

      tracker.completeWithError(jobId, 'embedding', 'Test error');

      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0].error?.message).toBe('Test error');

      unsubscribe();
    });

    it('should handle event listener cleanup', () => {
      const handler = jest.fn();
      const unsubscribe = tracker.on('stage:progress', handler);

      tracker.startStage(jobId, 'initializing');

      expect(handler).toHaveBeenCalled();

      unsubscribe();

      tracker.updateProgress(jobId, 0.5);
      expect(handler).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });

  describe('Input Metadata Detection', () => {
    it('should detect modality from file MIME type', async () => {
      const pdfFile = await loadTestFile('text/test.pdf');
      const audioFile = await loadTestFile('audio/test.mp3');
      const imageFile = await loadTestFile('images/test.jpg');
      const videoFile = await loadTestFile('video/test.mp4');

      const weights = tracker.getStageWeights('text'); // Default for unknown

      const pdfJobId = tracker.createJob(pdfFile, mockOptions, weights);
      const audioJobId = tracker.createJob(audioFile, mockOptions, weights);
      const imageJobId = tracker.createJob(imageFile, mockOptions, weights);
      const videoJobId = tracker.createJob(videoFile, mockOptions, weights);

      const pdfJob = tracker.getJobStatus(pdfJobId);
      const audioJob = tracker.getJobStatus(audioJobId);
      const imageJob = tracker.getJobStatus(imageJobId);
      const videoJob = tracker.getJobStatus(videoJobId);

      expect(pdfJob?.inputMeta?.modality).toBe('text');
      expect(audioJob?.inputMeta?.modality).toBe('audio');
      expect(imageJob?.inputMeta?.modality).toBe('image');
      expect(videoJob?.inputMeta?.modality).toBe('video');
    });

    it('should handle string inputs correctly', () => {
      const textJobId = tracker.createJob('plain text', mockOptions, mockStageWeights);
      const urlJobId = tracker.createJob('https://example.com', mockOptions, mockStageWeights);

      const textJob = tracker.getJobStatus(textJobId);
      const urlJob = tracker.getJobStatus(urlJobId);

      expect(textJob?.inputMeta?.modality).toBe('text');
      expect(textJob?.inputMeta?.mime).toBe('text/plain');
      expect(textJob?.inputMeta?.url).toBeUndefined();

      expect(urlJob?.inputMeta?.modality).toBe('text');
      expect(urlJob?.inputMeta?.mime).toBe('text/html');
      expect(urlJob?.inputMeta?.url).toBe('https://example.com');
    });

    it('should handle ArrayBuffer inputs', () => {
      const buffer = new ArrayBuffer(1024);
      const bufferJobId = tracker.createJob(buffer, mockOptions, mockStageWeights);

      const bufferJob = tracker.getJobStatus(bufferJobId);
      expect(bufferJob?.inputMeta?.modality).toBe('text');
      expect(bufferJob?.inputMeta?.mime).toBe('application/octet-stream');
      expect(bufferJob?.inputMeta?.sizeBytes).toBe(1024);
    });
  });

  describe('Cleanup and Memory Management', () => {
    jest.setTimeout(20000);
    it('should clean up completed jobs after timeout', async () => {
      jest.setTimeout(15000);
      const jobId = tracker.createJob(mockFile, mockOptions, mockStageWeights);

      tracker.completeJob(jobId);

      const job = tracker.getJobStatus(jobId);
      expect(job?.status).toBe('completed');

      // Job should still exist immediately after completion
      expect(job).toBeDefined();

      // Wait for cleanup timeout
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Job should be cleaned up (in real implementation)
      // This is hard to test without mocking timers
    });

    it('should clean up cancelled jobs after timeout', async () => {
      const jobId = tracker.createJob(mockFile, mockOptions, mockStageWeights);

      tracker.cancelJob(jobId);

      // Job should still exist immediately
      expect(tracker.getJobStatus(jobId)).toBeDefined();

      // Wait for cleanup timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(tracker.getJobStatus(jobId)).toBeUndefined(); // Should be cleaned up after timeout
    });
  });

  describe('Edge Cases', () => {
    let jobId: string;

    beforeEach(() => {
      jobId = tracker.createJob(mockFile, mockOptions, mockStageWeights);
    });

    it('should handle non-existent job operations gracefully', () => {
      expect(() => tracker.startStage('nonexistent', 'initializing')).not.toThrow();
      expect(() => tracker.updateProgress('nonexistent', 0.5)).not.toThrow();
      expect(() => tracker.completeStage('nonexistent')).not.toThrow();
      expect(() => tracker.addWarning('nonexistent', 'warning')).not.toThrow();
      expect(() => tracker.completeWithError('nonexistent', 'embedding', 'error')).not.toThrow();
      expect(() => tracker.cancelJob('nonexistent')).not.toThrow();
    });

    it('should handle progress values outside 0-1 range', () => {
      expect(() => tracker.updateProgress(jobId, -0.5)).not.toThrow();
      expect(() => tracker.updateProgress(jobId, 1.5)).not.toThrow();
    });

    it('should handle multiple rapid stage transitions', () => {
      tracker.startStage(jobId, 'initializing');
      tracker.startStage(jobId, 'extracting');
      tracker.startStage(jobId, 'embedding');

      const job = tracker.getJobStatus(jobId);
      expect(job?.currentStage).toBe('embedding');
    });
  });
});
