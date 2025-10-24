/**
 * Vue Composable for Vectorization with progress tracking
 */

import {
  ref,
  shallowRef,
  onUnmounted,
  getCurrentInstance,
  type Ref,
} from 'vue';
import type { AIProvider } from '../../app/AIProvider';
import { createAIProvider } from '../../app/AIProvider';
import type {
  VectorizeOptions,
  QueryVectorizeOptions,
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
  provider: Ref<AIProvider | null>;
  isInitialized: Ref<boolean>;
  isInitializing: Ref<boolean>;
  error: Ref<Error | null>;

  // Progress state
  currentJob: Ref<string | null>;
  currentProgress: Ref<number>; // 0-1
  currentStage: Ref<string | null>;
  currentMessage: Ref<string | null>;
  isProcessing: Ref<boolean>;

  // Event stream
  events: Ref<VectorizationProgressEventData[]>;

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

/**
 * Composable for vectorization with progress tracking
 */
export function useVectorization(
  options: UseVectorizationOptions = {}
): UseVectorizationReturn {
  const provider = shallowRef<AIProvider | null>(null);
  const isInitialized = ref(false);
  const isInitializing = ref(false);
  const error = ref<Error | null>(null);

  // Progress state
  const currentJob = ref<string | null>(null);
  const currentProgress = ref(0);
  const currentStage = ref<string | null>(null);
  const currentMessage = ref<string | null>(null);
  const isProcessing = ref(false);
  const events = ref<VectorizationProgressEventData[]>([]);

  // Local listener registries for manual subscriptions
  const progressListeners: Array<(e: VectorizationProgressEventData) => void> =
    [];
  const warningListeners: Array<(e: VectorizationProgressEventData) => void> =
    [];
  const errorListeners: Array<(e: VectorizationProgressEventData) => void> = [];
  const completeListeners: Array<(e: VectorizationProgressEventData) => void> =
    [];

  const { config, autoInitialize = false } = options;

  // Initialize vectorization service
  const initialize = async () => {
    if (isInitialized.value) return;

    isInitializing.value = true;
    error.value = null;

    try {
      let newProvider: AIProvider;
      if (options.providerFactory) {
        newProvider = options.providerFactory();
      } else {
        newProvider = createAIProvider();
      }

      provider.value = newProvider;

      if (config) {
        await newProvider.initializeVectorization(config);
      }

      // Setup event listeners after initialization
      setupEventListeners(newProvider);
      isInitialized.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      isInitializing.value = false;
    }
  };

  const setupEventListeners = (prov: AIProvider) => {
    // Progress events
    prov.onVectorizationEvent(
      'vectorization:progress',
      (event: VectorizationProgressEventData) => {
        events.value = [...events.value.slice(-99), event]; // Keep last 100 events
        currentJob.value = event.jobId;
        currentProgress.value = event.progress;
        currentStage.value = event.stage;
        currentMessage.value = event.message || null;
        isProcessing.value = true;
        // Propagate to manual listeners
        for (const listener of progressListeners) listener(event);
      }
    );

    prov.onVectorizationEvent(
      'vectorization:stage:start',
      (event: VectorizationProgressEventData) => {
        currentStage.value = event.stage;
        currentMessage.value = `Starting ${event.stage}...`;
      }
    );

    prov.onVectorizationEvent(
      'vectorization:stage:end',
      (event: VectorizationProgressEventData) => {
        currentMessage.value = `Completed ${event.stage}`;
        for (const listener of completeListeners) listener(event);
      }
    );

    prov.onVectorizationEvent(
      'vectorization:warning',
      (event: VectorizationProgressEventData) => {
        currentMessage.value = `Warning: ${event.warnings?.join(', ')}`;
        for (const listener of warningListeners) listener(event);
      }
    );

    prov.onVectorizationEvent(
      'vectorization:error',
      (event: VectorizationProgressEventData) => {
        error.value = new Error(event.error?.message || 'Vectorization error');
        isProcessing.value = false;
        for (const listener of errorListeners) listener(event);
      }
    );
  };

  // Auto-initialize if requested
  if (autoInitialize) {
    initialize();
  }

  // Vectorize with progress
  const vectorize = function (
    input: File | string | ArrayBuffer,
    options: VectorizeOptions = {}
  ) {
    if (!provider.value) {
      throw new Error('Vectorization service not initialized');
    }

    const underlying = provider.value.vectorizeWithProgress(input, options);

    async function* wrapper() {
      for await (const event of underlying) {
        events.value = [...events.value.slice(-99), event];
        currentJob.value = event.jobId;
        currentProgress.value = event.progress;
        currentStage.value = event.stage;
        currentMessage.value = event.message || null;
        yield event;
      }
    }

    return wrapper();
  };

  // Query with progress
  const query = function (
    input: string | File | ArrayBuffer,
    options: QueryVectorizeOptions = {}
  ) {
    if (!provider.value) {
      throw new Error('Vectorization service not initialized');
    }

    const underlying = provider.value.queryWithProgress(input, options);

    async function* wrapper() {
      for await (const event of underlying) {
        events.value = [...events.value.slice(-99), event];
        currentJob.value = event.jobId;
        currentProgress.value = event.progress;
        currentStage.value = event.stage;
        currentMessage.value = event.message || null;
        yield event;
      }
    }

    return wrapper();
  };

  // Cancel job
  const cancelJob = (jobId: string) => {
    // TODO: Implement job cancellation
    isProcessing.value = false;
    currentJob.value = null;
    currentProgress.value = 0;
    currentStage.value = null;
    currentMessage.value = 'Job cancelled';
  };

  // Dispose
  const dispose = async () => {
    if (provider.value) {
      await provider.value.dispose();
      provider.value = null;
      isInitialized.value = false;
      isProcessing.value = false;
      currentJob.value = null;
      currentProgress.value = 0;
      currentStage.value = null;
      currentMessage.value = null;
      events.value = [];
    }
  };

  // Event listener management
  const onProgress = (
    handler: (event: VectorizationProgressEventData) => void
  ) => {
    progressListeners.push(handler);
    return () => {
      const idx = progressListeners.indexOf(handler);
      if (idx >= 0) progressListeners.splice(idx, 1);
    };
  };

  const onWarning = (
    handler: (event: VectorizationProgressEventData) => void
  ) => {
    warningListeners.push(handler);
    return () => {
      const idx = warningListeners.indexOf(handler);
      if (idx >= 0) warningListeners.splice(idx, 1);
    };
  };

  const onError = (
    handler: (event: VectorizationProgressEventData) => void
  ) => {
    errorListeners.push(handler);
    return () => {
      const idx = errorListeners.indexOf(handler);
      if (idx >= 0) errorListeners.splice(idx, 1);
    };
  };

  const onComplete = (
    handler: (event: VectorizationProgressEventData) => void
  ) => {
    completeListeners.push(handler);
    return () => {
      const idx = completeListeners.indexOf(handler);
      if (idx >= 0) completeListeners.splice(idx, 1);
    };
  };

  // Cleanup on unmount (guard for tests calling composable outside component)
  if (getCurrentInstance()) {
    onUnmounted(() => {
      if (provider.value) {
        provider.value.dispose();
      }
    });
  }

  return {
    // Service state
    provider,
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
