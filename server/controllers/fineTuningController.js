/**
 * Fine-Tuning Controller
 *
 * Handles fine-tuning training workflow:
 * - Dataset preparation
 * - OpenAI file upload
 * - Job creation and monitoring
 * - Status updates
 */

const db = require('../db');
const log = require('../utils/logger');
const openaiFineTuning = require('../services/openaiFineTuning');
const datasetValidator = require('../services/datasetValidator');
const path = require('path');
const fs = require('fs');

/**
 * Start training for a model
 * @param {number} modelId - Model ID
 * @param {number} organizationId - Organization ID
 * @param {Object} config - Training configuration
 * @returns {Promise<Object>} - Job object
 */
async function startTraining(modelId, organizationId, config = {}) {
  // 1. Get model and verify ownership
  const modelResult = await db.query(
    'SELECT * FROM fine_tune_models WHERE id = $1 AND organization_id = $2',
    [modelId, organizationId]
  );

  if (modelResult.rows.length === 0) {
    throw new Error('Model not found');
  }

  const model = modelResult.rows[0];

  if (model.status === 'training') {
    throw new Error('Model is already in training');
  }

  // 2. Get the latest ready dataset
  const datasetResult = await db.query(
    `SELECT * FROM fine_tune_datasets
     WHERE fine_tune_model_id = $1 AND status = 'ready'
     ORDER BY created_at DESC LIMIT 1`,
    [modelId]
  );

  if (datasetResult.rows.length === 0) {
    throw new Error('No valid dataset available. Please upload and validate a dataset first.');
  }

  const dataset = datasetResult.rows[0];

  // 3. Convert to JSONL if necessary
  let jsonlPath = dataset.file_path;
  const ext = path.extname(dataset.file_path).toLowerCase();

  if (ext !== '.jsonl') {
    log.info('Converting dataset to JSONL', { datasetId: dataset.id, format: ext });

    const outputPath = dataset.file_path.replace(ext, '.jsonl');

    if (ext === '.csv') {
      await datasetValidator.convertCSVtoJSONL(dataset.file_path, outputPath);
    } else if (ext === '.json') {
      await datasetValidator.convertJSONtoJSONL(dataset.file_path, outputPath);
    } else {
      throw new Error('Unsupported file format for training');
    }

    jsonlPath = outputPath;

    // Update dataset record
    await db.query(
      'UPDATE fine_tune_datasets SET file_path = $1, format = $2 WHERE id = $3',
      [outputPath, 'jsonl', dataset.id]
    );
  }

  // 4. Check if OpenAI is available
  if (!openaiFineTuning.isAvailable()) {
    // Fall back to simulation mode
    log.warn('OpenAI not available, using simulation mode');
    return startSimulatedTraining(modelId, dataset, config);
  }

  // 5. Upload file to OpenAI
  log.info('Uploading dataset to OpenAI', { modelId, datasetId: dataset.id });

  await db.query(
    "UPDATE fine_tune_models SET status = 'uploading' WHERE id = $1",
    [modelId]
  );

  let openaiFile;
  try {
    openaiFile = await openaiFineTuning.uploadFile(jsonlPath);
  } catch (err) {
    await db.query(
      "UPDATE fine_tune_models SET status = 'failed' WHERE id = $1",
      [modelId]
    );
    throw new Error(`Failed to upload file to OpenAI: ${err.message}`);
  }

  // Update dataset with OpenAI file ID
  await db.query(
    'UPDATE fine_tune_datasets SET openai_file_id = $1 WHERE id = $2',
    [openaiFile.id, dataset.id]
  );

  // 6. Create fine-tuning job
  log.info('Creating fine-tuning job', { modelId, fileId: openaiFile.id });

  await db.query(
    "UPDATE fine_tune_models SET status = 'validating' WHERE id = $1",
    [modelId]
  );

  const hyperparams = {
    n_epochs: config.epochs || 3,
    suffix: `model-${modelId}`
  };

  let openaiJob;
  try {
    openaiJob = await openaiFineTuning.createFineTuneJob(
      openaiFile.id,
      model.base_model,
      hyperparams
    );
  } catch (err) {
    await db.query(
      "UPDATE fine_tune_models SET status = 'failed' WHERE id = $1",
      [modelId]
    );
    throw new Error(`Failed to create fine-tuning job: ${err.message}`);
  }

  // 7. Create job record in database
  const jobResult = await db.query(
    `INSERT INTO fine_tune_jobs (
      fine_tune_model_id, job_id, provider, status, epochs, batch_size, learning_rate,
      hyperparameters, started_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
    RETURNING *`,
    [
      modelId,
      openaiJob.id,
      'openai',
      openaiJob.status,
      config.epochs || 3,
      config.batch_size || 1,
      config.learning_rate || 0.0001,
      JSON.stringify(hyperparams)
    ]
  );

  // 8. Update model status
  await db.query(
    "UPDATE fine_tune_models SET status = 'training', training_started_at = CURRENT_TIMESTAMP WHERE id = $1",
    [modelId]
  );

  log.info('Fine-tuning job started', {
    modelId,
    jobId: openaiJob.id,
    status: openaiJob.status
  });

  return {
    job: jobResult.rows[0],
    openai_job: openaiJob
  };
}

/**
 * Start simulated training (when OpenAI is not available)
 */
async function startSimulatedTraining(modelId, dataset, config) {
  // Create job record
  const jobResult = await db.query(
    `INSERT INTO fine_tune_jobs (
      fine_tune_model_id, job_id, provider, status, epochs, batch_size, learning_rate,
      hyperparameters, started_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
    RETURNING *`,
    [
      modelId,
      `sim_${Date.now()}`,
      'simulation',
      'running',
      config.epochs || 3,
      config.batch_size || 1,
      config.learning_rate || 0.0001,
      JSON.stringify({ simulation: true })
    ]
  );

  // Update model status
  await db.query(
    "UPDATE fine_tune_models SET status = 'training', training_started_at = CURRENT_TIMESTAMP WHERE id = $1",
    [modelId]
  );

  // Schedule simulation completion
  const jobId = jobResult.rows[0].id;
  setTimeout(async () => {
    await completeSimulatedTraining(modelId, jobId);
  }, 20000); // Complete after 20 seconds

  log.info('Simulated training started', { modelId, jobId });

  return {
    job: jobResult.rows[0],
    simulation: true
  };
}

/**
 * Complete simulated training
 */
async function completeSimulatedTraining(modelId, jobId) {
  try {
    const mockModelId = `ft:gpt-3.5-turbo:simulation:${Date.now()}`;

    // Update job
    await db.query(
      `UPDATE fine_tune_jobs SET
        status = 'succeeded',
        result_model_id = $1,
        trained_tokens = 5000,
        training_metrics = $2,
        completed_at = CURRENT_TIMESTAMP
      WHERE id = $3`,
      [mockModelId, JSON.stringify({ loss: 0.25, accuracy: 0.92 }), jobId]
    );

    // Update model
    await db.query(
      `UPDATE fine_tune_models SET
        status = 'completed',
        model_id = $1,
        training_completed_at = CURRENT_TIMESTAMP,
        metrics = $2
      WHERE id = $3`,
      [mockModelId, JSON.stringify({ loss: 0.25, accuracy: 0.92, epochs: 3 }), modelId]
    );

    log.info('Simulated training completed', { modelId, jobId, mockModelId });
  } catch (err) {
    log.error('Failed to complete simulated training', { error: err.message });
  }
}

/**
 * Poll and update training status for a specific job
 * @param {string} openaiJobId - OpenAI job ID
 * @param {number} dbJobId - Database job ID
 * @param {number} modelId - Model ID
 */
async function updateJobStatus(openaiJobId, dbJobId, modelId) {
  if (!openaiFineTuning.isAvailable()) {
    return; // Skip for simulation
  }

  try {
    const status = await openaiFineTuning.getJobStatus(openaiJobId);

    // Update job record
    const updateFields = {
      status: status.status,
      trained_tokens: status.trained_tokens || 0
    };

    if (status.error) {
      updateFields.error_message = status.error.message || JSON.stringify(status.error);
    }

    if (status.fine_tuned_model) {
      updateFields.result_model_id = status.fine_tuned_model;
    }

    if (status.status === 'succeeded' || status.status === 'failed' || status.status === 'cancelled') {
      updateFields.completed_at = new Date();
    }

    await db.query(
      `UPDATE fine_tune_jobs SET
        status = $1,
        trained_tokens = $2,
        error_message = $3,
        result_model_id = $4,
        completed_at = $5
      WHERE id = $6`,
      [
        updateFields.status,
        updateFields.trained_tokens,
        updateFields.error_message || null,
        updateFields.result_model_id || null,
        updateFields.completed_at || null,
        dbJobId
      ]
    );

    // Update model status based on job status
    let modelStatus = 'training';
    if (status.status === 'succeeded') {
      modelStatus = 'completed';

      // Update model with fine-tuned model ID
      await db.query(
        `UPDATE fine_tune_models SET
          status = $1,
          model_id = $2,
          training_completed_at = CURRENT_TIMESTAMP
        WHERE id = $3`,
        [modelStatus, status.fine_tuned_model, modelId]
      );
    } else if (status.status === 'failed') {
      modelStatus = 'failed';
      await db.query(
        'UPDATE fine_tune_models SET status = $1 WHERE id = $2',
        [modelStatus, modelId]
      );
    } else if (status.status === 'cancelled') {
      modelStatus = 'cancelled';
      await db.query(
        'UPDATE fine_tune_models SET status = $1 WHERE id = $2',
        [modelStatus, modelId]
      );
    }

    log.info('Job status updated', {
      jobId: openaiJobId,
      status: status.status,
      trainedTokens: status.trained_tokens
    });

    return status;
  } catch (err) {
    log.error('Failed to update job status', { jobId: openaiJobId, error: err.message });
    throw err;
  }
}

/**
 * Get training events for a job
 * @param {number} modelId - Model ID
 * @param {number} organizationId - Organization ID
 * @returns {Promise<Array>} - Array of events
 */
async function getTrainingEvents(modelId, organizationId) {
  // Verify model ownership
  const modelResult = await db.query(
    'SELECT * FROM fine_tune_models WHERE id = $1 AND organization_id = $2',
    [modelId, organizationId]
  );

  if (modelResult.rows.length === 0) {
    throw new Error('Model not found');
  }

  // Get latest job
  const jobResult = await db.query(
    'SELECT * FROM fine_tune_jobs WHERE fine_tune_model_id = $1 ORDER BY created_at DESC LIMIT 1',
    [modelId]
  );

  if (jobResult.rows.length === 0) {
    return [];
  }

  const job = jobResult.rows[0];

  // If simulation, return mock events
  if (job.provider === 'simulation') {
    return generateMockEvents(job);
  }

  // Get events from OpenAI
  if (!openaiFineTuning.isAvailable() || !job.job_id) {
    return [];
  }

  try {
    return await openaiFineTuning.listJobEvents(job.job_id);
  } catch (err) {
    log.error('Failed to get training events', { error: err.message });
    return [];
  }
}

/**
 * Generate mock events for simulation
 */
function generateMockEvents(job) {
  const events = [];
  const baseTime = new Date(job.started_at).getTime();

  events.push({
    id: 'evt_1',
    created_at: Math.floor(baseTime / 1000),
    level: 'info',
    message: 'Fine-tuning job started'
  });

  if (job.status === 'running' || job.status === 'succeeded') {
    events.push({
      id: 'evt_2',
      created_at: Math.floor((baseTime + 5000) / 1000),
      level: 'info',
      message: 'Training data validated successfully'
    });

    events.push({
      id: 'evt_3',
      created_at: Math.floor((baseTime + 10000) / 1000),
      level: 'info',
      message: 'Training started'
    });
  }

  if (job.status === 'succeeded') {
    events.push({
      id: 'evt_4',
      created_at: Math.floor((baseTime + 15000) / 1000),
      level: 'info',
      message: 'Training completed successfully'
    });

    events.push({
      id: 'evt_5',
      created_at: Math.floor((baseTime + 20000) / 1000),
      level: 'info',
      message: `Fine-tuned model created: ${job.result_model_id}`
    });
  }

  return events.reverse(); // Most recent first
}

/**
 * Cancel training for a model
 * @param {number} modelId - Model ID
 * @param {number} organizationId - Organization ID
 */
async function cancelTraining(modelId, organizationId) {
  // Verify model ownership
  const modelResult = await db.query(
    'SELECT * FROM fine_tune_models WHERE id = $1 AND organization_id = $2',
    [modelId, organizationId]
  );

  if (modelResult.rows.length === 0) {
    throw new Error('Model not found');
  }

  const model = modelResult.rows[0];

  if (model.status !== 'training') {
    throw new Error('Model is not currently training');
  }

  // Get active job
  const jobResult = await db.query(
    `SELECT * FROM fine_tune_jobs
     WHERE fine_tune_model_id = $1 AND status IN ('pending', 'running', 'queued', 'validating_files')
     ORDER BY created_at DESC LIMIT 1`,
    [modelId]
  );

  if (jobResult.rows.length === 0) {
    throw new Error('No active training job found');
  }

  const job = jobResult.rows[0];

  // Cancel on OpenAI if applicable
  if (job.provider === 'openai' && job.job_id && openaiFineTuning.isAvailable()) {
    try {
      await openaiFineTuning.cancelJob(job.job_id);
    } catch (err) {
      log.warn('Failed to cancel OpenAI job', { error: err.message });
    }
  }

  // Update database
  await db.query(
    "UPDATE fine_tune_jobs SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP WHERE id = $1",
    [job.id]
  );

  await db.query(
    "UPDATE fine_tune_models SET status = 'cancelled' WHERE id = $1",
    [modelId]
  );

  log.info('Training cancelled', { modelId, jobId: job.id });

  return { success: true };
}

/**
 * Test a fine-tuned model
 * @param {number} modelId - Model ID
 * @param {number} organizationId - Organization ID
 * @param {string} prompt - Test prompt
 * @param {Object} options - Additional options
 */
async function testModel(modelId, organizationId, prompt, options = {}) {
  // Verify model ownership
  const modelResult = await db.query(
    'SELECT * FROM fine_tune_models WHERE id = $1 AND organization_id = $2',
    [modelId, organizationId]
  );

  if (modelResult.rows.length === 0) {
    throw new Error('Model not found');
  }

  const model = modelResult.rows[0];

  if (!model.model_id) {
    throw new Error('Model has not been trained yet');
  }

  if (model.status !== 'completed') {
    throw new Error('Model training is not complete');
  }

  // Check if this is a simulation model
  if (model.model_id.includes('simulation')) {
    // Return mock response
    return {
      model_id: model.model_id,
      prompt,
      response: `[Simulated response] This is a test response from the fine-tuned model. Your prompt was: "${prompt}"`,
      usage: {
        prompt_tokens: Math.ceil(prompt.length / 4),
        completion_tokens: 50,
        total_tokens: Math.ceil(prompt.length / 4) + 50
      },
      simulation: true
    };
  }

  // Test with OpenAI
  if (!openaiFineTuning.isAvailable()) {
    throw new Error('OpenAI API is not available');
  }

  return await openaiFineTuning.testModel(model.model_id, prompt, options);
}

module.exports = {
  startTraining,
  updateJobStatus,
  getTrainingEvents,
  cancelTraining,
  testModel
};
