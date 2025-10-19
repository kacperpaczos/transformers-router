/**
 * OpenAI API Adapter for compatibility with OpenAI-based agent frameworks
 */

import type {
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
  OpenAICompletionRequest,
  OpenAICompletionResponse,
  Message,
} from '../core/types';
import { AIProvider } from '@app/AIProvider';

export class OpenAIAdapter {
  private provider: AIProvider;
  private idCounter = 0;

  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  /**
   * Create a chat completion (OpenAI-compatible)
   */
  async createChatCompletion(
    params: OpenAIChatCompletionRequest
  ): Promise<OpenAIChatCompletionResponse> {
    const {
      messages,
      temperature,
      top_p,
      max_tokens,
      stop,
    } = params;

    try {
      const response = await this.provider.chat(messages, {
        temperature,
        topP: top_p,
        maxTokens: max_tokens,
        stopSequences: Array.isArray(stop) ? stop : stop ? [stop] : undefined,
      });

      const id = this.generateId();
      const created = Math.floor(Date.now() / 1000);

      return {
        id,
        object: 'chat.completion',
        created,
        model: params.model || 'local-llm',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: response.content,
            },
            finish_reason: response.finishReason || 'stop',
          },
        ],
        usage: response.usage || {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    } catch (error) {
      throw new Error(
        `OpenAI chat completion failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Create a text completion (OpenAI-compatible)
   */
  async createCompletion(
    params: OpenAICompletionRequest
  ): Promise<OpenAICompletionResponse> {
    const { prompt, temperature, max_tokens, stop } = params;

    try {
      const response = await this.provider.complete(prompt, {
        temperature,
        maxTokens: max_tokens,
        stopSequences: Array.isArray(stop) ? stop : stop ? [stop] : undefined,
      });

      const id = this.generateId();
      const created = Math.floor(Date.now() / 1000);

      return {
        id,
        object: 'text_completion',
        created,
        model: params.model || 'local-llm',
        choices: [
          {
            text: response,
            index: 0,
            finish_reason: 'stop',
          },
        ],
        usage: {
          promptTokens: Math.ceil(prompt.length / 4),
          completionTokens: Math.ceil(response.length / 4),
          totalTokens: Math.ceil((prompt.length + response.length) / 4),
        },
      };
    } catch (error) {
      throw new Error(
        `OpenAI completion failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Create embeddings (OpenAI-compatible)
   */
  async createEmbeddings(params: {
    input: string | string[];
    model?: string;
  }): Promise<{
    object: string;
    data: Array<{ object: string; embedding: number[]; index: number }>;
    model: string;
    usage: { prompt_tokens: number; total_tokens: number };
  }> {
    const { input } = params;

    try {
      const embeddings = await this.provider.embed(input);

      const inputTexts = Array.isArray(input) ? input : [input];
      const promptTokens = inputTexts.reduce(
        (sum, text) => sum + Math.ceil(text.length / 4),
        0
      );

      return {
        object: 'list',
        data: embeddings.map((embedding, index) => ({
          object: 'embedding',
          embedding,
          index,
        })),
        model: params.model || 'local-embedding',
        usage: {
          prompt_tokens: promptTokens,
          total_tokens: promptTokens,
        },
      };
    } catch (error) {
      throw new Error(
        `OpenAI embeddings failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Stream chat completion (OpenAI-compatible)
   */
  async *createChatCompletionStream(
    params: OpenAIChatCompletionRequest
  ): AsyncGenerator<string> {
    const { messages, temperature, top_p, max_tokens, stop } = params;

    try {
      const stream = this.provider.stream(messages, {
        temperature,
        topP: top_p,
        maxTokens: max_tokens,
        stopSequences: Array.isArray(stop) ? stop : stop ? [stop] : undefined,
      });

      for await (const token of stream) {
        // Format as OpenAI Server-Sent Event
        const chunk = {
          id: this.generateId(),
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: params.model || 'local-llm',
          choices: [
            {
              index: 0,
              delta: { content: token },
              finish_reason: null,
            },
          ],
        };

        yield `data: ${JSON.stringify(chunk)}\n\n`;
      }

      // Send final chunk
      const finalChunk = {
        id: this.generateId(),
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: params.model || 'local-llm',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
      };

      yield `data: ${JSON.stringify(finalChunk)}\n\n`;
      yield 'data: [DONE]\n\n';
    } catch (error) {
      throw new Error(
        `OpenAI chat completion stream failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `chatcmpl-${Date.now()}-${this.idCounter++}`;
  }

  /**
   * Convert OpenAI messages to our format
   */
  static convertMessages(
    messages: Array<{ role: string; content: string }>
  ): Message[] {
    return messages.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant' | 'function',
      content: msg.content,
    }));
  }
}

