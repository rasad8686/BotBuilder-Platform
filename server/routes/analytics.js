const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');

// Apply authentication and organization context to all routes
router.use(authenticateToken);
router.use(organizationContext);
router.use(requireOrganization);

/**
 * GET /api/analytics/overview
 * Get analytics overview for the organization
 */
router.get('/overview', async (req, res) => {
  try {
    // Placeholder for analytics data
    res.json({
      success: true,
      data: {
        totalBots: 0,
        totalMessages: 0,
        activeUsers: 0,
        apiCalls: 0
      }
    });
  } catch (error) {
    console.error('[ANALYTICS] Error fetching overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
  }
});

module.exports = router;
