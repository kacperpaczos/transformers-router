/**
 * Embedding Integration Tests in Browser Environment
 */

import { test, expect } from '@playwright/test';

test.describe('Embedding Integration Tests (Browser)', () => {
  test('should generate embeddings in browser', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        embedding: { model: 'Xenova/all-MiniLM-L6-v2', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('embedding');
      
      const embeddings = await provider.embed(['Hello world', 'Goodbye world']);
      
      await provider.dispose();
      
      return {
        count: embeddings.length,
        dimension: embeddings[0].length,
        firstValue: embeddings[0][0],
      };
    });

    expect(result.count).toBe(2);
    expect(result.dimension).toBe(384); // MiniLM dimension
    expect(typeof result.firstValue).toBe('number');
  });

  test('should calculate cosine similarity', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        embedding: { model: 'Xenova/all-MiniLM-L6-v2', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('embedding');
      
      const emb1 = await provider.embed('The cat sits on the mat');
      const emb2 = await provider.embed('The cat is on the mat');
      const emb3 = await provider.embed('The dog runs in the park');
      
      // Simple cosine similarity
      const dotProduct = (a: number[], b: number[]) =>
        a.reduce((sum, val, i) => sum + val * b[i], 0);
      const magnitude = (a: number[]) =>
        Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
      const cosineSim = (a: number[], b: number[]) =>
        dotProduct(a, b) / (magnitude(a) * magnitude(b));
      
      const sim12 = cosineSim(emb1[0], emb2[0]);
      const sim13 = cosineSim(emb1[0], emb3[0]);
      
      await provider.dispose();
      
      return { sim12, sim13 };
    });

    expect(result.sim12).toBeGreaterThan(0.9); // Very similar
    expect(result.sim13).toBeLessThan(result.sim12); // Less similar
  });

  test('should handle single text input', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        embedding: { model: 'Xenova/all-MiniLM-L6-v2', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('embedding');
      
      const embedding = await provider.embed('Single text input');
      
      await provider.dispose();
      
      return {
        isArray: Array.isArray(embedding),
        length: embedding.length,
        dimension: embedding[0].length,
        firstValue: embedding[0][0],
      };
    });

    expect(result.isArray).toBe(true);
    expect(result.length).toBe(1);
    expect(result.dimension).toBe(384);
    expect(typeof result.firstValue).toBe('number');
  });

  test('should handle multiple texts', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        embedding: { model: 'Xenova/all-MiniLM-L6-v2', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('embedding');
      
      const texts = [
        'First text about technology',
        'Second text about science',
        'Third text about art',
        'Fourth text about music',
        'Fifth text about sports'
      ];
      
      const embeddings = await provider.embed(texts);
      
      await provider.dispose();
      
      return {
        count: embeddings.length,
        dimensions: embeddings.map(emb => emb.length),
        allSameDimension: embeddings.every(emb => emb.length === 384),
        firstEmbedding: embeddings[0].slice(0, 5), // First 5 values
      };
    });

    expect(result.count).toBe(5);
    expect(result.allSameDimension).toBe(true);
    expect(result.dimensions.every(d => d === 384)).toBe(true);
    expect(result.firstEmbedding.length).toBe(5);
  });

  test('should handle different pooling strategies', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        embedding: { model: 'Xenova/all-MiniLM-L6-v2', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('embedding');
      
      const text = 'This is a test sentence for pooling strategies';
      
      const meanEmbedding = await provider.embed(text, { pooling: 'mean' });
      const maxEmbedding = await provider.embed(text, { pooling: 'max' });
      const clsEmbedding = await provider.embed(text, { pooling: 'cls' });
      
      await provider.dispose();
      
      return {
        meanDim: meanEmbedding[0].length,
        maxDim: maxEmbedding[0].length,
        clsDim: clsEmbedding[0].length,
        allSameDim: meanEmbedding[0].length === maxEmbedding[0].length && 
                    maxEmbedding[0].length === clsEmbedding[0].length,
        differentValues: JSON.stringify(meanEmbedding[0].slice(0, 3)) !== 
                        JSON.stringify(maxEmbedding[0].slice(0, 3)),
      };
    });

    expect(result.meanDim).toBe(384);
    expect(result.maxDim).toBe(384);
    expect(result.clsDim).toBe(384);
    expect(result.allSameDim).toBe(true);
    // Different pooling strategies should produce different embeddings
    expect(result.differentValues).toBe(true);
  });

  test('should handle normalization', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        embedding: { model: 'Xenova/all-MiniLM-L6-v2', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('embedding');
      
      const text = 'Test normalization';
      
      const normalizedEmbedding = await provider.embed(text, { normalize: true });
      const unnormalizedEmbedding = await provider.embed(text, { normalize: false });
      
      // Calculate magnitude
      const magnitude = (arr: number[]) => 
        Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));
      
      const normMagnitude = magnitude(normalizedEmbedding[0]);
      const unnormMagnitude = magnitude(unnormalizedEmbedding[0]);
      
      await provider.dispose();
      
      return {
        normalizedMagnitude: normMagnitude,
        unnormalizedMagnitude: unnormMagnitude,
        isNormalized: Math.abs(normMagnitude - 1.0) < 0.01,
        isUnnormalized: unnormMagnitude > 1.0,
      };
    });

    expect(result.isNormalized).toBe(true);
    expect(result.isUnnormalized).toBe(true);
    expect(result.normalizedMagnitude).toBeCloseTo(1.0, 2);
  });

  test('should handle empty text gracefully', async ({ page }) => {
    await page.goto('/tests/integration-browser/__app__/provider/index.html');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        embedding: { model: 'Xenova/all-MiniLM-L6-v2', device: 'wasm', dtype: 'fp32' }
      });
      
      await provider.warmup('embedding');
      
      try {
        const embedding = await provider.embed('');
        await provider.dispose();
        return {
          success: true,
          dimension: embedding[0].length,
          hasValues: embedding[0].some(val => val !== 0),
        };
      } catch (error) {
        await provider.dispose();
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.dimension).toBe(384);
    expect(result.hasValues).toBe(true);
  });

  test('should handle very long text', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        embedding: { model: 'Xenova/all-MiniLM-L6-v2' }
      });
      
      await provider.warmup('embedding');
      
      // Create a long text (repeated sentence)
      const longText = 'This is a test sentence. '.repeat(100);
      
      const embedding = await provider.embed(longText);
      
      await provider.dispose();
      
      return {
        dimension: embedding[0].length,
        hasValues: embedding[0].some(val => val !== 0),
        magnitude: Math.sqrt(embedding[0].reduce((sum, val) => sum + val * val, 0)),
      };
    });

    expect(result.dimension).toBe(384);
    expect(result.hasValues).toBe(true);
    expect(result.magnitude).toBeGreaterThan(0);
  });

  test('should maintain consistency across calls', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).testReady === true);

    const result = await page.evaluate(async () => {
      const { createAIProvider } = (window as any);
      const provider = createAIProvider({
        embedding: { model: 'Xenova/all-MiniLM-L6-v2' }
      });
      
      await provider.warmup('embedding');
      
      const text = 'Consistency test text';
      
      const embedding1 = await provider.embed(text);
      const embedding2 = await provider.embed(text);
      const embedding3 = await provider.embed(text);
      
      await provider.dispose();
      
      // Check if embeddings are identical
      const identical12 = JSON.stringify(embedding1[0]) === JSON.stringify(embedding2[0]);
      const identical23 = JSON.stringify(embedding2[0]) === JSON.stringify(embedding3[0]);
      
      return {
        identical12,
        identical23,
        allIdentical: identical12 && identical23,
        dimension: embedding1[0].length,
      };
    });

    expect(result.dimension).toBe(384);
    // Embeddings should be deterministic for the same input
    expect(result.allIdentical).toBe(true);
  });
});
