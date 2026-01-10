/**
 * File Converter Service
 * Converts various file formats (CSV, JSON, Excel) to JSONL for OpenAI fine-tuning
 */

const fs = require('fs');
const path = require('path');
const { parse: csvParse } = require('csv-parse/sync');
const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');

class FileConverterService {
  constructor() {
    this.supportedFormats = ['csv', 'json', 'jsonl', 'xlsx', 'xls'];
    this.conversionStatus = new Map();
  }

  /**
   * Auto-detect file format from extension and content
   * @param {string} filePath - Path to the file
   * @returns {string} - Detected format
   */
  autoDetectFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase().replace('.', '');

    if (this.supportedFormats.includes(ext)) {
      return ext;
    }

    // Try to detect from content
    try {
      const content = fs.readFileSync(filePath, 'utf-8').trim();

      // Check if it's JSON
      if (content.startsWith('{') || content.startsWith('[')) {
        try {
          JSON.parse(content);
          return 'json';
        } catch {
          // Check if it's JSONL (multiple JSON objects per line)
          const lines = content.split('\n').filter(l => l.trim());
          if (lines.every(line => {
            try {
              JSON.parse(line);
              return true;
            } catch {
              return false;
            }
          })) {
            return 'jsonl';
          }
        }
      }

      // Check if it looks like CSV
      if (content.includes(',') && content.includes('\n')) {
        const lines = content.split('\n');
        const commaCount = lines[0].split(',').length;
        if (lines.slice(1, 5).every(l => l.split(',').length === commaCount)) {
          return 'csv';
        }
      }
    } catch (error) {
      // Binary file or read error
    }

    throw new Error(`Unsupported file format: ${ext}`);
  }

  /**
   * Convert any supported format to JSONL
   * @param {string} filePath - Path to source file
   * @param {object} options - Conversion options
   * @returns {Promise<object>} - Conversion result
   */
  async convert(filePath, options = {}) {
    const conversionId = uuidv4();

    this.conversionStatus.set(conversionId, {
      status: 'processing',
      progress: 0,
      startedAt: new Date(),
      filePath,
      options
    });

    try {
      const format = options.format || this.autoDetectFormat(filePath);
      let result;

      switch (format) {
        case 'csv':
          result = await this.convertCSVtoJSONL(filePath, options);
          break;
        case 'json':
          result = await this.convertJSONtoJSONL(filePath, options);
          break;
        case 'jsonl':
          result = await this.validateAndCopyJSONL(filePath, options);
          break;
        case 'xlsx':
        case 'xls':
          result = await this.convertExceltoJSONL(filePath, options);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      this.conversionStatus.set(conversionId, {
        ...this.conversionStatus.get(conversionId),
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        result
      });

      return {
        conversionId,
        ...result
      };

    } catch (error) {
      this.conversionStatus.set(conversionId, {
        ...this.conversionStatus.get(conversionId),
        status: 'failed',
        error: error.message,
        failedAt: new Date()
      });

      throw error;
    }
  }

  /**
   * Convert CSV file to JSONL format
   * @param {string} csvFilePath - Path to CSV file
   * @param {object} options - Conversion options with column mapping
   * @returns {Promise<object>} - Conversion result
   */
  async convertCSVtoJSONL(csvFilePath, options = {}) {
    const {
      mapping = {},
      systemMessage = null,
      skipEmptyRows = true,
      trimWhitespace = true
    } = options;

    // Read and parse CSV
    const csvContent = this.readFileUTF8(csvFilePath);
    const records = csvParse(csvContent, {
      columns: true,
      skip_empty_lines: skipEmptyRows,
      trim: trimWhitespace,
      bom: true,
      relax_column_count: true
    });

    if (records.length === 0) {
      throw new Error('CSV file is empty or has no valid data rows');
    }

    // Get column names
    const columns = Object.keys(records[0]);

    // Determine column mapping
    const columnMapping = this.resolveColumnMapping(columns, mapping);

    // Convert to JSONL
    const jsonlLines = [];
    const errors = [];
    let validCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < records.length; i++) {
      const row = records[i];

      try {
        const jsonlEntry = this.createJSONLEntry(row, columnMapping, systemMessage, trimWhitespace);

        if (jsonlEntry) {
          jsonlLines.push(JSON.stringify(jsonlEntry));
          validCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        errors.push({ row: i + 2, error: error.message }); // +2 for header row and 0-index
        skippedCount++;
      }
    }

    // Generate output file
    const outputPath = this.generateOutputPath(csvFilePath);
    fs.writeFileSync(outputPath, jsonlLines.join('\n'), 'utf-8');

    return {
      originalFile: csvFilePath,
      convertedFile: outputPath,
      format: 'csv',
      totalRows: records.length,
      validRows: validCount,
      skippedRows: skippedCount,
      errors: errors.slice(0, 10), // First 10 errors
      columns,
      mapping: columnMapping
    };
  }

  /**
   * Convert JSON file to JSONL format
   * @param {string} jsonFilePath - Path to JSON file
   * @param {object} options - Conversion options
   * @returns {Promise<object>} - Conversion result
   */
  async convertJSONtoJSONL(jsonFilePath, options = {}) {
    const {
      mapping = {},
      systemMessage = null,
      trimWhitespace = true
    } = options;

    const jsonContent = this.readFileUTF8(jsonFilePath);
    let data;

    try {
      data = JSON.parse(jsonContent);
    } catch (error) {
      throw new Error(`Invalid JSON file: ${error.message}`);
    }

    // Handle different JSON structures
    let records = [];

    if (Array.isArray(data)) {
      records = data;
    } else if (data.data && Array.isArray(data.data)) {
      records = data.data;
    } else if (data.training_data && Array.isArray(data.training_data)) {
      records = data.training_data;
    } else if (data.conversations && Array.isArray(data.conversations)) {
      records = data.conversations;
    } else if (typeof data === 'object') {
      // Single object, wrap in array
      records = [data];
    }

    if (records.length === 0) {
      throw new Error('JSON file contains no valid data');
    }

    // Determine if data is already in OpenAI format
    const isOpenAIFormat = records[0].messages && Array.isArray(records[0].messages);

    const jsonlLines = [];
    const errors = [];
    let validCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      try {
        let jsonlEntry;

        if (isOpenAIFormat) {
          // Already in correct format, just validate
          jsonlEntry = this.validateOpenAIFormat(record);
        } else {
          // Need to convert
          const columns = Object.keys(record);
          const columnMapping = this.resolveColumnMapping(columns, mapping);
          jsonlEntry = this.createJSONLEntry(record, columnMapping, systemMessage, trimWhitespace);
        }

        if (jsonlEntry) {
          jsonlLines.push(JSON.stringify(jsonlEntry));
          validCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        errors.push({ index: i, error: error.message });
        skippedCount++;
      }
    }

    const outputPath = this.generateOutputPath(jsonFilePath);
    fs.writeFileSync(outputPath, jsonlLines.join('\n'), 'utf-8');

    return {
      originalFile: jsonFilePath,
      convertedFile: outputPath,
      format: 'json',
      totalRecords: records.length,
      validRecords: validCount,
      skippedRecords: skippedCount,
      errors: errors.slice(0, 10),
      isOpenAIFormat
    };
  }

  /**
   * Convert Excel file to JSONL format
   * @param {string} excelFilePath - Path to Excel file
   * @param {object} options - Conversion options
   * @returns {Promise<object>} - Conversion result
   */
  async convertExceltoJSONL(excelFilePath, options = {}) {
    const {
      mapping = {},
      systemMessage = null,
      sheetName = null,
      sheetIndex = 0,
      skipEmptyRows = true,
      trimWhitespace = true
    } = options;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelFilePath);

    // Get the worksheet
    let worksheet;
    if (sheetName) {
      worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) {
        throw new Error(`Sheet "${sheetName}" not found in Excel file`);
      }
    } else {
      worksheet = workbook.worksheets[sheetIndex];
      if (!worksheet) {
        throw new Error('Excel file has no worksheets');
      }
    }

    // Get headers from first row
    const headerRow = worksheet.getRow(1);
    const columns = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      columns[colNumber - 1] = this.getCellValue(cell, trimWhitespace);
    });

    if (columns.length === 0) {
      throw new Error('Excel file has no headers in first row');
    }

    // Determine column mapping
    const columnMapping = this.resolveColumnMapping(columns, mapping);

    // Process data rows
    const jsonlLines = [];
    const errors = [];
    let validCount = 0;
    let skippedCount = 0;
    let totalRows = 0;

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row
      totalRows++;

      try {
        // Build record from row
        const record = {};
        let hasContent = false;

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const colName = columns[colNumber - 1];
          if (colName) {
            const value = this.getCellValue(cell, trimWhitespace);
            record[colName] = value;
            if (value) hasContent = true;
          }
        });

        // Skip empty rows
        if (skipEmptyRows && !hasContent) {
          skippedCount++;
          return;
        }

        const jsonlEntry = this.createJSONLEntry(record, columnMapping, systemMessage, trimWhitespace);

        if (jsonlEntry) {
          jsonlLines.push(JSON.stringify(jsonlEntry));
          validCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        errors.push({ row: rowNumber, error: error.message });
        skippedCount++;
      }
    });

    const outputPath = this.generateOutputPath(excelFilePath);
    fs.writeFileSync(outputPath, jsonlLines.join('\n'), 'utf-8');

    return {
      originalFile: excelFilePath,
      convertedFile: outputPath,
      format: 'excel',
      sheetName: worksheet.name,
      totalRows,
      validRows: validCount,
      skippedRows: skippedCount,
      errors: errors.slice(0, 10),
      columns,
      mapping: columnMapping
    };
  }

  /**
   * Validate and copy JSONL file (if already in correct format)
   * @param {string} jsonlFilePath - Path to JSONL file
   * @param {object} options - Validation options
   * @returns {Promise<object>} - Validation result
   */
  async validateAndCopyJSONL(jsonlFilePath, options = {}) {
    const content = this.readFileUTF8(jsonlFilePath);
    const lines = content.split('\n').filter(l => l.trim());

    const validLines = [];
    const errors = [];
    let validCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const parsed = JSON.parse(line);
        const validated = this.validateOpenAIFormat(parsed);

        if (validated) {
          validLines.push(JSON.stringify(validated));
          validCount++;
        } else {
          invalidCount++;
        }
      } catch (error) {
        errors.push({ line: i + 1, error: error.message });
        invalidCount++;
      }
    }

    const outputPath = this.generateOutputPath(jsonlFilePath);
    fs.writeFileSync(outputPath, validLines.join('\n'), 'utf-8');

    return {
      originalFile: jsonlFilePath,
      convertedFile: outputPath,
      format: 'jsonl',
      totalLines: lines.length,
      validLines: validCount,
      invalidLines: invalidCount,
      errors: errors.slice(0, 10),
      alreadyValid: invalidCount === 0
    };
  }

  /**
   * Parse CSV columns and return available mappings
   * @param {string} csvData - CSV content as string
   * @param {object} mapping - Custom column mapping
   * @returns {object} - Parsed column information
   */
  parseCSVColumns(csvData, mapping = {}) {
    const records = csvParse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      to: 5 // Only parse first 5 rows for preview
    });

    if (records.length === 0) {
      return { columns: [], preview: [], suggestedMapping: {} };
    }

    const columns = Object.keys(records[0]);
    const suggestedMapping = this.suggestColumnMapping(columns);

    return {
      columns,
      preview: records,
      suggestedMapping,
      currentMapping: { ...suggestedMapping, ...mapping }
    };
  }

  /**
   * Suggest column mapping based on column names
   * @param {string[]} columns - Array of column names
   * @returns {object} - Suggested mapping
   */
  suggestColumnMapping(columns) {
    const mapping = {
      user_message: null,
      assistant_message: null,
      system_message: null
    };

    const lowerColumns = columns.map(c => c.toLowerCase());

    // User message patterns
    const userPatterns = ['user', 'question', 'input', 'prompt', 'query', 'request', 'human', 'user_message', 'user_input'];
    for (const pattern of userPatterns) {
      const index = lowerColumns.findIndex(c => c.includes(pattern));
      if (index !== -1) {
        mapping.user_message = columns[index];
        break;
      }
    }

    // Assistant message patterns
    const assistantPatterns = ['assistant', 'answer', 'output', 'response', 'reply', 'bot', 'ai', 'assistant_message', 'assistant_response'];
    for (const pattern of assistantPatterns) {
      const index = lowerColumns.findIndex(c => c.includes(pattern));
      if (index !== -1) {
        mapping.assistant_message = columns[index];
        break;
      }
    }

    // System message patterns
    const systemPatterns = ['system', 'instruction', 'context', 'system_message', 'system_prompt'];
    for (const pattern of systemPatterns) {
      const index = lowerColumns.findIndex(c => c.includes(pattern));
      if (index !== -1) {
        mapping.system_message = columns[index];
        break;
      }
    }

    // Fallback: if only 2 columns, assume first is user, second is assistant
    if (!mapping.user_message && !mapping.assistant_message && columns.length >= 2) {
      mapping.user_message = columns[0];
      mapping.assistant_message = columns[1];
    }

    return mapping;
  }

  /**
   * Resolve column mapping with user overrides
   * @param {string[]} columns - Available columns
   * @param {object} userMapping - User-provided mapping
   * @returns {object} - Resolved mapping
   */
  resolveColumnMapping(columns, userMapping = {}) {
    const suggested = this.suggestColumnMapping(columns);

    return {
      user_message: userMapping.user_message || suggested.user_message,
      assistant_message: userMapping.assistant_message || suggested.assistant_message,
      system_message: userMapping.system_message || suggested.system_message
    };
  }

  /**
   * Create a JSONL entry in OpenAI fine-tuning format
   * @param {object} row - Data row
   * @param {object} mapping - Column mapping
   * @param {string} defaultSystemMessage - Default system message
   * @param {boolean} trimWhitespace - Whether to trim whitespace
   * @returns {object|null} - JSONL entry or null if invalid
   */
  createJSONLEntry(row, mapping, defaultSystemMessage = null, trimWhitespace = true) {
    const getValue = (key) => {
      const colName = mapping[key];
      if (!colName) return null;
      let value = row[colName];
      if (value && trimWhitespace) {
        value = String(value).trim();
      }
      return value || null;
    };

    const userMessage = getValue('user_message');
    const assistantMessage = getValue('assistant_message');
    const systemMessage = getValue('system_message') || defaultSystemMessage;

    // User and assistant messages are required
    if (!userMessage || !assistantMessage) {
      return null;
    }

    // Handle special characters
    const cleanText = (text) => {
      if (!text) return text;
      return text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/\u00A0/g, ' ') // Non-breaking space
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Control characters
    };

    const messages = [];

    // Add system message if present
    if (systemMessage) {
      messages.push({
        role: 'system',
        content: cleanText(systemMessage)
      });
    }

    // Add user message
    messages.push({
      role: 'user',
      content: cleanText(userMessage)
    });

    // Add assistant message
    messages.push({
      role: 'assistant',
      content: cleanText(assistantMessage)
    });

    return { messages };
  }

  /**
   * Validate OpenAI format entry
   * @param {object} entry - Entry to validate
   * @returns {object|null} - Validated entry or null
   */
  validateOpenAIFormat(entry) {
    if (!entry || !entry.messages || !Array.isArray(entry.messages)) {
      throw new Error('Entry must have a "messages" array');
    }

    const validRoles = ['system', 'user', 'assistant'];
    const cleanedMessages = [];
    let hasUser = false;
    let hasAssistant = false;

    for (const msg of entry.messages) {
      if (!msg.role || !validRoles.includes(msg.role)) {
        throw new Error(`Invalid role: ${msg.role}`);
      }

      if (!msg.content || typeof msg.content !== 'string') {
        throw new Error('Message must have string content');
      }

      const content = msg.content.trim();
      if (!content) continue;

      if (msg.role === 'user') hasUser = true;
      if (msg.role === 'assistant') hasAssistant = true;

      cleanedMessages.push({
        role: msg.role,
        content
      });
    }

    if (!hasUser || !hasAssistant) {
      throw new Error('Entry must have at least one user and one assistant message');
    }

    return { messages: cleanedMessages };
  }

  /**
   * Read file with UTF-8 encoding and BOM handling
   * @param {string} filePath - Path to file
   * @returns {string} - File content
   */
  readFileUTF8(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Remove BOM if present
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }

    return content;
  }

  /**
   * Get cell value from Excel cell
   * @param {object} cell - Excel cell
   * @param {boolean} trim - Whether to trim whitespace
   * @returns {string} - Cell value
   */
  getCellValue(cell, trim = true) {
    let value = '';

    if (cell.value === null || cell.value === undefined) {
      return '';
    }

    if (typeof cell.value === 'object') {
      if (cell.value.richText) {
        value = cell.value.richText.map(r => r.text).join('');
      } else if (cell.value.text) {
        value = cell.value.text;
      } else if (cell.value.result !== undefined) {
        value = String(cell.value.result);
      } else {
        value = String(cell.value);
      }
    } else {
      value = String(cell.value);
    }

    return trim ? value.trim() : value;
  }

  /**
   * Generate output path for converted file
   * @param {string} inputPath - Original file path
   * @returns {string} - Output file path
   */
  generateOutputPath(inputPath) {
    const dir = path.dirname(inputPath);
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const timestamp = Date.now();
    return path.join(dir, `${baseName}_converted_${timestamp}.jsonl`);
  }

  /**
   * Get conversion status
   * @param {string} conversionId - Conversion ID
   * @returns {object|null} - Status object
   */
  getConversionStatus(conversionId) {
    return this.conversionStatus.get(conversionId) || null;
  }

  /**
   * Clean up old conversion statuses
   * @param {number} maxAgeMs - Maximum age in milliseconds
   */
  cleanupStatuses(maxAgeMs = 3600000) {
    const now = Date.now();
    for (const [id, status] of this.conversionStatus.entries()) {
      const age = now - new Date(status.startedAt).getTime();
      if (age > maxAgeMs) {
        this.conversionStatus.delete(id);
      }
    }
  }

  /**
   * Get file statistics before conversion
   * @param {string} filePath - Path to file
   * @returns {Promise<object>} - File statistics
   */
  async getFileStats(filePath) {
    const stats = fs.statSync(filePath);
    const format = this.autoDetectFormat(filePath);

    const result = {
      filePath,
      fileName: path.basename(filePath),
      fileSize: stats.size,
      format,
      lastModified: stats.mtime
    };

    // Get row/record count estimate
    try {
      if (format === 'csv') {
        const content = this.readFileUTF8(filePath);
        const lines = content.split('\n').filter(l => l.trim()).length;
        result.estimatedRows = Math.max(0, lines - 1); // Subtract header
      } else if (format === 'json') {
        const content = this.readFileUTF8(filePath);
        const data = JSON.parse(content);
        result.estimatedRows = Array.isArray(data) ? data.length : 1;
      } else if (format === 'jsonl') {
        const content = this.readFileUTF8(filePath);
        result.estimatedRows = content.split('\n').filter(l => l.trim()).length;
      } else if (format === 'xlsx' || format === 'xls') {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.worksheets[0];
        result.estimatedRows = Math.max(0, worksheet.rowCount - 1); // Subtract header
        result.sheetCount = workbook.worksheets.length;
        result.sheetNames = workbook.worksheets.map(ws => ws.name);
      }
    } catch (error) {
      result.estimatedRows = null;
      result.statsError = error.message;
    }

    return result;
  }

  /**
   * Preview file content without full conversion
   * @param {string} filePath - Path to file
   * @param {number} maxRows - Maximum rows to preview
   * @returns {Promise<object>} - Preview data
   */
  async previewFile(filePath, maxRows = 5) {
    const format = this.autoDetectFormat(filePath);
    let preview = [];
    let columns = [];

    try {
      if (format === 'csv') {
        const content = this.readFileUTF8(filePath);
        const records = csvParse(content, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          bom: true,
          to: maxRows
        });
        columns = records.length > 0 ? Object.keys(records[0]) : [];
        preview = records;
      } else if (format === 'json') {
        const content = this.readFileUTF8(filePath);
        const data = JSON.parse(content);
        const records = Array.isArray(data) ? data : [data];
        columns = records.length > 0 ? Object.keys(records[0]) : [];
        preview = records.slice(0, maxRows);
      } else if (format === 'jsonl') {
        const content = this.readFileUTF8(filePath);
        const lines = content.split('\n').filter(l => l.trim()).slice(0, maxRows);
        preview = lines.map(l => JSON.parse(l));
        columns = preview.length > 0 ? Object.keys(preview[0]) : [];
      } else if (format === 'xlsx' || format === 'xls') {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.worksheets[0];

        // Get headers
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          columns[colNumber - 1] = this.getCellValue(cell);
        });

        // Get preview rows
        for (let rowNum = 2; rowNum <= Math.min(worksheet.rowCount, maxRows + 1); rowNum++) {
          const row = worksheet.getRow(rowNum);
          const record = {};
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const colName = columns[colNumber - 1];
            if (colName) {
              record[colName] = this.getCellValue(cell);
            }
          });
          preview.push(record);
        }
      }
    } catch (error) {
      throw new Error(`Failed to preview file: ${error.message}`);
    }

    const suggestedMapping = this.suggestColumnMapping(columns);

    return {
      format,
      columns,
      preview,
      suggestedMapping,
      previewCount: preview.length
    };
  }
}

module.exports = new FileConverterService();
