/**
 * React Hook for AI Provider
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { AIProvider, createAIProvider } from '../core/AIProvider';
import type { AIProviderConfig, ProgressInfo, ModelStatus } from '../core/types';

export interface UseAIProviderOptions extends AIProviderConfig {
  autoLoad?: boolean; // Auto-load models on mount
}

export interface UseAIProviderReturn {
  provider: AIProvider | null;
  isReady: boolean;
  isLoading: boolean;
  progress: ProgressInfo | null;
  error: Error | null;
  statuses: ModelStatus[];
  warmup: () => Promise<void>;
  dispose: () => Promise<void>;
}

/**
 * Hook to create and manage AI Provider
 */
export function useAIProvider(
  config: UseAIProviderOptions = {}
): UseAIProviderReturn {
  const [provider, setProvider] = useState<AIProvider | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [statuses, setStatuses] = useState<ModelStatus[]>([]);

  const providerRef = useRef<AIProvider | null>(null);
  const { autoLoad = false, ...providerConfig } = config;

  // Initialize provider
  useEffect(() => {
    const newProvider = createAIProvider(providerConfig);
    
    // Set up event listeners
    newProvider.on('progress', (data) => {
      setProgress(data as ProgressInfo);
      setIsLoading(true);
    });

    newProvider.on('ready', () => {
      setIsReady(true);
      setIsLoading(false);
      setStatuses(newProvider.getAllStatuses());
    });

    newProvider.on('error', (data) => {
      const errorData = data as { error: Error };
      setError(errorData.error);
      setIsLoading(false);
    });

    providerRef.current = newProvider;
    setProvider(newProvider);

    // Auto-load if configured
    if (autoLoad) {
      setIsLoading(true);
      newProvider.warmup().catch((err) => {
        setError(err);
        setIsLoading(false);
      });
    }

    // Cleanup
    return () => {
      if (providerRef.current) {
        providerRef.current.dispose();
        providerRef.current = null;
      }
    };
  }, [JSON.stringify(providerConfig), autoLoad]);

  // Warmup function
  const warmup = useCallback(async () => {
    if (!provider) {
      throw new Error('Provider not initialized');
    }

    setIsLoading(true);
    setError(null);

    try {
      await provider.warmup();
      setIsReady(true);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  // Dispose function
  const dispose = useCallback(async () => {
    if (!provider) {
      return;
    }

    await provider.dispose();
    setIsReady(false);
    setProvider(null);
  }, [provider]);

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

