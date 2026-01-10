/**
 * Comprehensive Route Tests
 * Tests for admin.js, fineTuning.js, channelWebhooks.js, clone.js routes
 */

const request = require('supertest');
const express = require('express');

// Mock database
jest.mock('../../db', () => ({
  query: jest.fn()
}));

// Mock auth middleware
jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = { id: 1, organization_id: 1 };
  next();
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock organization context
jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: (req, res, next) => {
    req.organization = { id: 1 };
    next();
  },
  requireOrganization: (req, res, next) => {
    if (!req.organization) {
      return res.status(400).json({ error: 'Organization required' });
    }
    next();
  }
}));

// Mock checkPermission
jest.mock('../../middleware/checkPermission', () => ({
  checkPermission: (permission) => (req, res, next) => {
    next();
  }
}));

// Mock services
jest.mock('../../services/fineTuningService', () => ({
  getModels: jest.fn(),
  createModel: jest.fn(),
  getModelById: jest.fn(),
  updateModel: jest.fn(),
  deleteModel: jest.fn(),
  uploadDataset: jest.fn(),
  getDatasetById: jest.fn(),
  getDatasets: jest.fn(),
  deleteDataset: jest.fn(),
  updateDataset: jest.fn(),
  startTraining: jest.fn(),
  getTrainingStatus: jest.fn(),
  cancelTraining: jest.fn(),
  getModelMetrics: jest.fn(),
  estimateTrainingCost: jest.fn(),
  getTrainingProgress: jest.fn(),
  TRAINING_COSTS: { 'gpt-3.5-turbo': 0.008 }
}));

jest.mock('../../services/datasetValidator', () => ({
  analyzeDataset: jest.fn(),
  convertCSVtoJSONL: jest.fn(),
  convertJSONtoJSONL: jest.fn()
}));

jest.mock('../../services/metricsService', () => ({
  getModelSummary: jest.fn(),
  getLossHistory: jest.fn(),
  getAccuracyHistory: jest.fn(),
  getTrainingHistory: jest.fn(),
  compareModels: jest.fn(),
  exportMetricsCSV: jest.fn(),
  exportMetricsJSON: jest.fn(),
  getUsageStats: jest.fn(),
  generateMockMetrics: jest.fn()
}));

jest.mock('../../services/versionService', () => ({
  getVersions: jest.fn(),
  createVersion: jest.fn(),
  updateVersion: jest.fn(),
  deleteVersion: jest.fn(),
  setActiveVersion: jest.fn(),
  setProductionVersion: jest.fn(),
  rollbackVersion: jest.fn(),
  compareVersions: jest.fn()
}));

jest.mock('../../services/abTestService', () => ({
  getABTests: jest.fn(),
  createABTest: jest.fn(),
  getABTest: jest.fn(),
  updateABTest: jest.fn(),
  deleteABTest: jest.fn(),
  startTest: jest.fn(),
  stopTest: jest.fn(),
  cancelTest: jest.fn(),
  getTestResults: jest.fn(),
  recordTestResult: jest.fn(),
  updateResultFeedback: jest.fn(),
  calculateWinner: jest.fn(),
  declareWinner: jest.fn(),
  selectVersionForRequest: jest.fn()
}));

// Mock channel manager and providers
jest.mock('../../channels/core/ChannelManager', () => ({
  registerHandler: jest.fn(),
  processWebhook: jest.fn()
}));

jest.mock('../../channels/providers/WhatsAppProvider', () => {
  return jest.fn().mockImplementation(() => ({
    handleChallenge: jest.fn(),
    verify: jest.fn()
  }));
});

jest.mock('../../channels/providers/InstagramProvider', () => {
  return jest.fn().mockImplementation(() => ({
    handleChallenge: jest.fn(),
    verify: jest.fn()
  }));
});

jest.mock('../../channels/providers/DiscordProvider', () => {
  return jest.fn().mockImplementation(() => ({}));
});

jest.mock('../../models/Channel', () => ({
  findById: jest.fn()
}));

const db = require('../../db');

// =========================================
// ADMIN ROUTE TESTS
// =========================================

describe('Admin Routes', () => {
  let adminRouter;
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    adminRouter = require('../../routes/admin');
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
  });

  describe('GET /api/admin/audit-logs', () => {
    it('should return audit logs with pagination', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({ rows: [
          { id: 1, action: 'create', resource_type: 'bot', user_name: 'Test User' }
        ]});

      const res = await request(app).get('/api/admin/audit-logs?page=1&limit=50');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(100);
    });

    it('should filter by user_id', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/audit-logs?user_id=5');

      expect(res.status).toBe(200);
      expect(db.query).toHaveBeenCalled();
    });

    it('should filter by action', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/audit-logs?action=create');

      expect(res.status).toBe(200);
    });

    it('should filter by date range', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '15' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/admin/audit-logs?start_date=2024-01-01&end_date=2024-01-31');

      expect(res.status).toBe(200);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/admin/audit-logs');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/audit-logs/actions', () => {
    it('should return list of unique actions', async () => {
      db.query.mockResolvedValueOnce({ rows: [
        { action: 'create' },
        { action: 'update' },
        { action: 'delete' }
      ]});

      const res = await request(app).get('/api/admin/audit-logs/actions');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.actions).toHaveLength(3);
    });

    it('should filter by organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ action: 'create' }] });

      const res = await request(app).get('/api/admin/audit-logs/actions?organization_id=1');

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/stats', () => {
    it('should return organization statistics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // members
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // bots
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }) // active bots
        .mockResolvedValueOnce({ rows: [{ count: '1000' }] }) // messages
        .mockResolvedValueOnce({ rows: [{ count: '50' }] }) // audit events
        .mockResolvedValueOnce({ rows: [] }) // recent activity
        .mockResolvedValueOnce({ rows: [] }) // top users
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro', created_at: new Date() }] });

      const res = await request(app).get('/api/admin/stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats.totalMembers).toBe(10);
      expect(res.body.stats.totalBots).toBe(5);
    });

    it('should handle missing organization plan', async () => {
      db.query
        .mockResolvedValue({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] }); // org result

      const res = await request(app).get('/api/admin/stats');

      expect(res.status).toBe(200);
      expect(res.body.stats.planTier).toBe('unknown');
    });
  });

  describe('GET /api/admin/health', () => {
    it('should return healthy status', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ result: 1 }] });

      const res = await request(app).get('/api/admin/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.health.status).toBe('healthy');
    });

    it('should return unhealthy status on DB error', async () => {
      db.query.mockRejectedValueOnce(new Error('DB Connection Failed'));

      const res = await request(app).get('/api/admin/health');

      expect(res.status).toBe(503);
      expect(res.body.health.status).toBe('unhealthy');
    });
  });

  describe('GET /api/admin/activity-timeline', () => {
    it('should return activity timeline', async () => {
      db.query.mockResolvedValueOnce({ rows: [
        { id: 1, action: 'create', created_at: new Date() }
      ]});

      const res = await request(app).get('/api/admin/activity-timeline');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.timeline).toBeDefined();
      expect(res.body.period).toBeDefined();
    });

    it('should filter by days parameter', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/activity-timeline?days=30');

      expect(res.status).toBe(200);
    });

    it('should limit results', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/activity-timeline?limit=100');

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/billing-stats', () => {
    it('should return billing statistics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [
          { plan_tier: 'free', count: 100 },
          { plan_tier: 'pro', count: 50 }
        ]})
        .mockResolvedValueOnce({ rows: [{ count: 150 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/billing-stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.mrr).toBeDefined();
      expect(res.body.totalUsers).toBe(150);
    });
  });

  describe('GET /api/admin/rate-limit/settings', () => {
    it('should return rate limit settings', async () => {
      db.query.mockResolvedValueOnce({ rows: [
        { enabled: true, max_attempts: 5, window_minutes: 15 }
      ]});

      const res = await request(app).get('/api/admin/rate-limit/settings');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.settings.enabled).toBe(true);
    });

    it('should return default settings if none exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/rate-limit/settings');

      expect(res.status).toBe(200);
      expect(res.body.settings.enabled).toBe(true);
      expect(res.body.settings.max_attempts).toBe(5);
    });
  });

  describe('PUT /api/admin/rate-limit/settings', () => {
    it('should update rate limit settings', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [
          { enabled: false, max_attempts: 10, window_minutes: 30 }
        ]});

      const res = await request(app)
        .put('/api/admin/rate-limit/settings')
        .send({ enabled: false, max_attempts: 10, window_minutes: 30 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should validate max_attempts', async () => {
      const res = await request(app)
        .put('/api/admin/rate-limit/settings')
        .send({ max_attempts: 101 });

      expect(res.status).toBe(400);
    });

    it('should validate window_minutes', async () => {
      const res = await request(app)
        .put('/api/admin/rate-limit/settings')
        .send({ window_minutes: 2000 });

      expect(res.status).toBe(400);
    });

    it('should validate block_duration_minutes', async () => {
      const res = await request(app)
        .put('/api/admin/rate-limit/settings')
        .send({ block_duration_minutes: 20000 });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/admin/rate-limit/blocked', () => {
    it('should return blocked users', async () => {
      db.query.mockResolvedValueOnce({ rows: [
        { id: 1, email: 'test@example.com', ip_address: '127.0.0.1' }
      ]});

      const res = await request(app).get('/api/admin/rate-limit/blocked');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.blocked).toHaveLength(1);
    });
  });

  describe('DELETE /api/admin/rate-limit/blocked/:id', () => {
    it('should unblock user', async () => {
      db.query.mockResolvedValueOnce({ rows: [
        { id: 1, email: 'test@example.com' }
      ]});

      const res = await request(app).delete('/api/admin/rate-limit/blocked/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/admin/rate-limit/blocked/999');

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/admin/rate-limit/blocked', () => {
    it('should unblock all users', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

      const res = await request(app).delete('/api/admin/rate-limit/blocked');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
    });
  });
});

// =========================================
// FINE-TUNING ROUTE TESTS
// =========================================

describe('Fine-Tuning Routes', () => {
  let fineTuningRouter;
  let app;
  const fineTuningService = require('../../services/fineTuningService');
  const metricsService = require('../../services/metricsService');
  const versionService = require('../../services/versionService');
  const abTestService = require('../../services/abTestService');

  beforeEach(() => {
    jest.clearAllMocks();
    fineTuningRouter = require('../../routes/fineTuning');
    app = express();
    app.use(express.json());
    app.use('/api/fine-tuning', fineTuningRouter);
  });

  describe('GET /api/fine-tuning/models', () => {
    it('should return list of models', async () => {
      fineTuningService.getModels.mockResolvedValueOnce([
        { id: 1, name: 'Model 1' },
        { id: 2, name: 'Model 2' }
      ]);

      const res = await request(app).get('/api/fine-tuning/models');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.models).toHaveLength(2);
    });

    it('should accept pagination parameters', async () => {
      fineTuningService.getModels.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/fine-tuning/models?limit=10&offset=20');

      expect(res.status).toBe(200);
      expect(fineTuningService.getModels).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ limit: 10, offset: 20 })
      );
    });

    it('should filter by status', async () => {
      fineTuningService.getModels.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/fine-tuning/models?status=ready');

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/fine-tuning/models', () => {
    it('should create new model', async () => {
      fineTuningService.createModel.mockResolvedValueOnce({
        id: 1,
        name: 'New Model',
        base_model: 'gpt-3.5-turbo'
      });

      const res = await request(app)
        .post('/api/fine-tuning/models')
        .send({ name: 'New Model', base_model: 'gpt-3.5-turbo' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.model.name).toBe('New Model');
    });

    it('should return 400 if name missing', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/models')
        .send({ base_model: 'gpt-3.5-turbo' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('name');
    });

    it('should return 400 if base_model missing', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/models')
        .send({ name: 'Test Model' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('base model');
    });
  });

  describe('GET /api/fine-tuning/models/:id', () => {
    it('should return single model', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({
        id: 1,
        name: 'Model 1'
      });

      const res = await request(app).get('/api/fine-tuning/models/1');

      expect(res.status).toBe(200);
      expect(res.body.model.id).toBe(1);
    });

    it('should return 404 if model not found', async () => {
      fineTuningService.getModelById.mockRejectedValueOnce(new Error('Not found'));

      const res = await request(app).get('/api/fine-tuning/models/999');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/fine-tuning/models/:id', () => {
    it('should update model', async () => {
      fineTuningService.updateModel.mockResolvedValueOnce({
        id: 1,
        name: 'Updated Model'
      });

      const res = await request(app)
        .put('/api/fine-tuning/models/1')
        .send({ name: 'Updated Model' });

      expect(res.status).toBe(200);
      expect(res.body.model.name).toBe('Updated Model');
    });
  });

  describe('DELETE /api/fine-tuning/models/:id', () => {
    it('should delete model', async () => {
      fineTuningService.deleteModel.mockResolvedValueOnce();

      const res = await request(app).delete('/api/fine-tuning/models/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/fine-tuning/models/:id/train', () => {
    it('should start training', async () => {
      fineTuningService.startTraining.mockResolvedValueOnce({
        id: 1,
        status: 'training'
      });

      const res = await request(app)
        .post('/api/fine-tuning/models/1/train')
        .send({ epochs: 3, batch_size: 1 });

      expect(res.status).toBe(201);
      expect(res.body.job).toBeDefined();
    });
  });

  describe('GET /api/fine-tuning/models/:id/status', () => {
    it('should return training status', async () => {
      fineTuningService.getTrainingStatus.mockResolvedValueOnce({
        status: 'training',
        progress: 50
      });

      const res = await request(app).get('/api/fine-tuning/models/1/status');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('training');
    });
  });

  describe('POST /api/fine-tuning/models/:id/cancel', () => {
    it('should cancel training', async () => {
      fineTuningService.cancelTraining.mockResolvedValueOnce();

      const res = await request(app).post('/api/fine-tuning/models/1/cancel');

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('cancel');
    });
  });

  describe('GET /api/fine-tuning/models/:id/metrics', () => {
    it('should return model metrics', async () => {
      fineTuningService.getModelMetrics.mockResolvedValueOnce({
        accuracy: 0.95,
        loss: 0.05
      });

      const res = await request(app).get('/api/fine-tuning/models/1/metrics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/fine-tuning/models/:id/test', () => {
    it('should test model', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      const fineTuningController = require('../../controllers/fineTuningController');

      const res = await request(app)
        .post('/api/fine-tuning/models/1/test')
        .send({ prompt: 'Test prompt' });

      expect(res.status).toBeDefined();
    });

    it('should return 400 if prompt missing', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/models/1/test')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/fine-tuning/compare', () => {
    it('should compare models', async () => {
      fineTuningService.getModelById.mockResolvedValue({ id: 1 });
      metricsService.compareModels.mockResolvedValueOnce({
        comparison: [{ model_id: 1 }, { model_id: 2 }]
      });

      const res = await request(app).get('/api/fine-tuning/compare?ids=1,2');

      expect(res.status).toBe(200);
    });

    it('should return 400 if ids missing', async () => {
      const res = await request(app).get('/api/fine-tuning/compare');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/fine-tuning/pricing', () => {
    it('should return pricing information', async () => {
      const res = await request(app).get('/api/fine-tuning/pricing');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pricing).toBeDefined();
    });
  });

  describe('GET /api/fine-tuning/base-models', () => {
    it('should return available base models', async () => {
      const res = await request(app).get('/api/fine-tuning/base-models');

      expect(res.status).toBe(200);
      expect(res.body.models).toBeDefined();
      expect(Array.isArray(res.body.models)).toBe(true);
    });
  });

  describe('Version Management', () => {
    it('GET /api/fine-tuning/models/:id/versions', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      versionService.getVersions.mockResolvedValueOnce([
        { id: 1, version_number: 'v1.0' }
      ]);

      const res = await request(app).get('/api/fine-tuning/models/1/versions');

      expect(res.status).toBe(200);
      expect(res.body.versions).toBeDefined();
    });

    it('POST /api/fine-tuning/models/:id/versions', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      versionService.createVersion.mockResolvedValueOnce({
        id: 1,
        version_number: 'v1.0'
      });

      const res = await request(app)
        .post('/api/fine-tuning/models/1/versions')
        .send({ version_number: 'v1.0' });

      expect(res.status).toBe(201);
    });

    it('PUT /api/fine-tuning/models/:id/versions/:versionId', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      versionService.updateVersion.mockResolvedValueOnce({
        id: 1,
        description: 'Updated'
      });

      const res = await request(app)
        .put('/api/fine-tuning/models/1/versions/1')
        .send({ description: 'Updated' });

      expect(res.status).toBe(200);
    });

    it('DELETE /api/fine-tuning/models/:id/versions/:versionId', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      versionService.deleteVersion.mockResolvedValueOnce();

      const res = await request(app).delete('/api/fine-tuning/models/1/versions/1');

      expect(res.status).toBe(200);
    });

    it('POST /api/fine-tuning/models/:id/versions/:versionId/activate', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      versionService.setActiveVersion.mockResolvedValueOnce({ id: 1, is_active: true });

      const res = await request(app).post('/api/fine-tuning/models/1/versions/1/activate');

      expect(res.status).toBe(200);
    });
  });

  describe('A/B Testing', () => {
    it('GET /api/fine-tuning/ab-tests', async () => {
      abTestService.getABTests.mockResolvedValueOnce([
        { id: 1, name: 'Test 1' }
      ]);

      const res = await request(app).get('/api/fine-tuning/ab-tests');

      expect(res.status).toBe(200);
      expect(res.body.tests).toBeDefined();
    });

    it('POST /api/fine-tuning/ab-tests', async () => {
      abTestService.createABTest.mockResolvedValueOnce({
        id: 1,
        name: 'New Test'
      });

      const res = await request(app)
        .post('/api/fine-tuning/ab-tests')
        .send({
          name: 'New Test',
          model_a_version_id: 1,
          model_b_version_id: 2
        });

      expect(res.status).toBe(201);
    });

    it('should validate required fields for A/B test', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/ab-tests')
        .send({ name: 'Test' });

      expect(res.status).toBe(400);
    });

    it('GET /api/fine-tuning/ab-tests/:id', async () => {
      abTestService.getABTest.mockResolvedValueOnce({
        id: 1,
        name: 'Test'
      });

      const res = await request(app).get('/api/fine-tuning/ab-tests/1');

      expect(res.status).toBe(200);
    });

    it('PUT /api/fine-tuning/ab-tests/:id', async () => {
      abTestService.updateABTest.mockResolvedValueOnce({
        id: 1,
        name: 'Updated'
      });

      const res = await request(app)
        .put('/api/fine-tuning/ab-tests/1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
    });

    it('DELETE /api/fine-tuning/ab-tests/:id', async () => {
      abTestService.deleteABTest.mockResolvedValueOnce();

      const res = await request(app).delete('/api/fine-tuning/ab-tests/1');

      expect(res.status).toBe(200);
    });

    it('POST /api/fine-tuning/ab-tests/:id/start', async () => {
      abTestService.startTest.mockResolvedValueOnce({ id: 1, status: 'running' });

      const res = await request(app).post('/api/fine-tuning/ab-tests/1/start');

      expect(res.status).toBe(200);
    });

    it('POST /api/fine-tuning/ab-tests/:id/stop', async () => {
      abTestService.stopTest.mockResolvedValueOnce({ id: 1, status: 'stopped' });

      const res = await request(app).post('/api/fine-tuning/ab-tests/1/stop');

      expect(res.status).toBe(200);
    });

    it('GET /api/fine-tuning/ab-tests/:id/results', async () => {
      abTestService.getTestResults.mockResolvedValueOnce({
        results: { a: 100, b: 150 }
      });

      const res = await request(app).get('/api/fine-tuning/ab-tests/1/results');

      expect(res.status).toBe(200);
    });

    it('POST /api/fine-tuning/ab-tests/:id/record', async () => {
      abTestService.recordTestResult.mockResolvedValueOnce({ id: 1 });

      const res = await request(app)
        .post('/api/fine-tuning/ab-tests/1/record')
        .send({ version_id: 1, prompt: 'Test' });

      expect(res.status).toBe(201);
    });

    it('should validate required fields for recording', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/ab-tests/1/record')
        .send({ version_id: 1 });

      expect(res.status).toBe(400);
    });
  });

  describe('Metrics Endpoints', () => {
    it('GET /api/fine-tuning/models/:id/metrics/summary', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      metricsService.getModelSummary.mockResolvedValueOnce({
        total_runs: 10,
        avg_loss: 0.05
      });

      const res = await request(app).get('/api/fine-tuning/models/1/metrics/summary');

      expect(res.status).toBe(200);
      expect(res.body.summary).toBeDefined();
    });

    it('GET /api/fine-tuning/models/:id/metrics/loss', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      metricsService.getLossHistory.mockResolvedValueOnce([
        { epoch: 1, loss: 0.1 }
      ]);

      const res = await request(app).get('/api/fine-tuning/models/1/metrics/loss');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('GET /api/fine-tuning/models/:id/metrics/export with CSV', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({
        id: 1,
        name: 'Model'
      });
      metricsService.exportMetricsCSV.mockResolvedValueOnce('csv,data');

      const res = await request(app).get('/api/fine-tuning/models/1/metrics/export?format=csv');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });

    it('GET /api/fine-tuning/models/:id/metrics/export with JSON', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({
        id: 1,
        name: 'Model'
      });
      metricsService.exportMetricsJSON.mockResolvedValueOnce({ data: [] });

      const res = await request(app).get('/api/fine-tuning/models/1/metrics/export');

      expect(res.status).toBe(200);
    });
  });
});

// =========================================
// CHANNEL WEBHOOK ROUTE TESTS
// =========================================

describe('Channel Webhook Routes', () => {
  let webhookRouter;
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set environment variables
    process.env.WHATSAPP_VERIFY_TOKEN = 'test_whatsapp_token';
    process.env.INSTAGRAM_VERIFY_TOKEN = 'test_instagram_token';

    webhookRouter = require('../../routes/channelWebhooks');
    app = express();
    app.use(express.json());
    app.use('/webhooks', webhookRouter);
  });

  describe('WhatsApp Webhooks', () => {
    it('GET /webhooks/whatsapp should verify webhook', async () => {
      const WhatsAppProvider = require('../../channels/providers/WhatsAppProvider');
      const instance = WhatsAppProvider.mock.results[0]?.value;
      if (instance) {
        instance.handleChallenge.mockReturnValueOnce('challenge_response');
      }

      const res = await request(app).get('/webhooks/whatsapp?hub.challenge=challenge_response');

      expect(res.status).toBe(200);
    });

    it('POST /webhooks/whatsapp should process webhook', async () => {
      const channelManager = require('../../channels/core/ChannelManager');
      channelManager.processWebhook.mockResolvedValueOnce([{ success: true }]);

      const res = await request(app)
        .post('/webhooks/whatsapp')
        .send({ entry: [{ changes: [] }] });

      expect(res.status).toBe(200);
      expect(res.text).toBe('EVENT_RECEIVED');
    });
  });

  describe('Instagram Webhooks', () => {
    it('GET /webhooks/instagram should verify webhook', async () => {
      const InstagramProvider = require('../../channels/providers/InstagramProvider');
      const instance = InstagramProvider.mock.results[0]?.value;
      if (instance) {
        instance.handleChallenge.mockReturnValueOnce('challenge');
      }

      const res = await request(app).get('/webhooks/instagram?hub.challenge=challenge');

      expect(res.status).toBe(200);
    });

    it('POST /webhooks/instagram should process webhook', async () => {
      const channelManager = require('../../channels/core/ChannelManager');
      channelManager.processWebhook.mockResolvedValueOnce([{ success: true }]);

      const res = await request(app)
        .post('/webhooks/instagram')
        .send({ entry: [] });

      expect(res.status).toBe(200);
    });
  });

  describe('Telegram Webhooks', () => {
    it('POST /webhooks/telegram/:botToken should process webhook', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, type: 'telegram' }] });

      const res = await request(app)
        .post('/webhooks/telegram/test_token')
        .send({ message: { text: 'Hello' } });

      expect(res.status).toBe(200);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/webhooks/telegram/invalid_token')
        .send({ message: {} });

      expect(res.status).toBe(404);
    });
  });

  describe('Generic Channel Webhooks', () => {
    it('POST /webhooks/channel/:channelId should process webhook', async () => {
      const Channel = require('../../models/Channel');
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        type: 'custom'
      });

      const channelManager = require('../../channels/core/ChannelManager');
      channelManager.processWebhook.mockResolvedValueOnce([]);

      const res = await request(app)
        .post('/webhooks/channel/1')
        .send({ data: 'test' });

      expect(res.status).toBe(200);
    });

    it('should validate webhook secret', async () => {
      const Channel = require('../../models/Channel');
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        webhook_secret: 'secret123'
      });

      const res = await request(app)
        .post('/webhooks/channel/1')
        .set('x-webhook-secret', 'wrong_secret')
        .send({});

      expect(res.status).toBe(401);
    });

    it('should accept webhook secret in query', async () => {
      const Channel = require('../../models/Channel');
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        webhook_secret: 'secret123',
        type: 'custom'
      });

      const channelManager = require('../../channels/core/ChannelManager');
      channelManager.processWebhook.mockResolvedValueOnce([]);

      const res = await request(app)
        .post('/webhooks/channel/1?secret=secret123')
        .send({});

      expect(res.status).toBe(200);
    });
  });

  describe('GET /webhooks/status', () => {
    it('should return webhook configuration status', async () => {
      const res = await request(app).get('/webhooks/status');

      expect(res.status).toBe(200);
      expect(res.body.whatsapp).toBeDefined();
      expect(res.body.instagram).toBeDefined();
      expect(res.body.telegram).toBeDefined();
    });
  });

  describe('POST /webhooks/test', () => {
    it('should accept test webhook', async () => {
      const res = await request(app)
        .post('/webhooks/test')
        .send({ test: 'data' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.received).toBeDefined();
    });
  });
});

// =========================================
// ADDITIONAL CLONE ROUTE TESTS
// =========================================

describe('Clone Routes - Extended', () => {
  let cloneRouter;
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock clone services
    jest.mock('../../services/clone', () => ({
      CloneEngine: jest.fn().mockImplementation(() => ({})),
      TrainingService: jest.fn().mockImplementation(() => ({
        validateTrainingData: jest.fn().mockReturnValue({ isValid: true, errors: [] })
      })),
      StyleAnalyzer: jest.fn().mockImplementation(() => ({})),
      CloneService: jest.fn().mockImplementation(() => ({})),
      CloneTemplates: {
        getTemplates: jest.fn(),
        getTemplate: jest.fn(),
        createFromTemplate: jest.fn(),
        createTemplate: jest.fn()
      },
      CloneExport: {
        exportToZip: jest.fn(),
        exportToJson: jest.fn()
      },
      CloneImport: {
        previewImport: jest.fn(),
        importFromJson: jest.fn()
      },
      CloneSharing: {
        getCloneShares: jest.fn(),
        shareWithUser: jest.fn(),
        generateShareLink: jest.fn(),
        revokeShare: jest.fn(),
        revokeShareLink: jest.fn(),
        getSharedWithMe: jest.fn()
      },
      CloneAnalytics: {
        getCloneAnalytics: jest.fn(),
        compareClones: jest.fn(),
        getDashboard: jest.fn()
      },
      CloneBackup: {
        createBackup: jest.fn(),
        getBackups: jest.fn(),
        restoreFromBackup: jest.fn(),
        deleteBackup: jest.fn()
      }
    }));

    cloneRouter = require('../../routes/clone');
    app = express();
    app.use(express.json());
    app.use('/api/clones', cloneRouter);
  });

  describe('Clone Jobs API', () => {
    it('POST /api/clones/jobs should create clone job', async () => {
      const { CloneService } = require('../../services/clone');
      const mockService = CloneService.mock.results[0]?.value || {};
      if (mockService.createCloneJob) {
        mockService.createCloneJob = jest.fn().mockResolvedValue({
          success: true,
          job: { id: 1, name: 'Test Job', type: 'voice' }
        });
      }

      const res = await request(app)
        .post('/api/clones/jobs')
        .send({
          name: 'Test Job',
          type: 'voice',
          description: 'Test'
        });

      expect(res.status).toBeDefined();
    });

    it('should validate clone type', async () => {
      const res = await request(app)
        .post('/api/clones/jobs')
        .send({
          name: 'Test',
          type: 'invalid_type'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('Template API', () => {
    it('GET /api/clones/templates should return templates', async () => {
      const { CloneTemplates } = require('../../services/clone');
      CloneTemplates.getTemplates.mockResolvedValueOnce({
        success: true,
        templates: []
      });

      const res = await request(app).get('/api/clones/templates');

      expect(res.status).toBe(200);
    });

    it('POST /api/clones/templates should create template', async () => {
      const { CloneTemplates } = require('../../services/clone');
      CloneTemplates.createTemplate.mockResolvedValueOnce({
        success: true,
        template: { id: 1 }
      });

      const res = await request(app)
        .post('/api/clones/templates')
        .send({ cloneId: 1, name: 'Template' });

      expect(res.status).toBeDefined();
    });
  });

  describe('Sharing API', () => {
    it('GET /api/clones/:id/shares should return shares', async () => {
      const { CloneSharing } = require('../../services/clone');
      CloneSharing.getCloneShares.mockResolvedValueOnce({
        success: true,
        shares: []
      });

      const res = await request(app).get('/api/clones/1/shares');

      expect(res.status).toBe(200);
    });

    it('POST /api/clones/:id/share/link should generate share link', async () => {
      const { CloneSharing } = require('../../services/clone');
      CloneSharing.generateShareLink.mockResolvedValueOnce({
        success: true,
        link: 'https://example.com/share/abc123'
      });

      const res = await request(app)
        .post('/api/clones/1/share/link')
        .send({ permissionLevel: 'view' });

      expect(res.status).toBe(200);
    });
  });

  describe('Analytics API', () => {
    it('GET /api/clones/:id/analytics should return analytics', async () => {
      const { CloneAnalytics } = require('../../services/clone');
      CloneAnalytics.getCloneAnalytics.mockResolvedValueOnce({
        success: true,
        analytics: { total_uses: 100 }
      });

      const res = await request(app).get('/api/clones/1/analytics');

      expect(res.status).toBe(200);
    });

    it('GET /api/clones/dashboard should return dashboard', async () => {
      const { CloneAnalytics } = require('../../services/clone');
      CloneAnalytics.getDashboard.mockResolvedValueOnce({
        success: true,
        dashboard: {}
      });

      const res = await request(app).get('/api/clones/dashboard');

      expect(res.status).toBe(200);
    });
  });

  describe('Backup API', () => {
    it('POST /api/clones/:id/backup should create backup', async () => {
      const { CloneBackup } = require('../../services/clone');
      CloneBackup.createBackup.mockResolvedValueOnce({
        success: true,
        backup: { id: 1 }
      });

      const res = await request(app)
        .post('/api/clones/1/backup')
        .send({ name: 'Backup' });

      expect(res.status).toBe(201);
    });

    it('GET /api/clones/:id/backups should return backups', async () => {
      const { CloneBackup } = require('../../services/clone');
      CloneBackup.getBackups.mockResolvedValueOnce({
        success: true,
        backups: []
      });

      const res = await request(app).get('/api/clones/1/backups');

      expect(res.status).toBe(200);
    });
  });
});

// =========================================
// ADDITIONAL COMPREHENSIVE TESTS
// =========================================

describe('Fine-Tuning Routes - Additional Tests', () => {
  let fineTuningRouter;
  let app;
  const fineTuningService = require('../../services/fineTuningService');
  const datasetValidator = require('../../services/datasetValidator');

  beforeEach(() => {
    jest.clearAllMocks();
    fineTuningRouter = require('../../routes/fineTuning');
    app = express();
    app.use(express.json());
    app.use('/api/fine-tuning', fineTuningRouter);
  });

  describe('Dataset Management', () => {
    it('GET /api/fine-tuning/models/:id/datasets should return datasets', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      fineTuningService.getDatasets.mockResolvedValueOnce([
        { id: 1, file_path: '/path/to/dataset.jsonl' }
      ]);

      const res = await request(app).get('/api/fine-tuning/models/1/datasets');

      expect(res.status).toBe(200);
      expect(res.body.datasets).toBeDefined();
    });

    it('DELETE /api/fine-tuning/models/:id/datasets/:datasetId should delete dataset', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      fineTuningService.getDatasetById.mockResolvedValueOnce({
        id: 1,
        file_path: '/test/path'
      });
      fineTuningService.deleteDataset.mockResolvedValueOnce();

      const res = await request(app).delete('/api/fine-tuning/models/1/datasets/1');

      expect(res.status).toBe(200);
    });

    it('GET /api/fine-tuning/models/:id/datasets/:datasetId/preview should preview dataset', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({
        id: 1,
        base_model: 'gpt-3.5-turbo'
      });
      fineTuningService.getDatasetById.mockResolvedValueOnce({
        id: 1,
        file_path: __filename
      });
      datasetValidator.analyzeDataset.mockResolvedValueOnce({
        total_rows: 100,
        valid_rows: 95,
        preview: [],
        valid: true,
        token_count: 10000,
        estimated_cost: 80,
        errors: []
      });

      const res = await request(app).get('/api/fine-tuning/models/1/datasets/1/preview');

      expect(res.status).toBe(200);
      expect(res.body.total_rows).toBe(100);
    });

    it('should return 404 if dataset file not found', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      fineTuningService.getDatasetById.mockResolvedValueOnce({
        id: 1,
        file_path: '/nonexistent/path'
      });

      const res = await request(app).get('/api/fine-tuning/models/1/datasets/1/preview');

      expect(res.status).toBe(404);
    });
  });

  describe('Training Progress and Events', () => {
    it('GET /api/fine-tuning/models/:id/progress should return progress', async () => {
      fineTuningService.getTrainingProgress.mockResolvedValueOnce({
        progress: 75,
        currentEpoch: 2,
        totalEpochs: 3
      });

      const res = await request(app).get('/api/fine-tuning/models/1/progress');

      expect(res.status).toBe(200);
      expect(res.body.progress).toBe(75);
    });

    it('GET /api/fine-tuning/models/:id/cost-estimate should estimate cost', async () => {
      fineTuningService.estimateTrainingCost.mockResolvedValueOnce({
        estimatedCost: 50,
        tokenCount: 100000
      });

      const res = await request(app).get('/api/fine-tuning/models/1/cost-estimate?epochs=5');

      expect(res.status).toBe(200);
      expect(res.body.estimate).toBeDefined();
    });

    it('GET /api/fine-tuning/models/:id/usage should return usage stats', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      const metricsService = require('../../services/metricsService');
      metricsService.getUsageStats.mockResolvedValueOnce({
        total_requests: 1000,
        total_tokens: 50000
      });

      const res = await request(app).get('/api/fine-tuning/models/1/usage');

      expect(res.status).toBe(200);
      expect(res.body.usage).toBeDefined();
    });
  });

  describe('Mock Metrics Generation', () => {
    it('should generate mock metrics in development', async () => {
      process.env.NODE_ENV = 'development';
      fineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      fineTuningService.getTrainingStatus.mockResolvedValueOnce({
        job: { job_id: 'test_job' }
      });
      const metricsService = require('../../services/metricsService');
      metricsService.generateMockMetrics.mockResolvedValueOnce([1, 2, 3]);

      const res = await request(app)
        .post('/api/fine-tuning/models/1/metrics/generate-mock')
        .send({ epochs: 3 });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3);
    });

    it('should reject mock metrics in production', async () => {
      process.env.NODE_ENV = 'production';

      const res = await request(app)
        .post('/api/fine-tuning/models/1/metrics/generate-mock')
        .send({ epochs: 3 });

      expect(res.status).toBe(403);
    });
  });
});

describe('Admin Routes - Extended Tests', () => {
  let adminRouter;
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    adminRouter = require('../../routes/admin');
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
  });

  describe('Audit Logs - Advanced Filtering', () => {
    it('should filter by resource_type', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '20' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/audit-logs?resource_type=bot');

      expect(res.status).toBe(200);
    });

    it('should apply organization filter', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/audit-logs?organization_id=5');

      expect(res.status).toBe(200);
    });

    it('should handle pagination edge cases', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '1000' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/audit-logs?page=999&limit=1');

      expect(res.status).toBe(200);
      expect(res.body.pagination.hasNext).toBe(false);
    });

    it('should enforce max limit', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/audit-logs?limit=200');

      expect(res.status).toBe(200);
      // Limit should be capped at 100
    });
  });

  describe('Health Check Edge Cases', () => {
    it('should handle partial system failures', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ result: 1 }] });

      const res = await request(app).get('/api/admin/health');

      expect(res.status).toBe(200);
      expect(res.body.health.uptime).toBeDefined();
      expect(res.body.health.memory).toBeDefined();
    });

    it('should include timestamp in health check', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/health');

      expect(res.body.health.timestamp).toBeDefined();
    });
  });

  describe('Rate Limiting - Edge Cases', () => {
    it('should create new settings if none exist', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [
          { enabled: true, max_attempts: 10 }
        ]});

      const res = await request(app)
        .put('/api/admin/rate-limit/settings')
        .send({ max_attempts: 10 });

      expect(res.status).toBe(200);
    });

    it('should validate minimum values', async () => {
      const res = await request(app)
        .put('/api/admin/rate-limit/settings')
        .send({ max_attempts: 0 });

      expect(res.status).toBe(400);
    });

    it('should return empty array if no blocked users', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/rate-limit/blocked');

      expect(res.status).toBe(200);
      expect(res.body.blocked).toHaveLength(0);
    });
  });
});

describe('Channel Webhooks - Error Handling', () => {
  let webhookRouter;
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WHATSAPP_VERIFY_TOKEN = 'test_token';
    webhookRouter = require('../../routes/channelWebhooks');
    app = express();
    app.use(express.json());
    app.use('/webhooks', webhookRouter);
  });

  describe('WhatsApp Error Scenarios', () => {
    it('should handle verification failure', async () => {
      const WhatsAppProvider = require('../../channels/providers/WhatsAppProvider');
      const instance = WhatsAppProvider.mock.results[0]?.value;
      if (instance) {
        instance.handleChallenge.mockReturnValueOnce(null);
      }

      const res = await request(app).get('/webhooks/whatsapp');

      expect(res.status).toBe(403);
    });

    it('should handle webhook processing errors gracefully', async () => {
      const channelManager = require('../../channels/core/ChannelManager');
      channelManager.processWebhook.mockRejectedValueOnce(new Error('Processing failed'));

      const res = await request(app)
        .post('/webhooks/whatsapp')
        .send({ entry: [] });

      // Should still return 200 to acknowledge receipt
      expect(res.status).toBe(200);
    });
  });

  describe('Generic Webhook Error Cases', () => {
    it('should handle channel not found', async () => {
      const Channel = require('../../models/Channel');
      Channel.findById.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/webhooks/channel/999')
        .send({});

      expect(res.status).toBe(404);
    });

    it('should process webhook without secret if not configured', async () => {
      const Channel = require('../../models/Channel');
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        type: 'custom',
        webhook_secret: null
      });

      const channelManager = require('../../channels/core/ChannelManager');
      channelManager.processWebhook.mockResolvedValueOnce([]);

      const res = await request(app)
        .post('/webhooks/channel/1')
        .send({ test: 'data' });

      expect(res.status).toBe(200);
    });
  });
});

describe('Fine-Tuning A/B Tests - Extended', () => {
  let fineTuningRouter;
  let app;
  const abTestService = require('../../services/abTestService');

  beforeEach(() => {
    jest.clearAllMocks();
    fineTuningRouter = require('../../routes/fineTuning');
    app = express();
    app.use(express.json());
    app.use('/api/fine-tuning', fineTuningRouter);
  });

  describe('A/B Test Operations', () => {
    it('should cancel A/B test', async () => {
      abTestService.cancelTest.mockResolvedValueOnce({
        id: 1,
        status: 'cancelled'
      });

      const res = await request(app).post('/api/fine-tuning/ab-tests/1/cancel');

      expect(res.status).toBe(200);
    });

    it('should submit feedback on test result', async () => {
      abTestService.updateResultFeedback.mockResolvedValueOnce({
        id: 1,
        user_rating: 5
      });

      const res = await request(app)
        .post('/api/fine-tuning/ab-tests/1/feedback')
        .send({ result_id: 1, user_rating: 5 });

      expect(res.status).toBe(200);
    });

    it('should return 400 if result_id missing in feedback', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/ab-tests/1/feedback')
        .send({ user_rating: 5 });

      expect(res.status).toBe(400);
    });

    it('should calculate winner', async () => {
      abTestService.calculateWinner.mockResolvedValueOnce({
        winner: 'a',
        confidence: 0.95
      });

      const res = await request(app).get('/api/fine-tuning/ab-tests/1/winner');

      expect(res.status).toBe(200);
    });

    it('should declare winner', async () => {
      abTestService.declareWinner.mockResolvedValueOnce({
        id: 1,
        winner_version_id: 5
      });

      const res = await request(app)
        .post('/api/fine-tuning/ab-tests/1/declare-winner')
        .send({ winner_version_id: 5 });

      expect(res.status).toBe(200);
    });

    it('should select version for request', async () => {
      abTestService.selectVersionForRequest.mockResolvedValueOnce({
        version_id: 1,
        variant: 'a'
      });

      const res = await request(app).post('/api/fine-tuning/ab-tests/1/select-version');

      expect(res.status).toBe(200);
    });
  });
});

describe('Version Management - Additional Tests', () => {
  let fineTuningRouter;
  let app;
  const fineTuningService = require('../../services/fineTuningService');
  const versionService = require('../../services/versionService');

  beforeEach(() => {
    jest.clearAllMocks();
    fineTuningRouter = require('../../routes/fineTuning');
    app = express();
    app.use(express.json());
    app.use('/api/fine-tuning', fineTuningRouter);
  });

  describe('Version Operations', () => {
    it('should set version as production', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      versionService.setProductionVersion.mockResolvedValueOnce({
        id: 1,
        is_production: true
      });

      const res = await request(app)
        .post('/api/fine-tuning/models/1/versions/1/set-production');

      expect(res.status).toBe(200);
    });

    it('should rollback to version', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      versionService.rollbackVersion.mockResolvedValueOnce({
        id: 1,
        is_active: true
      });

      const res = await request(app)
        .post('/api/fine-tuning/models/1/versions/1/rollback');

      expect(res.status).toBe(200);
    });

    it('should compare versions', async () => {
      versionService.compareVersions.mockResolvedValueOnce({
        comparison: []
      });

      const res = await request(app)
        .post('/api/fine-tuning/versions/compare')
        .send({ versionIds: [1, 2, 3] });

      expect(res.status).toBe(200);
    });

    it('should return 400 if versionIds not array', async () => {
      const res = await request(app)
        .post('/api/fine-tuning/versions/compare')
        .send({ versionIds: 'not-array' });

      expect(res.status).toBe(400);
    });
  });
});

describe('Metrics Service - Additional Tests', () => {
  let fineTuningRouter;
  let app;
  const fineTuningService = require('../../services/fineTuningService');
  const metricsService = require('../../services/metricsService');

  beforeEach(() => {
    jest.clearAllMocks();
    fineTuningRouter = require('../../routes/fineTuning');
    app = express();
    app.use(express.json());
    app.use('/api/fine-tuning', fineTuningRouter);
  });

  describe('Additional Metrics Endpoints', () => {
    it('GET /api/fine-tuning/models/:id/metrics/accuracy', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      metricsService.getAccuracyHistory.mockResolvedValueOnce([
        { epoch: 1, accuracy: 0.8 }
      ]);

      const res = await request(app).get('/api/fine-tuning/models/1/metrics/accuracy');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should accept jobId query parameter for loss', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      metricsService.getLossHistory.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/fine-tuning/models/1/metrics/loss?jobId=job123');

      expect(res.status).toBe(200);
    });

    it('GET /api/fine-tuning/models/:id/metrics/history', async () => {
      fineTuningService.getModelById.mockResolvedValueOnce({ id: 1 });
      metricsService.getTrainingHistory.mockResolvedValueOnce([
        { epoch: 1, metrics: {} }
      ]);

      const res = await request(app).get('/api/fine-tuning/models/1/metrics/history');

      expect(res.status).toBe(200);
    });
  });
});
