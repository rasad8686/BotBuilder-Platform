const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');

// GET USAGE STATS FOR USER
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const { period = '30days' } = req.query;

    let interval = '30 days';
    if (period === '7days') interval = '7 days';
    if (period === '24hours') interval = '1 day';
    if (period === '90days') interval = '90 days';

    // Get total usage by metric type
    const usageResult = await pool.query(`
      SELECT
        metric_type,
        SUM(count) as total_count
      FROM usage_tracking
      WHERE user_id = $1
      AND tracked_at >= NOW() - INTERVAL '${interval}'
      GROUP BY metric_type
    `, [req.user.userId]);

    // Get usage over time (daily)
    const timelineResult = await pool.query(`
      SELECT
        DATE_TRUNC('day', tracked_at) as date,
        metric_type,
        SUM(count) as count
      FROM usage_tracking
      WHERE user_id = $1
      AND tracked_at >= NOW() - INTERVAL '${interval}'
      GROUP BY DATE_TRUNC('day', tracked_at), metric_type
      ORDER BY date DESC
    `, [req.user.userId]);

    // Get current subscription limits
    const limitsResult = await pool.query(`
      SELECT
        sp.max_bots,
        sp.max_messages_per_month,
        sp.name as plan_name,
        sp.display_name as plan_display_name
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.user_id = $1 AND us.status = 'active'
    `, [req.user.userId]);

    const limits = limitsResult.rows[0] || { max_bots: 1, max_messages_per_month: 1000 };

    // Get current counts
    const currentBotsResult = await pool.query(
      'SELECT COUNT(*) as count FROM bots WHERE user_id = $1',
      [req.user.userId]
    );

    const currentMessagesResult = await pool.query(`
      SELECT COALESCE(SUM(count), 0) as count
      FROM usage_tracking
      WHERE user_id = $1
      AND metric_type IN ('message_sent', 'message_received')
      AND tracked_at >= DATE_TRUNC('month', CURRENT_DATE)
    `, [req.user.userId]);

    res.json({
      usage: usageResult.rows,
      timeline: timelineResult.rows,
      limits: {
        ...limits,
        current_bots: parseInt(currentBotsResult.rows[0].count),
        current_messages: parseInt(currentMessagesResult.rows[0].count),
        bots_percentage: limits.max_bots === -1 ? 0 : (parseInt(currentBotsResult.rows[0].count) / limits.max_bots) * 100,
        messages_percentage: limits.max_messages_per_month === -1 ? 0 : (parseInt(currentMessagesResult.rows[0].count) / limits.max_messages_per_month) * 100
      }
    });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    res.status(500).json({ error: 'Failed to fetch usage stats' });
  }
});

// GET BOT-SPECIFIC ANALYTICS
router.get('/bot/:botId', authenticateToken, async (req, res) => {
  try {
    // Verify bot ownership
    const botCheck = await pool.query(
      'SELECT * FROM bots WHERE id = $1 AND user_id = $2',
      [req.params.botId, req.user.userId]
    );

    if (botCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const bot = botCheck.rows[0];

    // Get message statistics
    const messageStatsResult = await pool.query(`
      SELECT
        DATE_TRUNC('day', tracked_at) as date,
        metric_type,
        SUM(count) as count
      FROM usage_tracking
      WHERE bot_id = $1
      AND tracked_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', tracked_at), metric_type
      ORDER BY date DESC
    `, [req.params.botId]);

    // Get total counts
    const totalsResult = await pool.query(`
      SELECT
        metric_type,
        SUM(count) as total
      FROM usage_tracking
      WHERE bot_id = $1
      GROUP BY metric_type
    `, [req.params.botId]);

    // Get recent webhook calls
    const webhooksResult = await pool.query(`
      SELECT
        webhook_url,
        response_status,
        response_time_ms,
        created_at
      FROM webhook_logs
      WHERE bot_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [req.params.botId]);

    res.json({
      bot: {
        id: bot.id,
        name: bot.name,
        platform: bot.platform,
        total_messages_sent: bot.total_messages_sent,
        total_messages_received: bot.total_messages_received,
        monthly_message_count: bot.monthly_message_count,
        last_webhook_call: bot.last_webhook_call
      },
      messageStats: messageStatsResult.rows,
      totals: totalsResult.rows,
      recentWebhooks: webhooksResult.rows
    });
  } catch (error) {
    console.error('Error fetching bot analytics:', error);
    res.status(500).json({ error: 'Failed to fetch bot analytics' });
  }
});

// GET DASHBOARD SUMMARY
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    // Get total bots
    const botsResult = await pool.query(
      'SELECT COUNT(*) as count FROM bots WHERE user_id = $1',
      [req.user.userId]
    );

    // Get message counts this month
    const messagesResult = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN metric_type = 'message_sent' THEN count ELSE 0 END), 0) as sent,
        COALESCE(SUM(CASE WHEN metric_type = 'message_received' THEN count ELSE 0 END), 0) as received
      FROM usage_tracking
      WHERE user_id = $1
      AND tracked_at >= DATE_TRUNC('month', CURRENT_DATE)
    `, [req.user.userId]);

    // Get API call count
    const apiCallsResult = await pool.query(`
      SELECT COALESCE(SUM(count), 0) as count
      FROM usage_tracking
      WHERE user_id = $1
      AND metric_type = 'api_call'
      AND tracked_at >= DATE_TRUNC('month', CURRENT_DATE)
    `, [req.user.userId]);

    // Get subscription info
    const subscriptionResult = await pool.query(`
      SELECT
        sp.name as plan_name,
        sp.display_name,
        sp.max_bots,
        sp.max_messages_per_month
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.user_id = $1 AND us.status = 'active'
    `, [req.user.userId]);

    const subscription = subscriptionResult.rows[0] || { plan_name: 'free', max_bots: 1, max_messages_per_month: 1000 };
    const totalBots = parseInt(botsResult.rows[0].count);
    const messagesSent = parseInt(messagesResult.rows[0].sent);
    const messagesReceived = parseInt(messagesResult.rows[0].received);
    const totalMessages = messagesSent + messagesReceived;

    res.json({
      bots: {
        total: totalBots,
        limit: subscription.max_bots,
        percentage: subscription.max_bots === -1 ? 0 : (totalBots / subscription.max_bots) * 100,
        canCreateMore: subscription.max_bots === -1 || totalBots < subscription.max_bots
      },
      messages: {
        sent: messagesSent,
        received: messagesReceived,
        total: totalMessages,
        limit: subscription.max_messages_per_month,
        percentage: subscription.max_messages_per_month === -1 ? 0 : (totalMessages / subscription.max_messages_per_month) * 100
      },
      apiCalls: {
        total: parseInt(apiCallsResult.rows[0].count)
      },
      subscription: subscription
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

module.exports = router;
