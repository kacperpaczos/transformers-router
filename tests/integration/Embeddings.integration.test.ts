/**
 * Integration tests for Embeddings - real model testing
 */

import { createAIProvider } from '../../src/core/AIProvider';

describe('Embeddings Integration Tests', () => {
  const provider = createAIProvider({
    embedding: {
      model: 'Xenova/all-MiniLM-L6-v2',
      dtype: 'fp32',
      device: 'cpu',
    },
  });

  beforeAll(async () => {
    jest.setTimeout(300000);
    console.log('Loading embedding model...');
    
    provider.on('progress', ({ modality, status, file, progress }) => {
      if (modality === 'embedding') {
        console.log(`[Embedding] ${status}${file ? ` ${file}` : ''}${progress ? ` ${progress}%` : ''}`);
      }
    });

    await provider.warmup('embedding');
  });

  afterAll(async () => {
    await provider.dispose();
  });

  describe('Basic Embedding', () => {
    it('should embed single text', async () => {
      const text = 'Hello world';
      const embeddings = await provider.embed(text);

      expect(Array.isArray(embeddings)).toBe(true);
      expect(embeddings.length).toBe(1);
      expect(Array.isArray(embeddings[0])).toBe(true);
      expect(embeddings[0].length).toBeGreaterThan(0);
      
      // Check all values are numbers
      embeddings[0].forEach(value => {
        expect(typeof value).toBe('number');
        expect(isNaN(value)).toBe(false);
      });
    }, 30000);

    it('should embed multiple texts', async () => {
      const texts = [
        'The cat sits on the mat',
        'The dog runs in the park',
        'Birds fly in the sky',
      ];

      const embeddings = await provider.embed(texts);

      expect(embeddings.length).toBe(3);
      embeddings.forEach(embedding => {
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBeGreaterThan(0);
      });
    }, 30000);

    it('should produce consistent embeddings for same text', async () => {
      const text = 'Consistency test';
      
      const embeddings1 = await provider.embed(text);
      const embeddings2 = await provider.embed(text);

      expect(embeddings1[0]).toEqual(embeddings2[0]);
    }, 30000);

    it('should have correct embedding dimensions', async () => {
      const text = 'Dimension test';
      const embeddings = await provider.embed(text);

      // all-MiniLM-L6-v2 produces 384-dimensional embeddings
      expect(embeddings[0].length).toBe(384);
    }, 30000);
  });

  describe('Similarity', () => {
    it('should calculate cosine similarity between texts', async () => {
      const text1 = 'I love programming';
      const text2 = 'Coding is my passion';

      const similarity = await provider.similarity(text1, text2);

      expect(typeof similarity).toBe('number');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    }, 30000);

    it('should detect semantic similarity', async () => {
      const text1 = 'The weather is sunny today';
      const text2 = 'It is a beautiful day with clear skies';
      const text3 = 'I hate vegetables';

      const similarity12 = await provider.similarity(text1, text2);
      const similarity13 = await provider.similarity(text1, text3);

      // Semantically similar texts should have higher similarity
      expect(similarity12).toBeGreaterThan(similarity13);
      expect(similarity12).toBeGreaterThan(0.5);
    }, 60000);

    it('should find most similar text from list', async () => {
      const query = 'artificial intelligence';
      const texts = [
        'Machine learning is a subset of AI',
        'I like pizza and pasta',
        'Neural networks are powerful',
        'The weather is nice today',
      ];

      const result = await provider.findSimilar(query, texts);

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('similarity');
      expect(result).toHaveProperty('index');
      
      // Should find ML/AI related text (index 0 or 2)
      expect([0, 2]).toContain(result.index);
      expect(result.similarity).toBeGreaterThan(0.3);
    }, 30000);
  });

  describe('Semantic Search (RAG Use Case)', () => {
    it('should perform semantic search on documents', async () => {
      const documents = [
        'Python is a programming language',
        'JavaScript is used for web development',
        'TypeScript adds types to JavaScript',
        'Cats are popular pets',
        'Dogs are loyal companions',
        'React is a JavaScript library',
      ];

      const query = 'web programming';

      const result = await provider.findSimilar(query, documents);

      // Should find programming-related docs (0, 1, 2, 5)
      expect([0, 1, 2, 5]).toContain(result.index);
      expect(result.text).toMatch(/JavaScript|TypeScript|React|Python/);
    }, 30000);

    it('should rank multiple documents by relevance', async () => {
      const documents = [
        'Machine learning uses neural networks',
        'Cooking pasta requires boiling water',
        'Deep learning is part of machine learning',
      ];

      const query = 'artificial intelligence and neural networks';

      // Get embeddings for all
      const allEmbeddings = await provider.embed([query, ...documents]);
      const queryEmbedding = allEmbeddings[0];
      const docEmbeddings = allEmbeddings.slice(1);

      // Calculate similarities manually
      const similarities = await Promise.all(
        documents.map((doc, i) => 
          provider.similarity(query, doc)
        )
      );

      // First and third docs should be more similar than second
      expect(similarities[0]).toBeGreaterThan(similarities[1]);
      expect(similarities[2]).toBeGreaterThan(similarities[1]);
    }, 60000);
  });

  describe('Batch Processing', () => {
    it('should handle large batch of texts', async () => {
      const texts = Array.from({ length: 100 }, (_, i) => 
        `This is test sentence number ${i}`
      );

      const start = Date.now();
      const embeddings = await provider.embed(texts);
      const duration = Date.now() - start;

      expect(embeddings.length).toBe(100);
      
      // Should be reasonably fast (< 30s for 100 texts)
      expect(duration).toBeLessThan(30000);
      
      console.log(`Embedded 100 texts in ${duration}ms`);
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should handle empty text', async () => {
      await expect(provider.embed('')).rejects.toThrow();
    });

    it('should handle very long text', async () => {
      const longText = 'word '.repeat(10000);
      const embeddings = await provider.embed(longText);

      expect(embeddings.length).toBe(1);
      expect(embeddings[0].length).toBe(384);
    }, 60000);
  });
});

