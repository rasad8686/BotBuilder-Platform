/**
 * Fine-Tuning Routes Tests
 * Tests for /api/fine-tuning endpoints: CRUD, upload, training, metrics
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies before requiring anything
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock all service modules
const mockFineTuningService = {
  createModel: jest.fn(),
  getModels: jest.fn(),
  getModelById: jest.fn(),
  updateModel: jest.fn(),
  deleteModel: jest.fn(),
  uploadDataset: jest.fn(),
  validateDataset: jest.fn(),
  startTraining: jest.fn(),
  getTrainingStatus: jest.fn(),
  cancelTraining: jest.fn(),
  getModelMetrics: jest.fn(),
  getDatasetById: jest.fn(),
  getDatasets: jest.fn(),
  updateDataset: jest.fn(),
  deleteDataset: jest.fn()
};

const mockMetricsService = {
  getModelSummary: jest.fn(),
  getLossHistory: jest.fn(),
  getAccuracyHistory: jest.fn(),
  getTrainingHistory: jest.fn(),
  compareModels: jest.fn(),
  exportMetricsCSV: jest.fn(),
  exportMetricsJSON: jest.fn(),
  getUsageStats: jest.fn(),
  generateMockMetrics: jest.fn()
};

const mockVersionService = {
  getVersions: jest.fn(),
  createVersion: jest.fn(),
  updateVersion: jest.fn(),
  deleteVersion: jest.fn(),
  setActiveVersion: jest.fn(),
  setProductionVersion: jest.fn(),
  rollbackVersion: jest.fn(),
  compareVersions: jest.fn()
};

const mockAbTestService = {
  getABTests: jest.fn(),
  createABTest: jest.fn(),
  getABTest: jest.fn(),
  updateABTest: jest.fn(),
  deleteABTest: jest.fn(),
  startTest: jest.fn(),
  stopTest: jest.fn(),
  cancelTest: jest.fn(),
  recordTestResult: jest.fn(),
  updateResultFeedback: jest.fn(),
  getTestResults: jest.fn(),
  calculateWinner: jest.fn(),
  declareWinner: jest.fn(),
  selectVersionForRequest: jest.fn()
};

const mockDatasetValidator = {
  analyzeDataset: jest.fn(),
  convertCSVtoJSONL: jest.fn(),
  convertJSONtoJSONL: jest.fn()
};

jest.mock('../../services/fineTuningService', () => mockFineTuningService);
jest.mock('../../services/metricsService', () => mockMetricsService);
jest.mock('../../services/versionService', () => mockVersionService);
jest.mock('../../services/abTestService', () => mockAbTestService);
jest.mock('../../services/datasetValidator', () => mockDatasetValidator);

jest.mock('../../controllers/fineTuningController', () => ({
  testModel: jest.fn(),
  getTrainingEvents: jest.fn()
}));

// Mock multer
jest.mock('multer', () => {
  const multer = () => ({
    single: () => (req, res, next) => {
      req.file = req.body._file;
      next();
    }
  });
  multer.memoryStorage = () => ({});
  return multer;
});

// Mock middleware
jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
});

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: (req, res, next) => {
    req.organization = { id: 1, name: 'Test Org' };
    next();
  },
  requireOrganization: (req, res, next) => next()
}));

jest.mock('../../middleware/uploadDataset', () => ({
  uploadDataset: (req, res, next) => next(),
  cleanupFile: jest.fn(),
  formatFileSize: jest.fn(),
  UPLOAD_DIR: '/tmp/uploads'
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  unlinkSync: jest.fn(),
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue('{}'),
    unlink: jest.fn().mockResolvedValue(undefined)
  }
}));

const fineTuningController = require('../../controllers/fineTuningController');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/fine-tuning', require('../../routes/fineTuning'));

describe('Fine-Tuning Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // GET /api/fine-tuning/models
  // ========================================
  describe('GET /api/fine-tuning/models', () => {
    it('should return list of models', async () => {
      const mockModels = [
        { id: 1, name: 'Model 1' },
        { id: 2, name: 'Model 2' }
      ];

      mockFineTuningService.getModels.mockResolvedValueOnce(mockModels);

      const res = await request(app).get('/api/fine-tuning/models');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.models).toHaveLength(2);
    });

    it('should filter by status', async () => {
      mockFineTuningService.getModels.mockResolvedValueOnce([]);

      await request(app).get('/api/fine-tuning/models?status=training');

      expect(mockFineTuningService.getModels).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: 'training' })
      );
    });

    it('should apply pagination', async () => {
      mockFineTuningService.getModels.mockResolvedValueOnce([]);

      await request(app).get('/api/fine-tuning/models?limit=10&offset=20');

      expect(mockFineTuningService.getModels).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ limit: 10, offset: 20 })
      );
    });

    it('should handle errors', async () => {
      mockFineTuningService.getModels.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/api/fine-tuning/models');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // POST /api/fine-tuning/models
  // ========================================
  describe('POST /api/fine-tuning/models', () => {
    it('should create a new model', async () => {
      const mockModel = { id: 1, name: 'New Model', base_model: 'gpt-3.5-turbo' };

      mockFineTuningService.createModel.mockResolvedValueOnce(mockModel);

      const res = await request(app)
        .post('/api/fine-tuning/models')
        .send({
          name: 'New Model',
          description: 'Test model',
          base_model: 'gpt-3.5-turbo'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.model.name).toBe('New Model');
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/models')
        .send({ base_model: 'gpt-3.5-turbo' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('name');
    });

    it('should return 400 if base_model is missing', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/models')
        .send({ name: 'Test' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Base model');
    });

    it('should handle creation errors', async () => {
      mockFineTuningService.createModel.mockRejectedValueOnce(
        new Error('Invalid base model')
      );

      const res = await request(app)
        .post('/api/fine-tuning/models')
        .send({ name: 'Test', base_model: 'invalid' });

      expect(res.status).toBe(400);
    });
  });

  // ========================================
  // GET /api/fine-tuning/models/:id
  // ========================================
  describe('GET /api/fine-tuning/models/:id', () => {
    it('should return single model', async () => {
      const mockModel = { id: 1, name: 'Test Model' };

      mockFineTuningService.getModelById.mockResolvedValueOnce(mockModel);

      const res = await request(app).get('/api/fine-tuning/models/1');

      expect(res.status).toBe(200);
      expect(res.body.model.id).toBe(1);
    });

    it('should return 404 if not found', async () => {
      mockFineTuningService.getModelById.mockRejectedValueOnce(
        new Error('Model not found')
      );

      const res = await request(app).get('/api/fine-tuning/models/999');

      expect(res.status).toBe(404);
    });
  });

  // ========================================
  // PUT /api/fine-tuning/models/:id
  // ========================================
  describe('PUT /api/fine-tuning/models/:id', () => {
    it('should update model', async () => {
      const mockModel = { id: 1, name: 'Updated Name' };

      mockFineTuningService.updateModel.mockResolvedValueOnce(mockModel);

      const res = await request(app)
        .put('/api/fine-tuning/models/1')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.model.name).toBe('Updated Name');
    });

    it('should handle update errors', async () => {
      mockFineTuningService.updateModel.mockRejectedValueOnce(
        new Error('Model not found')
      );

      const res = await request(app)
        .put('/api/fine-tuning/models/999')
        .send({ name: 'Test' });

      expect(res.status).toBe(400);
    });
  });

  // ========================================
  // DELETE /api/fine-tuning/models/:id
  // ========================================
  describe('DELETE /api/fine-tuning/models/:id', () => {
    it('should delete model', async () => {
      mockFineTuningService.deleteModel.mockResolvedValueOnce({ success: true });

      const res = await request(app).delete('/api/fine-tuning/models/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should handle delete errors', async () => {
      mockFineTuningService.deleteModel.mockRejectedValueOnce(
        new Error('Cannot delete training model')
      );

      const res = await request(app).delete('/api/fine-tuning/models/1');

      expect(res.status).toBe(400);
    });
  });

  // ========================================
  // POST /api/fine-tuning/models/:id/train
  // ========================================
  describe('POST /api/fine-tuning/models/:id/train', () => {
    it('should start training', async () => {
      const mockJob = { id: 1, status: 'pending' };

      mockFineTuningService.startTraining.mockResolvedValueOnce(mockJob);

      const res = await request(app)
        .post('/api/fine-tuning/models/1/train')
        .send({ epochs: 3 });

      expect(res.status).toBe(201);
      expect(res.body.job).toBeDefined();
    });

    it('should handle training errors', async () => {
      mockFineTuningService.startTraining.mockRejectedValueOnce(
        new Error('No valid dataset')
      );

      const res = await request(app).post('/api/fine-tuning/models/1/train');

      expect(res.status).toBe(400);
    });
  });

  // ========================================
  // GET /api/fine-tuning/models/:id/status
  // ========================================
  describe('GET /api/fine-tuning/models/:id/status', () => {
    it('should return training status', async () => {
      const mockStatus = {
        model_status: 'training',
        job: { id: 1, status: 'running' }
      };

      mockFineTuningService.getTrainingStatus.mockResolvedValueOnce(mockStatus);

      const res = await request(app).get('/api/fine-tuning/models/1/status');

      expect(res.status).toBe(200);
      expect(res.body.model_status).toBe('training');
    });
  });

  // ========================================
  // POST /api/fine-tuning/models/:id/cancel
  // ========================================
  describe('POST /api/fine-tuning/models/:id/cancel', () => {
    it('should cancel training', async () => {
      mockFineTuningService.cancelTraining.mockResolvedValueOnce({ success: true });

      const res = await request(app).post('/api/fine-tuning/models/1/cancel');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should handle cancel errors', async () => {
      mockFineTuningService.cancelTraining.mockRejectedValueOnce(
        new Error('Model is not training')
      );

      const res = await request(app).post('/api/fine-tuning/models/1/cancel');

      expect(res.status).toBe(400);
    });
  });

  // ========================================
  // POST /api/fine-tuning/models/:id/test
  // ========================================
  describe('POST /api/fine-tuning/models/:id/test', () => {
    it('should test model', async () => {
      const mockResult = {
        model_id: 'ft:test',
        prompt: 'Hello',
        response: 'Hi there!'
      };

      fineTuningController.testModel.mockResolvedValueOnce(mockResult);

      const res = await request(app)
        .post('/api/fine-tuning/models/1/test')
        .send({ prompt: 'Hello' });

      expect(res.status).toBe(200);
      expect(res.body.response).toBe('Hi there!');
    });

    it('should return 400 if prompt missing', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/models/1/test')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Prompt');
    });
  });

  // ========================================
  // GET /api/fine-tuning/models/:id/events
  // ========================================
  describe('GET /api/fine-tuning/models/:id/events', () => {
    it('should return training events', async () => {
      const mockEvents = [
        { id: 'evt-1', message: 'Training started' },
        { id: 'evt-2', message: 'Step 100' }
      ];

      fineTuningController.getTrainingEvents.mockResolvedValueOnce(mockEvents);

      const res = await request(app).get('/api/fine-tuning/models/1/events');

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(2);
    });
  });

  // ========================================
  // METRICS ENDPOINTS
  // ========================================
  describe('GET /api/fine-tuning/models/:id/metrics/summary', () => {
    it('should return metrics summary', async () => {
      mockFineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      mockMetricsService.getModelSummary.mockResolvedValueOnce({
        totalSteps: 300,
        bestLoss: { train: 0.25 }
      });

      const res = await request(app).get('/api/fine-tuning/models/1/metrics/summary');

      expect(res.status).toBe(200);
      expect(res.body.summary.totalSteps).toBe(300);
    });
  });

  describe('GET /api/fine-tuning/models/:id/metrics/loss', () => {
    it('should return loss history', async () => {
      mockFineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      mockMetricsService.getLossHistory.mockResolvedValueOnce([
        { step: 100, trainLoss: 0.5 }
      ]);

      const res = await request(app).get('/api/fine-tuning/models/1/metrics/loss');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/fine-tuning/compare', () => {
    it('should compare models', async () => {
      mockFineTuningService.getModelById.mockResolvedValue({ id: 1 });
      mockMetricsService.compareModels.mockResolvedValueOnce([
        { id: 1, name: 'Model A' },
        { id: 2, name: 'Model B' }
      ]);

      const res = await request(app).get('/api/fine-tuning/compare?ids=1,2');

      expect(res.status).toBe(200);
      expect(res.body.comparison).toHaveLength(2);
    });

    it('should return 400 if no IDs provided', async () => {
      const res = await request(app).get('/api/fine-tuning/compare');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/fine-tuning/models/:id/metrics/export', () => {
    it('should export as JSON by default', async () => {
      mockFineTuningService.getModelById.mockResolvedValueOnce({ id: 1, name: 'Test' });
      mockMetricsService.exportMetricsJSON.mockResolvedValueOnce({ modelId: 1 });

      const res = await request(app).get('/api/fine-tuning/models/1/metrics/export');

      expect(res.status).toBe(200);
    });

    it('should export as CSV when specified', async () => {
      mockFineTuningService.getModelById.mockResolvedValueOnce({ id: 1, name: 'Test' });
      mockMetricsService.exportMetricsCSV.mockResolvedValueOnce('step,loss\n100,0.5');

      const res = await request(app).get('/api/fine-tuning/models/1/metrics/export?format=csv');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });
  });

  // ========================================
  // VERSION ENDPOINTS
  // ========================================
  describe('GET /api/fine-tuning/models/:id/versions', () => {
    it('should return versions', async () => {
      mockFineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      mockVersionService.getVersions.mockResolvedValueOnce([
        { id: 1, version_number: 'v1.0' }
      ]);

      const res = await request(app).get('/api/fine-tuning/models/1/versions');

      expect(res.status).toBe(200);
      expect(res.body.versions).toHaveLength(1);
    });
  });

  describe('POST /api/fine-tuning/models/:id/versions', () => {
    it('should create version', async () => {
      mockFineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      mockVersionService.createVersion.mockResolvedValueOnce({
        id: 1,
        version_number: 'v1.0'
      });

      const res = await request(app)
        .post('/api/fine-tuning/models/1/versions')
        .send({ description: 'Initial version' });

      expect(res.status).toBe(201);
      expect(res.body.version.version_number).toBe('v1.0');
    });
  });

  describe('POST /api/fine-tuning/models/:id/versions/:versionId/activate', () => {
    it('should activate version', async () => {
      mockFineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      mockVersionService.setActiveVersion.mockResolvedValueOnce({
        id: 1,
        is_active: true
      });

      const res = await request(app).post('/api/fine-tuning/models/1/versions/1/activate');

      expect(res.status).toBe(200);
      expect(res.body.version.is_active).toBe(true);
    });
  });

  describe('POST /api/fine-tuning/models/:id/versions/:versionId/rollback', () => {
    it('should rollback to version', async () => {
      mockFineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      mockVersionService.rollbackVersion.mockResolvedValueOnce({
        id: 1,
        is_active: true,
        is_production: true
      });

      const res = await request(app).post('/api/fine-tuning/models/1/versions/1/rollback');

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Rollback');
    });
  });

  // ========================================
  // A/B TEST ENDPOINTS
  // ========================================
  describe('GET /api/fine-tuning/ab-tests', () => {
    it('should return A/B tests', async () => {
      mockAbTestService.getABTests.mockResolvedValueOnce([
        { id: 1, name: 'Test 1' }
      ]);

      const res = await request(app).get('/api/fine-tuning/ab-tests');

      expect(res.status).toBe(200);
      expect(res.body.tests).toHaveLength(1);
    });
  });

  describe('POST /api/fine-tuning/ab-tests', () => {
    it('should create A/B test', async () => {
      mockAbTestService.createABTest.mockResolvedValueOnce({
        id: 1,
        name: 'New Test',
        status: 'draft'
      });

      const res = await request(app)
        .post('/api/fine-tuning/ab-tests')
        .send({
          name: 'New Test',
          model_a_version_id: 1,
          model_b_version_id: 2
        });

      expect(res.status).toBe(201);
      expect(res.body.test.name).toBe('New Test');
    });

    it('should return 400 if required fields missing', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/ab-tests')
        .send({ name: 'Test' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/fine-tuning/ab-tests/:id/start', () => {
    it('should start test', async () => {
      mockAbTestService.startTest.mockResolvedValueOnce({
        id: 1,
        status: 'running'
      });

      const res = await request(app).post('/api/fine-tuning/ab-tests/1/start');

      expect(res.status).toBe(200);
      expect(res.body.test.status).toBe('running');
    });
  });

  describe('POST /api/fine-tuning/ab-tests/:id/stop', () => {
    it('should stop test', async () => {
      mockAbTestService.stopTest.mockResolvedValueOnce({
        id: 1,
        status: 'completed'
      });

      const res = await request(app).post('/api/fine-tuning/ab-tests/1/stop');

      expect(res.status).toBe(200);
      expect(res.body.test.status).toBe('completed');
    });
  });

  describe('GET /api/fine-tuning/ab-tests/:id/results', () => {
    it('should return test results', async () => {
      mockAbTestService.getTestResults.mockResolvedValueOnce({
        test: { id: 1 },
        versionA: { totalRequests: 100 },
        versionB: { totalRequests: 100 }
      });

      const res = await request(app).get('/api/fine-tuning/ab-tests/1/results');

      expect(res.status).toBe(200);
      expect(res.body.versionA.totalRequests).toBe(100);
    });
  });

  describe('POST /api/fine-tuning/ab-tests/:id/record', () => {
    it('should record test result', async () => {
      mockAbTestService.recordTestResult.mockResolvedValueOnce({
        id: 1,
        prompt: 'Test'
      });

      const res = await request(app)
        .post('/api/fine-tuning/ab-tests/1/record')
        .send({
          version_id: 1,
          prompt: 'Test prompt',
          response: 'Response'
        });

      expect(res.status).toBe(201);
    });

    it('should return 400 if version_id or prompt missing', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/ab-tests/1/record')
        .send({ response: 'Test' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/fine-tuning/ab-tests/:id/winner', () => {
    it('should calculate winner', async () => {
      mockAbTestService.calculateWinner.mockResolvedValueOnce({
        winner: 'A',
        winnerId: 1,
        confidence: 85
      });

      const res = await request(app).get('/api/fine-tuning/ab-tests/1/winner');

      expect(res.status).toBe(200);
      expect(res.body.winner).toBe('A');
    });
  });

  describe('POST /api/fine-tuning/ab-tests/:id/select-version', () => {
    it('should select version for request', async () => {
      mockAbTestService.selectVersionForRequest.mockResolvedValueOnce({
        selectedVersion: 'A',
        versionId: 1,
        openaiModelId: 'ft:test'
      });

      const res = await request(app).post('/api/fine-tuning/ab-tests/1/select-version');

      expect(res.status).toBe(200);
      expect(res.body.selectedVersion).toBe('A');
    });
  });

  // ========================================
  // BASE MODELS ENDPOINT
  // ========================================
  describe('GET /api/fine-tuning/base-models', () => {
    it('should return available base models', async () => {
      const res = await request(app).get('/api/fine-tuning/base-models');

      expect(res.status).toBe(200);
      expect(res.body.models).toBeDefined();
      expect(res.body.models.length).toBeGreaterThan(0);

      const gpt35 = res.body.models.find(m => m.id === 'gpt-3.5-turbo');
      expect(gpt35).toBeDefined();
      expect(gpt35.provider).toBe('openai');
    });
  });
});
