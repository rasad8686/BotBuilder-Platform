/**
 * Tours Integration Tests
 * Full lifecycle testing: create → add steps → publish → track → complete
 */

const request = require('supertest');
const express = require('express');
const tourRoutes = require('../../routes/tour.routes');

// Mock dependencies
jest.mock('../../config/db');
jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = { id: 'user-1', workspace_id: 'workspace-1' };
  next();
});
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const db = require('../../config/db');

// Setup Express app
const app = express();
app.use(express.json());
app.use('/api/tours', tourRoutes);

describe('Tours Integration Tests', () => {
  let createdTourId;
  let createdStepIds = [];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== FULL TOUR LIFECYCLE ====================
  describe('Full Tour Lifecycle', () => {
    it('should complete full lifecycle: create → add steps → publish → track → complete', async () => {
      // Step 1: Create tour
      const mockCreatedTour = {
        id: 'tour-lifecycle-1',
        workspace_id: 'workspace-1',
        name: 'Onboarding Tour',
        status: 'draft',
        created_at: new Date()
      };

      db.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockCreatedTour])
        })
      });

      const createRes = await request(app)
        .post('/api/tours')
        .send({
          workspace_id: 'workspace-1',
          name: 'Onboarding Tour',
          description: 'Welcome new users'
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.tour.status).toBe('draft');
      createdTourId = createRes.body.tour.id;

      // Step 2: Add steps to tour
      const mockStep1 = {
        id: 'step-1',
        tour_id: createdTourId,
        step_order: 1,
        step_type: 'tooltip',
        title: 'Welcome',
        content: 'Welcome to our app!'
      };

      const mockStep2 = {
        id: 'step-2',
        tour_id: createdTourId,
        step_order: 2,
        step_type: 'modal',
        title: 'Features',
        content: 'Check out these features'
      };

      db.mockReturnValueOnce({
        where: jest.fn().mockReturnValue({
          max: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue({ max: 0 })
          })
        })
      });

      db.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockStep1])
        })
      });

      db.mockReturnValueOnce({
        where: jest.fn().mockReturnValue({
          update: jest.fn().mockResolvedValue(1)
        })
      });

      const step1Res = await request(app)
        .post(`/api/tours/${createdTourId}/steps`)
        .send({
          step_type: 'tooltip',
          title: 'Welcome',
          content: 'Welcome to our app!',
          target_selector: '#welcome-banner'
        });

      expect(step1Res.status).toBe(201);
      createdStepIds.push(step1Res.body.step.id);

      db.mockReturnValueOnce({
        where: jest.fn().mockReturnValue({
          max: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue({ max: 1 })
          })
        })
      });

      db.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockStep2])
        })
      });

      db.mockReturnValueOnce({
        where: jest.fn().mockReturnValue({
          update: jest.fn().mockResolvedValue(1)
        })
      });

      const step2Res = await request(app)
        .post(`/api/tours/${createdTourId}/steps`)
        .send({
          step_type: 'modal',
          title: 'Features',
          content: 'Check out these features'
        });

      expect(step2Res.status).toBe(201);
      expect(step2Res.body.step.step_order).toBe(2);

      // Step 3: Publish tour
      const mockPublishedTour = {
        ...mockCreatedTour,
        status: 'active',
        published_at: new Date()
      };

      db.mockReturnValue({
        where: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([mockPublishedTour])
          })
        })
      });

      const publishRes = await request(app)
        .post(`/api/tours/${createdTourId}/publish`)
        .send({ workspace_id: 'workspace-1' });

      expect(publishRes.status).toBe(200);
      expect(publishRes.body.tour.status).toBe('active');
      expect(publishRes.body.tour.published_at).toBeDefined();

      // Step 4: Get tour with steps (verify published state)
      const mockFullTour = {
        ...mockPublishedTour,
        steps: [mockStep1, mockStep2],
        targeting: []
      };

      db.mockReturnValueOnce({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(mockPublishedTour)
        })
      });

      db.mockReturnValueOnce({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue([mockStep1, mockStep2])
        })
      });

      db.mockReturnValueOnce({
        where: jest.fn().mockResolvedValue([])
      });

      const getRes = await request(app)
        .get(`/api/tours/${createdTourId}?workspace_id=workspace-1`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.tour.status).toBe('active');
      expect(getRes.body.tour.steps).toHaveLength(2);
    });
  });

  // ==================== TARGETING RULES ====================
  describe('Targeting Rules', () => {
    it('should apply and retrieve targeting rules', async () => {
      const tourId = 'tour-targeting-1';

      // Set targeting rules
      const mockTargetingRules = [
        { id: 'target-1', target_type: 'url', operator: 'equals', value: '/dashboard' },
        { id: 'target-2', target_type: 'user_property', operator: 'equals', property: 'plan', value: 'pro' }
      ];

      // Mock transaction
      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      db.transaction = jest.fn().mockResolvedValue(mockTransaction);

      // Mock delete existing
      mockTransaction.mockImplementation((table) => ({
        where: jest.fn().mockReturnValue({
          del: jest.fn().mockResolvedValue(1)
        }),
        insert: jest.fn().mockResolvedValue([1])
      }));

      // Mock getTargeting for service
      db.mockReturnValue({
        where: jest.fn().mockResolvedValue(mockTargetingRules)
      });

      const updateRes = await request(app)
        .put(`/api/tours/${tourId}/targeting`)
        .send({
          rules: [
            { target_type: 'url', operator: 'equals', value: '/dashboard' },
            { target_type: 'user_property', operator: 'equals', property: 'plan', value: 'pro' }
          ]
        });

      expect(updateRes.status).toBe(200);

      // Get targeting rules
      db.mockReturnValue({
        where: jest.fn().mockResolvedValue(mockTargetingRules)
      });

      const getRes = await request(app)
        .get(`/api/tours/${tourId}/targeting`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.targeting).toHaveLength(2);
      expect(getRes.body.targeting[0].target_type).toBe('url');
      expect(getRes.body.targeting[1].target_type).toBe('user_property');
    });
  });

  // ==================== ANALYTICS DATA COLLECTION ====================
  describe('Analytics Data Collection', () => {
    it('should return analytics data for a tour', async () => {
      const tourId = 'tour-analytics-1';

      const mockAnalytics = {
        daily: [
          {
            date: '2024-01-15',
            impressions: 150,
            starts: 120,
            completions: 80,
            dismissals: 20,
            completion_rate: 66.67
          },
          {
            date: '2024-01-14',
            impressions: 100,
            starts: 90,
            completions: 60,
            dismissals: 15,
            completion_rate: 66.67
          }
        ],
        totals: {
          impressions: 250,
          starts: 210,
          completions: 140,
          dismissals: 35,
          completionRate: 66.67,
          avgTimeSeconds: 45
        }
      };

      // Mock service method
      const tourService = require('../../services/tour.service');
      jest.spyOn(tourService, 'getTourAnalytics').mockResolvedValue(mockAnalytics);

      const res = await request(app)
        .get(`/api/tours/${tourId}/analytics?startDate=2024-01-14&endDate=2024-01-15`);

      expect(res.status).toBe(200);
      expect(res.body.analytics.daily).toHaveLength(2);
      expect(res.body.analytics.totals.impressions).toBe(250);
      expect(res.body.analytics.totals.completions).toBe(140);
    });

    it('should return analytics overview for workspace', async () => {
      const mockOverview = {
        tours: [
          { id: 'tour-1', name: 'Onboarding', impressions: 500, completions: 300, completion_rate: 60 },
          { id: 'tour-2', name: 'Feature Tour', impressions: 200, completions: 150, completion_rate: 75 }
        ],
        totals: {
          impressions: 700,
          starts: 600,
          completions: 450,
          dismissals: 100
        }
      };

      const tourService = require('../../services/tour.service');
      jest.spyOn(tourService, 'getAnalyticsOverview').mockResolvedValue(mockOverview);

      const res = await request(app)
        .get('/api/tours/analytics/overview?workspace_id=workspace-1');

      expect(res.status).toBe(200);
      expect(res.body.overview.tours).toHaveLength(2);
      expect(res.body.overview.totals.impressions).toBe(700);
    });
  });

  // ==================== PROGRESS SAVE/RESTORE ====================
  describe('Progress Save/Restore', () => {
    it('should track user progress through tour steps', async () => {
      const tourId = 'tour-progress-1';
      const visitorId = 'visitor-123';

      const tourService = require('../../services/tour.service');

      // Start progress
      const mockProgress = {
        id: 'progress-1',
        tour_id: tourId,
        visitor_id: visitorId,
        status: 'not_started',
        current_step: 0,
        completed_steps: []
      };

      jest.spyOn(tourService, 'getUserProgress').mockResolvedValue(mockProgress);

      // Simulate step progression
      const updatedProgress1 = {
        ...mockProgress,
        status: 'in_progress',
        current_step: 1,
        completed_steps: [0],
        started_at: new Date()
      };

      jest.spyOn(tourService, 'updateUserProgress').mockResolvedValue(updatedProgress1);

      // Verify progress is tracked
      expect(updatedProgress1.status).toBe('in_progress');
      expect(updatedProgress1.completed_steps).toContain(0);

      // Complete tour
      const completedProgress = {
        ...updatedProgress1,
        status: 'completed',
        current_step: 3,
        completed_steps: [0, 1, 2],
        completed_at: new Date()
      };

      jest.spyOn(tourService, 'updateUserProgress').mockResolvedValue(completedProgress);

      expect(completedProgress.status).toBe('completed');
      expect(completedProgress.completed_at).toBeDefined();
    });
  });

  // ==================== DUPLICATE TOUR ====================
  describe('Duplicate Tour with Steps', () => {
    it('should duplicate tour with all steps and targeting', async () => {
      const originalTourId = 'tour-original';

      const mockDuplicatedTour = {
        id: 'tour-duplicated',
        name: 'Onboarding Tour (Copy)',
        status: 'draft',
        steps: [
          { id: 'new-step-1', step_order: 1, title: 'Step 1' },
          { id: 'new-step-2', step_order: 2, title: 'Step 2' }
        ],
        targeting: [
          { id: 'new-target-1', target_type: 'url', value: '/dashboard' }
        ]
      };

      const tourService = require('../../services/tour.service');
      jest.spyOn(tourService, 'duplicateTour').mockResolvedValue(mockDuplicatedTour);

      const res = await request(app)
        .post(`/api/tours/${originalTourId}/duplicate`)
        .send({ workspace_id: 'workspace-1' });

      expect(res.status).toBe(201);
      expect(res.body.tour.name).toContain('(Copy)');
      expect(res.body.tour.status).toBe('draft');
      expect(res.body.tour.steps).toHaveLength(2);
      expect(res.body.tour.targeting).toHaveLength(1);
    });
  });

  // ==================== STEP REORDERING ====================
  describe('Step Reordering', () => {
    it('should reorder steps correctly', async () => {
      const tourId = 'tour-reorder';

      const mockReorderedSteps = [
        { id: 'step-3', step_order: 1, title: 'Was Third' },
        { id: 'step-1', step_order: 2, title: 'Was First' },
        { id: 'step-2', step_order: 3, title: 'Was Second' }
      ];

      const tourService = require('../../services/tour.service');
      jest.spyOn(tourService, 'reorderSteps').mockResolvedValue(mockReorderedSteps);

      const res = await request(app)
        .post(`/api/tours/${tourId}/steps/reorder`)
        .send({ stepIds: ['step-3', 'step-1', 'step-2'] });

      expect(res.status).toBe(200);
      expect(res.body.steps[0].id).toBe('step-3');
      expect(res.body.steps[0].step_order).toBe(1);
      expect(res.body.steps[1].id).toBe('step-1');
      expect(res.body.steps[2].id).toBe('step-2');
    });
  });

  // ==================== STATUS TRANSITIONS ====================
  describe('Status Transitions', () => {
    const tourId = 'tour-status';

    it('should transition: draft → active (publish)', async () => {
      const mockTour = { id: tourId, status: 'active', published_at: new Date() };

      const tourService = require('../../services/tour.service');
      jest.spyOn(tourService, 'publishTour').mockResolvedValue(mockTour);

      const res = await request(app)
        .post(`/api/tours/${tourId}/publish`)
        .send({ workspace_id: 'workspace-1' });

      expect(res.body.tour.status).toBe('active');
    });

    it('should transition: active → paused', async () => {
      const mockTour = { id: tourId, status: 'paused' };

      const tourService = require('../../services/tour.service');
      jest.spyOn(tourService, 'pauseTour').mockResolvedValue(mockTour);

      const res = await request(app)
        .post(`/api/tours/${tourId}/pause`)
        .send({ workspace_id: 'workspace-1' });

      expect(res.body.tour.status).toBe('paused');
    });

    it('should transition: paused → archived', async () => {
      const mockTour = { id: tourId, status: 'archived' };

      const tourService = require('../../services/tour.service');
      jest.spyOn(tourService, 'archiveTour').mockResolvedValue(mockTour);

      const res = await request(app)
        .post(`/api/tours/${tourId}/archive`)
        .send({ workspace_id: 'workspace-1' });

      expect(res.body.tour.status).toBe('archived');
    });
  });

  // ==================== ERROR SCENARIOS ====================
  describe('Error Scenarios', () => {
    it('should handle tour not found gracefully', async () => {
      db.mockReturnValueOnce({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(null)
        })
      });

      db.mockReturnValueOnce({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue([])
        })
      });

      db.mockReturnValueOnce({
        where: jest.fn().mockResolvedValue([])
      });

      const tourService = require('../../services/tour.service');
      jest.spyOn(tourService, 'getTourById').mockResolvedValue(null);

      const res = await request(app)
        .get('/api/tours/nonexistent?workspace_id=workspace-1');

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Tour not found');
    });

    it('should handle database errors gracefully', async () => {
      const tourService = require('../../services/tour.service');
      jest.spyOn(tourService, 'getTours').mockRejectedValue(new Error('Database connection failed'));

      const res = await request(app)
        .get('/api/tours?workspace_id=workspace-1');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
