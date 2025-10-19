/**
 * React Hook for Chat functionality
 */

import { useState, useCallback, useRef } from 'react';
import type { AIProvider } from '../core/AIProvider';
import type { Message, ChatResponse, ChatOptions } from '../core/types';

export interface UseChatOptions extends ChatOptions {
  initialMessages?: Message[];
  onResponse?: (response: ChatResponse) => void;
  onError?: (error: Error) => void;
}

export interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  send: (content: string) => Promise<void>;
  sendMessages: (messages: Message[]) => Promise<void>;
  clear: () => void;
  retry: () => Promise<void>;
}

/**
 * Hook for managing chat conversations
 */
export function useChat(
  provider: AIProvider | null,
  options: UseChatOptions = {}
): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>(
    options.initialMessages || []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const lastUserMessageRef = useRef<string>('');
  const { onResponse, onError, ...chatOptions } = options;

  /**
   * Send a user message
   */
  const send = useCallback(
    async (content: string) => {
      if (!provider) {
        const err = new Error('Provider not initialized');
        setError(err);
        onError?.(err);
        return;
      }

      if (!content.trim()) {
        return;
      }

      setIsLoading(true);
      setError(null);
      lastUserMessageRef.current = content;

      const userMessage: Message = {
        role: 'user',
        content,
      };

      // Add user message immediately
      setMessages((prev: Message[]) => [...prev, userMessage]);

      try {
        // Get response from provider
        const response = await provider.chat(
          [...messages, userMessage],
          chatOptions
        );

        // Add assistant response
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.content,
        };

        setMessages((prev: Message[]) => [...prev, assistantMessage]);
        onResponse?.(response);
      } catch (err) {
        const error = err as Error;
        setError(error);
        onError?.(error);

        // Remove user message on error
        setMessages((prev: Message[]) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
      }
    },
    [provider, messages, chatOptions, onResponse, onError]
  );

  /**
   * Send custom messages
   */
  const sendMessages = useCallback(
    async (customMessages: Message[]) => {
      if (!provider) {
        const err = new Error('Provider not initialized');
        setError(err);
        onError?.(err);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await provider.chat(customMessages, chatOptions);

        // Add all messages
        setMessages(customMessages);

        // Add assistant response
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.content,
        };

        setMessages((prev: Message[]) => [...prev, assistantMessage]);
        onResponse?.(response);
      } catch (err) {
        const error = err as Error;
        setError(error);
        onError?.(error);
      } finally {
        setIsLoading(false);
      }
    },
    [provider, chatOptions, onResponse, onError]
  );

  /**
   * Clear chat history
   */
  const clear = useCallback(() => {
    setMessages(options.initialMessages || []);
    setError(null);
  }, [options.initialMessages]);

  /**
   * Retry last message
   */
  const retry = useCallback(async () => {
    if (!lastUserMessageRef.current) {
      return;
    }

    await send(lastUserMessageRef.current);
  }, [send]);

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
