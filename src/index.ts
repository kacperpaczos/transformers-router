// Initialization
export { init, dispose } from './app/init';

// Main AI Provider
export { AIProvider, createAIProvider } from './app/AIProvider';

// Web Workers Support (Phase 2)
export {
  AIProviderWorker,
  createAIProviderWorker,
} from './infra/workers/AIProviderWorker';
export { WorkerPool } from './infra/workers/WorkerPool';

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
export { ModelManager } from './app/ModelManager';
export { ModelCache } from './app/cache/ModelCache';

// Vectorization service
export { VectorizationService } from './app/vectorization/VectorizationService';
export type {
  VectorizationResult,
  QueryResult,
  VectorizeOptions,
  QueryVectorizeOptions,
  ProgressEventData,
  ChunkingOptions,
} from './core/types';

// Backend and AutoScaling
export { BackendSelector } from './app/backend/BackendSelector';
export { AutoScaler } from './app/autoscaler/AutoScaler';

// Voice Profile system
export {
  VoiceProfileRegistry,
  voiceProfileRegistry,
} from './core/VoiceProfileRegistry';

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
  // Voice Profile types
  VoiceGender,
  VoiceEmotion,
  VoiceAge,
  VoiceStyle,
  VoiceParameters,
  VoiceProfile,
  VoiceProfileOptions,
  // OpenAI types
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
  OpenAICompletionRequest,
  OpenAICompletionResponse,
  VectorizeOptions,
  QueryVectorizeOptions,
  ProgressEventData,
  ChunkingOptions,
  VectorizationStage,
  JobStatus,
} from './core/types';

// Utility types and classes
export type {
  AudioInput,
  AudioOutput,
  AudioMetadata,
} from './utils/AudioConverter';
export { audioConverter, AudioConverter } from './utils/AudioConverter';

// Progress tracking
export { ProgressTracker } from './utils/ProgressTracker';
export type {
  JobMetadata,
  StageProgress,
  JobStatus,
  VectorizationStage,
  VectorizationProgressEventData,
  VectorizeOptions,
  QueryVectorizeOptions,
  ChunkingOptions,
} from './core/types';

// Legacy router (for backward compatibility)
export { TransformersRouter, Route, RouterOptions } from './app/router';

// Logger interface
export type { Logger } from './domain/logging/Logger';
export type { InitOptions, RuntimeConfig } from './domain/config/Config';

// Domain errors
export {
  ValidationError,
  ModelUnavailableError,
  ModelLoadError,
  ModelNotLoadedError,
  InferenceError,
  InitializationError,
  ConfigurationError,
} from './domain/errors';

// Domain model contracts
export type {
  IModel,
  ILLMModel,
  ITTSModel,
  ISTTModel,
  IEmbeddingModel,
} from './domain/models';

// Model registry functions
export {
  registerModel,
  getRegisteredModels,
  getRegisteredModel,
} from './app/state';

// UI Hooks (React and Vue)
export { useAIProvider, useChat, useVectorization } from './ui/react';

export {
  useAIProvider as useAIProviderVue,
  useChat as useChatVue,
  useVectorization as useVectorizationVue,
} from './ui/vue';

export type {
  UseAIProviderOptions,
  UseAIProviderReturn,
  UseChatOptions,
  UseChatReturn,
  UseVectorizationOptions,
  UseVectorizationReturn,
} from './ui/react';
