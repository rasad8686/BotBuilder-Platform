/**
 * Fine-Tuning API Routes
 *
 * Handles all fine-tuning related endpoints:
 * - CRUD for models
 * - Dataset upload and validation
 * - Training job management
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');
const fineTuningService = require('../services/fineTuningService');
const datasetValidator = require('../services/datasetValidator');
const { uploadDataset: uploadDatasetMiddleware, cleanupFile, formatFileSize, UPLOAD_DIR } = require('../middleware/uploadDataset');
const log = require('../utils/logger');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.jsonl', '.json', '.csv'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: JSONL, JSON, CSV'));
    }
  }
});

// Apply authentication and organization context to all routes
router.use(authMiddleware);
router.use(organizationContext);
router.use(requireOrganization);

// ==========================================
// MODEL CRUD ENDPOINTS
// ==========================================

/**
 * GET /api/fine-tuning/models
 * List all fine-tuned models for the organization
 */
router.get('/models', async (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    const orgId = req.organization.id;

    const models = await fineTuningService.getModels(orgId, {
      status,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });

    res.json({
      success: true,
      models,
      count: models.length
    });
  } catch (error) {
    log.error('Error fetching fine-tune models', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch models'
    });
  }
});

/**
 * POST /api/fine-tuning/models
 * Create a new fine-tune model
 */
router.post('/models', async (req, res) => {
  try {
    const { name, description, base_model } = req.body;
    const userId = req.user.id;
    const orgId = req.organization.id;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Model name is required'
      });
    }

    if (!base_model) {
      return res.status(400).json({
        success: false,
        error: 'Base model is required'
      });
    }

    const model = await fineTuningService.createModel(userId, orgId, {
      name,
      description,
      base_model
    });

    res.status(201).json({
      success: true,
      model
    });
  } catch (error) {
    log.error('Error creating fine-tune model', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/models/:id
 * Get a single model by ID
 */
router.get('/models/:id', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;

    const model = await fineTuningService.getModelById(modelId, orgId);

    res.json({
      success: true,
      model
    });
  } catch (error) {
    log.error('Error fetching fine-tune model', { error: error.message });
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/fine-tuning/models/:id
 * Update a model
 */
router.put('/models/:id', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;
    const { name, description, settings } = req.body;

    const model = await fineTuningService.updateModel(modelId, orgId, {
      name,
      description,
      settings
    });

    res.json({
      success: true,
      model
    });
  } catch (error) {
    log.error('Error updating fine-tune model', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/fine-tuning/models/:id
 * Delete a model
 */
router.delete('/models/:id', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;

    await fineTuningService.deleteModel(modelId, orgId);

    res.json({
      success: true,
      message: 'Model deleted successfully'
    });
  } catch (error) {
    log.error('Error deleting fine-tune model', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// DATASET ENDPOINTS
// ==========================================

/**
 * POST /api/fine-tuning/models/:id/upload
 * Upload a training dataset
 */
router.post('/models/:id/upload', upload.single('file'), async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    const dataset = await fineTuningService.uploadDataset(modelId, orgId, req.file);

    res.status(201).json({
      success: true,
      dataset,
      message: 'Dataset uploaded. Validation in progress...'
    });
  } catch (error) {
    log.error('Error uploading dataset', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/models/:id/datasets/:datasetId/preview
 * Get dataset preview with validation and token count
 */
router.get('/models/:id/datasets/:datasetId/preview', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const datasetId = parseInt(req.params.datasetId);
    const orgId = req.organization.id;

    // Get model to verify ownership
    const model = await fineTuningService.getModelById(modelId, orgId);
    if (!model) {
      return res.status(404).json({
        success: false,
        error: 'Model not found'
      });
    }

    // Get dataset from database
    const dataset = await fineTuningService.getDatasetById(datasetId, modelId);
    if (!dataset) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found'
      });
    }

    // Check if file exists
    if (!dataset.file_path || !fs.existsSync(dataset.file_path)) {
      return res.status(404).json({
        success: false,
        error: 'Dataset file not found'
      });
    }

    // Analyze dataset
    const analysis = await datasetValidator.analyzeDataset(dataset.file_path, model.base_model);

    res.json({
      success: true,
      total_rows: analysis.total_rows,
      valid_rows: analysis.valid_rows,
      preview: analysis.preview,
      format_valid: analysis.valid,
      token_count: analysis.token_count,
      estimated_cost: analysis.estimated_cost,
      cost_details: analysis.cost_details,
      errors: analysis.errors
    });
  } catch (error) {
    log.error('Error fetching dataset preview', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/models/:id/datasets/:datasetId/convert
 * Convert CSV/JSON dataset to JSONL
 */
router.post('/models/:id/datasets/:datasetId/convert', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const datasetId = parseInt(req.params.datasetId);
    const orgId = req.organization.id;

    // Get model to verify ownership
    const model = await fineTuningService.getModelById(modelId, orgId);
    if (!model) {
      return res.status(404).json({
        success: false,
        error: 'Model not found'
      });
    }

    // Get dataset from database
    const dataset = await fineTuningService.getDatasetById(datasetId, modelId);
    if (!dataset) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found'
      });
    }

    // Check if file exists
    if (!dataset.file_path || !fs.existsSync(dataset.file_path)) {
      return res.status(404).json({
        success: false,
        error: 'Dataset file not found'
      });
    }

    const ext = path.extname(dataset.file_path).toLowerCase();
    if (ext === '.jsonl') {
      return res.status(400).json({
        success: false,
        error: 'Dataset is already in JSONL format'
      });
    }

    // Generate output path
    const outputPath = dataset.file_path.replace(ext, '.jsonl');
    let result;

    if (ext === '.csv') {
      result = await datasetValidator.convertCSVtoJSONL(dataset.file_path, outputPath);
    } else if (ext === '.json') {
      result = await datasetValidator.convertJSONtoJSONL(dataset.file_path, outputPath);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported file format for conversion'
      });
    }

    // Update dataset record
    await fineTuningService.updateDataset(datasetId, {
      file_path: outputPath,
      format: 'jsonl',
      row_count: result.rows
    });

    // Cleanup original file
    cleanupFile(dataset.file_path);

    res.json({
      success: true,
      message: 'Dataset converted to JSONL',
      rows: result.rows,
      outputPath: result.outputPath
    });
  } catch (error) {
    log.error('Error converting dataset', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/models/:id/datasets
 * List all datasets for a model
 */
router.get('/models/:id/datasets', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;

    // Get model to verify ownership
    const model = await fineTuningService.getModelById(modelId, orgId);
    if (!model) {
      return res.status(404).json({
        success: false,
        error: 'Model not found'
      });
    }

    const datasets = await fineTuningService.getDatasets(modelId);

    res.json({
      success: true,
      datasets
    });
  } catch (error) {
    log.error('Error fetching datasets', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/fine-tuning/models/:id/datasets/:datasetId
 * Delete a dataset
 */
router.delete('/models/:id/datasets/:datasetId', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const datasetId = parseInt(req.params.datasetId);
    const orgId = req.organization.id;

    // Get model to verify ownership
    const model = await fineTuningService.getModelById(modelId, orgId);
    if (!model) {
      return res.status(404).json({
        success: false,
        error: 'Model not found'
      });
    }

    // Get dataset to cleanup file
    const dataset = await fineTuningService.getDatasetById(datasetId, modelId);
    if (dataset && dataset.file_path) {
      cleanupFile(dataset.file_path);
    }

    await fineTuningService.deleteDataset(datasetId, modelId);

    res.json({
      success: true,
      message: 'Dataset deleted successfully'
    });
  } catch (error) {
    log.error('Error deleting dataset', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// TRAINING ENDPOINTS
// ==========================================

/**
 * POST /api/fine-tuning/models/:id/train
 * Start training a model
 */
router.post('/models/:id/train', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;
    const { epochs, batch_size, learning_rate } = req.body;

    const job = await fineTuningService.startTraining(modelId, orgId, {
      epochs: parseInt(epochs) || 3,
      batch_size: parseInt(batch_size) || 1,
      learning_rate: parseFloat(learning_rate) || 0.0001
    });

    res.status(201).json({
      success: true,
      job,
      message: 'Training started'
    });
  } catch (error) {
    log.error('Error starting training', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/models/:id/status
 * Get training status
 */
router.get('/models/:id/status', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;

    const status = await fineTuningService.getTrainingStatus(modelId, orgId);

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    log.error('Error fetching training status', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/models/:id/cancel
 * Cancel training
 */
router.post('/models/:id/cancel', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;

    await fineTuningService.cancelTraining(modelId, orgId);

    res.json({
      success: true,
      message: 'Training cancelled'
    });
  } catch (error) {
    log.error('Error cancelling training', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/models/:id/metrics
 * Get model metrics
 */
router.get('/models/:id/metrics', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;

    const metrics = await fineTuningService.getModelMetrics(modelId, orgId);

    res.json({
      success: true,
      ...metrics
    });
  } catch (error) {
    log.error('Error fetching model metrics', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/models/:id/test
 * Test a fine-tuned model
 */
router.post('/models/:id/test', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;
    const { prompt, systemMessage, maxTokens, temperature } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    const fineTuningController = require('../controllers/fineTuningController');
    const result = await fineTuningController.testModel(modelId, orgId, prompt, {
      systemMessage,
      maxTokens,
      temperature
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Error testing model', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/models/:id/events
 * Get training events for a model
 */
router.get('/models/:id/events', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;

    const fineTuningController = require('../controllers/fineTuningController');
    const events = await fineTuningController.getTrainingEvents(modelId, orgId);

    res.json({
      success: true,
      events
    });
  } catch (error) {
    log.error('Error fetching training events', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// METRICS ENDPOINTS
// ==========================================

const metricsService = require('../services/metricsService');

/**
 * GET /api/fine-tuning/models/:id/metrics/summary
 * Get model metrics summary
 */
router.get('/models/:id/metrics/summary', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;

    // Verify model ownership
    await fineTuningService.getModelById(modelId, orgId);

    const summary = await metricsService.getModelSummary(modelId);

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    log.error('Error fetching metrics summary', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/models/:id/metrics/loss
 * Get loss history
 */
router.get('/models/:id/metrics/loss', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;
    const { jobId } = req.query;

    // Verify model ownership
    await fineTuningService.getModelById(modelId, orgId);

    const lossHistory = await metricsService.getLossHistory(modelId, jobId);

    res.json({
      success: true,
      data: lossHistory
    });
  } catch (error) {
    log.error('Error fetching loss history', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/models/:id/metrics/accuracy
 * Get accuracy history
 */
router.get('/models/:id/metrics/accuracy', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;
    const { jobId } = req.query;

    // Verify model ownership
    await fineTuningService.getModelById(modelId, orgId);

    const accuracyHistory = await metricsService.getAccuracyHistory(modelId, jobId);

    res.json({
      success: true,
      data: accuracyHistory
    });
  } catch (error) {
    log.error('Error fetching accuracy history', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/models/:id/metrics/history
 * Get full training history
 */
router.get('/models/:id/metrics/history', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;

    // Verify model ownership
    await fineTuningService.getModelById(modelId, orgId);

    const history = await metricsService.getTrainingHistory(modelId);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    log.error('Error fetching training history', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/compare
 * Compare multiple models
 */
router.get('/compare', async (req, res) => {
  try {
    const { ids } = req.query;
    const orgId = req.organization.id;

    if (!ids) {
      return res.status(400).json({
        success: false,
        error: 'Model IDs required'
      });
    }

    const modelIds = ids.split(',').map(id => parseInt(id.trim()));

    // Verify all models belong to org
    for (const modelId of modelIds) {
      await fineTuningService.getModelById(modelId, orgId);
    }

    const comparison = await metricsService.compareModels(modelIds);

    res.json({
      success: true,
      comparison
    });
  } catch (error) {
    log.error('Error comparing models', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/models/:id/metrics/export
 * Export metrics as CSV or JSON
 */
router.get('/models/:id/metrics/export', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;
    const { format } = req.query;

    // Verify model ownership
    const model = await fineTuningService.getModelById(modelId, orgId);

    if (format === 'csv') {
      const csv = await metricsService.exportMetricsCSV(modelId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${model.name}_metrics.csv"`);
      res.send(csv);
    } else {
      const json = await metricsService.exportMetricsJSON(modelId);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${model.name}_metrics.json"`);
      res.json(json);
    }
  } catch (error) {
    log.error('Error exporting metrics', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/models/:id/usage
 * Get model usage statistics
 */
router.get('/models/:id/usage', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;

    // Verify model ownership
    await fineTuningService.getModelById(modelId, orgId);

    const usage = await metricsService.getUsageStats(modelId);

    res.json({
      success: true,
      usage
    });
  } catch (error) {
    log.error('Error fetching usage stats', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/models/:id/metrics/generate-mock
 * Generate mock metrics for testing (development only)
 */
router.post('/models/:id/metrics/generate-mock', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Not available in production'
      });
    }

    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;
    const { epochs } = req.body;

    // Verify model ownership
    const model = await fineTuningService.getModelById(modelId, orgId);

    // Get latest job
    const status = await fineTuningService.getTrainingStatus(modelId, orgId);
    const jobId = status.job?.job_id || `mock_${Date.now()}`;

    const metrics = await metricsService.generateMockMetrics(modelId, jobId, epochs || 3);

    res.json({
      success: true,
      message: `Generated ${metrics.length} mock metrics`,
      count: metrics.length
    });
  } catch (error) {
    log.error('Error generating mock metrics', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// VERSION ENDPOINTS
// ==========================================

const versionService = require('../services/versionService');

/**
 * GET /api/fine-tuning/models/:id/versions
 * Get all versions for a model
 */
router.get('/models/:id/versions', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;

    // Verify model ownership
    await fineTuningService.getModelById(modelId, orgId);

    const versions = await versionService.getVersions(modelId);

    res.json({
      success: true,
      versions
    });
  } catch (error) {
    log.error('Error fetching versions', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/models/:id/versions
 * Create a new version
 */
router.post('/models/:id/versions', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;
    const { version_number, description, openai_model_id, performance_score } = req.body;

    // Verify model ownership
    await fineTuningService.getModelById(modelId, orgId);

    const version = await versionService.createVersion(modelId, {
      version_number,
      description,
      openai_model_id,
      performance_score
    });

    res.status(201).json({
      success: true,
      version
    });
  } catch (error) {
    log.error('Error creating version', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/fine-tuning/models/:id/versions/:versionId
 * Update a version
 */
router.put('/models/:id/versions/:versionId', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const versionId = parseInt(req.params.versionId);
    const orgId = req.organization.id;
    const { description, performance_score, metrics } = req.body;

    // Verify model ownership
    await fineTuningService.getModelById(modelId, orgId);

    const version = await versionService.updateVersion(versionId, {
      description,
      performance_score,
      metrics
    });

    res.json({
      success: true,
      version
    });
  } catch (error) {
    log.error('Error updating version', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/fine-tuning/models/:id/versions/:versionId
 * Delete a version
 */
router.delete('/models/:id/versions/:versionId', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const versionId = parseInt(req.params.versionId);
    const orgId = req.organization.id;

    // Verify model ownership
    await fineTuningService.getModelById(modelId, orgId);

    await versionService.deleteVersion(versionId);

    res.json({
      success: true,
      message: 'Version deleted successfully'
    });
  } catch (error) {
    log.error('Error deleting version', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/models/:id/versions/:versionId/activate
 * Set a version as active
 */
router.post('/models/:id/versions/:versionId/activate', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const versionId = parseInt(req.params.versionId);
    const orgId = req.organization.id;

    // Verify model ownership
    await fineTuningService.getModelById(modelId, orgId);

    const version = await versionService.setActiveVersion(versionId);

    res.json({
      success: true,
      version,
      message: 'Version activated'
    });
  } catch (error) {
    log.error('Error activating version', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/models/:id/versions/:versionId/set-production
 * Set a version as production
 */
router.post('/models/:id/versions/:versionId/set-production', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const versionId = parseInt(req.params.versionId);
    const orgId = req.organization.id;

    // Verify model ownership
    await fineTuningService.getModelById(modelId, orgId);

    const version = await versionService.setProductionVersion(versionId);

    res.json({
      success: true,
      version,
      message: 'Version set as production'
    });
  } catch (error) {
    log.error('Error setting production version', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/models/:id/versions/:versionId/rollback
 * Rollback to a specific version
 */
router.post('/models/:id/versions/:versionId/rollback', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const versionId = parseInt(req.params.versionId);
    const orgId = req.organization.id;

    // Verify model ownership
    await fineTuningService.getModelById(modelId, orgId);

    const version = await versionService.rollbackVersion(modelId, versionId);

    res.json({
      success: true,
      version,
      message: 'Rollback completed'
    });
  } catch (error) {
    log.error('Error rolling back version', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/versions/compare
 * Compare multiple versions
 */
router.post('/versions/compare', async (req, res) => {
  try {
    const { versionIds } = req.body;

    if (!versionIds || !Array.isArray(versionIds)) {
      return res.status(400).json({
        success: false,
        error: 'Version IDs array required'
      });
    }

    const comparison = await versionService.compareVersions(versionIds);

    res.json({
      success: true,
      comparison
    });
  } catch (error) {
    log.error('Error comparing versions', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// A/B TEST ENDPOINTS
// ==========================================

const abTestService = require('../services/abTestService');

/**
 * GET /api/fine-tuning/ab-tests
 * Get all A/B tests
 */
router.get('/ab-tests', async (req, res) => {
  try {
    const orgId = req.organization.id;
    const tests = await abTestService.getABTests(orgId);

    res.json({
      success: true,
      tests
    });
  } catch (error) {
    log.error('Error fetching A/B tests', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/ab-tests
 * Create a new A/B test
 */
router.post('/ab-tests', async (req, res) => {
  try {
    const orgId = req.organization.id;
    const userId = req.user.id;
    const { name, description, model_a_version_id, model_b_version_id, traffic_split } = req.body;

    if (!name || !model_a_version_id || !model_b_version_id) {
      return res.status(400).json({
        success: false,
        error: 'Name and both version IDs are required'
      });
    }

    const test = await abTestService.createABTest({
      organization_id: orgId,
      created_by: userId,
      name,
      description,
      model_a_version_id,
      model_b_version_id,
      traffic_split
    });

    res.status(201).json({
      success: true,
      test
    });
  } catch (error) {
    log.error('Error creating A/B test', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/ab-tests/:id
 * Get a single A/B test
 */
router.get('/ab-tests/:id', async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    const test = await abTestService.getABTest(testId);

    if (!test) {
      return res.status(404).json({
        success: false,
        error: 'Test not found'
      });
    }

    res.json({
      success: true,
      test
    });
  } catch (error) {
    log.error('Error fetching A/B test', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/fine-tuning/ab-tests/:id
 * Update an A/B test
 */
router.put('/ab-tests/:id', async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    const { name, description, traffic_split } = req.body;

    const test = await abTestService.updateABTest(testId, {
      name,
      description,
      traffic_split
    });

    res.json({
      success: true,
      test
    });
  } catch (error) {
    log.error('Error updating A/B test', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/fine-tuning/ab-tests/:id
 * Delete an A/B test
 */
router.delete('/ab-tests/:id', async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    await abTestService.deleteABTest(testId);

    res.json({
      success: true,
      message: 'Test deleted successfully'
    });
  } catch (error) {
    log.error('Error deleting A/B test', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/ab-tests/:id/start
 * Start an A/B test
 */
router.post('/ab-tests/:id/start', async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    const test = await abTestService.startTest(testId);

    res.json({
      success: true,
      test,
      message: 'Test started'
    });
  } catch (error) {
    log.error('Error starting A/B test', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/ab-tests/:id/stop
 * Stop an A/B test
 */
router.post('/ab-tests/:id/stop', async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    const test = await abTestService.stopTest(testId);

    res.json({
      success: true,
      test,
      message: 'Test stopped'
    });
  } catch (error) {
    log.error('Error stopping A/B test', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/ab-tests/:id/cancel
 * Cancel an A/B test
 */
router.post('/ab-tests/:id/cancel', async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    const test = await abTestService.cancelTest(testId);

    res.json({
      success: true,
      test,
      message: 'Test cancelled'
    });
  } catch (error) {
    log.error('Error cancelling A/B test', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/ab-tests/:id/results
 * Get A/B test results
 */
router.get('/ab-tests/:id/results', async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    const results = await abTestService.getTestResults(testId);

    res.json({
      success: true,
      ...results
    });
  } catch (error) {
    log.error('Error fetching A/B test results', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/ab-tests/:id/record
 * Record a test result
 */
router.post('/ab-tests/:id/record', async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    const { version_id, prompt, response, response_time_ms, tokens_used, session_id } = req.body;

    if (!version_id || !prompt) {
      return res.status(400).json({
        success: false,
        error: 'Version ID and prompt are required'
      });
    }

    const result = await abTestService.recordTestResult(testId, version_id, {
      prompt,
      response,
      response_time_ms,
      tokens_used,
      session_id
    });

    res.status(201).json({
      success: true,
      result
    });
  } catch (error) {
    log.error('Error recording test result', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/ab-tests/:id/feedback
 * Submit user feedback on a test result
 */
router.post('/ab-tests/:id/feedback', async (req, res) => {
  try {
    const { result_id, user_rating, is_preferred } = req.body;

    if (!result_id) {
      return res.status(400).json({
        success: false,
        error: 'Result ID is required'
      });
    }

    const result = await abTestService.updateResultFeedback(result_id, {
      user_rating,
      is_preferred
    });

    res.json({
      success: true,
      result
    });
  } catch (error) {
    log.error('Error submitting feedback', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/ab-tests/:id/winner
 * Calculate the winner of an A/B test
 */
router.get('/ab-tests/:id/winner', async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    const analysis = await abTestService.calculateWinner(testId);

    res.json({
      success: true,
      ...analysis
    });
  } catch (error) {
    log.error('Error calculating winner', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/ab-tests/:id/declare-winner
 * Declare the winner and end the test
 */
router.post('/ab-tests/:id/declare-winner', async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    const { winner_version_id } = req.body;

    const test = await abTestService.declareWinner(testId, winner_version_id);

    res.json({
      success: true,
      test,
      message: 'Winner declared'
    });
  } catch (error) {
    log.error('Error declaring winner', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/ab-tests/:id/select-version
 * Select which version to use for a request (based on traffic split)
 */
router.post('/ab-tests/:id/select-version', async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    const selection = await abTestService.selectVersionForRequest(testId);

    res.json({
      success: true,
      ...selection
    });
  } catch (error) {
    log.error('Error selecting version', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// UTILITY ENDPOINTS
// ==========================================

/**
 * GET /api/fine-tuning/base-models
 * Get available base models for fine-tuning
 */
router.get('/base-models', (req, res) => {
  const baseModels = [
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      description: 'Fast and cost-effective. Best for most fine-tuning tasks.',
      cost_per_1k_tokens: 0.008
    },
    {
      id: 'gpt-4',
      name: 'GPT-4',
      provider: 'openai',
      description: 'Most capable model. Best for complex reasoning tasks.',
      cost_per_1k_tokens: 0.03
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      description: 'Faster GPT-4 with larger context window.',
      cost_per_1k_tokens: 0.01
    },
    {
      id: 'claude-3-haiku',
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      description: 'Fast and lightweight. Coming soon.',
      cost_per_1k_tokens: 0.00025,
      available: false
    },
    {
      id: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      description: 'Balanced performance. Coming soon.',
      cost_per_1k_tokens: 0.003,
      available: false
    }
  ];

  res.json({
    success: true,
    models: baseModels
  });
});

module.exports = router;
