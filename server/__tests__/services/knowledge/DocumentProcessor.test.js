/**
 * DocumentProcessor Comprehensive Tests
 * Tests for server/knowledge/DocumentProcessor.js
 *
 * Tests cover:
 * - All public methods
 * - Error handling
 * - Edge cases
 * - Different file types (txt, md, pdf, docx, csv, xlsx, url)
 * - Content extraction and processing
 */

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));

jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../models/Document', () => ({
  findById: jest.fn(),
  updateStatus: jest.fn(),
  update: jest.fn()
}));

jest.mock('../../../models/KnowledgeBase', () => ({
  findById: jest.fn()
}));

jest.mock('../../../knowledge/VectorStore', () => ({
  storeChunk: jest.fn(),
  updateStats: jest.fn(),
  deleteChunksByDocument: jest.fn()
}));

jest.mock('../../../knowledge/EmbeddingService', () => ({
  getEmbeddings: jest.fn()
}));

jest.mock('../../../knowledge/ChunkingService', () => ({
  splitIntoChunks: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

const fs = require('fs').promises;
const Document = require('../../../models/Document');
const KnowledgeBase = require('../../../models/KnowledgeBase');
const VectorStore = require('../../../knowledge/VectorStore');
const EmbeddingService = require('../../../knowledge/EmbeddingService');
const ChunkingService = require('../../../knowledge/ChunkingService');
const log = require('../../../utils/logger');
const documentProcessor = require('../../../knowledge/DocumentProcessor');

describe('DocumentProcessor - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor and properties', () => {
    it('should have all supported types', () => {
      expect(documentProcessor.supportedTypes).toContain('txt');
      expect(documentProcessor.supportedTypes).toContain('md');
      expect(documentProcessor.supportedTypes).toContain('pdf');
      expect(documentProcessor.supportedTypes).toContain('docx');
      expect(documentProcessor.supportedTypes).toContain('doc');
      expect(documentProcessor.supportedTypes).toContain('csv');
      expect(documentProcessor.supportedTypes).toContain('tsv');
      expect(documentProcessor.supportedTypes).toContain('xlsx');
      expect(documentProcessor.supportedTypes).toContain('xls');
      expect(documentProcessor.supportedTypes).toContain('url');
    });

    it('should check if type is supported', () => {
      expect(documentProcessor.isTypeSupported('txt')).toBe(true);
      expect(documentProcessor.isTypeSupported('TXT')).toBe(true);
      expect(documentProcessor.isTypeSupported('PDF')).toBe(true);
      expect(documentProcessor.isTypeSupported('exe')).toBe(false);
      expect(documentProcessor.isTypeSupported('zip')).toBe(false);
    });

    it('should get supported types', () => {
      const types = documentProcessor.getSupportedTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
      expect(types).toEqual(documentProcessor.supportedTypes);
    });

    it('should return a copy of supported types', () => {
      const types = documentProcessor.getSupportedTypes();
      types.push('new-type');
      expect(documentProcessor.supportedTypes).not.toContain('new-type');
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
      expect(Document.updateStatus).toHaveBeenCalledWith(1, 'failed');
    });

    it('should use knowledge base chunk settings', async () => {
      Document.findById.mockResolvedValue({
        id: 1,
        knowledge_base_id: 10,
        type: 'txt',
        file_path: '/path/to/file.txt',
        name: 'Doc'
      });
      KnowledgeBase.findById.mockResolvedValue({
        id: 10,
        chunk_size: 800,
        chunk_overlap: 150
      });
      fs.readFile.mockResolvedValue('Content');
      ChunkingService.splitIntoChunks.mockReturnValue([
        { content: 'Chunk', startChar: 0, endChar: 5 }
      ]);
      EmbeddingService.getEmbeddings.mockResolvedValue([[0.1]]);
      VectorStore.storeChunk.mockResolvedValue({ id: 1 });

      await documentProcessor.processDocument(1);

      expect(ChunkingService.splitIntoChunks).toHaveBeenCalledWith(
        'Content',
        800,
        150
      );
    });

    it('should calculate content hash', async () => {
      Document.findById.mockResolvedValue({
        id: 1,
        knowledge_base_id: 10,
        type: 'txt',
        file_path: '/path/to/file.txt',
        name: 'Doc'
      });
      KnowledgeBase.findById.mockResolvedValue({ id: 10 });
      fs.readFile.mockResolvedValue('Content');
      ChunkingService.splitIntoChunks.mockReturnValue([
        { content: 'Chunk', startChar: 0, endChar: 5 }
      ]);
      EmbeddingService.getEmbeddings.mockResolvedValue([[0.1]]);
      VectorStore.storeChunk.mockResolvedValue({ id: 1 });

      const result = await documentProcessor.processDocument(1);

      expect(result.contentHash).toBeDefined();
      expect(typeof result.contentHash).toBe('string');
      expect(result.contentHash.length).toBe(64);
    });

    it('should store metadata with chunks', async () => {
      Document.findById.mockResolvedValue({
        id: 1,
        knowledge_base_id: 10,
        type: 'txt',
        file_path: '/path/to/file.txt',
        name: 'Test Document'
      });
      KnowledgeBase.findById.mockResolvedValue({ id: 10 });
      fs.readFile.mockResolvedValue('Content');
      ChunkingService.splitIntoChunks.mockReturnValue([
        { content: 'Chunk', startChar: 0, endChar: 5 }
      ]);
      EmbeddingService.getEmbeddings.mockResolvedValue([[0.1]]);
      VectorStore.storeChunk.mockResolvedValue({ id: 1 });

      await documentProcessor.processDocument(1);

      expect(VectorStore.storeChunk).toHaveBeenCalledWith(
        1,
        10,
        expect.objectContaining({
          metadata: expect.objectContaining({
            document_name: 'Test Document',
            document_type: 'txt'
          })
        })
      );
    });

    it('should update knowledge base stats', async () => {
      Document.findById.mockResolvedValue({
        id: 1,
        knowledge_base_id: 10,
        type: 'txt',
        file_path: '/path/to/file.txt',
        name: 'Doc'
      });
      KnowledgeBase.findById.mockResolvedValue({ id: 10 });
      fs.readFile.mockResolvedValue('Content');
      ChunkingService.splitIntoChunks.mockReturnValue([
        { content: 'Chunk', startChar: 0, endChar: 5 }
      ]);
      EmbeddingService.getEmbeddings.mockResolvedValue([[0.1]]);
      VectorStore.storeChunk.mockResolvedValue({ id: 1 });

      await documentProcessor.processDocument(1);

      expect(VectorStore.updateStats).toHaveBeenCalledWith(10);
    });

    it('should handle processing errors', async () => {
      Document.findById.mockResolvedValue({
        id: 1,
        knowledge_base_id: 10,
        type: 'txt',
        file_path: '/path/to/file.txt'
      });
      KnowledgeBase.findById.mockResolvedValue({ id: 10 });
      fs.readFile.mockRejectedValue(new Error('File read error'));

      await expect(documentProcessor.processDocument(1))
        .rejects.toThrow('File read error');
      expect(Document.updateStatus).toHaveBeenCalledWith(1, 'failed');
      expect(log.error).toHaveBeenCalled();
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

    it('should extract from markdown type', async () => {
      fs.readFile.mockResolvedValue('# Title');
      const result = await documentProcessor.extractContent({
        type: 'markdown',
        file_path: '/path/to/file.md'
      });
      expect(result).toContain('Title');
    });

    it('should handle case-insensitive type', async () => {
      fs.readFile.mockResolvedValue('Content');
      const result = await documentProcessor.extractContent({
        type: 'TXT',
        file_path: '/path/to/file.txt'
      });
      expect(result).toBe('Content');
    });

    it('should throw error for unsupported type', async () => {
      await expect(documentProcessor.extractContent({
        type: 'unsupported',
        file_path: '/path/to/file.xyz'
      })).rejects.toThrow('Unsupported document type: unsupported');
    });

    it('should route pdf type correctly', async () => {
      const extractFromPdfSpy = jest.spyOn(documentProcessor, 'extractFromPdf')
        .mockResolvedValue('PDF content');

      await documentProcessor.extractContent({
        type: 'pdf',
        file_path: '/path/to/file.pdf'
      });

      expect(extractFromPdfSpy).toHaveBeenCalledWith('/path/to/file.pdf');
      extractFromPdfSpy.mockRestore();
    });

    it('should route docx type correctly', async () => {
      const extractFromDocxSpy = jest.spyOn(documentProcessor, 'extractFromDocx')
        .mockResolvedValue('DOCX content');

      await documentProcessor.extractContent({
        type: 'docx',
        file_path: '/path/to/file.docx'
      });

      expect(extractFromDocxSpy).toHaveBeenCalled();
      extractFromDocxSpy.mockRestore();
    });

    it('should route doc type correctly', async () => {
      const extractFromDocxSpy = jest.spyOn(documentProcessor, 'extractFromDocx')
        .mockResolvedValue('DOC content');

      await documentProcessor.extractContent({
        type: 'doc',
        file_path: '/path/to/file.doc'
      });

      expect(extractFromDocxSpy).toHaveBeenCalled();
      extractFromDocxSpy.mockRestore();
    });

    it('should route xlsx type correctly', async () => {
      const extractFromExcelSpy = jest.spyOn(documentProcessor, 'extractFromExcel')
        .mockResolvedValue('Excel content');

      await documentProcessor.extractContent({
        type: 'xlsx',
        file_path: '/path/to/file.xlsx'
      });

      expect(extractFromExcelSpy).toHaveBeenCalled();
      extractFromExcelSpy.mockRestore();
    });

    it('should route csv type correctly', async () => {
      const extractFromCsvSpy = jest.spyOn(documentProcessor, 'extractFromCsv')
        .mockResolvedValue('CSV content');

      await documentProcessor.extractContent({
        type: 'csv',
        file_path: '/path/to/file.csv'
      });

      expect(extractFromCsvSpy).toHaveBeenCalledWith('/path/to/file.csv', ',');
      extractFromCsvSpy.mockRestore();
    });

    it('should route tsv type correctly', async () => {
      const extractFromCsvSpy = jest.spyOn(documentProcessor, 'extractFromCsv')
        .mockResolvedValue('TSV content');

      await documentProcessor.extractContent({
        type: 'tsv',
        file_path: '/path/to/file.tsv'
      });

      expect(extractFromCsvSpy).toHaveBeenCalledWith('/path/to/file.tsv', '\t');
      extractFromCsvSpy.mockRestore();
    });

    it('should route url type correctly', async () => {
      const extractFromUrlSpy = jest.spyOn(documentProcessor, 'extractFromUrl')
        .mockResolvedValue('Web content');

      await documentProcessor.extractContent({
        type: 'url',
        source_url: 'https://example.com'
      });

      expect(extractFromUrlSpy).toHaveBeenCalledWith('https://example.com');
      extractFromUrlSpy.mockRestore();
    });

    it('should route web type correctly', async () => {
      const extractFromUrlSpy = jest.spyOn(documentProcessor, 'extractFromUrl')
        .mockResolvedValue('Web content');

      await documentProcessor.extractContent({
        type: 'web',
        source_url: 'https://example.com'
      });

      expect(extractFromUrlSpy).toHaveBeenCalled();
      extractFromUrlSpy.mockRestore();
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

    it('should throw error for undefined file path', async () => {
      await expect(documentProcessor.extractFromTxt(undefined))
        .rejects.toThrow('File path is required for TXT extraction');
    });

    it('should handle empty file', async () => {
      fs.readFile.mockResolvedValue('');
      const result = await documentProcessor.extractFromTxt('/path/to/file.txt');
      expect(result).toBe('');
    });

    it('should handle file read errors', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));
      await expect(documentProcessor.extractFromTxt('/path/to/file.txt'))
        .rejects.toThrow('File not found');
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

    it('should clean markdown content', async () => {
      fs.readFile.mockResolvedValue('**Bold** and *italic*');
      const result = await documentProcessor.extractFromMarkdown('/path/to/file.md');
      expect(result).not.toContain('**');
      expect(result).not.toContain('*');
    });
  });

  describe('cleanMarkdown', () => {
    it('should remove code blocks but keep content', () => {
      const input = '```javascript\nconst x = 1;\n```';
      const result = documentProcessor.cleanMarkdown(input);
      expect(result).toContain('[Code]');
      expect(result).toContain('const x = 1;');
      expect(result).not.toContain('```');
    });

    it('should handle code blocks with language', () => {
      const input = '```python\nprint("hello")\n```';
      const result = documentProcessor.cleanMarkdown(input);
      expect(result).toContain('[Code]');
      expect(result).toContain('print("hello")');
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

    it('should handle multiple header levels', () => {
      const input = '# H1\n## H2\n### H3';
      const result = documentProcessor.cleanMarkdown(input);
      expect(result).toContain('H1');
      expect(result).toContain('H2');
      expect(result).toContain('H3');
      expect(result).not.toContain('#');
    });

    it('should remove bold markers', () => {
      expect(documentProcessor.cleanMarkdown('**bold**')).toBe('bold');
      expect(documentProcessor.cleanMarkdown('__bold__')).toBe('bold');
    });

    it('should remove italic markers', () => {
      expect(documentProcessor.cleanMarkdown('*italic*')).toBe('italic');
      expect(documentProcessor.cleanMarkdown('_italic_')).toBe('italic');
    });

    it('should remove links but keep text', () => {
      const result = documentProcessor.cleanMarkdown('[Link text](https://example.com)');
      expect(result).toBe('Link text');
      expect(result).not.toContain('https://');
    });

    it('should handle images', () => {
      const result = documentProcessor.cleanMarkdown('![Alt text](image.png)');
      expect(result).not.toContain('(image.png)');
    });

    it('should clean up multiple newlines', () => {
      const input = 'Line 1\n\n\n\nLine 2';
      const result = documentProcessor.cleanMarkdown(input);
      expect(result).not.toContain('\n\n\n');
    });

    it('should trim whitespace', () => {
      const input = '  \n\n  Content  \n\n  ';
      const result = documentProcessor.cleanMarkdown(input);
      expect(result).toBe('Content');
    });
  });

  describe('extractFromPdf', () => {
    it('should throw error if no file path', async () => {
      await expect(documentProcessor.extractFromPdf(null))
        .rejects.toThrow('File path is required for PDF extraction');
    });

    it('should throw error for undefined file path', async () => {
      await expect(documentProcessor.extractFromPdf(undefined))
        .rejects.toThrow('File path is required for PDF extraction');
    });
  });

  describe('extractFromDocx', () => {
    it('should throw error if no file path', async () => {
      await expect(documentProcessor.extractFromDocx(null))
        .rejects.toThrow('File path is required for DOCX extraction');
    });

    it('should throw error for undefined file path', async () => {
      await expect(documentProcessor.extractFromDocx(undefined))
        .rejects.toThrow('File path is required for DOCX extraction');
    });
  });

  describe('extractFromExcel', () => {
    it('should throw error if no file path', async () => {
      await expect(documentProcessor.extractFromExcel(null))
        .rejects.toThrow('File path is required for Excel extraction');
    });

    it('should throw error for undefined file path', async () => {
      await expect(documentProcessor.extractFromExcel(undefined))
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
      expect(result).toContain('[Name: Jane]');
      expect(result).toContain('[Age: 25]');
    });

    it('should extract TSV with tab delimiter', async () => {
      fs.readFile.mockResolvedValue('Name\tAge\nJohn\t30');
      const result = await documentProcessor.extractFromCsv('/path/to/file.tsv', '\t');
      expect(result).toContain('ROW:');
      expect(result).toContain('[Name: John]');
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

    it('should skip empty rows', async () => {
      fs.readFile.mockResolvedValue('Name,Age\n\n,,\nJohn,30');
      const result = await documentProcessor.extractFromCsv('/path/to/file.csv');
      expect(result).toContain('[Name: John]');
      expect(result.split('ROW:').length).toBe(2); // Only 1 data row + 1 empty split
    });

    it('should handle CSV with extra commas', async () => {
      fs.readFile.mockResolvedValue('A,B,C\n1,2,3');
      const result = await documentProcessor.extractFromCsv('/path/to/file.csv');
      expect(result).toContain('[A: 1]');
      expect(result).toContain('[B: 2]');
      expect(result).toContain('[C: 3]');
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

    it('should handle empty fields', () => {
      const result = documentProcessor.parseCsvLine('a,,c', ',');
      expect(result).toEqual(['a', '', 'c']);
    });

    it('should trim whitespace from fields', () => {
      const result = documentProcessor.parseCsvLine(' a , b , c ', ',');
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should handle quotes at end of line', () => {
      const result = documentProcessor.parseCsvLine('a,"test"', ',');
      expect(result).toEqual(['a', 'test']);
    });
  });

  describe('extractFromUrl', () => {
    it('should throw error if no URL', async () => {
      await expect(documentProcessor.extractFromUrl(null))
        .rejects.toThrow('URL is required for web extraction');
    });

    it('should throw error for undefined URL', async () => {
      await expect(documentProcessor.extractFromUrl(undefined))
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

    it('should remove noscript tags', () => {
      const html = '<p>Content</p><noscript>No JS</noscript>';
      const result = documentProcessor.extractTextFromHtml(html);
      expect(result).not.toContain('No JS');
      expect(result).toContain('Content');
    });

    it('should convert block elements to newlines', () => {
      const html = '<p>First</p><p>Second</p>';
      const result = documentProcessor.extractTextFromHtml(html);
      expect(result).toContain('First');
      expect(result).toContain('Second');
    });

    it('should convert br tags to newlines', () => {
      const html = 'Line 1<br>Line 2';
      const result = documentProcessor.extractTextFromHtml(html);
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
    });

    it('should decode HTML entities', () => {
      const html = '<p>Hello &amp; World</p>';
      const result = documentProcessor.extractTextFromHtml(html);
      expect(result).toContain('Hello & World');
    });

    it('should clean up whitespace', () => {
      const html = '<p>Multiple    spaces</p>';
      const result = documentProcessor.extractTextFromHtml(html);
      expect(result).toBe('Multiple spaces');
    });

    it('should remove all HTML tags', () => {
      const html = '<div><span>Text</span></div>';
      const result = documentProcessor.extractTextFromHtml(html);
      expect(result).toBe('Text');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
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

    it('should decode &apos;', () => {
      expect(documentProcessor.decodeHtmlEntities('&apos;test&apos;')).toBe("'test'");
    });

    it('should decode &#39;', () => {
      expect(documentProcessor.decodeHtmlEntities('&#39;test&#39;')).toBe("'test'");
    });

    it('should decode &nbsp;', () => {
      expect(documentProcessor.decodeHtmlEntities('hello&nbsp;world')).toBe('hello world');
    });

    it('should decode numeric entities', () => {
      expect(documentProcessor.decodeHtmlEntities('&#65;')).toBe('A');
      expect(documentProcessor.decodeHtmlEntities('&#66;')).toBe('B');
    });

    it('should decode hex entities', () => {
      expect(documentProcessor.decodeHtmlEntities('&#x41;')).toBe('A');
      expect(documentProcessor.decodeHtmlEntities('&#x42;')).toBe('B');
    });

    it('should decode multiple entities', () => {
      const input = '&lt;div&gt;&amp;&lt;/div&gt;';
      expect(documentProcessor.decodeHtmlEntities(input)).toBe('<div>&</div>');
    });

    it('should decode special symbols', () => {
      expect(documentProcessor.decodeHtmlEntities('&copy;')).toBe('©');
      expect(documentProcessor.decodeHtmlEntities('&reg;')).toBe('®');
      expect(documentProcessor.decodeHtmlEntities('&trade;')).toBe('™');
    });
  });

  describe('calculateHash', () => {
    it('should calculate SHA-256 hash', () => {
      const hash = documentProcessor.calculateHash('test content');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(64);
    });

    it('should return same hash for same content', () => {
      const hash1 = documentProcessor.calculateHash('test content');
      const hash2 = documentProcessor.calculateHash('test content');
      expect(hash1).toBe(hash2);
    });

    it('should return different hash for different content', () => {
      const hash1 = documentProcessor.calculateHash('content 1');
      const hash2 = documentProcessor.calculateHash('content 2');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = documentProcessor.calculateHash('');
      expect(hash).toHaveLength(64);
    });

    it('should handle unicode characters', () => {
      const hash = documentProcessor.calculateHash('Hello 世界 🌍');
      expect(hash).toHaveLength(64);
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
        .mockResolvedValueOnce({
          id: 2,
          knowledge_base_id: 10,
          type: 'txt',
          file_path: '/path/to/file2.txt',
          name: 'Doc2'
        });

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
      expect(results[1].success).toBe(true);
    });

    it('should handle mixed success and failure', async () => {
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

    it('should process empty array', async () => {
      const results = await documentProcessor.processDocuments([]);
      expect(results).toEqual([]);
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

    it('should handle reprocess errors', async () => {
      VectorStore.deleteChunksByDocument.mockResolvedValue(5);
      Document.updateStatus.mockResolvedValue({});
      Document.findById.mockResolvedValue(null);

      await expect(documentProcessor.reprocessDocument(1))
        .rejects.toThrow('Document not found');
    });
  });

  describe('processTableData', () => {
    it('should process table data with barcodes', () => {
      const text = '8698686123456 product 70-110 4,50';
      const result = documentProcessor.processTableData(text);
      expect(result).toContain('PRODUCT BARCODE DATABASE');
      expect(result).toContain('ROW:');
      expect(result).toContain('8698686123456');
    });

    it('should handle text without barcodes', () => {
      const text = 'Regular text without barcodes';
      const result = documentProcessor.processTableData(text);
      expect(result).toContain('Total products: 0');
    });

    it('should extract unique barcodes', () => {
      const text = '8698686123456 text 8698686123456 more text';
      const result = documentProcessor.processTableData(text);
      const matches = result.match(/8698686123456/g);
      expect(matches.length).toBe(2); // Once in count, once in ROW
    });

    it('should handle multiple barcodes', () => {
      const text = '8698686111111 product1 8698686222222 product2';
      const result = documentProcessor.processTableData(text);
      expect(result).toContain('8698686111111');
      expect(result).toContain('8698686222222');
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

    it('should find multiple barcodes', () => {
      const text = '8698686111111 5,50 8698686222222 6,75';
      const results = documentProcessor.extractBarcodeData(text);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle text without barcodes', () => {
      const text = 'Just some regular text';
      const results = documentProcessor.extractBarcodeData(text);
      expect(results).toEqual([]);
    });
  });
});
