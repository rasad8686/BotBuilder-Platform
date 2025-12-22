const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const Document = require('../models/Document');
const KnowledgeBase = require('../models/KnowledgeBase');
const VectorStore = require('./VectorStore');
const EmbeddingService = require('./EmbeddingService');
const ChunkingService = require('./ChunkingService');
const log = require('../utils/logger');

class DocumentProcessor {
  constructor() {
    this.supportedTypes = ['txt', 'md', 'pdf', 'docx', 'doc', 'url', 'xlsx', 'xls', 'csv', 'tsv'];
  }

  /**
   * Process a document: read, chunk, embed, and store in VectorStore
   * @param {number} documentId - Document ID to process
   * @returns {Promise<object>} - Processing result
   */
  async processDocument(documentId) {
    const document = await Document.findById(documentId);
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const knowledgeBase = await KnowledgeBase.findById(document.knowledge_base_id);
    if (!knowledgeBase) {
      throw new Error(`Knowledge base not found: ${document.knowledge_base_id}`);
    }

    try {
      // Update status to processing
      await Document.updateStatus(documentId, 'processing');

      // Extract text content based on document type
      const content = await this.extractContent(document);

      if (!content || content.trim().length === 0) {
        await Document.updateStatus(documentId, 'failed');
        throw new Error('No content extracted from document');
      }

      // Calculate content hash for deduplication
      const contentHash = this.calculateHash(content);

      // Chunk the content
      const chunks = ChunkingService.splitIntoChunks(
        content,
        knowledgeBase.chunk_size || 1000,
        knowledgeBase.chunk_overlap || 200
      );

      if (chunks.length === 0) {
        await Document.updateStatus(documentId, 'failed');
        throw new Error('No chunks generated from content');
      }

      // Generate embeddings for all chunks
      const chunkTexts = chunks.map(c => c.content);
      const embeddings = await EmbeddingService.getEmbeddings(chunkTexts);

      // Store chunks in VectorStore
      for (let i = 0; i < chunks.length; i++) {
        await VectorStore.storeChunk(documentId, document.knowledge_base_id, {
          content: chunks[i].content,
          embedding: embeddings[i],
          chunk_index: i,
          start_char: chunks[i].startChar,
          end_char: chunks[i].endChar,
          metadata: {
            document_name: document.name,
            document_type: document.type
          }
        });
      }

      // Update document status and chunk count
      await Document.update(documentId, {
        status: 'completed',
        chunk_count: chunks.length,
        content_hash: contentHash
      });

      // Update knowledge base stats
      await VectorStore.updateStats(document.knowledge_base_id);

      return {
        success: true,
        documentId,
        chunksCreated: chunks.length,
        contentHash
      };

    } catch (error) {
      log.error(`Error processing document ${documentId}:`, error);
      await Document.updateStatus(documentId, 'failed');
      throw error;
    }
  }

  /**
   * Extract text content from document based on type
   * @param {object} document - Document record
   * @returns {Promise<string>} - Extracted text content
   */
  async extractContent(document) {
    const type = document.type.toLowerCase();

    switch (type) {
      case 'txt':
      case 'text':
        return this.extractFromTxt(document.file_path);

      case 'md':
      case 'markdown':
        return this.extractFromMarkdown(document.file_path);

      case 'pdf':
        return this.extractFromPdf(document.file_path);

      case 'docx':
      case 'doc':
        return this.extractFromDocx(document.file_path);

      case 'xlsx':
      case 'xls':
        return this.extractFromExcel(document.file_path);

      case 'csv':
        return this.extractFromCsv(document.file_path, ',');

      case 'tsv':
        return this.extractFromCsv(document.file_path, '\t');

      case 'url':
      case 'web':
        return this.extractFromUrl(document.source_url);

      default:
        throw new Error(`Unsupported document type: ${type}`);
    }
  }

  /**
   * Extract text from TXT file
   */
  async extractFromTxt(filePath) {
    if (!filePath) throw new Error('File path is required for TXT extraction');
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  }

  /**
   * Extract text from Markdown file
   */
  async extractFromMarkdown(filePath) {
    if (!filePath) throw new Error('File path is required for Markdown extraction');
    const content = await fs.readFile(filePath, 'utf-8');
    // Remove markdown formatting but keep structure
    return this.cleanMarkdown(content);
  }

  /**
   * Clean markdown content while preserving readability
   */
  cleanMarkdown(content) {
    return content
      // Remove code blocks but keep content
      .replace(/```[\s\S]*?```/g, (match) => {
        const code = match.replace(/```\w*\n?/g, '').replace(/```/g, '');
        return '\n[Code]\n' + code + '\n[/Code]\n';
      })
      // Remove inline code backticks
      .replace(/`([^`]+)`/g, '$1')
      // Convert headers to plain text with emphasis
      .replace(/^#{1,6}\s+(.+)$/gm, '\n$1\n')
      // Remove bold/italic markers
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove images
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[Image: $1]')
      // Clean up multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Extract text from PDF file
   */
  async extractFromPdf(filePath) {
    if (!filePath) throw new Error('File path is required for PDF extraction');

    try {
      const pdfParse = require('pdf-parse');
      const dataBuffer = await fs.readFile(filePath);

      log.debug(`[PDF Parser] Reading PDF: ${filePath}`);
      log.debug(`[PDF Parser] Buffer size: ${dataBuffer.length} bytes`);

      const data = await pdfParse(dataBuffer);

      log.debug(`[PDF Parser] Extracted ${data.text?.length || 0} characters`);
      log.debug(`[PDF Parser] Pages: ${data.numpages || 'unknown'}`);

      if (!data.text || data.text.trim().length === 0) {
        throw new Error('PDF appears to be empty or contains only images (no extractable text)');
      }

      // Post-process to better handle table data
      const processedText = this.processTableData(data.text);
      log.debug(`[PDF Parser] Processed text length: ${processedText.length} characters`);

      return processedText;
    } catch (error) {
      log.error(`[PDF Parser] Error:`, error.message);
      if (error.code === 'MODULE_NOT_FOUND') {
        throw new Error('PDF parsing requires pdf-parse package. Install with: npm install pdf-parse');
      }
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  /**
   * Process table data to keep barcode + product + price together
   * Creates row-based format: "ROW: [Barcode: XXX] | [Product: YYY] | [Price: ZZZ]"
   */
  processTableData(text) {
    const processedLines = [];

    // PRIORITY 1: Extract ALL valid barcodes (starting with 8698686) from entire text
    // This is the most reliable way to find barcodes in dense PDF format
    const allBarcodes = text.match(/8698686\d{6}/g) || [];
    const uniqueBarcodes = [...new Set(allBarcodes)];

    log.debug(`[PDF Parser] Found ${uniqueBarcodes.length} unique valid barcodes`);

    // For each barcode, find its context (surrounding text with price info)
    const barcodeRows = [];
    for (const barcode of uniqueBarcodes) {
      const idx = text.indexOf(barcode);
      if (idx === -1) continue;

      // Get context: 50 chars before, barcode, 100 chars after
      const contextStart = Math.max(0, idx - 50);
      const contextEnd = Math.min(text.length, idx + 13 + 100);
      const context = text.substring(contextStart, contextEnd);

      // Extract caliber and price from context
      // Pattern: caliber (like 70-110, 291-320) followed by price (like 4,76 or 33,00)
      const afterBarcode = text.substring(idx + 13, idx + 13 + 50);
      const priceMatch = afterBarcode.match(/(\d{2,3}-\d{2,3})(\d{1,2}[,\.]\d{2})/);

      if (priceMatch) {
        const caliber = priceMatch[1];
        const price = priceMatch[2];
        barcodeRows.push(`ROW: [Barcode: ${barcode}] | [Caliber: ${caliber}] | [Price: ${price} USD]`);
      } else {
        // Try to find just a price
        const simplePriceMatch = afterBarcode.match(/(\d{1,2}[,\.]\d{2})/);
        if (simplePriceMatch) {
          barcodeRows.push(`ROW: [Barcode: ${barcode}] | [Price: ${simplePriceMatch[1]} USD]`);
        } else {
          barcodeRows.push(`ROW: [Barcode: ${barcode}] | [Context: ${context.replace(/\n/g, ' ').trim()}]`);
        }
      }
    }

    // Add header info
    processedLines.push('=== PRODUCT BARCODE DATABASE ===');
    processedLines.push(`Total products: ${barcodeRows.length}`);
    processedLines.push('');

    // Add all barcode rows
    processedLines.push(...barcodeRows);

    processedLines.push('');
    processedLines.push('=== END DATABASE ===');

    // Also add the original text (cleaned) for context
    const cleanedLines = text.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .slice(0, 100); // First 100 lines for context

    processedLines.push('');
    processedLines.push('=== ORIGINAL TEXT SAMPLE ===');
    processedLines.push(cleanedLines.join('\n'));

    return processedLines.join('\n');
  }

  /**
   * Extract barcode-price pairs from text
   * Handles dense PDF table format like: 4479869868692447970-1104,40
   */
  extractBarcodeData(text) {
    const results = [];
    const foundBarcodes = new Set();

    // Pattern 1: Barcode followed by caliber and price (dense format)
    // Example: 869868692447970-1104,40 means barcode 8698686924479, caliber 70-110, price 4,40
    const densePattern = /(\d{13})(\d{1,3}-\d{1,3})(\d{1,2}[,\.]\d{2})/g;
    let match;

    while ((match = densePattern.exec(text)) !== null) {
      const barcode = match[1];
      const caliber = match[2];
      const price = match[3];

      if (!foundBarcodes.has(barcode)) {
        foundBarcodes.add(barcode);
        results.push({
          barcode,
          caliber,
          product: `Caliber ${caliber}`,
          price
        });
      }
    }

    // Pattern 2: Standard format with spaces
    // Find all 13-digit barcodes
    const barcodeRegex = /(\d{13})/g;
    const allBarcodes = text.match(barcodeRegex) || [];

    for (const barcode of [...new Set(allBarcodes)]) {
      if (foundBarcodes.has(barcode)) continue;  // Already found

      // Find barcode position in text
      const barcodeIdx = text.indexOf(barcode);
      if (barcodeIdx === -1) continue;

      // Look at text after barcode (next 100 chars)
      const afterBarcode = text.substring(barcodeIdx + 13, barcodeIdx + 150);

      // Try to find price pattern after barcode
      // Pattern: caliber (like 70-110 or 101-120) followed by price (like 4,40 or 25,50)
      const pricePattern = /(\d{1,3}-\d{1,3})?[^\d]*?(\d{1,3}[,\.]\d{2})/;
      const priceMatch = afterBarcode.match(pricePattern);

      if (priceMatch) {
        const caliber = priceMatch[1] || '';
        const price = priceMatch[2];

        foundBarcodes.add(barcode);
        results.push({
          barcode,
          caliber,
          product: caliber ? `Caliber ${caliber}` : 'Product',
          price
        });
      }
    }

    log.debug(`[PDF Parser] Extracted ${results.length} barcode-price pairs`);

    // Log first 10 for debugging
    results.slice(0, 10).forEach(r => {
      log.debug(`[PDF Parser] Barcode: ${r.barcode} | Price: ${r.price} USD`);
    });

    return results;
  }

  /**
   * Extract text from DOCX file
   */
  async extractFromDocx(filePath) {
    if (!filePath) throw new Error('File path is required for DOCX extraction');

    try {
      // Try to use mammoth if available
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        throw new Error('DOCX parsing requires mammoth package. Install with: npm install mammoth');
      }
      throw error;
    }
  }

  /**
   * Extract text from Excel file (.xlsx, .xls)
   * Each row becomes a separate searchable chunk
   */
  async extractFromExcel(filePath) {
    if (!filePath) throw new Error('File path is required for Excel extraction');

    try {
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const sheetNames = workbook.worksheets.map(ws => ws.name);
      log.debug(`[Excel Parser] Reading Excel: ${filePath}`);
      log.debug(`[Excel Parser] Sheets found: ${sheetNames.join(', ')}`);

      const allRows = [];
      let totalRows = 0;

      for (const worksheet of workbook.worksheets) {
        const sheetName = worksheet.name;
        const rowCount = worksheet.rowCount;

        if (rowCount === 0) continue;

        // Get headers from first row
        const headerRow = worksheet.getRow(1);
        const headers = [];
        headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const value = cell.value;
          headers[colNumber - 1] = value ? String(value).trim() : `Column${colNumber}`;
        });

        // Ensure we have at least some headers
        if (headers.length === 0) continue;

        log.debug(`[Excel Parser] Sheet "${sheetName}": ${rowCount} rows, headers: ${headers.slice(0, 5).join(', ')}...`);

        // Process each row (skip header row)
        for (let rowIndex = 2; rowIndex <= rowCount; rowIndex++) {
          const row = worksheet.getRow(rowIndex);
          const rowValues = [];
          let hasContent = false;

          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            let value = cell.value;
            // Handle rich text objects
            if (value && typeof value === 'object') {
              if (value.richText) {
                value = value.richText.map(rt => rt.text).join('');
              } else if (value.text) {
                value = value.text;
              } else if (value.result !== undefined) {
                value = value.result;
              }
            }
            rowValues[colNumber - 1] = value !== undefined && value !== null ? String(value).trim() : '';
            if (rowValues[colNumber - 1]) hasContent = true;
          });

          // Skip empty rows
          if (!hasContent) continue;

          // Create formatted row: "ROW: [col1: val1] | [col2: val2] | ..."
          const rowParts = [];
          for (let colIndex = 0; colIndex < headers.length; colIndex++) {
            const header = headers[colIndex];
            const value = rowValues[colIndex] || '';
            if (value) {
              rowParts.push(`[${header}: ${value}]`);
            }
          }

          if (rowParts.length > 0) {
            const formattedRow = `ROW: ${rowParts.join(' | ')}`;
            allRows.push(formattedRow);
            totalRows++;
          }
        }

        // Add sheet separator
        if (workbook.worksheets.length > 1) {
          allRows.push(`\n--- End of Sheet: ${sheetName} ---\n`);
        }
      }

      log.debug(`[Excel Parser] Total rows extracted: ${totalRows}`);

      if (allRows.length === 0) {
        throw new Error('Excel file appears to be empty or has no extractable data');
      }

      return allRows.join('\n');
    } catch (error) {
      log.error(`[Excel Parser] Error:`, error.message);
      if (error.code === 'MODULE_NOT_FOUND') {
        throw new Error('Excel parsing requires exceljs package. Install with: npm install exceljs');
      }
      throw new Error(`Excel parsing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from CSV/TSV file
   * Each row becomes a separate searchable chunk
   */
  async extractFromCsv(filePath, delimiter = ',') {
    if (!filePath) throw new Error('File path is required for CSV extraction');

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split(/\r?\n/).filter(line => line.trim());

      log.debug(`[CSV Parser] Reading CSV: ${filePath}`);
      log.debug(`[CSV Parser] Total lines: ${lines.length}, delimiter: "${delimiter === '\t' ? 'TAB' : delimiter}"`);

      if (lines.length === 0) {
        throw new Error('CSV file is empty');
      }

      // Parse headers from first line
      const headers = this.parseCsvLine(lines[0], delimiter);
      log.debug(`[CSV Parser] Headers: ${headers.slice(0, 5).join(', ')}...`);

      const allRows = [];

      // Process each data row
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCsvLine(lines[i], delimiter);

        // Skip empty rows
        if (values.every(v => !v || v.trim() === '')) {
          continue;
        }

        // Create formatted row: "ROW: [col1: val1] | [col2: val2] | ..."
        const rowParts = [];
        for (let j = 0; j < headers.length; j++) {
          const header = headers[j] || `Column${j + 1}`;
          const value = values[j] ? String(values[j]).trim() : '';
          if (value) {
            rowParts.push(`[${header}: ${value}]`);
          }
        }

        if (rowParts.length > 0) {
          const formattedRow = `ROW: ${rowParts.join(' | ')}`;
          allRows.push(formattedRow);
        }
      }

      log.debug(`[CSV Parser] Total rows extracted: ${allRows.length}`);

      if (allRows.length === 0) {
        throw new Error('CSV file has no data rows');
      }

      return allRows.join('\n');
    } catch (error) {
      log.error(`[CSV Parser] Error:`, error.message);
      throw new Error(`CSV parsing failed: ${error.message}`);
    }
  }

  /**
   * Parse a single CSV line handling quoted values
   */
  parseCsvLine(line, delimiter = ',') {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    result.push(current.trim());

    return result;
  }

  /**
   * Extract text from URL
   */
  async extractFromUrl(url) {
    if (!url) throw new Error('URL is required for web extraction');

    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BotBuilder/1.0; +https://botbuilder.com)'
        },
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      return this.extractTextFromHtml(html);
    } catch (error) {
      throw new Error(`Failed to extract content from URL: ${error.message}`);
    }
  }

  /**
   * Extract readable text from HTML
   */
  extractTextFromHtml(html) {
    // Remove scripts and styles
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

    // Convert common block elements to newlines
    text = text
      .replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n')
      .replace(/<\/?(ul|ol|table|thead|tbody)[^>]*>/gi, '\n\n');

    // Remove remaining HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    text = this.decodeHtmlEntities(text);

    // Clean up whitespace
    text = text
      .replace(/\t/g, ' ')
      .replace(/ +/g, ' ')
      .replace(/\n +/g, '\n')
      .replace(/ +\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return text;
  }

  /**
   * Decode common HTML entities
   */
  decodeHtmlEntities(text) {
    const entities = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&nbsp;': ' ',
      '&ndash;': '–',
      '&mdash;': '—',
      '&hellip;': '…',
      '&copy;': '©',
      '&reg;': '®',
      '&trade;': '™'
    };

    let result = text;
    for (const [entity, char] of Object.entries(entities)) {
      result = result.replace(new RegExp(entity, 'g'), char);
    }

    // Decode numeric entities
    result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
    result = result.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));

    return result;
  }

  /**
   * Calculate SHA-256 hash of content
   */
  calculateHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Check if document type is supported
   */
  isTypeSupported(type) {
    return this.supportedTypes.includes(type.toLowerCase());
  }

  /**
   * Get list of supported types
   */
  getSupportedTypes() {
    return [...this.supportedTypes];
  }

  /**
   * Process multiple documents
   * @param {number[]} documentIds - Array of document IDs
   * @returns {Promise<object[]>} - Processing results
   */
  async processDocuments(documentIds) {
    const results = [];

    for (const documentId of documentIds) {
      try {
        const result = await this.processDocument(documentId);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          documentId,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Reprocess a document (delete existing chunks and reprocess)
   */
  async reprocessDocument(documentId) {
    // Delete existing chunks
    await VectorStore.deleteChunksByDocument(documentId);

    // Update document status
    await Document.updateStatus(documentId, 'pending', 0);

    // Process again
    return this.processDocument(documentId);
  }
}

module.exports = new DocumentProcessor();
