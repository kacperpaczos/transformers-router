/**
 * LangChain Adapter for Transformers Router
 * Provides compatibility with LangChain.js framework
 */

import type { AIProvider } from '@app/AIProvider';
import type { Message } from '../core/types';

/**
 * LangChain-style LLM interface
 */
export interface LangChainLLMParams {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  streaming?: boolean;
}

/**
 * LangChain-style message
 */
export interface LangChainMessage {
  role: string;
  content: string;
}

/**
 * LangChain BaseLLM-compatible adapter
 */
export class LangChainLLM {
  private provider: AIProvider;
  private defaultParams: LangChainLLMParams;

  constructor(provider: AIProvider, params: LangChainLLMParams = {}) {
    this.provider = provider;
    this.defaultParams = params;
  }

  /**
   * Generate completion (LangChain-style)
   */
  async call(prompt: string, options?: LangChainLLMParams): Promise<string> {
    const mergedOptions = { ...this.defaultParams, ...options };

    const response = await this.provider.complete(prompt, {
      maxTokens: mergedOptions.maxTokens,
      temperature: mergedOptions.temperature,
      topP: mergedOptions.topP,
    });

    return response;
  }

  /**
   * Generate from messages (LangChain ChatModel-style)
   */
  async callMessages(
    messages: LangChainMessage[],
    options?: LangChainLLMParams
  ): Promise<string> {
    const mergedOptions = { ...this.defaultParams, ...options };

    // Convert LangChain messages to our format
    const convertedMessages: Message[] = messages.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));

    const response = await this.provider.chat(convertedMessages, {
      maxTokens: mergedOptions.maxTokens,
      temperature: mergedOptions.temperature,
      topP: mergedOptions.topP,
    });

    return response.content;
  }

  /**
   * Stream generation (LangChain-style)
   */
  async *stream(
    promptOrMessages: string | LangChainMessage[],
    options?: LangChainLLMParams
  ): AsyncGenerator<string> {
    if (typeof promptOrMessages === 'string') {
      // For simple prompts, use completion
      const response = await this.call(promptOrMessages, options);
      yield response;
    } else {
      // For messages, use chat
      const convertedMessages: Message[] = promptOrMessages.map((msg) => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      }));

      const mergedOptions = { ...this.defaultParams, ...options };

      // Use streaming from provider
      for await (const token of this.provider.stream(convertedMessages, {
        maxTokens: mergedOptions.maxTokens,
        temperature: mergedOptions.temperature,
        topP: mergedOptions.topP,
      })) {
        yield token;
      }
    }
  }

  /**
   * Get model name
   */
  get modelName(): string {
    const config = this.provider.getConfig();
    return config.llm?.model || 'transformers-local';
  }

  /**
   * Get LLM type
   */
  get llmType(): string {
    return 'transformers-router';
  }
}

/**
 * LangChain Embeddings-compatible adapter
 */
export class LangChainEmbeddings {
  private provider: AIProvider;

  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  /**
   * Embed documents (LangChain-style)
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.provider.embed(texts);
  }

  /**
   * Embed query (LangChain-style)
   */
  async embedQuery(text: string): Promise<number[]> {
    const embeddings = await this.provider.embed(text);
    return embeddings[0];
  }
}

/**
 * Helper to create LangChain-compatible LLM
 */
export function createLangChainLLM(
  provider: AIProvider,
  params?: LangChainLLMParams
): LangChainLLM {
  return new LangChainLLM(provider, params);
}

/**
 * Helper to create LangChain-compatible Embeddings
 */
export function createLangChainEmbeddings(
  provider: AIProvider
): LangChainEmbeddings {
  return new LangChainEmbeddings(provider);
}

