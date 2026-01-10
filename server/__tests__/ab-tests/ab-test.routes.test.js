/**
 * A/B Test Routes Unit Tests
 */

const request = require('supertest');
const express = require('express');

// Mock auth middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = { id: 1, workspace_id: 1, organization_id: 1 };
      next();
    } else {
      res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }
  }
}));

// Mock ab-test service
jest.mock('../../services/ab-test.service', () => ({
  getTests: jest.fn(),
  getTestById: jest.fn(),
  createTest: jest.fn(),
  updateTest: jest.fn(),
  deleteTest: jest.fn(),
  duplicateTest: jest.fn(),
  startTest: jest.fn(),
  pauseTest: jest.fn(),
  resumeTest: jest.fn(),
  completeTest: jest.fn(),
  declareWinner: jest.fn(),
  getVariants: jest.fn(),
  addVariant: jest.fn(),
  updateVariant: jest.fn(),
  deleteVariant: jest.fn(),
  getTestAnalytics: jest.fn(),
  getDailyAnalytics: jest.fn(),
  getWorkspaceOverview: jest.fn(),
  assignVisitor: jest.fn(),
  trackConversion: jest.fn(),
  getVisitorVariant: jest.fn()
}));

const abTestService = require('../../services/ab-test.service');
const abTestRoutes = require('../../routes/ab-test.routes');
const abTestPublicRoutes = require('../../routes/ab-test-public.routes');

describe('ABTest Routes', () => {
  let app;
  let authToken = 'Bearer valid-token';

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/ab-tests', abTestRoutes);
    app.use('/api/public/ab-tests', abTestPublicRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== Authentication ====================

  describe('Authentication', () => {
    it('GET /api/ab-tests should require auth', async () => {
      const res = await request(app)
        .get('/api/ab-tests')
        .expect(401);

      expect(res.body.message).toContain('Access denied');
    });

    it('POST /api/ab-tests should require auth', async () => {
      const res = await request(app)
        .post('/api/ab-tests')
        .send({ name: 'Test' })
        .expect(401);

      expect(res.body.message).toContain('Access denied');
    });
  });

  // ==================== CRUD ====================

  describe('CRUD Operations', () => {
    it('GET /api/ab-tests should return tests list', async () => {
      abTestService.getTests.mockResolvedValue({
        tests: [
          { id: 'test-1', name: 'Test 1' },
          { id: 'test-2', name: 'Test 2' }
        ],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 }
      });

      const res = await request(app)
        .get('/api/ab-tests')
        .set('Authorization', authToken)
        .expect(200);

      expect(res.body.tests).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
    });

    it('GET /api/ab-tests should filter by status', async () => {
      abTestService.getTests.mockResolvedValue({
        tests: [{ id: 'test-1', name: 'Running Test', status: 'running' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
      });

      const res = await request(app)
        .get('/api/ab-tests?status=running')
        .set('Authorization', authToken)
        .expect(200);

      expect(abTestService.getTests).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'running' })
      );
    });

    it('POST /api/ab-tests should create test', async () => {
      const newTest = {
        id: 'test-123',
        name: 'New Test',
        test_type: 'message',
        status: 'draft'
      };

      abTestService.createTest.mockResolvedValue(newTest);

      const res = await request(app)
        .post('/api/ab-tests')
        .set('Authorization', authToken)
        .send({
          name: 'New Test',
          test_type: 'message'
        })
        .expect(201);

      expect(res.body.name).toBe('New Test');
      expect(res.body.status).toBe('draft');
    });

    it('GET /api/ab-tests/:id should return test with variants', async () => {
      const mockTest = {
        id: 'test-123',
        name: 'Test',
        variants: [
          { id: 'var-a', name: 'A' },
          { id: 'var-b', name: 'B' }
        ]
      };

      abTestService.getTestById.mockResolvedValue(mockTest);

      const res = await request(app)
        .get('/api/ab-tests/test-123')
        .set('Authorization', authToken)
        .expect(200);

      expect(res.body.variants).toHaveLength(2);
    });

    it('GET /api/ab-tests/:id should return 404 for invalid id', async () => {
      abTestService.getTestById.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/ab-tests/invalid-id')
        .set('Authorization', authToken)
        .expect(404);

      expect(res.body.error).toBe('Test not found');
    });

    it('PUT /api/ab-tests/:id should update test', async () => {
      const updatedTest = {
        id: 'test-123',
        name: 'Updated Test',
        description: 'New description'
      };

      abTestService.updateTest.mockResolvedValue(updatedTest);

      const res = await request(app)
        .put('/api/ab-tests/test-123')
        .set('Authorization', authToken)
        .send({
          name: 'Updated Test',
          description: 'New description'
        })
        .expect(200);

      expect(res.body.name).toBe('Updated Test');
    });

    it('DELETE /api/ab-tests/:id should delete test', async () => {
      abTestService.deleteTest.mockResolvedValue(true);

      const res = await request(app)
        .delete('/api/ab-tests/test-123')
        .set('Authorization', authToken)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  // ==================== Status Operations ====================

  describe('Status Operations', () => {
    it('POST /api/ab-tests/:id/start should start test', async () => {
      abTestService.startTest.mockResolvedValue({
        id: 'test-123',
        status: 'running',
        started_at: new Date()
      });

      const res = await request(app)
        .post('/api/ab-tests/test-123/start')
        .set('Authorization', authToken)
        .expect(200);

      expect(res.body.status).toBe('running');
    });

    it('POST /api/ab-tests/:id/pause should pause test', async () => {
      abTestService.pauseTest.mockResolvedValue({
        id: 'test-123',
        status: 'paused'
      });

      const res = await request(app)
        .post('/api/ab-tests/test-123/pause')
        .set('Authorization', authToken)
        .expect(200);

      expect(res.body.status).toBe('paused');
    });

    it('POST /api/ab-tests/:id/complete should complete test', async () => {
      abTestService.completeTest.mockResolvedValue({
        id: 'test-123',
        status: 'completed',
        ended_at: new Date()
      });

      const res = await request(app)
        .post('/api/ab-tests/test-123/complete')
        .set('Authorization', authToken)
        .expect(200);

      expect(res.body.status).toBe('completed');
    });

    it('POST /api/ab-tests/:id/declare-winner should set winner', async () => {
      abTestService.declareWinner.mockResolvedValue({
        id: 'test-123',
        status: 'completed',
        winner_variant: 'B',
        winner_confidence: 97.5
      });

      const res = await request(app)
        .post('/api/ab-tests/test-123/declare-winner')
        .set('Authorization', authToken)
        .send({ variantId: 'var-b' })
        .expect(200);

      expect(res.body.winner_variant).toBe('B');
    });
  });

  // ==================== Variants Operations ====================

  describe('Variants Operations', () => {
    it('POST /api/ab-tests/:id/variants should add variant', async () => {
      abTestService.addVariant.mockResolvedValue({
        id: 'var-c',
        name: 'C',
        is_control: false
      });

      const res = await request(app)
        .post('/api/ab-tests/test-123/variants')
        .set('Authorization', authToken)
        .send({ name: 'C', content: { message: 'Test C' } })
        .expect(201);

      expect(res.body.name).toBe('C');
    });

    it('PUT /api/ab-tests/:id/variants/:vid should update variant', async () => {
      abTestService.updateVariant.mockResolvedValue({
        id: 'var-b',
        name: 'B',
        content: { message: 'Updated message' }
      });

      const res = await request(app)
        .put('/api/ab-tests/test-123/variants/var-b')
        .set('Authorization', authToken)
        .send({ content: { message: 'Updated message' } })
        .expect(200);

      expect(res.body.id).toBe('var-b');
    });

    it('DELETE /api/ab-tests/:id/variants/:vid should delete variant', async () => {
      abTestService.deleteVariant.mockResolvedValue(true);

      const res = await request(app)
        .delete('/api/ab-tests/test-123/variants/var-c')
        .set('Authorization', authToken)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  // ==================== Public Endpoints ====================

  describe('Public Endpoints', () => {
    it('POST /api/public/ab-tests/assign should assign variant', async () => {
      abTestService.assignVisitor.mockResolvedValue({
        testId: 'test-123',
        variant: { id: 'var-a', name: 'A' }
      });

      const res = await request(app)
        .post('/api/public/ab-tests/assign')
        .send({
          testId: 'test-123',
          visitorId: 'visitor-abc'
        })
        .expect(200);

      expect(res.body.variant).toBeDefined();
    });

    it('POST /api/public/ab-tests/convert should record conversion', async () => {
      abTestService.trackConversion.mockResolvedValue({
        success: true,
        conversionId: 'conv-123'
      });

      const res = await request(app)
        .post('/api/public/ab-tests/convert')
        .send({
          testId: 'test-123',
          visitorId: 'visitor-abc',
          conversionType: 'click'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('GET /api/public/ab-tests/variant should return assigned variant', async () => {
      abTestService.getVisitorVariant.mockResolvedValue({
        variantId: 'var-a',
        name: 'A',
        content: { message: 'Hello A' }
      });

      const res = await request(app)
        .get('/api/public/ab-tests/test-123/variant/visitor-abc')
        .expect(200);

      expect(res.body.name).toBe('A');
    });
  });

  // ==================== Error Handling ====================

  describe('Error Handling', () => {
    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/public/ab-tests/assign')
        .send({ testId: 'test-123' }) // Missing visitorId
        .expect(400);

      expect(res.body.error).toContain('visitorId');
    });

    it('should return 500 for service errors', async () => {
      abTestService.getTests.mockRejectedValue(new Error('Database error'));

      const res = await request(app)
        .get('/api/ab-tests')
        .set('Authorization', authToken)
        .expect(500);

      expect(res.body.error).toBeDefined();
    });
  });
});
