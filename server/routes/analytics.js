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

    // Get total messages count (from bot_messages) - last 30 days
    const messagesResult = await db.query(
      `SELECT COUNT(*) as total
       FROM bot_messages bm
       JOIN bots b ON b.id = bm.bot_id
       WHERE b.organization_id = $1
         AND bm.created_at >= NOW() - INTERVAL '30 days'`,
      [orgId]
    );

    // Get total bots count
    const botsResult = await db.query(
      `SELECT COUNT(*) as total
       FROM bots
       WHERE organization_id = $1`,
      [orgId]
    );

    // Get API calls count from usage_tracking - last 30 days
    const apiCallsResult = await db.query(
      `SELECT COUNT(*) as total
       FROM usage_tracking ut
       JOIN bots b ON b.id = ut.bot_id
       WHERE b.organization_id = $1
         AND ut.metric_type = 'api_call'
         AND ut.tracked_at >= NOW() - INTERVAL '30 days'`,
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
    // SECURITY FIX: Use parameterized interval to prevent SQL injection
    const days = parseInt(req.query.days, 10) || 7;

    // Get daily message counts
    const result = await db.query(
      `SELECT
         DATE(bm.created_at) as date,
         COUNT(*) as count
       FROM bot_messages bm
       JOIN bots b ON b.id = bm.bot_id
       WHERE b.organization_id = $1
         AND bm.created_at >= NOW() - INTERVAL '1 day' * $2
       GROUP BY DATE(bm.created_at)
       ORDER BY date ASC`,
      [orgId, days]
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

    // Get message count per bot - last 30 days
    const result = await db.query(
      `SELECT
         b.id,
         b.name,
         COUNT(bm.id) as message_count
       FROM bots b
       LEFT JOIN bot_messages bm ON bm.bot_id = b.id
         AND bm.created_at >= NOW() - INTERVAL '30 days'
       WHERE b.organization_id = $1
       GROUP BY b.id, b.name
       ORDER BY message_count DESC
       LIMIT 50`,
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
        content: (row.content || '').substring(0, 100), // Truncate content with null check
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

/**
 * GET /api/analytics/hourly-activity
 * Get message counts grouped by hour of day (for 24-hour activity chart)
 */
router.get('/hourly-activity', async (req, res) => {
  try {
    const orgId = req.organization.id;
    // SECURITY FIX: Use parameterized interval to prevent SQL injection
    const days = parseInt(req.query.days, 10) || 7;

    const result = await db.query(
      `SELECT
         EXTRACT(HOUR FROM bm.created_at) as hour,
         COUNT(*) as count
       FROM bot_messages bm
       JOIN bots b ON b.id = bm.bot_id
       WHERE b.organization_id = $1
         AND bm.created_at >= NOW() - INTERVAL '1 day' * $2
       GROUP BY EXTRACT(HOUR FROM bm.created_at)
       ORDER BY hour ASC`,
      [orgId, days]
    );

    // Fill in missing hours with 0
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: 0
    }));

    result.rows.forEach(row => {
      hourlyData[parseInt(row.hour)].count = parseInt(row.count);
    });

    res.json({
      success: true,
      data: hourlyData
    });
  } catch (error) {
    log.error('[ANALYTICS] Error fetching hourly activity:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hourly activity'
    });
  }
});

/**
 * GET /api/analytics/top-questions
 * Get most common user messages/questions
 */
router.get('/top-questions', async (req, res) => {
  try {
    const orgId = req.organization.id;
    const limit = parseInt(req.query.limit) || 10;

    // Last 30 days filter for performance
    const result = await db.query(
      `SELECT
         bm.content,
         COUNT(*) as count,
         MAX(bm.created_at) as last_asked
       FROM bot_messages bm
       JOIN bots b ON b.id = bm.bot_id
       WHERE b.organization_id = $1
         AND bm.message_type = 'user_message'
         AND LENGTH(bm.content) > 5
         AND bm.created_at >= NOW() - INTERVAL '30 days'
       GROUP BY bm.content
       ORDER BY count DESC
       LIMIT $2`,
      [orgId, limit]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        question: (row.content || '').substring(0, 200),
        count: parseInt(row.count),
        lastAsked: row.last_asked
      }))
    });
  } catch (error) {
    log.error('[ANALYTICS] Error fetching top questions:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top questions'
    });
  }
});

/**
 * GET /api/analytics/response-metrics
 * Get response time and success rate metrics
 */
router.get('/response-metrics', async (req, res) => {
  try {
    const orgId = req.organization.id;

    // Get message type breakdown for success/fallback rate - last 30 days
    const typeResult = await db.query(
      `SELECT
         message_type,
         COUNT(*) as count
       FROM bot_messages bm
       JOIN bots b ON b.id = bm.bot_id
       WHERE b.organization_id = $1
         AND bm.message_type IN ('response', 'fallback', 'greeting', 'user_message')
         AND bm.created_at >= NOW() - INTERVAL '30 days'
       GROUP BY message_type`,
      [orgId]
    );

    const typeCounts = {};
    typeResult.rows.forEach(row => {
      typeCounts[row.message_type] = parseInt(row.count);
    });

    const totalBotResponses = (typeCounts.response || 0) + (typeCounts.fallback || 0) + (typeCounts.greeting || 0);
    const successRate = totalBotResponses > 0
      ? ((typeCounts.response || 0) + (typeCounts.greeting || 0)) / totalBotResponses * 100
      : 100;

    // Get unique sessions count - last 30 days
    const sessionsResult = await db.query(
      `SELECT COUNT(DISTINCT session_id) as sessions
       FROM bot_messages bm
       JOIN bots b ON b.id = bm.bot_id
       WHERE b.organization_id = $1
         AND bm.session_id IS NOT NULL
         AND bm.created_at >= NOW() - INTERVAL '30 days'`,
      [orgId]
    );

    res.json({
      success: true,
      data: {
        successRate: Math.round(successRate * 100) / 100,
        fallbackRate: Math.round((100 - successRate) * 100) / 100,
        totalResponses: totalBotResponses,
        totalUserMessages: typeCounts.user_message || 0,
        uniqueSessions: parseInt(sessionsResult.rows[0]?.sessions) || 0,
        messageTypes: typeCounts
      }
    });
  } catch (error) {
    log.error('[ANALYTICS] Error fetching response metrics:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch response metrics'
    });
  }
});

/**
 * GET /api/analytics/user-sessions
 * Get session analytics with message counts
 */
router.get('/user-sessions', async (req, res) => {
  try {
    const orgId = req.organization.id;
    const limit = parseInt(req.query.limit) || 20;

    // Last 30 days filter for performance
    const result = await db.query(
      `SELECT
         bm.session_id,
         b.name as bot_name,
         COUNT(*) as message_count,
         MIN(bm.created_at) as started_at,
         MAX(bm.created_at) as last_activity
       FROM bot_messages bm
       JOIN bots b ON b.id = bm.bot_id
       WHERE b.organization_id = $1
         AND bm.session_id IS NOT NULL
         AND bm.created_at >= NOW() - INTERVAL '30 days'
       GROUP BY bm.session_id, b.name
       ORDER BY last_activity DESC
       LIMIT $2`,
      [orgId, limit]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        sessionId: row.session_id,
        botName: row.bot_name,
        messageCount: parseInt(row.message_count),
        startedAt: row.started_at,
        lastActivity: row.last_activity,
        duration: new Date(row.last_activity) - new Date(row.started_at)
      }))
    });
  } catch (error) {
    log.error('[ANALYTICS] Error fetching user sessions:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user sessions'
    });
  }
});

/**
 * GET /api/analytics/export
 * Export analytics data as CSV
 */
router.get('/export', async (req, res) => {
  try {
    const orgId = req.organization.id;
    const type = req.query.type || 'messages';
    const days = parseInt(req.query.days) || 30;

    let data = [];
    let filename = '';

    if (type === 'messages') {
      const result = await db.query(
        `SELECT
           bm.id,
           b.name as bot_name,
           bm.message_type,
           bm.content,
           bm.session_id,
           bm.created_at
         FROM bot_messages bm
         JOIN bots b ON b.id = bm.bot_id
         WHERE b.organization_id = $1
           AND bm.created_at >= NOW() - INTERVAL '1 day' * $2
         ORDER BY bm.created_at DESC`,
        [orgId, days]
      );
      data = result.rows;
      filename = `messages_export_${new Date().toISOString().split('T')[0]}.csv`;
    } else if (type === 'daily') {
      const result = await db.query(
        `SELECT
           DATE(bm.created_at) as date,
           COUNT(*) as total_messages,
           COUNT(DISTINCT bm.session_id) as unique_sessions,
           COUNT(CASE WHEN bm.message_type = 'user_message' THEN 1 END) as user_messages,
           COUNT(CASE WHEN bm.message_type = 'response' THEN 1 END) as bot_responses,
           COUNT(CASE WHEN bm.message_type = 'fallback' THEN 1 END) as fallbacks
         FROM bot_messages bm
         JOIN bots b ON b.id = bm.bot_id
         WHERE b.organization_id = $1
           AND bm.created_at >= NOW() - INTERVAL '1 day' * $2
         GROUP BY DATE(bm.created_at)
         ORDER BY date DESC`,
        [orgId, days]
      );
      data = result.rows;
      filename = `daily_stats_export_${new Date().toISOString().split('T')[0]}.csv`;
    }

    // Convert to CSV
    if (data.length === 0) {
      return res.status(404).json({ success: false, message: 'No data to export' });
    }

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row =>
      Object.values(row).map(val =>
        typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
      ).join(',')
    );
    const csv = [headers, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    log.error('[ANALYTICS] Error exporting data:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to export data'
    });
  }
});

/**
 * GET /api/analytics/comprehensive
 * Get all analytics data in one request (for dashboard)
 */
router.get('/comprehensive', async (req, res) => {
  try {
    const orgId = req.organization.id;
    // SECURITY FIX: Use parameterized interval to prevent SQL injection
    const days = parseInt(req.query.days, 10) || 30;
    const botId = req.query.botId; // Optional filter

    // Build params array with days as the last parameter for interval
    const botFilter = botId ? 'AND b.id = $2' : '';
    const daysParamIndex = botId ? 3 : 2;
    const params = botId ? [orgId, botId, days] : [orgId, days];

    // Overview stats - use LEFT JOIN to handle case with no messages
    const overviewResult = await db.query(
      `SELECT
         COUNT(bm.id) as total_messages,
         COUNT(DISTINCT bm.session_id) as total_sessions,
         COUNT(DISTINCT CASE WHEN bm.id IS NOT NULL THEN b.id END) as active_bots
       FROM bots b
       LEFT JOIN bot_messages bm ON bm.bot_id = b.id
         AND bm.created_at >= NOW() - INTERVAL '1 day' * $${daysParamIndex}
       WHERE b.organization_id = $1
         ${botFilter}`,
      params
    );

    // Daily trend - use LEFT JOIN and handle empty results
    const dailyResult = await db.query(
      `SELECT
         DATE(bm.created_at) as date,
         COUNT(bm.id) as count
       FROM bots b
       LEFT JOIN bot_messages bm ON bm.bot_id = b.id
         AND bm.created_at >= NOW() - INTERVAL '1 day' * $${daysParamIndex}
       WHERE b.organization_id = $1
         ${botFilter}
         AND bm.id IS NOT NULL
       GROUP BY DATE(bm.created_at)
       ORDER BY date ASC`,
      params
    );

    // Fill missing dates
    const dailyData = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      // Handle both Date objects and string dates from PostgreSQL
      const found = dailyResult.rows.find(r => {
        const rowDate = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0];
        return rowDate === dateStr;
      });
      dailyData.push({
        date: dateStr,
        count: found ? parseInt(found.count) : 0
      });
    }

    // Hourly distribution - use LEFT JOIN
    const hourlyResult = await db.query(
      `SELECT
         EXTRACT(HOUR FROM bm.created_at) as hour,
         COUNT(bm.id) as count
       FROM bots b
       LEFT JOIN bot_messages bm ON bm.bot_id = b.id
         AND bm.created_at >= NOW() - INTERVAL '1 day' * $${daysParamIndex}
       WHERE b.organization_id = $1
         ${botFilter}
         AND bm.id IS NOT NULL
       GROUP BY EXTRACT(HOUR FROM bm.created_at)
       ORDER BY hour`,
      params
    );

    const hourlyData = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
    hourlyResult.rows.forEach(row => {
      hourlyData[parseInt(row.hour)].count = parseInt(row.count);
    });

    // Message type distribution - use LEFT JOIN
    const typeResult = await db.query(
      `SELECT
         bm.message_type,
         COUNT(bm.id) as count
       FROM bots b
       LEFT JOIN bot_messages bm ON bm.bot_id = b.id
         AND bm.created_at >= NOW() - INTERVAL '1 day' * $${daysParamIndex}
       WHERE b.organization_id = $1
         ${botFilter}
         AND bm.id IS NOT NULL
       GROUP BY bm.message_type`,
      params
    );

    // Per-bot stats
    const botStatsResult = await db.query(
      `SELECT
         b.id,
         b.name,
         COUNT(bm.id) as message_count,
         COUNT(DISTINCT bm.session_id) as session_count
       FROM bots b
       LEFT JOIN bot_messages bm ON bm.bot_id = b.id
         AND bm.created_at >= NOW() - INTERVAL '1 day' * $2
       WHERE b.organization_id = $1
       GROUP BY b.id, b.name
       ORDER BY message_count DESC`,
      [orgId, days]
    );

    res.json({
      success: true,
      data: {
        overview: {
          totalMessages: parseInt(overviewResult.rows[0]?.total_messages) || 0,
          totalSessions: parseInt(overviewResult.rows[0]?.total_sessions) || 0,
          activeBots: parseInt(overviewResult.rows[0]?.active_bots) || 0
        },
        dailyTrend: dailyData,
        hourlyDistribution: hourlyData,
        messageTypes: typeResult.rows.map(r => ({
          type: r.message_type,
          count: parseInt(r.count)
        })),
        botStats: botStatsResult.rows.map(r => ({
          id: r.id,
          name: r.name,
          messageCount: parseInt(r.message_count),
          sessionCount: parseInt(r.session_count)
        }))
      }
    });
  } catch (error) {
    log.error('[ANALYTICS] Error fetching comprehensive data:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comprehensive analytics'
    });
  }
});

module.exports = router;
