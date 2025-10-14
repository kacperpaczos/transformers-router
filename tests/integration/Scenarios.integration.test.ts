/**
 * Real-world scenario tests
 */

import { createAIProvider } from '../../src/core/AIProvider';

describe('Real-World Scenarios', () => {
  const provider = createAIProvider({
    llm: {
      model: 'Xenova/gpt2',
      dtype: 'fp32',
      device: 'cpu',
      maxTokens: 100,
    },
    embedding: {
      model: 'Xenova/all-MiniLM-L6-v2',
      dtype: 'fp32',
      device: 'cpu',
    },
  });

  beforeAll(async () => {
    jest.setTimeout(600000); // 10 minutes for complex scenarios
    await provider.warmup();
  });

  afterAll(async () => {
    await provider.dispose();
  });

  describe('Multi-turn Conversation', () => {
    it('should handle conversation with context', async () => {
      const conversation: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: 'You are a helpful assistant.' },
      ];

      // Turn 1
      conversation.push({ role: 'user', content: 'My name is Alice' });
      const response1 = await provider.chat(conversation);
      conversation.push({ role: 'assistant', content: response1.content });

      expect(response1.content).toBeDefined();

      // Turn 2
      conversation.push({ role: 'user', content: 'What is my name?' });
      const response2 = await provider.chat(conversation);

      expect(response2.content).toBeDefined();
      expect(response2.content.length).toBeGreaterThan(0);

      console.log(`Multi-turn conversation:`);
      console.log(`Turn 1: "${response1.content}"`);
      console.log(`Turn 2: "${response2.content}"`);
    }, 120000);

    it('should maintain context over 10 turns', async () => {
      const conversation: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: 'You are a counting assistant.' },
      ];

      for (let i = 1; i <= 10; i++) {
        conversation.push({ 
          role: 'user', 
          content: `Count to ${i}` 
        });
        
        const response = await provider.chat(conversation);
        
        conversation.push({ 
          role: 'assistant', 
          content: response.content 
        });

        expect(response.content).toBeDefined();
      }

      expect(conversation.length).toBe(21); // 1 system + 10 user + 10 assistant
      console.log(`✅ Completed 10-turn conversation`);
    }, 300000);
  });

  describe('RAG Pipeline (Retrieval Augmented Generation)', () => {
    it('should implement complete RAG workflow', async () => {
      // 1. Knowledge base
      const documents = [
        'Paris is the capital of France. It is known for the Eiffel Tower.',
        'Berlin is the capital of Germany. It is known for the Brandenburg Gate.',
        'Warsaw is the capital of Poland. It is known for the Palace of Culture.',
        'London is the capital of England. It is known for Big Ben.',
        'Rome is the capital of Italy. It is known for the Colosseum.',
      ];

      // 2. User query
      const query = 'What is the capital of Poland?';

      // 3. Semantic search - find relevant document
      const result = await provider.findSimilar(query, documents);

      expect(result.index).toBe(2); // Warsaw document
      expect(result.text).toContain('Warsaw');

      console.log(`✅ Found relevant document: "${result.text}" (similarity: ${result.similarity})`);

      // 4. Use LLM with context
      const contextPrompt: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: 'Answer based on the provided context.' },
        { role: 'user', content: `Context: ${result.text}\n\nQuestion: ${query}` },
      ];

      const answer = await provider.chat(contextPrompt);

      expect(answer.content).toBeDefined();
      expect(answer.content.length).toBeGreaterThan(0);

      console.log(`✅ RAG answer: "${answer.content}"`);
    }, 120000);

    it('should perform semantic search across large knowledge base', async () => {
      // Create knowledge base with 100 documents
      const documents = Array.from({ length: 100 }, (_, i) => {
        const topics = ['science', 'history', 'art', 'technology', 'nature'];
        const topic = topics[i % topics.length];
        return `Document ${i} is about ${topic} and contains information number ${i}.`;
      });

      // Query for technology
      const query = 'tell me about computers and software';

      const start = Date.now();
      const result = await provider.findSimilar(query, documents);
      const duration = Date.now() - start;

      expect(result.text).toContain('technology');
      
      console.log(`✅ Found in ${duration}ms: "${result.text}"`);
      
      // Should be reasonably fast
      expect(duration).toBeLessThan(10000);
    }, 60000);
  });

  describe('Multimodal Workflow', () => {
    it('should chain LLM with embeddings for enhanced search', async () => {
      // 1. Generate query expansions with LLM
      const originalQuery = 'machine learning';
      const expansionPrompt = `Generate 3 related search terms for: "${originalQuery}". List them separated by commas.`;
      
      const expansion = await provider.complete(expansionPrompt, { maxTokens: 50 });
      
      expect(expansion).toBeDefined();

      // 2. Use embeddings to find documents
      const documents = [
        'Neural networks are used in deep learning',
        'Cooking recipes for beginners',
        'AI and machine learning applications',
        'Travel guide to Europe',
      ];

      const result = await provider.findSimilar(originalQuery, documents);

      // Should find ML-related documents
      expect([0, 2]).toContain(result.index);

      console.log(`✅ Query expansion: "${expansion}"`);
      console.log(`✅ Found document: "${result.text}"`);
    }, 120000);
  });

  describe('Streaming Performance', () => {
    it('should stream tokens efficiently', async () => {
      const prompt = 'Write a short story';
      
      const tokens: string[] = [];
      const timestamps: number[] = [];
      let firstTokenTime: number | null = null;

      const start = Date.now();
      
      for await (const token of provider.stream(prompt, { maxTokens: 50 })) {
        const now = Date.now();
        
        if (!firstTokenTime) {
          firstTokenTime = now - start;
        }
        
        tokens.push(token);
        timestamps.push(now - start);
      }

      const totalDuration = Date.now() - start;

      expect(tokens.length).toBeGreaterThan(0);
      expect(firstTokenTime).toBeLessThan(10000); // First token within 10s

      const avgTimePerToken = totalDuration / tokens.length;
      
      console.log(`✅ Streaming: ${tokens.length} tokens in ${totalDuration}ms`);
      console.log(`   First token: ${firstTokenTime}ms`);
      console.log(`   Avg per token: ${avgTimePerToken.toFixed(2)}ms`);
    }, 60000);
  });

  describe('Resource Cleanup', () => {
    it('should properly cleanup after multiple dispose calls', async () => {
      const tempProvider = createAIProvider({
        llm: {
          model: 'Xenova/gpt2',
          dtype: 'fp32',
          device: 'cpu',
        },
      });

      await tempProvider.warmup('llm');
      expect(tempProvider.isReady('llm')).toBe(true);

      // First dispose
      await tempProvider.dispose();
      expect(tempProvider.isReady('llm')).toBe(false);

      // Second dispose should not throw
      await expect(tempProvider.dispose()).resolves.not.toThrow();
    }, 120000);

    it('should handle concurrent dispose calls', async () => {
      const tempProvider = createAIProvider({
        llm: {
          model: 'Xenova/gpt2',
          dtype: 'fp32',
          device: 'cpu',
        },
      });

      await tempProvider.warmup('llm');

      // Call dispose multiple times concurrently
      const disposePromises = [
        tempProvider.dispose(),
        tempProvider.dispose(),
        tempProvider.dispose(),
      ];

      await expect(Promise.all(disposePromises)).resolves.not.toThrow();
    }, 120000);
  });
});

