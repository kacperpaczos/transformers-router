/**
 * Local Vector Store implementation using IndexedDB
 */

import type {
  VectorStore,
  VectorDocument,
  VectorQueryResult,
  QueryOptions,
} from './VectorStore';
import type { VectorDocMeta } from '../../core/types';

interface StoredDocument {
  id: string;
  vector: number[]; // Float32Array serialized to number[]
  metadata: VectorDocMeta;
  createdAt: number;
}

export class LocalVectorStoreIndexedDB implements VectorStore {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'TransformersRouterVectors';
  private readonly storeName = 'vectors';
  private readonly vectorDimension: number;

  constructor(vectorDimension = 512) {
    this.vectorDimension = vectorDimension;
  }

  /**
   * Initialize IndexedDB connection
   */
  async initialize(): Promise<void> {
    if (this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () =>
        reject(new Error(`IndexedDB error: ${request.error}`));

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('modality', 'metadata.modality', { unique: false });
          store.createIndex('createdAt', 'metadata.createdAt', {
            unique: false,
          });
          store.createIndex('mime', 'metadata.mime', { unique: false });
        }
      };
    });
  }

  /**
   * Store vectors in IndexedDB
   */
  async upsert(documents: VectorDocument[]): Promise<void> {
    await this.ensureInitialized();

    const transaction = this.db!.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);

    const promises = documents.map(doc => {
      return new Promise<void>((resolve, reject) => {
        const storedDoc: StoredDocument = {
          id: doc.id,
          vector: Array.from(doc.vector),
          metadata: doc.metadata,
          createdAt: Date.now(),
        };

        const request = store.put(storedDoc);
        request.onsuccess = () => resolve();
        request.onerror = () =>
          reject(new Error(`Failed to store document ${doc.id}`));
      });
    });

    await Promise.all(promises);
  }

  /**
   * Query vectors using cosine similarity
   */
  async query(
    queryVector: Float32Array,
    options: QueryOptions = {}
  ): Promise<VectorQueryResult[]> {
    await this.ensureInitialized();

    const { k = 10, filter } = options;
    const allResults = await this.getAllDocuments(filter);

    // Calculate similarities
    const resultsWithScores: VectorQueryResult[] = allResults.map(doc => {
      const score = this.cosineSimilarity(
        queryVector,
        new Float32Array(doc.vector)
      );
      return {
        id: doc.id,
        score,
        metadata: doc.metadata,
      };
    });

    // Sort by score (descending) and take top k
    resultsWithScores.sort((a, b) => b.score - a.score);
    return resultsWithScores.slice(0, k);
  }

  /**
   * Delete vectors by IDs
   */
  async delete(ids: string[]): Promise<void> {
    await this.ensureInitialized();

    const transaction = this.db!.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);

    const promises = ids.map(id => {
      return new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () =>
          reject(new Error(`Failed to delete document ${id}`));
      });
    });

    await Promise.all(promises);
  }

  /**
   * Get total count of stored documents
   */
  async count(): Promise<number> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to count documents'));
    });
  }

  /**
   * Clear all documents
   */
  async clear(): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear store'));
    });
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }
  }

  private async getAllDocuments(
    filter?: Partial<VectorDocMeta>
  ): Promise<StoredDocument[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        let results = request.result as StoredDocument[];

        // Apply filters if provided
        if (filter) {
          results = results.filter(doc => {
            const metadata = doc.metadata;
            return Object.entries(filter).every(([key, value]) => {
              return metadata[key as keyof VectorDocMeta] === value;
            });
          });
        }

        resolve(results);
      };

      request.onerror = () => reject(new Error('Failed to retrieve documents'));
    });
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions do not match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
