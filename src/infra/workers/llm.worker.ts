/**
 * LLM Worker - Handles text generation in Web Worker
 */

import { pipeline } from '@huggingface/transformers';
import type { Message } from '../../core/types';

interface WorkerRequest {
  id: string;
  type: 'load' | 'chat' | 'complete' | 'unload';
  data?: {
    model?: string;
    dtype?: string;
    device?: string;
    messages?: Message[] | string;
    prompt?: string;
    options?: {
      maxTokens?: number;
      temperature?: number;
      topP?: number;
    };
  };
}

interface WorkerResponse {
  id: string;
  type: string;
  data?: unknown;
  error?: string;
  progress?: {
    status: string;
    file?: string;
    progress?: number;
    loaded?: number;
    total?: number;
  };
}

let llmPipeline: unknown | null = null;
let modelLoaded = false;

// Handle messages from main thread
(globalThis as unknown as Worker).addEventListener(
  'message',
  async (event: MessageEvent<WorkerRequest>) => {
    const { id, type, data } = event.data;

    try {
      switch (type) {
        case 'load':
          await handleLoad(id, data);
          break;
        case 'chat':
          await handleChat(id, data);
          break;
        case 'complete':
          await handleComplete(id, data);
          break;
        case 'unload':
          handleUnload(id);
          break;
        default:
          throw new Error(`Unknown task type: ${type}`);
      }
    } catch (error) {
      postError(id, error as Error);
    }
  }
);

/**
 * Load LLM model
 */
async function handleLoad(id: string, data?: WorkerRequest['data']) {
  if (modelLoaded) {
    postResponse(id, { loaded: true });
    return;
  }

  const model = data?.model || 'onnx-community/Qwen2.5-0.5B-Instruct';
  const dtype = data?.dtype || 'q4';
  const device = data?.device || 'cpu';

  llmPipeline = (await pipeline('text-generation', model, {
    dtype: dtype as 'fp32' | 'fp16' | 'q8' | 'q4',
    device: device as 'cpu' | 'gpu' | 'webgpu',
    progress_callback: (progress: {
      status: string;
      file?: string;
      progress?: number;
      loaded?: number;
      total?: number;
    }) => {
      postProgress(id, {
        status: progress.status,
        file: progress.file,
        progress: progress.progress,
        loaded: progress.loaded,
        total: progress.total,
      });
    },
  })) as unknown;

  modelLoaded = true;
  postResponse(id, { loaded: true, model });
}

/**
 * Handle chat request
 */
async function handleChat(id: string, data?: WorkerRequest['data']) {
  if (!llmPipeline || !modelLoaded) {
    throw new Error('Model not loaded. Call load() first.');
  }

  const messages = data?.messages;
  if (!messages) {
    throw new Error('Messages are required for chat');
  }

  const messageArray: Message[] = Array.isArray(messages)
    ? messages
    : [{ role: 'user', content: messages }];

  const options = {
    max_new_tokens: data?.options?.maxTokens || 256,
    temperature: data?.options?.temperature ?? 0.7,
    top_p: data?.options?.topP ?? 0.9,
    do_sample: true,
  };

  const pipeline = llmPipeline as (
    input: Message[],
    opts: unknown
  ) => Promise<Array<{ generated_text: Message[] }>>;

  const result = await pipeline(messageArray, options);
  const generatedMessage = result[0].generated_text.at(-1);

  if (!generatedMessage) {
    throw new Error('No response generated');
  }

  postResponse(id, {
    content: generatedMessage.content,
    role: 'assistant',
  });
}

/**
 * Handle completion request
 */
async function handleComplete(id: string, data?: WorkerRequest['data']) {
  if (!llmPipeline || !modelLoaded) {
    throw new Error('Model not loaded. Call load() first.');
  }

  const prompt = data?.prompt;
  if (!prompt) {
    throw new Error('Prompt is required for completion');
  }

  const options = {
    max_new_tokens: data?.options?.maxTokens || 256,
    temperature: data?.options?.temperature ?? 0.7,
    top_p: data?.options?.topP ?? 0.9,
    do_sample: true,
  };

  const pipeline = llmPipeline as (
    input: string,
    opts: unknown
  ) => Promise<Array<{ generated_text: string }>>;

  const result = await pipeline(prompt, options);

  postResponse(id, {
    text: result[0].generated_text,
  });
}

/**
 * Unload model
 */
function handleUnload(id: string) {
  llmPipeline = null;
  modelLoaded = false;
  postResponse(id, { unloaded: true });
}

/**
 * Post response to main thread
 */
function postResponse(id: string, data: unknown) {
  const response: WorkerResponse = {
    id,
    type: 'response',
    data,
  };
  (globalThis as unknown as Worker).postMessage(response);
}

/**
 * Post error to main thread
 */
function postError(id: string, error: Error) {
  const response: WorkerResponse = {
    id,
    type: 'error',
    error: error.message,
  };
  (globalThis as unknown as Worker).postMessage(response);
}

/**
 * Post progress to main thread
 */
function postProgress(id: string, progress: WorkerResponse['progress']) {
  const response: WorkerResponse = {
    id,
    type: 'progress',
    progress,
  };
  (globalThis as unknown as Worker).postMessage(response);
}

// Notify that worker is ready
(globalThis as unknown as Worker).postMessage({ type: 'ready' });
