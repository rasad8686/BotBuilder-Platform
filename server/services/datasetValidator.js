/**
 * Dataset Validator Service
 *
 * Handles validation and conversion of training datasets for fine-tuning:
 * - JSONL format validation
 * - CSV to JSONL conversion
 * - JSON to JSONL conversion
 * - OpenAI training format validation
 * - Token counting and cost estimation
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const log = require('../utils/logger');

// Token estimation constants (approximate)
const AVG_CHARS_PER_TOKEN = 4;

// Training costs per 1K tokens by model
const TRAINING_COSTS = {
  'gpt-3.5-turbo': 0.008,
  'gpt-4': 0.03,
  'gpt-4-turbo': 0.01,
  'claude-3-haiku': 0.00025,
  'claude-3-sonnet': 0.003,
  'claude-3-opus': 0.015
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

module.exports = {
  validateJSONL,
  convertCSVtoJSONL,
  convertJSONtoJSONL,
  validateTrainingFormat,
  countTokens,
  countFileTokens,
  estimateCost,
  analyzeDataset,
  parseCSVLine
};
