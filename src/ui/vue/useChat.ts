/**
 * Vue Composable for Chat functionality
 */

import { ref, type Ref } from 'vue';
import type { AIProvider } from '@app/AIProvider';
import type { Message, ChatResponse, ChatOptions } from '../../core/types';

export interface UseChatOptions extends ChatOptions {
  initialMessages?: Message[];
  onResponse?: (response: ChatResponse) => void;
  onError?: (error: Error) => void;
}

export interface UseChatReturn {
  messages: Ref<Message[]>;
  isLoading: Ref<boolean>;
  error: Ref<Error | null>;
  send: (content: string) => Promise<void>;
  sendMessages: (messages: Message[]) => Promise<void>;
  clear: () => void;
  retry: () => Promise<void>;
}

/**
 * Composable for managing chat conversations
 */
export function useChat(
  provider: Ref<AIProvider | null> | AIProvider | null,
  options: UseChatOptions = {}
): UseChatReturn {
  const messages = ref<Message[]>(options.initialMessages || []);
  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  let lastUserMessage = '';
  const { onResponse, onError, ...chatOptions } = options;

  // Get provider value
  const getProvider = (): AIProvider | null => {
    if (!provider) return null;
    return 'value' in provider ? provider.value : provider;
  };

  /**
   * Send a user message
   */
  const send = async (content: string) => {
    const currentProvider = getProvider();

    if (!currentProvider) {
      const err = new Error('Provider not initialized');
      error.value = err;
      onError?.(err);
      return;
    }

    if (!content.trim()) {
      return;
    }

    isLoading.value = true;
    error.value = null;
    lastUserMessage = content;

    const userMessage: Message = {
      role: 'user',
      content,
    };

    // Add user message immediately
    messages.value = [...messages.value, userMessage];

    try {
      // Get response from provider
      const response = await currentProvider.chat(
        [...messages.value],
        chatOptions
      );

      // Add assistant response
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.content,
      };

      messages.value = [...messages.value, assistantMessage];
      onResponse?.(response);
    } catch (err) {
      const errorObj = err as Error;
      error.value = errorObj;
      onError?.(errorObj);

      // Remove user message on error
      messages.value = messages.value.slice(0, -1);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Send custom messages
   */
  const sendMessages = async (customMessages: Message[]) => {
    const currentProvider = getProvider();

    if (!currentProvider) {
      const err = new Error('Provider not initialized');
      error.value = err;
      onError?.(err);
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await currentProvider.chat(customMessages, chatOptions);

      // Set messages
      messages.value = customMessages;

      // Add assistant response
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.content,
      };

      messages.value = [...messages.value, assistantMessage];
      onResponse?.(response);
    } catch (err) {
      const errorObj = err as Error;
      error.value = errorObj;
      onError?.(errorObj);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Clear chat history
   */
  const clear = () => {
    messages.value = options.initialMessages || [];
    error.value = null;
  };

  /**
   * Retry last message
   */
  const retry = async () => {
    if (!lastUserMessage) {
      return;
    }

    await send(lastUserMessage);
  };

  return {
    messages,
    isLoading,
    error,
    send,
    sendMessages,
    clear,
    retry,
  };
}
