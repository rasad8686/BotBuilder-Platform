const db = require('../db');
const log = require('../utils/logger');

/**
 * Message Limit Middleware
 * Checks if organization has reached message limit based on subscription plan
 */
async function checkMessageLimit(req, res, next) {
  try {
    const organizationId = req.organization?.id;

    if (!organizationId) {
      // If no organization context, skip the check (shouldn't happen with requireOrganization middleware)
      return next();
    }

    // Get organization's subscription plan
    const planResult = await db.query(
      `SELECT o.plan_tier, sp.max_messages_per_month
       FROM organizations o
       LEFT JOIN subscription_plans sp ON sp.name = o.plan_tier
       WHERE o.id = $1`,
      [organizationId]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    const { plan_tier, max_messages_per_month } = planResult.rows[0];

    // If unlimited messages (-1) or no limit set, allow
    if (!max_messages_per_month || max_messages_per_month === -1) {
      return next();
    }

    // Count messages this month for this organization
    const messageCountResult = await db.query(
      `SELECT COUNT(*) as count
       FROM bot_messages
       WHERE organization_id = $1
         AND created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP)`,
      [organizationId]
    );

    const currentCount = parseInt(messageCountResult.rows[0].count);

    // Check if limit exceeded
    if (currentCount >= max_messages_per_month) {
      return res.status(429).json({
        success: false,
        message: 'Monthly message limit exceeded. Please upgrade your plan.',
        details: {
          current: currentCount,
          limit: max_messages_per_month,
          plan: plan_tier
        }
      });
    }

    // Add message count info to request for potential logging
    req.messageUsage = {
      current: currentCount,
      limit: max_messages_per_month,
      remaining: max_messages_per_month - currentCount
    };

    next();
  } catch (error) {
    log.error('Error checking message limit', { error: error.message });
    // On error, allow the request to continue (fail open)
    next();
  }
}

module.exports = { checkMessageLimit };
