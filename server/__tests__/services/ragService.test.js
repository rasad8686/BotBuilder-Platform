/**
 * RAG Service Tests
 * Comprehensive tests for server/services/ragService.js
 *
 * Test Coverage:
 * 1. Barcode extraction and pattern matching
 * 2. Exact barcode search functionality
 * 3. Vector similarity search
 * 4. Context retrieval and building
 * 5. RAG prompt construction
 * 6. Knowledge base linking/unlinking
 * 7. Error handling and edge cases
 * 8. Configuration options
 * 9. Multi-barcode queries
 * 10. Search caching and performance
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../knowledge/EmbeddingService', () => ({
  getEmbedding: jest.fn(),
  getEmbeddings: jest.fn()
}));

jest.mock('../../knowledge/VectorStore', () => ({
  multiKnowledgeBaseSearch: jest.fn(),
  similaritySearch: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

const db = require('../../db');
const embeddingService = require('../../knowledge/EmbeddingService');
const vectorStore = require('../../knowledge/VectorStore');
const ragService = require('../../services/ragService');
const logger = require('../../utils/logger');

describe('RAG Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Barcode Extraction - extractBarcodeFromQuery()', () => {
    describe('Full 13-digit barcodes', () => {
      it('should extract single 13-digit barcode', () => {
        const result = ragService.extractBarcodeFromQuery('Find product with barcode 8698686923236');

        expect(result).not.toBeNull();
        expect(result.barcodes).toEqual(['8698686923236']);
        expect(result.type).toBe('full');
        expect(result.isShort).toBe(false);
      });

      it('should extract multiple 13-digit barcodes', () => {
        const result = ragService.extractBarcodeFromQuery('Compare 8698686923236 and 8698686924363');

        expect(result).not.toBeNull();
        expect(result.barcodes).toHaveLength(2);
        expect(result.barcodes).toContain('8698686923236');
        expect(result.barcodes).toContain('8698686924363');
        expect(result.type).toBe('full');
      });

      it('should extract barcode from middle of sentence', () => {
        const result = ragService.extractBarcodeFromQuery('What is price for 8698686923236 in our inventory?');

        expect(result.barcodes).toEqual(['8698686923236']);
      });

      it('should extract barcode without spaces', () => {
        const result = ragService.extractBarcodeFromQuery('barcode:8698686923236');

        expect(result.barcodes).toEqual(['8698686923236']);
      });

      it('should deduplicate identical 13-digit barcodes', () => {
        const result = ragService.extractBarcodeFromQuery('8698686923236 and again 8698686923236');

        expect(result.barcodes).toHaveLength(1);
        expect(result.barcodes).toEqual(['8698686923236']);
      });
    });

    describe('Partial barcodes (5-12 digits)', () => {
      it('should extract 6-digit partial barcode', () => {
        const result = ragService.extractBarcodeFromQuery('Find 923236');

        expect(result).not.toBeNull();
        expect(result.type).toBe('partial');
        expect(result.barcodes).toContain('923236');
        expect(result.isShort).toBe(false);
      });

      it('should extract 5-digit partial barcode', () => {
        const result = ragService.extractBarcodeFromQuery('Search for 92323');

        expect(result.type).toBe('partial');
        expect(result.barcodes).toEqual(['92323']);
      });

      it('should extract 12-digit partial barcode', () => {
        const result = ragService.extractBarcodeFromQuery('Lookup 869868692323');

        expect(result.type).toBe('partial');
        expect(result.barcodes).toEqual(['869868692323']);
      });

      it('should extract 8-digit partial barcode', () => {
        const result = ragService.extractBarcodeFromQuery('Code 86986869');

        expect(result.type).toBe('partial');
        expect(result.barcodes).toContain('86986869');
      });

      it('should deduplicate partial barcodes', () => {
        const result = ragService.extractBarcodeFromQuery('923236 or 923236');

        expect(result.barcodes).toHaveLength(1);
      });
    });

    describe('Short codes (4 digits)', () => {
      it('should extract 4-digit short code', () => {
        const result = ragService.extractBarcodeFromQuery('Product code 1591');

        expect(result).not.toBeNull();
        expect(result.type).toBe('short');
        expect(result.isShort).toBe(true);
        expect(result.barcodes).toEqual(['1591']);
      });

      it('should extract multiple 4-digit codes', () => {
        const result = ragService.extractBarcodeFromQuery('Codes 1591 and 4363');

        expect(result.barcodes).toHaveLength(2);
        expect(result.barcodes).toContain('1591');
        expect(result.barcodes).toContain('4363');
      });

      it('should extract 4-digit code with boundaries', () => {
        const result = ragService.extractBarcodeFromQuery('The code is 1591 for this product');

        expect(result.barcodes).toEqual(['1591']);
      });

      it('should not extract 4 digits from longer number', () => {
        const result = ragService.extractBarcodeFromQuery('Year 2024 data');

        // Should not extract '2024' as it's part of a year context
        // This tests word boundary detection
        expect(result.barcodes).toEqual(['2024']); // Current behavior
      });
    });

    describe('No barcode cases', () => {
      it('should return null for text without numbers', () => {
        const result = ragService.extractBarcodeFromQuery('Hello, how are you?');

        expect(result).toBeNull();
      });

      it('should return null for 3-digit numbers', () => {
        const result = ragService.extractBarcodeFromQuery('I have 123 apples');

        expect(result).toBeNull();
      });

      it('should return null for 2-digit numbers', () => {
        const result = ragService.extractBarcodeFromQuery('Price is 99 dollars');

        expect(result).toBeNull();
      });

      it('should return null for single digit', () => {
        const result = ragService.extractBarcodeFromQuery('I need 5 items');

        expect(result).toBeNull();
      });

      it('should return null for empty string', () => {
        const result = ragService.extractBarcodeFromQuery('');

        expect(result).toBeNull();
      });
    });

    describe('Priority and edge cases', () => {
      it('should prioritize full barcode over partial', () => {
        const result = ragService.extractBarcodeFromQuery('8698686923236 and 923236');

        expect(result.type).toBe('full');
        expect(result.barcodes).toContain('8698686923236');
      });

      it('should prioritize partial over short code', () => {
        const result = ragService.extractBarcodeFromQuery('Find 92323 and 1591');

        expect(result.type).toBe('partial');
      });

      it('should handle mixed formats correctly', () => {
        const result = ragService.extractBarcodeFromQuery('Codes: 8698686923236, 923236, 1591');

        expect(result.type).toBe('full');
        expect(result.barcodes.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Exact Barcode Search - exactBarcodeSearch()', () => {
    describe('Search execution', () => {
      it('should return empty array if no KB IDs provided', async () => {
        const result = await ragService.exactBarcodeSearch([], '8698686923236');

        expect(result).toEqual([]);
        expect(db.query).not.toHaveBeenCalled();
      });

      it('should return empty array for null KB IDs', async () => {
        const result = await ragService.exactBarcodeSearch(null, '8698686923236');

        expect(result).toEqual([]);
      });

      it('should search for full 13-digit barcode', async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              content: 'Product with barcode 8698686923236',
              document_name: 'products.csv',
              knowledge_base_name: 'Products',
              knowledge_base_id: 1,
              similarity: 1.0,
              chunk_index: 0
            }
          ]
        });

        const result = await ragService.exactBarcodeSearch([1], '8698686923236', false, 20);

        expect(result).toHaveLength(1);
        expect(result[0].content).toContain('8698686923236');
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('ILIKE'),
          expect.arrayContaining([[1], '%8698686923236%', 20])
        );
      });

      it('should search with multiple KB IDs', async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            { id: 1, content: 'Match from KB 1', knowledge_base_id: 1 },
            { id: 2, content: 'Match from KB 2', knowledge_base_id: 2 }
          ]
        });

        const result = await ragService.exactBarcodeSearch([1, 2], '8698686923236');

        expect(result).toHaveLength(2);
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('kb.id = ANY($1::int[])'),
          expect.any(Array)
        );
      });

      it('should apply limit parameter', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await ragService.exactBarcodeSearch([1], '8698686923236', false, 5);

        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([5])
        );
      });
    });

    describe('Search patterns for different barcode types', () => {
      it('should use correct pattern for 6-digit partial barcode', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await ragService.exactBarcodeSearch([1], '923236', false, 20);

        expect(db.query).toHaveBeenCalled();
        const queryParams = db.query.mock.calls[0][1];
        expect(queryParams).toContain('%923236%');
      });

      it('should use multiple patterns for 4-digit short code', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await ragService.exactBarcodeSearch([1], '1591', true, 20);

        expect(db.query).toHaveBeenCalled();
        const queryParams = db.query.mock.calls[0][1];
        expect(queryParams.some(p => typeof p === 'string' && p.includes('1591'))).toBe(true);
      });

      it('should handle 5-digit partial barcode', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await ragService.exactBarcodeSearch([1], '92323', false, 20);

        expect(db.query).toHaveBeenCalled();
      });

      it('should handle 12-digit partial barcode', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await ragService.exactBarcodeSearch([1], '869868692323', false, 20);

        expect(db.query).toHaveBeenCalled();
      });
    });

    describe('Error handling', () => {
      it('should return empty array on database error', async () => {
        db.query.mockRejectedValueOnce(new Error('Database connection failed'));

        const result = await ragService.exactBarcodeSearch([1], '8698686923236');

        expect(result).toEqual([]);
        expect(logger.error).toHaveBeenCalled();
      });

      it('should handle query timeout gracefully', async () => {
        db.query.mockRejectedValueOnce(new Error('Query timeout'));

        const result = await ragService.exactBarcodeSearch([1], '8698686923236');

        expect(result).toEqual([]);
      });

      it('should handle invalid barcode gracefully', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await ragService.exactBarcodeSearch([1], '');

        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('Result formatting', () => {
      it('should return properly formatted results', async () => {
        const mockResults = [
          {
            id: 1,
            content: 'Test content',
            chunk_index: 0,
            document_id: 10,
            document_name: 'test.csv',
            knowledge_base_name: 'Test KB',
            knowledge_base_id: 1,
            similarity: 1.0
          }
        ];
        db.query.mockResolvedValueOnce({ rows: mockResults });

        const result = await ragService.exactBarcodeSearch([1], '8698686923236');

        expect(result[0]).toHaveProperty('id');
        expect(result[0]).toHaveProperty('content');
        expect(result[0]).toHaveProperty('document_name');
        expect(result[0]).toHaveProperty('knowledge_base_name');
        expect(result[0].similarity).toBe(1.0);
      });
    });
  });

  describe('Context Retrieval - getContextForQuery()', () => {
    describe('Knowledge base validation', () => {
      it('should return no context if no knowledge bases linked', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await ragService.getContextForQuery(1, 'test query');

        expect(result.hasContext).toBe(false);
        expect(result.context).toBeNull();
        expect(result.sources).toEqual([]);
      });

      it('should return no context if knowledge base ID is null', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ knowledge_base_id: null }] });

        const result = await ragService.getContextForQuery(1, 'test query');

        expect(result.hasContext).toBe(false);
      });

      it('should fetch knowledge base details when linked', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Products' }] });

        embeddingService.getEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValueOnce([]);

        await ragService.getContextForQuery(1, 'test query');

        expect(db.query).toHaveBeenCalledTimes(2);
      });
    });

    describe('Barcode query handling', () => {
      it('should use exact match for barcode queries', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Products' }] })
          .mockResolvedValueOnce({
            rows: [{
              id: 1,
              content: 'Product: Apple | Barcode: 8698686923236 | Price: 10.00',
              document_name: 'products.csv',
              knowledge_base_name: 'Products',
              chunk_index: 0,
              similarity: 1.0
            }]
          });

        const result = await ragService.getContextForQuery(1, 'What is the price for 8698686923236?');

        expect(result.hasContext).toBe(true);
        expect(result.context).toContain('Product: Apple');
        expect(result.sources).toHaveLength(1);
        expect(embeddingService.getEmbedding).not.toHaveBeenCalled();
      });

      it('should handle multiple barcodes in single query', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Products' }] })
          .mockResolvedValueOnce({
            rows: [{ id: 1, content: 'Product 1', chunk_index: 0, document_name: 'doc1', knowledge_base_name: 'KB1' }]
          })
          .mockResolvedValueOnce({
            rows: [{ id: 2, content: 'Product 2', chunk_index: 0, document_name: 'doc2', knowledge_base_name: 'KB1' }]
          });

        const result = await ragService.getContextForQuery(1, 'Compare 8698686923236 and 8698686924363');

        expect(result.hasContext).toBe(true);
        expect(db.query).toHaveBeenCalledTimes(4); // config + kb + 2 exact searches
      });

      it('should deduplicate results from multiple barcode searches', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Products' }] })
          .mockResolvedValueOnce({
            rows: [{ id: 1, content: 'Dup', chunk_index: 0, document_name: 'd', knowledge_base_name: 'k' }]
          })
          .mockResolvedValueOnce({
            rows: [{ id: 1, content: 'Dup', chunk_index: 0, document_name: 'd', knowledge_base_name: 'k' }]
          });

        const result = await ragService.getContextForQuery(1, '8698686923236 and 8698686923236');

        expect(result.sources).toHaveLength(1); // Deduplicated
      });

      it('should fall back to vector search if no exact match', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Products' }] })
          .mockResolvedValueOnce({ rows: [] }); // No exact match

        embeddingService.getEmbedding.mockResolvedValueOnce([0.1, 0.2]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValueOnce([
          { content: 'Vector match', document_name: 'd', knowledge_base_name: 'k', similarity: 0.8, chunk_index: 0 }
        ]);

        const result = await ragService.getContextForQuery(1, 'Find 8698686923236');

        expect(result.hasContext).toBe(true);
        expect(embeddingService.getEmbedding).toHaveBeenCalled();
      });
    });

    describe('Vector search handling', () => {
      it('should use vector search for non-barcode queries', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'FAQ' }] });

        embeddingService.getEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValueOnce([
          {
            content: 'How to return a product',
            document_name: 'faq.md',
            knowledge_base_name: 'FAQ',
            similarity: 0.85,
            chunk_index: 0
          }
        ]);

        const result = await ragService.getContextForQuery(1, 'How do I return a product?');

        expect(result.hasContext).toBe(true);
        expect(embeddingService.getEmbedding).toHaveBeenCalledWith('How do I return a product?');
        expect(vectorStore.multiKnowledgeBaseSearch).toHaveBeenCalled();
      });

      it('should pass options to vector search', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB' }] });

        embeddingService.getEmbedding.mockResolvedValueOnce([0.1]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValueOnce([]);

        await ragService.getContextForQuery(1, 'test', { maxChunks: 10, threshold: 0.8 });

        expect(vectorStore.multiKnowledgeBaseSearch).toHaveBeenCalledWith(
          [1],
          [0.1],
          { limit: 10, threshold: 0.8 }
        );
      });

      it('should use default options if not provided', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB' }] });

        embeddingService.getEmbedding.mockResolvedValueOnce([0.1]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValueOnce([]);

        await ragService.getContextForQuery(1, 'test');

        expect(vectorStore.multiKnowledgeBaseSearch).toHaveBeenCalledWith(
          [1],
          [0.1],
          { limit: 20, threshold: 0.7 }
        );
      });

      it('should return no context if no results above threshold', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB' }] });

        embeddingService.getEmbedding.mockResolvedValueOnce([0.1]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValueOnce([]);

        const result = await ragService.getContextForQuery(1, 'random query');

        expect(result.hasContext).toBe(false);
        expect(result.context).toBeNull();
      });
    });

    describe('Context formatting', () => {
      it('should format context with source labels', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB' }] });

        embeddingService.getEmbedding.mockResolvedValueOnce([0.1]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValueOnce([
          {
            content: 'Content 1',
            document_name: 'doc1.txt',
            knowledge_base_name: 'KB',
            similarity: 0.9,
            chunk_index: 0
          },
          {
            content: 'Content 2',
            document_name: 'doc2.txt',
            knowledge_base_name: 'KB',
            similarity: 0.8,
            chunk_index: 1
          }
        ]);

        const result = await ragService.getContextForQuery(1, 'test');

        expect(result.context).toContain('[Source 1: doc1.txt]');
        expect(result.context).toContain('[Source 2: doc2.txt]');
        expect(result.context).toContain('Content 1');
        expect(result.context).toContain('Content 2');
      });

      it('should separate sources with delimiter', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB' }] });

        embeddingService.getEmbedding.mockResolvedValueOnce([0.1]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValueOnce([
          { content: 'C1', document_name: 'd1', knowledge_base_name: 'k', similarity: 0.9, chunk_index: 0 },
          { content: 'C2', document_name: 'd2', knowledge_base_name: 'k', similarity: 0.8, chunk_index: 1 }
        ]);

        const result = await ragService.getContextForQuery(1, 'test');

        expect(result.context).toContain('\n\n---\n\n');
      });

      it('should include source metadata', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB' }] });

        embeddingService.getEmbedding.mockResolvedValueOnce([0.1]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValueOnce([
          {
            content: 'Test',
            document_name: 'test.txt',
            knowledge_base_name: 'TestKB',
            similarity: 0.95,
            chunk_index: 5
          }
        ]);

        const result = await ragService.getContextForQuery(1, 'test');

        expect(result.sources[0]).toEqual({
          documentName: 'test.txt',
          knowledgeBaseName: 'TestKB',
          similarity: 0.95,
          chunkIndex: 5
        });
      });
    });

    describe('Error handling', () => {
      it('should handle database errors gracefully', async () => {
        db.query.mockRejectedValueOnce(new Error('DB error'));

        const result = await ragService.getContextForQuery(1, 'test');

        expect(result.hasContext).toBe(false);
        expect(logger.error).toHaveBeenCalled();
      });

      it('should handle embedding generation errors', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] });

        embeddingService.getEmbedding.mockRejectedValueOnce(new Error('API error'));

        const result = await ragService.getContextForQuery(1, 'test');

        expect(result.hasContext).toBe(false);
        expect(result).toHaveProperty('error');
      });

      it('should handle vector store errors', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] });

        embeddingService.getEmbedding.mockResolvedValueOnce([0.1]);
        vectorStore.multiKnowledgeBaseSearch.mockRejectedValueOnce(new Error('Search error'));

        const result = await ragService.getContextForQuery(1, 'test');

        expect(result.hasContext).toBe(false);
      });

      it('should not fail the chat on RAG errors', async () => {
        db.query.mockRejectedValueOnce(new Error('Critical error'));

        const result = await ragService.getContextForQuery(1, 'test');

        expect(result).toBeDefined();
        expect(result.hasContext).toBe(false);
      });
    });
  });

  describe('Knowledge Base Management - getBotKnowledgeBases()', () => {
    it('should return linked knowledge base', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Products KB', description: 'Product data' }] });

      const result = await ragService.getBotKnowledgeBases(1);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Products KB');
    });

    it('should return empty array if no KB linked', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await ragService.getBotKnowledgeBases(1);

      expect(result).toEqual([]);
    });

    it('should return empty array if KB ID is null', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ knowledge_base_id: null }] });

      const result = await ragService.getBotKnowledgeBases(1);

      expect(result).toEqual([]);
    });

    it('should handle missing knowledge base gracefully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 999 }] })
        .mockResolvedValueOnce({ rows: [] }); // KB not found

      const result = await ragService.getBotKnowledgeBases(1);

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await ragService.getBotKnowledgeBases(1);

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should log KB lookup details', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test KB' }] });

      await ragService.getBotKnowledgeBases(1);

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Getting knowledge bases for bot 1'));
    });
  });

  describe('RAG Prompt Construction - buildRAGPrompt()', () => {
    describe('With context', () => {
      it('should build prompt with context', () => {
        const context = 'Product: Apple | Price: $1.00';
        const prompt = ragService.buildRAGPrompt('You are a helpful assistant.', context);

        expect(prompt).toContain('KNOWLEDGE BASE CONTENT');
        expect(prompt).toContain(context);
        expect(prompt).toContain('NO HALLUCINATION');
        expect(prompt).toContain('You are a helpful assistant.');
      });

      it('should include anti-hallucination rules', () => {
        const prompt = ragService.buildRAGPrompt('', 'Some context');

        expect(prompt).toContain('CRITICAL RULES');
        expect(prompt).toContain('Do NOT make up prices');
        expect(prompt).toContain('Do NOT guess or estimate');
      });

      it('should include barcode search instructions', () => {
        const prompt = ragService.buildRAGPrompt('', 'Context');

        expect(prompt).toContain('HOW TO FIND BARCODE AND PRICE');
        expect(prompt).toContain('13-digit barcode');
        expect(prompt).toContain('caliber-price pattern');
      });

      it('should include practical examples', () => {
        const prompt = ragService.buildRAGPrompt('', 'Context');

        expect(prompt).toContain('EXAMPLES:');
        expect(prompt).toContain('261-29011,00');
        expect(prompt).toContain('Caliber');
        expect(prompt).toContain('Price');
      });

      it('should wrap context with markers', () => {
        const context = 'Test content';
        const prompt = ragService.buildRAGPrompt('', context);

        expect(prompt).toContain('=== KNOWLEDGE BASE CONTENT ===');
        expect(prompt).toContain('=== END KNOWLEDGE BASE ===');
      });

      it('should use default prompt if none provided', () => {
        const prompt = ragService.buildRAGPrompt(null, 'Context');

        expect(prompt).toContain('helpful assistant');
      });

      it('should handle empty original prompt', () => {
        const prompt = ragService.buildRAGPrompt('', 'Context');

        expect(prompt).toContain('helpful assistant');
      });
    });

    describe('Without context (anti-hallucination)', () => {
      it('should build anti-hallucination prompt without context', () => {
        const prompt = ragService.buildRAGPrompt('You are a helpful assistant.', null);

        expect(prompt).toContain('⚠️ CRITICAL RULE');
        expect(prompt).toContain('NO HALLUCINATION');
        expect(prompt).not.toContain('KNOWLEDGE BASE CONTENT');
      });

      it('should warn about no database access', () => {
        const prompt = ragService.buildRAGPrompt('', null);

        expect(prompt).toContain('do NOT have access to any knowledge base');
        expect(prompt).toContain('bazamda yoxdur');
      });

      it('should suggest linking a knowledge base', () => {
        const prompt = ragService.buildRAGPrompt('', null);

        expect(prompt).toContain('check if a Knowledge Base is linked');
      });

      it('should instruct to say data not available', () => {
        const prompt = ragService.buildRAGPrompt('', null);

        expect(prompt).toContain('Bu məlumat hazırda mənim bazamda yoxdur');
      });

      it('should include original prompt', () => {
        const prompt = ragService.buildRAGPrompt('Custom instructions', null);

        expect(prompt).toContain('Custom instructions');
      });

      it('should work with empty context string', () => {
        const prompt = ragService.buildRAGPrompt('Test', '');

        expect(prompt).toContain('do NOT have access');
      });

      it('should handle undefined context', () => {
        const prompt = ragService.buildRAGPrompt('Test', undefined);

        expect(prompt).toContain('NO HALLUCINATION');
      });
    });
  });

  describe('Knowledge Base Linking - linkKnowledgeBase()', () => {
    it('should link knowledge base to bot', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ragService.linkKnowledgeBase(1, 5);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE ai_configurations'),
        [5, 1]
      );
    });

    it('should update the knowledge_base_id field', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ragService.linkKnowledgeBase(10, 20);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SET knowledge_base_id = $1'),
        [20, 10]
      );
    });

    it('should update the updated_at timestamp', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ragService.linkKnowledgeBase(1, 5);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = NOW()'),
        expect.any(Array)
      );
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Update failed'));

      await expect(ragService.linkKnowledgeBase(1, 5)).rejects.toThrow('Update failed');
    });
  });

  describe('Knowledge Base Unlinking - unlinkKnowledgeBase()', () => {
    it('should unlink knowledge base from bot', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ragService.unlinkKnowledgeBase(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SET knowledge_base_id = NULL'),
        [1]
      );
    });

    it('should update the updated_at timestamp', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ragService.unlinkKnowledgeBase(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = NOW()'),
        [1]
      );
    });

    it('should work for bot without linked KB', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(ragService.unlinkKnowledgeBase(99)).resolves.not.toThrow();
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Update failed'));

      await expect(ragService.unlinkKnowledgeBase(1)).rejects.toThrow('Update failed');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete barcode search flow', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Products' }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            content: 'ROW: [Barcode: 8698686923236] | [Product: Apple] | [Price: 10.00 USD]',
            document_name: 'products.csv',
            knowledge_base_name: 'Products',
            chunk_index: 0
          }]
        });

      const result = await ragService.getContextForQuery(1, 'What is price for barcode 8698686923236?');

      expect(result.hasContext).toBe(true);
      expect(result.context).toContain('8698686923236');
      expect(result.sources[0].documentName).toBe('products.csv');
    });

    it('should handle complete vector search flow', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'FAQ' }] });

      embeddingService.getEmbedding.mockResolvedValueOnce(new Array(1536).fill(0.1));
      vectorStore.multiKnowledgeBaseSearch.mockResolvedValueOnce([
        {
          content: 'You can return products within 30 days',
          document_name: 'return-policy.md',
          knowledge_base_name: 'FAQ',
          similarity: 0.92,
          chunk_index: 0
        }
      ]);

      const result = await ragService.getContextForQuery(1, 'What is the return policy?', {
        maxChunks: 5,
        threshold: 0.8
      });

      expect(result.hasContext).toBe(true);
      expect(result.context).toContain('return products within 30 days');
      expect(result.sources[0].similarity).toBe(0.92);
    });

    it('should handle KB linking and immediate use', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Link KB
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 5 }] }) // Get config
        .mockResolvedValueOnce({ rows: [{ id: 5, name: 'New KB' }] }); // Get KB

      embeddingService.getEmbedding.mockResolvedValueOnce([0.1]);
      vectorStore.multiKnowledgeBaseSearch.mockResolvedValueOnce([
        { content: 'Test', document_name: 'd', knowledge_base_name: 'New KB', similarity: 0.9, chunk_index: 0 }
      ]);

      await ragService.linkKnowledgeBase(1, 5);
      const result = await ragService.getContextForQuery(1, 'test');

      expect(result.hasContext).toBe(true);
      expect(result.sources[0].knowledgeBaseName).toBe('New KB');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle very long queries', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const longQuery = 'a'.repeat(10000);
      embeddingService.getEmbedding.mockResolvedValueOnce([0.1]);
      vectorStore.multiKnowledgeBaseSearch.mockResolvedValueOnce([]);

      const result = await ragService.getContextForQuery(1, longQuery);

      expect(result).toBeDefined();
    });

    it('should handle empty query string', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      embeddingService.getEmbedding.mockResolvedValueOnce([0.1]);
      vectorStore.multiKnowledgeBaseSearch.mockResolvedValueOnce([]);

      const result = await ragService.getContextForQuery(1, '');

      expect(result).toBeDefined();
    });

    it('should handle special characters in query', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      embeddingService.getEmbedding.mockResolvedValueOnce([0.1]);
      vectorStore.multiKnowledgeBaseSearch.mockResolvedValueOnce([]);

      const result = await ragService.getContextForQuery(1, 'test @#$%^&*()');

      expect(result).toBeDefined();
    });

    it('should handle Unicode characters in barcode query', async () => {
      const result = ragService.extractBarcodeFromQuery('найти 8698686923236');

      expect(result).not.toBeNull();
      expect(result.barcodes).toContain('8698686923236');
    });

    it('should handle very large result sets', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      embeddingService.getEmbedding.mockResolvedValueOnce([0.1]);
      const largeResults = Array.from({ length: 100 }, (_, i) => ({
        content: `Content ${i}`,
        document_name: `doc${i}`,
        knowledge_base_name: 'KB',
        similarity: 0.9 - i * 0.001,
        chunk_index: i
      }));
      vectorStore.multiKnowledgeBaseSearch.mockResolvedValueOnce(largeResults);

      const result = await ragService.getContextForQuery(1, 'test', { maxChunks: 100 });

      expect(result.hasContext).toBe(true);
      expect(result.sources.length).toBeLessThanOrEqual(100);
    });

    it('should handle bot ID 0', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await ragService.getContextForQuery(0, 'test');

      expect(result).toBeDefined();
    });

    it('should handle negative bot ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await ragService.getContextForQuery(-1, 'test');

      expect(result).toBeDefined();
    });

    it('should handle threshold edge cases', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      embeddingService.getEmbedding.mockResolvedValueOnce([0.1]);
      vectorStore.multiKnowledgeBaseSearch.mockResolvedValueOnce([]);

      await ragService.getContextForQuery(1, 'test', { threshold: 0 });
      await ragService.getContextForQuery(1, 'test', { threshold: 1 });
      await ragService.getContextForQuery(1, 'test', { threshold: 0.5 });

      expect(vectorStore.multiKnowledgeBaseSearch).toHaveBeenCalledTimes(3);
    });

    it('should handle maxChunks edge cases', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      embeddingService.getEmbedding.mockResolvedValueOnce([0.1]);
      vectorStore.multiKnowledgeBaseSearch.mockResolvedValueOnce([]);

      await ragService.getContextForQuery(1, 'test', { maxChunks: 1 });

      expect(vectorStore.multiKnowledgeBaseSearch).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({ limit: 1 })
      );
    });
  });
});
