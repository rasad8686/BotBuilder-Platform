/**
 * @fileoverview Batch Processor Service
 * @description Async batch job processor using Bull queue (Redis-based).
 * Processes multiple API requests with concurrency control and rate limiting.
 * @module services/batchProcessor
 */

const Queue = require('bull');
const db = require('../db');
const log = require('../utils/logger');
const axios = require('axios');

// Configuration
const CONCURRENCY_LIMIT = 10; // Max parallel requests per job
const RATE_LIMIT_DELAY = 100; // ms between requests
const JOB_TIMEOUT = 30 * 60 * 1000; // 30 minutes max per job
const REQUEST_TIMEOUT = 30000; // 30 seconds per request

// Redis connection for Bull queue
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined
};

// Create Bull queue (only if Redis is configured)
let batchQueue = null;
const redisEnabled = process.env.REDIS_HOST || process.env.REDIS_URL;

if (redisEnabled) {
  try {
    batchQueue = new Queue('batch-processing', {
      redis: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 100,
        removeOnFail: 50
      }
    });

    // Queue event handlers
    batchQueue.on('error', (error) => {
      // Only log if there's an actual error message
      if (error && error.message) {
        log.warn('[BATCH_PROCESSOR] Queue connection issue:', { error: error.message });
      }
    });

    batchQueue.on('failed', (job, error) => {
      log.error('[BATCH_PROCESSOR] Job failed:', {
        jobId: job.id,
        batchJobId: job.data.batchJobId,
        error: error.message
      });
    });

    log.info('[BATCH_PROCESSOR] Queue initialized');
  } catch (error) {
    log.warn('[BATCH_PROCESSOR] Redis not available, using in-memory processing', { error: error.message });
    batchQueue = null;
  }
} else {
  log.info('[BATCH_PROCESSOR] Redis not configured, using in-memory processing');
}

/**
 * Internal API client for batch requests
 */
const createInternalClient = (baseUrl, authToken) => {
  return axios.create({
    baseURL: baseUrl || `http://localhost:${process.env.PORT || 5000}`,
    timeout: REQUEST_TIMEOUT,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      'X-Batch-Request': 'true'
    }
  });
};

/**
 * Process a single batch request item
 */
const processRequestItem = async (client, item, jobId) => {
  const startTime = Date.now();

  try {
    const { method, endpoint, body, headers } = item.request_data;

    const config = {
      method: (method || 'GET').toUpperCase(),
      url: endpoint,
      data: body,
      headers: headers || {}
    };

    const response = await client.request(config);

    const responseData = {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      headers: response.headers,
      duration: Date.now() - startTime
    };

    // Update item as completed
    await db.query(
      `UPDATE batch_job_items
       SET status = 'completed', response_data = $1, processed_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(responseData), item.id]
    );

    return { success: true, itemId: item.id };
  } catch (error) {
    const errorResponse = {
      status: error.response?.status || 500,
      statusText: error.response?.statusText || 'Error',
      error: error.message,
      data: error.response?.data,
      duration: Date.now() - startTime
    };

    // Update item as failed
    await db.query(
      `UPDATE batch_job_items
       SET status = 'failed', response_data = $1, error_message = $2, processed_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [JSON.stringify(errorResponse), error.message, item.id]
    );

    return { success: false, itemId: item.id, error: error.message };
  }
};

/**
 * Process a batch job
 * @param {number} jobId - The batch job ID from database
 * @param {string} authToken - Auth token for API requests
 */
const processBatchJob = async (jobId, authToken) => {
  log.info('[BATCH_PROCESSOR] Starting batch job', { jobId });

  try {
    // Update job status to processing
    await db.query(
      `UPDATE batch_jobs SET status = 'processing', started_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [jobId]
    );

    // Get all pending items for this job
    const itemsResult = await db.query(
      `SELECT id, request_index, request_data
       FROM batch_job_items
       WHERE batch_job_id = $1 AND status = 'pending'
       ORDER BY request_index`,
      [jobId]
    );

    const items = itemsResult.rows;
    const totalItems = items.length;

    if (totalItems === 0) {
      await db.query(
        `UPDATE batch_jobs SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [jobId]
      );
      return { success: true, processed: 0 };
    }

    // Create internal API client
    const client = createInternalClient(null, authToken);

    // Process items in batches with concurrency limit
    let completedCount = 0;
    let failedCount = 0;

    // Process in chunks
    for (let i = 0; i < totalItems; i += CONCURRENCY_LIMIT) {
      // Check if job was cancelled
      const statusCheck = await db.query(
        'SELECT status FROM batch_jobs WHERE id = $1',
        [jobId]
      );

      if (statusCheck.rows[0]?.status === 'cancelled') {
        log.info('[BATCH_PROCESSOR] Job cancelled', { jobId });
        return { success: false, reason: 'cancelled' };
      }

      const chunk = items.slice(i, i + CONCURRENCY_LIMIT);

      // Mark items as processing
      const itemIds = chunk.map(item => item.id);
      await db.query(
        `UPDATE batch_job_items SET status = 'processing' WHERE id = ANY($1)`,
        [itemIds]
      );

      // Process chunk concurrently
      const results = await Promise.all(
        chunk.map(item => processRequestItem(client, item, jobId))
      );

      // Count results
      results.forEach(result => {
        if (result.success) {
          completedCount++;
        } else {
          failedCount++;
        }
      });

      // Update job progress
      await db.query(
        `UPDATE batch_jobs SET completed_requests = $1, failed_requests = $2 WHERE id = $3`,
        [completedCount, failedCount, jobId]
      );

      // Rate limit delay between chunks
      if (i + CONCURRENCY_LIMIT < totalItems) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      }
    }

    // Determine final status
    const finalStatus = failedCount === totalItems ? 'failed' : 'completed';

    // Update job as completed
    await db.query(
      `UPDATE batch_jobs
       SET status = $1, completed_at = CURRENT_TIMESTAMP, completed_requests = $2, failed_requests = $3
       WHERE id = $4`,
      [finalStatus, completedCount, failedCount, jobId]
    );

    log.info('[BATCH_PROCESSOR] Batch job completed', {
      jobId,
      totalItems,
      completedCount,
      failedCount
    });

    return {
      success: true,
      processed: totalItems,
      completed: completedCount,
      failed: failedCount
    };

  } catch (error) {
    log.error('[BATCH_PROCESSOR] Batch job error', { jobId, error: error.message });

    // Update job as failed
    await db.query(
      `UPDATE batch_jobs SET status = 'failed', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [jobId]
    );

    throw error;
  }
};

/**
 * Add batch job to queue
 * @param {number} batchJobId - The batch job ID
 * @param {string} authToken - Auth token for API requests
 */
const queueBatchJob = async (batchJobId, authToken) => {
  if (batchQueue) {
    // Use Bull queue
    const job = await batchQueue.add(
      { batchJobId, authToken },
      {
        jobId: `batch-${batchJobId}`,
        timeout: JOB_TIMEOUT
      }
    );
    log.info('[BATCH_PROCESSOR] Job queued', { batchJobId, queueJobId: job.id });
    return job.id;
  } else {
    // Fallback: process immediately in background
    log.info('[BATCH_PROCESSOR] Processing job immediately (no Redis)', { batchJobId });
    setImmediate(() => {
      processBatchJob(batchJobId, authToken).catch(err => {
        log.error('[BATCH_PROCESSOR] Background job error', { batchJobId, error: err.message });
      });
    });
    return `immediate-${batchJobId}`;
  }
};

/**
 * Cancel a batch job
 * @param {number} batchJobId - The batch job ID
 */
const cancelBatchJob = async (batchJobId) => {
  // Update job status
  const result = await db.query(
    `UPDATE batch_jobs
     SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status IN ('pending', 'processing')
     RETURNING id`,
    [batchJobId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  // Try to remove from queue if using Bull
  if (batchQueue) {
    try {
      const job = await batchQueue.getJob(`batch-${batchJobId}`);
      if (job) {
        await job.remove();
      }
    } catch (error) {
      log.warn('[BATCH_PROCESSOR] Could not remove job from queue', { batchJobId });
    }
  }

  // Mark pending items as cancelled
  await db.query(
    `UPDATE batch_job_items
     SET status = 'cancelled'
     WHERE batch_job_id = $1 AND status = 'pending'`,
    [batchJobId]
  );

  log.info('[BATCH_PROCESSOR] Job cancelled', { batchJobId });
  return true;
};

/**
 * Get batch job status with progress
 * @param {number} batchJobId - The batch job ID
 */
const getBatchJobStatus = async (batchJobId) => {
  const result = await db.query(
    `SELECT
      bj.*,
      COUNT(CASE WHEN bji.status = 'pending' THEN 1 END) as pending_items,
      COUNT(CASE WHEN bji.status = 'processing' THEN 1 END) as processing_items,
      COUNT(CASE WHEN bji.status = 'completed' THEN 1 END) as completed_items,
      COUNT(CASE WHEN bji.status = 'failed' THEN 1 END) as failed_items
    FROM batch_jobs bj
    LEFT JOIN batch_job_items bji ON bji.batch_job_id = bj.id
    WHERE bj.id = $1
    GROUP BY bj.id`,
    [batchJobId]
  );

  return result.rows[0] || null;
};

/**
 * Get batch job results with pagination
 * @param {number} batchJobId - The batch job ID
 * @param {Object} options - Pagination options
 */
const getBatchJobResults = async (batchJobId, { page = 1, limit = 50, status = null }) => {
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE batch_job_id = $1';
  const params = [batchJobId];

  if (status) {
    whereClause += ' AND status = $2';
    params.push(status);
  }

  // Get total count
  const countResult = await db.query(
    `SELECT COUNT(*) FROM batch_job_items ${whereClause}`,
    params
  );
  const totalCount = parseInt(countResult.rows[0].count);

  // Get items
  const itemsResult = await db.query(
    `SELECT id, request_index, request_data, response_data, status, error_message, processed_at
     FROM batch_job_items
     ${whereClause}
     ORDER BY request_index
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return {
    items: itemsResult.rows,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
};

// Process jobs from queue if using Bull
if (batchQueue) {
  batchQueue.process(CONCURRENCY_LIMIT, async (job) => {
    const { batchJobId, authToken } = job.data;
    return await processBatchJob(batchJobId, authToken);
  });
}

module.exports = {
  processBatchJob,
  queueBatchJob,
  cancelBatchJob,
  getBatchJobStatus,
  getBatchJobResults,
  CONCURRENCY_LIMIT,
  batchQueue
};
