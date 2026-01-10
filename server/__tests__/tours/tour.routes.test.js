/**
 * Tour Routes Unit Tests
 */

const request = require('supertest');
const express = require('express');
const tourRoutes = require('../../routes/tour.routes');
const tourService = require('../../services/tour.service');

// Mock dependencies
jest.mock('../../services/tour.service');
jest.mock('../../middleware/auth', () => (req, res, next) => {
  if (req.headers.authorization === 'Bearer valid-token') {
    req.user = { id: 'user-1', workspace_id: 'workspace-1' };
    next();
  } else {
    res.status(401).json({ success: false, message: 'Unauthorized' });
  }
});
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

// Setup Express app
const app = express();
app.use(express.json());
app.use('/api/tours', tourRoutes);

describe('Tour Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const authHeader = { Authorization: 'Bearer valid-token' };

  // ==================== GET /api/tours ====================
  describe('GET /api/tours', () => {
    it('should return 200 with tours array', async () => {
      const mockResult = {
        tours: [
          { id: 'tour-1', name: 'Tour 1' },
          { id: 'tour-2', name: 'Tour 2' }
        ],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 }
      };

      tourService.getTours.mockResolvedValue(mockResult);

      const res = await request(app)
        .get('/api/tours?workspace_id=workspace-1')
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tours).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .get('/api/tours?workspace_id=workspace-1');

      expect(res.status).toBe(401);
    });

    it('should return 400 without workspace_id', async () => {
      const res = await request(app)
        .get('/api/tours')
        .set(authHeader);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Workspace ID is required');
    });
  });

  // ==================== POST /api/tours ====================
  describe('POST /api/tours', () => {
    it('should return 201 with created tour', async () => {
      const mockTour = {
        id: 'tour-1',
        name: 'New Tour',
        status: 'draft'
      };

      tourService.createTour.mockResolvedValue(mockTour);

      const res = await request(app)
        .post('/api/tours')
        .set(authHeader)
        .send({
          workspace_id: 'workspace-1',
          name: 'New Tour'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.tour.name).toBe('New Tour');
    });

    it('should return 400 without name', async () => {
      const res = await request(app)
        .post('/api/tours')
        .set(authHeader)
        .send({
          workspace_id: 'workspace-1'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Tour name is required');
    });
  });

  // ==================== GET /api/tours/:id ====================
  describe('GET /api/tours/:id', () => {
    it('should return 200 with tour and steps', async () => {
      const mockTour = {
        id: 'tour-1',
        name: 'Welcome Tour',
        steps: [
          { id: 'step-1', title: 'Step 1' }
        ],
        targeting: []
      };

      tourService.getTourById.mockResolvedValue(mockTour);

      const res = await request(app)
        .get('/api/tours/tour-1?workspace_id=workspace-1')
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tour.steps).toHaveLength(1);
    });

    it('should return 404 if tour not found', async () => {
      tourService.getTourById.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/tours/nonexistent?workspace_id=workspace-1')
        .set(authHeader);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Tour not found');
    });
  });

  // ==================== PUT /api/tours/:id ====================
  describe('PUT /api/tours/:id', () => {
    it('should return 200 with updated tour', async () => {
      const mockTour = {
        id: 'tour-1',
        name: 'Updated Tour'
      };

      tourService.updateTour.mockResolvedValue(mockTour);

      const res = await request(app)
        .put('/api/tours/tour-1')
        .set(authHeader)
        .send({
          workspace_id: 'workspace-1',
          name: 'Updated Tour'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tour.name).toBe('Updated Tour');
    });

    it('should return 404 if tour not found', async () => {
      tourService.updateTour.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/tours/nonexistent')
        .set(authHeader)
        .send({
          workspace_id: 'workspace-1',
          name: 'Updated Tour'
        });

      expect(res.status).toBe(404);
    });
  });

  // ==================== DELETE /api/tours/:id ====================
  describe('DELETE /api/tours/:id', () => {
    it('should return 200 on successful delete', async () => {
      tourService.deleteTour.mockResolvedValue(true);

      const res = await request(app)
        .delete('/api/tours/tour-1?workspace_id=workspace-1')
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if tour not found', async () => {
      tourService.deleteTour.mockResolvedValue(false);

      const res = await request(app)
        .delete('/api/tours/nonexistent?workspace_id=workspace-1')
        .set(authHeader);

      expect(res.status).toBe(404);
    });
  });

  // ==================== POST /api/tours/:id/publish ====================
  describe('POST /api/tours/:id/publish', () => {
    it('should return 200 with published tour', async () => {
      const mockTour = {
        id: 'tour-1',
        status: 'active',
        published_at: new Date().toISOString()
      };

      tourService.publishTour.mockResolvedValue(mockTour);

      const res = await request(app)
        .post('/api/tours/tour-1/publish')
        .set(authHeader)
        .send({ workspace_id: 'workspace-1' });

      expect(res.status).toBe(200);
      expect(res.body.tour.status).toBe('active');
    });
  });

  // ==================== POST /api/tours/:id/pause ====================
  describe('POST /api/tours/:id/pause', () => {
    it('should return 200 with paused tour', async () => {
      const mockTour = {
        id: 'tour-1',
        status: 'paused'
      };

      tourService.pauseTour.mockResolvedValue(mockTour);

      const res = await request(app)
        .post('/api/tours/tour-1/pause')
        .set(authHeader)
        .send({ workspace_id: 'workspace-1' });

      expect(res.status).toBe(200);
      expect(res.body.tour.status).toBe('paused');
    });
  });

  // ==================== POST /api/tours/:id/archive ====================
  describe('POST /api/tours/:id/archive', () => {
    it('should return 200 with archived tour', async () => {
      const mockTour = {
        id: 'tour-1',
        status: 'archived'
      };

      tourService.archiveTour.mockResolvedValue(mockTour);

      const res = await request(app)
        .post('/api/tours/tour-1/archive')
        .set(authHeader)
        .send({ workspace_id: 'workspace-1' });

      expect(res.status).toBe(200);
      expect(res.body.tour.status).toBe('archived');
    });
  });

  // ==================== POST /api/tours/:id/duplicate ====================
  describe('POST /api/tours/:id/duplicate', () => {
    it('should return 201 with duplicated tour', async () => {
      const mockTour = {
        id: 'tour-2',
        name: 'Welcome Tour (Copy)',
        steps: []
      };

      tourService.duplicateTour.mockResolvedValue(mockTour);

      const res = await request(app)
        .post('/api/tours/tour-1/duplicate')
        .set(authHeader)
        .send({ workspace_id: 'workspace-1' });

      expect(res.status).toBe(201);
      expect(res.body.tour.name).toContain('(Copy)');
    });
  });

  // ==================== STEPS ROUTES ====================
  describe('Steps Routes', () => {
    describe('GET /api/tours/:id/steps', () => {
      it('should return 200 with steps array', async () => {
        const mockSteps = [
          { id: 'step-1', step_order: 1 },
          { id: 'step-2', step_order: 2 }
        ];

        tourService.getSteps.mockResolvedValue(mockSteps);

        const res = await request(app)
          .get('/api/tours/tour-1/steps')
          .set(authHeader);

        expect(res.status).toBe(200);
        expect(res.body.steps).toHaveLength(2);
      });
    });

    describe('POST /api/tours/:id/steps', () => {
      it('should return 201 with created step', async () => {
        const mockStep = {
          id: 'step-1',
          tour_id: 'tour-1',
          title: 'New Step'
        };

        tourService.createStep.mockResolvedValue(mockStep);

        const res = await request(app)
          .post('/api/tours/tour-1/steps')
          .set(authHeader)
          .send({
            title: 'New Step',
            content: 'Step content',
            target_selector: '#element'
          });

        expect(res.status).toBe(201);
        expect(res.body.step.title).toBe('New Step');
      });
    });

    describe('PUT /api/tours/:id/steps/:stepId', () => {
      it('should return 200 with updated step', async () => {
        const mockStep = {
          id: 'step-1',
          title: 'Updated Step'
        };

        tourService.updateStep.mockResolvedValue(mockStep);

        const res = await request(app)
          .put('/api/tours/tour-1/steps/step-1')
          .set(authHeader)
          .send({ title: 'Updated Step' });

        expect(res.status).toBe(200);
        expect(res.body.step.title).toBe('Updated Step');
      });

      it('should return 404 if step not found', async () => {
        tourService.updateStep.mockResolvedValue(null);

        const res = await request(app)
          .put('/api/tours/tour-1/steps/nonexistent')
          .set(authHeader)
          .send({ title: 'Updated Step' });

        expect(res.status).toBe(404);
      });
    });

    describe('DELETE /api/tours/:id/steps/:stepId', () => {
      it('should return 200 on successful delete', async () => {
        tourService.deleteStep.mockResolvedValue(true);

        const res = await request(app)
          .delete('/api/tours/tour-1/steps/step-1')
          .set(authHeader);

        expect(res.status).toBe(200);
      });

      it('should return 404 if step not found', async () => {
        tourService.deleteStep.mockResolvedValue(false);

        const res = await request(app)
          .delete('/api/tours/tour-1/steps/nonexistent')
          .set(authHeader);

        expect(res.status).toBe(404);
      });
    });

    describe('POST /api/tours/:id/steps/reorder', () => {
      it('should return 200 with reordered steps', async () => {
        const mockSteps = [
          { id: 'step-2', step_order: 1 },
          { id: 'step-1', step_order: 2 }
        ];

        tourService.reorderSteps.mockResolvedValue(mockSteps);

        const res = await request(app)
          .post('/api/tours/tour-1/steps/reorder')
          .set(authHeader)
          .send({ stepIds: ['step-2', 'step-1'] });

        expect(res.status).toBe(200);
        expect(res.body.steps[0].id).toBe('step-2');
      });

      it('should return 400 without stepIds', async () => {
        const res = await request(app)
          .post('/api/tours/tour-1/steps/reorder')
          .set(authHeader)
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('stepIds array is required');
      });
    });
  });

  // ==================== TARGETING ROUTES ====================
  describe('Targeting Routes', () => {
    describe('GET /api/tours/:id/targeting', () => {
      it('should return 200 with targeting rules', async () => {
        const mockTargeting = [
          { id: 'target-1', target_type: 'url', value: '/dashboard' }
        ];

        tourService.getTargeting.mockResolvedValue(mockTargeting);

        const res = await request(app)
          .get('/api/tours/tour-1/targeting')
          .set(authHeader);

        expect(res.status).toBe(200);
        expect(res.body.targeting).toHaveLength(1);
      });
    });

    describe('PUT /api/tours/:id/targeting', () => {
      it('should return 200 with updated targeting', async () => {
        const mockTargeting = [
          { id: 'target-1', target_type: 'url', value: '/settings' }
        ];

        tourService.updateTargeting.mockResolvedValue(mockTargeting);

        const res = await request(app)
          .put('/api/tours/tour-1/targeting')
          .set(authHeader)
          .send({
            rules: [
              { target_type: 'url', operator: 'equals', value: '/settings' }
            ]
          });

        expect(res.status).toBe(200);
        expect(res.body.targeting[0].value).toBe('/settings');
      });
    });
  });

  // ==================== ANALYTICS ROUTES ====================
  describe('Analytics Routes', () => {
    describe('GET /api/tours/:id/analytics', () => {
      it('should return 200 with analytics data', async () => {
        const mockAnalytics = {
          daily: [
            { date: '2024-01-01', impressions: 100, completions: 50 }
          ],
          totals: {
            impressions: 100,
            starts: 80,
            completions: 50,
            dismissals: 10
          }
        };

        tourService.getTourAnalytics.mockResolvedValue(mockAnalytics);

        const res = await request(app)
          .get('/api/tours/tour-1/analytics')
          .set(authHeader);

        expect(res.status).toBe(200);
        expect(res.body.analytics.totals.impressions).toBe(100);
      });
    });

    describe('GET /api/tours/analytics/overview', () => {
      it('should return 200 with overview data', async () => {
        const mockOverview = {
          tours: [
            { id: 'tour-1', name: 'Tour 1', impressions: 100 }
          ],
          totals: {
            impressions: 100,
            starts: 80,
            completions: 50,
            dismissals: 10
          }
        };

        tourService.getAnalyticsOverview.mockResolvedValue(mockOverview);

        const res = await request(app)
          .get('/api/tours/analytics/overview?workspace_id=workspace-1')
          .set(authHeader);

        expect(res.status).toBe(200);
        expect(res.body.overview.tours).toHaveLength(1);
      });
    });
  });

  // ==================== AUTHENTICATION TESTS ====================
  describe('Authentication Tests', () => {
    it('should return 401 for all routes without token', async () => {
      const routes = [
        { method: 'get', path: '/api/tours?workspace_id=w1' },
        { method: 'post', path: '/api/tours' },
        { method: 'get', path: '/api/tours/tour-1?workspace_id=w1' },
        { method: 'put', path: '/api/tours/tour-1' },
        { method: 'delete', path: '/api/tours/tour-1?workspace_id=w1' }
      ];

      for (const route of routes) {
        const res = await request(app)[route.method](route.path);
        expect(res.status).toBe(401);
      }
    });
  });
});
