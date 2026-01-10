/**
 * Email A/B Test Routes
 * API endpoints for email A/B testing
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const emailABTestService = require('../services/email-ab-test.service');

/**
 * @route POST /api/email/campaigns/:campaignId/ab-test
 * @desc Create A/B test for a campaign
 */
router.post('/campaigns/:campaignId/ab-test', auth, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    const test = await emailABTestService.createTest(
      campaignId,
      organizationId,
      userId,
      req.body
    );

    res.status(201).json({
      success: true,
      data: test
    });
  } catch (error) {
    console.error('Error creating A/B test:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/email/campaigns/:campaignId/ab-test
 * @desc Get A/B test for a campaign
 */
router.get('/campaigns/:campaignId/ab-test', auth, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const organizationId = req.user.organization_id;

    const test = await emailABTestService.getTestByCampaign(campaignId, organizationId);

    if (!test) {
      return res.status(404).json({
        success: false,
        error: 'A/B test not found for this campaign'
      });
    }

    res.json({
      success: true,
      data: test
    });
  } catch (error) {
    console.error('Error getting A/B test:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/email/ab-tests
 * @desc List all A/B tests for organization
 */
router.get('/ab-tests', auth, async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { status, page, limit } = req.query;

    const result = await emailABTestService.listTests(organizationId, {
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json({
      success: true,
      data: result.tests,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error listing A/B tests:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/email/ab-tests/:testId
 * @desc Get A/B test by ID
 */
router.get('/ab-tests/:testId', auth, async (req, res) => {
  try {
    const { testId } = req.params;
    const organizationId = req.user.organization_id;

    const test = await emailABTestService.getTest(testId, organizationId);

    if (!test) {
      return res.status(404).json({
        success: false,
        error: 'A/B test not found'
      });
    }

    res.json({
      success: true,
      data: test
    });
  } catch (error) {
    console.error('Error getting A/B test:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route PUT /api/email/ab-tests/:testId
 * @desc Update A/B test
 */
router.put('/ab-tests/:testId', auth, async (req, res) => {
  try {
    const { testId } = req.params;
    const organizationId = req.user.organization_id;

    const test = await emailABTestService.updateTest(testId, organizationId, req.body);

    res.json({
      success: true,
      data: test
    });
  } catch (error) {
    console.error('Error updating A/B test:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route PUT /api/email/ab-tests/:testId/variants/:variantId
 * @desc Update variant
 */
router.put('/ab-tests/:testId/variants/:variantId', auth, async (req, res) => {
  try {
    const { testId, variantId } = req.params;
    const organizationId = req.user.organization_id;

    const variant = await emailABTestService.updateVariant(
      variantId,
      testId,
      organizationId,
      req.body
    );

    res.json({
      success: true,
      data: variant
    });
  } catch (error) {
    console.error('Error updating variant:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/email/ab-tests/:testId/start
 * @desc Start A/B test
 */
router.post('/ab-tests/:testId/start', auth, async (req, res) => {
  try {
    const { testId } = req.params;
    const organizationId = req.user.organization_id;

    const test = await emailABTestService.startTest(testId, organizationId);

    res.json({
      success: true,
      data: test,
      message: 'A/B test started successfully'
    });
  } catch (error) {
    console.error('Error starting A/B test:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/email/ab-tests/:testId/stop
 * @desc Stop A/B test
 */
router.post('/ab-tests/:testId/stop', auth, async (req, res) => {
  try {
    const { testId } = req.params;
    const organizationId = req.user.organization_id;

    const test = await emailABTestService.stopTest(testId, organizationId);

    res.json({
      success: true,
      data: test,
      message: 'A/B test stopped successfully'
    });
  } catch (error) {
    console.error('Error stopping A/B test:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/email/ab-tests/:testId/select-winner
 * @desc Manually select winner
 */
router.post('/ab-tests/:testId/select-winner', auth, async (req, res) => {
  try {
    const { testId } = req.params;
    const { variantId } = req.body;
    const organizationId = req.user.organization_id;

    if (!variantId) {
      return res.status(400).json({
        success: false,
        error: 'variantId is required'
      });
    }

    const test = await emailABTestService.selectWinner(testId, organizationId, variantId);

    res.json({
      success: true,
      data: test,
      message: 'Winner selected successfully'
    });
  } catch (error) {
    console.error('Error selecting winner:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/email/ab-tests/:testId/determine-winner
 * @desc Auto-determine winner based on statistics
 */
router.post('/ab-tests/:testId/determine-winner', auth, async (req, res) => {
  try {
    const { testId } = req.params;
    const organizationId = req.user.organization_id;

    const result = await emailABTestService.determineWinner(testId, organizationId);

    res.json({
      success: true,
      data: result,
      message: 'Winner determined successfully'
    });
  } catch (error) {
    console.error('Error determining winner:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/email/ab-tests/:testId/results
 * @desc Get A/B test results
 */
router.get('/ab-tests/:testId/results', auth, async (req, res) => {
  try {
    const { testId } = req.params;
    const organizationId = req.user.organization_id;

    const results = await emailABTestService.getResults(testId, organizationId);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error getting A/B test results:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/email/ab-tests/:testId/send-winner
 * @desc Send winning variant to remaining audience
 */
router.post('/ab-tests/:testId/send-winner', auth, async (req, res) => {
  try {
    const { testId } = req.params;
    const organizationId = req.user.organization_id;

    const result = await emailABTestService.sendToRemainingAudience(testId, organizationId);

    res.json({
      success: true,
      data: result,
      message: `Winner sent to ${result.sent_count} remaining contacts`
    });
  } catch (error) {
    console.error('Error sending winner:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/email/ab-tests/:testId
 * @desc Delete A/B test
 */
router.delete('/ab-tests/:testId', auth, async (req, res) => {
  try {
    const { testId } = req.params;
    const organizationId = req.user.organization_id;

    await emailABTestService.deleteTest(testId, organizationId);

    res.json({
      success: true,
      message: 'A/B test deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting A/B test:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/email/ab-tests/:testId/track
 * @desc Track event for A/B test variant (internal use)
 */
router.post('/ab-tests/:testId/track', async (req, res) => {
  try {
    const { testId } = req.params;
    const { variantId, eventType, data } = req.body;

    await emailABTestService.trackEvent(testId, variantId, eventType, data);

    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error tracking event:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
