/**
 * Fine-Tuning Service
 *
 * Handles AI model fine-tuning operations including:
 * - Model creation and management
 * - Dataset upload and validation
 * - Training job management
 * - OpenAI Fine-tuning API integration
 */

const db = require('../db');
const log = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

// OpenAI SDK for fine-tuning
let openai = null;
try {
  const OpenAI = require('openai');
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch (err) {
  log.warn('OpenAI SDK not available for fine-tuning');
}

/**
 * Create a new fine-tune model
 */
async function createModel(userId, organizationId, data) {
  const { name, description, base_model } = data;

  if (!name || !base_model) {
    throw new Error('Name and base_model are required');
  }

  const validModels = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'];
  if (!validModels.includes(base_model)) {
    throw new Error(`Invalid base model. Must be one of: ${validModels.join(', ')}`);
  }

  const result = await db.query(
    `INSERT INTO fine_tune_models (user_id, organization_id, name, description, base_model, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING *`,
    [userId, organizationId, name, description || '', base_model]
  );

  log.info('Fine-tune model created', { modelId: result.rows[0].id, name, base_model });
  return result.rows[0];
}

/**
 * Get all models for an organization
 */
async function getModels(organizationId, options = {}) {
  const { status, limit = 50, offset = 0 } = options;

  let query = `
    SELECT m.*,
           (SELECT COUNT(*) FROM fine_tune_datasets WHERE fine_tune_model_id = m.id) as dataset_count,
           (SELECT COUNT(*) FROM fine_tune_jobs WHERE fine_tune_model_id = m.id) as job_count
    FROM fine_tune_models m
    WHERE m.organization_id = $1
  `;
  const params = [organizationId];

  if (status) {
    query += ` AND m.status = $${params.length + 1}`;
    params.push(status);
  }

  query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Get a single model by ID
 */
async function getModelById(modelId, organizationId) {
  const result = await db.query(
    `SELECT m.*,
            json_agg(DISTINCT d.*) FILTER (WHERE d.id IS NOT NULL) as datasets,
            json_agg(DISTINCT j.*) FILTER (WHERE j.id IS NOT NULL) as jobs
     FROM fine_tune_models m
     LEFT JOIN fine_tune_datasets d ON d.fine_tune_model_id = m.id
     LEFT JOIN fine_tune_jobs j ON j.fine_tune_model_id = m.id
     WHERE m.id = $1 AND m.organization_id = $2
     GROUP BY m.id`,
    [modelId, organizationId]
  );

  if (result.rows.length === 0) {
    throw new Error('Model not found');
  }

  return result.rows[0];
}

/**
 * Update a model
 */
async function updateModel(modelId, organizationId, data) {
  const { name, description, settings } = data;

  const updates = [];
  const params = [modelId, organizationId];

  if (name !== undefined) {
    updates.push(`name = $${params.length + 1}`);
    params.push(name);
  }
  if (description !== undefined) {
    updates.push(`description = $${params.length + 1}`);
    params.push(description);
  }
  if (settings !== undefined) {
    updates.push(`settings = $${params.length + 1}`);
    params.push(JSON.stringify(settings));
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  const result = await db.query(
    `UPDATE fine_tune_models
     SET ${updates.join(', ')}
     WHERE id = $1 AND organization_id = $2
     RETURNING *`,
    params
  );

  if (result.rows.length === 0) {
    throw new Error('Model not found');
  }

  return result.rows[0];
}

/**
 * Delete a model
 */
async function deleteModel(modelId, organizationId) {
  // Check if model exists and is not in training
  const model = await getModelById(modelId, organizationId);

  if (model.status === 'training') {
    throw new Error('Cannot delete a model that is currently training');
  }

  // Delete associated files from storage
  const datasets = await db.query(
    'SELECT file_path FROM fine_tune_datasets WHERE fine_tune_model_id = $1',
    [modelId]
  );

  for (const dataset of datasets.rows) {
    if (dataset.file_path) {
      try {
        await fs.unlink(dataset.file_path);
      } catch (err) {
        log.warn('Failed to delete dataset file', { path: dataset.file_path });
      }
    }
  }

  await db.query(
    'DELETE FROM fine_tune_models WHERE id = $1 AND organization_id = $2',
    [modelId, organizationId]
  );

  log.info('Fine-tune model deleted', { modelId });
  return { success: true };
}

/**
 * Upload and save a dataset
 */
async function uploadDataset(modelId, organizationId, file) {
  // Verify model exists and belongs to org
  const model = await getModelById(modelId, organizationId);

  if (!file || !file.buffer) {
    throw new Error('No file provided');
  }

  const fileName = file.originalname;
  const fileSize = file.size;
  const format = path.extname(fileName).toLowerCase().replace('.', '') || 'jsonl';

  if (!['jsonl', 'csv', 'json'].includes(format)) {
    throw new Error('Invalid file format. Must be JSONL, CSV, or JSON');
  }

  // Create dataset record
  const result = await db.query(
    `INSERT INTO fine_tune_datasets (fine_tune_model_id, file_name, file_size, format, status)
     VALUES ($1, $2, $3, $4, 'processing')
     RETURNING *`,
    [modelId, fileName, fileSize, format]
  );

  const dataset = result.rows[0];

  // Save file to disk
  const uploadDir = path.join(__dirname, '../uploads/fine-tuning');
  await fs.mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, `${dataset.id}_${fileName}`);
  await fs.writeFile(filePath, file.buffer);

  // Update with file path
  await db.query(
    'UPDATE fine_tune_datasets SET file_path = $1, file_url = $2 WHERE id = $3',
    [filePath, `/uploads/fine-tuning/${dataset.id}_${fileName}`, dataset.id]
  );

  // Validate dataset asynchronously
  validateDataset(dataset.id, filePath, format).catch(err => {
    log.error('Dataset validation failed', { datasetId: dataset.id, error: err.message });
  });

  // Update model status
  await db.query(
    "UPDATE fine_tune_models SET status = 'uploading' WHERE id = $1",
    [modelId]
  );

  log.info('Dataset uploaded', { datasetId: dataset.id, modelId, fileName });
  return { ...dataset, file_path: filePath };
}

/**
 * Validate a dataset file
 */
async function validateDataset(datasetId, filePath, format) {
  try {
    await db.query(
      "UPDATE fine_tune_datasets SET status = 'validating' WHERE id = $1",
      [datasetId]
    );

    const content = await fs.readFile(filePath, 'utf-8');
    const errors = [];
    let rowCount = 0;

    if (format === 'jsonl') {
      const lines = content.trim().split('\n');
      rowCount = lines.length;

      for (let i = 0; i < lines.length; i++) {
        try {
          const line = JSON.parse(lines[i]);

          // Check for required fields (OpenAI format)
          if (!line.messages || !Array.isArray(line.messages)) {
            errors.push({ line: i + 1, error: 'Missing or invalid "messages" array' });
            continue;
          }

          // Check message structure
          for (const msg of line.messages) {
            if (!msg.role || !msg.content) {
              errors.push({ line: i + 1, error: 'Message missing "role" or "content"' });
            }
            if (!['system', 'user', 'assistant'].includes(msg.role)) {
              errors.push({ line: i + 1, error: `Invalid role: ${msg.role}` });
            }
          }
        } catch (parseErr) {
          errors.push({ line: i + 1, error: 'Invalid JSON' });
        }
      }
    } else if (format === 'json') {
      try {
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
          rowCount = data.length;
        } else {
          errors.push({ error: 'JSON must be an array of training examples' });
        }
      } catch (parseErr) {
        errors.push({ error: 'Invalid JSON file' });
      }
    } else if (format === 'csv') {
      const lines = content.trim().split('\n');
      rowCount = lines.length - 1; // Exclude header

      if (rowCount < 10) {
        errors.push({ error: 'CSV must have at least 10 training examples' });
      }
    }

    // Minimum training examples
    if (rowCount < 10) {
      errors.push({ error: 'Must have at least 10 training examples' });
    }

    const status = errors.length > 0 ? 'error' : 'ready';
    await db.query(
      `UPDATE fine_tune_datasets
       SET status = $1, row_count = $2, validation_errors = $3
       WHERE id = $4`,
      [status, rowCount, JSON.stringify(errors), datasetId]
    );

    // Update model status if dataset is ready
    if (status === 'ready') {
      const dataset = await db.query('SELECT fine_tune_model_id FROM fine_tune_datasets WHERE id = $1', [datasetId]);
      await db.query(
        "UPDATE fine_tune_models SET status = 'pending' WHERE id = $1",
        [dataset.rows[0].fine_tune_model_id]
      );
    }

    log.info('Dataset validated', { datasetId, rowCount, errorCount: errors.length });
    return { rowCount, errors };
  } catch (err) {
    await db.query(
      "UPDATE fine_tune_datasets SET status = 'error', validation_errors = $1 WHERE id = $2",
      [JSON.stringify([{ error: err.message }]), datasetId]
    );
    throw err;
  }
}

/**
 * Start training a model
 */
async function startTraining(modelId, organizationId, config = {}) {
  const model = await getModelById(modelId, organizationId);

  if (model.status === 'training') {
    throw new Error('Model is already training');
  }

  // Get ready dataset
  const datasets = await db.query(
    "SELECT * FROM fine_tune_datasets WHERE fine_tune_model_id = $1 AND status = 'ready' ORDER BY created_at DESC LIMIT 1",
    [modelId]
  );

  if (datasets.rows.length === 0) {
    throw new Error('No valid dataset available. Please upload and validate a dataset first.');
  }

  const dataset = datasets.rows[0];

  // Default training config
  const trainingConfig = {
    epochs: config.epochs || 3,
    batch_size: config.batch_size || 1,
    learning_rate: config.learning_rate || 0.0001,
    ...config
  };

  // Create job record
  const jobResult = await db.query(
    `INSERT INTO fine_tune_jobs (fine_tune_model_id, epochs, batch_size, learning_rate, status, hyperparameters)
     VALUES ($1, $2, $3, $4, 'pending', $5)
     RETURNING *`,
    [modelId, trainingConfig.epochs, trainingConfig.batch_size, trainingConfig.learning_rate, JSON.stringify(trainingConfig)]
  );

  const job = jobResult.rows[0];

  // Update model status
  await db.query(
    "UPDATE fine_tune_models SET status = 'training', training_started_at = CURRENT_TIMESTAMP WHERE id = $1",
    [modelId]
  );

  // Start training with OpenAI (if available)
  if (openai && model.base_model.startsWith('gpt')) {
    startOpenAIFineTuning(job.id, modelId, dataset, model.base_model, trainingConfig).catch(err => {
      log.error('OpenAI fine-tuning failed', { jobId: job.id, error: err.message });
    });
  } else {
    // Simulate training for demo/non-OpenAI models
    simulateTraining(job.id, modelId).catch(err => {
      log.error('Training simulation failed', { jobId: job.id, error: err.message });
    });
  }

  log.info('Training started', { modelId, jobId: job.id });
  return job;
}

/**
 * Start OpenAI fine-tuning job
 */
async function startOpenAIFineTuning(jobId, modelId, dataset, baseModel, config) {
  try {
    // Update job status
    await db.query("UPDATE fine_tune_jobs SET status = 'validating_files' WHERE id = $1", [jobId]);

    // Read and upload file to OpenAI
    const fileContent = await fs.readFile(dataset.file_path);
    const file = await openai.files.create({
      file: fileContent,
      purpose: 'fine-tune'
    });

    // Update dataset with OpenAI file ID
    await db.query(
      'UPDATE fine_tune_datasets SET openai_file_id = $1 WHERE id = $2',
      [file.id, dataset.id]
    );

    // Create fine-tuning job
    const fineTuneJob = await openai.fineTuning.jobs.create({
      training_file: file.id,
      model: baseModel,
      hyperparameters: {
        n_epochs: config.epochs
      }
    });

    // Update job with OpenAI job ID
    await db.query(
      "UPDATE fine_tune_jobs SET job_id = $1, status = 'queued', started_at = CURRENT_TIMESTAMP WHERE id = $2",
      [fineTuneJob.id, jobId]
    );

    log.info('OpenAI fine-tuning job created', { jobId, openaiJobId: fineTuneJob.id });

    // Poll for status updates
    pollOpenAIJobStatus(jobId, fineTuneJob.id, modelId);

  } catch (err) {
    await db.query(
      "UPDATE fine_tune_jobs SET status = 'failed', error_message = $1 WHERE id = $2",
      [err.message, jobId]
    );
    await db.query("UPDATE fine_tune_models SET status = 'failed' WHERE id = $1", [modelId]);
    throw err;
  }
}

/**
 * Poll OpenAI job status
 */
async function pollOpenAIJobStatus(jobId, openaiJobId, modelId) {
  const pollInterval = setInterval(async () => {
    try {
      const job = await openai.fineTuning.jobs.retrieve(openaiJobId);

      // Update job status
      await db.query(
        `UPDATE fine_tune_jobs
         SET status = $1, trained_tokens = $2
         WHERE id = $3`,
        [job.status, job.trained_tokens || 0, jobId]
      );

      if (job.status === 'succeeded') {
        clearInterval(pollInterval);

        // Update job and model with results
        await db.query(
          `UPDATE fine_tune_jobs
           SET status = 'succeeded', result_model_id = $1, completed_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [job.fine_tuned_model, jobId]
        );

        await db.query(
          `UPDATE fine_tune_models
           SET status = 'completed', model_id = $1, training_completed_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [job.fine_tuned_model, modelId]
        );

        log.info('Fine-tuning completed', { jobId, modelId: job.fine_tuned_model });

      } else if (job.status === 'failed' || job.status === 'cancelled') {
        clearInterval(pollInterval);

        await db.query(
          "UPDATE fine_tune_jobs SET status = $1, error_message = $2 WHERE id = $3",
          [job.status, job.error?.message || 'Unknown error', jobId]
        );

        await db.query("UPDATE fine_tune_models SET status = $1 WHERE id = $2", [job.status, modelId]);
      }

    } catch (err) {
      log.error('Error polling OpenAI job', { jobId, error: err.message });
    }
  }, 30000); // Poll every 30 seconds
}

/**
 * Simulate training for demo purposes
 */
async function simulateTraining(jobId, modelId) {
  const stages = [
    { status: 'validating_files', delay: 2000 },
    { status: 'queued', delay: 3000 },
    { status: 'running', delay: 10000 },
    { status: 'succeeded', delay: 5000 }
  ];

  for (const stage of stages) {
    await new Promise(resolve => setTimeout(resolve, stage.delay));

    await db.query(
      'UPDATE fine_tune_jobs SET status = $1 WHERE id = $2',
      [stage.status, jobId]
    );

    if (stage.status === 'running') {
      // Update with mock metrics
      await db.query(
        `UPDATE fine_tune_jobs
         SET trained_tokens = 5000, training_metrics = $1
         WHERE id = $2`,
        [JSON.stringify({ loss: 0.5, accuracy: 0.85 }), jobId]
      );
    }
  }

  // Mark as completed
  const mockModelId = `ft:gpt-3.5-turbo:demo:${Date.now()}`;
  await db.query(
    `UPDATE fine_tune_jobs
     SET result_model_id = $1, completed_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [mockModelId, jobId]
  );

  await db.query(
    `UPDATE fine_tune_models
     SET status = 'completed', model_id = $1, training_completed_at = CURRENT_TIMESTAMP,
         metrics = $2
     WHERE id = $3`,
    [mockModelId, JSON.stringify({ loss: 0.25, accuracy: 0.92, epochs: 3 }), modelId]
  );

  log.info('Training simulation completed', { jobId, modelId });
}

/**
 * Get training status
 */
async function getTrainingStatus(modelId, organizationId) {
  const model = await getModelById(modelId, organizationId);

  const latestJob = await db.query(
    `SELECT * FROM fine_tune_jobs
     WHERE fine_tune_model_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [modelId]
  );

  return {
    model_status: model.status,
    job: latestJob.rows[0] || null,
    metrics: model.metrics
  };
}

/**
 * Cancel training
 */
async function cancelTraining(modelId, organizationId) {
  const model = await getModelById(modelId, organizationId);

  if (model.status !== 'training') {
    throw new Error('Model is not currently training');
  }

  // Get active job
  const job = await db.query(
    "SELECT * FROM fine_tune_jobs WHERE fine_tune_model_id = $1 AND status IN ('pending', 'queued', 'running') ORDER BY created_at DESC LIMIT 1",
    [modelId]
  );

  if (job.rows.length > 0 && job.rows[0].job_id && openai) {
    try {
      await openai.fineTuning.jobs.cancel(job.rows[0].job_id);
    } catch (err) {
      log.warn('Failed to cancel OpenAI job', { error: err.message });
    }
  }

  // Update statuses
  await db.query(
    "UPDATE fine_tune_jobs SET status = 'cancelled' WHERE fine_tune_model_id = $1 AND status IN ('pending', 'queued', 'running')",
    [modelId]
  );

  await db.query(
    "UPDATE fine_tune_models SET status = 'cancelled' WHERE id = $1",
    [modelId]
  );

  log.info('Training cancelled', { modelId });
  return { success: true };
}

/**
 * Get a single dataset by ID
 */
async function getDatasetById(datasetId, modelId) {
  const result = await db.query(
    `SELECT * FROM fine_tune_datasets
     WHERE id = $1 AND fine_tune_model_id = $2`,
    [datasetId, modelId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Get all datasets for a model
 */
async function getDatasets(modelId) {
  const result = await db.query(
    `SELECT * FROM fine_tune_datasets
     WHERE fine_tune_model_id = $1
     ORDER BY created_at DESC`,
    [modelId]
  );

  return result.rows;
}

/**
 * Update a dataset
 */
async function updateDataset(datasetId, data) {
  const { file_path, format, row_count, status, validation_errors } = data;

  const updates = [];
  const params = [datasetId];

  if (file_path !== undefined) {
    updates.push(`file_path = $${params.length + 1}`);
    params.push(file_path);
  }
  if (format !== undefined) {
    updates.push(`format = $${params.length + 1}`);
    params.push(format);
  }
  if (row_count !== undefined) {
    updates.push(`row_count = $${params.length + 1}`);
    params.push(row_count);
  }
  if (status !== undefined) {
    updates.push(`status = $${params.length + 1}`);
    params.push(status);
  }
  if (validation_errors !== undefined) {
    updates.push(`validation_errors = $${params.length + 1}`);
    params.push(JSON.stringify(validation_errors));
  }

  if (updates.length === 0) {
    return null;
  }

  const result = await db.query(
    `UPDATE fine_tune_datasets
     SET ${updates.join(', ')}
     WHERE id = $1
     RETURNING *`,
    params
  );

  return result.rows[0];
}

/**
 * Delete a dataset
 */
async function deleteDataset(datasetId, modelId) {
  const result = await db.query(
    `DELETE FROM fine_tune_datasets
     WHERE id = $1 AND fine_tune_model_id = $2
     RETURNING *`,
    [datasetId, modelId]
  );

  if (result.rows.length === 0) {
    throw new Error('Dataset not found');
  }

  log.info('Dataset deleted', { datasetId, modelId });
  return { success: true };
}

/**
 * Get model metrics
 */
async function getModelMetrics(modelId, organizationId) {
  const model = await getModelById(modelId, organizationId);

  const jobs = await db.query(
    'SELECT * FROM fine_tune_jobs WHERE fine_tune_model_id = $1 ORDER BY created_at DESC',
    [modelId]
  );

  return {
    model_id: model.id,
    status: model.status,
    base_model: model.base_model,
    fine_tuned_model: model.model_id,
    metrics: model.metrics,
    training_cost: model.training_cost,
    training_started_at: model.training_started_at,
    training_completed_at: model.training_completed_at,
    jobs: jobs.rows
  };
}

module.exports = {
  createModel,
  getModels,
  getModelById,
  updateModel,
  deleteModel,
  uploadDataset,
  validateDataset,
  startTraining,
  getTrainingStatus,
  cancelTraining,
  getModelMetrics,
  getDatasetById,
  getDatasets,
  updateDataset,
  deleteDataset
};
