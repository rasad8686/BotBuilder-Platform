/**
 * SSO Analytics Service
 * Tracks and aggregates SSO usage statistics
 */

const db = require('../db');
const log = require('../utils/logger');

class SSOAnalyticsService {
  /**
   * Record login event
   * @param {number} configId - SSO Configuration ID
   * @param {Object} data - Event data
   */
  static async recordLogin(configId, data) {
    try {
      const { userId, success, loginTimeMs, isNewUser } = data;
      const today = new Date().toISOString().split('T')[0];
      const hour = new Date().getHours();

      // Get or create today's analytics record
      let analyticsResult = await db.query(
        'SELECT * FROM sso_analytics WHERE sso_configuration_id = $1 AND date = $2',
        [configId, today]
      );

      let analytics = analyticsResult.rows[0];

      if (!analytics) {
        const insertResult = await db.query(
          `INSERT INTO sso_analytics (sso_configuration_id, date, total_logins, successful_logins, failed_logins, unique_users, new_users_provisioned, hourly_distribution, error_breakdown)
           VALUES ($1, $2, 0, 0, 0, 0, 0, $3, $4) RETURNING *`,
          [configId, today, JSON.stringify({}), JSON.stringify({})]
        );
        analytics = insertResult.rows[0];
      }

      // Parse JSON fields
      let hourlyDistribution = typeof analytics.hourly_distribution === 'string'
        ? JSON.parse(analytics.hourly_distribution)
        : analytics.hourly_distribution || {};

      // Update counters
      let totalLogins = analytics.total_logins + 1;
      let successfulLogins = analytics.successful_logins;
      let failedLogins = analytics.failed_logins;
      let newUsersProvisioned = analytics.new_users_provisioned;
      let avgLoginTimeMs = analytics.avg_login_time_ms || 0;

      if (success) {
        successfulLogins += 1;
      } else {
        failedLogins += 1;
      }

      if (isNewUser) {
        newUsersProvisioned += 1;
      }

      // Update hourly distribution
      hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;

      // Calculate rolling average login time
      if (loginTimeMs && success) {
        const currentAvg = analytics.avg_login_time_ms || 0;
        const currentCount = analytics.successful_logins || 0;
        avgLoginTimeMs = ((currentAvg * currentCount) + loginTimeMs) / (currentCount + 1);
        avgLoginTimeMs = Math.round(avgLoginTimeMs * 100) / 100;
      }

      await db.query(
        `UPDATE sso_analytics
         SET total_logins = $1, successful_logins = $2, failed_logins = $3,
             new_users_provisioned = $4, hourly_distribution = $5, avg_login_time_ms = $6, updated_at = NOW()
         WHERE id = $7`,
        [totalLogins, successfulLogins, failedLogins, newUsersProvisioned, JSON.stringify(hourlyDistribution), avgLoginTimeMs, analytics.id]
      );

      // Update unique users count (separate query)
      if (userId) {
        await this.updateUniqueUsers(configId, today);
      }
    } catch (error) {
      log.error('Error recording SSO login:', { error: error.message });
      // Don't throw - analytics should not break login flow
    }
  }

  /**
   * Record error event
   * @param {number} configId - SSO Configuration ID
   * @param {string} errorType - Type of error
   */
  static async recordError(configId, errorType) {
    try {
      const today = new Date().toISOString().split('T')[0];

      const analyticsResult = await db.query(
        'SELECT * FROM sso_analytics WHERE sso_configuration_id = $1 AND date = $2',
        [configId, today]
      );

      const analytics = analyticsResult.rows[0];

      if (analytics) {
        let errorBreakdown = typeof analytics.error_breakdown === 'string'
          ? JSON.parse(analytics.error_breakdown)
          : analytics.error_breakdown || {};

        errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1;

        await db.query(
          'UPDATE sso_analytics SET error_breakdown = $1, updated_at = NOW() WHERE id = $2',
          [JSON.stringify(errorBreakdown), analytics.id]
        );
      }
    } catch (error) {
      log.error('Error recording SSO error:', { error: error.message });
    }
  }

  /**
   * Update unique users count
   */
  static async updateUniqueUsers(configId, date) {
    try {
      const startOfDay = new Date(date);
      const endOfDay = new Date(date);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const countResult = await db.query(
        `SELECT COUNT(DISTINCT user_id) as count FROM sso_login_logs
         WHERE sso_configuration_id = $1 AND status = 'success'
         AND created_at >= $2 AND created_at < $3 AND user_id IS NOT NULL`,
        [configId, startOfDay, endOfDay]
      );

      const count = parseInt(countResult.rows[0]?.count || 0);

      await db.query(
        'UPDATE sso_analytics SET unique_users = $1, updated_at = NOW() WHERE sso_configuration_id = $2 AND date = $3',
        [count, configId, date]
      );
    } catch (error) {
      log.error('Error updating unique users:', { error: error.message });
    }
  }

  /**
   * Get analytics for date range
   * @param {number} configId - SSO Configuration ID
   * @param {Object} options - Query options
   * @returns {Object} Analytics data
   */
  static async getAnalytics(configId, options = {}) {
    try {
      const { startDate, endDate } = options;

      // Default to last 30 days
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

      const analyticsResult = await db.query(
        'SELECT * FROM sso_analytics WHERE sso_configuration_id = $1 AND date >= $2 AND date <= $3 ORDER BY date ASC',
        [configId, start.toISOString().split('T')[0], end.toISOString().split('T')[0]]
      );

      const analytics = analyticsResult.rows;

      // Calculate totals
      const totals = analytics.reduce((acc, day) => {
        acc.totalLogins += day.total_logins || 0;
        acc.successfulLogins += day.successful_logins || 0;
        acc.failedLogins += day.failed_logins || 0;
        acc.newUsers += day.new_users_provisioned || 0;
        return acc;
      }, { totalLogins: 0, successfulLogins: 0, failedLogins: 0, newUsers: 0 });

      // Calculate averages
      const avgLoginTime = analytics.length > 0
        ? analytics.reduce((sum, day) => sum + (day.avg_login_time_ms || 0), 0) / analytics.length
        : 0;

      // Aggregate hourly distribution
      const hourlyDistribution = {};
      for (let i = 0; i < 24; i++) {
        hourlyDistribution[i] = 0;
      }

      analytics.forEach(day => {
        const hourly = typeof day.hourly_distribution === 'string'
          ? JSON.parse(day.hourly_distribution)
          : day.hourly_distribution || {};

        Object.entries(hourly).forEach(([hour, count]) => {
          hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + count;
        });
      });

      // Aggregate error breakdown
      const errorBreakdown = {};
      analytics.forEach(day => {
        const errors = typeof day.error_breakdown === 'string'
          ? JSON.parse(day.error_breakdown)
          : day.error_breakdown || {};

        Object.entries(errors).forEach(([type, count]) => {
          errorBreakdown[type] = (errorBreakdown[type] || 0) + count;
        });
      });

      // Format daily data for charts
      const dailyData = analytics.map(day => ({
        date: day.date,
        total: day.total_logins,
        successful: day.successful_logins,
        failed: day.failed_logins,
        uniqueUsers: day.unique_users,
        newUsers: day.new_users_provisioned,
        avgLoginTime: day.avg_login_time_ms
      }));

      return {
        period: { start, end },
        totals,
        successRate: totals.totalLogins > 0
          ? Math.round((totals.successfulLogins / totals.totalLogins) * 100)
          : 0,
        avgLoginTime: Math.round(avgLoginTime),
        hourlyDistribution,
        errorBreakdown,
        dailyData
      };
    } catch (error) {
      log.error('Error getting SSO analytics:', { error: error.message });
      throw error;
    }
  }

  /**
   * Get real-time stats (last 24 hours)
   * @param {number} configId - SSO Configuration ID
   * @returns {Object} Real-time stats
   */
  static async getRealTimeStats(configId) {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const statsResult = await db.query(
        `SELECT
           COUNT(*) as total,
           COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
           COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
           COUNT(DISTINCT user_id) as unique_users
         FROM sso_login_logs
         WHERE sso_configuration_id = $1 AND created_at >= $2`,
        [configId, since]
      );

      const stats = statsResult.rows[0];

      // Get last 10 logins
      const recentResult = await db.query(
        'SELECT email, status, created_at, ip_address FROM sso_login_logs WHERE sso_configuration_id = $1 ORDER BY created_at DESC LIMIT 10',
        [configId]
      );

      // Get hourly trend for last 24 hours
      const trendResult = await db.query(
        `SELECT DATE_TRUNC('hour', created_at) as hour, COUNT(*) as count
         FROM sso_login_logs
         WHERE sso_configuration_id = $1 AND created_at >= $2
         GROUP BY DATE_TRUNC('hour', created_at)
         ORDER BY hour ASC`,
        [configId, since]
      );

      return {
        last24Hours: {
          total: parseInt(stats.total) || 0,
          successful: parseInt(stats.successful) || 0,
          failed: parseInt(stats.failed) || 0,
          uniqueUsers: parseInt(stats.unique_users) || 0
        },
        recentLogins: recentResult.rows,
        hourlyTrend: trendResult.rows.map(h => ({
          hour: h.hour,
          count: parseInt(h.count)
        }))
      };
    } catch (error) {
      log.error('Error getting real-time stats:', { error: error.message });
      throw error;
    }
  }

  /**
   * Get top users by login count
   * @param {number} configId - SSO Configuration ID
   * @param {number} limit - Number of users to return
   * @returns {Array} Top users
   */
  static async getTopUsers(configId, limit = 10) {
    try {
      const result = await db.query(
        `SELECT u.id, u.email, u.name, COUNT(*) as login_count, MAX(l.created_at) as last_login
         FROM sso_login_logs l
         LEFT JOIN users u ON l.user_id = u.id
         WHERE l.sso_configuration_id = $1 AND l.status = 'success' AND l.user_id IS NOT NULL
         GROUP BY u.id, u.email, u.name
         ORDER BY login_count DESC
         LIMIT $2`,
        [configId, limit]
      );

      return result.rows;
    } catch (error) {
      log.error('Error getting top users:', { error: error.message });
      throw error;
    }
  }

  /**
   * Export analytics data as CSV
   * @param {number} configId - SSO Configuration ID
   * @param {Object} options - Export options
   * @returns {string} CSV string
   */
  static async exportToCSV(configId, options = {}) {
    try {
      const analytics = await this.getAnalytics(configId, options);

      const headers = ['Date', 'Total Logins', 'Successful', 'Failed', 'Unique Users', 'New Users', 'Avg Login Time (ms)'];
      const rows = analytics.dailyData.map(day => [
        day.date,
        day.total,
        day.successful,
        day.failed,
        day.uniqueUsers,
        day.newUsers,
        day.avgLoginTime || 0
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      return csv;
    } catch (error) {
      log.error('Error exporting analytics to CSV:', { error: error.message });
      throw error;
    }
  }
}

module.exports = SSOAnalyticsService;
