/**
 * Vue Composable for Vectorization with progress tracking
 */

import { ref, shallowRef, onUnmounted, type Ref } from 'vue';
import { AIProvider } from '../../app/AIProvider';
import type {
  VectorizeOptions,
  QueryVectorizeOptions,
  ProgressEventData,
  VectorizationServiceConfig,
} from '../../core/types';

export interface UseVectorizationOptions {
  config?: VectorizationServiceConfig;
  autoInitialize?: boolean;
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
  events: Ref<ProgressEventData[]>;

  // Actions
  initialize: () => Promise<void>;
  vectorize: (
    input: File | string | ArrayBuffer,
    options?: VectorizeOptions
  ) => AsyncGenerator<ProgressEventData, any>;
  query: (
    input: string | File | ArrayBuffer,
    options?: QueryVectorizeOptions
  ) => AsyncGenerator<ProgressEventData, any>;
  cancelJob: (jobId: string) => void;
  dispose: () => Promise<void>;

  // Event listeners
  onProgress: (handler: (event: ProgressEventData) => void) => () => void;
  onWarning: (handler: (event: ProgressEventData) => void) => () => void;
  onError: (handler: (event: ProgressEventData) => void) => () => void;
  onComplete: (handler: (event: ProgressEventData) => void) => () => void;
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
  const events = ref<ProgressEventData[]>([]);

  const { config, autoInitialize = false } = options;

  // Initialize vectorization service
  const initialize = async () => {
    if (isInitialized.value || isInitializing.value) return;

    isInitializing.value = true;
    error.value = null;

    try {
      const newProvider = new AIProvider();

      if (config) {
        await newProvider.initializeVectorization(config);
      }

      provider.value = newProvider;
      isInitialized.value = true;

      // Setup event listeners
      setupEventListeners(newProvider);
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
      (event: ProgressEventData) => {
        events.value = [...events.value.slice(-99), event]; // Keep last 100 events
        currentJob.value = event.jobId;
        currentProgress.value = event.progress;
        currentStage.value = event.stage;
        currentMessage.value = event.message || null;
        isProcessing.value = true;
      }
    );

    prov.onVectorizationEvent(
      'vectorization:stage:start',
      (event: ProgressEventData) => {
        currentStage.value = event.stage;
        currentMessage.value = `Starting ${event.stage}...`;
      }
    );

    prov.onVectorizationEvent(
      'vectorization:stage:end',
      (event: ProgressEventData) => {
        currentMessage.value = `Completed ${event.stage}`;
      }
    );

    prov.onVectorizationEvent(
      'vectorization:warning',
      (event: ProgressEventData) => {
        currentMessage.value = `Warning: ${event.warnings?.join(', ')}`;
      }
    );

    prov.onVectorizationEvent(
      'vectorization:error',
      (event: ProgressEventData) => {
        error.value = new Error(event.error?.message || 'Vectorization error');
        isProcessing.value = false;
      }
    );
  };

  // Auto-initialize if requested
  if (autoInitialize) {
    initialize();
  }

  // Vectorize with progress
  const vectorize = async function* (
    input: File | string | ArrayBuffer,
    options: VectorizeOptions = {}
  ) {
    if (!provider.value) {
      throw new Error('Vectorization service not initialized');
    }

    const generator = provider.value.vectorizeWithProgress(input, options);

    for await (const event of generator) {
      yield event;

      // Update reactive state
      events.value = [...events.value.slice(-99), event];
      currentJob.value = event.jobId;
      currentProgress.value = event.progress;
      currentStage.value = event.stage;
      currentMessage.value = event.message || null;
    }
  };

  // Query with progress
  const query = async function* (
    input: string | File | ArrayBuffer,
    options: QueryVectorizeOptions = {}
  ) {
    if (!provider.value) {
      throw new Error('Vectorization service not initialized');
    }

    const generator = provider.value.queryWithProgress(input, options);

    for await (const event of generator) {
      yield event;

      // Update reactive state
      events.value = [...events.value.slice(-99), event];
      currentJob.value = event.jobId;
      currentProgress.value = event.progress;
      currentStage.value = event.stage;
      currentMessage.value = event.message || null;
    }
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
  const onProgress = (handler: (event: ProgressEventData) => void) => {
    if (!provider.value) return () => {};

    const unsubscribe = provider.value.onVectorizationEvent(
      'vectorization:progress',
      handler
    );
    return unsubscribe;
  };

  const onWarning = (handler: (event: ProgressEventData) => void) => {
    if (!provider.value) return () => {};

    const unsubscribe = provider.value.onVectorizationEvent(
      'vectorization:warning',
      handler
    );
    return unsubscribe;
  };

  const onError = (handler: (event: ProgressEventData) => void) => {
    if (!provider.value) return () => {};

    const unsubscribe = provider.value.onVectorizationEvent(
      'vectorization:error',
      handler
    );
    return unsubscribe;
  };

  const onComplete = (handler: (event: ProgressEventData) => void) => {
    if (!provider.value) return () => {};

    const unsubscribe = provider.value.onVectorizationEvent(
      'vectorization:stage:end',
      handler
    );
    return unsubscribe;
  };

  // Cleanup on unmount
  onUnmounted(() => {
    if (provider.value) {
      provider.value.dispose();
    }
  });

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
