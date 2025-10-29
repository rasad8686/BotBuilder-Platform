const pool = require('../db');
const { sendUsageLimitWarning } = require('../services/emailService');

// Check if user can create more bots
async function checkBotLimit(req, res, next) {
  try {
    // Get user's subscription
    const subResult = await pool.query(`
      SELECT sp.max_bots, sp.name as plan_name
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.user_id = $1 AND us.status = 'active'
    `, [req.user.userId]);

    if (subResult.rows.length === 0) {
      return res.status(403).json({
        error: 'No active subscription',
        upgrade: true
      });
    }

    const { max_bots, plan_name } = subResult.rows[0];

    // If unlimited (-1), allow
    if (max_bots === -1) {
      return next();
    }

    // Get current bot count
    const botCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM bots WHERE user_id = $1',
      [req.user.userId]
    );

    const currentCount = parseInt(botCountResult.rows[0].count);

    if (currentCount >= max_bots) {
      return res.status(403).json({
        error: `Bot limit reached. Your ${plan_name} plan allows ${max_bots} bot(s).`,
        currentCount: currentCount,
        limit: max_bots,
        upgrade: true
      });
    }

    next();
  } catch (error) {
    console.error('Error checking bot limit:', error);
    res.status(500).json({ error: 'Failed to check bot limit' });
  }
}

// Check if user has exceeded message limit
async function checkMessageLimit(req, res, next) {
  try {
    // Get user's subscription
    const subResult = await pool.query(`
      SELECT sp.max_messages_per_month, sp.name as plan_name
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.user_id = $1 AND us.status = 'active'
    `, [req.user.userId]);

    if (subResult.rows.length === 0) {
      return res.status(403).json({
        error: 'No active subscription',
        upgrade: true
      });
    }

    const { max_messages_per_month, plan_name } = subResult.rows[0];

    // If unlimited (-1), allow
    if (max_messages_per_month === -1) {
      return next();
    }

    // Get current month message count
    const messageCountResult = await pool.query(`
      SELECT COALESCE(SUM(count), 0) as count
      FROM usage_tracking
      WHERE user_id = $1
      AND metric_type IN ('message_sent', 'message_received')
      AND tracked_at >= DATE_TRUNC('month', CURRENT_DATE)
    `, [req.user.userId]);

    const currentCount = parseInt(messageCountResult.rows[0].count);

    if (currentCount >= max_messages_per_month) {
      return res.status(429).json({
        error: `Message limit reached. Your ${plan_name} plan allows ${max_messages_per_month} messages per month.`,
        currentCount: currentCount,
        limit: max_messages_per_month,
        upgrade: true
      });
    }

    // Send warning at 80% usage
    if (currentCount >= max_messages_per_month * 0.8 && currentCount < max_messages_per_month * 0.81) {
      await sendUsageLimitWarning(req.user.userId, currentCount, max_messages_per_month);
    }

    next();
  } catch (error) {
    console.error('Error checking message limit:', error);
    res.status(500).json({ error: 'Failed to check message limit' });
  }
}

// Track API usage
async function trackApiUsage(req, res, next) {
  try {
    if (req.user && req.user.userId) {
      await pool.query(`
        INSERT INTO usage_tracking (user_id, metric_type, count, metadata)
        VALUES ($1, 'api_call', 1, $2)
      `, [
        req.user.userId,
        {
          endpoint: req.path,
          method: req.method,
          ip: req.ip
        }
      ]);
    }
    next();
  } catch (error) {
    console.error('Error tracking API usage:', error);
    // Don't block the request if tracking fails
    next();
  }
}

// Reset monthly message count (run monthly via cron)
async function resetMonthlyUsage() {
  try {
    // Reset monthly_message_count for all bots
    await pool.query(`
      UPDATE bots
      SET monthly_message_count = 0,
          last_message_reset = NOW()
      WHERE last_message_reset < DATE_TRUNC('month', CURRENT_DATE)
    `);

    console.log('✅ Monthly usage reset completed');
  } catch (error) {
    console.error('❌ Error resetting monthly usage:', error);
  }
}

module.exports = {
  checkBotLimit,
  checkMessageLimit,
  trackApiUsage,
  resetMonthlyUsage
};
