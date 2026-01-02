/**
 * @fileoverview Batch API Routes
 * @description API endpoints for batch job processing.
 * Allows users to submit multiple API requests for async processing.
 * @module routes/batch
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');
const { checkPermission } = require('../middleware/checkPermission');
const {
  queueBatchJob,
  cancelBatchJob,
  getBatchJobStatus,
  getBatchJobResults
} = require('../services/batchProcessor');
const log = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/batch');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `batch-${uniqueSuffix}.jsonl`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/json', 'application/x-ndjson', 'text/plain'];
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.jsonl')) {
      cb(null, true);
    } else {
      cb(new Error('Only JSONL files are allowed'));
    }
  }
});

// Ensure upload directory exists
const ensureUploadDir = async () => {
  const uploadDir = path.join(__dirname, '../../uploads/batch');
  try {
    await fs.mkdir(uploadDir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      log.error('[BATCH] Failed to create upload directory', { error: error.message });
    }
  }
};
ensureUploadDir();

// Apply authentication and organization middleware
router.use(authenticateToken);
router.use(organizationContext);
router.use(requireOrganization);

// Constants
const MAX_REQUESTS_PER_BATCH = 10000;
const MAX_REQUEST_SIZE = 100 * 1024; // 100KB per request

/**
 * Parse JSONL file content
 */
const parseJSONL = (content) => {
  const lines = content.trim().split('\n');
  const requests = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const request = JSON.parse(line);
      requests.push(request);
    } catch (error) {
      throw new Error(`Invalid JSON on line ${i + 1}: ${error.message}`);
    }
  }

  return requests;
};

/**
 * Validate batch requests
 */
const validateRequests = (requests) => {
  if (!Array.isArray(requests)) {
    throw new Error('Requests must be an array');
  }

  if (requests.length === 0) {
    throw new Error('At least one request is required');
  }

  if (requests.length > MAX_REQUESTS_PER_BATCH) {
    throw new Error(`Maximum ${MAX_REQUESTS_PER_BATCH} requests per batch`);
  }

  const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];

    if (!req.endpoint) {
      throw new Error(`Request ${i + 1}: endpoint is required`);
    }

    if (!req.endpoint.startsWith('/api/')) {
      throw new Error(`Request ${i + 1}: endpoint must start with /api/`);
    }

    const method = (req.method || 'GET').toUpperCase();
    if (!validMethods.includes(method)) {
      throw new Error(`Request ${i + 1}: invalid method ${method}`);
    }

    // Check request size
    const requestSize = JSON.stringify(req).length;
    if (requestSize > MAX_REQUEST_SIZE) {
      throw new Error(`Request ${i + 1}: exceeds maximum size of ${MAX_REQUEST_SIZE / 1024}KB`);
    }
  }

  return true;
};

/**
 * POST /api/batch/jobs
 * Create a new batch job
 * Body: { requests: [{ method, endpoint, body }, ...], name? }
 * OR FormData with JSONL file
 * Permission: member
 */
router.post('/jobs', checkPermission('member'), upload.single('file'), async (req, res) => {
  try {
    const organization_id = req.organization.id;
    const user_id = req.user.id;
    let requests = [];
    let inputFileUrl = null;

    // Check if file was uploaded
    if (req.file) {
      try {
        const fileContent = await fs.readFile(req.file.path, 'utf-8');
        requests = parseJSONL(fileContent);
        inputFileUrl = req.file.path;
      } catch (error) {
        // Clean up file on error
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          success: false,
          message: `Failed to parse JSONL file: ${error.message}`
        });
      }
    } else if (req.body.requests) {
      // Parse requests from body
      requests = typeof req.body.requests === 'string'
        ? JSON.parse(req.body.requests)
        : req.body.requests;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either file upload or requests array is required'
      });
    }

    // Validate requests
    try {
      validateRequests(requests);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    const jobName = req.body.name || `Batch Job - ${new Date().toISOString()}`;

    // Create batch job
    const jobResult = await db.query(
      `INSERT INTO batch_jobs (
        organization_id, user_id, name, status, total_requests, input_file_url, created_at
      ) VALUES ($1, $2, $3, 'pending', $4, $5, CURRENT_TIMESTAMP)
      RETURNING id, name, status, total_requests, created_at`,
      [organization_id, user_id, jobName, requests.length, inputFileUrl]
    );

    const job = jobResult.rows[0];

    // Insert batch job items
    const itemValues = requests.map((req, index) => {
      return `(${job.id}, ${index}, '${JSON.stringify({
        method: (req.method || 'GET').toUpperCase(),
        endpoint: req.endpoint,
        body: req.body,
        headers: req.headers
      }).replace(/'/g, "''")}', 'pending')`;
    });

    // Insert in batches of 1000
    for (let i = 0; i < itemValues.length; i += 1000) {
      const batch = itemValues.slice(i, i + 1000);
      await db.query(
        `INSERT INTO batch_job_items (batch_job_id, request_index, request_data, status)
         VALUES ${batch.join(', ')}`
      );
    }

    // Get auth token for processing
    const authHeader = req.headers['authorization'];
    const authToken = authHeader ? authHeader.replace('Bearer ', '') : null;

    // Queue the job for processing
    const queueId = await queueBatchJob(job.id, authToken);

    log.info('[BATCH] Job created', {
      jobId: job.id,
      totalRequests: requests.length,
      organizationId: organization_id
    });

    res.status(201).json({
      success: true,
      message: 'Batch job created and queued for processing',
      data: {
        id: job.id,
        name: job.name,
        status: 'pending',
        totalRequests: job.total_requests,
        createdAt: job.created_at,
        queueId
      }
    });

  } catch (error) {
    log.error('[BATCH] Error creating job:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create batch job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/batch/jobs
 * List batch jobs for the organization
 * Query: page, limit, status
 * Permission: member
 */
router.get('/jobs', checkPermission('member'), async (req, res) => {
  try {
    const organization_id = req.organization.id;
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE bj.organization_id = $1';
    const params = [organization_id];

    if (status) {
      whereClause += ' AND bj.status = $2';
      params.push(status);
    }

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM batch_jobs bj ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Get jobs with user info
    const jobsResult = await db.query(
      `SELECT
        bj.id,
        bj.name,
        bj.status,
        bj.total_requests,
        bj.completed_requests,
        bj.failed_requests,
        bj.started_at,
        bj.completed_at,
        bj.created_at,
        u.name as user_name,
        u.email as user_email
      FROM batch_jobs bj
      LEFT JOIN users u ON bj.user_id = u.id
      ${whereClause}
      ORDER BY bj.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: jobsResult.rows.map(job => ({
        id: job.id,
        name: job.name,
        status: job.status,
        totalRequests: job.total_requests,
        completedRequests: job.completed_requests,
        failedRequests: job.failed_requests,
        progress: job.total_requests > 0
          ? Math.round(((job.completed_requests + job.failed_requests) / job.total_requests) * 100)
          : 0,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        createdAt: job.created_at,
        createdBy: job.user_name ? {
          name: job.user_name,
          email: job.user_email
        } : null
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });

  } catch (error) {
    log.error('[BATCH] Error listing jobs:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to list batch jobs'
    });
  }
});

/**
 * GET /api/batch/jobs/:id
 * Get batch job status and details
 * Permission: member
 */
router.get('/jobs/:id', checkPermission('member'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    const jobStatus = await getBatchJobStatus(id);

    if (!jobStatus || jobStatus.organization_id !== organization_id) {
      return res.status(404).json({
        success: false,
        message: 'Batch job not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: jobStatus.id,
        name: jobStatus.name,
        status: jobStatus.status,
        totalRequests: jobStatus.total_requests,
        completedRequests: parseInt(jobStatus.completed_items) || 0,
        failedRequests: parseInt(jobStatus.failed_items) || 0,
        pendingRequests: parseInt(jobStatus.pending_items) || 0,
        processingRequests: parseInt(jobStatus.processing_items) || 0,
        progress: jobStatus.total_requests > 0
          ? Math.round(((parseInt(jobStatus.completed_items) + parseInt(jobStatus.failed_items)) / jobStatus.total_requests) * 100)
          : 0,
        startedAt: jobStatus.started_at,
        completedAt: jobStatus.completed_at,
        createdAt: jobStatus.created_at,
        inputFileUrl: jobStatus.input_file_url,
        outputFileUrl: jobStatus.output_file_url,
        errorFileUrl: jobStatus.error_file_url
      }
    });

  } catch (error) {
    log.error('[BATCH] Error getting job status:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get batch job status'
    });
  }
});

/**
 * GET /api/batch/jobs/:id/results
 * Get batch job results with pagination
 * Query: page, limit, status (completed, failed)
 * Permission: member
 */
router.get('/jobs/:id/results', checkPermission('member'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;
    const { page = 1, limit = 50, status } = req.query;

    // Verify ownership
    const ownerCheck = await db.query(
      'SELECT id FROM batch_jobs WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Batch job not found'
      });
    }

    const results = await getBatchJobResults(id, {
      page: parseInt(page),
      limit: parseInt(limit),
      status
    });

    res.json({
      success: true,
      data: results.items.map(item => ({
        index: item.request_index,
        request: item.request_data,
        response: item.response_data,
        status: item.status,
        error: item.error_message,
        processedAt: item.processed_at
      })),
      pagination: results.pagination
    });

  } catch (error) {
    log.error('[BATCH] Error getting job results:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get batch job results'
    });
  }
});

/**
 * GET /api/batch/jobs/:id/download
 * Download all results as JSONL file
 * Permission: member
 */
router.get('/jobs/:id/download', checkPermission('member'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    // Verify ownership and get job info
    const jobCheck = await db.query(
      'SELECT id, name, status FROM batch_jobs WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Batch job not found'
      });
    }

    const job = jobCheck.rows[0];

    // Get all results
    const resultsResult = await db.query(
      `SELECT request_index, request_data, response_data, status, error_message
       FROM batch_job_items
       WHERE batch_job_id = $1
       ORDER BY request_index`,
      [id]
    );

    // Generate JSONL content
    const jsonlContent = resultsResult.rows.map(item => {
      return JSON.stringify({
        index: item.request_index,
        request: item.request_data,
        response: item.response_data,
        status: item.status,
        error: item.error_message
      });
    }).join('\n');

    // Set headers for file download
    const filename = `batch-results-${id}-${Date.now()}.jsonl`;
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.send(jsonlContent);

  } catch (error) {
    log.error('[BATCH] Error downloading results:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to download batch job results'
    });
  }
});

/**
 * POST /api/batch/jobs/:id/cancel
 * Cancel a batch job
 * Permission: admin
 */
router.post('/jobs/:id/cancel', checkPermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    // Verify ownership
    const ownerCheck = await db.query(
      'SELECT id, status FROM batch_jobs WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Batch job not found'
      });
    }

    const job = ownerCheck.rows[0];

    if (!['pending', 'processing'].includes(job.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel job with status: ${job.status}`
      });
    }

    const cancelled = await cancelBatchJob(id);

    if (!cancelled) {
      return res.status(400).json({
        success: false,
        message: 'Failed to cancel batch job'
      });
    }

    log.info('[BATCH] Job cancelled', { jobId: id });

    res.json({
      success: true,
      message: 'Batch job cancelled successfully'
    });

  } catch (error) {
    log.error('[BATCH] Error cancelling job:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to cancel batch job'
    });
  }
});

/**
 * DELETE /api/batch/jobs/:id
 * Delete a batch job
 * Permission: admin
 */
router.delete('/jobs/:id', checkPermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    // Verify ownership
    const ownerCheck = await db.query(
      'SELECT id, status, input_file_url FROM batch_jobs WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Batch job not found'
      });
    }

    const job = ownerCheck.rows[0];

    // Cancel if still running
    if (['pending', 'processing'].includes(job.status)) {
      await cancelBatchJob(id);
    }

    // Delete input file if exists
    if (job.input_file_url) {
      try {
        await fs.unlink(job.input_file_url);
      } catch (error) {
        // File might not exist
      }
    }

    // Delete job (cascade will delete items)
    await db.query('DELETE FROM batch_jobs WHERE id = $1', [id]);

    log.info('[BATCH] Job deleted', { jobId: id });

    res.json({
      success: true,
      message: 'Batch job deleted successfully'
    });

  } catch (error) {
    log.error('[BATCH] Error deleting job:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete batch job'
    });
  }
});

module.exports = router;
