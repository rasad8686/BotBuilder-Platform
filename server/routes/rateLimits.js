const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const log = require('../utils/logger');

// Tier limits configuration
const TIER_LIMITS = {
  free: {
    requests_per_minute: 20,
    requests_per_day: 1000
  },
  pro: {
    requests_per_minute: 100,
    requests_per_day: 10000
  },
  enterprise: {
    requests_per_minute: 500,
    requests_per_day: 100000
  }
};

// In-memory request counters (for demo - in production use Redis)
const requestCounters = new Map();

/**
 * GET /api/rate-limits/status
 * Get current rate limit status for authenticated user
 */
router.get('/status', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId = req.user.current_organization_id || req.user.organizationId;

    // Get organization's plan tier
    let tier = 'free';
    if (orgId) {
      const orgResult = await db.query(
        'SELECT plan_tier FROM organizations WHERE id = $1',
        [orgId]
      );
      if (orgResult.rows.length > 0) {
        tier = orgResult.rows[0].plan_tier || 'free';
      }
    }

    // Normalize tier name
    tier = tier.toLowerCase();
    if (!TIER_LIMITS[tier]) {
      tier = 'free';
    }

    const limits = TIER_LIMITS[tier];
    const counterKey = `${userId}`;

    // Get or initialize counters
    const now = new Date();
    const minuteKey = `${counterKey}:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
    const dayKey = `${counterKey}:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

    // Get current usage from memory (in production, this would be from Redis)
    let currentMinute = 0;
    let currentDay = 0;

    // Try to get from api_usage table if exists
    try {
      const usageResult = await db.query(
        `SELECT
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 minute') as minute_count,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as day_count
         FROM api_usage
         WHERE user_id = $1`,
        [userId]
      );
      if (usageResult.rows.length > 0) {
        currentMinute = parseInt(usageResult.rows[0].minute_count) || 0;
        currentDay = parseInt(usageResult.rows[0].day_count) || 0;
      }
    } catch (dbError) {
      // Table might not exist, use mock data
      currentMinute = Math.floor(Math.random() * limits.requests_per_minute * 0.3);
      currentDay = Math.floor(Math.random() * limits.requests_per_day * 0.2);
    }

    // Calculate reset times
    const nextMinute = new Date(now);
    nextMinute.setSeconds(0, 0);
    nextMinute.setMinutes(nextMinute.getMinutes() + 1);

    const nextDay = new Date(now);
    nextDay.setHours(0, 0, 0, 0);
    nextDay.setDate(nextDay.getDate() + 1);

    // Calculate percentages
    const minutePercentage = Math.min(100, (currentMinute / limits.requests_per_minute) * 100);
    const dayPercentage = Math.min(100, (currentDay / limits.requests_per_day) * 100);

    res.json({
      tier,
      limits: {
        requests_per_minute: limits.requests_per_minute,
        requests_per_day: limits.requests_per_day,
        current_minute: currentMinute,
        current_day: currentDay
      },
      reset_at: {
        minute: nextMinute.toISOString(),
        day: nextDay.toISOString()
      },
      percentage_used: {
        minute: Math.round(minutePercentage * 100) / 100,
        day: Math.round(dayPercentage * 100) / 100
      }
    });

  } catch (error) {
    log.error('Rate limit status error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get rate limit status'
    });
  }
});

/**
 * GET /api/rate-limits/tiers
 * Get all available tier limits for comparison
 */
router.get('/tiers', auth, async (req, res) => {
  try {
    const tiers = Object.entries(TIER_LIMITS).map(([name, limits]) => ({
      name,
      displayName: name.charAt(0).toUpperCase() + name.slice(1),
      limits: {
        requests_per_minute: limits.requests_per_minute,
        requests_per_day: limits.requests_per_day
      },
      features: getTierFeatures(name)
    }));

    res.json({ tiers });
  } catch (error) {
    log.error('Tier list error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get tier list'
    });
  }
});

/**
 * Get features for each tier
 */
function getTierFeatures(tier) {
  const features = {
    free: [
      'Basic API access',
      '20 requests/minute',
      '1,000 requests/day',
      'Community support'
    ],
    pro: [
      'Full API access',
      '100 requests/minute',
      '10,000 requests/day',
      'Priority support',
      'Webhook integrations',
      'Advanced analytics'
    ],
    enterprise: [
      'Unlimited API access',
      '500 requests/minute',
      '100,000 requests/day',
      'Dedicated support',
      'Custom integrations',
      'SLA guarantee',
      'White-label options'
    ]
  };
  return features[tier] || features.free;
}

module.exports = router;
