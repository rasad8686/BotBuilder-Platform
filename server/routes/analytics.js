const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');
const db = require('../db');
const log = require('../utils/logger');

// Apply authentication and organization context to all routes
router.use(authenticateToken);
router.use(organizationContext);
router.use(requireOrganization);

/**
 * GET /api/analytics/dashboard
 * Get dashboard usage stats for the organization
 * Returns subscription info, bot usage, and message usage
 */
router.get('/dashboard', async (req, res) => {
  try {
    const orgId = req.organization.id;

    // Define plan limits
    const PLAN_LIMITS = {
      free: { bots: 1, messages: 1000 },
      pro: { bots: 10, messages: 50000 },
      enterprise: { bots: -1, messages: -1 } // unlimited
    };

    const PLAN_DISPLAY_NAMES = {
      free: 'Free Plan',
      pro: 'Pro Plan',
      enterprise: 'Enterprise Plan'
    };

    // Get organization plan
    const orgResult = await db.query(
      'SELECT plan_tier FROM organizations WHERE id = $1',
      [orgId]
    );
    const planTier = orgResult.rows[0]?.plan_tier || 'free';
    const planLimits = PLAN_LIMITS[planTier];

    // Get bot count
    const botsResult = await db.query(
      'SELECT COUNT(*) as count FROM bots WHERE organization_id = $1',
      [orgId]
    );
    const botsCount = parseInt(botsResult.rows[0].count) || 0;

    // Get current month's message count
    const messagesResult = await db.query(
      `SELECT message_count
       FROM message_usage
       WHERE organization_id = $1 AND period_end IS NULL
       ORDER BY period_start DESC
       LIMIT 1`,
      [orgId]
    );
    const messagesTotal = messagesResult.rows.length > 0 ? parseInt(messagesResult.rows[0].message_count) : 0;

    // Get sent/received breakdown (from bot_messages)
    const messageBreakdownResult = await db.query(
      `SELECT
         COUNT(CASE WHEN message_type IN ('greeting', 'response', 'fallback') THEN 1 END) as sent,
         COUNT(CASE WHEN message_type = 'user_message' THEN 1 END) as received
       FROM bot_messages bm
       JOIN bots b ON b.id = bm.bot_id
       WHERE b.organization_id = $1
         AND bm.created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP)`,
      [orgId]
    );

    const messagesSent = parseInt(messageBreakdownResult.rows[0]?.sent) || 0;
    const messagesReceived = parseInt(messageBreakdownResult.rows[0]?.received) || 0;

    // Calculate percentages and limits
    const botsPercentage = planLimits.bots === -1 ? 0 : (botsCount / planLimits.bots) * 100;
    const messagesPercentage = planLimits.messages === -1 ? 0 : (messagesTotal / planLimits.messages) * 100;

    res.json({
      success: true,
      subscription: {
        plan_name: planTier,
        display_name: PLAN_DISPLAY_NAMES[planTier]
      },
      bots: {
        total: botsCount,
        limit: planLimits.bots,
        percentage: Math.round(botsPercentage * 100) / 100,
        canCreateMore: planLimits.bots === -1 || botsCount < planLimits.bots
      },
      messages: {
        total: messagesTotal,
        limit: planLimits.messages,
        percentage: Math.round(messagesPercentage * 100) / 100,
        sent: messagesSent,
        received: messagesReceived
      }
    });
  } catch (error) {
    log.error('[ANALYTICS] Error fetching dashboard:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
});

/**
 * GET /api/analytics/overview
 * Get analytics overview for the organization
 */
router.get('/overview', async (req, res) => {
  try {
    const orgId = req.organization.id;
    const userId = req.user.id;

    // Get total messages count (from bot_messages)
    const messagesResult = await db.query(
      `SELECT COUNT(*) as total
       FROM bot_messages bm
       JOIN bots b ON b.id = bm.bot_id
       WHERE b.organization_id = $1`,
      [orgId]
    );

    // Get total bots count
    const botsResult = await db.query(
      `SELECT COUNT(*) as total
       FROM bots
       WHERE organization_id = $1`,
      [orgId]
    );

    // Get API calls count from usage_tracking
    const apiCallsResult = await db.query(
      `SELECT COUNT(*) as total
       FROM usage_tracking ut
       JOIN bots b ON b.id = ut.bot_id
       WHERE b.organization_id = $1 AND ut.metric_type = 'api_call'`,
      [orgId]
    );

    // Get active users count (organization members)
    const activeUsersResult = await db.query(
      `SELECT COUNT(*) as total
       FROM organization_members
       WHERE org_id = $1 AND status = 'active'`,
      [orgId]
    );

    res.json({
      success: true,
      data: {
        totalMessages: parseInt(messagesResult.rows[0].total) || 0,
        totalBots: parseInt(botsResult.rows[0].total) || 0,
        apiCalls: parseInt(apiCallsResult.rows[0].total) || 0,
        activeUsers: parseInt(activeUsersResult.rows[0].total) || 0
      }
    });
  } catch (error) {
    log.error('[ANALYTICS] Error fetching overview:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
  }
});

/**
 * GET /api/analytics/messages-over-time
 * Get daily message counts for the last N days
 * Query params: days (default: 7, options: 7, 30)
 */
router.get('/messages-over-time', async (req, res) => {
  try {
    const orgId = req.organization.id;
    const days = parseInt(req.query.days) || 7;

    // Get daily message counts
    const result = await db.query(
      `SELECT
         DATE(bm.created_at) as date,
         COUNT(*) as count
       FROM bot_messages bm
       JOIN bots b ON b.id = bm.bot_id
       WHERE b.organization_id = $1
         AND bm.created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(bm.created_at)
       ORDER BY date ASC`,
      [orgId]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count)
      }))
    });
  } catch (error) {
    log.error('[ANALYTICS] Error fetching messages over time:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages over time'
    });
  }
});

/**
 * GET /api/analytics/by-bot
 * Get message count per bot
 */
router.get('/by-bot', async (req, res) => {
  try {
    const orgId = req.organization.id;

    // Get message count per bot
    const result = await db.query(
      `SELECT
         b.id,
         b.name,
         COUNT(bm.id) as message_count
       FROM bots b
       LEFT JOIN bot_messages bm ON bm.bot_id = b.id
       WHERE b.organization_id = $1
       GROUP BY b.id, b.name
       ORDER BY message_count DESC`,
      [orgId]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        botId: row.id,
        botName: row.name,
        messageCount: parseInt(row.message_count)
      }))
    });
  } catch (error) {
    log.error('[ANALYTICS] Error fetching by-bot analytics:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch by-bot analytics'
    });
  }
});

/**
 * GET /api/analytics/recent-activity
 * Get last 10 bot interactions with timestamps
 */
router.get('/recent-activity', async (req, res) => {
  try {
    const orgId = req.organization.id;

    // Get recent bot messages
    const result = await db.query(
      `SELECT
         bm.id,
         bm.bot_id,
         b.name as bot_name,
         bm.message_type,
         bm.content,
         bm.created_at
       FROM bot_messages bm
       JOIN bots b ON b.id = bm.bot_id
       WHERE b.organization_id = $1
       ORDER BY bm.created_at DESC
       LIMIT 10`,
      [orgId]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        botId: row.bot_id,
        botName: row.bot_name,
        messageType: row.message_type,
        content: row.content.substring(0, 100), // Truncate content
        timestamp: row.created_at
      }))
    });
  } catch (error) {
    log.error('[ANALYTICS] Error fetching recent activity:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activity'
    });
  }
});

module.exports = router;
