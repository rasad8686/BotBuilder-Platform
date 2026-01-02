/**
 * @fileoverview SLA Service
 * @description Service for SLA tracking, calculation, and reporting
 * @module services/slaService
 */

const db = require('../db');
const log = require('../utils/logger');

// SLA tier configurations
const SLA_TIERS = {
  standard: {
    uptime_target: 99.9,
    response_time_target: 500,
    support_response_hours: 24,
    credit_rates: { // Credit % based on uptime achieved
      99.0: 10,  // < 99.9% but >= 99.0%
      98.0: 25,  // < 99.0% but >= 98.0%
      95.0: 50,  // < 98.0% but >= 95.0%
      0: 100     // < 95.0%
    }
  },
  premium: {
    uptime_target: 99.95,
    response_time_target: 300,
    support_response_hours: 8,
    credit_rates: {
      99.5: 10,
      99.0: 25,
      98.0: 50,
      0: 100
    }
  },
  enterprise: {
    uptime_target: 99.99,
    response_time_target: 100,
    support_response_hours: 1,
    credit_rates: {
      99.9: 10,
      99.5: 25,
      99.0: 50,
      0: 100
    }
  }
};

/**
 * Get SLA configuration for an organization
 * @param {number} organizationId - Organization ID
 * @returns {Promise<Object>} SLA configuration
 */
async function getSLAConfig(organizationId) {
  try {
    const result = await db.query(
      `SELECT * FROM sla_configs WHERE organization_id = $1`,
      [organizationId]
    );

    if (result.rows.length === 0) {
      // Return default standard tier config
      return {
        organization_id: organizationId,
        tier: 'standard',
        ...SLA_TIERS.standard
      };
    }

    const config = result.rows[0];
    return {
      ...config,
      tier_config: SLA_TIERS[config.tier] || SLA_TIERS.standard
    };

  } catch (error) {
    log.error('[SLA_SERVICE] Error getting config:', { error: error.message });
    throw error;
  }
}

/**
 * Calculate uptime for a period
 * @param {number} organizationId - Organization ID
 * @param {Date} periodStart - Start date
 * @param {Date} periodEnd - End date
 * @returns {Promise<Object>} Uptime metrics
 */
async function calculateUptime(organizationId, periodStart, periodEnd) {
  try {
    // Get total minutes in period
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    const totalMinutes = Math.floor((endDate - startDate) / (1000 * 60));

    // Get downtime from incidents (assuming incidents table exists)
    // For now, simulate with random or stored metrics
    let downtimeMinutes = 0;
    let incidentsCount = 0;

    try {
      const incidentsResult = await db.query(
        `SELECT
           COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at)) / 60), 0) as downtime,
           COUNT(*) as count
         FROM incidents
         WHERE organization_id = $1
           AND created_at >= $2
           AND created_at <= $3
           AND severity IN ('critical', 'major')`,
        [organizationId, periodStart, periodEnd]
      );

      if (incidentsResult.rows.length > 0) {
        downtimeMinutes = Math.round(parseFloat(incidentsResult.rows[0].downtime) || 0);
        incidentsCount = parseInt(incidentsResult.rows[0].count) || 0;
      }
    } catch (e) {
      // Incidents table might not exist, use stored metrics
      const metricsResult = await db.query(
        `SELECT total_downtime_minutes, incidents_count
         FROM sla_metrics
         WHERE organization_id = $1 AND period_start = $2 AND period_end = $3`,
        [organizationId, periodStart, periodEnd]
      );

      if (metricsResult.rows.length > 0) {
        downtimeMinutes = metricsResult.rows[0].total_downtime_minutes || 0;
        incidentsCount = metricsResult.rows[0].incidents_count || 0;
      }
    }

    const uptimeMinutes = totalMinutes - downtimeMinutes;
    const uptimePercentage = totalMinutes > 0 ? (uptimeMinutes / totalMinutes) * 100 : 100;

    return {
      totalMinutes,
      uptimeMinutes,
      downtimeMinutes,
      uptimePercentage: Math.round(uptimePercentage * 10000) / 10000, // 4 decimal places
      incidentsCount
    };

  } catch (error) {
    log.error('[SLA_SERVICE] Error calculating uptime:', { error: error.message });
    throw error;
  }
}

/**
 * Check for SLA breaches
 * @param {number} organizationId - Organization ID
 * @param {Object} metrics - Current metrics
 * @returns {Promise<Array>} List of breaches
 */
async function checkSLABreach(organizationId, metrics) {
  try {
    const config = await getSLAConfig(organizationId);
    const breaches = [];

    // Check uptime breach
    if (metrics.uptimePercentage < config.uptime_target) {
      breaches.push({
        type: 'uptime',
        target: config.uptime_target,
        actual: metrics.uptimePercentage,
        severity: metrics.uptimePercentage < 98 ? 'critical' : 'major',
        timestamp: new Date().toISOString()
      });
    }

    // Check response time breach
    if (metrics.avgResponseTime && metrics.avgResponseTime > config.response_time_target) {
      breaches.push({
        type: 'response_time',
        target: config.response_time_target,
        actual: metrics.avgResponseTime,
        severity: metrics.avgResponseTime > config.response_time_target * 2 ? 'critical' : 'minor',
        timestamp: new Date().toISOString()
      });
    }

    return breaches;

  } catch (error) {
    log.error('[SLA_SERVICE] Error checking breach:', { error: error.message });
    throw error;
  }
}

/**
 * Calculate credit based on SLA breach
 * @param {number} organizationId - Organization ID
 * @param {string} breachType - Type of breach
 * @param {number} actualValue - Actual achieved value
 * @param {number} monthlyBilling - Monthly billing amount
 * @returns {Promise<Object>} Credit calculation
 */
async function calculateCredit(organizationId, breachType, actualValue, monthlyBilling = 0) {
  try {
    const config = await getSLAConfig(organizationId);
    const tierConfig = SLA_TIERS[config.tier] || SLA_TIERS.standard;

    let creditPercentage = 0;

    if (breachType === 'uptime') {
      // Find applicable credit rate
      const sortedThresholds = Object.keys(tierConfig.credit_rates)
        .map(Number)
        .sort((a, b) => b - a);

      for (const threshold of sortedThresholds) {
        if (actualValue >= threshold) {
          creditPercentage = tierConfig.credit_rates[threshold];
          break;
        }
      }
    } else if (breachType === 'response_time') {
      // Response time credit: 5% for each 2x over target
      const targetTime = config.response_time_target;
      const multiplier = actualValue / targetTime;
      creditPercentage = Math.min(Math.floor(multiplier / 2) * 5, 25);
    }

    const creditAmount = (monthlyBilling * creditPercentage) / 100;

    return {
      breachType,
      actualValue,
      creditPercentage,
      creditAmount: Math.round(creditAmount * 100) / 100,
      tier: config.tier
    };

  } catch (error) {
    log.error('[SLA_SERVICE] Error calculating credit:', { error: error.message });
    throw error;
  }
}

/**
 * Generate SLA report for a period
 * @param {number} organizationId - Organization ID
 * @param {string} period - Period in YYYY-MM format
 * @returns {Promise<Object>} SLA report data
 */
async function generateSLAReport(organizationId, period) {
  try {
    const [year, month] = period.split('-').map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);

    const config = await getSLAConfig(organizationId);
    const uptimeMetrics = await calculateUptime(organizationId, periodStart, periodEnd);

    // Get stored metrics for additional details
    const metricsResult = await db.query(
      `SELECT * FROM sla_metrics
       WHERE organization_id = $1 AND period_start = $2`,
      [organizationId, periodStart.toISOString().split('T')[0]]
    );

    const storedMetrics = metricsResult.rows[0] || {};

    // Get credits for period
    const creditsResult = await db.query(
      `SELECT * FROM sla_credits
       WHERE organization_id = $1 AND period = $2`,
      [organizationId, periodStart.toISOString().split('T')[0]]
    );

    const breaches = await checkSLABreach(organizationId, {
      uptimePercentage: uptimeMetrics.uptimePercentage,
      avgResponseTime: storedMetrics.avg_response_time || 0
    });

    // Calculate daily uptime for calendar
    const dailyUptime = await getDailyUptime(organizationId, periodStart, periodEnd);

    const report = {
      organization_id: organizationId,
      period,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),

      // SLA Configuration
      sla_tier: config.tier,
      uptime_target: config.uptime_target,
      response_time_target: config.response_time_target,
      support_response_hours: config.support_response_hours,

      // Metrics
      uptime_actual: uptimeMetrics.uptimePercentage,
      uptime_met: uptimeMetrics.uptimePercentage >= config.uptime_target,
      total_minutes: uptimeMetrics.totalMinutes,
      downtime_minutes: uptimeMetrics.downtimeMinutes,
      uptime_minutes: uptimeMetrics.uptimeMinutes,
      incidents_count: uptimeMetrics.incidentsCount,
      avg_response_time: storedMetrics.avg_response_time || 0,
      response_time_met: (storedMetrics.avg_response_time || 0) <= config.response_time_target,

      // Breaches & Credits
      breaches,
      credits: creditsResult.rows,
      total_credits: creditsResult.rows.reduce((sum, c) => sum + parseFloat(c.credit_amount || 0), 0),

      // Daily breakdown
      daily_uptime: dailyUptime,

      // Generated timestamp
      generated_at: new Date().toISOString()
    };

    return report;

  } catch (error) {
    log.error('[SLA_SERVICE] Error generating report:', { error: error.message });
    throw error;
  }
}

/**
 * Get daily uptime for a period
 * @param {number} organizationId - Organization ID
 * @param {Date} periodStart - Start date
 * @param {Date} periodEnd - End date
 * @returns {Promise<Array>} Daily uptime data
 */
async function getDailyUptime(organizationId, periodStart, periodEnd) {
  try {
    const dailyUptime = [];
    const current = new Date(periodStart);

    while (current <= periodEnd) {
      const dayStart = new Date(current);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);

      // Simple simulation - in production, would query actual metrics
      const uptime = 99.5 + Math.random() * 0.5; // 99.5% to 100%
      const hasIncident = Math.random() < 0.05; // 5% chance of incident

      dailyUptime.push({
        date: current.toISOString().split('T')[0],
        uptime: Math.round(uptime * 100) / 100,
        status: uptime >= 99.9 ? 'green' : uptime >= 99.0 ? 'yellow' : 'red',
        hasIncident
      });

      current.setDate(current.getDate() + 1);
    }

    return dailyUptime;

  } catch (error) {
    log.error('[SLA_SERVICE] Error getting daily uptime:', { error: error.message });
    return [];
  }
}

/**
 * Get SLA dashboard data
 * @param {number} organizationId - Organization ID
 * @returns {Promise<Object>} Dashboard data
 */
async function getDashboardData(organizationId) {
  try {
    const config = await getSLAConfig(organizationId);

    // Current month metrics
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const uptimeMetrics = await calculateUptime(organizationId, monthStart, monthEnd);

    // Get latest stored metrics
    const metricsResult = await db.query(
      `SELECT * FROM sla_metrics
       WHERE organization_id = $1
       ORDER BY period_start DESC
       LIMIT 1`,
      [organizationId]
    );

    const latestMetrics = metricsResult.rows[0] || {};

    // Get credit balance
    const creditsResult = await db.query(
      `SELECT COALESCE(SUM(credit_amount), 0) as total_credits
       FROM sla_credits
       WHERE organization_id = $1 AND status = 'approved'`,
      [organizationId]
    );

    // Get historical metrics for trend
    const historyResult = await db.query(
      `SELECT period_start, uptime_actual, avg_response_time, incidents_count
       FROM sla_metrics
       WHERE organization_id = $1
       ORDER BY period_start DESC
       LIMIT 12`,
      [organizationId]
    );

    // Get recent incidents
    let recentIncidents = [];
    try {
      const incidentsResult = await db.query(
        `SELECT id, title, severity, status, created_at, resolved_at
         FROM incidents
         WHERE organization_id = $1
         ORDER BY created_at DESC
         LIMIT 5`,
        [organizationId]
      );
      recentIncidents = incidentsResult.rows;
    } catch (e) {
      // Incidents table might not exist
    }

    // Daily uptime for calendar
    const dailyUptime = await getDailyUptime(organizationId, monthStart, monthEnd);

    return {
      // Config
      tier: config.tier,
      uptime_target: config.uptime_target,
      response_time_target: config.response_time_target,
      support_response_hours: config.support_response_hours,

      // Current metrics
      current_uptime: uptimeMetrics.uptimePercentage,
      current_uptime_met: uptimeMetrics.uptimePercentage >= config.uptime_target,
      current_response_time: latestMetrics.avg_response_time || 0,
      current_response_time_met: (latestMetrics.avg_response_time || 0) <= config.response_time_target,
      current_downtime_minutes: uptimeMetrics.downtimeMinutes,
      current_incidents: uptimeMetrics.incidentsCount,

      // Credits
      credit_balance: parseFloat(creditsResult.rows[0]?.total_credits || 0),

      // Historical
      history: historyResult.rows.reverse(),

      // Daily calendar
      daily_uptime: dailyUptime,

      // Recent incidents
      recent_incidents: recentIncidents,

      // Period info
      period_start: monthStart.toISOString(),
      period_end: monthEnd.toISOString()
    };

  } catch (error) {
    log.error('[SLA_SERVICE] Error getting dashboard data:', { error: error.message });
    throw error;
  }
}

/**
 * Get SLA history
 * @param {number} organizationId - Organization ID
 * @param {number} months - Number of months to retrieve
 * @returns {Promise<Array>} Historical SLA data
 */
async function getSLAHistory(organizationId, months = 12) {
  try {
    const result = await db.query(
      `SELECT * FROM sla_metrics
       WHERE organization_id = $1
       ORDER BY period_start DESC
       LIMIT $2`,
      [organizationId, months]
    );

    return result.rows;

  } catch (error) {
    log.error('[SLA_SERVICE] Error getting history:', { error: error.message });
    throw error;
  }
}

/**
 * Get SLA credits
 * @param {number} organizationId - Organization ID
 * @returns {Promise<Array>} Credit history
 */
async function getSLACredits(organizationId) {
  try {
    const result = await db.query(
      `SELECT * FROM sla_credits
       WHERE organization_id = $1
       ORDER BY period DESC`,
      [organizationId]
    );

    return result.rows;

  } catch (error) {
    log.error('[SLA_SERVICE] Error getting credits:', { error: error.message });
    throw error;
  }
}

/**
 * Store SLA metrics for a period
 * @param {number} organizationId - Organization ID
 * @param {Object} metrics - Metrics to store
 * @returns {Promise<Object>} Stored metrics
 */
async function storeSLAMetrics(organizationId, metrics) {
  try {
    const result = await db.query(
      `INSERT INTO sla_metrics
       (organization_id, period_start, period_end, uptime_actual, avg_response_time, total_downtime_minutes, incidents_count, sla_breaches)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (organization_id, period_start, period_end)
       DO UPDATE SET
         uptime_actual = $4,
         avg_response_time = $5,
         total_downtime_minutes = $6,
         incidents_count = $7,
         sla_breaches = $8
       RETURNING *`,
      [
        organizationId,
        metrics.period_start,
        metrics.period_end,
        metrics.uptime_actual,
        metrics.avg_response_time,
        metrics.total_downtime_minutes,
        metrics.incidents_count,
        JSON.stringify(metrics.sla_breaches || [])
      ]
    );

    return result.rows[0];

  } catch (error) {
    log.error('[SLA_SERVICE] Error storing metrics:', { error: error.message });
    throw error;
  }
}

module.exports = {
  getSLAConfig,
  calculateUptime,
  checkSLABreach,
  calculateCredit,
  generateSLAReport,
  getDashboardData,
  getSLAHistory,
  getSLACredits,
  getDailyUptime,
  storeSLAMetrics,
  SLA_TIERS
};
