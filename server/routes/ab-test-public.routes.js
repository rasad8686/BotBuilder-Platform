/**
 * A/B Testing Public Routes
 * Unauthenticated routes for SDK/widget integration
 */

const express = require('express');
const router = express.Router();
const abTestService = require('../services/ab-test.service');

// ==================== Public Routes for SDK/Widget ====================

/**
 * POST /api/public/ab-tests/assign
 * Assign a visitor to a variant
 * Body: { testId, visitorId, userId?, sessionId? }
 */
router.post('/assign', async (req, res) => {
  try {
    const { testId, visitorId, userId, sessionId } = req.body;

    if (!testId) {
      return res.status(400).json({ error: 'testId is required' });
    }

    if (!visitorId) {
      return res.status(400).json({ error: 'visitorId is required' });
    }

    const assignment = await abTestService.assignVisitor(testId, visitorId, {
      userId,
      sessionId
    });

    res.json(assignment);
  } catch (error) {
    console.error('POST /api/public/ab-tests/assign error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/public/ab-tests/convert
 * Track a conversion
 * Body: { testId, visitorId, conversionType, value?, metadata? }
 */
router.post('/convert', async (req, res) => {
  try {
    const { testId, visitorId, conversionType, value, metadata } = req.body;

    if (!testId) {
      return res.status(400).json({ error: 'testId is required' });
    }

    if (!visitorId) {
      return res.status(400).json({ error: 'visitorId is required' });
    }

    if (!conversionType) {
      return res.status(400).json({ error: 'conversionType is required' });
    }

    const conversion = await abTestService.trackConversion(testId, visitorId, {
      conversionType,
      value,
      metadata
    });

    res.json(conversion);
  } catch (error) {
    console.error('POST /api/public/ab-tests/convert error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/public/ab-tests/:testId/variant/:visitorId
 * Get assigned variant for a visitor
 */
router.get('/:testId/variant/:visitorId', async (req, res) => {
  try {
    const { testId, visitorId } = req.params;

    const variant = await abTestService.getVisitorVariant(testId, visitorId);

    if (!variant) {
      return res.status(404).json({ error: 'No assignment found' });
    }

    res.json(variant);
  } catch (error) {
    console.error('GET /api/public/ab-tests/:testId/variant/:visitorId error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/public/ab-tests/batch-assign
 * Assign visitor to multiple tests at once
 * Body: { testIds: [], visitorId, userId?, sessionId? }
 */
router.post('/batch-assign', async (req, res) => {
  try {
    const { testIds, visitorId, userId, sessionId } = req.body;

    if (!testIds || !Array.isArray(testIds) || testIds.length === 0) {
      return res.status(400).json({ error: 'testIds array is required' });
    }

    if (!visitorId) {
      return res.status(400).json({ error: 'visitorId is required' });
    }

    const assignments = await Promise.all(
      testIds.map(testId =>
        abTestService.assignVisitor(testId, visitorId, { userId, sessionId })
          .catch(err => ({ testId, error: err.message }))
      )
    );

    res.json({ assignments });
  } catch (error) {
    console.error('POST /api/public/ab-tests/batch-assign error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/public/ab-tests/batch-convert
 * Track conversions for multiple tests at once
 * Body: { conversions: [{ testId, visitorId, conversionType, value?, metadata? }] }
 */
router.post('/batch-convert', async (req, res) => {
  try {
    const { conversions } = req.body;

    if (!conversions || !Array.isArray(conversions) || conversions.length === 0) {
      return res.status(400).json({ error: 'conversions array is required' });
    }

    const results = await Promise.all(
      conversions.map(conv =>
        abTestService.trackConversion(conv.testId, conv.visitorId, {
          conversionType: conv.conversionType,
          value: conv.value,
          metadata: conv.metadata
        }).catch(err => ({ testId: conv.testId, error: err.message }))
      )
    );

    res.json({ results });
  } catch (error) {
    console.error('POST /api/public/ab-tests/batch-convert error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/public/ab-tests/active/:workspaceId
 * Get all active tests for a workspace (for SDK initialization)
 */
router.get('/active/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const result = await abTestService.getTests(workspaceId, {
      status: 'running',
      page: 1,
      limit: 100
    });

    // Return simplified test data for SDK
    const tests = result.tests.map(test => ({
      id: test.id,
      name: test.name,
      testType: test.test_type,
      trafficSplit: test.traffic_split
    }));

    res.json({ tests });
  } catch (error) {
    console.error('GET /api/public/ab-tests/active/:workspaceId error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
