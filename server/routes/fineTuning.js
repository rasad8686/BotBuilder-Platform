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
 * GET /api/fine-tuning/models/:id/cost-estimate
 * Get estimated training cost for a model
 */
router.get('/models/:id/cost-estimate', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;
    const { epochs } = req.query;

    const estimate = await fineTuningService.estimateTrainingCost(modelId, orgId, {
      epochs: parseInt(epochs) || 3
    });

    res.json({
      success: true,
      estimate
    });
  } catch (error) {
    log.error('Error estimating training cost', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/models/:id/progress
 * Get real-time training progress
 */
router.get('/models/:id/progress', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;

    const progress = await fineTuningService.getTrainingProgress(modelId, orgId);

    res.json({
      success: true,
      ...progress
    });
  } catch (error) {
    log.error('Error fetching training progress', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/pricing
 * Get pricing information for all models
 */
router.get('/pricing', (req, res) => {
  res.json({
    success: true,
    pricing: fineTuningService.TRAINING_COSTS,
    currency: 'USD',
    unit: 'per 1000 tokens'
  });
});

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
      description: 'Fast and lightweight. Best for high-volume, low-latency tasks.',
      cost_per_1k_tokens: 0.00025,
      training_cost_per_1k_tokens: 0.0004,
      available: true,
      capabilities: ['fast-inference', 'cost-effective', 'high-throughput'],
      max_context: 200000,
      recommended_for: ['Classification', 'Entity extraction', 'Simple Q&A']
    },
    {
      id: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      description: 'Balanced performance. Ideal balance of speed and intelligence.',
      cost_per_1k_tokens: 0.003,
      training_cost_per_1k_tokens: 0.008,
      available: true,
      capabilities: ['balanced', 'versatile', 'good-reasoning'],
      max_context: 200000,
      recommended_for: ['Customer support', 'Content generation', 'Data analysis']
    }
  ];

  res.json({
    success: true,
    models: baseModels
  });
});

// ==========================================
// SSE (SERVER-SENT EVENTS) ENDPOINT
// ==========================================

const fineTuningController = require('../controllers/fineTuningController');

/**
 * GET /api/fine-tuning/:jobId/stream
 * Server-Sent Events endpoint for real-time training updates
 *
 * This provides an alternative to WebSocket for clients that prefer SSE.
 * The client can connect and receive real-time training progress updates.
 */
router.get('/:jobId/stream', async (req, res) => {
  const { jobId } = req.params;
  const orgId = req.organization.id;

  // Validate job exists and belongs to org
  try {
    const jobInfo = await fineTuningService.getJobByOpenAIId(jobId, orgId);
    if (!jobInfo) {
      return res.status(404).json({
        success: false,
        error: 'Training job not found'
      });
    }
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // For nginx proxy

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ jobId, message: 'Connected to training stream' })}\n\n`);

  // Keep track of last status to detect changes
  let lastStatus = null;
  let lastProgress = null;

  // Polling function for SSE
  const pollInterval = setInterval(async () => {
    try {
      // Get current status from OpenAI
      const status = await fineTuningService.getTrainingStatusByJobId(jobId);

      if (!status) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: 'Could not fetch status' })}\n\n`);
        return;
      }

      // Send status change event
      if (status.status !== lastStatus) {
        res.write(`event: status\ndata: ${JSON.stringify({
          jobId,
          status: status.status,
          previousStatus: lastStatus,
          timestamp: new Date().toISOString()
        })}\n\n`);
        lastStatus = status.status;

        // Handle terminal states
        if (['succeeded', 'failed', 'cancelled'].includes(status.status)) {
          res.write(`event: ${status.status}\ndata: ${JSON.stringify({
            jobId,
            status: status.status,
            fineTunedModel: status.fine_tuned_model,
            trainedTokens: status.trained_tokens,
            error: status.error,
            timestamp: new Date().toISOString()
          })}\n\n`);

          // Close connection for terminal states
          clearInterval(pollInterval);
          res.end();
          return;
        }
      }

      // Send progress update
      const currentProgress = status.trained_tokens || 0;
      if (currentProgress !== lastProgress) {
        const progressPercent = status.estimated_total_tokens
          ? Math.round((currentProgress / status.estimated_total_tokens) * 100)
          : 0;

        res.write(`event: progress\ndata: ${JSON.stringify({
          jobId,
          trainedTokens: currentProgress,
          estimatedTotalTokens: status.estimated_total_tokens,
          progress: progressPercent,
          timestamp: new Date().toISOString()
        })}\n\n`);
        lastProgress = currentProgress;
      }

      // Send metrics if available
      if (status.training_metrics) {
        res.write(`event: metrics\ndata: ${JSON.stringify({
          jobId,
          metrics: status.training_metrics,
          timestamp: new Date().toISOString()
        })}\n\n`);
      }

      // Send heartbeat
      res.write(`:heartbeat\n\n`);

    } catch (error) {
      log.error('SSE poll error', { jobId, error: error.message });
      res.write(`event: error\ndata: ${JSON.stringify({
        error: 'Failed to fetch training status',
        temporary: true
      })}\n\n`);
    }
  }, 5000); // Poll every 5 seconds for SSE (more frequent than background poller)

  // Handle client disconnect
  req.on('close', () => {
    log.info('SSE client disconnected', { jobId });
    clearInterval(pollInterval);
  });

  // Handle connection errors
  req.on('error', (err) => {
    log.error('SSE connection error', { jobId, error: err.message });
    clearInterval(pollInterval);
  });
});

/**
 * GET /api/fine-tuning/models/:id/stream
 * SSE endpoint by model ID (alternative to job ID)
 */
router.get('/models/:id/stream', async (req, res) => {
  const modelId = parseInt(req.params.id);
  const orgId = req.organization.id;

  try {
    // Get the active job for this model
    const status = await fineTuningService.getTrainingStatus(modelId, orgId);

    if (!status.job || !status.job.job_id) {
      return res.status(404).json({
        success: false,
        error: 'No active training job found for this model'
      });
    }

    // Redirect to job stream
    const jobId = status.job.job_id;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({
      modelId,
      jobId,
      message: 'Connected to training stream'
    })}\n\n`);

    let lastStatus = null;
    let lastProgress = null;

    const pollInterval = setInterval(async () => {
      try {
        const currentStatus = await fineTuningService.getTrainingStatus(modelId, orgId);

        if (!currentStatus.job) {
          res.write(`event: error\ndata: ${JSON.stringify({ error: 'Job not found' })}\n\n`);
          clearInterval(pollInterval);
          res.end();
          return;
        }

        const job = currentStatus.job;

        // Status change
        if (job.status !== lastStatus) {
          res.write(`event: status\ndata: ${JSON.stringify({
            modelId,
            jobId: job.job_id,
            status: job.status,
            previousStatus: lastStatus,
            timestamp: new Date().toISOString()
          })}\n\n`);
          lastStatus = job.status;

          // Terminal states
          if (['succeeded', 'failed', 'cancelled'].includes(job.status)) {
            res.write(`event: ${job.status}\ndata: ${JSON.stringify({
              modelId,
              jobId: job.job_id,
              status: job.status,
              fineTunedModel: job.fine_tuned_model,
              error: job.error,
              timestamp: new Date().toISOString()
            })}\n\n`);

            clearInterval(pollInterval);
            res.end();
            return;
          }
        }

        // Progress
        if (currentStatus.progress !== lastProgress) {
          res.write(`event: progress\ndata: ${JSON.stringify({
            modelId,
            jobId: job.job_id,
            progress: currentStatus.progress,
            epoch: currentStatus.epoch,
            totalEpochs: currentStatus.totalEpochs,
            timestamp: new Date().toISOString()
          })}\n\n`);
          lastProgress = currentStatus.progress;
        }

        // Heartbeat
        res.write(`:heartbeat\n\n`);

      } catch (error) {
        log.error('Model SSE poll error', { modelId, error: error.message });
        res.write(`event: error\ndata: ${JSON.stringify({
          error: error.message,
          temporary: true
        })}\n\n`);
      }
    }, 5000);

    req.on('close', () => {
      log.info('Model SSE client disconnected', { modelId });
      clearInterval(pollInterval);
    });

    req.on('error', (err) => {
      log.error('Model SSE connection error', { modelId, error: err.message });
      clearInterval(pollInterval);
    });

  } catch (error) {
    log.error('Error starting model SSE stream', { modelId, error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// MODEL TESTING & DEPLOYMENT ENDPOINTS
// ==========================================

const fineTuningTestService = require('../services/fine-tuning-test.service');

/**
 * POST /api/fine-tuning/models/:id/test-playground
 * Test model in playground with detailed results
 */
router.post('/models/:id/test-playground', async (req, res) => {
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

    // Verify model ownership
    await fineTuningService.getModelById(modelId, orgId);

    const result = await fineTuningTestService.testModel(modelId, prompt, {
      systemMessage,
      maxTokens,
      temperature
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Error in test playground', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/compare
 * Compare multiple models with test prompts
 */
router.post('/compare', async (req, res) => {
  try {
    const orgId = req.organization.id;
    const { modelIds, prompts, options } = req.body;

    if (!modelIds || !Array.isArray(modelIds) || modelIds.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 model IDs required'
      });
    }

    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least 1 test prompt required'
      });
    }

    // Verify all models belong to org
    for (const modelId of modelIds) {
      await fineTuningService.getModelById(modelId, orgId);
    }

    const result = await fineTuningTestService.compareModels(modelIds, prompts, options);

    res.json({
      success: true,
      ...result
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
 * POST /api/fine-tuning/models/:id/benchmark
 * Run benchmark test suite on model
 */
router.post('/models/:id/benchmark', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;
    const { testDataset, options } = req.body;

    if (!testDataset) {
      return res.status(400).json({
        success: false,
        error: 'Test dataset required'
      });
    }

    // Verify model ownership
    await fineTuningService.getModelById(modelId, orgId);

    const result = await fineTuningTestService.runBenchmark(modelId, testDataset, options);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Error running benchmark', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/models/:id/test-history
 * Get test history for a model
 */
router.get('/models/:id/test-history', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;
    const { limit, offset, testType } = req.query;

    // Verify model ownership
    await fineTuningService.getModelById(modelId, orgId);

    const history = await fineTuningTestService.getTestHistory(modelId, {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      testType
    });

    res.json({
      success: true,
      ...history
    });
  } catch (error) {
    log.error('Error fetching test history', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/models/:id/deploy
 * Deploy model to a bot
 */
router.post('/models/:id/deploy', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;
    const userId = req.user.id;
    const { botId } = req.body;

    if (!botId) {
      return res.status(400).json({
        success: false,
        error: 'Bot ID is required'
      });
    }

    // Verify model ownership
    await fineTuningService.getModelById(modelId, orgId);

    const result = await fineTuningTestService.deployModel(modelId, botId, userId);

    res.json({
      success: true,
      message: 'Model deployed successfully',
      ...result
    });
  } catch (error) {
    log.error('Error deploying model', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/fine-tuning/models/:id/deploy
 * Undeploy model from a bot
 */
router.delete('/models/:id/deploy', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;
    const { botId } = req.body;

    if (!botId) {
      return res.status(400).json({
        success: false,
        error: 'Bot ID is required'
      });
    }

    // Verify model ownership
    await fineTuningService.getModelById(modelId, orgId);

    const result = await fineTuningTestService.undeployModel(modelId, botId);

    res.json({
      success: true,
      message: 'Model undeployed successfully',
      ...result
    });
  } catch (error) {
    log.error('Error undeploying model', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/deployments
 * Get all deployed models for organization
 */
router.get('/deployments', async (req, res) => {
  try {
    const orgId = req.organization.id;

    const deployments = await fineTuningTestService.getDeployedModels(orgId);

    res.json({
      success: true,
      deployments
    });
  } catch (error) {
    log.error('Error fetching deployments', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/models/:id/deployment-status
 * Get deployment status for a model
 */
router.get('/models/:id/deployment-status', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;

    // Verify model ownership
    await fineTuningService.getModelById(modelId, orgId);

    const status = await fineTuningTestService.getDeploymentStatus(modelId);

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    log.error('Error fetching deployment status', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/models/:id/set-default
 * Set model as organization default
 */
router.post('/models/:id/set-default', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const orgId = req.organization.id;

    const result = await fineTuningTestService.setDefaultModel(modelId, orgId);

    res.json({
      success: true,
      message: 'Model set as default',
      ...result
    });
  } catch (error) {
    log.error('Error setting default model', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/model-ab-test
 * Create A/B test for models
 */
router.post('/model-ab-test', async (req, res) => {
  try {
    const orgId = req.organization.id;
    const userId = req.user.id;
    const { modelAId, modelBId, trafficSplit, name, description } = req.body;

    if (!modelAId || !modelBId) {
      return res.status(400).json({
        success: false,
        error: 'Both model IDs are required'
      });
    }

    // Verify both models belong to org
    await fineTuningService.getModelById(modelAId, orgId);
    await fineTuningService.getModelById(modelBId, orgId);

    const result = await fineTuningTestService.createModelABTest(
      modelAId,
      modelBId,
      trafficSplit || 50,
      { name, description, organizationId: orgId, userId }
    );

    res.status(201).json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Error creating model A/B test', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/model-ab-test/:id
 * Get A/B test results
 */
router.get('/model-ab-test/:id', async (req, res) => {
  try {
    const testId = parseInt(req.params.id);

    const results = await fineTuningTestService.getABTestResults(testId);

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
 * POST /api/fine-tuning/model-ab-test/:id/start
 * Start model A/B test
 */
router.post('/model-ab-test/:id/start', async (req, res) => {
  try {
    const testId = parseInt(req.params.id);

    const test = await fineTuningTestService.startABTest(testId);

    res.json({
      success: true,
      test,
      message: 'A/B test started'
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
 * POST /api/fine-tuning/model-ab-test/:id/stop
 * Stop model A/B test
 */
router.post('/model-ab-test/:id/stop', async (req, res) => {
  try {
    const testId = parseInt(req.params.id);

    const test = await fineTuningTestService.stopABTest(testId);

    res.json({
      success: true,
      test,
      message: 'A/B test stopped'
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
 * POST /api/fine-tuning/model-ab-test/:id/select-winner
 * Select winner for model A/B test
 */
router.post('/model-ab-test/:id/select-winner', async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    const { winnerModelId } = req.body;

    const result = await fineTuningTestService.selectWinnerModel(testId, winnerModelId);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Error selecting winner', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/model-ab-test/:id/record
 * Record A/B test result
 */
router.post('/model-ab-test/:id/record', async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    const { modelId, prompt, response, latencyMs, tokensUsed, userRating, isPreferred, sessionId } = req.body;

    if (!modelId || !prompt) {
      return res.status(400).json({
        success: false,
        error: 'Model ID and prompt are required'
      });
    }

    const result = await fineTuningTestService.recordABTestResult(testId, modelId, {
      prompt,
      response,
      latencyMs,
      tokensUsed,
      userRating,
      isPreferred,
      sessionId
    });

    res.status(201).json({
      success: true,
      result
    });
  } catch (error) {
    log.error('Error recording A/B test result', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
