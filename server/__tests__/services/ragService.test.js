/**
 * RAG Service Tests
 * Tests for server/services/ragService.js
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
  debug: jest.fn()
}));

const db = require('../../db');
const embeddingService = require('../../knowledge/EmbeddingService');
const vectorStore = require('../../knowledge/VectorStore');
const ragService = require('../../services/ragService');

describe('RAG Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractBarcodeFromQuery()', () => {
    it('should extract 13-digit barcode', () => {
      const result = ragService.extractBarcodeFromQuery('Find product with barcode 8698686923236');

      expect(result).not.toBeNull();
      expect(result.barcodes).toContain('8698686923236');
      expect(result.type).toBe('full');
      expect(result.isShort).toBe(false);
    });

    it('should extract multiple 13-digit barcodes', () => {
      const result = ragService.extractBarcodeFromQuery('Compare 8698686923236 and 8698686924363');

      expect(result.barcodes).toHaveLength(2);
      expect(result.barcodes).toContain('8698686923236');
      expect(result.barcodes).toContain('8698686924363');
    });

    it('should extract partial barcode (5-12 digits)', () => {
      const result = ragService.extractBarcodeFromQuery('Find 923236');

      expect(result).not.toBeNull();
      expect(result.type).toBe('partial');
      expect(result.barcodes).toContain('923236');
    });

    it('should extract 4-digit short code', () => {
      const result = ragService.extractBarcodeFromQuery('Product code 1591');

      expect(result).not.toBeNull();
      expect(result.type).toBe('short');
      expect(result.isShort).toBe(true);
      expect(result.barcodes).toContain('1591');
    });

    it('should return null for no barcode', () => {
      const result = ragService.extractBarcodeFromQuery('Hello, how are you?');

      expect(result).toBeNull();
    });

    it('should deduplicate barcodes', () => {
      const result = ragService.extractBarcodeFromQuery('8698686923236 and again 8698686923236');

      expect(result.barcodes).toHaveLength(1);
    });
  });

  describe('exactBarcodeSearch()', () => {
    it('should return empty if no KB IDs provided', async () => {
      const result = await ragService.exactBarcodeSearch([], '8698686923236');

      expect(result).toEqual([]);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should search for full barcode (13 digits)', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, content: 'Product with barcode 8698686923236', document_name: 'products.csv', knowledge_base_name: 'Products', knowledge_base_id: 1, similarity: 1.0 }
        ]
      });

      const result = await ragService.exactBarcodeSearch([1], '8698686923236', false, 20);

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining([[1], '%8698686923236%'])
      );
    });

    it('should search for partial barcode (6 digits)', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, content: 'Match found' }]
      });

      await ragService.exactBarcodeSearch([1], '923236', false, 20);

      expect(db.query).toHaveBeenCalled();
      // Should search with multiple patterns including prefix
    });

    it('should search for short code (4 digits)', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, content: 'Short code match' }]
      });

      await ragService.exactBarcodeSearch([1], '1591', true, 20);

      expect(db.query).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const result = await ragService.exactBarcodeSearch([1], '8698686923236');

      expect(result).toEqual([]);
    });
  });

  describe('getContextForQuery()', () => {
    it('should return no context if no knowledge bases linked', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // No ai_configurations

      const result = await ragService.getContextForQuery(1, 'test query');

      expect(result.hasContext).toBe(false);
      expect(result.context).toBeNull();
    });

    it('should use exact match for barcode queries', async () => {
      // Mock ai_configurations
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Products' }] })
        // Exact barcode search
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
    });

    it('should fall back to vector search for non-barcode queries', async () => {
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
      expect(embeddingService.getEmbedding).toHaveBeenCalled();
      expect(vectorStore.multiKnowledgeBaseSearch).toHaveBeenCalled();
    });

    it('should return no context if no results above threshold', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      embeddingService.getEmbedding.mockResolvedValueOnce([0.1]);
      vectorStore.multiKnowledgeBaseSearch.mockResolvedValueOnce([]);

      const result = await ragService.getContextForQuery(1, 'random query');

      expect(result.hasContext).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const result = await ragService.getContextForQuery(1, 'test');

      expect(result.hasContext).toBe(false);
      // Error may or may not be included in response
    });
  });

  describe('getBotKnowledgeBases()', () => {
    it('should return linked knowledge base', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Products KB' }] });

      const result = await ragService.getBotKnowledgeBases(1);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Products KB');
    });

    it('should return empty array if no KB linked', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await ragService.getBotKnowledgeBases(1);

      expect(result).toEqual([]);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Error'));

      const result = await ragService.getBotKnowledgeBases(1);

      expect(result).toEqual([]);
    });
  });

  describe('buildRAGPrompt()', () => {
    it('should build prompt with context', () => {
      const context = 'Product: Apple | Price: $1.00';
      const prompt = ragService.buildRAGPrompt('You are a helpful assistant.', context);

      expect(prompt).toContain('KNOWLEDGE BASE CONTENT');
      expect(prompt).toContain(context);
      expect(prompt).toContain('NO HALLUCINATION');
    });

    it('should build anti-hallucination prompt without context', () => {
      const prompt = ragService.buildRAGPrompt('You are a helpful assistant.', null);

      expect(prompt).toContain('⚠️ CRITICAL RULE');
      expect(prompt).toContain('NO HALLUCINATION');
      expect(prompt).toContain('bazamda yoxdur');
    });

    it('should use default prompt if none provided', () => {
      const promptWithContext = ragService.buildRAGPrompt(null, 'Some context');
      const promptWithoutContext = ragService.buildRAGPrompt(null, null);

      expect(promptWithContext).toContain('helpful assistant');
      expect(promptWithoutContext).toContain('helpful assistant');
    });
  });

  describe('linkKnowledgeBase()', () => {
    it('should link knowledge base to bot', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ragService.linkKnowledgeBase(1, 5);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE ai_configurations'),
        [5, 1]
      );
    });
  });

  describe('unlinkKnowledgeBase()', () => {
    it('should unlink knowledge base from bot', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ragService.unlinkKnowledgeBase(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SET knowledge_base_id = NULL'),
        [1]
      );
    });
  });
});
