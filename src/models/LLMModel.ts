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

// Type definitions for LLM pipeline components
interface LLMTokenizer {
  eos_token_id?: number;
  pad_token_id?: number;
  chat_template?: string;
  decode?: (tokens: number[]) => string;
  encode?: (text: string) => number[];
}

interface LLMModelConfig {
  eos_token_id?: number;
  pad_token_id?: number;
}

interface LLMPipelineModel {
  config?: LLMModelConfig;
}

// Dynamically import Transformers.js to avoid bundling issues
let transformersModule: typeof import('@huggingface/transformers') | null =
  null;

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
  async load(
    progressCallback?: (progress: {
      status: string;
      file?: string;
      progress?: number;
      loaded?: number;
      total?: number;
    }) => void
  ): Promise<void> {
    if (this.loaded) {
      if (typeof console !== 'undefined' && console.log) {
        console.log('[LLMModel] load(): early-return, already loaded');
      }
      return;
    }

    if (this.loading) {
      // Wait for existing load to complete
      if (typeof console !== 'undefined' && console.log) {
        console.log('[LLMModel] load(): waiting for concurrent load');
      }
      while (this.loading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (typeof console !== 'undefined' && console.log) {
        console.log('[LLMModel] load(): concurrent load finished');
      }
      return;
    }

    this.loading = true;

    try {
      const { pipeline, env } = await getTransformers();
      if (typeof console !== 'undefined' && console.log) {
        console.log('[LLMModel] load(): transformers loaded');
      }

      const isBrowser =
        typeof window !== 'undefined' && typeof navigator !== 'undefined';
      const supportsWebGPU =
        isBrowser &&
        typeof (navigator as unknown as { gpu?: unknown }).gpu !== 'undefined';

      // Sprawdź realną dostępność adaptera WebGPU (nie tylko obecność API)
      let webgpuAdapterAvailable = false;
      if (supportsWebGPU) {
        try {
          const navWithGpu = navigator as unknown as {
            gpu?: { requestAdapter?: () => Promise<unknown> };
          };
          const adapter = await (navWithGpu.gpu?.requestAdapter?.() ||
            Promise.resolve(null));
          webgpuAdapterAvailable = !!adapter;
        } catch {
          webgpuAdapterAvailable = false;
        }
      }

      // Auto-detect device:
      // - Browser: prefer WebGPU if available, otherwise WASM; never fall back to CPU in browser
      // - Node: use provided device or CPU by default
      const desiredDevice =
        (this.config.device as string | undefined) ||
        (isBrowser ? (supportsWebGPU ? 'webgpu' : 'wasm') : 'cpu');

      const tryOrder = (() => {
        if (isBrowser) {
          if (desiredDevice === 'webgpu')
            return webgpuAdapterAvailable ? ['webgpu', 'wasm'] : ['wasm'];
          if (desiredDevice === 'wasm') return ['wasm'];
          // If someone passed 'cpu' or other in browser, coerce to WASM-only
          return ['wasm'];
        }
        // Node.js environment: allow CPU fallback
        return desiredDevice === 'webgpu'
          ? ['webgpu', 'cpu']
          : [desiredDevice, ...(desiredDevice !== 'cpu' ? ['cpu'] : [])];
      })();

      if (typeof console !== 'undefined' && console.log) {
        console.log('[LLMModel] load(): env', {
          isBrowser,
          supportsWebGPU,
          desiredDevice,
          tryOrder,
        });
      }

      const dtype = this.config.dtype || 'fp32';
      if (typeof console !== 'undefined' && console.log) {
        console.log('[LLMModel] load(): dtype resolved:', dtype);
      }

      let lastError: Error | null = null;
      for (const dev of tryOrder) {
        try {
          if (typeof console !== 'undefined' && console.log) {
            console.log('[LLMModel] attempting device:', dev);
          }

          // Optimize WASM backend if used
          if (env?.backends?.onnx) {
            // Podpowiedź backendu dla ORT (jeśli wspierane)
            interface ONNXBackends {
              backendHint?: string;
              wasm?: {
                simd?: boolean;
                numThreads?: number;
              };
            }

            const onnxBackends = env.backends.onnx as ONNXBackends;
            if (dev === 'wasm') {
              if ('backendHint' in onnxBackends)
                onnxBackends.backendHint = 'wasm';
              if (onnxBackends.wasm) {
                onnxBackends.wasm.simd = true;
                const cores =
                  (typeof navigator !== 'undefined'
                    ? navigator.hardwareConcurrency
                    : 2) || 2;
                onnxBackends.wasm.numThreads = Math.min(
                  4,
                  Math.max(1, cores - 1)
                );
                if (typeof console !== 'undefined' && console.log) {
                  console.log('[LLMModel] WASM config:', {
                    backendHint: onnxBackends.backendHint,
                    simd: onnxBackends.wasm.simd,
                    numThreads: onnxBackends.wasm.numThreads,
                  });
                }
              }
            } else if (dev === 'webgpu') {
              if ('backendHint' in onnxBackends)
                onnxBackends.backendHint = 'webgpu';
              if (typeof console !== 'undefined' && console.log) {
                console.log('[LLMModel] WebGPU config:', {
                  backendHint: onnxBackends.backendHint,
                  adapterAvailable: webgpuAdapterAvailable,
                });
              }
            }
          }

          // Przekazuj dokładnie wybrany backend: w przeglądarce akceptowane są 'webgpu' lub 'wasm'
          const pipelineDevice = dev as unknown as
            | 'webgpu'
            | 'wasm'
            | 'gpu'
            | 'cpu';
          this.pipeline = await pipeline('text-generation', this.config.model, {
            dtype,
            device: pipelineDevice,
            progress_callback: progressCallback,
          });

          this.loaded = true;
          if (typeof console !== 'undefined' && console.log) {
            console.log('[LLMModel] loaded successfully with device:', dev);
          }
          lastError = null;
          break;
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
          if (typeof console !== 'undefined' && console.log) {
            console.log(
              '[LLMModel] device failed:',
              dev,
              '| error:',
              (lastError as Error).message
            );
          }
          // Próbuj kolejnego urządzenia
        }
      }

      if (!this.loaded) {
        throw lastError || new Error('Unknown error during LLM model load');
      }
    } catch (error) {
      this.loaded = false;
      throw new Error(
        `Failed to load LLM model ${this.config.model}: ${(error as Error).message}`
      );
    } finally {
      this.loading = false;
      if (typeof console !== 'undefined' && console.log) {
        console.log('[LLMModel] load(): finished, loaded=', this.loaded);
      }
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
      (
        input: Message[] | string,
        opts?: unknown
      ): Promise<Array<{ generated_text: Message[] | string }>>;
      tokenizer?: LLMTokenizer;
      model?: LLMPipelineModel;
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
    // Derive special tokens from tokenizer/model config when available
    const eosId =
      pipeline.tokenizer?.eos_token_id ??
      pipeline.model?.config?.eos_token_id ??
      50256;
    const padId =
      pipeline.tokenizer?.pad_token_id ??
      pipeline.model?.config?.pad_token_id ??
      eosId;

    const generationOptions = {
      max_new_tokens: options.maxTokens || this.config.maxTokens || 256,
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
      top_p: options.topP ?? this.config.topP ?? 0.9,
      top_k: options.topK ?? this.config.topK ?? 50,
      repetition_penalty:
        options.repetitionPenalty ?? this.config.repetitionPenalty ?? 1.0,
      do_sample: true,
      // Stabilize ONNX Runtime execution
      use_cache: false,
      return_full_text: false,
      eos_token_id: eosId,
      pad_token_id: padId,
    } as Record<string, unknown>;

    try {
      // For models without chat_template, convert messages to simple text
      let input: string | Message[];

      // Check if tokenizer has chat_template
      const hasChatTemplate =
        pipeline.tokenizer &&
        'chat_template' in pipeline.tokenizer &&
        pipeline.tokenizer.chat_template;

      if (hasChatTemplate) {
        // Use messageArray for models with chat_template
        input = messageArray;
      } else {
        // Convert to simple text for models without chat_template
        input = messageArray
          .filter(msg => msg.role !== 'system') // Skip system messages for simple models
          .map(msg => msg.content)
          .join('\n');
        if ((input as string).trim().length === 0) {
          input = ' ';
        }
      }

      const result = await pipeline(input, generationOptions);

      // Handle different response formats
      let generatedMessage: Message;
      const gen = result[0].generated_text as unknown;
      if (hasChatTemplate) {
        // Expect an array of messages
        const arr = Array.isArray(gen) ? (gen as Message[]) : [];
        const lastMessage = arr.at(-1);
        if (!lastMessage) {
          throw new Error('No response generated');
        }
        generatedMessage = lastMessage;
      } else {
        // For simple text completion, wrap in Message format
        const textResult = typeof gen === 'string' ? gen : String(gen ?? '');
        generatedMessage = {
          role: 'assistant',
          content: textResult,
        };
      }

      if (!generatedMessage) {
        throw new Error('No response generated');
      }

      // Calculate token usage (approximate)
      const promptTokens = this.estimateTokens(
        messageArray.map(m => m.content).join(' ')
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

    // Derive special tokens using typed pipeline
    const typedPipeline = this.getPipeline() as {
      tokenizer?: LLMTokenizer;
      model?: LLMPipelineModel;
    };
    const eosId =
      typedPipeline?.tokenizer?.eos_token_id ??
      typedPipeline?.model?.config?.eos_token_id ??
      50256;
    const padId =
      typedPipeline?.tokenizer?.pad_token_id ??
      typedPipeline?.model?.config?.pad_token_id ??
      eosId;

    const generationOptions = {
      max_new_tokens: options.maxTokens || this.config.maxTokens || 256,
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
      top_p: options.topP ?? this.config.topP ?? 0.9,
      do_sample: true,
      use_cache: false,
      return_full_text: false,
      eos_token_id: eosId,
      pad_token_id: padId,
    } as Record<string, unknown>;

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
      (
        input: Message[] | string,
        opts?: unknown
      ): Promise<Array<{ generated_text: Message[] | string }>>;
      tokenizer: LLMTokenizer;
      model?: LLMPipelineModel;
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

    // Check if tokenizer has chat_template
    const hasChatTemplate =
      pipeline.tokenizer &&
      'chat_template' in pipeline.tokenizer &&
      pipeline.tokenizer.chat_template;

    // Prepare input based on model capabilities
    let input: string | Message[];
    if (hasChatTemplate) {
      input = messageArray;
    } else {
      // Convert to simple text for models without chat_template
      input = messageArray
        .filter(msg => msg.role !== 'system') // Skip system messages for simple models
        .map(msg => msg.content)
        .join('\n');
    }

    const tokens: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const streamer = new TextStreamer(pipeline.tokenizer as any, {
      skip_prompt: true,
      callback_function: (text: string) => {
        tokens.push(text);
      },
    });

    const eosId =
      pipeline.tokenizer?.eos_token_id ??
      pipeline.model?.config?.eos_token_id ??
      50256;
    const padId =
      pipeline.tokenizer?.pad_token_id ??
      pipeline.model?.config?.pad_token_id ??
      eosId;

    const generationOptions = {
      max_new_tokens: options.maxTokens || this.config.maxTokens || 256,
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
      top_p: options.topP ?? this.config.topP ?? 0.9,
      do_sample: true,
      streamer,
      use_cache: false,
      return_full_text: false,
      eos_token_id: eosId,
      pad_token_id: padId,
    } as Record<string, unknown>;

    // Start generation
    const generationPromise = pipeline(input, generationOptions);

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
          new Promise(resolve => setTimeout(() => resolve(false), 50)),
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
