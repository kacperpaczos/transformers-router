/**
 * Domain model contracts for Transformers Router
 * These interfaces define the contracts that implementations must follow
 */

import type { Message, ChatResponse, ChatOptions, CompletionOptions } from '../../core/types';

export interface IModel {
  load(): Promise<void>;
  unload(): Promise<void>;
  isLoaded(): boolean;
  isLoading(): boolean;
  getRawPipeline(): unknown;
  setPipeline(pipeline: unknown): void;
}

export interface ILLMModel extends IModel {
  chat(messages: Message[] | string, options?: ChatOptions): Promise<ChatResponse>;
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
  stream(messages: Message[] | string, options?: ChatOptions): AsyncGenerator<string>;
}

export interface ITTSModel extends IModel {
  synthesize(text: string, options?: import('../../core/types').TTSOptions): Promise<Blob>;
}

export interface ISTTModel extends IModel {
  transcribe(audio: Blob | Float32Array | string, options?: import('../../core/types').STTOptions): Promise<string>;
}

export interface IEmbeddingModel extends IModel {
  embed(text: string | string[], options?: import('../../core/types').EmbeddingOptions): Promise<number[][]>;
  cosineSimilarity(embedding1: number[], embedding2: number[]): number;
  findMostSimilar(query: string, texts: string[], options?: import('../../core/types').EmbeddingOptions): Promise<{ text: string; similarity: number; index: number }>;
}

// Re-export types that are part of the domain contracts
export type {
  Modality,
  ModelConfig,
  LLMConfig,
  TTSConfig,
  STTConfig,
  EmbeddingConfig,
  Message,
  ChatResponse,
  ChatOptions,
  CompletionOptions,
  TTSOptions,
  STTOptions,
  EmbeddingOptions,
} from '../../core/types';
