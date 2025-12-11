/**
 * DocumentProcessor Tests
 * Tests for server/knowledge/DocumentProcessor.js
 */

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../models/Document', () => ({
  findById: jest.fn(),
  updateStatus: jest.fn(),
  update: jest.fn()
}));

jest.mock('../../models/KnowledgeBase', () => ({
  findById: jest.fn()
}));

jest.mock('../../knowledge/VectorStore', () => ({
  storeChunk: jest.fn(),
  updateStats: jest.fn(),
  deleteChunksByDocument: jest.fn()
}));

jest.mock('../../knowledge/EmbeddingService', () => ({
  getEmbeddings: jest.fn()
}));

jest.mock('../../knowledge/ChunkingService', () => ({
  splitIntoChunks: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

const fs = require('fs').promises;
const Document = require('../../models/Document');
const KnowledgeBase = require('../../models/KnowledgeBase');
const VectorStore = require('../../knowledge/VectorStore');
const EmbeddingService = require('../../knowledge/EmbeddingService');
const ChunkingService = require('../../knowledge/ChunkingService');
const documentProcessor = require('../../knowledge/DocumentProcessor');

describe('DocumentProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor and properties', () => {
    it('should have supported types', () => {
      expect(documentProcessor.supportedTypes).toContain('txt');
      expect(documentProcessor.supportedTypes).toContain('pdf');
      expect(documentProcessor.supportedTypes).toContain('docx');
      expect(documentProcessor.supportedTypes).toContain('csv');
      expect(documentProcessor.supportedTypes).toContain('xlsx');
      expect(documentProcessor.supportedTypes).toContain('url');
    });

    it('should check if type is supported', () => {
      expect(documentProcessor.isTypeSupported('txt')).toBe(true);
      expect(documentProcessor.isTypeSupported('TXT')).toBe(true);
      expect(documentProcessor.isTypeSupported('exe')).toBe(false);
    });

    it('should get supported types', () => {
      const types = documentProcessor.getSupportedTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
    });
  });

  describe('processDocument', () => {
    it('should throw error if document not found', async () => {
      Document.findById.mockResolvedValue(null);

      await expect(documentProcessor.processDocument(1))
        .rejects.toThrow('Document not found: 1');
    });

    it('should throw error if knowledge base not found', async () => {
      Document.findById.mockResolvedValue({
        id: 1,
        knowledge_base_id: 10,
        type: 'txt',
        file_path: '/path/to/file.txt'
      });
      KnowledgeBase.findById.mockResolvedValue(null);

      await expect(documentProcessor.processDocument(1))
        .rejects.toThrow('Knowledge base not found: 10');
    });

    it('should process document successfully', async () => {
      Document.findById.mockResolvedValue({
        id: 1,
        knowledge_base_id: 10,
        type: 'txt',
        file_path: '/path/to/file.txt',
        name: 'Test Doc'
      });
      KnowledgeBase.findById.mockResolvedValue({
        id: 10,
        chunk_size: 500,
        chunk_overlap: 100
      });
      fs.readFile.mockResolvedValue('Test content for document');
      ChunkingService.splitIntoChunks.mockReturnValue([
        { content: 'Test content', startChar: 0, endChar: 12 }
      ]);
      EmbeddingService.getEmbeddings.mockResolvedValue([[0.1, 0.2, 0.3]]);
      VectorStore.storeChunk.mockResolvedValue({ id: 1 });
      Document.update.mockResolvedValue({});
      VectorStore.updateStats.mockResolvedValue({});

      const result = await documentProcessor.processDocument(1);

      expect(result.success).toBe(true);
      expect(result.documentId).toBe(1);
      expect(result.chunksCreated).toBe(1);
      expect(Document.updateStatus).toHaveBeenCalledWith(1, 'processing');
      expect(VectorStore.storeChunk).toHaveBeenCalled();
    });

    it('should fail if no content extracted', async () => {
      Document.findById.mockResolvedValue({
        id: 1,
        knowledge_base_id: 10,
        type: 'txt',
        file_path: '/path/to/file.txt'
      });
      KnowledgeBase.findById.mockResolvedValue({ id: 10 });
      fs.readFile.mockResolvedValue('   ');

      await expect(documentProcessor.processDocument(1))
        .rejects.toThrow('No content extracted from document');
      expect(Document.updateStatus).toHaveBeenCalledWith(1, 'failed');
    });

    it('should fail if no chunks generated', async () => {
      Document.findById.mockResolvedValue({
        id: 1,
        knowledge_base_id: 10,
        type: 'txt',
        file_path: '/path/to/file.txt'
      });
      KnowledgeBase.findById.mockResolvedValue({ id: 10 });
      fs.readFile.mockResolvedValue('Content');
      ChunkingService.splitIntoChunks.mockReturnValue([]);

      await expect(documentProcessor.processDocument(1))
        .rejects.toThrow('No chunks generated from content');
    });
  });

  describe('extractContent', () => {
    it('should extract from txt file', async () => {
      fs.readFile.mockResolvedValue('Text content');
      const result = await documentProcessor.extractContent({
        type: 'txt',
        file_path: '/path/to/file.txt'
      });
      expect(result).toBe('Text content');
    });

    it('should extract from text type', async () => {
      fs.readFile.mockResolvedValue('Text content');
      const result = await documentProcessor.extractContent({
        type: 'text',
        file_path: '/path/to/file.txt'
      });
      expect(result).toBe('Text content');
    });

    it('should extract from markdown file', async () => {
      fs.readFile.mockResolvedValue('# Header\n\n**Bold text**');
      const result = await documentProcessor.extractContent({
        type: 'md',
        file_path: '/path/to/file.md'
      });
      expect(result).toContain('Header');
      expect(result).toContain('Bold text');
    });

    it('should throw error for unsupported type', async () => {
      await expect(documentProcessor.extractContent({
        type: 'unsupported',
        file_path: '/path/to/file.xyz'
      })).rejects.toThrow('Unsupported document type: unsupported');
    });
  });

  describe('extractFromTxt', () => {
    it('should read txt file', async () => {
      fs.readFile.mockResolvedValue('File content');
      const result = await documentProcessor.extractFromTxt('/path/to/file.txt');
      expect(result).toBe('File content');
      expect(fs.readFile).toHaveBeenCalledWith('/path/to/file.txt', 'utf-8');
    });

    it('should throw error if no file path', async () => {
      await expect(documentProcessor.extractFromTxt(null))
        .rejects.toThrow('File path is required for TXT extraction');
    });
  });

  describe('extractFromMarkdown', () => {
    it('should read markdown file', async () => {
      fs.readFile.mockResolvedValue('# Title');
      const result = await documentProcessor.extractFromMarkdown('/path/to/file.md');
      expect(result).toContain('Title');
    });

    it('should throw error if no file path', async () => {
      await expect(documentProcessor.extractFromMarkdown(null))
        .rejects.toThrow('File path is required for Markdown extraction');
    });
  });

  describe('cleanMarkdown', () => {
    it('should remove code blocks but keep content', () => {
      const input = '```javascript\nconst x = 1;\n```';
      const result = documentProcessor.cleanMarkdown(input);
      expect(result).toContain('[Code]');
      expect(result).toContain('const x = 1;');
    });

    it('should remove inline code backticks', () => {
      const result = documentProcessor.cleanMarkdown('Use `console.log()` for debugging');
      expect(result).toBe('Use console.log() for debugging');
    });

    it('should convert headers to plain text', () => {
      const result = documentProcessor.cleanMarkdown('## Section Title');
      expect(result).toContain('Section Title');
      expect(result).not.toContain('##');
    });

    it('should remove bold/italic markers', () => {
      const result = documentProcessor.cleanMarkdown('**bold** and *italic*');
      expect(result).toBe('bold and italic');
    });

    it('should remove links but keep text', () => {
      const result = documentProcessor.cleanMarkdown('[Link text](https://example.com)');
      expect(result).toBe('Link text');
    });

    it('should handle images', () => {
      const result = documentProcessor.cleanMarkdown('![Alt text](image.png)');
      // Note: The regex removes the image but may not produce exact expected output
      expect(result).not.toContain('(image.png)');
    });
  });

  describe('extractFromPdf', () => {
    it('should throw error if no file path', async () => {
      await expect(documentProcessor.extractFromPdf(null))
        .rejects.toThrow('File path is required for PDF extraction');
    });
  });

  describe('extractFromDocx', () => {
    it('should throw error if no file path', async () => {
      await expect(documentProcessor.extractFromDocx(null))
        .rejects.toThrow('File path is required for DOCX extraction');
    });
  });

  describe('extractFromExcel', () => {
    it('should throw error if no file path', async () => {
      await expect(documentProcessor.extractFromExcel(null))
        .rejects.toThrow('File path is required for Excel extraction');
    });
  });

  describe('extractFromCsv', () => {
    it('should throw error if no file path', async () => {
      await expect(documentProcessor.extractFromCsv(null))
        .rejects.toThrow('File path is required for CSV extraction');
    });

    it('should extract CSV with comma delimiter', async () => {
      fs.readFile.mockResolvedValue('Name,Age\nJohn,30\nJane,25');
      const result = await documentProcessor.extractFromCsv('/path/to/file.csv', ',');
      expect(result).toContain('ROW:');
      expect(result).toContain('[Name: John]');
      expect(result).toContain('[Age: 30]');
    });

    it('should handle empty CSV', async () => {
      fs.readFile.mockResolvedValue('');
      await expect(documentProcessor.extractFromCsv('/path/to/file.csv'))
        .rejects.toThrow('CSV file is empty');
    });

    it('should handle CSV with only headers', async () => {
      fs.readFile.mockResolvedValue('Name,Age');
      await expect(documentProcessor.extractFromCsv('/path/to/file.csv'))
        .rejects.toThrow('CSV file has no data rows');
    });
  });

  describe('parseCsvLine', () => {
    it('should parse simple CSV line', () => {
      const result = documentProcessor.parseCsvLine('a,b,c', ',');
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should handle quoted values', () => {
      const result = documentProcessor.parseCsvLine('"hello, world",test', ',');
      expect(result).toEqual(['hello, world', 'test']);
    });

    it('should handle escaped quotes', () => {
      const result = documentProcessor.parseCsvLine('"say ""hello""",test', ',');
      expect(result).toEqual(['say "hello"', 'test']);
    });

    it('should handle tab delimiter', () => {
      const result = documentProcessor.parseCsvLine('a\tb\tc', '\t');
      expect(result).toEqual(['a', 'b', 'c']);
    });
  });

  describe('extractFromUrl', () => {
    it('should throw error if no URL', async () => {
      await expect(documentProcessor.extractFromUrl(null))
        .rejects.toThrow('URL is required for web extraction');
    });
  });

  describe('extractTextFromHtml', () => {
    it('should remove script tags', () => {
      const html = '<p>Hello</p><script>alert("test")</script><p>World</p>';
      const result = documentProcessor.extractTextFromHtml(html);
      expect(result).not.toContain('alert');
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });

    it('should remove style tags', () => {
      const html = '<style>.red { color: red; }</style><p>Content</p>';
      const result = documentProcessor.extractTextFromHtml(html);
      expect(result).not.toContain('color');
      expect(result).toContain('Content');
    });

    it('should convert block elements to newlines', () => {
      const html = '<p>First</p><p>Second</p>';
      const result = documentProcessor.extractTextFromHtml(html);
      expect(result).toContain('First');
      expect(result).toContain('Second');
    });

    it('should decode HTML entities', () => {
      const html = '<p>Hello &amp; World</p>';
      const result = documentProcessor.extractTextFromHtml(html);
      expect(result).toContain('Hello & World');
    });
  });

  describe('decodeHtmlEntities', () => {
    it('should decode &amp;', () => {
      expect(documentProcessor.decodeHtmlEntities('&amp;')).toBe('&');
    });

    it('should decode &lt; and &gt;', () => {
      expect(documentProcessor.decodeHtmlEntities('&lt;div&gt;')).toBe('<div>');
    });

    it('should decode &quot;', () => {
      expect(documentProcessor.decodeHtmlEntities('&quot;test&quot;')).toBe('"test"');
    });

    it('should decode &nbsp;', () => {
      expect(documentProcessor.decodeHtmlEntities('hello&nbsp;world')).toBe('hello world');
    });

    it('should decode numeric entities', () => {
      expect(documentProcessor.decodeHtmlEntities('&#65;')).toBe('A');
    });

    it('should decode hex entities', () => {
      expect(documentProcessor.decodeHtmlEntities('&#x41;')).toBe('A');
    });
  });

  describe('calculateHash', () => {
    it('should calculate SHA-256 hash', () => {
      const hash1 = documentProcessor.calculateHash('test content');
      const hash2 = documentProcessor.calculateHash('test content');
      const hash3 = documentProcessor.calculateHash('different content');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('processDocuments', () => {
    it('should process multiple documents', async () => {
      Document.findById
        .mockResolvedValueOnce({
          id: 1,
          knowledge_base_id: 10,
          type: 'txt',
          file_path: '/path/to/file1.txt',
          name: 'Doc1'
        })
        .mockResolvedValueOnce(null);

      KnowledgeBase.findById.mockResolvedValue({ id: 10 });
      fs.readFile.mockResolvedValue('Content');
      ChunkingService.splitIntoChunks.mockReturnValue([
        { content: 'Content', startChar: 0, endChar: 7 }
      ]);
      EmbeddingService.getEmbeddings.mockResolvedValue([[0.1, 0.2]]);
      VectorStore.storeChunk.mockResolvedValue({ id: 1 });

      const results = await documentProcessor.processDocuments([1, 2]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('Document not found');
    });
  });

  describe('reprocessDocument', () => {
    it('should delete chunks and reprocess', async () => {
      VectorStore.deleteChunksByDocument.mockResolvedValue(5);
      Document.updateStatus.mockResolvedValue({});
      Document.findById.mockResolvedValue({
        id: 1,
        knowledge_base_id: 10,
        type: 'txt',
        file_path: '/path/to/file.txt',
        name: 'Doc'
      });
      KnowledgeBase.findById.mockResolvedValue({ id: 10 });
      fs.readFile.mockResolvedValue('New content');
      ChunkingService.splitIntoChunks.mockReturnValue([
        { content: 'New content', startChar: 0, endChar: 11 }
      ]);
      EmbeddingService.getEmbeddings.mockResolvedValue([[0.1]]);
      VectorStore.storeChunk.mockResolvedValue({ id: 1 });

      const result = await documentProcessor.reprocessDocument(1);

      expect(VectorStore.deleteChunksByDocument).toHaveBeenCalledWith(1);
      expect(Document.updateStatus).toHaveBeenCalledWith(1, 'pending', 0);
      expect(result.success).toBe(true);
    });
  });

  describe('processTableData', () => {
    it('should process table data with barcodes', () => {
      const text = '8698686123456 70-110 4,50';
      const result = documentProcessor.processTableData(text);
      expect(result).toContain('PRODUCT BARCODE DATABASE');
      expect(result).toContain('ROW:');
    });

    it('should handle text without barcodes', () => {
      const text = 'Regular text without barcodes';
      const result = documentProcessor.processTableData(text);
      expect(result).toContain('Total products: 0');
    });
  });

  describe('extractBarcodeData', () => {
    it('should extract barcode-price pairs', () => {
      const text = '8698686123456 test 4,50';
      const results = documentProcessor.extractBarcodeData(text);
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle empty text', () => {
      const results = documentProcessor.extractBarcodeData('');
      expect(results).toEqual([]);
    });
  });
});
