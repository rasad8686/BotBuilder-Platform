/**
 * Fine-Tuning Routes Tests
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
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

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../services/fineTuningService', () => ({
  getModels: jest.fn().mockResolvedValue([{ id: 1, name: 'Model 1' }]),
  createModel: jest.fn().mockResolvedValue({ id: 1, name: 'New Model' }),
  getModelById: jest.fn().mockResolvedValue({ id: 1, name: 'Model 1', base_model: 'gpt-3.5-turbo' }),
  updateModel: jest.fn().mockResolvedValue({ id: 1, name: 'Updated Model' }),
  deleteModel: jest.fn().mockResolvedValue(true),
  uploadDataset: jest.fn().mockResolvedValue({ id: 1, filename: 'data.jsonl' }),
  getDatasetById: jest.fn().mockResolvedValue({ id: 1, file_path: '/tmp/data.jsonl' }),
  getDatasets: jest.fn().mockResolvedValue([{ id: 1, filename: 'data.jsonl' }]),
  updateDataset: jest.fn().mockResolvedValue({ id: 1 }),
  deleteDataset: jest.fn().mockResolvedValue(true),
  startTraining: jest.fn().mockResolvedValue({ id: 1, status: 'running' }),
  getTrainingStatus: jest.fn().mockResolvedValue({ status: 'running', progress: 50 }),
  cancelTraining: jest.fn().mockResolvedValue(true),
  getModelMetrics: jest.fn().mockResolvedValue({ accuracy: 0.95, loss: 0.05 }),
  estimateTrainingCost: jest.fn().mockResolvedValue({ cost: 10.5, currency: 'USD' }),
  getTrainingProgress: jest.fn().mockResolvedValue({ progress: 75, step: 750, totalSteps: 1000 }),
  TRAINING_COSTS: { 'gpt-3.5-turbo': 0.008, 'gpt-4': 0.03 }
}));

jest.mock('../../services/datasetValidator', () => ({
  analyzeDataset: jest.fn().mockResolvedValue({
    total_rows: 100,
    valid_rows: 95,
    preview: [{ messages: [{ role: 'user', content: 'hi' }] }],
    valid: true,
    token_count: 5000,
    estimated_cost: 0.04,
    cost_details: {},
    errors: []
  }),
  convertCSVtoJSONL: jest.fn().mockResolvedValue({ rows: 100, outputPath: '/tmp/data.jsonl' }),
  convertJSONtoJSONL: jest.fn().mockResolvedValue({ rows: 100, outputPath: '/tmp/data.jsonl' })
}));

jest.mock('../../middleware/uploadDataset', () => ({
  uploadDataset: (req, res, next) => next(),
  cleanupFile: jest.fn(),
  formatFileSize: jest.fn(size => `${size} bytes`),
  UPLOAD_DIR: '/tmp/uploads'
}));

jest.mock('../../services/metricsService', () => ({
  getModelSummary: jest.fn().mockResolvedValue({ totalEpochs: 3, finalLoss: 0.05 }),
  getLossHistory: jest.fn().mockResolvedValue([{ epoch: 1, loss: 0.2 }]),
  getAccuracyHistory: jest.fn().mockResolvedValue([{ epoch: 1, accuracy: 0.8 }]),
  getTrainingHistory: jest.fn().mockResolvedValue([{ id: 1, epoch: 1 }]),
  compareModels: jest.fn().mockResolvedValue({ model1: { accuracy: 0.9 }, model2: { accuracy: 0.85 } }),
  exportMetricsCSV: jest.fn().mockResolvedValue('epoch,loss\n1,0.2\n2,0.1'),
  exportMetricsJSON: jest.fn().mockResolvedValue({ epochs: [{ epoch: 1, loss: 0.2 }] }),
  getUsageStats: jest.fn().mockResolvedValue({ totalRequests: 100, avgLatency: 200 }),
  generateMockMetrics: jest.fn().mockResolvedValue([{ id: 1, epoch: 1, loss: 0.2 }])
}));

jest.mock('../../services/versionService', () => ({
  getVersions: jest.fn().mockResolvedValue([{ id: 1, version_number: '1.0.0' }]),
  createVersion: jest.fn().mockResolvedValue({ id: 1, version_number: '1.0.0' }),
  updateVersion: jest.fn().mockResolvedValue({ id: 1, version_number: '1.0.0' }),
  deleteVersion: jest.fn().mockResolvedValue(true),
  setActiveVersion: jest.fn().mockResolvedValue({ id: 1, is_active: true }),
  setProductionVersion: jest.fn().mockResolvedValue({ id: 1, is_production: true }),
  rollbackVersion: jest.fn().mockResolvedValue({ id: 1 }),
  compareVersions: jest.fn().mockResolvedValue({ v1: { accuracy: 0.9 }, v2: { accuracy: 0.85 } })
}));

jest.mock('../../services/abTestService', () => ({
  getABTests: jest.fn().mockResolvedValue([{ id: 1, name: 'Test 1' }]),
  createABTest: jest.fn().mockResolvedValue({ id: 1, name: 'New Test' }),
  getABTest: jest.fn().mockResolvedValue({ id: 1, name: 'Test 1' }),
  updateABTest: jest.fn().mockResolvedValue({ id: 1, name: 'Updated Test' }),
  deleteABTest: jest.fn().mockResolvedValue(true),
  startTest: jest.fn().mockResolvedValue({ id: 1, status: 'running' }),
  stopTest: jest.fn().mockResolvedValue({ id: 1, status: 'stopped' }),
  cancelTest: jest.fn().mockResolvedValue({ id: 1, status: 'cancelled' }),
  getTestResults: jest.fn().mockResolvedValue({ modelA: { count: 50 }, modelB: { count: 50 } }),
  recordTestResult: jest.fn().mockResolvedValue({ id: 1 }),
  updateResultFeedback: jest.fn().mockResolvedValue({ id: 1, user_rating: 5 }),
  calculateWinner: jest.fn().mockResolvedValue({ winner: 'model_a', confidence: 0.95 }),
  declareWinner: jest.fn().mockResolvedValue({ id: 1, winner_version_id: 1 }),
  selectVersionForRequest: jest.fn().mockResolvedValue({ version_id: 1, variant: 'A' })
}));

jest.mock('../../controllers/fineTuningController', () => ({
  testModel: jest.fn().mockResolvedValue({ response: 'Hello!', tokensUsed: 10 }),
  getTrainingEvents: jest.fn().mockResolvedValue([{ id: 1, event: 'started' }])
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('{}')
}));

const fineTuningService = require('../../services/fineTuningService');
const versionService = require('../../services/versionService');
const abTestService = require('../../services/abTestService');
const fineTuningRouter = require('../../routes/fineTuning');

describe('Fine-Tuning Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/fine-tuning', fineTuningRouter);
  });

  // ==========================================
  // MODEL CRUD
  // ==========================================

  describe('GET /api/fine-tuning/models', () => {
    it('should return models list', async () => {
      const res = await request(app).get('/api/fine-tuning/models');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.models).toHaveLength(1);
    });

    it('should handle query params', async () => {
      await request(app).get('/api/fine-tuning/models?status=active&limit=10&offset=5');

      expect(fineTuningService.getModels).toHaveBeenCalledWith(1, {
        status: 'active',
        limit: 10,
        offset: 5
      });
    });

    it('should handle error', async () => {
      fineTuningService.getModels.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/api/fine-tuning/models');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/fine-tuning/models', () => {
    it('should create a new model', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/models')
        .send({ name: 'New Model', description: 'Test', base_model: 'gpt-3.5-turbo' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.model).toBeDefined();
    });

    it('should require name', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/models')
        .send({ base_model: 'gpt-3.5-turbo' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('name');
    });

    it('should require base_model', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/models')
        .send({ name: 'Test Model' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Base model');
    });
  });

  describe('GET /api/fine-tuning/models/:id', () => {
    it('should return model by ID', async () => {
      const res = await request(app).get('/api/fine-tuning/models/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.model).toBeDefined();
    });

    it('should handle not found', async () => {
      fineTuningService.getModelById.mockRejectedValueOnce(new Error('Model not found'));

      const res = await request(app).get('/api/fine-tuning/models/999');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/fine-tuning/models/:id', () => {
    it('should update model', async () => {
      const res = await request(app)
        .put('/api/fine-tuning/models/1')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/fine-tuning/models/:id', () => {
    it('should delete model', async () => {
      const res = await request(app).delete('/api/fine-tuning/models/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted');
    });
  });

  // ==========================================
  // DATASETS
  // ==========================================

  describe('POST /api/fine-tuning/models/:id/upload', () => {
    it('should require file', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/models/1/upload');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('No file');
    });
  });

  describe('GET /api/fine-tuning/models/:id/datasets', () => {
    it('should return datasets for model', async () => {
      const res = await request(app).get('/api/fine-tuning/models/1/datasets');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.datasets).toBeDefined();
    });

    it('should return 404 if model not found', async () => {
      fineTuningService.getModelById.mockRejectedValueOnce(new Error('Model not found'));

      const res = await request(app).get('/api/fine-tuning/models/999/datasets');

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/fine-tuning/models/:id/datasets/:datasetId', () => {
    it('should delete dataset', async () => {
      const res = await request(app).delete('/api/fine-tuning/models/1/datasets/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================
  // TRAINING
  // ==========================================

  describe('POST /api/fine-tuning/models/:id/train', () => {
    it('should start training', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/models/1/train')
        .send({ epochs: 3 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.job).toBeDefined();
    });
  });

  describe('GET /api/fine-tuning/models/:id/status', () => {
    it('should return training status', async () => {
      const res = await request(app).get('/api/fine-tuning/models/1/status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('running');
    });
  });

  describe('POST /api/fine-tuning/models/:id/cancel', () => {
    it('should cancel training', async () => {
      const res = await request(app).post('/api/fine-tuning/models/1/cancel');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('cancelled');
    });
  });

  describe('GET /api/fine-tuning/models/:id/metrics', () => {
    it('should return model metrics', async () => {
      const res = await request(app).get('/api/fine-tuning/models/1/metrics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/fine-tuning/models/:id/test', () => {
    it('should test model', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/models/1/test')
        .send({ prompt: 'Hello' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should require prompt', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/models/1/test')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Prompt');
    });
  });

  describe('GET /api/fine-tuning/models/:id/events', () => {
    it('should return training events', async () => {
      const res = await request(app).get('/api/fine-tuning/models/1/events');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.events).toBeDefined();
    });
  });

  // ==========================================
  // METRICS
  // ==========================================

  describe('GET /api/fine-tuning/models/:id/metrics/summary', () => {
    it('should return metrics summary', async () => {
      const res = await request(app).get('/api/fine-tuning/models/1/metrics/summary');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary).toBeDefined();
    });
  });

  describe('GET /api/fine-tuning/models/:id/metrics/loss', () => {
    it('should return loss history', async () => {
      const res = await request(app).get('/api/fine-tuning/models/1/metrics/loss');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/fine-tuning/models/:id/metrics/accuracy', () => {
    it('should return accuracy history', async () => {
      const res = await request(app).get('/api/fine-tuning/models/1/metrics/accuracy');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/fine-tuning/models/:id/metrics/history', () => {
    it('should return training history', async () => {
      const res = await request(app).get('/api/fine-tuning/models/1/metrics/history');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/fine-tuning/compare', () => {
    it('should compare models', async () => {
      const res = await request(app).get('/api/fine-tuning/compare?ids=1,2');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.comparison).toBeDefined();
    });

    it('should require IDs', async () => {
      const res = await request(app).get('/api/fine-tuning/compare');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('IDs');
    });
  });

  describe('GET /api/fine-tuning/models/:id/metrics/export', () => {
    it('should export as JSON by default', async () => {
      const res = await request(app).get('/api/fine-tuning/models/1/metrics/export');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
    });

    it('should export as CSV', async () => {
      const res = await request(app).get('/api/fine-tuning/models/1/metrics/export?format=csv');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });
  });

  describe('GET /api/fine-tuning/models/:id/usage', () => {
    it('should return usage stats', async () => {
      const res = await request(app).get('/api/fine-tuning/models/1/usage');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.usage).toBeDefined();
    });
  });

  // ==========================================
  // VERSIONS
  // ==========================================

  describe('GET /api/fine-tuning/models/:id/versions', () => {
    it('should return versions', async () => {
      const res = await request(app).get('/api/fine-tuning/models/1/versions');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.versions).toBeDefined();
    });
  });

  describe('POST /api/fine-tuning/models/:id/versions', () => {
    it('should create version', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/models/1/versions')
        .send({ version_number: '1.0.0' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('PUT /api/fine-tuning/models/:id/versions/:versionId', () => {
    it('should update version', async () => {
      const res = await request(app)
        .put('/api/fine-tuning/models/1/versions/1')
        .send({ description: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/fine-tuning/models/:id/versions/:versionId', () => {
    it('should delete version', async () => {
      const res = await request(app).delete('/api/fine-tuning/models/1/versions/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/fine-tuning/models/:id/versions/:versionId/activate', () => {
    it('should activate version', async () => {
      const res = await request(app).post('/api/fine-tuning/models/1/versions/1/activate');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/fine-tuning/models/:id/versions/:versionId/set-production', () => {
    it('should set production version', async () => {
      const res = await request(app).post('/api/fine-tuning/models/1/versions/1/set-production');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/fine-tuning/models/:id/versions/:versionId/rollback', () => {
    it('should rollback version', async () => {
      const res = await request(app).post('/api/fine-tuning/models/1/versions/1/rollback');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/fine-tuning/versions/compare', () => {
    it('should compare versions', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/versions/compare')
        .send({ versionIds: [1, 2] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should require versionIds array', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/versions/compare')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ==========================================
  // A/B TESTS
  // ==========================================

  describe('GET /api/fine-tuning/ab-tests', () => {
    it('should return A/B tests', async () => {
      const res = await request(app).get('/api/fine-tuning/ab-tests');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tests).toBeDefined();
    });
  });

  describe('POST /api/fine-tuning/ab-tests', () => {
    it('should create A/B test', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/ab-tests')
        .send({
          name: 'Test',
          model_a_version_id: 1,
          model_b_version_id: 2
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should require name and version IDs', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/ab-tests')
        .send({ name: 'Test' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/fine-tuning/ab-tests/:id', () => {
    it('should return A/B test', async () => {
      const res = await request(app).get('/api/fine-tuning/ab-tests/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      abTestService.getABTest.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/fine-tuning/ab-tests/999');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/fine-tuning/ab-tests/:id', () => {
    it('should update A/B test', async () => {
      const res = await request(app)
        .put('/api/fine-tuning/ab-tests/1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/fine-tuning/ab-tests/:id', () => {
    it('should delete A/B test', async () => {
      const res = await request(app).delete('/api/fine-tuning/ab-tests/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/fine-tuning/ab-tests/:id/start', () => {
    it('should start test', async () => {
      const res = await request(app).post('/api/fine-tuning/ab-tests/1/start');

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('started');
    });
  });

  describe('POST /api/fine-tuning/ab-tests/:id/stop', () => {
    it('should stop test', async () => {
      const res = await request(app).post('/api/fine-tuning/ab-tests/1/stop');

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('stopped');
    });
  });

  describe('POST /api/fine-tuning/ab-tests/:id/cancel', () => {
    it('should cancel test', async () => {
      const res = await request(app).post('/api/fine-tuning/ab-tests/1/cancel');

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('cancelled');
    });
  });

  describe('GET /api/fine-tuning/ab-tests/:id/results', () => {
    it('should return test results', async () => {
      const res = await request(app).get('/api/fine-tuning/ab-tests/1/results');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/fine-tuning/ab-tests/:id/record', () => {
    it('should record test result', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/ab-tests/1/record')
        .send({ version_id: 1, prompt: 'Hello', response: 'Hi' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should require version_id and prompt', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/ab-tests/1/record')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/fine-tuning/ab-tests/:id/feedback', () => {
    it('should submit feedback', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/ab-tests/1/feedback')
        .send({ result_id: 1, user_rating: 5 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should require result_id', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/ab-tests/1/feedback')
        .send({ user_rating: 5 });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/fine-tuning/ab-tests/:id/winner', () => {
    it('should calculate winner', async () => {
      const res = await request(app).get('/api/fine-tuning/ab-tests/1/winner');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.winner).toBeDefined();
    });
  });

  describe('POST /api/fine-tuning/ab-tests/:id/declare-winner', () => {
    it('should declare winner', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/ab-tests/1/declare-winner')
        .send({ winner_version_id: 1 });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Winner');
    });
  });

  describe('POST /api/fine-tuning/ab-tests/:id/select-version', () => {
    it('should select version for request', async () => {
      const res = await request(app).post('/api/fine-tuning/ab-tests/1/select-version');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.version_id).toBeDefined();
    });
  });

  // ==========================================
  // UTILITY ENDPOINTS
  // ==========================================

  describe('GET /api/fine-tuning/models/:id/cost-estimate', () => {
    it('should return cost estimate', async () => {
      const res = await request(app).get('/api/fine-tuning/models/1/cost-estimate');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.estimate).toBeDefined();
    });
  });

  describe('GET /api/fine-tuning/models/:id/progress', () => {
    it('should return training progress', async () => {
      const res = await request(app).get('/api/fine-tuning/models/1/progress');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.progress).toBeDefined();
    });
  });

  describe('GET /api/fine-tuning/pricing', () => {
    it('should return pricing', async () => {
      const res = await request(app).get('/api/fine-tuning/pricing');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pricing).toBeDefined();
    });
  });

  describe('GET /api/fine-tuning/base-models', () => {
    it('should return base models', async () => {
      const res = await request(app).get('/api/fine-tuning/base-models');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.models).toBeDefined();
      expect(res.body.models.length).toBeGreaterThan(0);
    });
  });
});
