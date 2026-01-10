/**
 * A/B Testing API Routes
 * Authenticated routes for managing A/B tests
 */

const express = require('express');
const router = express.Router();
const abTestService = require('../services/ab-test.service');
const abTestAnalyticsService = require('../services/ab-test-analytics.service');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

// Get workspace ID from user
const getWorkspaceId = (req) => {
  return req.query.workspace_id ||
         req.body.workspace_id ||
         req.user?.workspace_id ||
         req.user?.organization_id ||
         req.user?.org_id ||
         req.user?.id ||
         1;
};

// ==================== Tests CRUD ====================

/**
 * GET /api/ab-tests
 * List all A/B tests with pagination and filtering
 */
router.get('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { status, page = 1, limit = 20 } = req.query;

    const result = await abTestService.getTests(workspaceId, {
      status,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json(result);
  } catch (error) {
    console.error('GET /api/ab-tests error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ab-tests
 * Create a new A/B test
 */
router.post('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const testData = {
      ...req.body,
      workspace_id: workspaceId
    };

    const test = await abTestService.createTest(testData);
    res.status(201).json(test);
  } catch (error) {
    console.error('POST /api/ab-tests error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/ab-tests/:id
 * Get a single A/B test with variants and analytics
 */
router.get('/:id', async (req, res) => {
  try {
    const test = await abTestService.getTestById(req.params.id);

    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    res.json(test);
  } catch (error) {
    console.error('GET /api/ab-tests/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/ab-tests/:id
 * Update an A/B test
 */
router.put('/:id', async (req, res) => {
  try {
    const test = await abTestService.updateTest(req.params.id, req.body);

    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    res.json(test);
  } catch (error) {
    console.error('PUT /api/ab-tests/:id error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/ab-tests/:id
 * Delete an A/B test
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await abTestService.deleteTest(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Test not found' });
    }

    res.json({ success: true, message: 'Test deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/ab-tests/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ab-tests/:id/duplicate
 * Duplicate an A/B test
 */
router.post('/:id/duplicate', async (req, res) => {
  try {
    const test = await abTestService.duplicateTest(req.params.id);

    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    res.status(201).json(test);
  } catch (error) {
    console.error('POST /api/ab-tests/:id/duplicate error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Status Management ====================

/**
 * POST /api/ab-tests/:id/start
 * Start an A/B test
 */
router.post('/:id/start', async (req, res) => {
  try {
    const test = await abTestService.startTest(req.params.id);

    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    res.json(test);
  } catch (error) {
    console.error('POST /api/ab-tests/:id/start error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/ab-tests/:id/pause
 * Pause an A/B test
 */
router.post('/:id/pause', async (req, res) => {
  try {
    const test = await abTestService.pauseTest(req.params.id);

    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    res.json(test);
  } catch (error) {
    console.error('POST /api/ab-tests/:id/pause error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/ab-tests/:id/resume
 * Resume a paused A/B test
 */
router.post('/:id/resume', async (req, res) => {
  try {
    const test = await abTestService.resumeTest(req.params.id);

    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    res.json(test);
  } catch (error) {
    console.error('POST /api/ab-tests/:id/resume error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/ab-tests/:id/complete
 * Complete/end an A/B test
 */
router.post('/:id/complete', async (req, res) => {
  try {
    const test = await abTestService.completeTest(req.params.id);

    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    res.json(test);
  } catch (error) {
    console.error('POST /api/ab-tests/:id/complete error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/ab-tests/:id/declare-winner
 * Declare a winner for the A/B test
 */
router.post('/:id/declare-winner', async (req, res) => {
  try {
    const { variantId } = req.body;

    if (!variantId) {
      return res.status(400).json({ error: 'variantId is required' });
    }

    const test = await abTestService.declareWinner(req.params.id, variantId);

    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    res.json(test);
  } catch (error) {
    console.error('POST /api/ab-tests/:id/declare-winner error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ==================== Variants Management ====================

/**
 * GET /api/ab-tests/:id/variants
 * Get all variants for an A/B test
 */
router.get('/:id/variants', async (req, res) => {
  try {
    const variants = await abTestService.getVariants(req.params.id);
    res.json({ variants });
  } catch (error) {
    console.error('GET /api/ab-tests/:id/variants error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ab-tests/:id/variants
 * Add a new variant to an A/B test
 */
router.post('/:id/variants', async (req, res) => {
  try {
    const variant = await abTestService.addVariant(req.params.id, req.body);
    res.status(201).json(variant);
  } catch (error) {
    console.error('POST /api/ab-tests/:id/variants error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/ab-tests/:id/variants/:variantId
 * Update a variant
 */
router.put('/:id/variants/:variantId', async (req, res) => {
  try {
    const variant = await abTestService.updateVariant(req.params.variantId, req.body);

    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    res.json(variant);
  } catch (error) {
    console.error('PUT /api/ab-tests/:id/variants/:variantId error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/ab-tests/:id/variants/:variantId
 * Delete a variant
 */
router.delete('/:id/variants/:variantId', async (req, res) => {
  try {
    const deleted = await abTestService.deleteVariant(req.params.variantId);

    if (!deleted) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    res.json({ success: true, message: 'Variant deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/ab-tests/:id/variants/:variantId error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Analytics ====================

/**
 * GET /api/ab-tests/:id/analytics
 * Get analytics for an A/B test
 */
router.get('/:id/analytics', async (req, res) => {
  try {
    const analytics = await abTestService.getTestAnalytics(req.params.id);
    res.json(analytics);
  } catch (error) {
    console.error('GET /api/ab-tests/:id/analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ab-tests/:id/analytics/daily
 * Get daily analytics for an A/B test
 */
router.get('/:id/analytics/daily', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const analytics = await abTestService.getDailyAnalytics(req.params.id, {
      startDate,
      endDate
    });
    res.json({ analytics });
  } catch (error) {
    console.error('GET /api/ab-tests/:id/analytics/daily error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ab-tests/analytics/overview
 * Get overview analytics for all A/B tests in workspace
 */
router.get('/analytics/overview', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const overview = await abTestService.getWorkspaceOverview(workspaceId);
    res.json(overview);
  } catch (error) {
    console.error('GET /api/ab-tests/analytics/overview error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Enhanced Analytics Routes ====================

/**
 * GET /api/ab-tests/:id/analytics/detailed
 * Get detailed analytics for an A/B test with timeline and hourly data
 */
router.get('/:id/analytics/detailed', async (req, res) => {
  try {
    const { period = '30d', startDate, endDate } = req.query;

    const analytics = await abTestAnalyticsService.getTestAnalytics(req.params.id, {
      period,
      startDate,
      endDate
    });

    res.json(analytics);
  } catch (error) {
    console.error('GET /api/ab-tests/:id/analytics/detailed error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ab-tests/:id/compare
 * Compare two variants in an A/B test
 */
router.get('/:id/compare', async (req, res) => {
  try {
    const { variantA, variantB } = req.query;

    if (!variantA || !variantB) {
      return res.status(400).json({ error: 'Both variantA and variantB are required' });
    }

    const comparison = await abTestAnalyticsService.compareVariants(
      req.params.id,
      variantA,
      variantB
    );

    res.json(comparison);
  } catch (error) {
    console.error('GET /api/ab-tests/:id/compare error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ab-tests/:id/analytics/export
 * Export analytics data as CSV or PDF
 */
router.get('/:id/analytics/export', async (req, res) => {
  try {
    const { format = 'csv', period = '30d' } = req.query;

    const data = await abTestAnalyticsService.exportAnalytics(req.params.id, {
      format,
      period
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=ab-test-${req.params.id}-analytics.csv`);
      res.send(data);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('GET /api/ab-tests/:id/analytics/export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Workspace Analytics Routes ====================

/**
 * GET /api/workspaces/:workspaceId/ab-tests/analytics
 * Get workspace-wide A/B test analytics
 */
router.get('/workspaces/:workspaceId/analytics', async (req, res) => {
  try {
    const { period = '30d', startDate, endDate, status = 'all' } = req.query;

    const analytics = await abTestAnalyticsService.getWorkspaceAnalytics(
      req.params.workspaceId,
      { period, startDate, endDate, status }
    );

    res.json(analytics);
  } catch (error) {
    console.error('GET /api/workspaces/:workspaceId/ab-tests/analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/workspaces/:workspaceId/ab-tests/analytics/export
 * Export workspace analytics
 */
router.get('/workspaces/:workspaceId/analytics/export', async (req, res) => {
  try {
    const { format = 'csv', period = '30d' } = req.query;

    const analytics = await abTestAnalyticsService.getWorkspaceAnalytics(
      req.params.workspaceId,
      { period }
    );

    if (format === 'csv') {
      // Generate CSV
      const headers = ['Test Name', 'Status', 'Impressions', 'Conversions', 'Conversion Rate', 'Winner'];
      const rows = analytics.tests.map(t => [
        t.name,
        t.status,
        t.impressions,
        t.conversions,
        `${t.conversionRate?.toFixed(2) || 0}%`,
        t.winner || '-'
      ]);

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=workspace-ab-tests-analytics.csv`);
      res.send(csv);
    } else {
      res.json(analytics);
    }
  } catch (error) {
    console.error('GET /api/workspaces/:workspaceId/ab-tests/analytics/export error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
