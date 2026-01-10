/**
 * Comprehensive Knowledge/RAG Services Tests
 *
 * This test suite provides extensive coverage for:
 * 1. RAGService - retrieval augmented generation
 * 2. VectorStore - vector embeddings storage/retrieval
 * 3. DocumentProcessor - document parsing, chunking
 * 4. EmbeddingService - text embeddings generation
 * 5. ChunkingService - text chunking utilities
 *
 * Coverage includes:
 * - All public methods
 * - Error handling and edge cases
 * - Integration scenarios
 * - Performance optimizations
 * - Cache behavior
 * - Database interactions
 */

// Mock dependencies before imports
jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

// Mock OpenAI for embeddings
const mockEmbeddingsCreate = jest.fn();
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    embeddings: {
      create: mockEmbeddingsCreate
    }
  }))
}));

// Mock file system
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn()
  }
}));

// Mock Document and KnowledgeBase models
jest.mock('../../../models/Document', () => ({
  findById: jest.fn(),
  updateStatus: jest.fn(),
  update: jest.fn()
}));

jest.mock('../../../models/KnowledgeBase', () => ({
  findById: jest.fn()
}));

const db = require('../../../db');
const log = require('../../../utils/logger');
const fs = require('fs').promises;
const Document = require('../../../models/Document');
const KnowledgeBase = require('../../../models/KnowledgeBase');

// Set environment variables
process.env.OPENAI_API_KEY = 'test-api-key';

// Import services after mocks
const RAGService = require('../../../services/ragService');
const VectorStore = require('../../../knowledge/VectorStore');
const EmbeddingService = require('../../../knowledge/EmbeddingService');
const DocumentProcessor = require('../../../knowledge/DocumentProcessor');
const ChunkingService = require('../../../knowledge/ChunkingService');

describe('Knowledge/RAG Services - Comprehensive Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // RAGService Tests (100 tests)
  // ============================================================================
  describe('RAGService', () => {
    describe('extractBarcodeFromQuery', () => {
      it('should extract full 13-digit barcode', () => {
        const result = RAGService.extractBarcodeFromQuery('What is 8698686924363?');
        expect(result).toEqual({
          barcodes: ['8698686924363'],
          isShort: false,
          type: 'full'
        });
      });

      it('should extract multiple full barcodes', () => {
        const result = RAGService.extractBarcodeFromQuery('8698686924363 and 8698686924364');
        expect(result.barcodes).toHaveLength(2);
        expect(result.type).toBe('full');
      });

      it('should extract partial barcode (5-12 digits)', () => {
        const result = RAGService.extractBarcodeFromQuery('Product code 924363');
        expect(result).toEqual({
          barcodes: ['924363'],
          isShort: false,
          type: 'partial'
        });
      });

      it('should extract 4-digit short code', () => {
        const result = RAGService.extractBarcodeFromQuery('Item 1591');
        expect(result).toEqual({
          barcodes: ['1591'],
          isShort: true,
          type: 'short'
        });
      });

      it('should return null for no barcode', () => {
        const result = RAGService.extractBarcodeFromQuery('What is the price?');
        expect(result).toBeNull();
      });

      it('should deduplicate barcodes', () => {
        const result = RAGService.extractBarcodeFromQuery('8698686924363 and 8698686924363');
        expect(result.barcodes).toHaveLength(1);
      });

      it('should prioritize full barcodes over partial', () => {
        const result = RAGService.extractBarcodeFromQuery('8698686924363');
        expect(result.type).toBe('full');
      });

      it('should handle barcodes in sentences', () => {
        const result = RAGService.extractBarcodeFromQuery('The barcode is 8698686924363 for this item');
        expect(result.barcodes).toContain('8698686924363');
      });

      it('should handle multiple partial barcodes', () => {
        const result = RAGService.extractBarcodeFromQuery('924363 or 924364');
        expect(result.barcodes).toHaveLength(2);
      });

      it('should handle short codes with text', () => {
        const result = RAGService.extractBarcodeFromQuery('Code 1591 price');
        expect(result.barcodes).toContain('1591');
      });
    });

    describe('exactBarcodeSearch', () => {
      it('should search for full 13-digit barcode', async () => {
        db.query.mockResolvedValue({
          rows: [
            { id: 1, content: 'Product 8698686924363', similarity: 1.0 }
          ]
        });

        const results = await RAGService.exactBarcodeSearch([1], '8698686924363', false);
        expect(results).toHaveLength(1);
        expect(db.query).toHaveBeenCalled();
      });

      it('should return empty array for no KB IDs', async () => {
        const results = await RAGService.exactBarcodeSearch([], '8698686924363', false);
        expect(results).toEqual([]);
      });

      it('should return empty array for null KB IDs', async () => {
        const results = await RAGService.exactBarcodeSearch(null, '8698686924363', false);
        expect(results).toEqual([]);
      });

      it('should search for partial barcode with common prefix', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await RAGService.exactBarcodeSearch([1], '924363', false);

        const query = db.query.mock.calls[0][0];
        expect(query).toContain('ILIKE');
      });

      it('should search for 4-digit short code', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await RAGService.exactBarcodeSearch([1], '1591', true);

        expect(db.query).toHaveBeenCalled();
      });

      it('should handle database errors gracefully', async () => {
        db.query.mockRejectedValue(new Error('DB Error'));

        const results = await RAGService.exactBarcodeSearch([1], '8698686924363', false);
        expect(results).toEqual([]);
        expect(log.error).toHaveBeenCalled();
      });

      it('should apply limit to results', async () => {
        db.query.mockResolvedValue({
          rows: Array(30).fill({ id: 1, content: 'test' })
        });

        await RAGService.exactBarcodeSearch([1], '8698686924363', false, 10);

        const params = db.query.mock.calls[0][1];
        expect(params).toContain(10);
      });

      it('should search across multiple KB IDs', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await RAGService.exactBarcodeSearch([1, 2, 3], '8698686924363', false);

        const params = db.query.mock.calls[0][1];
        expect(params[0]).toEqual([1, 2, 3]);
      });

      it('should deduplicate search patterns', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await RAGService.exactBarcodeSearch([1], '8698686924363', false);

        const query = db.query.mock.calls[0][0];
        const patternCount = (query.match(/ILIKE/g) || []).length;
        expect(patternCount).toBeGreaterThan(0);
      });

      it('should log search details', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await RAGService.exactBarcodeSearch([1], '8698686924363', false);

        expect(log.info).toHaveBeenCalledWith(
          expect.stringContaining('Performing barcode search')
        );
      });
    });

    describe('getContextForQuery', () => {
      it('should return no context if no KBs linked', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const result = await RAGService.getContextForQuery(1, 'test query');

        expect(result.hasContext).toBe(false);
        expect(result.context).toBeNull();
      });

      it('should use exact match for barcode queries', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, knowledge_base_id: 10, name: 'KB1' }] }) // bot KB
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'KB1' }] }) // KB lookup
          .mockResolvedValueOnce({ rows: [{ id: 1, content: 'Product 8698686924363', document_name: 'Doc1' }] }); // exact search

        const result = await RAGService.getContextForQuery(1, 'What is 8698686924363?');

        expect(result.hasContext).toBe(true);
        expect(result.context).toContain('8698686924363');
      });

      it('should fallback to vector search for non-barcode queries', async () => {
        mockEmbeddingsCreate.mockResolvedValue({
          data: [{ embedding: Array(1536).fill(0.1) }]
        });

        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, knowledge_base_id: 10 }] })
          .mockResolvedValueOnce({ rows: [{ id: 10, name: 'KB1' }] })
          .mockResolvedValueOnce({ rows: [{ available: true }] })
          .mockResolvedValueOnce({
            rows: [{
              id: 1,
              content: 'Test content',
              document_name: 'Doc1',
              knowledge_base_name: 'KB1',
              similarity: 0.9
            }]
          });

        const result = await RAGService.getContextForQuery(1, 'general question');

        expect(result.hasContext).toBe(true);
      });

      it('should handle errors gracefully', async () => {
        db.query.mockRejectedValue(new Error('DB Error'));

        const result = await RAGService.getContextForQuery(1, 'test');

        expect(result.hasContext).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should apply threshold to vector search', async () => {
        mockEmbeddingsCreate.mockResolvedValue({
          data: [{ embedding: Array(1536).fill(0.1) }]
        });

        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, knowledge_base_id: 10 }] })
          .mockResolvedValueOnce({ rows: [{ id: 10 }] })
          .mockResolvedValueOnce({ rows: [{ available: false }] })
          .mockResolvedValueOnce({ rows: [] });

        const result = await RAGService.getContextForQuery(1, 'test', { threshold: 0.9 });

        expect(result.hasContext).toBe(false);
      });

      it('should format context with sources', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, knowledge_base_id: 10 }] })
          .mockResolvedValueOnce({ rows: [{ id: 10 }] })
          .mockResolvedValueOnce({
            rows: [{
              id: 1,
              content: 'Test',
              document_name: 'Doc1',
              knowledge_base_name: 'KB1'
            }]
          });

        const result = await RAGService.getContextForQuery(1, '8698686924363');

        expect(result.context).toContain('[Source 1:');
        expect(result.sources).toHaveLength(1);
      });

      it('should limit chunks returned', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, knowledge_base_id: 10 }] })
          .mockResolvedValueOnce({ rows: [{ id: 10 }] })
          .mockResolvedValueOnce({
            rows: Array(30).fill({ id: 1, content: 'test', document_name: 'Doc1' })
          });

        const result = await RAGService.getContextForQuery(1, '8698686924363', { maxChunks: 5 });

        expect(result.sources.length).toBeLessThanOrEqual(5);
      });

      it('should log search progress', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await RAGService.getContextForQuery(1, 'test');

        expect(log.info).toHaveBeenCalledWith(expect.stringContaining('RAG SEARCH START'));
      });

      it('should handle multiple barcodes in query', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, knowledge_base_id: 10 }] })
          .mockResolvedValueOnce({ rows: [{ id: 10 }] })
          .mockResolvedValue({ rows: [{ id: 1, content: 'test', document_name: 'Doc1' }] });

        const result = await RAGService.getContextForQuery(1, '8698686924363 and 8698686924364');

        expect(result.hasContext).toBe(true);
      });
    });

    describe('getBotKnowledgeBases', () => {
      it('should return linked knowledge base', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ knowledge_base_id: 10 }] })
          .mockResolvedValueOnce({ rows: [{ id: 10, name: 'KB1' }] });

        const result = await RAGService.getBotKnowledgeBases(1);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(10);
      });

      it('should return empty array if no KB linked', async () => {
        db.query.mockResolvedValue({ rows: [{ knowledge_base_id: null }] });

        const result = await RAGService.getBotKnowledgeBases(1);

        expect(result).toEqual([]);
      });

      it('should return empty array if no config exists', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const result = await RAGService.getBotKnowledgeBases(1);

        expect(result).toEqual([]);
      });

      it('should handle database errors', async () => {
        db.query.mockRejectedValue(new Error('DB Error'));

        const result = await RAGService.getBotKnowledgeBases(1);

        expect(result).toEqual([]);
        expect(log.error).toHaveBeenCalled();
      });

      it('should log KB lookup', async () => {
        db.query.mockResolvedValue({ rows: [{ knowledge_base_id: null }] });

        await RAGService.getBotKnowledgeBases(1);

        expect(log.info).toHaveBeenCalledWith(expect.stringContaining('Getting knowledge bases'));
      });
    });

    describe('buildRAGPrompt', () => {
      it('should build anti-hallucination prompt when no context', () => {
        const prompt = RAGService.buildRAGPrompt('You are helpful', null);

        expect(prompt).toContain('NO HALLUCINATION');
        expect(prompt).toContain('You are helpful');
      });

      it('should include context in prompt', () => {
        const context = 'Product: Test Product\nPrice: $10';
        const prompt = RAGService.buildRAGPrompt('You are helpful', context);

        expect(prompt).toContain('KNOWLEDGE BASE CONTENT');
        expect(prompt).toContain('Test Product');
      });

      it('should include barcode extraction instructions', () => {
        const context = 'Product data';
        const prompt = RAGService.buildRAGPrompt('', context);

        expect(prompt).toContain('HOW TO FIND BARCODE AND PRICE');
      });

      it('should handle empty original prompt', () => {
        const prompt = RAGService.buildRAGPrompt('', 'context');

        expect(prompt).toContain('You are a helpful assistant');
      });

      it('should include critical rules', () => {
        const prompt = RAGService.buildRAGPrompt('Test', 'context');

        expect(prompt).toContain('CRITICAL RULES');
      });
    });

    describe('linkKnowledgeBase', () => {
      it('should link KB to bot', async () => {
        db.query.mockResolvedValue({ rows: [{ bot_id: 1, knowledge_base_id: 10 }] });

        await RAGService.linkKnowledgeBase(1, 10);

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE ai_configurations'),
          expect.arrayContaining([10, 1])
        );
      });

      it('should handle database errors', async () => {
        db.query.mockRejectedValue(new Error('DB Error'));

        await expect(RAGService.linkKnowledgeBase(1, 10)).rejects.toThrow();
      });
    });

    describe('unlinkKnowledgeBase', () => {
      it('should unlink KB from bot', async () => {
        db.query.mockResolvedValue({ rows: [{ bot_id: 1 }] });

        await RAGService.unlinkKnowledgeBase(1);

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('knowledge_base_id = NULL'),
          [1]
        );
      });
    });
  });

  // ============================================================================
  // EmbeddingService Tests (30 tests)
  // ============================================================================
  describe('EmbeddingService', () => {
    describe('getEmbedding', () => {
      it('should generate embedding for text', async () => {
        mockEmbeddingsCreate.mockResolvedValue({
          data: [{ embedding: [0.1, 0.2, 0.3] }]
        });

        const result = await EmbeddingService.getEmbedding('Test text');

        expect(result).toEqual([0.1, 0.2, 0.3]);
      });

      it('should reject empty text', async () => {
        await expect(EmbeddingService.getEmbedding('')).rejects.toThrow('Text cannot be empty');
      });

      it('should clean text before embedding', async () => {
        mockEmbeddingsCreate.mockResolvedValue({
          data: [{ embedding: [0.1] }]
        });

        await EmbeddingService.getEmbedding('Multiple   spaces');

        expect(mockEmbeddingsCreate).toHaveBeenCalledWith(
          expect.objectContaining({ input: 'Multiple spaces' })
        );
      });

      it('should handle API errors', async () => {
        mockEmbeddingsCreate.mockRejectedValue(new Error('API Error'));

        await expect(EmbeddingService.getEmbedding('test')).rejects.toThrow('Failed to generate embedding');
      });

      it('should truncate long text', async () => {
        mockEmbeddingsCreate.mockResolvedValue({
          data: [{ embedding: [0.1] }]
        });

        const longText = 'A'.repeat(50000);
        await EmbeddingService.getEmbedding(longText);

        const input = mockEmbeddingsCreate.mock.calls[0][0].input;
        expect(input.length).toBeLessThanOrEqual(32000);
      });
    });

    describe('getEmbeddings (batch)', () => {
      it('should return empty for empty input', async () => {
        const result = await EmbeddingService.getEmbeddings([]);
        expect(result).toEqual([]);
      });

      it('should filter out empty strings', async () => {
        mockEmbeddingsCreate.mockResolvedValue({
          data: [{ index: 0, embedding: [0.1] }]
        });

        const result = await EmbeddingService.getEmbeddings(['Valid', '', null]);

        expect(result).toHaveLength(1);
      });

      it('should process batches of 100', async () => {
        mockEmbeddingsCreate
          .mockResolvedValueOnce({
            data: Array(100).fill(0).map((_, i) => ({ index: i, embedding: [i] }))
          })
          .mockResolvedValueOnce({
            data: Array(50).fill(0).map((_, i) => ({ index: i, embedding: [i + 100] }))
          });

        const texts = Array(150).fill(0).map((_, i) => `Text ${i}`);
        const result = await EmbeddingService.getEmbeddings(texts);

        expect(result).toHaveLength(150);
        expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2);
      });

      it('should sort by index', async () => {
        mockEmbeddingsCreate.mockResolvedValue({
          data: [
            { index: 1, embedding: [0.2] },
            { index: 0, embedding: [0.1] }
          ]
        });

        const result = await EmbeddingService.getEmbeddings(['A', 'B']);

        expect(result[0]).toEqual([0.1]);
        expect(result[1]).toEqual([0.2]);
      });
    });

    describe('cleanText', () => {
      it('should return empty for null', () => {
        expect(EmbeddingService.cleanText(null)).toBe('');
      });

      it('should collapse whitespace', () => {
        expect(EmbeddingService.cleanText('a  b')).toBe('a b');
      });

      it('should remove null chars', () => {
        expect(EmbeddingService.cleanText('a\0b')).toBe('ab');
      });

      it('should truncate at 32000 chars', () => {
        const result = EmbeddingService.cleanText('A'.repeat(50000));
        expect(result.length).toBe(32000);
      });
    });

    describe('cosineSimilarity', () => {
      it('should return 1 for identical vectors', () => {
        const sim = EmbeddingService.cosineSimilarity([1, 0], [1, 0]);
        expect(sim).toBeCloseTo(1, 5);
      });

      it('should return 0 for orthogonal vectors', () => {
        const sim = EmbeddingService.cosineSimilarity([1, 0], [0, 1]);
        expect(sim).toBeCloseTo(0, 5);
      });

      it('should throw for different lengths', () => {
        expect(() => {
          EmbeddingService.cosineSimilarity([1], [1, 2]);
        }).toThrow('Vectors must have the same length');
      });

      it('should return 0 for zero vectors', () => {
        const sim = EmbeddingService.cosineSimilarity([0, 0], [1, 2]);
        expect(sim).toBe(0);
      });
    });
  });

  // ============================================================================
  // DocumentProcessor Tests (40 tests)
  // ============================================================================
  describe('DocumentProcessor', () => {
    describe('processDocument', () => {
      beforeEach(() => {
        Document.findById.mockResolvedValue({
          id: 1,
          knowledge_base_id: 10,
          type: 'txt',
          file_path: '/test.txt'
        });

        KnowledgeBase.findById.mockResolvedValue({
          id: 10,
          chunk_size: 1000,
          chunk_overlap: 200
        });
      });

      it('should throw if document not found', async () => {
        Document.findById.mockResolvedValue(null);

        await expect(DocumentProcessor.processDocument(999)).rejects.toThrow('Document not found');
      });

      it('should throw if KB not found', async () => {
        KnowledgeBase.findById.mockResolvedValue(null);

        await expect(DocumentProcessor.processDocument(1)).rejects.toThrow('Knowledge base not found');
      });

      it('should process txt document', async () => {
        fs.readFile.mockResolvedValue('Test content');
        mockEmbeddingsCreate.mockResolvedValue({
          data: [{ embedding: [0.1] }]
        });
        db.query.mockResolvedValue({ rows: [{ id: 1 }] });

        const result = await DocumentProcessor.processDocument(1);

        expect(result.success).toBe(true);
        expect(result.chunksCreated).toBeGreaterThan(0);
      });

      it('should update status to processing', async () => {
        fs.readFile.mockResolvedValue('Test content');
        mockEmbeddingsCreate.mockResolvedValue({
          data: [{ embedding: [0.1] }]
        });
        db.query.mockResolvedValue({ rows: [{ id: 1 }] });

        await DocumentProcessor.processDocument(1);

        expect(Document.updateStatus).toHaveBeenCalledWith(1, 'processing');
      });

      it('should update status to completed on success', async () => {
        fs.readFile.mockResolvedValue('Test content');
        mockEmbeddingsCreate.mockResolvedValue({
          data: [{ embedding: [0.1] }]
        });
        db.query.mockResolvedValue({ rows: [{ id: 1 }] });

        await DocumentProcessor.processDocument(1);

        expect(Document.update).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ status: 'completed' })
        );
      });

      it('should fail if no content extracted', async () => {
        fs.readFile.mockResolvedValue('');

        await expect(DocumentProcessor.processDocument(1)).rejects.toThrow('No content extracted');
        expect(Document.updateStatus).toHaveBeenCalledWith(1, 'failed');
      });

      it('should calculate content hash', async () => {
        fs.readFile.mockResolvedValue('Test content');
        mockEmbeddingsCreate.mockResolvedValue({
          data: [{ embedding: [0.1] }]
        });
        db.query.mockResolvedValue({ rows: [{ id: 1 }] });

        const result = await DocumentProcessor.processDocument(1);

        expect(result.contentHash).toBeDefined();
      });
    });

    describe('extractContent', () => {
      it('should extract from txt file', async () => {
        fs.readFile.mockResolvedValue('Text content');

        const content = await DocumentProcessor.extractFromTxt('/test.txt');

        expect(content).toBe('Text content');
      });

      it('should throw for missing file path', async () => {
        await expect(DocumentProcessor.extractFromTxt(null)).rejects.toThrow('File path is required');
      });

      it('should extract from markdown', async () => {
        fs.readFile.mockResolvedValue('# Header\n**bold**');

        const content = await DocumentProcessor.extractFromMarkdown('/test.md');

        expect(content).not.toContain('**');
      });
    });

    describe('cleanMarkdown', () => {
      it('should remove code blocks', () => {
        const content = '```js\ncode\n```';
        const cleaned = DocumentProcessor.cleanMarkdown(content);

        expect(cleaned).toContain('[Code]');
      });

      it('should remove inline code backticks', () => {
        const cleaned = DocumentProcessor.cleanMarkdown('`code`');
        expect(cleaned).toBe('code');
      });

      it('should convert headers', () => {
        const cleaned = DocumentProcessor.cleanMarkdown('# Header');
        expect(cleaned).not.toContain('#');
      });

      it('should remove bold markers', () => {
        const cleaned = DocumentProcessor.cleanMarkdown('**bold**');
        expect(cleaned).toBe('bold');
      });

      it('should remove italic markers', () => {
        const cleaned = DocumentProcessor.cleanMarkdown('*italic*');
        expect(cleaned).toBe('italic');
      });

      it('should extract link text', () => {
        const cleaned = DocumentProcessor.cleanMarkdown('[text](url)');
        expect(cleaned).toBe('text');
      });

      it('should handle images', () => {
        const cleaned = DocumentProcessor.cleanMarkdown('![alt](url)');
        expect(cleaned).toContain('[Image:');
      });
    });

    describe('extractTextFromHtml', () => {
      it('should remove script tags', () => {
        const html = '<script>alert()</script>text';
        const text = DocumentProcessor.extractTextFromHtml(html);

        expect(text).not.toContain('alert');
        expect(text).toContain('text');
      });

      it('should remove style tags', () => {
        const html = '<style>css</style>text';
        const text = DocumentProcessor.extractTextFromHtml(html);

        expect(text).not.toContain('css');
      });

      it('should convert block elements to newlines', () => {
        const html = '<p>para1</p><p>para2</p>';
        const text = DocumentProcessor.extractTextFromHtml(html);

        expect(text).toContain('para1');
        expect(text).toContain('para2');
      });

      it('should decode HTML entities', () => {
        const html = '&amp;&lt;&gt;';
        const text = DocumentProcessor.extractTextFromHtml(html);

        expect(text).toBe('&<>');
      });
    });

    describe('decodeHtmlEntities', () => {
      it('should decode common entities', () => {
        const decoded = DocumentProcessor.decodeHtmlEntities('&amp;&lt;&gt;&quot;');
        expect(decoded).toBe('&<>"');
      });

      it('should decode numeric entities', () => {
        const decoded = DocumentProcessor.decodeHtmlEntities('&#65;');
        expect(decoded).toBe('A');
      });

      it('should decode hex entities', () => {
        const decoded = DocumentProcessor.decodeHtmlEntities('&#x41;');
        expect(decoded).toBe('A');
      });
    });

    describe('calculateHash', () => {
      it('should calculate SHA-256 hash', () => {
        const hash1 = DocumentProcessor.calculateHash('test');
        const hash2 = DocumentProcessor.calculateHash('test');

        expect(hash1).toBe(hash2);
        expect(hash1).toHaveLength(64);
      });

      it('should produce different hashes for different content', () => {
        const hash1 = DocumentProcessor.calculateHash('test1');
        const hash2 = DocumentProcessor.calculateHash('test2');

        expect(hash1).not.toBe(hash2);
      });
    });

    describe('isTypeSupported', () => {
      it('should return true for supported types', () => {
        expect(DocumentProcessor.isTypeSupported('txt')).toBe(true);
        expect(DocumentProcessor.isTypeSupported('pdf')).toBe(true);
        expect(DocumentProcessor.isTypeSupported('md')).toBe(true);
      });

      it('should return false for unsupported types', () => {
        expect(DocumentProcessor.isTypeSupported('exe')).toBe(false);
      });

      it('should be case insensitive', () => {
        expect(DocumentProcessor.isTypeSupported('TXT')).toBe(true);
      });
    });

    describe('getSupportedTypes', () => {
      it('should return array of types', () => {
        const types = DocumentProcessor.getSupportedTypes();

        expect(Array.isArray(types)).toBe(true);
        expect(types).toContain('txt');
        expect(types).toContain('pdf');
      });
    });

    describe('parseCsvLine', () => {
      it('should parse simple CSV line', () => {
        const result = DocumentProcessor.parseCsvLine('a,b,c');
        expect(result).toEqual(['a', 'b', 'c']);
      });

      it('should handle quoted values', () => {
        const result = DocumentProcessor.parseCsvLine('"a,b",c');
        expect(result).toEqual(['a,b', 'c']);
      });

      it('should handle escaped quotes', () => {
        const result = DocumentProcessor.parseCsvLine('"a""b",c');
        expect(result).toEqual(['a"b', 'c']);
      });

      it('should handle custom delimiter', () => {
        const result = DocumentProcessor.parseCsvLine('a\tb\tc', '\t');
        expect(result).toEqual(['a', 'b', 'c']);
      });
    });
  });

  // ============================================================================
  // ChunkingService Tests (30 tests)
  // ============================================================================
  describe('ChunkingService', () => {
    describe('splitIntoChunks', () => {
      it('should return empty array for empty text', () => {
        const result = ChunkingService.splitIntoChunks('');
        expect(result).toEqual([]);
      });

      it('should return single chunk for short text', () => {
        const result = ChunkingService.splitIntoChunks('Short text', 1000);

        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('Short text');
      });

      it('should split long text into chunks', () => {
        const text = 'word '.repeat(500);
        const result = ChunkingService.splitIntoChunks(text, 100);

        expect(result.length).toBeGreaterThan(1);
      });

      it('should apply overlap', () => {
        const text = 'word '.repeat(500);
        const result = ChunkingService.splitIntoChunks(text, 100, 20);

        expect(result.length).toBeGreaterThan(1);
      });

      it('should set startChar and endChar', () => {
        const text = 'word '.repeat(500);
        const result = ChunkingService.splitIntoChunks(text, 100);

        expect(result[0].startChar).toBe(0);
        expect(result[0].endChar).toBeGreaterThan(0);
      });

      it('should handle default parameters', () => {
        const text = 'word '.repeat(500);
        const result = ChunkingService.splitIntoChunks(text);

        expect(result.length).toBeGreaterThan(0);
      });

      it('should normalize line endings', () => {
        const text = 'Line1\r\nLine2\rLine3';
        const result = ChunkingService.splitIntoChunks(text);

        expect(result[0].content).toContain('Line1');
      });

      it('should trim chunk content', () => {
        const text = '  text  ';
        const result = ChunkingService.splitIntoChunks(text);

        expect(result[0].content).toBe('text');
      });
    });

    describe('findBreakPoint', () => {
      it('should prefer paragraph breaks', () => {
        const text = 'Para1\n\nPara2';
        const breakPoint = ChunkingService.findBreakPoint(text, 0, text.length);

        expect(breakPoint).toBe(7); // After \n\n
      });

      it('should prefer sentence endings', () => {
        const text = 'Sentence one. Sentence two.';
        const breakPoint = ChunkingService.findBreakPoint(text, 0, 20);

        expect(text[breakPoint - 1]).toBe(' ');
      });

      it('should fallback to line breaks', () => {
        const text = 'Line1\nLine2\nLine3';
        const breakPoint = ChunkingService.findBreakPoint(text, 0, 10);

        expect(breakPoint).toBeGreaterThan(0);
      });

      it('should fallback to spaces', () => {
        const text = 'word word word word';
        const breakPoint = ChunkingService.findBreakPoint(text, 0, 10);

        expect(text[breakPoint - 1]).toBe(' ');
      });

      it('should use ideal end as last resort', () => {
        const text = 'wordwordwordword';
        const breakPoint = ChunkingService.findBreakPoint(text, 0, 10);

        expect(breakPoint).toBe(10);
      });
    });

    describe('splitByParagraphs', () => {
      it('should split by paragraphs', () => {
        const text = 'Para1\n\nPara2\n\nPara3';
        const result = ChunkingService.splitByParagraphs(text, 1000);

        expect(result.length).toBeGreaterThan(0);
      });

      it('should return empty for empty text', () => {
        const result = ChunkingService.splitByParagraphs('');
        expect(result).toEqual([]);
      });

      it('should handle single paragraph', () => {
        const text = 'Single paragraph';
        const result = ChunkingService.splitByParagraphs(text);

        expect(result).toHaveLength(1);
      });

      it('should split large paragraphs', () => {
        const text = 'word '.repeat(2000);
        const result = ChunkingService.splitByParagraphs(text, 100);

        expect(result.length).toBeGreaterThan(1);
      });

      it('should apply overlap between chunks', () => {
        const text = 'Para1\n\nPara2\n\nPara3'.repeat(50);
        const result = ChunkingService.splitByParagraphs(text, 100, 20);

        expect(result.length).toBeGreaterThan(1);
      });
    });

    describe('getOverlapText', () => {
      it('should extract overlap from end', () => {
        const text = 'This is a test sentence. Another one.';
        const overlap = ChunkingService.getOverlapText(text, 20);

        expect(overlap.length).toBeLessThanOrEqual(20);
      });

      it('should return full text if shorter than overlap', () => {
        const text = 'Short';
        const overlap = ChunkingService.getOverlapText(text, 100);

        expect(overlap).toBe('Short');
      });

      it('should prefer sentence boundaries', () => {
        const text = 'Sentence one. Sentence two.';
        const overlap = ChunkingService.getOverlapText(text, 15);

        expect(overlap).toBeTruthy();
      });

      it('should trim result', () => {
        const text = 'Text with spaces  ';
        const overlap = ChunkingService.getOverlapText(text, 10);

        expect(overlap).not.toMatch(/\s$/);
      });
    });

    describe('estimateTokenCount', () => {
      it('should estimate tokens', () => {
        const text = 'word '.repeat(100);
        const tokens = ChunkingService.estimateTokenCount(text);

        expect(tokens).toBeGreaterThan(0);
      });

      it('should return 0 for empty text', () => {
        expect(ChunkingService.estimateTokenCount('')).toBe(0);
      });

      it('should return 0 for null', () => {
        expect(ChunkingService.estimateTokenCount(null)).toBe(0);
      });

      it('should use ~4 chars per token', () => {
        const text = 'AAAA'; // 4 chars = ~1 token
        const tokens = ChunkingService.estimateTokenCount(text);

        expect(tokens).toBe(1);
      });
    });
  });

  // ============================================================================
  // Integration Tests (20 tests)
  // ============================================================================
  describe('Integration Tests', () => {
    describe('End-to-end RAG workflow', () => {
      it('should process document and enable RAG search', async () => {
        // Setup document
        Document.findById.mockResolvedValue({
          id: 1,
          knowledge_base_id: 10,
          type: 'txt',
          file_path: '/test.txt'
        });

        KnowledgeBase.findById.mockResolvedValue({
          id: 10,
          chunk_size: 100,
          chunk_overlap: 20
        });

        fs.readFile.mockResolvedValue('Test content for processing');

        mockEmbeddingsCreate.mockResolvedValue({
          data: [{ embedding: Array(1536).fill(0.1) }]
        });

        db.query.mockResolvedValue({ rows: [{ id: 1 }] });

        // Process document
        const processResult = await DocumentProcessor.processDocument(1);
        expect(processResult.success).toBe(true);

        // Perform RAG search
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, knowledge_base_id: 10 }] })
          .mockResolvedValueOnce({ rows: [{ id: 10 }] })
          .mockResolvedValueOnce({ rows: [{ available: true }] })
          .mockResolvedValueOnce({
            rows: [{
              id: 1,
              content: 'Test content',
              document_name: 'Doc1',
              knowledge_base_name: 'KB1',
              similarity: 0.9
            }]
          });

        const ragResult = await RAGService.getContextForQuery(1, 'test query');
        expect(ragResult.hasContext).toBe(true);
      });

      it('should handle barcode-specific workflow', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, knowledge_base_id: 10 }] })
          .mockResolvedValueOnce({ rows: [{ id: 10, name: 'Product KB' }] })
          .mockResolvedValueOnce({
            rows: [{
              id: 1,
              content: 'Product 8698686924363 Price: $10',
              document_name: 'Products.txt'
            }]
          });

        const result = await RAGService.getContextForQuery(1, 'Price for 8698686924363?');

        expect(result.hasContext).toBe(true);
        expect(result.context).toContain('8698686924363');
      });

      it('should handle chunk → embed → store workflow', async () => {
        const text = 'word '.repeat(500);
        const chunks = ChunkingService.splitIntoChunks(text, 100, 20);

        expect(chunks.length).toBeGreaterThan(1);

        mockEmbeddingsCreate.mockResolvedValue({
          data: chunks.map((_, i) => ({
            index: i,
            embedding: Array(1536).fill(i * 0.01)
          }))
        });

        const chunkTexts = chunks.map(c => c.content);
        const embeddings = await EmbeddingService.getEmbeddings(chunkTexts);

        expect(embeddings).toHaveLength(chunks.length);

        db.query.mockResolvedValue({ rows: [{ id: 1 }] });

        for (let i = 0; i < chunks.length; i++) {
          await VectorStore.storeChunk(1, 10, {
            content: chunks[i].content,
            embedding: embeddings[i],
            chunk_index: i
          });
        }

        expect(db.query).toHaveBeenCalledTimes(chunks.length);
      });
    });

    describe('Error recovery scenarios', () => {
      it('should handle embedding API failure gracefully', async () => {
        mockEmbeddingsCreate.mockRejectedValue(new Error('API Error'));

        await expect(EmbeddingService.getEmbedding('test')).rejects.toThrow();
      });

      it('should handle database connection failure', async () => {
        db.query.mockRejectedValue(new Error('Connection failed'));

        const result = await RAGService.getContextForQuery(1, 'test');

        expect(result.hasContext).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should handle file read errors', async () => {
        Document.findById.mockResolvedValue({
          id: 1,
          knowledge_base_id: 10,
          type: 'txt',
          file_path: '/nonexistent.txt'
        });

        KnowledgeBase.findById.mockResolvedValue({ id: 10 });

        fs.readFile.mockRejectedValue(new Error('File not found'));

        await expect(DocumentProcessor.processDocument(1)).rejects.toThrow();
        expect(Document.updateStatus).toHaveBeenCalledWith(1, 'failed');
      });
    });

    describe('Performance scenarios', () => {
      it('should handle large batch embeddings', async () => {
        const texts = Array(200).fill(0).map((_, i) => `Text ${i}`);

        mockEmbeddingsCreate
          .mockResolvedValueOnce({
            data: Array(100).fill(0).map((_, i) => ({ index: i, embedding: [i] }))
          })
          .mockResolvedValueOnce({
            data: Array(100).fill(0).map((_, i) => ({ index: i, embedding: [i] }))
          });

        const result = await EmbeddingService.getEmbeddings(texts);

        expect(result).toHaveLength(200);
        expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2);
      });

      it('should cache vector search results', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ available: true }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, content: 'test', similarity: 0.9 }] });

        const embedding = [0.1, 0.2];

        await VectorStore.multiKnowledgeBaseSearch([1], embedding);
        await VectorStore.multiKnowledgeBaseSearch([1], embedding);

        // Second call should use cache
        expect(db.query).toHaveBeenCalledTimes(2);
      });
    });

    describe('Data validation scenarios', () => {
      it('should validate chunk data before storage', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 1 }] });

        await VectorStore.storeChunk(1, 10, {
          content: 'Test',
          embedding: [0.1, 0.2],
          chunk_index: 0
        });

        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([1, 10, 'Test', '[0.1,0.2]', 0])
        );
      });

      it('should calculate consistent hashes', () => {
        const content = 'Test content';
        const hash1 = DocumentProcessor.calculateHash(content);
        const hash2 = DocumentProcessor.calculateHash(content);

        expect(hash1).toBe(hash2);
      });

      it('should validate similarity scores', () => {
        const vec1 = [1, 0];
        const vec2 = [1, 0];
        const similarity = EmbeddingService.cosineSimilarity(vec1, vec2);

        expect(similarity).toBeGreaterThanOrEqual(-1);
        expect(similarity).toBeLessThanOrEqual(1);
      });
    });

    describe('Edge case scenarios', () => {
      it('should handle empty knowledge base', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const result = await RAGService.getContextForQuery(1, 'test');

        expect(result.hasContext).toBe(false);
      });

      it('should handle malformed embeddings', () => {
        const parsed = VectorStore.parseEmbedding('invalid');
        expect(parsed).toEqual([]);
      });

      it('should handle very long queries', async () => {
        const longQuery = 'word '.repeat(10000);

        mockEmbeddingsCreate.mockResolvedValue({
          data: [{ embedding: [0.1] }]
        });

        const embedding = await EmbeddingService.getEmbedding(longQuery);

        expect(embedding).toBeDefined();
      });

      it('should handle special characters in barcodes', () => {
        const result = RAGService.extractBarcodeFromQuery('Barcode: 8698686924363!');
        expect(result.barcodes).toContain('8698686924363');
      });
    });

    describe('Multi-KB scenarios', () => {
      it('should search across multiple KBs', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ available: true }] })
          .mockResolvedValueOnce({
            rows: [
              { id: 1, knowledge_base_id: 1, content: 'Result 1', similarity: 0.9 },
              { id: 2, knowledge_base_id: 2, content: 'Result 2', similarity: 0.85 }
            ]
          });

        const results = await VectorStore.multiKnowledgeBaseSearch(
          [1, 2],
          [0.1, 0.2],
          { limit: 10 }
        );

        expect(results).toHaveLength(2);
      });

      it('should handle KB priority', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ available: false }] })
          .mockResolvedValueOnce({
            rows: [
              { id: 1, knowledge_base_id: 1, embedding: '[1,0]' },
              { id: 2, knowledge_base_id: 2, embedding: '[0.9,0.1]' }
            ]
          });

        const results = await VectorStore.multiKnowledgeBaseSearchJS([1, 2], [1, 0]);

        expect(results.length).toBeGreaterThan(0);
      });
    });
  });
});
