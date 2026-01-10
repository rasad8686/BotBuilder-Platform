/**
 * Fine-Tuning Status Poller
 *
 * Background job that polls OpenAI for training status updates:
 * - Runs every 30 seconds
 * - Checks all active training jobs
 * - Updates database with status changes
 * - Handles completion notifications
 * - Emits WebSocket events for real-time updates
 */

const db = require('../db');
const log = require('../utils/logger');
const fineTuningController = require('../controllers/fineTuningController');
const openaiFineTuning = require('../services/openaiFineTuning');
const emailService = require('../services/emailService');
const { getInstance: getFineTuningSocket } = require('../websocket/fineTuningSocket');

// Polling interval (30 seconds)
const POLL_INTERVAL = 30000;

// Active polling interval reference
let pollingInterval = null;

// Track if poller is running
let isPolling = false;

/**
 * Get all active training jobs
 * @returns {Promise<Array>} - Array of active jobs
 */
async function getActiveJobs() {
  const result = await db.query(
    `SELECT j.*, m.organization_id, m.base_model, m.name as model_name
     FROM fine_tune_jobs j
     JOIN fine_tune_models m ON j.fine_tune_model_id = m.id
     WHERE j.status IN ('pending', 'queued', 'running', 'validating_files')
       AND j.provider = 'openai'
       AND j.job_id IS NOT NULL
     ORDER BY j.created_at ASC`
  );

  return result.rows;
}

/**
 * Poll a single job for status updates
 * @param {Object} job - Job record
 */
async function pollJob(job) {
  const socket = getFineTuningSocket();

  try {
    log.debug('Polling job status', { jobId: job.job_id, dbJobId: job.id });

    // Get detailed status from OpenAI
    const status = await fineTuningController.updateJobStatus(
      job.job_id,
      job.id,
      job.fine_tune_model_id
    );

    // Emit progress via WebSocket if there are watchers
    if (socket && socket.hasWatchers(job.job_id)) {
      // Emit current progress
      emitProgressUpdate(socket, job, status);
    }

    // Check for status changes
    if (status.status !== job.status) {
      log.info('Job status changed', {
        jobId: job.job_id,
        oldStatus: job.status,
        newStatus: status.status,
        modelName: job.model_name
      });

      // Emit status change via WebSocket
      if (socket) {
        socket.emitStatusChange(job.job_id, status.status, {
          modelName: job.model_name,
          previousStatus: job.status
        });
      }

      // Handle completion
      if (status.status === 'succeeded') {
        await handleTrainingComplete(job, status);
        if (socket) {
          socket.emitComplete(job.job_id, {
            fineTunedModel: status.fine_tuned_model,
            trainedTokens: status.trained_tokens,
            modelName: job.model_name
          });
        }
      } else if (status.status === 'failed') {
        await handleTrainingFailed(job, status);
        if (socket) {
          socket.emitError(job.job_id, {
            message: status.error?.message || 'Training failed',
            code: status.error?.code,
            modelName: job.model_name
          });
        }
      } else if (status.status === 'cancelled') {
        await handleTrainingCancelled(job);
        if (socket) {
          socket.emitCancelled(job.job_id);
        }
      } else if (status.status === 'running' && job.status !== 'running') {
        // Training just started
        if (socket) {
          socket.emitStarted(job.job_id, {
            modelName: job.model_name,
            baseModel: job.base_model
          });
        }
      } else if (status.status === 'validating_files') {
        if (socket) {
          socket.emitValidating(job.job_id);
        }
      }
    }

    // Store metrics in database
    if (status.training_metrics) {
      await storeTrainingMetrics(job, status.training_metrics);
    }

    return status;
  } catch (err) {
    log.error('Failed to poll job', {
      jobId: job.job_id,
      error: err.message
    });

    // Emit error via WebSocket
    if (socket && socket.hasWatchers(job.job_id)) {
      socket.emitError(job.job_id, {
        message: 'Failed to fetch training status',
        temporary: true
      });
    }

    // Don't throw - continue polling other jobs
    return null;
  }
}

/**
 * Emit progress update via WebSocket
 * @param {Object} socket - FineTuningSocket instance
 * @param {Object} job - Job record
 * @param {Object} status - OpenAI status
 */
function emitProgressUpdate(socket, job, status) {
  // Extract training metrics from OpenAI response
  const metrics = status.training_metrics || {};

  // Calculate progress percentage
  let progress = 0;
  if (status.trained_tokens && status.estimated_total_tokens) {
    progress = Math.round((status.trained_tokens / status.estimated_total_tokens) * 100);
  }

  // Emit general progress
  socket.emitProgress(job.job_id, {
    status: status.status,
    progress,
    trainedTokens: status.trained_tokens,
    estimatedTotalTokens: status.estimated_total_tokens,
    modelName: job.model_name
  });

  // Emit epoch progress if available
  if (metrics.current_epoch !== undefined && metrics.total_epochs) {
    socket.emitEpochProgress(
      job.job_id,
      metrics.current_epoch,
      metrics.total_epochs,
      {
        loss: metrics.training_loss,
        validationLoss: metrics.validation_loss,
        learningRate: metrics.learning_rate
      }
    );
  }

  // Emit step progress if available
  if (metrics.current_step !== undefined && metrics.total_steps) {
    socket.emitStepProgress(
      job.job_id,
      metrics.current_step,
      metrics.total_steps,
      {
        loss: metrics.step_loss,
        gradientNorm: metrics.gradient_norm
      }
    );
  }

  // Emit detailed metrics
  if (Object.keys(metrics).length > 0) {
    socket.emitMetrics(job.job_id, metrics);
  }
}

/**
 * Store training metrics in database
 * @param {Object} job - Job record
 * @param {Object} metrics - Training metrics
 */
async function storeTrainingMetrics(job, metrics) {
  try {
    await db.query(
      `INSERT INTO fine_tune_metrics (job_id, metrics, recorded_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (job_id, recorded_at) DO UPDATE SET metrics = $2`,
      [job.id, JSON.stringify(metrics)]
    );
  } catch (err) {
    // Table might not exist, log and continue
    log.debug('Could not store metrics', { error: err.message });
  }
}

/**
 * Handle training completion
 * @param {Object} job - Job record
 * @param {Object} status - OpenAI status
 */
async function handleTrainingComplete(job, status) {
  log.info('Training completed successfully', {
    jobId: job.job_id,
    modelName: job.model_name,
    fineTunedModel: status.fine_tuned_model,
    trainedTokens: status.trained_tokens
  });

  // Calculate training cost
  if (status.trained_tokens) {
    const cost = openaiFineTuning.estimateTrainingCost(
      status.trained_tokens,
      1, // Already trained
      job.base_model
    );

    await db.query(
      'UPDATE fine_tune_models SET training_cost = $1 WHERE id = $2',
      [cost.estimated_cost, job.fine_tune_model_id]
    );
  }

  // Send notification to user via email
  try {
    await sendCompletionNotification(job, status);
  } catch (err) {
    log.warn('Failed to send completion notification', { error: err.message });
  }
}

/**
 * Handle training failure
 * @param {Object} job - Job record
 * @param {Object} status - OpenAI status
 */
async function handleTrainingFailed(job, status) {
  log.error('Training failed', {
    jobId: job.job_id,
    modelName: job.model_name,
    error: status.error
  });

  // Send failure notification to user via email
  try {
    await sendFailureNotification(job, status);
  } catch (err) {
    log.warn('Failed to send failure notification', { error: err.message });
  }
}

/**
 * Handle training cancellation
 * @param {Object} job - Job record
 */
async function handleTrainingCancelled(job) {
  log.info('Training cancelled', {
    jobId: job.job_id,
    modelName: job.model_name
  });
}

/**
 * Send completion notification
 * @param {Object} job - Job record
 * @param {Object} status - OpenAI status
 */
async function sendCompletionNotification(job, status) {
  // Get user info
  const userResult = await db.query(
    `SELECT u.email, u.name FROM users u
     JOIN fine_tune_models m ON m.user_id = u.id
     WHERE m.id = $1`,
    [job.fine_tune_model_id]
  );

  if (userResult.rows.length === 0) return;

  const user = userResult.rows[0];

  log.info('Sending training completion notification', {
    email: user.email,
    modelName: job.model_name,
    fineTunedModel: status.fine_tuned_model
  });

  // Send email notification
  await emailService.sendTrainingCompleteEmail(user.email, {
    modelName: job.model_name,
    fineTunedModel: status.fine_tuned_model,
    trainedTokens: status.trained_tokens,
    userName: user.name
  });
}

/**
 * Send failure notification
 * @param {Object} job - Job record
 * @param {Object} status - OpenAI status
 */
async function sendFailureNotification(job, status) {
  // Get user info
  const userResult = await db.query(
    `SELECT u.email, u.name FROM users u
     JOIN fine_tune_models m ON m.user_id = u.id
     WHERE m.id = $1`,
    [job.fine_tune_model_id]
  );

  if (userResult.rows.length === 0) return;

  const user = userResult.rows[0];

  log.info('Sending training failure notification', {
    email: user.email,
    modelName: job.model_name,
    error: status.error
  });

  // Send email notification
  await emailService.sendTrainingFailedEmail(user.email, {
    modelName: job.model_name,
    error: status.error?.message || status.error || 'Unknown error',
    userName: user.name
  });
}

/**
 * Run a single polling cycle
 */
async function pollAllJobs() {
  if (isPolling) {
    log.debug('Skipping poll cycle - previous cycle still running');
    return;
  }

  isPolling = true;

  try {
    // Check if OpenAI is available
    if (!openaiFineTuning.isAvailable()) {
      log.debug('OpenAI not available, skipping poll cycle');
      return;
    }

    const jobs = await getActiveJobs();

    if (jobs.length === 0) {
      log.debug('No active jobs to poll');
      return;
    }

    log.info(`Polling ${jobs.length} active training job(s)`);

    // Poll each job with a small delay to avoid rate limits
    for (const job of jobs) {
      await pollJob(job);

      // Small delay between API calls to respect rate limits
      if (jobs.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  } catch (err) {
    log.error('Error in poll cycle', { error: err.message });
  } finally {
    isPolling = false;
  }
}

/**
 * Start the polling service
 */
function start() {
  if (pollingInterval) {
    log.warn('Polling service already running');
    return;
  }

  log.info('Starting fine-tuning status poller', { interval: `${POLL_INTERVAL / 1000}s` });

  // Run immediately on start
  pollAllJobs();

  // Then run at interval
  pollingInterval = setInterval(pollAllJobs, POLL_INTERVAL);
}

/**
 * Stop the polling service
 */
function stop() {
  if (pollingInterval) {
    log.info('Stopping fine-tuning status poller');
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/**
 * Check if poller is running
 */
function isRunning() {
  return !!pollingInterval;
}

/**
 * Manually trigger a poll cycle
 */
async function pollNow() {
  log.info('Manual poll triggered');
  await pollAllJobs();
}

/**
 * Get polling status
 */
function getStatus() {
  return {
    running: isRunning(),
    currentlyPolling: isPolling,
    interval: POLL_INTERVAL
  };
}

module.exports = {
  start,
  stop,
  isRunning,
  pollNow,
  getStatus,
  POLL_INTERVAL
};
