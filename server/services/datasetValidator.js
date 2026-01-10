/**
 * Dataset Validator Service
 *
 * Handles validation and conversion of training datasets for fine-tuning:
 * - JSONL format validation
 * - CSV to JSONL conversion
 * - JSON to JSONL conversion
 * - OpenAI training format validation
 * - Token counting and cost estimation
 * - Comprehensive error messages with suggestions
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const log = require('../utils/logger');

// Token estimation constants (approximate)
const AVG_CHARS_PER_TOKEN = 4;

// Validation constants
const MIN_CONVERSATIONS = 10;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_TOKENS_PER_EXAMPLE = 4096;
const VALID_ROLES = ['system', 'user', 'assistant'];

// Training costs per 1K tokens by model
const TRAINING_COSTS = {
  'gpt-3.5-turbo': { training: 0.008, input: 0.003, output: 0.006 },
  'gpt-4': { training: 0.03, input: 0.03, output: 0.06 },
  'gpt-4-turbo': { training: 0.01, input: 0.01, output: 0.03 },
  'gpt-4o': { training: 0.00375, input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { training: 0.0003, input: 0.00015, output: 0.0006 },
  'claude-3-haiku': { training: 0.00025, input: 0.00025, output: 0.00125 },
  'claude-3-sonnet': { training: 0.003, input: 0.003, output: 0.015 },
  'claude-3-opus': { training: 0.015, input: 0.015, output: 0.075 }
};

/**
 * Validate JSONL file format
 * @param {string} filePath - Path to JSONL file
 * @returns {Promise<{valid: boolean, rows: number, errors: Array, preview: Array}>}
 */
async function validateJSONL(filePath) {
  const errors = [];
  const preview = [];
  let lineNumber = 0;
  let validRows = 0;

  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      lineNumber++;

      // Skip empty lines
      if (!line.trim()) {
        return;
      }

      try {
        const parsed = JSON.parse(line);

        // Validate training format
        const formatValidation = validateTrainingFormat(parsed);
        if (!formatValidation.valid) {
          errors.push({
            line: lineNumber,
            error: formatValidation.error
          });
        } else {
          validRows++;
        }

        // Collect preview (first 10 rows)
        if (preview.length < 10) {
          preview.push({
            line: lineNumber,
            data: parsed
          });
        }
      } catch (parseError) {
        errors.push({
          line: lineNumber,
          error: `Invalid JSON: ${parseError.message}`
        });
      }
    });

    rl.on('close', () => {
      resolve({
        valid: errors.length === 0,
        total_rows: lineNumber,
        valid_rows: validRows,
        errors: errors.slice(0, 50), // Limit errors to first 50
        preview
      });
    });

    rl.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Convert CSV file to JSONL format
 * @param {string} csvFilePath - Path to CSV file
 * @param {string} outputPath - Output JSONL file path
 * @returns {Promise<{success: boolean, rows: number, outputPath: string}>}
 */
async function convertCSVtoJSONL(csvFilePath, outputPath) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(csvFilePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const writeStream = fs.createWriteStream(outputPath, { encoding: 'utf8' });

    let headers = null;
    let lineNumber = 0;
    let convertedRows = 0;

    rl.on('line', (line) => {
      lineNumber++;

      if (!line.trim()) return;

      // Parse CSV (simple implementation - handles quoted fields)
      const fields = parseCSVLine(line);

      if (lineNumber === 1) {
        // First line is headers
        headers = fields.map(h => h.toLowerCase().trim());
        return;
      }

      // Map CSV to training format
      const row = {};
      headers.forEach((header, index) => {
        row[header] = fields[index] || '';
      });

      // Convert to OpenAI training format
      const trainingData = convertRowToTrainingFormat(row);
      if (trainingData) {
        writeStream.write(JSON.stringify(trainingData) + '\n');
        convertedRows++;
      }
    });

    rl.on('close', () => {
      writeStream.end();
      resolve({
        success: true,
        rows: convertedRows,
        outputPath
      });
    });

    rl.on('error', (error) => {
      writeStream.end();
      reject(error);
    });
  });
}

/**
 * Parse a single CSV line handling quoted fields
 * @param {string} line - CSV line
 * @returns {Array<string>} - Parsed fields
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

/**
 * Convert a row object to OpenAI training format
 * @param {Object} row - Row data with headers as keys
 * @returns {Object|null} - Training format object
 */
function convertRowToTrainingFormat(row) {
  const messages = [];

  // Check for system message
  if (row.system || row.system_prompt || row.system_message) {
    messages.push({
      role: 'system',
      content: row.system || row.system_prompt || row.system_message
    });
  }

  // Check for user message (required)
  const userContent = row.user || row.prompt || row.input || row.question;
  if (!userContent) {
    return null;
  }
  messages.push({
    role: 'user',
    content: userContent
  });

  // Check for assistant message (required)
  const assistantContent = row.assistant || row.completion || row.output || row.response || row.answer;
  if (!assistantContent) {
    return null;
  }
  messages.push({
    role: 'assistant',
    content: assistantContent
  });

  return { messages };
}

/**
 * Convert JSON file to JSONL format
 * @param {string} jsonFilePath - Path to JSON file
 * @param {string} outputPath - Output JSONL file path
 * @returns {Promise<{success: boolean, rows: number, outputPath: string}>}
 */
async function convertJSONtoJSONL(jsonFilePath, outputPath) {
  return new Promise((resolve, reject) => {
    fs.readFile(jsonFilePath, 'utf8', (err, data) => {
      if (err) {
        return reject(err);
      }

      try {
        const jsonData = JSON.parse(data);
        const writeStream = fs.createWriteStream(outputPath, { encoding: 'utf8' });

        let convertedRows = 0;
        const items = Array.isArray(jsonData) ? jsonData : [jsonData];

        items.forEach(item => {
          // If already in training format
          if (item.messages && Array.isArray(item.messages)) {
            writeStream.write(JSON.stringify(item) + '\n');
            convertedRows++;
          } else {
            // Try to convert to training format
            const trainingData = convertRowToTrainingFormat(item);
            if (trainingData) {
              writeStream.write(JSON.stringify(trainingData) + '\n');
              convertedRows++;
            }
          }
        });

        writeStream.end();
        resolve({
          success: true,
          rows: convertedRows,
          outputPath
        });
      } catch (parseError) {
        reject(new Error(`Invalid JSON: ${parseError.message}`));
      }
    });
  });
}

/**
 * Validate OpenAI training format
 * @param {Object} data - Parsed JSON object
 * @returns {{valid: boolean, error: string|null}}
 */
function validateTrainingFormat(data) {
  // Must have messages array
  if (!data.messages || !Array.isArray(data.messages)) {
    return {
      valid: false,
      error: 'Missing or invalid "messages" array'
    };
  }

  // Must have at least 2 messages (user + assistant)
  if (data.messages.length < 2) {
    return {
      valid: false,
      error: 'Must have at least 2 messages (user and assistant)'
    };
  }

  // Validate each message
  for (let i = 0; i < data.messages.length; i++) {
    const msg = data.messages[i];

    // Must have role
    if (!msg.role) {
      return {
        valid: false,
        error: `Message ${i + 1}: missing "role" field`
      };
    }

    // Role must be valid
    if (!['system', 'user', 'assistant'].includes(msg.role)) {
      return {
        valid: false,
        error: `Message ${i + 1}: invalid role "${msg.role}". Must be system, user, or assistant`
      };
    }

    // Must have content
    if (!msg.content && msg.content !== '') {
      return {
        valid: false,
        error: `Message ${i + 1}: missing "content" field`
      };
    }
  }

  // Must have at least one user and one assistant message
  const hasUser = data.messages.some(m => m.role === 'user');
  const hasAssistant = data.messages.some(m => m.role === 'assistant');

  if (!hasUser) {
    return {
      valid: false,
      error: 'Must have at least one "user" message'
    };
  }

  if (!hasAssistant) {
    return {
      valid: false,
      error: 'Must have at least one "assistant" message'
    };
  }

  return { valid: true, error: null };
}

/**
 * Count tokens in text (approximate)
 * @param {string} text - Text to count tokens for
 * @returns {number} - Estimated token count
 */
function countTokens(text) {
  if (!text) return 0;

  // Simple estimation: ~4 characters per token on average
  return Math.ceil(text.length / AVG_CHARS_PER_TOKEN);
}

/**
 * Count total tokens in a JSONL file
 * @param {string} filePath - Path to JSONL file
 * @returns {Promise<number>} - Total token count
 */
async function countFileTokens(filePath) {
  return new Promise((resolve, reject) => {
    let totalTokens = 0;

    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      if (!line.trim()) return;

      try {
        const parsed = JSON.parse(line);
        if (parsed.messages) {
          parsed.messages.forEach(msg => {
            totalTokens += countTokens(msg.content);
          });
        }
      } catch (e) {
        // Skip invalid lines
      }
    });

    rl.on('close', () => {
      resolve(totalTokens);
    });

    rl.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Estimate training cost
 * @param {number} tokenCount - Total token count
 * @param {string} model - Model name
 * @returns {{cost: number, formatted: string}}
 */
function estimateCost(tokenCount, model = 'gpt-3.5-turbo') {
  const costPer1K = TRAINING_COSTS[model] || TRAINING_COSTS['gpt-3.5-turbo'];

  // Training typically processes tokens multiple times (epochs)
  // Default estimate: 3 epochs
  const epochs = 3;
  const totalTokens = tokenCount * epochs;

  const cost = (totalTokens / 1000) * costPer1K;

  return {
    cost: Math.round(cost * 100) / 100,
    formatted: `$${cost.toFixed(2)}`,
    breakdown: {
      tokens: tokenCount,
      epochs,
      totalTokens,
      costPer1K
    }
  };
}

/**
 * Get full dataset analysis
 * @param {string} filePath - Path to dataset file
 * @param {string} model - Model for cost estimation
 * @returns {Promise<Object>} - Full analysis
 */
async function analyzeDataset(filePath, model = 'gpt-3.5-turbo') {
  const validation = await validateJSONL(filePath);
  const tokenCount = await countFileTokens(filePath);
  const costEstimate = estimateCost(tokenCount, model);

  return {
    ...validation,
    token_count: tokenCount,
    estimated_cost: costEstimate.formatted,
    cost_details: costEstimate.breakdown
  };
}

/**
 * Comprehensive file validation with detailed errors and suggestions
 * @param {string} filePath - Path to dataset file
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} - Validation results
 */
async function validateFile(filePath, options = {}) {
  const results = {
    valid: false,
    errors: [],
    warnings: [],
    stats: null,
    suggestions: []
  };

  try {
    // Check file exists
    if (!fs.existsSync(filePath)) {
      results.errors.push({
        code: 'FILE_NOT_FOUND',
        message: 'File not found',
        suggestion: 'Please provide a valid file path'
      });
      return results;
    }

    // Check file size
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      results.errors.push({
        code: 'FILE_TOO_LARGE',
        message: `File size (${formatBytes(stats.size)}) exceeds maximum allowed size (${formatBytes(MAX_FILE_SIZE)})`,
        suggestion: 'Split your dataset into smaller files or reduce the number of examples'
      });
      return results;
    }

    // Determine file type and validate
    const ext = path.extname(filePath).toLowerCase();
    let data = [];

    if (ext === '.jsonl') {
      const validation = await validateJSONL(filePath);
      if (!validation.valid) {
        for (const err of validation.errors) {
          results.errors.push({
            code: 'JSONL_ERROR',
            line: err.line,
            message: `Line ${err.line}: ${err.error}`,
            suggestion: 'Ensure each line is valid JSON with proper messages array'
          });
        }
      }
      // Read all data for stats
      data = await readJSONLFile(filePath);
    } else if (ext === '.csv') {
      data = await parseCSVFile(filePath, results);
    } else if (ext === '.json') {
      data = await parseJSONFile(filePath, results);
    } else {
      results.errors.push({
        code: 'UNSUPPORTED_FORMAT',
        message: `Unsupported file format: ${ext}`,
        suggestion: 'Please use JSONL, CSV, or JSON format'
      });
      return results;
    }

    if (results.errors.length > 0) {
      return results;
    }

    // Check minimum conversations
    if (data.length < MIN_CONVERSATIONS) {
      results.errors.push({
        code: 'INSUFFICIENT_DATA',
        message: `Dataset has ${data.length} conversations, minimum required is ${MIN_CONVERSATIONS}`,
        suggestion: `Add at least ${MIN_CONVERSATIONS - data.length} more conversation examples`
      });
    }

    // Validate each conversation with detailed errors
    validateDatasetStructure(data, results);

    // Calculate statistics if no critical errors
    if (results.errors.length === 0 || results.errors.every(e => e.code !== 'INSUFFICIENT_DATA')) {
      results.stats = getDatasetStats(data, options.model || 'gpt-3.5-turbo');
      addWarningsAndSuggestions(results);
    }

    results.valid = results.errors.length === 0;
    return results;

  } catch (error) {
    log.error('Dataset validation error:', error);
    results.errors.push({
      code: 'VALIDATION_ERROR',
      message: error.message,
      suggestion: 'Check the file format and try again'
    });
    return results;
  }
}

/**
 * Read JSONL file into array
 */
async function readJSONLFile(filePath) {
  const data = [];
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        data.push(JSON.parse(line));
      } catch (e) {
        // Skip invalid lines
      }
    }
  }
  return data;
}

/**
 * Parse CSV file to training format
 */
async function parseCSVFile(filePath, results) {
  const data = [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());

  if (lines.length < 2) {
    results.errors.push({
      code: 'EMPTY_CSV',
      message: 'CSV file is empty or has no data rows',
      suggestion: 'Add data rows with prompt and completion columns'
    });
    return data;
  }

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = fields[idx] || ''; });

    const training = convertRowToTrainingFormat(row);
    if (training) {
      data.push(training);
    } else {
      results.warnings.push({
        code: 'SKIPPED_ROW',
        line: i + 1,
        message: `Row ${i + 1} skipped: missing required fields`
      });
    }
  }

  return data;
}

/**
 * Parse JSON file to training format
 */
async function parseJSONFile(filePath, results) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (parsed.data && Array.isArray(parsed.data)) return parsed.data;
    if (parsed.examples && Array.isArray(parsed.examples)) return parsed.examples;
    if (parsed.conversations && Array.isArray(parsed.conversations)) return parsed.conversations;

    results.errors.push({
      code: 'INVALID_JSON_STRUCTURE',
      message: 'JSON must be an array or object with data/examples/conversations array',
      suggestion: 'Structure your JSON as an array of conversation objects'
    });
    return [];

  } catch (error) {
    results.errors.push({
      code: 'JSON_PARSE_ERROR',
      message: `Failed to parse JSON: ${error.message}`,
      suggestion: 'Validate your JSON syntax at jsonlint.com'
    });
    return [];
  }
}

/**
 * Validate dataset structure with detailed errors
 */
function validateDatasetStructure(data, results) {
  for (let i = 0; i < data.length && results.errors.length < 50; i++) {
    const conv = data[i];
    const idx = i + 1;

    if (!conv.messages) {
      results.errors.push({
        code: 'MISSING_MESSAGES',
        index: idx,
        message: `Conversation ${idx}: Missing 'messages' array`,
        suggestion: 'Each conversation must have a "messages" array'
      });
      continue;
    }

    if (!Array.isArray(conv.messages)) {
      results.errors.push({
        code: 'INVALID_MESSAGES',
        index: idx,
        message: `Conversation ${idx}: 'messages' must be an array`,
        suggestion: 'Format: {"messages": [{"role": "user", "content": "..."}, ...]}'
      });
      continue;
    }

    let hasUser = false, hasAssistant = false;

    for (let j = 0; j < conv.messages.length; j++) {
      const msg = conv.messages[j];
      const msgIdx = j + 1;

      if (!msg.role) {
        results.errors.push({
          code: 'MISSING_ROLE',
          index: idx,
          messageIndex: msgIdx,
          message: `Conversation ${idx}, Message ${msgIdx}: Missing 'role' field`,
          suggestion: 'Each message must have a role: "system", "user", or "assistant"'
        });
      } else if (!VALID_ROLES.includes(msg.role)) {
        results.errors.push({
          code: 'INVALID_ROLE',
          index: idx,
          messageIndex: msgIdx,
          message: `Conversation ${idx}, Message ${msgIdx}: Invalid role '${msg.role}'`,
          suggestion: `Valid roles are: ${VALID_ROLES.join(', ')}`
        });
      } else {
        if (msg.role === 'user') hasUser = true;
        if (msg.role === 'assistant') hasAssistant = true;
      }

      if (msg.content === undefined || msg.content === null) {
        results.errors.push({
          code: 'MISSING_CONTENT',
          index: idx,
          messageIndex: msgIdx,
          message: `Conversation ${idx}, Message ${msgIdx}: Missing 'content' field`,
          suggestion: 'Each message must have a content field'
        });
      } else if (typeof msg.content !== 'string') {
        results.errors.push({
          code: 'INVALID_CONTENT',
          index: idx,
          messageIndex: msgIdx,
          message: `Conversation ${idx}, Message ${msgIdx}: 'content' must be a string`,
          suggestion: 'Message content must be text'
        });
      }
    }

    if (!hasUser) {
      results.errors.push({
        code: 'NO_USER_MESSAGE',
        index: idx,
        message: `Conversation ${idx}: No 'user' message found`,
        suggestion: 'Each conversation must have at least one user message'
      });
    }

    if (!hasAssistant) {
      results.errors.push({
        code: 'NO_ASSISTANT_MESSAGE',
        index: idx,
        message: `Conversation ${idx}: No 'assistant' message found`,
        suggestion: 'Each conversation must have at least one assistant message'
      });
    }
  }

  if (results.errors.length >= 50) {
    results.errors.push({
      code: 'TOO_MANY_ERRORS',
      message: 'Too many validation errors. Fix the issues and try again.',
      suggestion: 'Review the format requirements and fix errors'
    });
  }
}

/**
 * Get comprehensive dataset statistics
 */
function getDatasetStats(data, model = 'gpt-3.5-turbo') {
  const tokensPerExample = [];
  let systemMessages = 0, userMessages = 0, assistantMessages = 0;

  for (const conv of data) {
    let exampleTokens = 0;
    for (const msg of conv.messages || []) {
      const tokens = countTokens(msg.content || '');
      exampleTokens += tokens + 4; // overhead per message
      if (msg.role === 'system') systemMessages++;
      else if (msg.role === 'user') userMessages++;
      else if (msg.role === 'assistant') assistantMessages++;
    }
    tokensPerExample.push(exampleTokens);
  }

  const totalTokens = tokensPerExample.reduce((a, b) => a + b, 0);
  const sortedTokens = [...tokensPerExample].sort((a, b) => a - b);
  const overLimit = tokensPerExample.filter(t => t > MAX_TOKENS_PER_EXAMPLE).length;

  const costEstimate = estimateCostDetailed(totalTokens, model);

  return {
    conversationCount: data.length,
    totalMessages: systemMessages + userMessages + assistantMessages,
    messageDistribution: { system: systemMessages, user: userMessages, assistant: assistantMessages },
    tokens: {
      total: totalTokens,
      average: Math.round(totalTokens / data.length) || 0,
      min: sortedTokens[0] || 0,
      max: sortedTokens[sortedTokens.length - 1] || 0,
      median: sortedTokens[Math.floor(sortedTokens.length / 2)] || 0
    },
    tokenLimitExceeded: overLimit,
    maxTokensPerExample: MAX_TOKENS_PER_EXAMPLE,
    cost: costEstimate
  };
}

/**
 * Detailed cost estimation
 */
function estimateCostDetailed(tokenCount, model = 'gpt-3.5-turbo') {
  const baseModel = Object.keys(TRAINING_COSTS).find(m => model.includes(m)) || 'gpt-3.5-turbo';
  const pricing = TRAINING_COSTS[baseModel];
  const trainingRate = typeof pricing === 'object' ? pricing.training : pricing;

  const epochs = 3;
  const trainingTokens = tokenCount * epochs;
  const cost = (trainingTokens / 1000) * trainingRate;

  return {
    model: baseModel,
    tokens: tokenCount,
    trainingTokens,
    epochs,
    estimatedCost: cost.toFixed(4),
    formatted: `$${cost.toFixed(2)}`,
    currency: 'USD'
  };
}

/**
 * Add warnings and suggestions based on stats
 */
function addWarningsAndSuggestions(results) {
  const stats = results.stats;
  if (!stats) return;

  if (stats.tokenLimitExceeded > 0) {
    results.warnings.push({
      code: 'TOKEN_LIMIT_EXCEEDED',
      message: `${stats.tokenLimitExceeded} conversations exceed the token limit and will be truncated`
    });
  }

  if (stats.conversationCount < 50) {
    results.warnings.push({
      code: 'LOW_EXAMPLE_COUNT',
      message: 'Fewer than 50 examples may result in lower quality fine-tuning'
    });
    results.suggestions.push('Add more diverse examples for better results (recommended: 50-100+)');
  }

  if (stats.tokens.average < 100) {
    results.suggestions.push('Average conversation is very short. Consider adding more context.');
  }

  if (stats.messageDistribution.system === 0) {
    results.suggestions.push('Consider adding system messages to define the assistant\'s behavior.');
  }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Quick validation for UI feedback
 */
async function quickValidate(content, format = 'jsonl') {
  const results = { valid: false, errors: [], lineCount: 0 };

  try {
    if (format === 'jsonl') {
      const lines = content.split('\n').filter(l => l.trim());
      results.lineCount = lines.length;

      for (let i = 0; i < Math.min(5, lines.length); i++) {
        try {
          const parsed = JSON.parse(lines[i]);
          if (!parsed.messages || !Array.isArray(parsed.messages)) {
            results.errors.push(`Line ${i + 1}: Missing or invalid 'messages' array`);
          }
        } catch (e) {
          results.errors.push(`Line ${i + 1}: Invalid JSON`);
        }
      }
    } else if (format === 'json') {
      const parsed = JSON.parse(content);
      const data = Array.isArray(parsed) ? parsed : (parsed.data || parsed.examples || []);
      results.lineCount = data.length;
      if (data.length === 0) results.errors.push('No data found in JSON');
    }

    results.valid = results.errors.length === 0;
  } catch (e) {
    results.errors.push(`Parse error: ${e.message}`);
  }

  return results;
}

module.exports = {
  validateJSONL,
  validateFile,
  validateDatasetStructure,
  convertCSVtoJSONL,
  convertJSONtoJSONL,
  validateTrainingFormat,
  countTokens,
  countFileTokens,
  estimateCost,
  estimateCostDetailed,
  analyzeDataset,
  getDatasetStats,
  parseCSVLine,
  quickValidate,
  formatBytes,
  // Constants
  MIN_CONVERSATIONS,
  MAX_FILE_SIZE,
  MAX_TOKENS_PER_EXAMPLE,
  VALID_ROLES
};
