/**
 * OpenAI Fine-Tuning Service
 *
 * Handles direct integration with OpenAI Fine-tuning API:
 * - File upload
 * - Job creation and management
 * - Status polling
 * - Model testing
 */

const fs = require('fs');
const path = require('path');
const log = require('../utils/logger');

// Initialize OpenAI client
let openai = null;

function initOpenAI() {
  if (!openai) {
    try {
      const OpenAI = require('openai');
      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey) {
        log.warn('OPENAI_API_KEY not configured');
        return null;
      }

      openai = new OpenAI({ apiKey });
      log.info('OpenAI client initialized for fine-tuning');
    } catch (err) {
      log.error('Failed to initialize OpenAI client', { error: err.message });
      return null;
    }
  }
  return openai;
}

/**
 * Check if OpenAI is available
 */
function isAvailable() {
  return !!initOpenAI();
}

/**
 * Upload a file to OpenAI for fine-tuning
 * @param {string} filePath - Path to the JSONL file
 * @returns {Promise<Object>} - OpenAI file object
 */
async function uploadFile(filePath) {
  const client = initOpenAI();
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.jsonl') {
    throw new Error('File must be in JSONL format');
  }

  try {
    log.info('Uploading file to OpenAI', { filePath });

    const fileStream = fs.createReadStream(filePath);
    const file = await client.files.create({
      file: fileStream,
      purpose: 'fine-tune'
    });

    log.info('File uploaded to OpenAI', { fileId: file.id, filename: file.filename });
    return file;
  } catch (err) {
    log.error('Failed to upload file to OpenAI', { error: err.message });
    throw new Error(`OpenAI file upload failed: ${err.message}`);
  }
}

/**
 * Create a fine-tuning job
 * @param {string} fileId - OpenAI file ID
 * @param {string} model - Base model (e.g., 'gpt-3.5-turbo')
 * @param {Object} hyperparams - Training hyperparameters
 * @returns {Promise<Object>} - Fine-tuning job object
 */
async function createFineTuneJob(fileId, model = 'gpt-3.5-turbo', hyperparams = {}) {
  const client = initOpenAI();
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  // Validate model
  const supportedModels = ['gpt-3.5-turbo', 'gpt-4-0613', 'gpt-4o-mini-2024-07-18'];
  const baseModel = model.includes('gpt-4') ? 'gpt-4-0613' : 'gpt-3.5-turbo';

  try {
    log.info('Creating fine-tuning job', { fileId, model: baseModel, hyperparams });

    const jobConfig = {
      training_file: fileId,
      model: baseModel
    };

    // Add hyperparameters if provided
    if (hyperparams.n_epochs || hyperparams.epochs) {
      jobConfig.hyperparameters = {
        n_epochs: hyperparams.n_epochs || hyperparams.epochs || 3
      };
    }

    // Add validation file if provided
    if (hyperparams.validation_file) {
      jobConfig.validation_file = hyperparams.validation_file;
    }

    // Add suffix if provided
    if (hyperparams.suffix) {
      jobConfig.suffix = hyperparams.suffix;
    }

    const job = await client.fineTuning.jobs.create(jobConfig);

    log.info('Fine-tuning job created', { jobId: job.id, status: job.status });
    return job;
  } catch (err) {
    log.error('Failed to create fine-tuning job', { error: err.message });
    throw new Error(`OpenAI fine-tuning job creation failed: ${err.message}`);
  }
}

/**
 * Get fine-tuning job status
 * @param {string} jobId - OpenAI job ID
 * @returns {Promise<Object>} - Job status object
 */
async function getJobStatus(jobId) {
  const client = initOpenAI();
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const job = await client.fineTuning.jobs.retrieve(jobId);

    return {
      id: job.id,
      status: job.status,
      model: job.model,
      fine_tuned_model: job.fine_tuned_model,
      created_at: job.created_at,
      finished_at: job.finished_at,
      trained_tokens: job.trained_tokens,
      error: job.error,
      hyperparameters: job.hyperparameters,
      result_files: job.result_files,
      training_file: job.training_file
    };
  } catch (err) {
    log.error('Failed to get job status', { jobId, error: err.message });
    throw new Error(`Failed to get job status: ${err.message}`);
  }
}

/**
 * List fine-tuning job events
 * @param {string} jobId - OpenAI job ID
 * @param {number} limit - Maximum number of events
 * @returns {Promise<Array>} - Array of events
 */
async function listJobEvents(jobId, limit = 100) {
  const client = initOpenAI();
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const events = await client.fineTuning.jobs.listEvents(jobId, { limit });

    return events.data.map(event => ({
      id: event.id,
      object: event.object,
      created_at: event.created_at,
      level: event.level,
      message: event.message,
      type: event.type
    }));
  } catch (err) {
    log.error('Failed to list job events', { jobId, error: err.message });
    throw new Error(`Failed to list job events: ${err.message}`);
  }
}

/**
 * Cancel a fine-tuning job
 * @param {string} jobId - OpenAI job ID
 * @returns {Promise<Object>} - Cancelled job object
 */
async function cancelJob(jobId) {
  const client = initOpenAI();
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    log.info('Cancelling fine-tuning job', { jobId });
    const job = await client.fineTuning.jobs.cancel(jobId);
    log.info('Fine-tuning job cancelled', { jobId, status: job.status });
    return job;
  } catch (err) {
    log.error('Failed to cancel job', { jobId, error: err.message });
    throw new Error(`Failed to cancel job: ${err.message}`);
  }
}

/**
 * Delete a fine-tuned model
 * @param {string} modelId - Fine-tuned model ID
 * @returns {Promise<Object>} - Deletion result
 */
async function deleteModel(modelId) {
  const client = initOpenAI();
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  if (!modelId || !modelId.startsWith('ft:')) {
    throw new Error('Invalid fine-tuned model ID');
  }

  try {
    log.info('Deleting fine-tuned model', { modelId });
    const result = await client.models.del(modelId);
    log.info('Fine-tuned model deleted', { modelId, deleted: result.deleted });
    return result;
  } catch (err) {
    log.error('Failed to delete model', { modelId, error: err.message });
    throw new Error(`Failed to delete model: ${err.message}`);
  }
}

/**
 * Delete a file from OpenAI
 * @param {string} fileId - OpenAI file ID
 * @returns {Promise<Object>} - Deletion result
 */
async function deleteFile(fileId) {
  const client = initOpenAI();
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    log.info('Deleting file from OpenAI', { fileId });
    const result = await client.files.del(fileId);
    log.info('File deleted from OpenAI', { fileId, deleted: result.deleted });
    return result;
  } catch (err) {
    log.error('Failed to delete file', { fileId, error: err.message });
    throw new Error(`Failed to delete file: ${err.message}`);
  }
}

/**
 * Test a fine-tuned model
 * @param {string} modelId - Fine-tuned model ID
 * @param {string} prompt - Test prompt
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Model response
 */
async function testModel(modelId, prompt, options = {}) {
  const client = initOpenAI();
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  if (!modelId) {
    throw new Error('Model ID is required');
  }

  if (!prompt) {
    throw new Error('Prompt is required');
  }

  try {
    log.info('Testing fine-tuned model', { modelId, promptLength: prompt.length });

    const messages = [];

    // Add system message if provided
    if (options.systemMessage) {
      messages.push({
        role: 'system',
        content: options.systemMessage
      });
    }

    // Add user message
    messages.push({
      role: 'user',
      content: prompt
    });

    const completion = await client.chat.completions.create({
      model: modelId,
      messages,
      max_tokens: options.maxTokens || 500,
      temperature: options.temperature || 0.7
    });

    const response = completion.choices[0]?.message?.content || '';

    log.info('Model test completed', { modelId, responseLength: response.length });

    return {
      model_id: modelId,
      prompt,
      response,
      usage: completion.usage,
      finish_reason: completion.choices[0]?.finish_reason
    };
  } catch (err) {
    log.error('Failed to test model', { modelId, error: err.message });
    throw new Error(`Failed to test model: ${err.message}`);
  }
}

/**
 * List all fine-tuning jobs
 * @param {number} limit - Maximum number of jobs
 * @returns {Promise<Array>} - Array of jobs
 */
async function listJobs(limit = 20) {
  const client = initOpenAI();
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const response = await client.fineTuning.jobs.list({ limit });
    return response.data;
  } catch (err) {
    log.error('Failed to list jobs', { error: err.message });
    throw new Error(`Failed to list jobs: ${err.message}`);
  }
}

/**
 * Get file info from OpenAI
 * @param {string} fileId - OpenAI file ID
 * @returns {Promise<Object>} - File object
 */
async function getFile(fileId) {
  const client = initOpenAI();
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const file = await client.files.retrieve(fileId);
    return file;
  } catch (err) {
    log.error('Failed to get file', { fileId, error: err.message });
    throw new Error(`Failed to get file: ${err.message}`);
  }
}

/**
 * Estimate training cost
 * @param {number} tokenCount - Total tokens in training data
 * @param {number} epochs - Number of training epochs
 * @param {string} model - Base model
 * @returns {Object} - Cost estimate
 */
function estimateTrainingCost(tokenCount, epochs = 3, model = 'gpt-3.5-turbo') {
  // Pricing per 1K tokens (as of 2024)
  const pricing = {
    'gpt-3.5-turbo': 0.008,
    'gpt-4-0613': 0.03,
    'gpt-4': 0.03
  };

  const pricePerK = pricing[model] || pricing['gpt-3.5-turbo'];
  const totalTokens = tokenCount * epochs;
  const cost = (totalTokens / 1000) * pricePerK;

  return {
    token_count: tokenCount,
    epochs,
    total_tokens: totalTokens,
    price_per_1k: pricePerK,
    estimated_cost: Math.round(cost * 100) / 100,
    formatted: `$${cost.toFixed(2)}`
  };
}

module.exports = {
  isAvailable,
  uploadFile,
  createFineTuneJob,
  getJobStatus,
  listJobEvents,
  cancelJob,
  deleteModel,
  deleteFile,
  testModel,
  listJobs,
  getFile,
  estimateTrainingCost
};
