import { ExternalEmbeddingBackendMock } from '../../src/app/backend/external/ExternalEmbeddingBackendMock';
import type { EmbeddingRequest, QueryRequest } from '../../src/app/backend/external/ExternalEmbeddingBackendMock';
import { loadTestFile } from '../fixtures/loadTestFile';

describe('ExternalEmbeddingBackendMock', () => {
  let mock: ExternalEmbeddingBackendMock;

  const mockConfig = {
    enabled: true,
    latencyMs: 10,
    errorRate: 0.0,
    baseEmbeddingSize: 5,
  };

  let mockRequest: EmbeddingRequest;

  beforeEach(async () => {
    mock = new ExternalEmbeddingBackendMock(mockConfig);
    mockRequest = {
      id: 'test-doc',
      data: await loadTestFile('text/test.txt'),
      modality: 'audio',
      metadata: { custom: 'data' },
    };
  });

  afterEach(() => {
    mock.clear();
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const defaultMock = new ExternalEmbeddingBackendMock({ enabled: true });
      expect(defaultMock).toBeDefined();
    });

    it('should be disabled when enabled is false', async () => {
      const disabledMock = new ExternalEmbeddingBackendMock({ enabled: false });

      await expect(
        disabledMock.processEmbedding(mockRequest)
      ).rejects.toThrow('Mock backend is disabled');
    });

    it('should use custom embedding size', async () => {
      const customMock = new ExternalEmbeddingBackendMock({
        enabled: true,
        baseEmbeddingSize: 10,
      });

      const response = await customMock.processEmbedding(mockRequest);
      expect(response.vector).toHaveLength(10);
    });
  });

  describe('Embedding Processing', () => {
    it('should process embedding request successfully', async () => {
      const response = await mock.processEmbedding(mockRequest);

      expect(response).toBeDefined();
      expect(response.id).toBe(mockRequest.id);
      expect(response.modality).toBe(mockRequest.modality);
      expect(response.vector).toHaveLength(5);
      expect(response.processingTimeMs).toBeGreaterThan(0);
      expect(response.metadata).toEqual(mockRequest.metadata);
    });

    it('should simulate latency', async () => {
      const mockWithLatency = new ExternalEmbeddingBackendMock({
        ...mockConfig,
        latencyMs: 50,
      });

      const startTime = Date.now();
      await mockWithLatency.processEmbedding(mockRequest);
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(45); // Allow some margin
    });

    it('should simulate errors', async () => {
      const errorMock = new ExternalEmbeddingBackendMock({
        enabled: true,
        errorRate: 1.0, // 100% error rate
      });

      await expect(
        errorMock.processEmbedding(mockRequest)
      ).rejects.toThrow('Mock backend error');
    });

    it('should generate deterministic embeddings', async () => {
      const response1 = await mock.processEmbedding(mockRequest);
      const response2 = await mock.processEmbedding(mockRequest);

      expect(response1.vector).toEqual(response2.vector);
    });

    it('should generate different embeddings for different IDs', async () => {
      const request2: EmbeddingRequest = {
        ...mockRequest,
        id: 'different-id',
      };

      const response1 = await mock.processEmbedding(mockRequest);
      const response2 = await mock.processEmbedding(request2);

      expect(response1.vector).not.toEqual(response2.vector);
    });

    it('should handle different modalities', async () => {
      const imageRequest: EmbeddingRequest = {
        ...mockRequest,
        modality: 'image',
      };

      const response = await mock.processEmbedding(imageRequest);
      expect(response.modality).toBe('image');
    });
  });

  describe('Query Processing', () => {
    beforeEach(async () => {
      // Add some test documents
      await mock.processEmbedding(mockRequest);
      await mock.processEmbedding({
        ...mockRequest,
        id: 'doc2',
        modality: 'image',
      });
      await mock.processEmbedding({
        ...mockRequest,
        id: 'doc3',
        modality: 'video',
      });
    });

    it('should query embeddings successfully', async () => {
      const queryRequest: QueryRequest = {
        query: 'test query',
        modality: 'audio',
        k: 2,
      };

      const response = await mock.queryEmbeddings(queryRequest);

      expect(response).toBeDefined();
      expect(response.results).toHaveLength(1); // Only audio modality matches
      expect(response.processingTimeMs).toBeGreaterThan(0);
    });

    it('should return all modalities when no filter specified', async () => {
      const queryRequest: QueryRequest = {
        query: 'test query',
        k: 10,
      };

      const response = await mock.queryEmbeddings(queryRequest);

      expect(response.results).toHaveLength(3); // All stored documents
    });

    it('should filter by modality', async () => {
      const queryRequest: QueryRequest = {
        query: 'test query',
        modality: 'image',
        k: 10,
      };

      const response = await mock.queryEmbeddings(queryRequest);

      expect(response.results).toHaveLength(1);
      expect(response.results[0].metadata.modality).toBe('image');
    });

    it('should filter by metadata', async () => {
      const queryRequest: QueryRequest = {
        query: 'test query',
        k: 10,
        filter: { custom: 'data' },
      };

      const response = await mock.queryEmbeddings(queryRequest);

      expect(response.results).toHaveLength(3); // All documents have this metadata
    });

    it('should limit results with k parameter', async () => {
      const queryRequest: QueryRequest = {
        query: 'test query',
        k: 2,
      };

      const response = await mock.queryEmbeddings(queryRequest);

      expect(response.results).toHaveLength(2);
    });

    it('should sort results by similarity score', async () => {
      const queryRequest: QueryRequest = {
        query: 'test query',
        k: 10,
      };

      const response = await mock.queryEmbeddings(queryRequest);

      for (let i = 1; i < response.results.length; i++) {
        expect(response.results[i - 1].score).toBeGreaterThanOrEqual(
          response.results[i].score
        );
      }
    });

    it('should handle vector queries', async () => {
      const queryVector = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
      const queryRequest: QueryRequest = {
        query: queryVector,
        k: 5,
      };

      const response = await mock.queryEmbeddings(queryRequest);

      expect(response.results).toHaveLength(3); // All stored documents
      expect(response.results[0].score).toBeGreaterThan(response.results[1].score); // Should be sorted by similarity
      expect(response.results[0].score).toBeGreaterThanOrEqual(-1); // Should be in valid cosine range
      expect(response.results[0].score).toBeLessThanOrEqual(1);
    });
  });

  describe('Statistics and Management', () => {
    it('should track request count', async () => {
      const stats1 = mock.getStats();
      expect(stats1.requestCount).toBe(0);

      await mock.processEmbedding(mockRequest);
      const stats2 = mock.getStats();
      expect(stats2.requestCount).toBe(1);

      await mock.queryEmbeddings({ query: 'test' });
      const stats3 = mock.getStats();
      expect(stats3.requestCount).toBe(2);
    });

    it('should track stored embeddings count', async () => {
      const stats1 = mock.getStats();
      expect(stats1.storedEmbeddings).toBe(0);

      await mock.processEmbedding(mockRequest);
      const stats2 = mock.getStats();
      expect(stats2.storedEmbeddings).toBe(1);

      await mock.processEmbedding({
        ...mockRequest,
        id: 'doc2',
      });
      const stats3 = mock.getStats();
      expect(stats3.storedEmbeddings).toBe(2);
    });

    it('should clear all data', async () => {
      await mock.processEmbedding(mockRequest);
      await mock.processEmbedding({
        ...mockRequest,
        id: 'doc2',
      });

      const stats1 = mock.getStats();
      expect(stats1.storedEmbeddings).toBe(2);
      expect(stats1.requestCount).toBe(2);

      mock.clear();

      const stats2 = mock.getStats();
      expect(stats2.storedEmbeddings).toBe(0);
      expect(stats2.requestCount).toBe(0);
    });

    it('should return configuration in stats', async () => {
      const stats = mock.getStats();
      expect(stats.config).toEqual(mockConfig);
    });
  });

  describe('Cosine Similarity', () => {
    it('should calculate cosine similarity correctly', async () => {
      // This is tested indirectly through the query functionality
      const vector1 = new Float32Array([1, 0, 0, 0, 0]);
      const vector2 = new Float32Array([0, 1, 0, 0, 0]);
      const vector3 = new Float32Array([1, 0, 0, 0, 0]); // Same as vector1

      const similarity12 = (mock as any).cosineSimilarity(vector1, vector2);
      const similarity13 = (mock as any).cosineSimilarity(vector1, vector3);

      expect(similarity12).toBeCloseTo(0, 5); // Orthogonal vectors
      expect(similarity13).toBeCloseTo(1, 5); // Identical vectors
    });

    it('should handle zero vectors', async () => {
      const vector1 = new Float32Array([0, 0, 0, 0, 0]);
      const vector2 = new Float32Array([1, 2, 3, 4, 5]);

      const similarity = (mock as any).cosineSimilarity(vector1, vector2);
      expect(similarity).toBe(0);
    });
  });

  describe('Hash Function', () => {
    it('should generate consistent hashes', async () => {
      const hash1 = (mock as any).hashString('test');
      const hash2 = (mock as any).hashString('test');
      const hash3 = (mock as any).hashString('different');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });

    it('should handle empty strings', async () => {
      const hash = (mock as any).hashString('');
      expect(typeof hash).toBe('number');
      expect(hash).toBeGreaterThanOrEqual(0);
    });
  });
});
