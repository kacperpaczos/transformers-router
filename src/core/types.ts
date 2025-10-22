/**
 * Core types for Transformers Router - AI Agent Infrastructure
 */

// Re-export voice profile types
export type {
  VoiceGender,
  VoiceEmotion,
  VoiceAge,
  VoiceStyle,
  VoiceParameters,
  VoiceProfile,
  VoiceProfileOptions,
} from './VoiceProfile';

// Wspierane modalności
export type Modality = 'llm' | 'tts' | 'stt' | 'embedding';

// Vectorization modalities (for multimedia embeddings)
export type VectorModality = 'audio' | 'image' | 'video'; // video→audio

// Device types
export type Device = 'cpu' | 'gpu' | 'webgpu';

// Precision types
export type DType = 'fp32' | 'fp16' | 'q8' | 'q4' | 'q4f16';

// Message format (OpenAI-compatible)
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
}

// LLM Configuration
export interface LLMConfig {
  model: string;
  dtype?: DType;
  device?: Device;
  performanceMode?: 'auto' | 'fast' | 'quality';
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  repetitionPenalty?: number;
}

// TTS Configuration
export interface TTSConfig {
  model: string;
  dtype?: DType;
  device?: Device;
  speaker?: string | Float32Array;
  sampleRate?: number;
  voiceProfile?: string; // ID profilu głosowego
}

// STT Configuration
export interface STTConfig {
  model: string;
  dtype?: DType;
  device?: Device;
  performanceMode?: 'auto' | 'fast' | 'quality';
  language?: string;
  task?: 'transcribe' | 'translate';
}

// Embedding Configuration
export interface EmbeddingConfig {
  model: string;
  dtype?: DType;
  device?: Device;
  performanceMode?: 'auto' | 'fast' | 'quality';
  pooling?: 'mean' | 'cls';
  normalize?: boolean;
}

// Unified ModelConfig type
export type ModelConfig = LLMConfig | TTSConfig | STTConfig | EmbeddingConfig;

// AI Provider Configuration
export interface AIProviderConfig {
  llm?: LLMConfig;
  tts?: TTSConfig;
  stt?: STTConfig;
  embedding?: EmbeddingConfig;
}

// Chat Options
export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  repetitionPenalty?: number;
  stopSequences?: string[];
  systemPrompt?: string;
}

// Completion Options
export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
}

// TTS Options
export interface TTSOptions {
  speaker?: string | Float32Array | Float64Array;
  voiceProfile?: string; // ID profilu głosowego
  speed?: number;
  pitch?: number;
  quality?: number;
  format?: 'wav' | 'mp3' | 'ogg';
  emotion?: import('./VoiceProfile').VoiceEmotion;
  age?: import('./VoiceProfile').VoiceAge;
  accent?: string;
  style?: import('./VoiceProfile').VoiceStyle;
}

// STT Options
export interface STTOptions {
  language?: string;
  task?: 'transcribe' | 'translate';
  timestamps?: boolean;
}

// Embedding Options
export interface EmbeddingOptions {
  pooling?: 'mean' | 'cls';
  normalize?: boolean;
}

// Chat Message
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Chat Response
export interface ChatResponse {
  content: string;
  role: 'assistant';
  usage?: TokenUsage;
  finishReason?: 'stop' | 'length' | 'error';
}

// Token Usage
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// Progress Info
export interface ProgressInfo {
  modality: Modality;
  model: string;
  file: string;
  progress: number;
  loaded: number;
  total: number;
  status: 'downloading' | 'loading' | 'ready' | 'error';
}

// Model Status
export interface ModelStatus {
  modality: Modality;
  loaded: boolean;
  loading: boolean;
  error?: Error;
  model?: string;
}

// Event data types (type-safe)
export interface ProgressEventData {
  modality: Modality;
  model: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
  status: 'downloading' | 'loading' | 'ready' | 'error';
}

export interface ReadyEventData {
  modality: Modality;
  model: string;
}

export interface ErrorEventData {
  modality: Modality;
  error: Error;
}

export interface UnloadEventData {
  modality: Modality;
}

// Event data map (discriminated union)
export interface EventDataMap {
  progress: ProgressEventData;
  ready: ReadyEventData;
  error: ErrorEventData;
  unload: UnloadEventData;
}

// Event types
export type EventType = keyof EventDataMap;

// Type-safe event callback
export type EventCallback<T extends EventType = EventType> = (
  data: EventDataMap[T]
) => void;

// OpenAI-compatible types
export interface OpenAIChatCompletionRequest {
  messages: Message[];
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string | string[];
  stream?: boolean;
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: Message;
    finish_reason: string;
  }>;
  usage: TokenUsage;
}

export interface OpenAICompletionRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stop?: string | string[];
}

export interface OpenAICompletionResponse {
  id: string;
  object: 'text_completion';
  created: number;
  model: string;
  choices: Array<{
    text: string;
    index: number;
    finish_reason: string;
  }>;
  usage: TokenUsage;
}

// Internal types
export interface CachedModel {
  modality: Modality;
  pipeline: unknown;
  config: ModelConfig;
  loadedAt: number;
  lastUsedAt: number;
}

// Vectorization types
export interface VectorizationServiceConfig {
  preferAcceleration?: 'webgpu' | 'wasm';
  storage: 'indexeddb' | 'opfs';
  externalMock?: { enabled: boolean; latencyMs?: number; errorRate?: number };
  quotaThresholds?: { warn: number; high: number; critical: number }; // 0-1
}

export interface ChunkingOptions {
  strategy: 'recursive' | 'semantic' | 'fixed';
  chunkSize: number;
  chunkOverlap: number;
  separators?: string[];
}

export interface VectorizeOptions {
  modality?: VectorModality;
  chunking?: ChunkingOptions;
  audioMode?: 'clap' | 'stt' | 'auto';
  videoOptions?: {
    extractFrames: boolean;
    framesEverySec: number;
    audioWeight: number; // 0-1, for fusion
  };
  ocrEnabled?: boolean;
  maxFileSizeMB?: number;
  concurrency?: number;
  batchSize?: number;
  onProgress?: (event: ProgressEventData) => void;
  signal?: AbortSignal;
}

export interface QueryVectorizeOptions {
  k?: number;
  filter?: Partial<VectorDocMeta>;
  modality?: VectorModality;
  scoreThreshold?: number;
  onProgress?: (event: ProgressEventData) => void;
}

export interface VectorDocMeta {
  id: string;
  modality: VectorModality;
  mime: string;
  sizeBytes: number;
  createdAt: number;
  [k: string]: unknown;
}

export interface QueryOptions {
  k?: number;
  filter?: Partial<VectorDocMeta>;
}

export interface ResourceUsageSnapshot {
  cpuMs: number;
  memoryMB?: number;
  storageUsedMB: number;
  storageLimitMB?: number;
  modelDownloadsMB: number;
  gpu?: { backend: 'webgpu' | 'wasm'; usedMB?: number };
  timestamp: number;
}

// Vectorization progress and job types
export type VectorizationStage =
  | 'queued'
  | 'initializing'
  | 'extracting'
  | 'sanitizing'
  | 'chunking'
  | 'embedding'
  | 'upserting'
  | 'finalizing';

export type JobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'error'
  | 'cancelled';

export interface VectorizationProgressEventData {
  jobId: string;
  inputMeta: {
    modality: VectorModality;
    mime: string;
    sizeBytes: number;
    url?: string;
  };
  stage: VectorizationStage;
  stageIndex: number;
  totalStages: number;
  stageProgress: number; // 0-1
  progress: number; // 0-1 (global)
  etaMs?: number;
  bytesProcessed?: number;
  itemsProcessed?: number;
  chunksTotal?: number;
  message?: string;
  partialResult?: {
    indexedIds?: string[];
    failedItems?: string[];
  };
  warnings?: string[];
  error?: {
    stage: VectorizationStage;
    message: string;
    retriable?: boolean;
  };
}
