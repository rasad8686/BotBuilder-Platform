/**
 * VectorStore Tests
 * Tests for server/knowledge/VectorStore.js
 */

// Use fake timers to prevent setInterval from running
jest.useFakeTimers();

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

const db = require('../../db');
const vectorStore = require('../../knowledge/VectorStore');

describe('VectorStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('createKnowledgeBase', () => {
    it('should create a knowledge base with defaults', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test KB', chunk_size: 1000 }]
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

    it('should create with custom settings', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Custom KB', chunk_size: 500, chunk_overlap: 50 }]
      });

      const result = await vectorStore.createKnowledgeBase(1, {
        name: 'Custom KB',
        description: 'Test description',
        embedding_model: 'text-embedding-ada-002',
        chunk_size: 500,
        chunk_overlap: 50
      });

      expect(result.chunk_size).toBe(500);
    });
  });

  describe('storeChunk', () => {
    it('should store a chunk with embedding', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, document_id: 10, chunk_index: 0 }]
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

    it('should return false on error', async () => {
      db.query.mockRejectedValue(new Error('Query error'));

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
            { id: 1, content: 'Result 1', similarity: 0.9 },
            { id: 2, content: 'Result 2', similarity: 0.8 }
          ]
        });

      const results = await vectorStore.similaritySearch(1, [0.1, 0.2, 0.3], {
        limit: 10,
        threshold: 0.7
      });

      expect(results).toHaveLength(2);
      expect(results[0].similarity).toBe(0.9);
    });

    it('should fallback to JS when pgvector fails', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ available: false }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, content: 'Result', embedding: '[0.1,0.2,0.3]' }
          ]
        });

      const results = await vectorStore.similaritySearch(1, [0.1, 0.2, 0.3]);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('similaritySearchJS', () => {
    it('should calculate similarity and filter results', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, content: 'Result 1', embedding: '[1,0,0]' },
          { id: 2, content: 'Result 2', embedding: '[0.1,0.9,0]' }
        ]
      });

      const results = await vectorStore.similaritySearchJS(1, [1, 0, 0], {
        limit: 10,
        threshold: 0.5
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].similarity).toBeGreaterThanOrEqual(0.5);
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
        threshold: 0.5
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('parseEmbedding', () => {
    it('should return array as-is', () => {
      const result = vectorStore.parseEmbedding([0.1, 0.2]);
      expect(result).toEqual([0.1, 0.2]);
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
            { id: 1, knowledge_base_id: 1, content: 'Result', similarity: 0.9 }
          ]
        });

      const results = await vectorStore.multiKnowledgeBaseSearch(
        [1, 2],
        [0.1, 0.2, 0.3],
        { limit: 10, threshold: 0.7 }
      );

      expect(Array.isArray(results)).toBe(true);
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
    });
  });

  describe('getKnowledgeBasesByTenant', () => {
    it('should return knowledge bases for tenant', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, name: 'KB1' },
          { id: 2, name: 'KB2' }
        ]
      });

      const results = await vectorStore.getKnowledgeBasesByTenant(1);

      expect(results).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
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
  });
});
