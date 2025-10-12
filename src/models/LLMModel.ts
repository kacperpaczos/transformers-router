/**
 * LLM Model for text generation (chat, completion)
 */

import type {
  LLMConfig,
  Message,
  ChatResponse,
  ChatOptions,
  CompletionOptions,
} from '../core/types';
import { BaseModel } from './BaseModel';

// Dynamically import Transformers.js to avoid bundling issues
let transformersModule: typeof import('@huggingface/transformers') | null = null;

async function getTransformers() {
  if (!transformersModule) {
    transformersModule = await import('@huggingface/transformers');
  }
  return transformersModule;
}

export class LLMModel extends BaseModel<LLMConfig> {
  constructor(config: LLMConfig) {
    super('llm', config);
  }

  /**
   * Load the LLM model
   */
  async load(progressCallback?: (progress: {
    status: string;
    file?: string;
    progress?: number;
    loaded?: number;
    total?: number;
  }) => void): Promise<void> {
    if (this.loaded) {
      return;
    }

    if (this.loading) {
      // Wait for existing load to complete
      while (this.loading) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }

    this.loading = true;

    try {
      const { pipeline } = await getTransformers();

      this.pipeline = await pipeline('text-generation', this.config.model, {
        dtype: this.config.dtype || 'q4',
        device: this.config.device || 'cpu',
        progress_callback: progressCallback,
      });

      this.loaded = true;
    } catch (error) {
      this.loaded = false;
      throw new Error(
        `Failed to load LLM model ${this.config.model}: ${(error as Error).message}`
      );
    } finally {
      this.loading = false;
    }
  }

  /**
   * Chat with the model (supports message history)
   */
  async chat(
    messages: Message[] | string,
    options: ChatOptions = {}
  ): Promise<ChatResponse> {
    await this.ensureLoaded();

    const pipeline = this.getPipeline() as {
      (input: Message[] | string, opts?: unknown): Promise<
        Array<{ generated_text: Message[] }>
      >;
      tokenizer?: { encode?: (text: string) => { length: number } };
    };

    // Convert string to messages array
    const messageArray: Message[] = Array.isArray(messages)
      ? messages
      : [{ role: 'user' as const, content: messages }];

    // Add system prompt if provided
    if (options.systemPrompt && messageArray[0]?.role !== 'system') {
      messageArray.unshift({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    // Build generation options
    const generationOptions = {
      max_new_tokens: options.maxTokens || this.config.maxTokens || 256,
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
      top_p: options.topP ?? this.config.topP ?? 0.9,
      top_k: options.topK ?? this.config.topK ?? 50,
      repetition_penalty:
        options.repetitionPenalty ?? this.config.repetitionPenalty ?? 1.0,
      do_sample: true,
    };

    try {
      const result = await pipeline(messageArray, generationOptions);
      const generatedMessage = result[0].generated_text.at(-1);

      if (!generatedMessage) {
        throw new Error('No response generated');
      }

      // Calculate token usage (approximate)
      const promptTokens = this.estimateTokens(
        messageArray.map((m) => m.content).join(' ')
      );
      const completionTokens = this.estimateTokens(generatedMessage.content);

      return {
        content: generatedMessage.content,
        role: 'assistant',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        finishReason: 'stop',
      };
    } catch (error) {
      throw new Error(`Chat generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Complete a prompt (simple text completion)
   */
  async complete(
    prompt: string,
    options: CompletionOptions = {}
  ): Promise<string> {
    await this.ensureLoaded();

    const pipeline = this.getPipeline() as (
      input: string,
      opts?: unknown
    ) => Promise<Array<{ generated_text: string }>>;

    const generationOptions = {
      max_new_tokens: options.maxTokens || this.config.maxTokens || 256,
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
      top_p: options.topP ?? this.config.topP ?? 0.9,
      do_sample: true,
    };

    try {
      const result = await pipeline(prompt, generationOptions);
      return result[0].generated_text;
    } catch (error) {
      throw new Error(`Completion failed: ${(error as Error).message}`);
    }
  }

  /**
   * Stream chat responses (generator function)
   */
  async *stream(
    messages: Message[] | string,
    options: ChatOptions = {}
  ): AsyncGenerator<string> {
    await this.ensureLoaded();

    const { TextStreamer } = await getTransformers();

    const pipeline = this.getPipeline() as {
      (input: Message[], opts?: unknown): Promise<
        Array<{ generated_text: Message[] }>
      >;
      tokenizer: {
        encode?: (text: string) => { length: number };
      };
    };

    const messageArray: Message[] = Array.isArray(messages)
      ? messages
      : [{ role: 'user' as const, content: messages }];

    if (options.systemPrompt && messageArray[0]?.role !== 'system') {
      messageArray.unshift({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    const tokens: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const streamer = new TextStreamer(pipeline.tokenizer as any, {
      skip_prompt: true,
      callback_function: (text: string) => {
        tokens.push(text);
      },
    });

    const generationOptions = {
      max_new_tokens: options.maxTokens || this.config.maxTokens || 256,
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
      top_p: options.topP ?? this.config.topP ?? 0.9,
      do_sample: true,
      streamer,
    };

    // Start generation
    const generationPromise = pipeline(messageArray, generationOptions);

    // Yield tokens as they arrive
    let lastIndex = 0;
    while (true) {
      if (lastIndex < tokens.length) {
        yield tokens[lastIndex];
        lastIndex++;
      } else {
        // Check if generation is complete
        const settled = await Promise.race([
          generationPromise.then(() => true),
          new Promise((resolve) => setTimeout(() => resolve(false), 50)),
        ]);

        if (settled && lastIndex >= tokens.length) {
          break;
        }
      }
    }
  }

  /**
   * Estimate token count (approximate)
   */
  private estimateTokens(text: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

