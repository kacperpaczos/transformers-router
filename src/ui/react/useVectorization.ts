/**
 * React Hook for Vectorization with progress tracking
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { AIProvider } from '../../app/AIProvider';
import { createAIProvider } from '../../app/AIProvider';
import type {
  VectorizeOptions,
  QueryVectorizeOptions,
  ProgressEventData,
  VectorizationProgressEventData,
  VectorizationServiceConfig,
} from '../../core/types';

export interface UseVectorizationOptions {
  config?: VectorizationServiceConfig;
  autoInitialize?: boolean;
  providerFactory?: () => any;
}

export interface UseVectorizationReturn {
  // Service state
  isInitialized: boolean;
  isInitializing: boolean;
  error: Error | null;

  // Progress state
  currentJob: string | null;
  currentProgress: number; // 0-1
  currentStage: string | null;
  currentMessage: string | null;
  isProcessing: boolean;

  // Event stream
  events: VectorizationProgressEventData[];

  // Actions
  initialize: () => Promise<void>;
  vectorize: (
    input: File | string | ArrayBuffer,
    options?: VectorizeOptions
  ) => AsyncGenerator<VectorizationProgressEventData, any>;
  query: (
    input: string | File | ArrayBuffer,
    options?: QueryVectorizeOptions
  ) => AsyncGenerator<VectorizationProgressEventData, any>;
  cancelJob: (jobId: string) => void;
  dispose: () => Promise<void>;

  // Event listeners
  onProgress: (
    handler: (event: VectorizationProgressEventData) => void
  ) => () => void;
  onWarning: (
    handler: (event: VectorizationProgressEventData) => void
  ) => () => void;
  onError: (
    handler: (event: VectorizationProgressEventData) => void
  ) => () => void;
  onComplete: (
    handler: (event: VectorizationProgressEventData) => void
  ) => () => void;
}

export function useVectorization(
  options: UseVectorizationOptions = {}
): UseVectorizationReturn {
  const [provider, setProvider] = useState<AIProvider | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Progress state
  const [currentJob, setCurrentJob] = useState<string | null>(null);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [events, setEvents] = useState<VectorizationProgressEventData[]>([]);

  const providerRef = useRef<AIProvider | null>(null);
  const eventListenersRef = useRef<Map<string, (() => void) | null>>(new Map());
  const { config, autoInitialize = false } = options;

  // Initialize vectorization service
  const initialize = useCallback(async () => {
    setIsInitializing(true);
    setError(null);

    try {
      let newProvider: AIProvider;
      if (options.providerFactory) {
        newProvider = options.providerFactory();
      } else {
        newProvider = createAIProvider();
      }

      providerRef.current = newProvider;
      setProvider(newProvider);

      if (config) {
        await newProvider.initializeVectorization(config);
      }

      // Setup event listeners after initialization
      setupEventListeners(newProvider);
      setIsInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsInitializing(false);
    }
  }, [config, isInitialized, isInitializing]);

  const setupEventListeners = useCallback((prov: AIProvider) => {
    // Progress events
    prov.onVectorizationEvent(
      'vectorization:progress',
      (event: VectorizationProgressEventData) => {
        setEvents(prev => [...prev.slice(-99), event]); // Keep last 100 events
        setCurrentJob(event.jobId);
        setCurrentProgress(event.progress);
        setCurrentStage(event.stage);
        setCurrentMessage(event.message || null);
        setIsProcessing(true);
      }
    );

    prov.onVectorizationEvent(
      'vectorization:stage:start',
      (event: VectorizationProgressEventData) => {
        setCurrentStage(event.stage);
        setCurrentMessage(`Starting ${event.stage}...`);
      }
    );

    prov.onVectorizationEvent(
      'vectorization:stage:end',
      (event: VectorizationProgressEventData) => {
        setCurrentMessage(`Completed ${event.stage}`);
      }
    );

    prov.onVectorizationEvent(
      'vectorization:warning',
      (event: VectorizationProgressEventData) => {
        setCurrentMessage(`Warning: ${event.warnings?.join(', ')}`);
      }
    );

    prov.onVectorizationEvent(
      'vectorization:error',
      (event: VectorizationProgressEventData) => {
        setError(new Error(event.error?.message || 'Vectorization error'));
        setIsProcessing(false);
      }
    );
  }, []);

  // Auto-initialize if requested
  useEffect(() => {
    if (autoInitialize && !isInitialized && !isInitializing) {
      initialize();
    }
  }, [autoInitialize, isInitialized, isInitializing, initialize]);

  // Vectorize with progress
  const vectorize = useCallback(function (
    input: File | string | ArrayBuffer,
    options: VectorizeOptions = {}
  ) {
    if (!providerRef.current) {
      throw new Error('Vectorization service not initialized');
    }

    const underlying = providerRef.current.vectorizeWithProgress(
      input,
      options
    );

    async function* wrapper() {
      for await (const event of underlying) {
        // Update UI state
        setEvents(prev => [...prev.slice(-99), event]);
        setCurrentJob(event.jobId);
        setCurrentProgress(event.progress);
        setCurrentStage(event.stage);
        setCurrentMessage(event.message || null);
        yield event;
      }
    }

    return wrapper();
  }, []);

  // Query with progress
  const query = useCallback(function (
    input: string | File | ArrayBuffer,
    options: QueryVectorizeOptions = {}
  ) {
    if (!providerRef.current) {
      throw new Error('Vectorization service not initialized');
    }

    const underlying = providerRef.current.queryWithProgress(input, options);

    async function* wrapper() {
      for await (const event of underlying) {
        // Update UI state
        setEvents(prev => [...prev.slice(-99), event]);
        setCurrentJob(event.jobId);
        setCurrentProgress(event.progress);
        setCurrentStage(event.stage);
        setCurrentMessage(event.message || null);
        yield event;
      }
    }

    return wrapper();
  }, []);

  // Cancel job
  const cancelJob = useCallback((jobId: string) => {
    // TODO: Implement job cancellation
    setIsProcessing(false);
    setCurrentJob(null);
    setCurrentProgress(0);
    setCurrentStage(null);
    setCurrentMessage('Job cancelled');
  }, []);

  // Dispose
  const dispose = useCallback(async () => {
    if (providerRef.current) {
      await providerRef.current.dispose();
      providerRef.current = null;
    }
    setProvider(null);
    setIsInitialized(false);
    setIsProcessing(false);
    setCurrentJob(null);
    setCurrentProgress(0);
    setCurrentStage(null);
    setCurrentMessage(null);
    setEvents([]);
  }, []);

  // Event listener management
  const onProgress = useCallback(
    (handler: (event: VectorizationProgressEventData) => void) => {
      if (!providerRef.current) return () => {};

      const unsubscribe = providerRef.current.onVectorizationEvent(
        'vectorization:progress',
        handler
      );
      return unsubscribe;
    },
    []
  );

  const onWarning = useCallback(
    (handler: (event: VectorizationProgressEventData) => void) => {
      if (!providerRef.current) return () => {};

      const unsubscribe = providerRef.current.onVectorizationEvent(
        'vectorization:warning',
        handler
      );
      return unsubscribe;
    },
    []
  );

  const onError = useCallback(
    (handler: (event: VectorizationProgressEventData) => void) => {
      if (!providerRef.current) return () => {};

      const unsubscribe = providerRef.current.onVectorizationEvent(
        'vectorization:error',
        handler
      );
      return unsubscribe;
    },
    []
  );

  const onComplete = useCallback(
    (handler: (event: VectorizationProgressEventData) => void) => {
      if (!providerRef.current) return () => {};

      const unsubscribe = providerRef.current.onVectorizationEvent(
        'vectorization:stage:end',
        handler
      );
      return unsubscribe;
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (providerRef.current) {
        providerRef.current.dispose();
      }
    };
  }, []);

  return {
    // Service state
    isInitialized,
    isInitializing,
    error,

    // Progress state
    currentJob,
    currentProgress,
    currentStage,
    currentMessage,
    isProcessing,

    // Event stream
    events,

    // Actions
    initialize,
    vectorize,
    query,
    cancelJob,
    dispose,

    // Event listeners
    onProgress,
    onWarning,
    onError,
    onComplete,
  };
}
