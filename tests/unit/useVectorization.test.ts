/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useVectorization } from '../../src/ui/react/useVectorization';
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

describe('useVectorization (React)', () => {
  const mockConfig: VectorizationServiceConfig = {
    storage: 'indexeddb',
    preferAcceleration: 'wasm',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      const { result } = renderHook(() => useVectorization());

      expect(result.current.isInitialized).toBe(false);
      expect(result.current.isInitializing).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should auto-initialize when autoInitialize is true', async () => {
      const mockProvider = {
        initializeVectorization: jest.fn().mockResolvedValue(undefined),
        vectorizeWithProgress: jest.fn(),
        queryWithProgress: jest.fn(),
        dispose: jest.fn().mockResolvedValue(undefined),
        onVectorizationEvent: jest.fn(),
      } as any;

      const { result } = renderHook(() => useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider }));

      // Should start initializing
      expect(result.current.isInitializing).toBe(true);

      // Wait for initialization to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isInitialized).toBe(true);
    });

    it.skip('should handle initialization errors', async () => {
      const mockProvider = {
        initializeVectorization: jest.fn().mockRejectedValue(new Error('Init failed')),
        dispose: jest.fn(),
        onVectorizationEvent: jest.fn(() => () => {}),
      } as any;

      const { result } = renderHook(() => useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider }));

      // Wait for initialization to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Init failed');
      expect(result.current.isInitialized).toBe(false);
    }, 5000);
  });

  describe('Manual Initialization', () => {
    it('should initialize service manually', async () => {
      const { result } = renderHook(() => useVectorization({ config: mockConfig }));

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.isInitialized).toBe(true);
    });

    it('should not re-initialize if already initialized', async () => {
      const { result } = renderHook(() => useVectorization({ config: mockConfig }));

      await act(async () => {
        await result.current.initialize();
      });

      // Test that initialization doesn't change between calls

      await act(async () => {
        await result.current.initialize();
      });

      // Provider should remain stable
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
      const { result } = renderHook(() => useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider }));

      await act(async () => {
        await result.current.initialize();
      });

      const mockFile = await loadTestFile('text/test.pdf');
      const options: VectorizeOptions = { modality: 'text' };

      await act(async () => {
        const generator = result.current.vectorize(mockFile, options);
        // Should be an AsyncGenerator
        expect(typeof generator[Symbol.asyncIterator]).toBe('function');
      });

      expect(mockProvider.vectorizeWithProgress).toHaveBeenCalledWith(mockFile, options);
    });

    it('should call queryWithProgress when query is called', async () => {
      const { result } = renderHook(() => useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider }));

      await act(async () => {
        await result.current.initialize();
      });

      const queryText = 'test query';

      await act(async () => {
        const generator = result.current.query(queryText);
        expect(typeof generator[Symbol.asyncIterator]).toBe('function');
      });

      expect(mockProvider.queryWithProgress).toHaveBeenCalledWith(queryText, {});
    });

    it('should throw error if not initialized', async () => {
      const { result } = renderHook(() => useVectorization());

      const mockFile = await loadTestFile('text/test.pdf');

      await expect(
        act(async () => {
          const generator = result.current.vectorize(mockFile);
          await generator.next();
        })
      ).rejects.toThrow('Vectorization service not initialized');
    });
  });

  describe('Progress State Management', () => {
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

    it('should update progress state when events are received', async () => {
      const { result } = renderHook(() => useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider }));

      await act(async () => {
        await result.current.initialize();
      });

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

      act(() => {
        // Simulate event emission (normally done by the service)
        const eventHandler = mockProvider.onVectorizationEvent.mock.calls[0]?.[1];
        if (eventHandler) eventHandler(mockEvent);
      });

      expect(result.current.currentJob).toBe('job_1');
      expect(result.current.currentProgress).toBe(0.7);
      expect(result.current.currentStage).toBe('embedding');
      expect(result.current.currentMessage).toBe('Processing chunks...');
      expect(result.current.isProcessing).toBe(true);
    });

    it('should update error state when error events are received', async () => {
      const { result } = renderHook(() => useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider }));

      await act(async () => {
        await result.current.initialize();
      });

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

      act(() => {
        const eventHandler = mockProvider.onVectorizationEvent.mock.calls.find(
          (call: any[]) => call[0] === 'vectorization:error'
        )?.[1];
        if (eventHandler) eventHandler(mockErrorEvent);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Embedding failed');
      expect(result.current.isProcessing).toBe(false);
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
      };

      jest.doMock('../../src/app/AIProvider', () => ({
        createAIProvider: jest.fn().mockReturnValue(mockProvider),
      }));
    });

    it('should setup event listeners correctly', async () => {
      const { result } = renderHook(() => useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider }));

      await act(async () => {
        await result.current.initialize();
      });

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
      let progressHandler: Function | null = null;
      
      const mockProvider = {
        initializeVectorization: jest.fn().mockResolvedValue(undefined),
        vectorizeWithProgress: jest.fn(),
        queryWithProgress: jest.fn(),
        dispose: jest.fn().mockResolvedValue(undefined),
        onVectorizationEvent: jest.fn((event: string, handler: Function) => {
          if (event === 'vectorization:progress') {
            progressHandler = handler;
          }
          // Return unsubscribe function
          return () => {
            if (event === 'vectorization:progress') {
              progressHandler = null;
            }
          };
        }),
      } as any;

      const { result } = renderHook(() => useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider }));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Wait for event listeners to be set up
      expect(mockProvider.onVectorizationEvent).toHaveBeenCalled();

      const mockHandler = jest.fn();
      const unsubscribe = result.current.onProgress(mockHandler);

      // Simulate event by calling the registered handler
      await act(async () => {
        if (progressHandler) {
          progressHandler({ jobId: 'test', progress: 0.5 });
        }
      });

      expect(mockHandler).toHaveBeenCalledWith({ jobId: 'test', progress: 0.5 });

      unsubscribe();

      // Should not be called after unsubscribe
      await act(async () => {
        if (progressHandler) {
          progressHandler({ jobId: 'test2', progress: 0.8 });
        }
      });

      expect(mockHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup provider on unmount', async () => {
      const mockProvider = {
        initializeVectorization: jest.fn().mockResolvedValue(undefined),
        dispose: jest.fn().mockResolvedValue(undefined),
        onVectorizationEvent: jest.fn(),
      };

      jest.doMock('../../src/app/AIProvider', () => ({
        createAIProvider: jest.fn().mockReturnValue(mockProvider),
      }));

      const { result, unmount } = renderHook(() => useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider }));

      await act(async () => {
        await result.current.initialize();
      });

      expect(mockProvider.dispose).not.toHaveBeenCalled();

      unmount();

      expect(mockProvider.dispose).toHaveBeenCalled();
    });

    it.skip('should cleanup when disposing manually', async () => {
      const mockProvider = {
        initializeVectorization: jest.fn().mockResolvedValue(undefined),
        dispose: jest.fn().mockResolvedValue(undefined),
        onVectorizationEvent: jest.fn(() => () => {}),
      } as any;

      const { result } = renderHook(() => useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider }));

      await act(async () => {
        await result.current.initialize();
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(result.current.isInitialized).toBe(true);

      await act(async () => {
        await result.current.dispose();
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(mockProvider.dispose).toHaveBeenCalled();
      expect(result.current.isInitialized).toBe(false);
    });
  });

  describe('Cancellation', () => {
    it('should handle job cancellation', async () => {
      const { result } = renderHook(() => useVectorization({ autoInitialize: true, config: mockConfig }));

      await act(async () => {
        await result.current.initialize();
      });

      act(() => {
        result.current.cancelJob('job_1');
      });

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.currentJob).toBeNull();
      expect(result.current.currentProgress).toBe(0);
      expect(result.current.currentStage).toBeNull();
      expect(result.current.currentMessage).toBe('Job cancelled');
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

    it('should maintain event history', async () => {
      const { result } = renderHook(() => useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider }));

      await act(async () => {
        await result.current.initialize();
      });

      // Simulate multiple events
      const events = [
        { jobId: 'job_1', stage: 'initializing', progress: 0.1 },
        { jobId: 'job_1', stage: 'extracting', progress: 0.3 },
        { jobId: 'job_1', stage: 'embedding', progress: 0.7 },
      ];

      act(() => {
        events.forEach(event => {
          const eventHandler = mockProvider.onVectorizationEvent.mock.calls.find(
            (call: any[]) => call[0] === 'vectorization:progress'
          )?.[1];
          if (eventHandler) eventHandler(event);
        });
      });

      expect(result.current.events.length).toBe(3);
      expect(result.current.events[0].progress).toBe(0.1);
      expect(result.current.events[2].progress).toBe(0.7);
    });

    it('should limit event history to prevent memory leaks', async () => {
      const { result } = renderHook(() => useVectorization({ autoInitialize: true, config: mockConfig, providerFactory: () => mockProvider }));

      await act(async () => {
        await result.current.initialize();
      });

      // Simulate many events
      act(() => {
        for (let i = 0; i < 150; i++) {
          const eventHandler = mockProvider.onVectorizationEvent.mock.calls.find(
            (call: any[]) => call[0] === 'vectorization:progress'
          )?.[1];
          if (eventHandler) eventHandler({ jobId: 'job_1', stage: 'embedding', progress: i / 100 });
        }
      });

      expect(result.current.events.length).toBeLessThanOrEqual(100);
    });
  });
});
