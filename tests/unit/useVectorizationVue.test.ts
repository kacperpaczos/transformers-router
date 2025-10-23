/**
 * Vue composable tests for vectorization
 */

import { ref, nextTick } from 'vue';
import { useVectorization } from '../../src/ui/vue/useVectorization';
import type { VectorizationServiceConfig, VectorizeOptions } from '../../src/core/types';
import { loadTestFile } from '../fixtures/loadTestFile';

// Mock AIProvider and VectorizationService
jest.mock('../../src/app/AIProvider', () => ({
  AIProvider: jest.fn().mockImplementation(() => ({
    initializeVectorization: jest.fn().mockResolvedValue(undefined),
    vectorizeWithProgress: jest.fn(),
    queryWithProgress: jest.fn(),
    dispose: jest.fn().mockResolvedValue(undefined),
    onVectorizationEvent: jest.fn(),
  })),
  createAIProvider: jest.fn().mockImplementation(() => ({
    initializeVectorization: jest.fn().mockResolvedValue(undefined),
    vectorizeWithProgress: jest.fn(),
    queryWithProgress: jest.fn(),
    dispose: jest.fn().mockResolvedValue(undefined),
    onVectorizationEvent: jest.fn(),
  })),
}));

describe('useVectorization (Vue)', () => {
  const mockConfig: VectorizationServiceConfig = {
    storage: 'indexeddb',
    preferAcceleration: 'wasm',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      const composable = useVectorization();

      expect(composable.isInitialized.value).toBe(false);
      expect(composable.isInitializing.value).toBe(false);
      expect(composable.error.value).toBeNull();
      expect(composable.provider.value).toBeNull();
    });

    it('should auto-initialize when autoInitialize is true', async () => {
      const mockProvider = {
        initializeVectorization: jest.fn().mockResolvedValue(undefined),
        vectorizeWithProgress: jest.fn(),
        queryWithProgress: jest.fn(),
        dispose: jest.fn().mockResolvedValue(undefined),
        onVectorizationEvent: jest.fn(),
      } as any;

      const composable = useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider });

      // Should start initializing
      expect(composable.isInitializing.value).toBe(true);

      // Wait for initialization to complete
      await nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(composable.isInitialized.value).toBe(true);
      expect(composable.provider.value).toBeDefined();
    });

    it('should handle initialization errors', async () => {
      const mockProvider = {
        initializeVectorization: jest.fn().mockRejectedValue(new Error('Init failed')),
        dispose: jest.fn(),
        onVectorizationEvent: jest.fn(),
      } as any;

      const composable = useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider });

      await nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(composable.error.value).toBeDefined();
      expect(composable.error.value?.message).toBe('Init failed');
      expect(composable.isInitialized.value).toBe(false);
    });
  });

  describe('Manual Initialization', () => {
    it('should initialize service manually', async () => {
      const composable = useVectorization({ config: mockConfig });

      await composable.initialize();

      expect(composable.isInitialized.value).toBe(true);
      expect(composable.provider.value).toBeDefined();
    });

    it('should not re-initialize if already initialized', async () => {
      const mockProvider = {
        initializeVectorization: jest.fn().mockResolvedValue(undefined),
        vectorizeWithProgress: jest.fn(),
        queryWithProgress: jest.fn(),
        dispose: jest.fn().mockResolvedValue(undefined),
        onVectorizationEvent: jest.fn(),
      } as any;

      const composable = useVectorization({ config: mockConfig, providerFactory: () => mockProvider });

      await composable.initialize();
      const firstProvider = composable.provider.value;

      await composable.initialize();

      expect(composable.provider.value).toBe(firstProvider);
      expect(mockProvider.initializeVectorization).toHaveBeenCalledTimes(1);
    });
  });

  describe('Vectorization Operations', () => {
    let mockProvider: any;

    beforeEach(() => {
      mockProvider = {
        initializeVectorization: jest.fn().mockResolvedValue(undefined),
        vectorizeWithProgress: jest.fn(),
        queryWithProgress: jest.fn(),
        dispose: jest.fn().mockResolvedValue(undefined),
        onVectorizationEvent: jest.fn(),
      } as any;
    });

    it('should call vectorizeWithProgress when vectorize is called', async () => {
      const composable = useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider });

      await composable.initialize();

      const mockFile = await loadTestFile('text/test.pdf');
      const options: VectorizeOptions = { modality: 'text' };

      const generator = composable.vectorize(mockFile, options);
      expect(typeof generator[Symbol.asyncIterator]).toBe('function');

      expect(mockProvider.vectorizeWithProgress).toHaveBeenCalledWith(mockFile, options);
    });

    it('should call queryWithProgress when query is called', async () => {
      const composable = useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider });

      await composable.initialize();

      const queryText = 'test query';

      const generator = composable.query(queryText);
      expect(typeof generator[Symbol.asyncIterator]).toBe('function');

      expect(mockProvider.queryWithProgress).toHaveBeenCalledWith(queryText, {});
    });

    it('should throw error if not initialized', async () => {
      const composable = useVectorization();

      const mockFile = await loadTestFile('text/test.pdf');

      await expect(
        async () => {
          const generator = composable.vectorize(mockFile);
          await generator.next();
        }
      ).rejects.toThrow('Vectorization service not initialized');
    });
  });

  describe('Reactive State Updates', () => {
    let mockProvider: any;

    beforeEach(() => {
      mockProvider = {
        initializeVectorization: jest.fn().mockResolvedValue(undefined),
        vectorizeWithProgress: jest.fn(),
        queryWithProgress: jest.fn(),
        dispose: jest.fn().mockResolvedValue(undefined),
        onVectorizationEvent: jest.fn(),
      } as any;
    });

    it('should update reactive state when progress events are received', async () => {
      const composable = useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider });

      await composable.initialize();

      // Simulate progress event
      const mockEvent = {
        jobId: 'job_1',
        inputMeta: { modality: 'text', mime: 'application/pdf', sizeBytes: 1024 },
        stage: 'embedding',
        stageIndex: 4,
        totalStages: 7,
        stageProgress: 0.5,
        progress: 0.7,
        itemsProcessed: 5,
        chunksTotal: 10,
        message: 'Processing chunks...',
      };

      // Trigger event handler
      const eventHandler = mockProvider.onVectorizationEvent.mock.calls.find(
        (call: any[]) => call[0] === 'vectorization:progress'
      )?.[1];

      if (eventHandler) {
        eventHandler(mockEvent);
      }

      await nextTick();

      expect(composable.currentJob.value).toBe('job_1');
      expect(composable.currentProgress.value).toBe(0.7);
      expect(composable.currentStage.value).toBe('embedding');
      expect(composable.currentMessage.value).toBe('Processing chunks...');
      expect(composable.isProcessing.value).toBe(true);
    });

    it('should update error state when error events are received', async () => {
      const composable = useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider });

      await composable.initialize();

      const mockErrorEvent = {
        jobId: 'job_1',
        inputMeta: { modality: 'text', mime: 'application/pdf', sizeBytes: 1024 },
        stage: 'embedding',
        stageIndex: 4,
        totalStages: 7,
        stageProgress: 0,
        progress: 0.5,
        error: {
          stage: 'embedding',
          message: 'Embedding failed',
          retriable: true,
        },
      };

      const eventHandler = mockProvider.onVectorizationEvent.mock.calls.find(
        (call: any[]) => call[0] === 'vectorization:error'
      )?.[1];

      if (eventHandler) {
        eventHandler(mockErrorEvent);
      }

      await nextTick();

      expect(composable.error.value).toBeDefined();
      expect(composable.error.value?.message).toBe('Embedding failed');
      expect(composable.isProcessing.value).toBe(false);
    });
  });

  describe('Event Listeners', () => {
    let mockProvider: any;

    beforeEach(() => {
      mockProvider = {
        initializeVectorization: jest.fn().mockResolvedValue(undefined),
        vectorizeWithProgress: jest.fn(),
        queryWithProgress: jest.fn(),
        dispose: jest.fn().mockResolvedValue(undefined),
        onVectorizationEvent: jest.fn(),
      } as any;
    });

    it('should setup event listeners correctly', async () => {
      const composable = useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider });

      await composable.initialize();

      expect(mockProvider.onVectorizationEvent).toHaveBeenCalledWith(
        'vectorization:progress',
        expect.any(Function)
      );
      expect(mockProvider.onVectorizationEvent).toHaveBeenCalledWith(
        'vectorization:stage:start',
        expect.any(Function)
      );
      expect(mockProvider.onVectorizationEvent).toHaveBeenCalledWith(
        'vectorization:stage:end',
        expect.any(Function)
      );
      expect(mockProvider.onVectorizationEvent).toHaveBeenCalledWith(
        'vectorization:warning',
        expect.any(Function)
      );
      expect(mockProvider.onVectorizationEvent).toHaveBeenCalledWith(
        'vectorization:error',
        expect.any(Function)
      );
    });

    it('should allow manual event listener registration', async () => {
      const mockProvider = {
        initializeVectorization: jest.fn().mockResolvedValue(undefined),
        vectorizeWithProgress: jest.fn(),
        queryWithProgress: jest.fn(),
        dispose: jest.fn().mockResolvedValue(undefined),
        onVectorizationEvent: jest.fn((event: string, handler: Function) => {
          // Return unsubscribe function
          return () => {};
        }),
      } as any;

      const composable = useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider });

      await composable.initialize();
      await nextTick();

      // Verify event listeners were set up
      expect(mockProvider.onVectorizationEvent).toHaveBeenCalled();

      const mockHandler = jest.fn();
      const unsubscribe = composable.onProgress(mockHandler);

      // Simulate event by calling the registered handler
      const progressCall = mockProvider.onVectorizationEvent.mock.calls.find(
        (call: any[]) => call[0] === 'vectorization:progress'
      );

      if (progressCall && progressCall[1]) {
        progressCall[1]({ jobId: 'test', progress: 0.5 });
      }

      await nextTick();

      expect(mockHandler).toHaveBeenCalledWith({ jobId: 'test', progress: 0.5 });

      unsubscribe();

      // Should not be called after unsubscribe
      if (progressCall && progressCall[1]) {
        progressCall[1]({ jobId: 'test2', progress: 0.8 });
      }

      expect(mockHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup provider on unmount', async () => {
      const mockProvider = {
        initializeVectorization: jest.fn().mockResolvedValue(undefined),
        dispose: jest.fn().mockResolvedValue(undefined),
        onVectorizationEvent: jest.fn(),
      } as any;

      const composable = useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider });

      await composable.initialize();

      expect(mockProvider.dispose).not.toHaveBeenCalled();

      // Simulate unmount by calling dispose directly
      await composable.dispose();

      expect(mockProvider.dispose).toHaveBeenCalled();
      expect(composable.isInitialized.value).toBe(false);
      expect(composable.provider.value).toBeNull();
    });

    it('should cleanup when disposing manually', async () => {
      const mockProvider = {
        initializeVectorization: jest.fn().mockResolvedValue(undefined),
        dispose: jest.fn().mockResolvedValue(undefined),
        onVectorizationEvent: jest.fn(),
      } as any;

      const composable = useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider });

      await composable.initialize();

      await composable.dispose();

      expect(mockProvider.dispose).toHaveBeenCalled();
      expect(composable.isInitialized.value).toBe(false);
      expect(composable.provider.value).toBeNull();
    });
  });

  describe('Cancellation', () => {
    it('should handle job cancellation', async () => {
      const composable = useVectorization({ autoInitialize: true, config: mockConfig });

      await composable.initialize();

      composable.cancelJob('job_1');

      expect(composable.isProcessing.value).toBe(false);
      expect(composable.currentJob.value).toBeNull();
      expect(composable.currentProgress.value).toBe(0);
      expect(composable.currentStage.value).toBeNull();
      expect(composable.currentMessage.value).toBe('Job cancelled');
    });
  });

  describe('Event Stream Management', () => {
    let mockProvider: any;

    beforeEach(() => {
      mockProvider = {
        initializeVectorization: jest.fn().mockResolvedValue(undefined),
        vectorizeWithProgress: jest.fn(),
        queryWithProgress: jest.fn(),
        dispose: jest.fn().mockResolvedValue(undefined),
        onVectorizationEvent: jest.fn(),
      } as any;
    });

    it('should maintain event history reactively', async () => {
      const composable = useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider });

      await composable.initialize();

      // Simulate multiple events
      const events = [
        { jobId: 'job_1', stage: 'initializing', progress: 0.1 },
        { jobId: 'job_1', stage: 'extracting', progress: 0.3 },
        { jobId: 'job_1', stage: 'embedding', progress: 0.7 },
      ];

      events.forEach(event => {
        const eventHandler = mockProvider.onVectorizationEvent.mock.calls.find(
          (call: any[]) => call[0] === 'vectorization:progress'
        )?.[1];
        if (eventHandler) eventHandler(event);
      });

      await nextTick();

      expect(composable.events.value.length).toBe(3);
      expect(composable.events.value[0].progress).toBe(0.1);
      expect(composable.events.value[2].progress).toBe(0.7);
    });

    it('should limit event history to prevent memory leaks', async () => {
      const composable = useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider });

      await composable.initialize();

      // Simulate many events
      for (let i = 0; i < 150; i++) {
        const eventHandler = mockProvider.onVectorizationEvent.mock.calls.find(
          (call: any[]) => call[0] === 'vectorization:progress'
        )?.[1];
        if (eventHandler) eventHandler({ jobId: 'job_1', stage: 'embedding', progress: i / 100 });
      }

      await nextTick();

      expect(composable.events.value.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Reactive Updates', () => {
    let mockProvider: any;

    beforeEach(() => {
      mockProvider = {
        initializeVectorization: jest.fn().mockResolvedValue(undefined),
        vectorizeWithProgress: jest.fn(),
        queryWithProgress: jest.fn(),
        dispose: jest.fn().mockResolvedValue(undefined),
        onVectorizationEvent: jest.fn(),
      } as any;
    });

    it('should update reactive refs when progress changes', async () => {
      const composable = useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider });

      await composable.initialize();

      // Simulate progress event
      const eventHandler = mockProvider.onVectorizationEvent.mock.calls.find(
        (call: any[]) => call[0] === 'vectorization:progress'
      )?.[1];

      if (eventHandler) {
        eventHandler({
          jobId: 'test_job',
          inputMeta: { modality: 'text', mime: 'text/plain', sizeBytes: 100 },
          stage: 'embedding',
          stageIndex: 4,
          totalStages: 7,
          stageProgress: 0.8,
          progress: 0.9,
          itemsProcessed: 8,
          chunksTotal: 10,
          message: 'Almost done...',
        });
      }

      await nextTick();

      expect(composable.currentJob.value).toBe('test_job');
      expect(composable.currentProgress.value).toBe(0.9);
      expect(composable.currentStage.value).toBe('embedding');
      expect(composable.currentMessage.value).toBe('Almost done...');
      expect(composable.isProcessing.value).toBe(true);
    });

    it('should update reactive refs when stage changes', async () => {
      const composable = useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider });

      await composable.initialize();

      // Simulate stage start
      const startHandler = mockProvider.onVectorizationEvent.mock.calls.find(
        (call: any[]) => call[0] === 'vectorization:stage:start'
      )?.[1];

      if (startHandler) {
        startHandler({
          jobId: 'test_job',
          inputMeta: { modality: 'text', mime: 'text/plain', sizeBytes: 100 },
          stage: 'chunking',
          stageIndex: 3,
          totalStages: 7,
          stageProgress: 0,
          progress: 0.5,
        });
      }

      await nextTick();

      expect(composable.currentStage.value).toBe('chunking');
      expect(composable.currentMessage.value).toBe('Starting chunking...');
    });
  });
});
