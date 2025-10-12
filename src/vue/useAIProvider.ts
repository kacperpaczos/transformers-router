/**
 * Vue Composable for AI Provider
 */

import { ref, onUnmounted, type Ref } from 'vue';
import { AIProvider, createAIProvider } from '../core/AIProvider';
import type { AIProviderConfig, ProgressInfo, ModelStatus } from '../core/types';

export interface UseAIProviderOptions extends AIProviderConfig {
  autoLoad?: boolean;
}

export interface UseAIProviderReturn {
  provider: Ref<AIProvider | null>;
  isReady: Ref<boolean>;
  isLoading: Ref<boolean>;
  progress: Ref<ProgressInfo | null>;
  error: Ref<Error | null>;
  statuses: Ref<ModelStatus[]>;
  warmup: () => Promise<void>;
  dispose: () => Promise<void>;
}

/**
 * Composable to create and manage AI Provider
 */
export function useAIProvider(
  config: UseAIProviderOptions = {}
): UseAIProviderReturn {
  const provider = ref<AIProvider | null>(null);
  const isReady = ref(false);
  const isLoading = ref(false);
  const progress = ref<ProgressInfo | null>(null);
  const error = ref<Error | null>(null);
  const statuses = ref<ModelStatus[]>([]);

  const { autoLoad = false, ...providerConfig } = config;

  // Initialize provider
  const newProvider = createAIProvider(providerConfig);

  // Set up event listeners
  newProvider.on('progress', (data) => {
    progress.value = data as ProgressInfo;
    isLoading.value = true;
  });

  newProvider.on('ready', () => {
    isReady.value = true;
    isLoading.value = false;
    statuses.value = newProvider.getAllStatuses();
  });

  newProvider.on('error', (data) => {
    const errorData = data as { error: Error };
    error.value = errorData.error;
    isLoading.value = false;
  });

  provider.value = newProvider;

  // Auto-load if configured
  if (autoLoad) {
    isLoading.value = true;
    newProvider.warmup().catch((err) => {
      error.value = err;
      isLoading.value = false;
    });
  }

  // Warmup function
  const warmup = async () => {
    if (!provider.value) {
      throw new Error('Provider not initialized');
    }

    isLoading.value = true;
    error.value = null;

    try {
      await provider.value.warmup();
      isReady.value = true;
    } catch (err) {
      error.value = err as Error;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // Dispose function
  const dispose = async () => {
    if (!provider.value) {
      return;
    }

    await provider.value.dispose();
    isReady.value = false;
    provider.value = null;
  };

  // Cleanup on unmount
  onUnmounted(() => {
    if (provider.value) {
      provider.value.dispose();
    }
  });

  return {
    provider,
    isReady,
    isLoading,
    progress,
    error,
    statuses,
    warmup,
    dispose,
  };
}

