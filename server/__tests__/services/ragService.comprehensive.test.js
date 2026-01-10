/**
 * RAG Service Comprehensive Tests
 * Tests for server/services/ragService.js
 *
 * Coverage areas:
 * - Barcode extraction and pattern matching
 * - Exact barcode search with various patterns
 * - Vector search integration
 * - Context generation and formatting
 * - Knowledge base linking
 * - Error handling and edge cases
 * - RAG prompt building
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../knowledge/EmbeddingService', () => ({
  getEmbedding: jest.fn()
}));

jest.mock('../../knowledge/VectorStore', () => ({
  multiKnowledgeBaseSearch: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const embeddingService = require('../../knowledge/EmbeddingService');
const vectorStore = require('../../knowledge/VectorStore');
const log = require('../../utils/logger');
const ragService = require('../../services/ragService');

describe('RAGService - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== BARCODE EXTRACTION TESTS ====================
  describe('extractBarcodeFromQuery', () => {
    describe('Full Barcode Extraction (13 digits)', () => {
      it('should extract single 13-digit barcode', () => {
        const result = ragService.extractBarcodeFromQuery('Find product 8698686920123');
        expect(result).toEqual({
          barcodes: ['8698686920123'],
          isShort: false,
          type: 'full'
        });
      });

      it('should extract multiple 13-digit barcodes', () => {
        const result = ragService.extractBarcodeFromQuery('Compare 8698686920123 and 8698686920456');
        expect(result).toEqual({
          barcodes: ['8698686920123', '8698686920456'],
          isShort: false,
          type: 'full'
        });
      });

      it('should deduplicate identical barcodes', () => {
        const result = ragService.extractBarcodeFromQuery('Check 8698686920123 and 8698686920123 again');
        expect(result.barcodes).toHaveLength(1);
        expect(result.barcodes[0]).toBe('8698686920123');
      });

      it('should extract barcode from middle of text', () => {
        const result = ragService.extractBarcodeFromQuery('What is the price for 8698686920123 product?');
        expect(result.type).toBe('full');
        expect(result.barcodes).toContain('8698686920123');
      });

      it('should extract barcode at start of query', () => {
        const result = ragService.extractBarcodeFromQuery('8698686920123 - what is this?');
        expect(result.type).toBe('full');
      });

      it('should extract barcode at end of query', () => {
        const result = ragService.extractBarcodeFromQuery('Tell me about 8698686920123');
        expect(result.type).toBe('full');
      });
    });

    describe('Partial Barcode Extraction (5-12 digits)', () => {
      it('should extract 12-digit partial barcode', () => {
        const result = ragService.extractBarcodeFromQuery('Find 869868692012');
        expect(result).toEqual({
          barcodes: ['869868692012'],
          isShort: false,
          type: 'partial'
        });
      });

      it('should extract 11-digit partial barcode', () => {
        const result = ragService.extractBarcodeFromQuery('Search 86986869201');
        expect(result.type).toBe('partial');
      });

      it('should extract 10-digit partial barcode', () => {
        const result = ragService.extractBarcodeFromQuery('Check 8698686920');
        expect(result.type).toBe('partial');
      });

      it('should extract 9-digit partial barcode', () => {
        const result = ragService.extractBarcodeFromQuery('Find 869868692');
        expect(result.type).toBe('partial');
      });

      it('should extract 8-digit partial barcode', () => {
        const result = ragService.extractBarcodeFromQuery('What is 86986869');
        expect(result.type).toBe('partial');
      });

      it('should extract 7-digit partial barcode', () => {
        const result = ragService.extractBarcodeFromQuery('Show me 8698686');
        expect(result.type).toBe('partial');
      });

      it('should extract 6-digit partial barcode', () => {
        const result = ragService.extractBarcodeFromQuery('Product 869868');
        expect(result.type).toBe('partial');
        expect(result.barcodes).toContain('869868');
      });

      it('should extract 5-digit partial barcode', () => {
        const result = ragService.extractBarcodeFromQuery('Code 86986');
        expect(result.type).toBe('partial');
      });

      it('should extract multiple partial barcodes', () => {
        const result = ragService.extractBarcodeFromQuery('Compare 869868692 and 123456');
        expect(result.barcodes).toHaveLength(2);
        expect(result.type).toBe('partial');
      });

      it('should deduplicate identical partial barcodes', () => {
        const result = ragService.extractBarcodeFromQuery('Check 869868 and 869868');
        expect(result.barcodes).toHaveLength(1);
      });

      it('should use word boundaries for partial barcodes', () => {
        const result = ragService.extractBarcodeFromQuery('Item 123456789012 and 123456');
        expect(result.type).toBe('partial');
        // Should not extract from within the 13-digit number
      });
    });

    describe('Short Code Extraction (4 digits)', () => {
      it('should extract 4-digit short code', () => {
        const result = ragService.extractBarcodeFromQuery('Find product 1591');
        expect(result).toEqual({
          barcodes: ['1591'],
          isShort: true,
          type: 'short'
        });
      });

      it('should extract multiple 4-digit codes', () => {
        const result = ragService.extractBarcodeFromQuery('Compare 1591 and 2345');
        expect(result.barcodes).toHaveLength(2);
        expect(result.isShort).toBe(true);
      });

      it('should deduplicate identical short codes', () => {
        const result = ragService.extractBarcodeFromQuery('Check 1591 and 1591');
        expect(result.barcodes).toHaveLength(1);
      });

      it('should extract 4-digit code with word boundaries', () => {
        const result = ragService.extractBarcodeFromQuery('Product code 1234 please');
        expect(result.type).toBe('short');
        expect(result.barcodes).toContain('1234');
      });

      it('should not extract 4 digits from middle of longer number', () => {
        const result = ragService.extractBarcodeFromQuery('Number 8698686920123');
        expect(result.type).not.toBe('short');
      });
    });

    describe('No Barcode Cases', () => {
      it('should return null for text without numbers', () => {
        const result = ragService.extractBarcodeFromQuery('Hello world');
        expect(result).toBeNull();
      });

      it('should return null for 3-digit numbers', () => {
        const result = ragService.extractBarcodeFromQuery('Product 123');
        expect(result).toBeNull();
      });

      it('should return null for 2-digit numbers', () => {
        const result = ragService.extractBarcodeFromQuery('Code 12');
        expect(result).toBeNull();
      });

      it('should return null for 1-digit numbers', () => {
        const result = ragService.extractBarcodeFromQuery('Number 5');
        expect(result).toBeNull();
      });

      it('should return null for empty string', () => {
        const result = ragService.extractBarcodeFromQuery('');
        expect(result).toBeNull();
      });

      it('should return null for only spaces', () => {
        const result = ragService.extractBarcodeFromQuery('   ');
        expect(result).toBeNull();
      });
    });

    describe('Priority and Edge Cases', () => {
      it('should prioritize full barcode over partial', () => {
        const result = ragService.extractBarcodeFromQuery('8698686920123 and 869868');
        expect(result.type).toBe('full');
      });

      it('should prioritize partial over short code', () => {
        const result = ragService.extractBarcodeFromQuery('869868 and 1591');
        expect(result.type).toBe('partial');
      });

      it('should handle mixed alphanumeric text', () => {
        const result = ragService.extractBarcodeFromQuery('Product ABC8698686920123XYZ');
        expect(result.type).toBe('full');
      });

      it('should handle special characters around barcode', () => {
        const result = ragService.extractBarcodeFromQuery('Barcode: 8698686920123!');
        expect(result.type).toBe('full');
      });

      it('should handle barcodes with line breaks', () => {
        const result = ragService.extractBarcodeFromQuery('Find\n8698686920123\nplease');
        expect(result.type).toBe('full');
      });
    });
  });

  // ==================== EXACT BARCODE SEARCH TESTS ====================
  describe('exactBarcodeSearch', () => {
    describe('Full Barcode Search (13 digits)', () => {
      it('should search for 13-digit barcode in specific KBs', async () => {
        const mockResults = [
          { id: 1, content: 'Product 8698686920123', chunk_index: 0, document_name: 'Products', similarity: 1.0 }
        ];
        db.query.mockResolvedValue({ rows: mockResults });

        const results = await ragService.exactBarcodeSearch([1, 2], '8698686920123', false, 20);

        expect(results).toEqual(mockResults);
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('kb.id = ANY($1::int[])'),
          expect.arrayContaining([[1, 2]])
        );
      });

      it('should use exact match pattern for 13 digits', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await ragService.exactBarcodeSearch([1], '8698686920123', false, 20);

        const query = db.query.mock.calls[0][0];
        const params = db.query.mock.calls[0][1];

        expect(query).toContain('c.content ILIKE');
        expect(params).toContain('%8698686920123%');
      });

      it('should return empty array when no KBs provided', async () => {
        const results = await ragService.exactBarcodeSearch([], '8698686920123', false, 20);
        expect(results).toEqual([]);
        expect(db.query).not.toHaveBeenCalled();
      });

      it('should return empty array when KBs is null', async () => {
        const results = await ragService.exactBarcodeSearch(null, '8698686920123', false, 20);
        expect(results).toEqual([]);
        expect(db.query).not.toHaveBeenCalled();
      });

      it('should apply limit parameter', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await ragService.exactBarcodeSearch([1], '8698686920123', false, 5);

        const params = db.query.mock.calls[0][1];
        expect(params[params.length - 1]).toBe(5);
      });

      it('should log search details', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await ragService.exactBarcodeSearch([1], '8698686920123', false, 20);

        expect(log.info).toHaveBeenCalledWith(
          expect.stringContaining('Performing barcode search')
        );
      });
    });

    describe('Partial Barcode Search (5-12 digits)', () => {
      it('should search with multiple patterns for partial barcode', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await ragService.exactBarcodeSearch([1], '869868', false, 20);

        const params = db.query.mock.calls[0][1];
        expect(params).toContain('%869868%');
        expect(params).toContain('%8698686869868%');
      });

      it('should handle 6-digit partial with special patterns', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await ragService.exactBarcodeSearch([1], '920123', false, 20);

        const params = db.query.mock.calls[0][1];
        expect(params.length).toBeGreaterThan(2);
      });

      it('should find partial barcode in chunks', async () => {
        const mockResults = [
          { id: 1, content: 'Barcode 8698686920123 price 10.00', similarity: 1.0 }
        ];
        db.query.mockResolvedValue({ rows: mockResults });

        const results = await ragService.exactBarcodeSearch([1], '920123', false, 20);
        expect(results).toHaveLength(1);
      });

      it('should search 12-digit partial', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await ragService.exactBarcodeSearch([1], '869868692012', false, 20);

        const params = db.query.mock.calls[0][1];
        expect(params.some(p => typeof p === 'string' && p.includes('869868692012'))).toBe(true);
      });

      it('should search 5-digit partial', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await ragService.exactBarcodeSearch([1], '86986', false, 20);

        const params = db.query.mock.calls[0][1];
        expect(params.some(p => typeof p === 'string' && p.includes('86986'))).toBe(true);
      });
    });

    describe('Short Code Search (4 digits)', () => {
      it('should search with multiple patterns for 4-digit code', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await ragService.exactBarcodeSearch([1], '1591', true, 20);

        const params = db.query.mock.calls[0][1];
        expect(params).toContain('%1591%');
        expect(params).toContain('%8698686921591%');
        expect(params).toContain('%8698686%1591%');
      });

      it('should mark isShort flag correctly', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await ragService.exactBarcodeSearch([1], '1591', true, 20);

        expect(log.info).toHaveBeenCalledWith(
          expect.stringContaining('isShort: true')
        );
      });

      it('should find short code in ROW format', async () => {
        const mockResults = [
          { id: 1, content: '[Barcode: 8698686921591]', similarity: 1.0 }
        ];
        db.query.mockResolvedValue({ rows: mockResults });

        const results = await ragService.exactBarcodeSearch([1], '1591', true, 20);
        expect(results).toHaveLength(1);
      });

      it('should handle 4-digit without isShort flag', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await ragService.exactBarcodeSearch([1], '1591', false, 20);

        const params = db.query.mock.calls[0][1];
        expect(params.length).toBeGreaterThan(0);
      });
    });

    describe('Error Handling', () => {
      it('should handle database query error', async () => {
        db.query.mockRejectedValue(new Error('Database connection failed'));

        const results = await ragService.exactBarcodeSearch([1], '8698686920123', false, 20);

        expect(results).toEqual([]);
        expect(log.error).toHaveBeenCalledWith(
          expect.stringContaining('Exact search error')
        );
      });

      it('should handle null query result', async () => {
        db.query.mockResolvedValue(null);

        const results = await ragService.exactBarcodeSearch([1], '8698686920123', false, 20);

        expect(results).toEqual([]);
      });

      it('should handle undefined rows', async () => {
        db.query.mockResolvedValue({ rows: undefined });

        const results = await ragService.exactBarcodeSearch([1], '8698686920123', false, 20);

        expect(Array.isArray(results)).toBe(true);
      });
    });

    describe('Result Logging and Formatting', () => {
      it('should log match count', async () => {
        const mockResults = [
          { id: 1, content: 'Match 1', knowledge_base_name: 'KB1', document_name: 'Doc1' },
          { id: 2, content: 'Match 2', knowledge_base_name: 'KB1', document_name: 'Doc2' }
        ];
        db.query.mockResolvedValue({ rows: mockResults });

        await ragService.exactBarcodeSearch([1], '8698686920123', false, 20);

        expect(log.info).toHaveBeenCalledWith(
          expect.stringContaining('found 2 matches')
        );
      });

      it('should log each match details', async () => {
        const mockResults = [
          { id: 1, content: 'Match', knowledge_base_name: 'TestKB', document_name: 'TestDoc' }
        ];
        db.query.mockResolvedValue({ rows: mockResults });

        await ragService.exactBarcodeSearch([1], '8698686920123', false, 20);

        expect(log.debug).toHaveBeenCalledWith(
          expect.stringContaining('TestKB')
        );
      });

      it('should include all required fields in results', async () => {
        const mockResults = [
          {
            id: 1,
            content: 'Test content',
            chunk_index: 0,
            document_id: 10,
            document_name: 'Doc',
            knowledge_base_name: 'KB',
            knowledge_base_id: 1,
            similarity: 1.0
          }
        ];
        db.query.mockResolvedValue({ rows: mockResults });

        const results = await ragService.exactBarcodeSearch([1], '8698686920123', false, 20);

        expect(results[0]).toHaveProperty('id');
        expect(results[0]).toHaveProperty('content');
        expect(results[0]).toHaveProperty('document_name');
        expect(results[0]).toHaveProperty('similarity');
      });
    });

    describe('Pattern Deduplication', () => {
      it('should deduplicate search patterns', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await ragService.exactBarcodeSearch([1], '1591', true, 20);

        expect(log.debug).toHaveBeenCalledWith(
          expect.stringContaining('Search patterns')
        );
      });
    });
  });

  // ==================== GET CONTEXT FOR QUERY TESTS ====================
  describe('getContextForQuery', () => {
    describe('Knowledge Base Resolution', () => {
      it('should return no context when bot has no knowledge bases', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const result = await ragService.getContextForQuery(1, 'test query');

        expect(result).toEqual({
          context: null,
          sources: [],
          hasContext: false
        });
      });

      it('should fetch bot knowledge bases', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test KB' }] });

        embeddingService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValue([]);

        await ragService.getContextForQuery(1, 'test query');

        expect(db.query).toHaveBeenCalled();
      });

      it('should use multiple knowledge bases', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }, { id: 2, name: 'KB2' }] });

        embeddingService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValue([]);

        await ragService.getContextForQuery(1, 'test query');

        expect(log.info).toHaveBeenCalledWith(
          expect.stringContaining('Found 2 KB(s)'),
          expect.any(Array)
        );
      });
    });

    describe('Barcode Exact Match Flow', () => {
      it('should perform exact search when barcode detected', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] })
          .mockResolvedValueOnce({
            rows: [{
              id: 1,
              content: 'Product 8698686920123 price 10.00',
              document_name: 'Products',
              knowledge_base_name: 'KB1',
              chunk_index: 0,
              similarity: 1.0
            }]
          });

        const result = await ragService.getContextForQuery(1, 'Find 8698686920123');

        expect(result.hasContext).toBe(true);
        expect(result.context).toContain('8698686920123');
      });

      it('should handle multiple barcodes in query', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] })
          .mockResolvedValueOnce({
            rows: [{
              id: 1,
              content: 'Product 1',
              document_name: 'Doc',
              knowledge_base_name: 'KB',
              chunk_index: 0
            }]
          })
          .mockResolvedValueOnce({
            rows: [{
              id: 2,
              content: 'Product 2',
              document_name: 'Doc',
              knowledge_base_name: 'KB',
              chunk_index: 1
            }]
          });

        const result = await ragService.getContextForQuery(1, '8698686920123 and 8698686920456');

        expect(result.hasContext).toBe(true);
      });

      it('should deduplicate exact match results', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] })
          .mockResolvedValueOnce({
            rows: [
              { id: 1, content: 'Product', document_name: 'Doc', knowledge_base_name: 'KB', chunk_index: 0 },
              { id: 1, content: 'Product', document_name: 'Doc', knowledge_base_name: 'KB', chunk_index: 0 }
            ]
          });

        const result = await ragService.getContextForQuery(1, '8698686920123');

        expect(result.sources).toHaveLength(1);
      });

      it('should fallback to vector search if no exact match', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] })
          .mockResolvedValueOnce({ rows: [] });

        embeddingService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValue([
          { content: 'Result', document_name: 'Doc', knowledge_base_name: 'KB', similarity: 0.9, chunk_index: 0 }
        ]);

        const result = await ragService.getContextForQuery(1, '8698686920123');

        expect(embeddingService.getEmbedding).toHaveBeenCalled();
        expect(vectorStore.multiKnowledgeBaseSearch).toHaveBeenCalled();
      });
    });

    describe('Vector Search Flow', () => {
      it('should generate embedding for query', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] });

        embeddingService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValue([]);

        await ragService.getContextForQuery(1, 'test query');

        expect(embeddingService.getEmbedding).toHaveBeenCalledWith('test query');
      });

      it('should search in all linked knowledge bases', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] });

        embeddingService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValue([]);

        await ragService.getContextForQuery(1, 'test query');

        expect(vectorStore.multiKnowledgeBaseSearch).toHaveBeenCalledWith(
          [1],
          [0.1, 0.2, 0.3],
          expect.objectContaining({ limit: 20, threshold: 0.7 })
        );
      });

      it('should use custom maxChunks option', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] });

        embeddingService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValue([]);

        await ragService.getContextForQuery(1, 'test query', { maxChunks: 10 });

        expect(vectorStore.multiKnowledgeBaseSearch).toHaveBeenCalledWith(
          expect.any(Array),
          expect.any(Array),
          expect.objectContaining({ limit: 10 })
        );
      });

      it('should use custom threshold option', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] });

        embeddingService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValue([]);

        await ragService.getContextForQuery(1, 'test query', { threshold: 0.8 });

        expect(vectorStore.multiKnowledgeBaseSearch).toHaveBeenCalledWith(
          expect.any(Array),
          expect.any(Array),
          expect.objectContaining({ threshold: 0.8 })
        );
      });

      it('should return no context when no results above threshold', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] });

        embeddingService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValue([]);

        const result = await ragService.getContextForQuery(1, 'test query');

        expect(result).toEqual({
          context: null,
          sources: [],
          hasContext: false
        });
      });

      it('should return no context when results is null', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] });

        embeddingService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValue(null);

        const result = await ragService.getContextForQuery(1, 'test query');

        expect(result.hasContext).toBe(false);
      });
    });

    describe('Context Formatting', () => {
      it('should format context with source labels', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] });

        embeddingService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValue([
          {
            content: 'Test content 1',
            document_name: 'Doc1',
            knowledge_base_name: 'KB1',
            similarity: 0.9,
            chunk_index: 0
          }
        ]);

        const result = await ragService.getContextForQuery(1, 'test query');

        expect(result.context).toContain('[Source 1: Doc1]');
        expect(result.context).toContain('Test content 1');
      });

      it('should format multiple chunks with separators', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] });

        embeddingService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValue([
          { content: 'Content 1', document_name: 'Doc1', knowledge_base_name: 'KB', similarity: 0.9, chunk_index: 0 },
          { content: 'Content 2', document_name: 'Doc2', knowledge_base_name: 'KB', similarity: 0.8, chunk_index: 1 }
        ]);

        const result = await ragService.getContextForQuery(1, 'test query');

        expect(result.context).toContain('---');
        expect(result.context).toContain('[Source 1: Doc1]');
        expect(result.context).toContain('[Source 2: Doc2]');
      });

      it('should collect source metadata', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] });

        embeddingService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValue([
          {
            content: 'Test content',
            document_name: 'TestDoc',
            knowledge_base_name: 'TestKB',
            similarity: 0.85,
            chunk_index: 5
          }
        ]);

        const result = await ragService.getContextForQuery(1, 'test query');

        expect(result.sources).toHaveLength(1);
        expect(result.sources[0]).toEqual({
          documentName: 'TestDoc',
          knowledgeBaseName: 'TestKB',
          similarity: 0.85,
          chunkIndex: 5
        });
      });

      it('should log context character count', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] });

        embeddingService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValue([
          { content: 'Test', document_name: 'Doc', knowledge_base_name: 'KB', similarity: 0.9, chunk_index: 0 }
        ]);

        await ragService.getContextForQuery(1, 'test query');

        expect(log.info).toHaveBeenCalledWith(
          expect.stringContaining('Context built')
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle embedding generation error', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] });

        embeddingService.getEmbedding.mockRejectedValue(new Error('Embedding failed'));

        const result = await ragService.getContextForQuery(1, 'test query');

        expect(result.hasContext).toBe(false);
        expect(result.error).toBeDefined();
        expect(log.error).toHaveBeenCalled();
      });

      it('should handle vector store search error', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] });

        embeddingService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        vectorStore.multiKnowledgeBaseSearch.mockRejectedValue(new Error('Search failed'));

        const result = await ragService.getContextForQuery(1, 'test query');

        expect(result.hasContext).toBe(false);
        expect(result.error).toBe('Search failed');
      });

      it('should return error message in result', async () => {
        db.query.mockRejectedValue(new Error('Database error'));

        const result = await ragService.getContextForQuery(1, 'test query');

        expect(result).toHaveProperty('error');
        expect(result.hasContext).toBe(false);
      });

      it('should log error details', async () => {
        const error = new Error('Test error');
        error.stack = 'Error stack trace';
        db.query.mockRejectedValue(error);

        await ragService.getContextForQuery(1, 'test query');

        expect(log.error).toHaveBeenCalledWith(
          expect.stringContaining('RAG ERROR')
        );
      });
    });

    describe('Logging and Debugging', () => {
      it('should log search start and end', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] });

        embeddingService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValue([]);

        await ragService.getContextForQuery(1, 'test query');

        expect(log.info).toHaveBeenCalledWith(
          expect.stringContaining('RAG SEARCH START')
        );
        expect(log.info).toHaveBeenCalledWith(
          expect.stringContaining('RAG SEARCH END')
        );
      });

      it('should log bot ID and query', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await ragService.getContextForQuery(123, 'test query');

        expect(log.info).toHaveBeenCalledWith(
          expect.stringContaining('Bot ID: 123')
        );
        expect(log.info).toHaveBeenCalledWith(
          expect.stringContaining('Query:')
        );
      });

      it('should log search options', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await ragService.getContextForQuery(1, 'test', { maxChunks: 15, threshold: 0.75 });

        expect(log.info).toHaveBeenCalledWith(
          expect.stringContaining('maxChunks=15')
        );
        expect(log.info).toHaveBeenCalledWith(
          expect.stringContaining('threshold=0.75')
        );
      });

      it('should log similarity scores and content preview', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] });

        embeddingService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        vectorStore.multiKnowledgeBaseSearch.mockResolvedValue([
          { content: 'Test content', document_name: 'Doc', knowledge_base_name: 'KB', similarity: 0.95, chunk_index: 0 }
        ]);

        await ragService.getContextForQuery(1, 'test');

        expect(log.debug).toHaveBeenCalledWith(
          expect.stringContaining('similarity=')
        );
      });

      it('should truncate long queries in logs', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const longQuery = 'a'.repeat(200);
        await ragService.getContextForQuery(1, longQuery);

        const logCall = log.info.mock.calls.find(call =>
          call[0].includes('Query:')
        );
        expect(logCall).toBeDefined();
      });
    });
  });

  // ==================== GET BOT KNOWLEDGE BASES TESTS ====================
  describe('getBotKnowledgeBases', () => {
    it('should return knowledge base linked to bot', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 5 }] })
        .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Test KB' }] });

      const result = await ragService.getBotKnowledgeBases(1);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(5);
      expect(result[0].name).toBe('Test KB');
    });

    it('should return empty array when no KB linked', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ knowledge_base_id: null }] });

      const result = await ragService.getBotKnowledgeBases(1);

      expect(result).toEqual([]);
    });

    it('should return empty array when no config found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await ragService.getBotKnowledgeBases(1);

      expect(result).toEqual([]);
    });

    it('should query ai_configurations table', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ragService.getBotKnowledgeBases(123);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ai_configurations'),
        [123]
      );
    });

    it('should query knowledge_bases table when KB ID found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 10 }] })
        .mockResolvedValueOnce({ rows: [{ id: 10, name: 'KB' }] });

      await ragService.getBotKnowledgeBases(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('knowledge_bases'),
        [10]
      );
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const result = await ragService.getBotKnowledgeBases(1);

      expect(result).toEqual([]);
      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('Error getting bot knowledge bases'),
        'DB error'
      );
    });

    it('should log bot ID being queried', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ragService.getBotKnowledgeBases(456);

      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('Getting knowledge bases for bot 456')
      );
    });

    it('should log when KB is found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 7 }] })
        .mockResolvedValueOnce({ rows: [{ id: 7, name: 'KB' }] });

      await ragService.getBotKnowledgeBases(1);

      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('Bot has linked KB: 7')
      );
    });

    it('should log when no KB is found', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ knowledge_base_id: null }] });

      await ragService.getBotKnowledgeBases(1);

      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('No linked KB for bot')
      );
    });

    it('should log debug info for config result', async () => {
      const configRows = [{ knowledge_base_id: 8 }];
      db.query
        .mockResolvedValueOnce({ rows: configRows })
        .mockResolvedValueOnce({ rows: [{ id: 8, name: 'KB' }] });

      await ragService.getBotKnowledgeBases(1);

      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining('AI config result'),
        configRows
      );
    });

    it('should log debug info for KB lookup result', async () => {
      const kbRows = [{ id: 9, name: 'TestKB' }];
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 9 }] })
        .mockResolvedValueOnce({ rows: kbRows });

      await ragService.getBotKnowledgeBases(1);

      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining('KB lookup result'),
        kbRows
      );
    });
  });

  // ==================== BUILD RAG PROMPT TESTS ====================
  describe('buildRAGPrompt', () => {
    describe('No Context Cases', () => {
      it('should return anti-hallucination prompt when context is null', () => {
        const prompt = ragService.buildRAGPrompt('You are helpful.', null);

        expect(prompt).toContain('You are helpful.');
        expect(prompt).toContain('NO HALLUCINATION');
        expect(prompt).toContain('not in my database');
      });

      it('should return anti-hallucination prompt when context is empty string', () => {
        const prompt = ragService.buildRAGPrompt('System prompt', '');

        expect(prompt).toContain('NO HALLUCINATION');
      });

      it('should use default prompt when original is null', () => {
        const prompt = ragService.buildRAGPrompt(null, null);

        expect(prompt).toContain('helpful assistant');
      });

      it('should suggest checking KB link when no context', () => {
        const prompt = ragService.buildRAGPrompt('Test', null);

        expect(prompt).toContain('Knowledge Base is linked');
      });

      it('should warn about not making up data', () => {
        const prompt = ragService.buildRAGPrompt('Test', null);

        expect(prompt).toContain('Do NOT make up');
        expect(prompt).toContain('Do NOT guess');
      });
    });

    describe('With Context Cases', () => {
      it('should include context in prompt', () => {
        const context = 'Product data: Barcode 8698686920123, Price: 10.00';
        const prompt = ragService.buildRAGPrompt('You are helpful.', context);

        expect(prompt).toContain('KNOWLEDGE BASE CONTENT');
        expect(prompt).toContain(context);
      });

      it('should include RAG instructions', () => {
        const prompt = ragService.buildRAGPrompt('Test', 'Context data');

        expect(prompt).toContain('CRITICAL RULES');
        expect(prompt).toContain('ONLY use information from');
      });

      it('should warn against hallucination with context', () => {
        const prompt = ragService.buildRAGPrompt('Test', 'Context');

        expect(prompt).toContain('Do NOT make up prices');
        expect(prompt).toContain('Do NOT guess or estimate');
      });

      it('should provide barcode finding instructions', () => {
        const prompt = ragService.buildRAGPrompt('Test', 'Context');

        expect(prompt).toContain('HOW TO FIND BARCODE');
        expect(prompt).toContain('13-digit barcode');
      });

      it('should include caliber-price pattern instructions', () => {
        const prompt = ragService.buildRAGPrompt('Test', 'Context');

        expect(prompt).toContain('caliber-price pattern');
        expect(prompt).toContain('201-230');
      });

      it('should provide examples of price extraction', () => {
        const prompt = ragService.buildRAGPrompt('Test', 'Context');

        expect(prompt).toContain('EXAMPLES');
        expect(prompt).toContain('261-29011,00');
      });

      it('should include real data example', () => {
        const prompt = ragService.buildRAGPrompt('Test', 'Context');

        expect(prompt).toContain('REAL DATA EXAMPLE');
      });

      it('should append original prompt at end', () => {
        const prompt = ragService.buildRAGPrompt('Custom assistant prompt', 'Context');

        expect(prompt).toContain('Custom assistant prompt');
      });

      it('should handle undefined original prompt', () => {
        const prompt = ragService.buildRAGPrompt(undefined, 'Context');

        expect(prompt).toContain('helpful assistant');
      });

      it('should warn about numbers being barcodes not years', () => {
        const prompt = ragService.buildRAGPrompt('Test', 'Context');

        expect(prompt).toContain('1591');
        expect(prompt).toContain('BARCODE');
        expect(prompt).toContain('not a year');
      });

      it('should instruct on barcode not found message', () => {
        const prompt = ragService.buildRAGPrompt('Test', 'Context');

        expect(prompt).toContain('Bu barkod');
        expect(prompt).toContain('tapılmadı');
      });

      it('should emphasize EXACT values only', () => {
        const prompt = ragService.buildRAGPrompt('Test', 'Context');

        expect(prompt).toContain('EXACT values');
      });
    });

    describe('Prompt Structure', () => {
      it('should place RAG instructions before original prompt', () => {
        const prompt = ragService.buildRAGPrompt('Original prompt here', 'Context data');

        const ragIndex = prompt.indexOf('KNOWLEDGE BASE CONTENT');
        const originalIndex = prompt.indexOf('Original prompt here');

        expect(ragIndex).toBeLessThan(originalIndex);
      });

      it('should clearly mark knowledge base section', () => {
        const prompt = ragService.buildRAGPrompt('Test', 'My context data');

        expect(prompt).toContain('=== KNOWLEDGE BASE CONTENT ===');
        expect(prompt).toContain('=== END KNOWLEDGE BASE ===');
      });

      it('should include answering steps at the end', () => {
        const prompt = ragService.buildRAGPrompt('Test', 'Context');

        expect(prompt).toContain('When answering:');
        expect(prompt).toContain('1. Find the barcode');
        expect(prompt).toContain('2. Look at the SAME LINE');
      });
    });
  });

  // ==================== LINK/UNLINK KNOWLEDGE BASE TESTS ====================
  describe('linkKnowledgeBase', () => {
    it('should link knowledge base to bot', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await ragService.linkKnowledgeBase(5, 10);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE ai_configurations'),
        [10, 5]
      );
    });

    it('should set knowledge_base_id', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await ragService.linkKnowledgeBase(7, 15);

      const query = db.query.mock.calls[0][0];
      expect(query).toContain('knowledge_base_id = $1');
    });

    it('should update timestamp', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await ragService.linkKnowledgeBase(1, 2);

      const query = db.query.mock.calls[0][0];
      expect(query).toContain('updated_at = NOW()');
    });

    it('should match bot_id', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await ragService.linkKnowledgeBase(99, 88);

      const query = db.query.mock.calls[0][0];
      expect(query).toContain('bot_id = $2');
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [88, 99]
      );
    });
  });

  describe('unlinkKnowledgeBase', () => {
    it('should unlink knowledge base from bot', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await ragService.unlinkKnowledgeBase(5);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE ai_configurations'),
        [5]
      );
    });

    it('should set knowledge_base_id to NULL', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await ragService.unlinkKnowledgeBase(7);

      const query = db.query.mock.calls[0][0];
      expect(query).toContain('knowledge_base_id = NULL');
    });

    it('should update timestamp', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await ragService.unlinkKnowledgeBase(1);

      const query = db.query.mock.calls[0][0];
      expect(query).toContain('updated_at = NOW()');
    });

    it('should match bot_id', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await ragService.unlinkKnowledgeBase(42);

      const query = db.query.mock.calls[0][0];
      expect(query).toContain('bot_id = $1');
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [42]
      );
    });
  });

  // ==================== INTEGRATION AND EDGE CASE TESTS ====================
  describe('Integration and Edge Cases', () => {
    it('should handle empty query string', async () => {
      const result = ragService.extractBarcodeFromQuery('');
      expect(result).toBeNull();
    });

    it('should handle very long query strings', async () => {
      const longQuery = 'a'.repeat(10000) + '8698686920123';
      const result = ragService.extractBarcodeFromQuery(longQuery);
      expect(result.type).toBe('full');
    });

    it('should handle queries with special regex characters', async () => {
      const result = ragService.extractBarcodeFromQuery('Find [8698686920123] now!');
      expect(result.type).toBe('full');
    });

    it('should handle unicode characters in query', async () => {
      const result = ragService.extractBarcodeFromQuery('Məhsul 8698686920123 qiymət?');
      expect(result.type).toBe('full');
    });

    it('should handle context with special characters', () => {
      const context = 'Data with <html> & special chars';
      const prompt = ragService.buildRAGPrompt('Test', context);
      expect(prompt).toContain(context);
    });

    it('should handle very large context strings', () => {
      const largeContext = 'x'.repeat(100000);
      const prompt = ragService.buildRAGPrompt('Test', largeContext);
      expect(prompt).toContain(largeContext);
    });

    it('should handle concurrent getContextForQuery calls', async () => {
      db.query
        .mockResolvedValue({ rows: [{ knowledge_base_id: 1 }] })
        .mockResolvedValue({ rows: [{ id: 1, name: 'KB' }] });

      embeddingService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      vectorStore.multiKnowledgeBaseSearch.mockResolvedValue([]);

      const promises = [
        ragService.getContextForQuery(1, 'query1'),
        ragService.getContextForQuery(1, 'query2'),
        ragService.getContextForQuery(1, 'query3')
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
    });

    it('should handle null bot ID gracefully', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await ragService.getBotKnowledgeBases(null);
      expect(result).toEqual([]);
    });

    it('should handle negative bot ID', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await ragService.getBotKnowledgeBases(-1);
      expect(result).toEqual([]);
    });

    it('should preserve exact match results order', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, content: 'First', document_name: 'Doc1', knowledge_base_name: 'KB', chunk_index: 0 },
            { id: 2, content: 'Second', document_name: 'Doc2', knowledge_base_name: 'KB', chunk_index: 1 }
          ]
        });

      const result = await ragService.getContextForQuery(1, '8698686920123');

      expect(result.context).toMatch(/First.*Second/s);
    });

    it('should handle embedding with zero values', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] });

      embeddingService.getEmbedding.mockResolvedValue([0, 0, 0]);
      vectorStore.multiKnowledgeBaseSearch.mockResolvedValue([]);

      const result = await ragService.getContextForQuery(1, 'test');

      expect(result.hasContext).toBe(false);
    });

    it('should handle chunks with missing fields', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] });

      embeddingService.getEmbedding.mockResolvedValue([0.1, 0.2]);
      vectorStore.multiKnowledgeBaseSearch.mockResolvedValue([
        { content: 'Test', similarity: 0.9 } // Missing some fields
      ]);

      const result = await ragService.getContextForQuery(1, 'test');

      expect(result.hasContext).toBe(true);
    });

    it('should handle barcode at exact word boundary', async () => {
      const result = ragService.extractBarcodeFromQuery(' 1591 ');
      expect(result.type).toBe('short');
    });

    it('should handle multiple spaces between words and barcode', async () => {
      const result = ragService.extractBarcodeFromQuery('Find     8698686920123     now');
      expect(result.type).toBe('full');
    });

    it('should handle tabs and newlines in query', async () => {
      const result = ragService.extractBarcodeFromQuery('Find\t8698686920123\n');
      expect(result.type).toBe('full');
    });

    it('should limit query preview to 100 chars in logs', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const longQuery = 'a'.repeat(150);
      await ragService.getContextForQuery(1, longQuery);

      const logCall = log.info.mock.calls.find(call =>
        call[0].includes('Query:')
      );
      expect(logCall[0].length).toBeLessThan(200);
    });
  });
});
