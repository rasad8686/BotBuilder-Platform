/**
 * Recovery Engine API Routes
 *
 * Endpoints for AI Revenue Recovery Engine:
 * - Campaign management
 * - Abandoned cart recovery
 * - Customer health scores
 * - Analytics and reporting
 * - Message tracking
 */

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { organizationContext } = require('../middleware/organizationContext');
const RecoveryService = require('../services/recoveryEngine/RecoveryService');

// Helper function to get organization ID from request
const getOrganizationId = (req) => {
  return req.organization?.id || req.user?.current_organization_id || req.user?.organization_id;
};
const AbandonedCartService = require('../services/recoveryEngine/AbandonedCartService');
const ChurnPredictionService = require('../services/recoveryEngine/ChurnPredictionService');
const RecoveryAnalyticsService = require('../services/recoveryEngine/RecoveryAnalyticsService');
const RecoveryMessagingService = require('../services/recoveryEngine/RecoveryMessagingService');
const db = require('../db');

// Apply authentication and organization context to all routes
router.use(authenticate);
router.use(organizationContext);

// ============================================
// CAMPAIGNS ENDPOINTS
// ============================================

/**
 * GET /api/recovery/campaigns
 * Get list of recovery campaigns
 */
router.get('/campaigns', async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const { status, campaign_type, bot_id, limit, offset } = req.query;

    // Check if table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'recovery_campaigns'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      return res.json({
        success: true,
        campaigns: [],
        total: 0,
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
      });
    }

    const result = await RecoveryService.getCampaigns(orgId, {
      status,
      campaign_type,
      bot_id,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/recovery/campaigns
 * Create new recovery campaign
 */
router.post('/campaigns', async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const campaignData = {
      ...req.body,
      created_by: req.user.id
    };

    const campaign = await RecoveryService.createCampaign(orgId, campaignData);

    res.status(201).json({
      success: true,
      campaign
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/recovery/campaigns/:id
 * Get single campaign
 */
router.get('/campaigns/:id', async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM recovery_campaigns WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      campaign: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * PUT /api/recovery/campaigns/:id
 * Update campaign
 */
router.put('/campaigns/:id', async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const { id } = req.params;

    // Verify ownership
    const existing = await db.query(
      'SELECT id FROM recovery_campaigns WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    const campaign = await RecoveryService.updateCampaign(id, req.body);

    res.json({
      success: true,
      campaign
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * DELETE /api/recovery/campaigns/:id
 * Delete campaign
 */
router.delete('/campaigns/:id', async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const { id } = req.params;

    // Verify ownership
    const existing = await db.query(
      'SELECT id FROM recovery_campaigns WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    await RecoveryService.deleteCampaign(id);

    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// ABANDONED CARTS ENDPOINTS
// ============================================

/**
 * GET /api/recovery/carts
 * Get abandoned carts list
 */
router.get('/carts', async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const { status, min_value, max_value, start_date, end_date, limit, offset } = req.query;

    // Check if table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'recovery_events'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      return res.json({
        success: true,
        carts: [],
        total: 0,
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
      });
    }

    const result = await AbandonedCartService.getAbandonedCarts(orgId, {
      status,
      min_value: min_value ? parseFloat(min_value) : undefined,
      max_value: max_value ? parseFloat(max_value) : undefined,
      start_date: start_date ? new Date(start_date) : undefined,
      end_date: end_date ? new Date(end_date) : undefined,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/recovery/carts/detect
 * Detect abandoned cart
 */
router.post('/carts/detect', async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const { session_id, ...cartData } = req.body;

    const result = await AbandonedCartService.detectAbandonedCart(session_id, {
      org_id: orgId,
      ...cartData
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/recovery/carts/:id/recover
 * Start cart recovery process
 */
router.post('/carts/:id/recover', async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const { id } = req.params;
    const { customer_id } = req.body;

    // Create recovery sequence
    const sequence = await AbandonedCartService.createRecoverySequence(id, customer_id);

    // Calculate optimal timing
    const timing = await AbandonedCartService.calculateOptimalTiming(customer_id);

    // Schedule messages
    const scheduled = await AbandonedCartService.scheduleRecoveryMessages(
      sequence.event_id,
      timing.recommended_timing
    );

    res.json({
      success: true,
      sequence,
      timing,
      scheduled
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// CUSTOMER HEALTH ENDPOINTS
// ============================================

/**
 * GET /api/recovery/customers/health
 * Get customer health scores
 */
router.get('/customers/health', async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const { limit, offset, risk_level } = req.query;

    // Check if table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'customer_health_scores'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      return res.json({
        success: true,
        customers: [],
        total: 0,
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
      });
    }

    let query = `
      SELECT * FROM customer_health_scores
      WHERE org_id = $1
    `;
    const params = [orgId];

    if (risk_level) {
      query += ` AND churn_risk_level = $2`;
      params.push(risk_level);
    }

    query += ` ORDER BY churn_probability DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit) || 50, parseInt(offset) || 0);

    const result = await db.query(query, params);

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM customer_health_scores WHERE org_id = $1`,
      [orgId]
    );

    res.json({
      success: true,
      customers: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/recovery/customers/:id/health
 * Get single customer health score
 */
router.get('/customers/:id/health', async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const { id } = req.params;
    const { recalculate } = req.query;

    let healthScore;

    if (recalculate === 'true') {
      healthScore = await ChurnPredictionService.calculateHealthScore(id, orgId);
    } else {
      healthScore = await RecoveryService.getCustomerHealthScore(id, orgId);

      if (!healthScore) {
        healthScore = await ChurnPredictionService.calculateHealthScore(id, orgId);
      }
    }

    if (!healthScore) {
      return res.status(404).json({
        success: false,
        message: 'Customer health score not found'
      });
    }

    res.json({
      success: true,
      health: healthScore
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/recovery/customers/at-risk
 * Get customers at risk
 */
router.get('/customers/at-risk', async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const { threshold } = req.query;

    const result = await ChurnPredictionService.getAtRiskCustomers(
      orgId,
      parseFloat(threshold) || 0.5
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// ANALYTICS ENDPOINTS
// ============================================

/**
 * GET /api/recovery/analytics/dashboard
 * Get dashboard statistics
 */
router.get('/analytics/dashboard', async (req, res) => {
  try {
    const orgId = getOrganizationId(req);

    // Check if tables exist
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'recovery_campaigns'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      return res.json({
        success: true,
        total_recovered: 0,
        recovery_rate: 0,
        abandoned_carts: 0,
        at_risk_customers: 0,
        active_campaigns: 0,
        health_distribution: {}
      });
    }

    const stats = await RecoveryAnalyticsService.getDashboardStats(orgId);

    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/recovery/analytics/revenue
 * Get recovered revenue analytics
 */
router.get('/analytics/revenue', async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const { start_date, end_date } = req.query;

    const result = await RecoveryAnalyticsService.getRevenueRecovered(orgId, {
      start_date: start_date ? new Date(start_date) : undefined,
      end_date: end_date ? new Date(end_date) : undefined
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/recovery/analytics/channels
 * Get channel performance analytics
 */
router.get('/analytics/channels', async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const { start_date, end_date } = req.query;

    const result = await RecoveryAnalyticsService.getRecoveryRateByChannel(orgId, {
      start_date: start_date ? new Date(start_date) : undefined,
      end_date: end_date ? new Date(end_date) : undefined
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/recovery/analytics/report
 * Generate analytics report
 */
router.get('/analytics/report', async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const { start_date, end_date, format } = req.query;

    const report = await RecoveryAnalyticsService.generateReport(
      orgId,
      {
        start_date: start_date ? new Date(start_date) : undefined,
        end_date: end_date ? new Date(end_date) : undefined
      },
      format || 'json'
    );

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
      return res.send(report.content);
    }

    res.json({
      success: true,
      report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// MESSAGES ENDPOINTS
// ============================================

/**
 * GET /api/recovery/messages
 * Get recovery messages list
 */
router.get('/messages', async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const { campaign_id, status, channel, limit, offset } = req.query;

    let query = `
      SELECT m.*, c.name as campaign_name
      FROM recovery_messages m
      LEFT JOIN recovery_campaigns c ON m.campaign_id = c.id
      WHERE m.org_id = $1
    `;
    const params = [orgId];
    let paramIndex = 2;

    if (campaign_id) {
      query += ` AND m.campaign_id = $${paramIndex}`;
      params.push(campaign_id);
      paramIndex++;
    }

    if (status) {
      query += ` AND m.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (channel) {
      query += ` AND m.channel = $${paramIndex}`;
      params.push(channel);
      paramIndex++;
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit) || 50, parseInt(offset) || 0);

    const result = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM recovery_messages WHERE org_id = $1`;
    const countParams = [orgId];

    if (campaign_id) {
      countQuery += ` AND campaign_id = $2`;
      countParams.push(campaign_id);
    }

    const countResult = await db.query(countQuery, countParams);

    res.json({
      success: true,
      messages: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/recovery/messages/:id/stats
 * Get message statistics
 */
router.get('/messages/:id/stats', async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const { id } = req.params;

    // Get message
    const messageResult = await db.query(
      'SELECT * FROM recovery_messages WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    const message = messageResult.rows[0];

    // Get campaign stats if exists
    let campaignStats = null;
    if (message.campaign_id) {
      campaignStats = await RecoveryMessagingService.getMessageStats(orgId, message.campaign_id);
    }

    res.json({
      success: true,
      message,
      campaign_stats: campaignStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
