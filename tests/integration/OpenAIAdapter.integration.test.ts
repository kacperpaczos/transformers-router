/**
 * Integration tests for OpenAI Adapter - tests real OpenAI compatibility
 */

import { createAIProvider, OpenAIAdapter } from '../../src/index';

describe('OpenAI Adapter Integration Tests', () => {
  let provider: ReturnType<typeof createAIProvider>;
  let openaiAdapter: OpenAIAdapter;

  beforeAll(async () => {
    jest.setTimeout(300000); // 5 minutes

    console.log('Setting up OpenAI Adapter for integration tests...');

    provider = createAIProvider({
      llm: {
        model: 'Xenova/Qwen2-0.5B-Instruct',
        dtype: 'q8',
        device: 'cpu',
        maxTokens: 100,
      },
    });

    openaiAdapter = new OpenAIAdapter(provider);

    provider.on('progress', ({ modality, file, progress }) => {
      console.log(`Loading ${modality}: ${file} (${progress}%)`);
    });

    await provider.warmup('llm');
  });

  afterAll(async () => {
    console.log('Cleaning up...');
    await provider.dispose();
  });

  describe('createChatCompletion', () => {
    it('should create chat completion with basic parameters', async () => {
      console.log('Testing createChatCompletion...');

      const response = await openaiAdapter.createChatCompletion({
        messages: [
          { role: 'user', content: 'What is the capital of France?' },
        ],
        temperature: 0.7,
        max_tokens: 50,
      });

      expect(response).toHaveProperty('id');
      expect(response.object).toBe('chat.completion');
      expect(response.choices).toHaveLength(1);
      expect(response.choices[0]).toHaveProperty('message');
      expect(response.choices[0].message.role).toBe('assistant');
      expect(response.choices[0].message.content).toBeDefined();
      expect(response.usage).toBeDefined();
    }, 30000);

    it('should handle system messages', async () => {
      console.log('Testing with system messages...');

      const response = await openaiAdapter.createChatCompletion({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello!' },
        ],
      });

      expect(response.choices[0].message.content).toBeDefined();
    }, 30000);

    it('should handle streaming responses', async () => {
      console.log('Testing streaming chat completion...');

      const stream = await openaiAdapter.createChatCompletionStream({
        messages: [{ role: 'user', content: 'Count to 3' }],
        stream: true,
      });

      const chunks: string[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);

      // Check that we got proper SSE format
      const firstChunk = chunks[0];
      expect(firstChunk).toContain('data: ');
      expect(firstChunk).toContain('"object":"chat.completion.chunk"');
    }, 30000);

    it('should respect max_tokens parameter', async () => {
      console.log('Testing max_tokens parameter...');

      const response = await openaiAdapter.createChatCompletion({
        messages: [{ role: 'user', content: 'Tell me a long story' }],
        max_tokens: 10,
      });

      // Should be limited
      const content = response.choices[0].message.content;
      expect(content.length).toBeLessThan(100); // Rough estimate
    }, 30000);

    it('should handle different temperatures', async () => {
      console.log('Testing temperature variations...');

      const prompt = 'Write a short poem about';

      const response1 = await openaiAdapter.createChatCompletion({
        messages: [{ role: 'user', content: prompt + ' cats' }],
        temperature: 0.1,
      });

      const response2 = await openaiAdapter.createChatCompletion({
        messages: [{ role: 'user', content: prompt + ' dogs' }],
        temperature: 0.9,
      });

      const content1 = response1.choices[0].message.content;
      const content2 = response2.choices[0].message.content;

      // Should produce different outputs
      expect(content1).not.toBe(content2);
    }, 60000);
  });

  describe('createCompletion', () => {
    it('should create text completion', async () => {
      console.log('Testing createCompletion...');

      const response = await openaiAdapter.createCompletion({
        prompt: 'The weather today is',
        max_tokens: 20,
      });

      expect(response).toHaveProperty('id');
      expect(response.object).toBe('text_completion');
      expect(response.choices).toHaveLength(1);
      expect(response.choices[0]).toHaveProperty('text');
      expect(response.choices[0].text).toBeDefined();
      expect(response.usage).toBeDefined();
    }, 30000);

    it('should handle empty prompt', async () => {
      console.log('Testing empty prompt handling...');

      const response = await openaiAdapter.createCompletion({
        prompt: '',
        max_tokens: 10,
      });

      expect(response.choices[0].text).toBeDefined();
    }, 30000);
  });

  describe('createEmbeddings', () => {
    beforeAll(async () => {
      // Add embedding model to provider
      provider = createAIProvider({
        llm: {
          model: 'Xenova/LaMini-Flan-T5-248M',
          dtype: 'fp32',
        },
        embedding: {
          model: 'Xenova/all-MiniLM-L6-v2',
          dtype: 'fp32',
        },
      });

      await provider.warmup('embedding');
      openaiAdapter = new OpenAIAdapter(provider);
    });

    it('should create embeddings for single text', async () => {
      console.log('Testing createEmbeddings (single text)...');

      const response = await openaiAdapter.createEmbeddings({
        input: 'Hello world',
      });

      expect(response.object).toBe('list');
      expect(response.data).toHaveLength(1);
      expect(response.data[0]).toHaveProperty('embedding');
      expect(Array.isArray(response.data[0].embedding)).toBe(true);
      expect(response.data[0].embedding.length).toBeGreaterThan(0);
      expect(response.usage).toBeDefined();
    }, 60000);

    it('should create embeddings for multiple texts', async () => {
      console.log('Testing createEmbeddings (multiple texts)...');

      const response = await openaiAdapter.createEmbeddings({
        input: ['Hello world', 'Goodbye world', 'How are you?'],
      });

      expect(response.data).toHaveLength(3);
      response.data.forEach((item, index) => {
        expect(item.index).toBe(index);
        expect(item.embedding).toBeDefined();
        expect(Array.isArray(item.embedding)).toBe(true);
      });
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should handle invalid parameters', async () => {
      await expect(openaiAdapter.createChatCompletion({
        messages: [], // Empty messages
      })).rejects.toThrow();
    }, 10000);

    it('should handle provider errors gracefully', async () => {
      // Temporarily make provider unavailable
      await provider.unload('llm');

      await expect(openaiAdapter.createChatCompletion({
        messages: [{ role: 'user', content: 'test' }],
      })).rejects.toThrow();

      // Restore
      await provider.warmup('llm');
    }, 120000);
  });

  describe('Response Format', () => {
    it('should match OpenAI API response format', async () => {
      const response = await openaiAdapter.createChatCompletion({
        messages: [{ role: 'user', content: 'Hi' }],
      });

      // Check required OpenAI fields
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('object');
      expect(response).toHaveProperty('created');
      expect(response).toHaveProperty('model');
      expect(response).toHaveProperty('choices');
      expect(response).toHaveProperty('usage');

      // Check choices structure
      expect(Array.isArray(response.choices)).toBe(true);
      expect(response.choices[0]).toHaveProperty('index');
      expect(response.choices[0]).toHaveProperty('message');
      expect(response.choices[0]).toHaveProperty('finish_reason');

      // Check usage structure
      expect(response.usage).toHaveProperty('prompt_tokens');
      expect(response.usage).toHaveProperty('completion_tokens');
      expect(response.usage).toHaveProperty('total_tokens');
    });
  });
});

