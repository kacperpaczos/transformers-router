import { LocalVectorStoreIndexedDB } from '../../src/infra/vectorstore/LocalVectorStoreIndexedDB';
import type { VectorDocument, QueryOptions } from '../../src/infra/vectorstore/VectorStore';

describe.skip('LocalVectorStoreIndexedDB', () => {
  let store: LocalVectorStoreIndexedDB;

  // Mock IndexedDB
  const mockDB = {
    close: jest.fn(),
    transaction: jest.fn(() => ({
      objectStore: jest.fn(() => ({
        put: jest.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
        getAll: jest.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
        delete: jest.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
        count: jest.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
        clear: jest.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
      })),
    })),
  };

  const mockRequest = {
    onsuccess: null,
    onerror: null,
    result: mockDB,
  };

  beforeEach(() => {
    // Mock indexedDB
    global.indexedDB = {
      open: jest.fn(() => mockRequest),
      databases: jest.fn(() => Promise.resolve([])),
    } as any;
  });

  const mockVector1 = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
  const mockVector2 = new Float32Array([0.5, 0.4, 0.3, 0.2, 0.1]);
  const mockVector3 = new Float32Array([0.9, 0.8, 0.7, 0.6, 0.5]);

  const mockDocument1: VectorDocument = {
    id: 'doc1',
    vector: mockVector1,
    metadata: {
      id: 'doc1',
      modality: 'audio',
      mime: 'audio/mp3',
      sizeBytes: 1024,
      createdAt: Date.now(),
    },
  };

  const mockDocument2: VectorDocument = {
    id: 'doc2',
    vector: mockVector2,
    metadata: {
      id: 'doc2',
      modality: 'image',
      mime: 'image/jpeg',
      sizeBytes: 2048,
      createdAt: Date.now(),
    },
  };

  const mockDocument3: VectorDocument = {
    id: 'doc3',
    vector: mockVector3,
    metadata: {
      id: 'doc3',
      modality: 'video',
      mime: 'video/mp4',
      sizeBytes: 4096,
      createdAt: Date.now(),
    },
  };

  beforeEach(async () => {
    store = new LocalVectorStoreIndexedDB(5); // 5-dimensional vectors for testing
    await store.initialize();
  }, 10000);

  afterEach(async () => {
    await store.clear();
    await store.close();
  }, 10000);

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const count = await store.count();
      expect(count).toBe(0);
    });

    it('should handle multiple initializations', async () => {
      await store.initialize();
      await store.initialize();
      const count = await store.count();
      expect(count).toBe(0);
    });
  });

  describe('Upsert Operations', () => {
    it('should upsert single document', async () => {
      await store.upsert([mockDocument1]);
      const count = await store.count();
      expect(count).toBe(1);
    });

    it('should upsert multiple documents', async () => {
      await store.upsert([mockDocument1, mockDocument2, mockDocument3]);
      const count = await store.count();
      expect(count).toBe(3);
    });

    it('should update existing document', async () => {
      // Insert document
      await store.upsert([mockDocument1]);
      let count = await store.count();
      expect(count).toBe(1);

      // Update the same document with new vector
      const updatedDocument = {
        ...mockDocument1,
        vector: mockVector2,
      };

      await store.upsert([updatedDocument]);
      count = await store.count();
      expect(count).toBe(1); // Still 1 document, but updated
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      await store.upsert([mockDocument1, mockDocument2, mockDocument3]);
    });

    it('should query similar vectors', async () => {
      // Query with vector similar to mockDocument1
      const queryVector = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
      const results = await store.query(queryVector, { k: 3 });

      expect(results).toHaveLength(3);
      expect(results[0].id).toBe('doc1'); // Most similar should be doc1
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should limit results with k parameter', async () => {
      const queryVector = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
      const results = await store.query(queryVector, { k: 2 });

      expect(results).toHaveLength(2);
    });

    it('should filter results by modality', async () => {
      const queryVector = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
      const results = await store.query(queryVector, {
        k: 10,
        filter: { modality: 'audio' }
      });

      expect(results).toHaveLength(1);
      expect(results[0].metadata.modality).toBe('audio');
    });

    it('should filter results by mime type', async () => {
      const queryVector = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
      const results = await store.query(queryVector, {
        k: 10,
        filter: { mime: 'image/jpeg' }
      });

      expect(results).toHaveLength(1);
      expect(results[0].metadata.mime).toBe('image/jpeg');
    });

    it('should handle empty query results', async () => {
      const queryVector = new Float32Array([0.0, 0.0, 0.0, 0.0, 0.0]);
      const results = await store.query(queryVector, {
        k: 10,
        filter: { modality: 'nonexistent' as any }
      });

      expect(results).toHaveLength(0);
    });
  });

  describe('Delete Operations', () => {
    beforeEach(async () => {
      await store.upsert([mockDocument1, mockDocument2, mockDocument3]);
    });

    it('should delete single document', async () => {
      await store.delete(['doc1']);
      const count = await store.count();
      expect(count).toBe(2);

      // Verify the document is gone
      const results = await store.query(mockVector1, { k: 10 });
      expect(results.find(r => r.id === 'doc1')).toBeUndefined();
    });

    it('should delete multiple documents', async () => {
      await store.delete(['doc1', 'doc2']);
      const count = await store.count();
      expect(count).toBe(1);
    });

    it('should handle deleting non-existent documents', async () => {
      await store.delete(['nonexistent']);
      const count = await store.count();
      expect(count).toBe(3); // Should remain unchanged
    });
  });

  describe('Clear Operations', () => {
    beforeEach(async () => {
      await store.upsert([mockDocument1, mockDocument2, mockDocument3]);
    });

    it('should clear all documents', async () => {
      await store.clear();
      const count = await store.count();
      expect(count).toBe(0);

      const queryVector = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
      const results = await store.query(queryVector, { k: 10 });
      expect(results).toHaveLength(0);
    });
  });

  describe('Cosine Similarity', () => {
    beforeEach(async () => {
      await store.upsert([mockDocument1, mockDocument2]);
    });

    it('should calculate cosine similarity correctly', async () => {
      // Test identical vectors (should have similarity ~1)
      const identicalQuery = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
      const results = await store.query(identicalQuery, { k: 1 });
      expect(results[0].score).toBeCloseTo(1.0, 5);

      // Test opposite vectors (should have similarity ~-1)
      const oppositeQuery = new Float32Array([-0.1, -0.2, -0.3, -0.4, -0.5]);
      const oppositeResults = await store.query(oppositeQuery, { k: 1 });
      expect(oppositeResults[0].score).toBeCloseTo(-1.0, 5);
    });

    it('should handle zero vectors', async () => {
      const zeroVector = new Float32Array([0, 0, 0, 0, 0]);
      await store.upsert([{
        id: 'zero',
        vector: zeroVector,
        metadata: mockDocument1.metadata,
      }]);

      const results = await store.query(zeroVector, { k: 1 });
      expect(results[0].score).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle mismatched vector dimensions', async () => {
      const wrongDimensionVector = new Float32Array([0.1, 0.2, 0.3]); // 3D instead of 5D

      await expect(
        store.upsert([{
          id: 'wrong',
          vector: wrongDimensionVector,
          metadata: mockDocument1.metadata,
        }])
      ).rejects.toThrow('Vector dimensions do not match');
    });

    it('should handle database errors gracefully', async () => {
      // Close the database connection
      await store.close();

      // Operations should fail gracefully
      await expect(store.upsert([mockDocument1])).rejects.toThrow();
      await expect(store.count()).rejects.toThrow();
    });
  });
});