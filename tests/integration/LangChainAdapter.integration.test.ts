/**
 * Integration tests for LangChain Adapter
 */

import { createAIProvider, createLangChainLLM, createLangChainEmbeddings } from '../../src/index';

describe('LangChain Adapter Integration Tests', () => {
  let provider: ReturnType<typeof createAIProvider>;
  let langChainLLM: ReturnType<typeof createLangChainLLM>;
  let langChainEmbeddings: ReturnType<typeof createLangChainEmbeddings>;

  beforeAll(async () => {
    jest.setTimeout(300000); // 5 minutes

    console.log('Setting up LangChain Adapter for integration tests...');

    provider = createAIProvider({
      llm: {
        model: 'Xenova/Qwen2-0.5B-Instruct',
        dtype: 'q8',
        device: 'cpu',
        maxTokens: 100,
      },
      embedding: {
        model: 'Xenova/all-MiniLM-L6-v2',
        dtype: 'fp32',
        device: 'cpu',
      },
    });

    langChainLLM = createLangChainLLM(provider, {
      temperature: 0.7,
      maxTokens: 50,
    });

    langChainEmbeddings = createLangChainEmbeddings(provider);

    provider.on('progress', ({ modality, file, progress }) => {
      console.log(`Loading ${modality}: ${file} (${progress}%)`);
    });

    await provider.warmup();
  });

  afterAll(async () => {
    console.log('Cleaning up...');
    await provider.dispose();
  });

  describe('LangChainLLM', () => {
    describe('call method', () => {
      it('should call LLM with prompt', async () => {
        console.log('Testing LangChainLLM.call()...');

        const result = await langChainLLM.call('What is 2+2?');

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        expect(result).toMatch(/\d+/); // Should contain numbers
      }, 30000);

      it('should respect temperature parameter', async () => {
        console.log('Testing temperature parameter...');

        const llmLowTemp = createLangChainLLM(provider, {
          temperature: 0.1,
          maxTokens: 30,
        });

        const llmHighTemp = createLangChainLLM(provider, {
          temperature: 0.9,
          maxTokens: 30,
        });

        const result1 = await llmLowTemp.call('Write a creative sentence');
        const result2 = await llmHighTemp.call('Write a creative sentence');

        // Different temperatures should produce different outputs
        expect(result1).not.toBe(result2);
      }, 60000);
    });

    describe('callMessages method', () => {
      it('should call LLM with message array', async () => {
        console.log('Testing LangChainLLM.callMessages()...');

        const messages = [
          { role: 'system', content: 'You are a math tutor.' },
          { role: 'user', content: 'What is the square root of 16?' },
        ];

        const result = await langChainLLM.callMessages(messages);

        expect(typeof result).toBe('string');
        expect(result).toMatch(/4/); // Should contain the answer
      }, 30000);

      it('should handle conversation context', async () => {
        console.log('Testing conversation context...');

        const messages = [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'My name is Alice.' },
          { role: 'assistant', content: 'Hello Alice! Nice to meet you.' },
          { role: 'user', content: 'What is my name?' },
        ];

        const result = await langChainLLM.callMessages(messages);

        expect(typeof result).toBe('string');
        // Should remember the name from context
        expect(result.toLowerCase()).toMatch(/alice/);
      }, 30000);
    });

    describe('stream method', () => {
      it('should stream responses', async () => {
        console.log('Testing LangChainLLM.stream()...');

        const tokens: string[] = [];
        for await (const token of langChainLLM.stream('Count to 5')) {
          tokens.push(token);
        }

        expect(tokens.length).toBeGreaterThan(0);

        const fullResponse = tokens.join('');
        expect(fullResponse.length).toBeGreaterThan(0);
        expect(fullResponse).toMatch(/\d+/); // Should contain numbers
      }, 30000);
    });

    describe('properties', () => {
      it('should have correct model name', () => {
        expect(langChainLLM.modelName).toBe('Xenova/LaMini-Flan-T5-248M');
      });

      it('should have correct llm type', () => {
        expect(langChainLLM.llmType).toBe('transformers-router');
      });
    });
  });

  describe('LangChainEmbeddings', () => {
    describe('embedDocuments', () => {
      it('should embed multiple documents', async () => {
        console.log('Testing embedDocuments()...');

        const documents = [
          'The cat sits on the mat',
          'The dog runs in the park',
          'Birds fly in the sky',
        ];

        const embeddings = await langChainEmbeddings.embedDocuments(documents);

        expect(embeddings).toHaveLength(3);
        embeddings.forEach(embedding => {
          expect(Array.isArray(embedding)).toBe(true);
          expect(embedding.length).toBeGreaterThan(0);
          embedding.forEach(value => {
            expect(typeof value).toBe('number');
          });
        });
      }, 60000);

      it('should produce consistent embeddings', async () => {
        console.log('Testing embedding consistency...');

        const text = 'Hello world';
        const embeddings1 = await langChainEmbeddings.embedDocuments([text]);
        const embeddings2 = await langChainEmbeddings.embedDocuments([text]);

        expect(embeddings1[0]).toEqual(embeddings2[0]);
      }, 60000);
    });

    describe('embedQuery', () => {
      it('should embed single query', async () => {
        console.log('Testing embedQuery()...');

        const query = 'What is artificial intelligence?';
        const embedding = await langChainEmbeddings.embedQuery(query);

        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBeGreaterThan(0);
        embedding.forEach(value => {
          expect(typeof value).toBe('number');
        });
      }, 30000);
    });

    describe('semantic similarity', () => {
      it('should compute semantic similarity', async () => {
        console.log('Testing semantic similarity...');

        const texts = [
          'I love programming',
          'Coding is my passion',
          'I hate vegetables',
        ];

        const embeddings = await langChainEmbeddings.embedDocuments(texts);

        // First two should be more similar than first and third
        const similarity1 = cosineSimilarity(embeddings[0], embeddings[1]);
        const similarity2 = cosineSimilarity(embeddings[0], embeddings[2]);

        expect(similarity1).toBeGreaterThan(similarity2);
      }, 60000);
    });
  });

  describe('Integration with LangChain patterns', () => {
    it('should work with prompt templates', async () => {
      console.log('Testing prompt template pattern...');

      // Simulate LangChain PromptTemplate usage
      const template = (topic: string) => `Explain ${topic} in simple terms:`;

      const prompt = template('quantum computing');
      const result = await langChainLLM.call(prompt);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }, 30000);

    it('should handle multiple calls efficiently', async () => {
      console.log('Testing multiple sequential calls...');

      const prompts = [
        'What is 1+1?',
        'What is 2+2?',
        'What is 3+3?',
      ];

      const results = await Promise.all(
        prompts.map(prompt => langChainLLM.call(prompt))
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(typeof result).toBe('string');
        expect(result).toMatch(/\d+/); // Should contain answers
      });
    }, 90000);
  });
});

// Helper function for cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

