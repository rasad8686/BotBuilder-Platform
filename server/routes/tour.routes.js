/**
 * Product Tours API Routes
 * Handles all endpoints for product tours system
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const tourService = require('../services/tour.service');
const tourAnalyticsService = require('../services/tour-analytics.service');
const tourTargetingService = require('../services/tour-targeting.service');
const log = require('../utils/logger');
const {
  validateTour,
  validateStep,
  validateTargeting,
  validateTourId,
  validateStepId,
  validateReorder,
  validateDateRange
} = require('../middleware/tourValidation');

/**
 * Middleware to get workspace ID from user
 */
const getWorkspaceId = async (req, res, next) => {
  try {
    // Get workspace_id from query, body, or user's default workspace
    let workspaceId = req.query.workspace_id || req.body.workspace_id || req.user?.workspace_id;

    // If no workspace_id, use user's organization_id or user id as fallback
    if (!workspaceId && req.user) {
      workspaceId = req.user.organization_id || req.user.org_id || req.user.id;
    }

    // Use a default workspace id if still not found (for development)
    if (!workspaceId) {
      workspaceId = 1; // Default fallback
    }

    req.workspaceId = workspaceId;
    next();
  } catch (error) {
    log.error('Get workspace ID error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get workspace'
    });
  }
};

// ==================== TOURS CRUD ====================

/**
 * GET /api/tours
 * List all tours with pagination
 */
router.get('/', auth, getWorkspaceId, async (req, res) => {
  try {
    const { page, limit, status, search } = req.query;

    const result = await tourService.getTours(req.workspaceId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status,
      search
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Get tours error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get tours'
    });
  }
});

/**
 * POST /api/tours
 * Create new tour
 */
router.post('/', auth, getWorkspaceId, validateTour, async (req, res) => {
  try {
    const { name, description, settings, theme, trigger_type, trigger_config, priority } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Tour name is required'
      });
    }

    const tour = await tourService.createTour(req.workspaceId, {
      name,
      description,
      settings,
      theme,
      trigger_type,
      trigger_config,
      priority
    });

    log.info('Tour created', { tourId: tour.id, name });

    res.status(201).json({
      success: true,
      tour
    });
  } catch (error) {
    log.error('Create tour error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create tour'
    });
  }
});

/**
 * GET /api/tours/:id
 * Get tour with steps and targeting
 */
router.get('/:id', auth, validateTourId, getWorkspaceId, async (req, res) => {
  try {
    const { id } = req.params;

    const tour = await tourService.getTourById(id, req.workspaceId);

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: 'Tour not found'
      });
    }

    res.json({
      success: true,
      tour
    });
  } catch (error) {
    log.error('Get tour error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get tour'
    });
  }
});

/**
 * PUT /api/tours/:id
 * Update tour
 */
router.put('/:id', auth, validateTourId, getWorkspaceId, validateTour, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, settings, theme, trigger_type, trigger_config, priority } = req.body;

    const tour = await tourService.updateTour(id, req.workspaceId, {
      name,
      description,
      settings,
      theme,
      trigger_type,
      trigger_config,
      priority
    });

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: 'Tour not found'
      });
    }

    log.info('Tour updated', { tourId: id });

    res.json({
      success: true,
      tour
    });
  } catch (error) {
    log.error('Update tour error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update tour'
    });
  }
});

/**
 * DELETE /api/tours/:id
 * Delete tour
 */
router.delete('/:id', auth, validateTourId, getWorkspaceId, async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await tourService.deleteTour(id, req.workspaceId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Tour not found'
      });
    }

    log.info('Tour deleted', { tourId: id });

    res.json({
      success: true,
      message: 'Tour deleted successfully'
    });
  } catch (error) {
    log.error('Delete tour error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete tour'
    });
  }
});

/**
 * POST /api/tours/:id/duplicate
 * Duplicate tour with all steps and targeting
 */
router.post('/:id/duplicate', auth, validateTourId, getWorkspaceId, async (req, res) => {
  try {
    const { id } = req.params;

    const tour = await tourService.duplicateTour(id, req.workspaceId);

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: 'Tour not found'
      });
    }

    log.info('Tour duplicated', { originalId: id, newId: tour.id });

    res.status(201).json({
      success: true,
      tour
    });
  } catch (error) {
    log.error('Duplicate tour error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to duplicate tour'
    });
  }
});

// ==================== STATUS OPERATIONS ====================

/**
 * POST /api/tours/:id/publish
 * Publish tour (set status to active)
 */
router.post('/:id/publish', auth, validateTourId, getWorkspaceId, async (req, res) => {
  try {
    const { id } = req.params;

    const tour = await tourService.publishTour(id, req.workspaceId);

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: 'Tour not found'
      });
    }

    log.info('Tour published', { tourId: id });

    res.json({
      success: true,
      tour
    });
  } catch (error) {
    log.error('Publish tour error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to publish tour'
    });
  }
});

/**
 * POST /api/tours/:id/pause
 * Pause tour
 */
router.post('/:id/pause', auth, validateTourId, getWorkspaceId, async (req, res) => {
  try {
    const { id } = req.params;

    const tour = await tourService.pauseTour(id, req.workspaceId);

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: 'Tour not found'
      });
    }

    log.info('Tour paused', { tourId: id });

    res.json({
      success: true,
      tour
    });
  } catch (error) {
    log.error('Pause tour error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to pause tour'
    });
  }
});

/**
 * POST /api/tours/:id/archive
 * Archive tour
 */
router.post('/:id/archive', auth, validateTourId, getWorkspaceId, async (req, res) => {
  try {
    const { id } = req.params;

    const tour = await tourService.archiveTour(id, req.workspaceId);

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: 'Tour not found'
      });
    }

    log.info('Tour archived', { tourId: id });

    res.json({
      success: true,
      tour
    });
  } catch (error) {
    log.error('Archive tour error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to archive tour'
    });
  }
});

// ==================== STEPS ====================

/**
 * GET /api/tours/:id/steps
 * Get all steps for a tour
 */
router.get('/:id/steps', auth, validateTourId, async (req, res) => {
  try {
    const { id } = req.params;

    const steps = await tourService.getSteps(id);

    res.json({
      success: true,
      steps
    });
  } catch (error) {
    log.error('Get steps error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get steps'
    });
  }
});

/**
 * POST /api/tours/:id/steps
 * Create new step
 */
router.post('/:id/steps', auth, validateTourId, validateStep, async (req, res) => {
  try {
    const { id } = req.params;
    const stepData = req.body;

    const step = await tourService.createStep(id, stepData);

    log.info('Step created', { tourId: id, stepId: step.id });

    res.status(201).json({
      success: true,
      step
    });
  } catch (error) {
    log.error('Create step error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create step'
    });
  }
});

/**
 * PUT /api/tours/:id/steps/:stepId
 * Update step
 */
router.put('/:id/steps/:stepId', auth, validateTourId, validateStepId, validateStep, async (req, res) => {
  try {
    const { id, stepId } = req.params;
    const stepData = req.body;

    const step = await tourService.updateStep(id, stepId, stepData);

    if (!step) {
      return res.status(404).json({
        success: false,
        message: 'Step not found'
      });
    }

    log.info('Step updated', { tourId: id, stepId });

    res.json({
      success: true,
      step
    });
  } catch (error) {
    log.error('Update step error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update step'
    });
  }
});

/**
 * DELETE /api/tours/:id/steps/:stepId
 * Delete step
 */
router.delete('/:id/steps/:stepId', auth, validateTourId, validateStepId, async (req, res) => {
  try {
    const { id, stepId } = req.params;

    const deleted = await tourService.deleteStep(id, stepId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Step not found'
      });
    }

    log.info('Step deleted', { tourId: id, stepId });

    res.json({
      success: true,
      message: 'Step deleted successfully'
    });
  } catch (error) {
    log.error('Delete step error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete step'
    });
  }
});

/**
 * POST /api/tours/:id/steps/reorder
 * Reorder steps
 */
router.post('/:id/steps/reorder', auth, validateTourId, validateReorder, async (req, res) => {
  try {
    const { id } = req.params;
    const { stepIds } = req.body;

    if (!stepIds || !Array.isArray(stepIds)) {
      return res.status(400).json({
        success: false,
        message: 'stepIds array is required'
      });
    }

    const steps = await tourService.reorderSteps(id, stepIds);

    log.info('Steps reordered', { tourId: id });

    res.json({
      success: true,
      steps
    });
  } catch (error) {
    log.error('Reorder steps error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to reorder steps'
    });
  }
});

// ==================== TARGETING ====================

/**
 * GET /api/tours/:id/targeting
 * Get targeting rules for a tour
 */
router.get('/:id/targeting', auth, validateTourId, async (req, res) => {
  try {
    const { id } = req.params;

    const targeting = await tourService.getTargeting(id);

    res.json({
      success: true,
      targeting
    });
  } catch (error) {
    log.error('Get targeting error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get targeting'
    });
  }
});

/**
 * PUT /api/tours/:id/targeting
 * Update targeting rules (replace all)
 */
router.put('/:id/targeting', auth, validateTourId, validateTargeting, async (req, res) => {
  try {
    const { id } = req.params;
    const { rules } = req.body;

    const targeting = await tourService.updateTargeting(id, rules);

    log.info('Targeting updated', { tourId: id });

    res.json({
      success: true,
      targeting
    });
  } catch (error) {
    log.error('Update targeting error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update targeting'
    });
  }
});

/**
 * POST /api/tours/:id/targeting
 * Set targeting rules for a tour
 */
router.post('/:id/targeting', auth, validateTourId, async (req, res) => {
  try {
    const { id } = req.params;
    const rules = req.body;

    const targeting = await tourTargetingService.setTargetingRules(id, rules);

    log.info('Targeting rules set', { tourId: id });

    res.json({
      success: true,
      targeting
    });
  } catch (error) {
    log.error('Set targeting rules error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to set targeting rules'
    });
  }
});

/**
 * POST /api/tours/:id/targeting/test
 * Test targeting rules with sample context
 */
router.post('/:id/targeting/test', auth, validateTourId, async (req, res) => {
  try {
    const { id } = req.params;
    const testContext = req.body;

    // Get tour targeting rules
    const targetingData = await tourTargetingService.getTargetingRules(id);
    if (!targetingData) {
      return res.status(404).json({
        success: false,
        message: 'Tour not found'
      });
    }

    // Test the rules
    const results = await tourTargetingService.testTargetingRules(targetingData.rules, testContext);

    res.json({
      success: true,
      results
    });
  } catch (error) {
    log.error('Test targeting error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to test targeting'
    });
  }
});

/**
 * GET /api/tours/eligible
 * Get eligible tours for user based on targeting
 */
router.get('/eligible', auth, getWorkspaceId, async (req, res) => {
  try {
    const userId = req.user?.id;
    const context = {
      organizationId: req.workspaceId,
      currentUrl: req.query.url || req.headers.referer,
      userAgent: req.headers['user-agent'],
      userProperties: req.query.properties ? JSON.parse(req.query.properties) : {}
    };

    const tours = await tourTargetingService.getEligibleTours(userId, context);

    res.json({
      success: true,
      tours,
      count: tours.length
    });
  } catch (error) {
    log.error('Get eligible tours error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get eligible tours'
    });
  }
});

/**
 * POST /api/tours/:id/evaluate
 * Evaluate if tour should be shown to user
 */
router.post('/:id/evaluate', auth, validateTourId, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const context = {
      currentUrl: req.body.url,
      userAgent: req.body.userAgent || req.headers['user-agent'],
      userProperties: req.body.userProperties || {}
    };

    const result = await tourTargetingService.evaluateTargeting(id, userId, context);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Evaluate targeting error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to evaluate targeting'
    });
  }
});

// ==================== SEGMENTS ====================

/**
 * GET /api/tours/segments
 * Get all segments for organization
 */
router.get('/segments', auth, getWorkspaceId, async (req, res) => {
  try {
    const segments = await tourTargetingService.getSegments(req.workspaceId);

    res.json({
      success: true,
      segments
    });
  } catch (error) {
    log.error('Get segments error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get segments'
    });
  }
});

/**
 * POST /api/tours/segments
 * Create new segment
 */
router.post('/segments', auth, getWorkspaceId, async (req, res) => {
  try {
    const { name, description, rules } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Segment name is required'
      });
    }

    const segment = await tourTargetingService.createSegment(req.workspaceId, {
      name,
      description,
      rules
    });

    log.info('Segment created', { segmentId: segment.id, name });

    res.status(201).json({
      success: true,
      segment
    });
  } catch (error) {
    log.error('Create segment error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create segment'
    });
  }
});

/**
 * GET /api/tours/segments/:segmentId
 * Get segment by ID
 */
router.get('/segments/:segmentId', auth, async (req, res) => {
  try {
    const { segmentId } = req.params;

    const segment = await tourTargetingService.getSegmentById(segmentId);

    if (!segment) {
      return res.status(404).json({
        success: false,
        message: 'Segment not found'
      });
    }

    res.json({
      success: true,
      segment
    });
  } catch (error) {
    log.error('Get segment error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get segment'
    });
  }
});

/**
 * PUT /api/tours/segments/:segmentId
 * Update segment
 */
router.put('/segments/:segmentId', auth, async (req, res) => {
  try {
    const { segmentId } = req.params;
    const { name, description, rules } = req.body;

    const segment = await tourTargetingService.updateSegment(segmentId, {
      name,
      description,
      rules
    });

    if (!segment) {
      return res.status(404).json({
        success: false,
        message: 'Segment not found'
      });
    }

    log.info('Segment updated', { segmentId });

    res.json({
      success: true,
      segment
    });
  } catch (error) {
    log.error('Update segment error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update segment'
    });
  }
});

/**
 * DELETE /api/tours/segments/:segmentId
 * Delete segment
 */
router.delete('/segments/:segmentId', auth, async (req, res) => {
  try {
    const { segmentId } = req.params;

    await tourTargetingService.deleteSegment(segmentId);

    log.info('Segment deleted', { segmentId });

    res.json({
      success: true,
      message: 'Segment deleted successfully'
    });
  } catch (error) {
    log.error('Delete segment error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete segment'
    });
  }
});

/**
 * POST /api/tours/segments/:segmentId/evaluate
 * Evaluate segment for a user
 */
router.post('/segments/:segmentId/evaluate', auth, async (req, res) => {
  try {
    const { segmentId } = req.params;
    const userId = req.body.user_id || req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required'
      });
    }

    const result = await tourTargetingService.evaluateSegmentForUser(segmentId, userId);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Evaluate segment error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to evaluate segment'
    });
  }
});

/**
 * POST /api/tours/segments/:segmentId/refresh
 * Refresh segment user count
 */
router.post('/segments/:segmentId/refresh', auth, async (req, res) => {
  try {
    const { segmentId } = req.params;

    const userCount = await tourTargetingService.updateSegmentUserCount(segmentId);

    res.json({
      success: true,
      user_count: userCount
    });
  } catch (error) {
    log.error('Refresh segment error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to refresh segment'
    });
  }
});

// ==================== ANALYTICS ====================

/**
 * GET /api/tours/:id/analytics
 * Get analytics for a specific tour
 */
router.get('/:id/analytics', auth, validateTourId, validateDateRange, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const analytics = await tourService.getTourAnalytics(id, {
      startDate,
      endDate
    });

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    log.error('Get tour analytics error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics'
    });
  }
});

/**
 * GET /api/tours/analytics/overview
 * Get analytics overview for all tours in workspace
 */
router.get('/analytics/overview', auth, getWorkspaceId, validateDateRange, async (req, res) => {
  try {
    const { startDate, endDate, limit } = req.query;

    const overview = await tourService.getAnalyticsOverview(req.workspaceId, {
      startDate,
      endDate,
      limit: parseInt(limit) || 10
    });

    res.json({
      success: true,
      overview
    });
  } catch (error) {
    log.error('Get analytics overview error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics overview'
    });
  }
});

/**
 * GET /api/tours/analytics/summary
 * Get summary analytics for all tours in workspace
 */
router.get('/analytics/summary', auth, getWorkspaceId, validateDateRange, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;

    const summary = await tourAnalyticsService.getSummary(
      req.workspaceId,
      { startDate, endDate },
      status
    );

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    log.error('Get analytics summary error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics summary'
    });
  }
});

/**
 * GET /api/tours/analytics/daily
 * Get daily statistics
 */
router.get('/analytics/daily', auth, getWorkspaceId, validateDateRange, async (req, res) => {
  try {
    const { startDate, endDate, tourId } = req.query;

    const data = await tourAnalyticsService.getDailyStats(
      req.workspaceId,
      { startDate, endDate },
      tourId
    );

    res.json({
      success: true,
      data
    });
  } catch (error) {
    log.error('Get daily analytics error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get daily analytics'
    });
  }
});

/**
 * GET /api/tours/analytics/funnel
 * Get funnel data for a specific tour
 */
router.get('/analytics/funnel', auth, validateDateRange, async (req, res) => {
  try {
    const { tourId, startDate, endDate } = req.query;

    if (!tourId) {
      return res.status(400).json({
        success: false,
        message: 'tourId is required'
      });
    }

    const funnel = await tourAnalyticsService.getFunnelData(
      tourId,
      { startDate, endDate }
    );

    res.json({
      success: true,
      funnel
    });
  } catch (error) {
    log.error('Get funnel analytics error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get funnel analytics'
    });
  }
});

/**
 * GET /api/tours/analytics/steps
 * Get per-step analytics for a tour
 */
router.get('/analytics/steps', auth, validateDateRange, async (req, res) => {
  try {
    const { tourId, startDate, endDate } = req.query;

    if (!tourId) {
      return res.status(400).json({
        success: false,
        message: 'tourId is required'
      });
    }

    const steps = await tourAnalyticsService.getStepAnalytics(
      tourId,
      { startDate, endDate }
    );

    res.json({
      success: true,
      steps
    });
  } catch (error) {
    log.error('Get step analytics error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get step analytics'
    });
  }
});

/**
 * GET /api/tours/analytics/top
 * Get top performing tours
 */
router.get('/analytics/top', auth, getWorkspaceId, validateDateRange, async (req, res) => {
  try {
    const { limit, sortBy, startDate, endDate } = req.query;

    const tours = await tourAnalyticsService.getTopTours(
      req.workspaceId,
      parseInt(limit) || 10,
      sortBy || 'completions',
      { startDate, endDate }
    );

    res.json({
      success: true,
      tours
    });
  } catch (error) {
    log.error('Get top tours error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get top tours'
    });
  }
});

/**
 * GET /api/tours/analytics/export
 * Export analytics data to CSV
 */
router.get('/analytics/export', auth, getWorkspaceId, validateDateRange, async (req, res) => {
  try {
    const { format, tourId, startDate, endDate } = req.query;

    // Gather data
    const [summary, daily, topTours] = await Promise.all([
      tourAnalyticsService.getSummary(req.workspaceId, { startDate, endDate }),
      tourAnalyticsService.getDailyStats(req.workspaceId, { startDate, endDate }, tourId),
      tourAnalyticsService.getTopTours(req.workspaceId, 50, 'completions', { startDate, endDate })
    ]);

    let steps = [];
    if (tourId) {
      steps = await tourAnalyticsService.getStepAnalytics(tourId, { startDate, endDate });
    }

    const data = {
      summary,
      tours: topTours,
      daily,
      steps
    };

    if (format === 'csv') {
      const csv = tourAnalyticsService.exportToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=tour-analytics-${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csv);
    }

    // Default: return JSON
    res.json({
      success: true,
      data
    });
  } catch (error) {
    log.error('Export analytics error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to export analytics'
    });
  }
});

// ==================== TEMPLATES ====================

const tourTemplatesService = require('../services/tour-templates.service');

/**
 * GET /api/tours/templates
 * Get all tour templates
 */
router.get('/templates', auth, getWorkspaceId, async (req, res) => {
  try {
    const { category } = req.query;
    const organizationId = req.user?.organization_id || req.workspaceId;

    const templates = await tourTemplatesService.getTemplates(category, organizationId);

    res.json({
      success: true,
      ...templates
    });
  } catch (error) {
    log.error('Get templates error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get templates'
    });
  }
});

/**
 * GET /api/tours/templates/system
 * Get system templates only
 */
router.get('/templates/system', auth, async (req, res) => {
  try {
    const templates = tourTemplatesService.getSystemTemplates();

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    log.error('Get system templates error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get system templates'
    });
  }
});

/**
 * GET /api/tours/templates/categories
 * Get template categories
 */
router.get('/templates/categories', auth, async (req, res) => {
  try {
    const categories = tourTemplatesService.getCategories();

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    log.error('Get categories error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get categories'
    });
  }
});

/**
 * GET /api/tours/templates/:id
 * Get template by ID
 */
router.get('/templates/:id', auth, async (req, res) => {
  try {
    const templateId = req.params.id;

    const template = await tourTemplatesService.getTemplateById(templateId);

    res.json({
      success: true,
      template
    });
  } catch (error) {
    log.error('Get template error', { error: error.message });
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/tours/templates
 * Create new template
 */
router.post('/templates', auth, getWorkspaceId, async (req, res) => {
  try {
    const { name, description, category, steps, settings, thumbnail_url } = req.body;
    const organizationId = req.user?.organization_id || req.workspaceId;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Template name is required'
      });
    }

    const template = await tourTemplatesService.saveAsTemplate(null, {
      name,
      description,
      category,
      steps,
      settings,
      thumbnail_url
    }, organizationId);

    res.status(201).json({
      success: true,
      template
    });
  } catch (error) {
    log.error('Create template error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create template'
    });
  }
});

/**
 * POST /api/tours/templates/:id/create-tour
 * Create tour from template
 */
router.post('/templates/:id/create-tour', auth, getWorkspaceId, async (req, res) => {
  try {
    const templateId = req.params.id;
    const { name, description, settings, theme } = req.body;

    const tour = await tourTemplatesService.createFromTemplate(
      templateId,
      { name, description, settings, theme },
      req.workspaceId
    );

    res.status(201).json({
      success: true,
      tour
    });
  } catch (error) {
    log.error('Create from template error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create tour from template'
    });
  }
});

/**
 * POST /api/tours/:id/save-as-template
 * Save tour as template
 */
router.post('/:id/save-as-template', auth, getWorkspaceId, validateTourId, async (req, res) => {
  try {
    const tourId = parseInt(req.params.id);
    const { name, description, category, thumbnail_url } = req.body;
    const organizationId = req.user?.organization_id || req.workspaceId;

    const template = await tourTemplatesService.saveAsTemplate(
      tourId,
      { name, description, category, thumbnail_url },
      organizationId
    );

    res.status(201).json({
      success: true,
      template
    });
  } catch (error) {
    log.error('Save as template error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to save as template'
    });
  }
});

/**
 * PUT /api/tours/templates/:id
 * Update template
 */
router.put('/templates/:id', auth, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const { name, description, category, steps, settings, thumbnail_url } = req.body;

    const template = await tourTemplatesService.updateTemplate(templateId, {
      name,
      description,
      category,
      steps,
      settings,
      thumbnail_url
    });

    res.json({
      success: true,
      template
    });
  } catch (error) {
    log.error('Update template error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update template'
    });
  }
});

/**
 * DELETE /api/tours/templates/:id
 * Delete template
 */
router.delete('/templates/:id', auth, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);

    await tourTemplatesService.deleteTemplate(templateId);

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    log.error('Delete template error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete template'
    });
  }
});

// ==================== THEMES ====================

const tourThemesService = require('../services/tour-themes.service');

/**
 * GET /api/tours/themes
 * Get all themes
 */
router.get('/themes', auth, getWorkspaceId, async (req, res) => {
  try {
    const organizationId = req.user?.organization_id || req.workspaceId;

    const themes = await tourThemesService.getThemes(organizationId);

    res.json({
      success: true,
      ...themes
    });
  } catch (error) {
    log.error('Get themes error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get themes'
    });
  }
});

/**
 * GET /api/tours/themes/options
 * Get theme customization options
 */
router.get('/themes/options', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      animationTypes: tourThemesService.getAnimationTypes(),
      tooltipStyles: tourThemesService.getTooltipStyles(),
      buttonStyles: tourThemesService.getButtonStyles()
    });
  } catch (error) {
    log.error('Get theme options error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get theme options'
    });
  }
});

/**
 * GET /api/tours/themes/:id
 * Get theme by ID
 */
router.get('/themes/:id', auth, async (req, res) => {
  try {
    const themeId = req.params.id;

    const theme = await tourThemesService.getThemeById(themeId);

    res.json({
      success: true,
      theme
    });
  } catch (error) {
    log.error('Get theme error', { error: error.message });
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/tours/themes/:id/css
 * Get theme as CSS variables
 */
router.get('/themes/:id/css', auth, async (req, res) => {
  try {
    const themeId = req.params.id;

    const theme = await tourThemesService.getThemeById(themeId);
    const css = tourThemesService.getThemeCSS(theme);

    res.setHeader('Content-Type', 'text/css');
    res.send(css);
  } catch (error) {
    log.error('Get theme CSS error', { error: error.message });
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/tours/themes
 * Create new theme
 */
router.post('/themes', auth, getWorkspaceId, async (req, res) => {
  try {
    const { name, description, colors, typography, styling, animation } = req.body;
    const organizationId = req.user?.organization_id || req.workspaceId;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Theme name is required'
      });
    }

    const theme = await tourThemesService.createTheme({
      name,
      description,
      colors,
      typography,
      styling,
      animation
    }, organizationId);

    res.status(201).json({
      success: true,
      theme
    });
  } catch (error) {
    log.error('Create theme error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create theme'
    });
  }
});

/**
 * PUT /api/tours/themes/:id
 * Update theme
 */
router.put('/themes/:id', auth, async (req, res) => {
  try {
    const themeId = parseInt(req.params.id);
    const { name, description, colors, typography, styling, animation } = req.body;

    const theme = await tourThemesService.updateTheme(themeId, {
      name,
      description,
      colors,
      typography,
      styling,
      animation
    });

    res.json({
      success: true,
      theme
    });
  } catch (error) {
    log.error('Update theme error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update theme'
    });
  }
});

/**
 * DELETE /api/tours/themes/:id
 * Delete theme
 */
router.delete('/themes/:id', auth, async (req, res) => {
  try {
    const themeId = parseInt(req.params.id);

    await tourThemesService.deleteTheme(themeId);

    res.json({
      success: true,
      message: 'Theme deleted successfully'
    });
  } catch (error) {
    log.error('Delete theme error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete theme'
    });
  }
});

/**
 * POST /api/tours/themes/:id/clone
 * Clone theme
 */
router.post('/themes/:id/clone', auth, getWorkspaceId, async (req, res) => {
  try {
    const themeId = req.params.id;
    const { name } = req.body;
    const organizationId = req.user?.organization_id || req.workspaceId;

    const theme = await tourThemesService.cloneTheme(themeId, name, organizationId);

    res.status(201).json({
      success: true,
      theme
    });
  } catch (error) {
    log.error('Clone theme error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to clone theme'
    });
  }
});

/**
 * POST /api/tours/:id/apply-theme
 * Apply theme to tour
 */
router.post('/:id/apply-theme', auth, validateTourId, async (req, res) => {
  try {
    const tourId = parseInt(req.params.id);
    const { themeId } = req.body;

    if (!themeId) {
      return res.status(400).json({
        success: false,
        message: 'Theme ID is required'
      });
    }

    const result = await tourThemesService.applyTheme(tourId, themeId);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Apply theme error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to apply theme'
    });
  }
});

module.exports = router;
