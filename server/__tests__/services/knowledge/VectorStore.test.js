/**
 * VectorStore Comprehensive Tests
 * Tests for server/knowledge/VectorStore.js
 *
 * Tests cover:
 * - All public methods
 * - Error handling
 * - Edge cases
 * - Different input types
 * - Cache behavior
 * - pgvector and JS fallback modes
 */

// Use fake timers to prevent setInterval from running
jest.useFakeTimers();

jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

const db = require('../../../db');
const log = require('../../../utils/logger');
const vectorStore = require('../../../knowledge/VectorStore');

describe('VectorStore - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('createKnowledgeBase', () => {
    it('should create a knowledge base with minimal data', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test KB', tenant_id: 1 }]
      });

      const result = await vectorStore.createKnowledgeBase(1, {
        name: 'Test KB'
      });

      expect(result.name).toBe('Test KB');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO knowledge_bases'),
        expect.arrayContaining([1, 'Test KB'])
      );
    });

    it('should create with all optional parameters', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          name: 'Custom KB',
          description: 'Test description',
          embedding_model: 'text-embedding-ada-002',
          chunk_size: 500,
          chunk_overlap: 50
        }]
      });

      const result = await vectorStore.createKnowledgeBase(1, {
        name: 'Custom KB',
        description: 'Test description',
        embedding_model: 'text-embedding-ada-002',
        chunk_size: 500,
        chunk_overlap: 50
      });

      expect(result.description).toBe('Test description');
      expect(result.chunk_size).toBe(500);
      expect(result.chunk_overlap).toBe(50);
    });

    it('should use default values when not provided', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'KB', chunk_size: 1000, chunk_overlap: 200 }]
      });

      await vectorStore.createKnowledgeBase(1, { name: 'KB' });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          1,
          'KB',
          null,
          'text-embedding-3-small',
          1000,
          200
        ])
      );
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(vectorStore.createKnowledgeBase(1, { name: 'KB' }))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle null description', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'KB', description: null }]
      });

      const result = await vectorStore.createKnowledgeBase(1, {
        name: 'KB',
        description: undefined
      });

      expect(result.description).toBeNull();
    });
  });

  describe('storeChunk', () => {
    it('should store a chunk with all fields', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          document_id: 10,
          knowledge_base_id: 1,
          chunk_index: 0,
          created_at: new Date()
        }]
      });

      const result = await vectorStore.storeChunk(10, 1, {
        content: 'Test content',
        embedding: [0.1, 0.2, 0.3],
        chunk_index: 0,
        start_char: 0,
        end_char: 12,
        metadata: { source: 'test' }
      });

      expect(result.id).toBe(1);
      expect(result.document_id).toBe(10);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chunks'),
        expect.arrayContaining([10, 1, 'Test content'])
      );
    });

    it('should handle null embedding', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, document_id: 10, chunk_index: 0 }]
      });

      await vectorStore.storeChunk(10, 1, {
        content: 'Test content',
        embedding: null,
        chunk_index: 0
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([10, 1, 'Test content', null])
      );
    });

    it('should handle undefined embedding', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, document_id: 10, chunk_index: 0 }]
      });

      await vectorStore.storeChunk(10, 1, {
        content: 'Test content',
        chunk_index: 0
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([10, 1, 'Test content', null])
      );
    });

    it('should convert embedding array to string format', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, document_id: 10, chunk_index: 0 }]
      });

      await vectorStore.storeChunk(10, 1, {
        content: 'Test',
        embedding: [0.1, 0.2, 0.3],
        chunk_index: 0
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([10, 1, 'Test', '[0.1,0.2,0.3]'])
      );
    });

    it('should stringify metadata object', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, document_id: 10, chunk_index: 0 }]
      });

      const metadata = { source: 'test', page: 1 };
      await vectorStore.storeChunk(10, 1, {
        content: 'Test',
        embedding: [0.1],
        chunk_index: 0,
        metadata
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([10, 1, 'Test', '[0.1]', 0, null, null, JSON.stringify(metadata)])
      );
    });

    it('should handle empty metadata', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, document_id: 10, chunk_index: 0 }]
      });

      await vectorStore.storeChunk(10, 1, {
        content: 'Test',
        chunk_index: 0,
        metadata: undefined
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([10, 1, 'Test', null, 0, null, null, '{}'])
      );
    });

    it('should handle large embeddings', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, document_id: 10, chunk_index: 0 }]
      });

      const largeEmbedding = Array(1536).fill(0).map(() => Math.random());
      await vectorStore.storeChunk(10, 1, {
        content: 'Test',
        embedding: largeEmbedding,
        chunk_index: 0
      });

      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('isPgvectorAvailable', () => {
    it('should return true if pgvector is installed', async () => {
      db.query.mockResolvedValue({
        rows: [{ available: true }]
      });

      const result = await vectorStore.isPgvectorAvailable();
      expect(result).toBe(true);
    });

    it('should return false if pgvector is not installed', async () => {
      db.query.mockResolvedValue({
        rows: [{ available: false }]
      });

      const result = await vectorStore.isPgvectorAvailable();
      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      db.query.mockRejectedValue(new Error('Query error'));

      const result = await vectorStore.isPgvectorAvailable();
      expect(result).toBe(false);
    });

    it('should return false if rows are empty', async () => {
      db.query.mockResolvedValue({
        rows: []
      });

      const result = await vectorStore.isPgvectorAvailable();
      expect(result).toBe(false);
    });

    it('should return false if available field is missing', async () => {
      db.query.mockResolvedValue({
        rows: [{}]
      });

      const result = await vectorStore.isPgvectorAvailable();
      expect(result).toBe(false);
    });
  });

  describe('similaritySearch', () => {
    it('should use pgvector when available', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ available: true }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, content: 'Result 1', similarity: 0.9, document_name: 'Doc1' },
            { id: 2, content: 'Result 2', similarity: 0.8, document_name: 'Doc2' }
          ]
        });

      const results = await vectorStore.similaritySearch(1, [0.1, 0.2, 0.3], {
        limit: 10,
        threshold: 0.7
      });

      expect(results).toHaveLength(2);
      expect(results[0].similarity).toBe(0.9);
      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining('pgvector search returned 2 results')
      );
    });

    it('should use default options', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ available: true }] })
        .mockResolvedValueOnce({ rows: [] });

      await vectorStore.similaritySearch(1, [0.1, 0.2]);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, '[0.1,0.2]', 0.3, 20])
      );
    });

    it('should fallback to JS when pgvector fails', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ available: true }] })
        .mockRejectedValueOnce(new Error('pgvector error'))
        .mockResolvedValueOnce({
          rows: [
            { id: 1, content: 'Result', embedding: '[0.1,0.2,0.3]', document_name: 'Doc' }
          ]
        });

      const results = await vectorStore.similaritySearch(1, [0.1, 0.2, 0.3]);

      expect(Array.isArray(results)).toBe(true);
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('pgvector search failed, falling back to JS')
      );
    });

    it('should calculate correct max distance from threshold', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ available: true }] })
        .mockResolvedValueOnce({ rows: [] });

      await vectorStore.similaritySearch(1, [0.1], { threshold: 0.8 });

      // maxDistance = 1 - 0.8 = 0.2
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, '[0.1]', 0.2, 20])
      );
    });

    it('should handle empty results', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ available: true }] })
        .mockResolvedValueOnce({ rows: [] });

      const results = await vectorStore.similaritySearch(1, [0.1]);

      expect(results).toEqual([]);
    });

    it('should use JS search when pgvector not available', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ available: false }] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, content: 'Result', embedding: '[1,0,0]', document_name: 'Doc' }]
        });

      const results = await vectorStore.similaritySearch(1, [1, 0, 0]);

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('similaritySearchJS', () => {
    it('should calculate similarity and filter results', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, content: 'Result 1', embedding: '[1,0,0]', document_name: 'Doc1' },
          { id: 2, content: 'Result 2', embedding: '[0.1,0.9,0]', document_name: 'Doc2' }
        ]
      });

      const results = await vectorStore.similaritySearchJS(1, [1, 0, 0], {
        limit: 10,
        threshold: 0.5
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].similarity).toBeGreaterThanOrEqual(0.5);
      expect(results[0].embedding).toBeUndefined();
    });

    it('should apply threshold filter', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, content: 'High match', embedding: '[1,0,0]' },
          { id: 2, content: 'Low match', embedding: '[0,1,0]' }
        ]
      });

      const results = await vectorStore.similaritySearchJS(1, [1, 0, 0], {
        threshold: 0.8
      });

      expect(results.every(r => r.similarity >= 0.8)).toBe(true);
    });

    it('should apply limit', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, content: 'Result 1', embedding: '[1,0,0]' },
          { id: 2, content: 'Result 2', embedding: '[0.9,0.1,0]' },
          { id: 3, content: 'Result 3', embedding: '[0.8,0.2,0]' }
        ]
      });

      const results = await vectorStore.similaritySearchJS(1, [1, 0, 0], {
        limit: 2,
        threshold: 0
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should sort by similarity descending', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, content: 'Result 1', embedding: '[0.5,0.5,0]' },
          { id: 2, content: 'Result 2', embedding: '[1,0,0]' },
          { id: 3, content: 'Result 3', embedding: '[0.8,0.2,0]' }
        ]
      });

      const results = await vectorStore.similaritySearchJS(1, [1, 0, 0], {
        threshold: 0
      });

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
      }
    });

    it('should handle empty results from database', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const results = await vectorStore.similaritySearchJS(1, [1, 0, 0]);

      expect(results).toEqual([]);
    });

    it('should use default options', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, content: 'Result', embedding: '[1,0,0]' }]
      });

      const results = await vectorStore.similaritySearchJS(1, [1, 0, 0]);

      expect(Array.isArray(results)).toBe(true);
    });

    it('should remove embedding from results', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, content: 'Result', embedding: '[1,0,0]' }]
      });

      const results = await vectorStore.similaritySearchJS(1, [1, 0, 0], {
        threshold: 0
      });

      expect(results[0].embedding).toBeUndefined();
    });
  });

  describe('parseEmbedding', () => {
    it('should return array as-is', () => {
      const result = vectorStore.parseEmbedding([0.1, 0.2, 0.3]);
      expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    it('should parse JSON array string', () => {
      const result = vectorStore.parseEmbedding('[0.1,0.2,0.3]');
      expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    it('should parse PostgreSQL array format', () => {
      const result = vectorStore.parseEmbedding('{0.1,0.2,0.3}');
      expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    it('should return empty array for invalid input', () => {
      const result = vectorStore.parseEmbedding('invalid');
      expect(result).toEqual([]);
    });

    it('should return empty array for null', () => {
      const result = vectorStore.parseEmbedding(null);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined', () => {
      const result = vectorStore.parseEmbedding(undefined);
      expect(result).toEqual([]);
    });

    it('should parse array with negative numbers', () => {
      const result = vectorStore.parseEmbedding('[-0.1,0.2,-0.3]');
      expect(result).toEqual([-0.1, 0.2, -0.3]);
    });

    it('should parse array with scientific notation', () => {
      const result = vectorStore.parseEmbedding('[1e-5,2e-3,3e-2]');
      expect(result).toEqual([1e-5, 2e-3, 3e-2]);
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const vecA = [1, 0, 0];
      const vecB = [1, 0, 0];
      const result = vectorStore.cosineSimilarity(vecA, vecB);
      expect(result).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vecA = [1, 0, 0];
      const vecB = [0, 1, 0];
      const result = vectorStore.cosineSimilarity(vecA, vecB);
      expect(result).toBeCloseTo(0, 5);
    });

    it('should handle similar vectors', () => {
      const vecA = [1, 1, 0];
      const vecB = [1, 0, 0];
      const result = vectorStore.cosineSimilarity(vecA, vecB);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
    });

    it('should calculate similarity for real embeddings', () => {
      const vecA = [0.5, 0.5, 0.5];
      const vecB = [0.6, 0.4, 0.5];
      const result = vectorStore.cosineSimilarity(vecA, vecB);
      expect(result).toBeGreaterThan(0.9);
      expect(result).toBeLessThan(1);
    });

    it('should handle negative values', () => {
      const vecA = [-1, 0, 0];
      const vecB = [1, 0, 0];
      const result = vectorStore.cosineSimilarity(vecA, vecB);
      expect(result).toBeCloseTo(-1, 5);
    });

    it('should handle zero magnitude', () => {
      const vecA = [0, 0, 0];
      const vecB = [1, 2, 3];
      const result = vectorStore.cosineSimilarity(vecA, vecB);
      expect(result).toBe(0);
    });
  });

  describe('multiKnowledgeBaseSearch', () => {
    it('should return empty array for no KB IDs', async () => {
      const results = await vectorStore.multiKnowledgeBaseSearch([], [0.1]);
      expect(results).toEqual([]);
    });

    it('should return empty array for null KB IDs', async () => {
      const results = await vectorStore.multiKnowledgeBaseSearch(null, [0.1]);
      expect(results).toEqual([]);
    });

    it('should search across multiple knowledge bases', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ available: true }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              knowledge_base_id: 1,
              content: 'Result 1',
              similarity: 0.9,
              knowledge_base_name: 'KB1'
            },
            {
              id: 2,
              knowledge_base_id: 2,
              content: 'Result 2',
              similarity: 0.85,
              knowledge_base_name: 'KB2'
            }
          ]
        });

      const results = await vectorStore.multiKnowledgeBaseSearch(
        [1, 2],
        [0.1, 0.2, 0.3],
        { limit: 10, threshold: 0.7 }
      );

      expect(results).toHaveLength(2);
      expect(results[0].knowledge_base_id).toBeDefined();
    });

    it('should use cache for repeated searches', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ available: true }] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, content: 'Result', similarity: 0.9 }]
        });

      const embedding = [0.1, 0.2, 0.3];
      const kbIds = [1, 2];

      // First call
      await vectorStore.multiKnowledgeBaseSearch(kbIds, embedding);

      // Second call should use cache
      await vectorStore.multiKnowledgeBaseSearch(kbIds, embedding);

      // Should only call DB once (for availability check and search)
      expect(db.query).toHaveBeenCalledTimes(2);
      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cache hit')
      );
    });

    it('should fallback to JS search when pgvector fails', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ available: true }] })
        .mockRejectedValueOnce(new Error('pgvector error'))
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              content: 'Result',
              embedding: '[1,0,0]',
              knowledge_base_name: 'KB1'
            }
          ]
        });

      const results = await vectorStore.multiKnowledgeBaseSearch([1], [1, 0, 0]);

      expect(Array.isArray(results)).toBe(true);
      expect(log.warn).toHaveBeenCalled();
    });

    it('should handle custom options', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ available: true }] })
        .mockResolvedValueOnce({ rows: [] });

      await vectorStore.multiKnowledgeBaseSearch([1, 2], [0.1], {
        limit: 5,
        threshold: 0.9
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([[1, 2], '[0.1]', 0.1, 5])
      );
    });

    it('should cache results for JS fallback too', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ available: false }] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, content: 'Result', embedding: '[1,0]' }]
        });

      const embedding = [1, 0];
      const kbIds = [1];

      await vectorStore.multiKnowledgeBaseSearch(kbIds, embedding);
      await vectorStore.multiKnowledgeBaseSearch(kbIds, embedding);

      // Should use cache on second call
      expect(db.query).toHaveBeenCalledTimes(3); // availability + search + cache hit
    });
  });

  describe('multiKnowledgeBaseSearchJS', () => {
    it('should return empty array when no chunks found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const results = await vectorStore.multiKnowledgeBaseSearchJS(
        [1, 2],
        [0.1, 0.2],
        { limit: 10, threshold: 0.7 }
      );

      expect(results).toEqual([]);
    });

    it('should filter by threshold', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, content: 'High match', embedding: '[1,0,0]' },
          { id: 2, content: 'Low match', embedding: '[0,1,0]' }
        ]
      });

      const results = await vectorStore.multiKnowledgeBaseSearchJS(
        [1],
        [1, 0, 0],
        { threshold: 0.8 }
      );

      expect(results.length).toBe(1);
      expect(results[0].content).toBe('High match');
    });

    it('should handle parsing errors gracefully', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, content: 'Valid', embedding: '[1,0,0]' },
          { id: 2, content: 'Invalid', embedding: 'invalid' }
        ]
      });

      const results = await vectorStore.multiKnowledgeBaseSearchJS([1], [1, 0, 0], {
        threshold: 0
      });

      expect(results.length).toBe(2);
      expect(results.find(r => r.id === 2).similarity).toBe(0);
      expect(log.error).toHaveBeenCalled();
    });

    it('should sort and limit results', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, embedding: '[0.5,0.5,0]' },
          { id: 2, embedding: '[1,0,0]' },
          { id: 3, embedding: '[0.9,0.1,0]' },
          { id: 4, embedding: '[0.8,0.2,0]' }
        ]
      });

      const results = await vectorStore.multiKnowledgeBaseSearchJS([1], [1, 0, 0], {
        limit: 2,
        threshold: 0
      });

      expect(results).toHaveLength(2);
      expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
    });
  });

  describe('getKnowledgeBasesByTenant', () => {
    it('should return knowledge bases for tenant', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, name: 'KB1', tenant_id: 1 },
          { id: 2, name: 'KB2', tenant_id: 1 }
        ]
      });

      const results = await vectorStore.getKnowledgeBasesByTenant(1);

      expect(results).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        [1]
      );
    });

    it('should return empty array for tenant with no KBs', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const results = await vectorStore.getKnowledgeBasesByTenant(999);

      expect(results).toEqual([]);
    });

    it('should order by created_at DESC', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 2, created_at: '2024-01-02' },
          { id: 1, created_at: '2024-01-01' }
        ]
      });

      await vectorStore.getKnowledgeBasesByTenant(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        [1]
      );
    });
  });

  describe('getKnowledgeBaseById', () => {
    it('should return knowledge base by ID', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test KB' }]
      });

      const result = await vectorStore.getKnowledgeBaseById(1);

      expect(result.name).toBe('Test KB');
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await vectorStore.getKnowledgeBaseById(999);

      expect(result).toBeNull();
    });
  });

  describe('deleteKnowledgeBase', () => {
    it('should delete knowledge base', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Deleted KB' }]
      });

      const result = await vectorStore.deleteKnowledgeBase(1);

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM knowledge_bases'),
        [1]
      );
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await vectorStore.deleteKnowledgeBase(999);

      expect(result).toBeNull();
    });
  });

  describe('updateStats', () => {
    it('should update knowledge base statistics', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, document_count: 10, total_chunks: 100 }]
      });

      const result = await vectorStore.updateStats(1);

      expect(result.document_count).toBe(10);
      expect(result.total_chunks).toBe(100);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE knowledge_bases'),
        [1]
      );
    });
  });

  describe('getChunksByDocument', () => {
    it('should return chunks for document', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, chunk_index: 0, content: 'Chunk 1' },
          { id: 2, chunk_index: 1, content: 'Chunk 2' }
        ]
      });

      const results = await vectorStore.getChunksByDocument(10);

      expect(results).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('document_id = $1'),
        [10]
      );
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY chunk_index'),
        [10]
      );
    });

    it('should return empty array for document with no chunks', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const results = await vectorStore.getChunksByDocument(999);

      expect(results).toEqual([]);
    });
  });

  describe('deleteChunksByDocument', () => {
    it('should delete chunks by document', async () => {
      db.query.mockResolvedValue({ rowCount: 5 });

      const result = await vectorStore.deleteChunksByDocument(10);

      expect(result).toBe(5);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM chunks'),
        [10]
      );
    });

    it('should return 0 if no chunks deleted', async () => {
      db.query.mockResolvedValue({ rowCount: 0 });

      const result = await vectorStore.deleteChunksByDocument(999);

      expect(result).toBe(0);
    });
  });

  describe('assignToAgent', () => {
    it('should assign knowledge base to agent', async () => {
      db.query.mockResolvedValue({
        rows: [{ agent_id: 1, knowledge_base_id: 10, priority: 1 }]
      });

      const result = await vectorStore.assignToAgent(1, 10, 1);

      expect(result.priority).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agent_knowledge_bases'),
        [1, 10, 1]
      );
    });

    it('should use default priority', async () => {
      db.query.mockResolvedValue({
        rows: [{ agent_id: 1, knowledge_base_id: 10, priority: 0 }]
      });

      const result = await vectorStore.assignToAgent(1, 10);

      expect(result.priority).toBe(0);
    });

    it('should update priority on conflict', async () => {
      db.query.mockResolvedValue({
        rows: [{ agent_id: 1, knowledge_base_id: 10, priority: 5 }]
      });

      await vectorStore.assignToAgent(1, 10, 5);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        [1, 10, 5]
      );
    });
  });

  describe('removeFromAgent', () => {
    it('should remove knowledge base from agent', async () => {
      db.query.mockResolvedValue({
        rows: [{ agent_id: 1, knowledge_base_id: 10 }]
      });

      const result = await vectorStore.removeFromAgent(1, 10);

      expect(result).toBeDefined();
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM agent_knowledge_bases'),
        [1, 10]
      );
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await vectorStore.removeFromAgent(1, 999);

      expect(result).toBeNull();
    });
  });

  describe('getAgentKnowledgeBases', () => {
    it('should return knowledge bases for agent', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, name: 'KB1', priority: 2 },
          { id: 2, name: 'KB2', priority: 1 }
        ]
      });

      const results = await vectorStore.getAgentKnowledgeBases(1);

      expect(results).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('akb.agent_id = $1'),
        [1]
      );
    });

    it('should order by priority DESC then name', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await vectorStore.getAgentKnowledgeBases(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY akb.priority DESC, kb.name'),
        [1]
      );
    });
  });

  describe('getAgentsByKnowledgeBase', () => {
    it('should return agents for knowledge base', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, name: 'Agent 1', priority: 1 },
          { id: 2, name: 'Agent 2', priority: 0 }
        ]
      });

      const results = await vectorStore.getAgentsByKnowledgeBase(10);

      expect(results).toHaveLength(2);
    });
  });

  describe('removeAllAgentsFromKnowledgeBase', () => {
    it('should remove all agent assignments', async () => {
      db.query.mockResolvedValue({ rowCount: 3 });

      const result = await vectorStore.removeAllAgentsFromKnowledgeBase(10);

      expect(result).toBe(3);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM agent_knowledge_bases'),
        [10]
      );
    });

    it('should return 0 if no assignments exist', async () => {
      db.query.mockResolvedValue({ rowCount: 0 });

      const result = await vectorStore.removeAllAgentsFromKnowledgeBase(999);

      expect(result).toBe(0);
    });
  });
});
