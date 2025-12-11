/**
 * RAGContextBuilder Tests
 * Tests for server/agents/core/RAGContextBuilder.js
 */

jest.mock('../../../knowledge/VectorStore', () => ({
  getAgentKnowledgeBases: jest.fn(),
  multiKnowledgeBaseSearch: jest.fn()
}));

jest.mock('../../../knowledge/EmbeddingService', () => ({
  getEmbedding: jest.fn()
}));

jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const ragContextBuilder = require('../../../agents/core/RAGContextBuilder');
const VectorStore = require('../../../knowledge/VectorStore');
const EmbeddingService = require('../../../knowledge/EmbeddingService');
const pool = require('../../../db');

describe('RAGContextBuilder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor defaults', () => {
    it('should have default limit', () => {
      expect(ragContextBuilder.defaultLimit).toBe(5);
    });

    it('should have default threshold', () => {
      expect(ragContextBuilder.defaultThreshold).toBe(0.6);
    });
  });

  describe('getContextForAgent', () => {
    it('should return no context if no knowledge bases', async () => {
      VectorStore.getAgentKnowledgeBases.mockResolvedValue([]);

      const result = await ragContextBuilder.getContextForAgent(1, 'test query');

      expect(result.hasContext).toBe(false);
      expect(result.chunks).toEqual([]);
      expect(result.message).toContain('No knowledge bases assigned');
    });

    it('should return no context if search returns empty', async () => {
      VectorStore.getAgentKnowledgeBases.mockResolvedValue([{ id: 1, priority: 1 }]);
      EmbeddingService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      VectorStore.multiKnowledgeBaseSearch.mockResolvedValue([]);

      const result = await ragContextBuilder.getContextForAgent(1, 'test query');

      expect(result.hasContext).toBe(false);
      expect(result.message).toContain('No relevant context found');
    });

    it('should return context with chunks', async () => {
      VectorStore.getAgentKnowledgeBases.mockResolvedValue([{ id: 1, priority: 1 }]);
      EmbeddingService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      VectorStore.multiKnowledgeBaseSearch.mockResolvedValue([
        {
          content: 'Test content',
          similarity: 0.85,
          document_name: 'test.pdf',
          document_type: 'pdf',
          knowledge_base_name: 'Test KB',
          chunk_index: 0,
          metadata: { page: 1 }
        }
      ]);

      const result = await ragContextBuilder.getContextForAgent(1, 'test query');

      expect(result.hasContext).toBe(true);
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].content).toBe('Test content');
      expect(result.chunks[0].similarity).toBe(0.85);
      expect(result.contextString).toContain('Test content');
    });

    it('should sort knowledge bases by priority', async () => {
      VectorStore.getAgentKnowledgeBases.mockResolvedValue([
        { id: 1, priority: 1 },
        { id: 2, priority: 10 },
        { id: 3, priority: 5 }
      ]);
      EmbeddingService.getEmbedding.mockResolvedValue([]);
      VectorStore.multiKnowledgeBaseSearch.mockResolvedValue([]);

      await ragContextBuilder.getContextForAgent(1, 'test');

      expect(VectorStore.multiKnowledgeBaseSearch).toHaveBeenCalledWith(
        [2, 3, 1], // Sorted by priority desc
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('should use custom options', async () => {
      VectorStore.getAgentKnowledgeBases.mockResolvedValue([{ id: 1 }]);
      EmbeddingService.getEmbedding.mockResolvedValue([]);
      VectorStore.multiKnowledgeBaseSearch.mockResolvedValue([]);

      await ragContextBuilder.getContextForAgent(1, 'test', {
        limit: 10,
        threshold: 0.8
      });

      expect(VectorStore.multiKnowledgeBaseSearch).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        { limit: 10, threshold: 0.8 }
      );
    });

    it('should exclude metadata when includeMetadata is false', async () => {
      VectorStore.getAgentKnowledgeBases.mockResolvedValue([{ id: 1 }]);
      EmbeddingService.getEmbedding.mockResolvedValue([]);
      VectorStore.multiKnowledgeBaseSearch.mockResolvedValue([
        {
          content: 'Test',
          similarity: 0.9,
          document_name: 'doc',
          document_type: 'txt',
          knowledge_base_name: 'KB',
          chunk_index: 0,
          metadata: { important: 'data' }
        }
      ]);

      const result = await ragContextBuilder.getContextForAgent(1, 'test', {
        includeMetadata: false
      });

      expect(result.chunks[0].metadata).toBeUndefined();
    });

    it('should handle errors', async () => {
      VectorStore.getAgentKnowledgeBases.mockRejectedValue(new Error('DB Error'));

      await expect(
        ragContextBuilder.getContextForAgent(1, 'test')
      ).rejects.toThrow('Failed to build context');
    });
  });

  describe('buildContextString', () => {
    it('should return empty string for empty chunks', () => {
      expect(ragContextBuilder.buildContextString([])).toBe('');
      expect(ragContextBuilder.buildContextString(null)).toBe('');
    });

    it('should format chunks with headers', () => {
      const chunks = [
        {
          content: 'First chunk content',
          similarity: 0.95,
          source: { documentName: 'doc1.pdf' }
        },
        {
          content: 'Second chunk content',
          similarity: 0.85,
          source: { documentName: 'doc2.txt' }
        }
      ];

      const result = ragContextBuilder.buildContextString(chunks);

      expect(result).toContain('[Source 1: doc1.pdf (95.0% match)]');
      expect(result).toContain('First chunk content');
      expect(result).toContain('[Source 2: doc2.txt (85.0% match)]');
      expect(result).toContain('---');
    });
  });

  describe('buildRAGSystemPrompt', () => {
    it('should return base prompt if no context', () => {
      const basePrompt = 'You are a helpful assistant.';
      const context = { hasContext: false };

      const result = ragContextBuilder.buildRAGSystemPrompt(basePrompt, context);

      expect(result).toBe(basePrompt);
    });

    it('should prepend RAG section when context exists', () => {
      const basePrompt = 'You are a helpful assistant.';
      const context = {
        hasContext: true,
        contextString: 'Relevant knowledge base info'
      };

      const result = ragContextBuilder.buildRAGSystemPrompt(basePrompt, context);

      expect(result).toContain('Relevant Knowledge Base Context');
      expect(result).toContain('Relevant knowledge base info');
      expect(result).toContain(basePrompt);
    });
  });

  describe('getAgentKnowledgeBaseIds', () => {
    it('should return knowledge base IDs', async () => {
      pool.query.mockResolvedValue({
        rows: [
          { knowledge_base_id: 1 },
          { knowledge_base_id: 2 }
        ]
      });

      const result = await ragContextBuilder.getAgentKnowledgeBaseIds(1);

      expect(result).toEqual([1, 2]);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('agent_knowledge_bases'),
        [1]
      );
    });
  });

  describe('agentHasKnowledgeBases', () => {
    it('should return true if agent has knowledge bases', async () => {
      pool.query.mockResolvedValue({ rows: [{ has_kb: true }] });

      const result = await ragContextBuilder.agentHasKnowledgeBases(1);

      expect(result).toBe(true);
    });

    it('should return false if agent has no knowledge bases', async () => {
      pool.query.mockResolvedValue({ rows: [{ has_kb: false }] });

      const result = await ragContextBuilder.agentHasKnowledgeBases(1);

      expect(result).toBe(false);
    });
  });

  describe('hasRelevantContext', () => {
    it('should return false if agent has no knowledge bases', async () => {
      pool.query.mockResolvedValue({ rows: [{ has_kb: false }] });

      const result = await ragContextBuilder.hasRelevantContext(1, 'test');

      expect(result).toBe(false);
    });

    it('should return true if relevant context found', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ has_kb: true }] })
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] });
      EmbeddingService.getEmbedding.mockResolvedValue([0.1]);
      VectorStore.multiKnowledgeBaseSearch.mockResolvedValue([{ content: 'result' }]);

      const result = await ragContextBuilder.hasRelevantContext(1, 'test');

      expect(result).toBe(true);
    });

    it('should return false if no relevant context', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ has_kb: true }] })
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] });
      EmbeddingService.getEmbedding.mockResolvedValue([0.1]);
      VectorStore.multiKnowledgeBaseSearch.mockResolvedValue([]);

      const result = await ragContextBuilder.hasRelevantContext(1, 'test');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      pool.query.mockRejectedValue(new Error('DB Error'));

      const result = await ragContextBuilder.hasRelevantContext(1, 'test');

      expect(result).toBe(false);
    });
  });
});
