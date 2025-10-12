// Main AI Provider
export { AIProvider, createAIProvider } from './core/AIProvider';

// Web Workers Support (Phase 2)
export { AIProviderWorker, createAIProviderWorker } from './workers/AIProviderWorker';
export { WorkerPool } from './workers/WorkerPool';

// Adapters
export { OpenAIAdapter } from './adapters/OpenAIAdapter';
export {
  LangChainLLM,
  LangChainEmbeddings,
  createLangChainLLM,
  createLangChainEmbeddings,
} from './adapters/LangChainAdapter';

// Models (for advanced usage)
export { LLMModel } from './models/LLMModel';
export { TTSModel } from './models/TTSModel';
export { STTModel } from './models/STTModel';
export { EmbeddingModel } from './models/EmbeddingModel';

// Core classes
export { ModelManager } from './core/ModelManager';
export { ModelCache } from './core/ModelCache';

// Types
export type {
  // Config types
  AIProviderConfig,
  LLMConfig,
  TTSConfig,
  STTConfig,
  EmbeddingConfig,
  ModelConfig,
  // Message types
  Message,
  ChatResponse,
  TokenUsage,
  // Options types
  ChatOptions,
  CompletionOptions,
  TTSOptions,
  STTOptions,
  EmbeddingOptions,
  // Status types
  ModelStatus,
  ProgressInfo,
  // General types
  Modality,
  Device,
  DType,
  EventType,
  EventCallback,
  // OpenAI types
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
  OpenAICompletionRequest,
  OpenAICompletionResponse,
} from './core/types';

// Legacy router (for backward compatibility)
export { TransformersRouter, Route, RouterOptions } from './router';
