/**
 * Metrics Service
 *
 * Handles training metrics collection and analysis:
 * - Save and retrieve training metrics
 * - Calculate accuracy and loss history
 * - Model comparison
 * - Usage statistics
 */

const db = require('../db');
const log = require('../utils/logger');

/**
 * Save training metrics from OpenAI
 * @param {number} modelId - Fine-tune model ID
 * @param {string} jobId - OpenAI job ID
 * @param {Object} metrics - Metrics data
 */
async function saveTrainingMetrics(modelId, jobId, metrics) {
  try {
    const result = await db.query(
      `INSERT INTO fine_tuning_metrics (
        fine_tune_model_id, job_id, step, epoch,
        train_loss, valid_loss, train_accuracy, valid_accuracy,
        learning_rate, tokens_processed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        modelId,
        jobId,
        metrics.step || 0,
        metrics.epoch || 0,
        metrics.train_loss || null,
        metrics.valid_loss || null,
        metrics.train_accuracy || null,
        metrics.valid_accuracy || null,
        metrics.learning_rate || null,
        metrics.tokens_processed || 0
      ]
    );

    log.debug('Training metrics saved', { modelId, jobId, step: metrics.step });
    return result.rows[0];
  } catch (err) {
    log.error('Failed to save training metrics', { error: err.message });
    throw err;
  }
}

/**
 * Save batch of metrics
 * @param {number} modelId - Fine-tune model ID
 * @param {string} jobId - OpenAI job ID
 * @param {Array} metricsArray - Array of metrics
 */
async function saveBatchMetrics(modelId, jobId, metricsArray) {
  if (!metricsArray || metricsArray.length === 0) return [];

  const values = [];
  const placeholders = [];
  let paramIndex = 1;

  for (const metrics of metricsArray) {
    placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
    values.push(
      modelId,
      jobId,
      metrics.step || 0,
      metrics.epoch || 0,
      metrics.train_loss || null,
      metrics.valid_loss || null,
      metrics.train_accuracy || null,
      metrics.valid_accuracy || null,
      metrics.learning_rate || null,
      metrics.tokens_processed || 0
    );
  }

  try {
    const result = await db.query(
      `INSERT INTO fine_tuning_metrics (
        fine_tune_model_id, job_id, step, epoch,
        train_loss, valid_loss, train_accuracy, valid_accuracy,
        learning_rate, tokens_processed
      ) VALUES ${placeholders.join(', ')}
      ON CONFLICT DO NOTHING
      RETURNING *`,
      values
    );

    log.info('Batch metrics saved', { modelId, count: result.rows.length });
    return result.rows;
  } catch (err) {
    log.error('Failed to save batch metrics', { error: err.message });
    throw err;
  }
}

/**
 * Get training history for a model
 * @param {number} modelId - Fine-tune model ID
 * @returns {Promise<Array>} - Training history
 */
async function getTrainingHistory(modelId) {
  const result = await db.query(
    `SELECT * FROM fine_tuning_metrics
     WHERE fine_tune_model_id = $1
     ORDER BY step ASC, created_at ASC`,
    [modelId]
  );

  return result.rows;
}

/**
 * Get loss history for a job
 * @param {number} modelId - Fine-tune model ID
 * @param {string} jobId - Optional job ID filter
 * @returns {Promise<Array>} - Loss history
 */
async function getLossHistory(modelId, jobId = null) {
  let query = `
    SELECT step, epoch, train_loss, valid_loss, created_at
    FROM fine_tuning_metrics
    WHERE fine_tune_model_id = $1
  `;
  const params = [modelId];

  if (jobId) {
    query += ' AND job_id = $2';
    params.push(jobId);
  }

  query += ' ORDER BY step ASC, created_at ASC';

  const result = await db.query(query, params);

  return result.rows.map(row => ({
    step: row.step,
    epoch: row.epoch,
    trainLoss: parseFloat(row.train_loss) || null,
    validLoss: parseFloat(row.valid_loss) || null,
    timestamp: row.created_at
  }));
}

/**
 * Get accuracy history for a model
 * @param {number} modelId - Fine-tune model ID
 * @param {string} jobId - Optional job ID filter
 * @returns {Promise<Array>} - Accuracy history
 */
async function getAccuracyHistory(modelId, jobId = null) {
  let query = `
    SELECT step, epoch, train_accuracy, valid_accuracy, created_at
    FROM fine_tuning_metrics
    WHERE fine_tune_model_id = $1
  `;
  const params = [modelId];

  if (jobId) {
    query += ' AND job_id = $2';
    params.push(jobId);
  }

  query += ' ORDER BY step ASC, created_at ASC';

  const result = await db.query(query, params);

  return result.rows.map(row => ({
    step: row.step,
    epoch: row.epoch,
    trainAccuracy: parseFloat(row.train_accuracy) || null,
    validAccuracy: parseFloat(row.valid_accuracy) || null,
    timestamp: row.created_at
  }));
}

/**
 * Calculate final accuracy for a model
 * @param {number} modelId - Fine-tune model ID
 * @returns {Promise<Object>} - Accuracy metrics
 */
async function calculateAccuracy(modelId) {
  const result = await db.query(
    `SELECT
      AVG(train_accuracy) as avg_train_accuracy,
      AVG(valid_accuracy) as avg_valid_accuracy,
      MAX(train_accuracy) as max_train_accuracy,
      MAX(valid_accuracy) as max_valid_accuracy,
      (SELECT train_accuracy FROM fine_tuning_metrics
       WHERE fine_tune_model_id = $1 ORDER BY step DESC LIMIT 1) as final_train_accuracy,
      (SELECT valid_accuracy FROM fine_tuning_metrics
       WHERE fine_tune_model_id = $1 ORDER BY step DESC LIMIT 1) as final_valid_accuracy
    FROM fine_tuning_metrics
    WHERE fine_tune_model_id = $1`,
    [modelId]
  );

  const row = result.rows[0];

  return {
    average: {
      train: parseFloat(row.avg_train_accuracy) || null,
      valid: parseFloat(row.avg_valid_accuracy) || null
    },
    maximum: {
      train: parseFloat(row.max_train_accuracy) || null,
      valid: parseFloat(row.max_valid_accuracy) || null
    },
    final: {
      train: parseFloat(row.final_train_accuracy) || null,
      valid: parseFloat(row.final_valid_accuracy) || null
    }
  };
}

/**
 * Get model summary metrics
 * @param {number} modelId - Fine-tune model ID
 * @returns {Promise<Object>} - Summary metrics
 */
async function getModelSummary(modelId) {
  const metricsResult = await db.query(
    `SELECT
      COUNT(*) as total_steps,
      MAX(epoch) as total_epochs,
      MIN(train_loss) as best_train_loss,
      MIN(valid_loss) as best_valid_loss,
      MAX(train_accuracy) as best_train_accuracy,
      MAX(valid_accuracy) as best_valid_accuracy,
      SUM(tokens_processed) as total_tokens,
      MIN(created_at) as started_at,
      MAX(created_at) as ended_at
    FROM fine_tuning_metrics
    WHERE fine_tune_model_id = $1`,
    [modelId]
  );

  const modelResult = await db.query(
    `SELECT training_cost, training_started_at, training_completed_at, metrics
     FROM fine_tune_models WHERE id = $1`,
    [modelId]
  );

  const metrics = metricsResult.rows[0];
  const model = modelResult.rows[0] || {};

  // Get final metrics
  const finalResult = await db.query(
    `SELECT train_loss, valid_loss, train_accuracy, valid_accuracy
     FROM fine_tuning_metrics
     WHERE fine_tune_model_id = $1
     ORDER BY step DESC LIMIT 1`,
    [modelId]
  );

  const final = finalResult.rows[0] || {};

  return {
    totalSteps: parseInt(metrics.total_steps) || 0,
    totalEpochs: parseInt(metrics.total_epochs) || 0,
    totalTokens: parseInt(metrics.total_tokens) || 0,
    trainingCost: parseFloat(model.training_cost) || 0,
    trainingTime: calculateTrainingTime(model.training_started_at, model.training_completed_at),
    bestLoss: {
      train: parseFloat(metrics.best_train_loss) || null,
      valid: parseFloat(metrics.best_valid_loss) || null
    },
    bestAccuracy: {
      train: parseFloat(metrics.best_train_accuracy) || null,
      valid: parseFloat(metrics.best_valid_accuracy) || null
    },
    finalLoss: {
      train: parseFloat(final.train_loss) || null,
      valid: parseFloat(final.valid_loss) || null
    },
    finalAccuracy: {
      train: parseFloat(final.train_accuracy) || null,
      valid: parseFloat(final.valid_accuracy) || null
    },
    modelMetrics: model.metrics || {}
  };
}

/**
 * Calculate training time in minutes
 */
function calculateTrainingTime(startedAt, completedAt) {
  if (!startedAt || !completedAt) return null;

  const start = new Date(startedAt);
  const end = new Date(completedAt);
  const diffMs = end - start;

  return Math.round(diffMs / 60000); // Convert to minutes
}

/**
 * Compare multiple models
 * @param {Array<number>} modelIds - Array of model IDs
 * @returns {Promise<Array>} - Comparison data
 */
async function compareModels(modelIds) {
  if (!modelIds || modelIds.length === 0) return [];

  const placeholders = modelIds.map((_, i) => `$${i + 1}`).join(', ');

  const result = await db.query(
    `SELECT
      m.id,
      m.name,
      m.base_model,
      m.status,
      m.training_cost,
      m.training_completed_at,
      (SELECT MIN(train_loss) FROM fine_tuning_metrics WHERE fine_tune_model_id = m.id) as best_loss,
      (SELECT MAX(train_accuracy) FROM fine_tuning_metrics WHERE fine_tune_model_id = m.id) as best_accuracy,
      (SELECT train_loss FROM fine_tuning_metrics WHERE fine_tune_model_id = m.id ORDER BY step DESC LIMIT 1) as final_loss,
      (SELECT train_accuracy FROM fine_tuning_metrics WHERE fine_tune_model_id = m.id ORDER BY step DESC LIMIT 1) as final_accuracy,
      (SELECT SUM(tokens_processed) FROM fine_tuning_metrics WHERE fine_tune_model_id = m.id) as total_tokens
    FROM fine_tune_models m
    WHERE m.id IN (${placeholders})
    ORDER BY m.created_at DESC`,
    modelIds
  );

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    baseModel: row.base_model,
    status: row.status,
    trainingCost: parseFloat(row.training_cost) || 0,
    completedAt: row.training_completed_at,
    bestLoss: parseFloat(row.best_loss) || null,
    bestAccuracy: parseFloat(row.best_accuracy) || null,
    finalLoss: parseFloat(row.final_loss) || null,
    finalAccuracy: parseFloat(row.final_accuracy) || null,
    totalTokens: parseInt(row.total_tokens) || 0
  }));
}

/**
 * Get usage statistics for a model
 * @param {number} modelId - Fine-tune model ID
 * @returns {Promise<Object>} - Usage stats
 */
async function getUsageStats(modelId) {
  // Get model info
  const modelResult = await db.query(
    `SELECT model_id, metrics FROM fine_tune_models WHERE id = $1`,
    [modelId]
  );

  if (modelResult.rows.length === 0) {
    return null;
  }

  const model = modelResult.rows[0];

  // Get training jobs count
  const jobsResult = await db.query(
    `SELECT COUNT(*) as total_jobs,
            COUNT(*) FILTER (WHERE status = 'succeeded') as successful_jobs
     FROM fine_tune_jobs WHERE fine_tune_model_id = $1`,
    [modelId]
  );

  const jobs = jobsResult.rows[0];

  // Get total metrics
  const metricsResult = await db.query(
    `SELECT COUNT(*) as data_points,
            SUM(tokens_processed) as total_tokens
     FROM fine_tuning_metrics WHERE fine_tune_model_id = $1`,
    [modelId]
  );

  const metrics = metricsResult.rows[0];

  return {
    modelId: model.model_id,
    totalJobs: parseInt(jobs.total_jobs) || 0,
    successfulJobs: parseInt(jobs.successful_jobs) || 0,
    dataPoints: parseInt(metrics.data_points) || 0,
    totalTokens: parseInt(metrics.total_tokens) || 0,
    storedMetrics: model.metrics || {}
  };
}

/**
 * Export metrics as CSV
 * @param {number} modelId - Fine-tune model ID
 * @returns {Promise<string>} - CSV string
 */
async function exportMetricsCSV(modelId) {
  const metrics = await getTrainingHistory(modelId);

  if (metrics.length === 0) {
    return 'step,epoch,train_loss,valid_loss,train_accuracy,valid_accuracy,learning_rate,tokens_processed,created_at\n';
  }

  const headers = ['step', 'epoch', 'train_loss', 'valid_loss', 'train_accuracy', 'valid_accuracy', 'learning_rate', 'tokens_processed', 'created_at'];
  const rows = metrics.map(m => [
    m.step,
    m.epoch,
    m.train_loss || '',
    m.valid_loss || '',
    m.train_accuracy || '',
    m.valid_accuracy || '',
    m.learning_rate || '',
    m.tokens_processed || 0,
    m.created_at
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Export metrics as JSON
 * @param {number} modelId - Fine-tune model ID
 * @returns {Promise<Object>} - JSON object
 */
async function exportMetricsJSON(modelId) {
  const [history, summary, accuracy] = await Promise.all([
    getTrainingHistory(modelId),
    getModelSummary(modelId),
    calculateAccuracy(modelId)
  ]);

  return {
    modelId,
    exportedAt: new Date().toISOString(),
    summary,
    accuracy,
    history
  };
}

/**
 * Generate mock metrics for simulation
 * @param {number} modelId - Fine-tune model ID
 * @param {string} jobId - Job ID
 * @param {number} epochs - Number of epochs
 */
async function generateMockMetrics(modelId, jobId, epochs = 3) {
  const stepsPerEpoch = 100;
  const totalSteps = epochs * stepsPerEpoch;
  const metrics = [];

  for (let step = 0; step <= totalSteps; step += 10) {
    const epoch = Math.floor(step / stepsPerEpoch);
    const progress = step / totalSteps;

    // Simulate decreasing loss and increasing accuracy
    const baseLoss = 2.5 - (progress * 2.2);
    const baseAccuracy = 0.3 + (progress * 0.6);

    metrics.push({
      step,
      epoch,
      train_loss: baseLoss + (Math.random() * 0.2),
      valid_loss: baseLoss + 0.1 + (Math.random() * 0.2),
      train_accuracy: Math.min(0.99, baseAccuracy + (Math.random() * 0.1)),
      valid_accuracy: Math.min(0.95, baseAccuracy - 0.05 + (Math.random() * 0.1)),
      learning_rate: 0.0001 * Math.pow(0.99, epoch),
      tokens_processed: step * 50
    });
  }

  await saveBatchMetrics(modelId, jobId, metrics);
  log.info('Mock metrics generated', { modelId, jobId, count: metrics.length });

  return metrics;
}

module.exports = {
  saveTrainingMetrics,
  saveBatchMetrics,
  getTrainingHistory,
  getLossHistory,
  getAccuracyHistory,
  calculateAccuracy,
  getModelSummary,
  compareModels,
  getUsageStats,
  exportMetricsCSV,
  exportMetricsJSON,
  generateMockMetrics
};
