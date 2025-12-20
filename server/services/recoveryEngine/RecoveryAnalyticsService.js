/**
 * Recovery Analytics Service
 *
 * Provides comprehensive analytics for revenue recovery campaigns,
 * including dashboard stats, performance metrics, and report generation.
 */

const db = require('../../db');
const log = require('../../utils/logger');

class RecoveryAnalyticsService {
  /**
   * Get dashboard statistics
   * @param {number} orgId - Organization ID
   * @returns {Object} Dashboard statistics
   */
  async getDashboardStats(orgId) {
    try {
      // Get overall recovery stats (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const overallResult = await db.query(
        `SELECT
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE status = 'recovered') as recovered,
          COUNT(*) FILTER (WHERE status = 'partially_recovered') as partially_recovered,
          COUNT(*) FILTER (WHERE status IN ('pending', 'processing', 'message_sent')) as in_progress,
          COALESCE(SUM(potential_value), 0) as total_at_risk,
          COALESCE(SUM(recovered_value), 0) as total_recovered
         FROM recovery_events
         WHERE org_id = $1
         AND event_occurred_at >= $2`,
        [orgId, thirtyDaysAgo]
      );

      // Get active campaigns
      const campaignsResult = await db.query(
        `SELECT COUNT(*) as active_campaigns
         FROM recovery_campaigns
         WHERE org_id = $1 AND status = 'active'`,
        [orgId]
      );

      // Get at-risk customers
      const atRiskResult = await db.query(
        `SELECT
          COUNT(*) as total_at_risk,
          COUNT(*) FILTER (WHERE churn_risk_level = 'critical') as critical,
          COUNT(*) FILTER (WHERE churn_risk_level = 'high') as high
         FROM customer_health_scores
         WHERE org_id = $1
         AND churn_risk_level IN ('critical', 'high', 'medium')`,
        [orgId]
      );

      // Get message stats
      const messageResult = await db.query(
        `SELECT
          COUNT(*) as total_sent,
          COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opened,
          COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicked,
          COUNT(*) FILTER (WHERE converted_at IS NOT NULL) as converted
         FROM recovery_messages
         WHERE org_id = $1
         AND created_at >= $2`,
        [orgId, thirtyDaysAgo]
      );

      // Get today's stats
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayResult = await db.query(
        `SELECT
          COUNT(*) as events_today,
          COUNT(*) FILTER (WHERE status = 'recovered') as recovered_today,
          COALESCE(SUM(recovered_value), 0) as revenue_today
         FROM recovery_events
         WHERE org_id = $1
         AND event_occurred_at >= $2`,
        [orgId, todayStart]
      );

      const overall = overallResult.rows[0];
      const messages = messageResult.rows[0];
      const today = todayResult.rows[0];
      const atRisk = atRiskResult.rows[0];

      const totalEvents = parseInt(overall.total_events);
      const totalRecovered = parseInt(overall.recovered) + parseInt(overall.partially_recovered);

      return {
        overview: {
          total_events_30d: totalEvents,
          total_recovered_30d: totalRecovered,
          recovery_rate: totalEvents > 0 ? ((totalRecovered / totalEvents) * 100).toFixed(1) : 0,
          revenue_at_risk: parseFloat(overall.total_at_risk),
          revenue_recovered: parseFloat(overall.total_recovered),
          in_progress: parseInt(overall.in_progress)
        },
        today: {
          events: parseInt(today.events_today),
          recovered: parseInt(today.recovered_today),
          revenue: parseFloat(today.revenue_today)
        },
        campaigns: {
          active: parseInt(campaignsResult.rows[0].active_campaigns)
        },
        customers_at_risk: {
          total: parseInt(atRisk.total_at_risk),
          critical: parseInt(atRisk.critical),
          high: parseInt(atRisk.high)
        },
        messages: {
          sent: parseInt(messages.total_sent),
          opened: parseInt(messages.opened),
          clicked: parseInt(messages.clicked),
          converted: parseInt(messages.converted),
          open_rate: parseInt(messages.total_sent) > 0
            ? ((parseInt(messages.opened) / parseInt(messages.total_sent)) * 100).toFixed(1)
            : 0
        }
      };
    } catch (error) {
      log.error('Failed to get dashboard stats', { orgId, error: error.message });
      throw error;
    }
  }

  /**
   * Get revenue recovered over date range
   * @param {number} orgId - Organization ID
   * @param {Object} dateRange - Date range
   * @returns {Object} Revenue recovery data
   */
  async getRevenueRecovered(orgId, dateRange = {}) {
    const {
      start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end_date = new Date()
    } = dateRange;

    try {
      // Daily revenue breakdown
      const dailyResult = await db.query(
        `SELECT
          DATE(recovered_at) as date,
          COUNT(*) as recoveries,
          COALESCE(SUM(recovered_value), 0) as revenue,
          COALESCE(SUM(potential_value), 0) as potential
         FROM recovery_events
         WHERE org_id = $1
         AND status IN ('recovered', 'partially_recovered')
         AND recovered_at >= $2
         AND recovered_at <= $3
         GROUP BY DATE(recovered_at)
         ORDER BY DATE(recovered_at) ASC`,
        [orgId, start_date, end_date]
      );

      // Total summary
      const summaryResult = await db.query(
        `SELECT
          COALESCE(SUM(recovered_value), 0) as total_recovered,
          COALESCE(SUM(potential_value), 0) as total_potential,
          COUNT(*) as total_recoveries,
          COALESCE(AVG(recovered_value), 0) as avg_recovery_value
         FROM recovery_events
         WHERE org_id = $1
         AND status IN ('recovered', 'partially_recovered')
         AND recovered_at >= $2
         AND recovered_at <= $3`,
        [orgId, start_date, end_date]
      );

      // By event type
      const byTypeResult = await db.query(
        `SELECT
          event_type,
          COUNT(*) as recoveries,
          COALESCE(SUM(recovered_value), 0) as revenue
         FROM recovery_events
         WHERE org_id = $1
         AND status IN ('recovered', 'partially_recovered')
         AND recovered_at >= $2
         AND recovered_at <= $3
         GROUP BY event_type
         ORDER BY revenue DESC`,
        [orgId, start_date, end_date]
      );

      const summary = summaryResult.rows[0];

      return {
        summary: {
          total_recovered: parseFloat(summary.total_recovered),
          total_potential: parseFloat(summary.total_potential),
          total_recoveries: parseInt(summary.total_recoveries),
          avg_recovery_value: parseFloat(summary.avg_recovery_value),
          recovery_efficiency: parseFloat(summary.total_potential) > 0
            ? ((parseFloat(summary.total_recovered) / parseFloat(summary.total_potential)) * 100).toFixed(1)
            : 0
        },
        daily: dailyResult.rows.map(row => ({
          date: row.date,
          recoveries: parseInt(row.recoveries),
          revenue: parseFloat(row.revenue),
          potential: parseFloat(row.potential)
        })),
        by_type: byTypeResult.rows.map(row => ({
          event_type: row.event_type,
          recoveries: parseInt(row.recoveries),
          revenue: parseFloat(row.revenue)
        })),
        date_range: { start_date, end_date }
      };
    } catch (error) {
      log.error('Failed to get revenue recovered', { orgId, error: error.message });
      throw error;
    }
  }

  /**
   * Get recovery rate by channel
   * @param {number} orgId - Organization ID
   * @param {Object} dateRange - Date range
   * @returns {Object} Channel performance data
   */
  async getRecoveryRateByChannel(orgId, dateRange = {}) {
    const {
      start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end_date = new Date()
    } = dateRange;

    try {
      const result = await db.query(
        `SELECT
          m.channel,
          COUNT(*) as total_sent,
          COUNT(*) FILTER (WHERE m.status = 'delivered' OR m.delivered_at IS NOT NULL) as delivered,
          COUNT(*) FILTER (WHERE m.opened_at IS NOT NULL) as opened,
          COUNT(*) FILTER (WHERE m.clicked_at IS NOT NULL) as clicked,
          COUNT(*) FILTER (WHERE m.converted_at IS NOT NULL) as converted,
          COALESCE(SUM(m.conversion_value), 0) as revenue
         FROM recovery_messages m
         WHERE m.org_id = $1
         AND m.created_at >= $2
         AND m.created_at <= $3
         GROUP BY m.channel
         ORDER BY revenue DESC`,
        [orgId, start_date, end_date]
      );

      const channels = result.rows.map(row => {
        const sent = parseInt(row.total_sent);
        const delivered = parseInt(row.delivered);
        const opened = parseInt(row.opened);
        const clicked = parseInt(row.clicked);
        const converted = parseInt(row.converted);

        return {
          channel: row.channel,
          total_sent: sent,
          delivered,
          opened,
          clicked,
          converted,
          revenue: parseFloat(row.revenue),
          delivery_rate: sent > 0 ? ((delivered / sent) * 100).toFixed(1) : 0,
          open_rate: delivered > 0 ? ((opened / delivered) * 100).toFixed(1) : 0,
          click_rate: opened > 0 ? ((clicked / opened) * 100).toFixed(1) : 0,
          conversion_rate: clicked > 0 ? ((converted / clicked) * 100).toFixed(1) : 0
        };
      });

      // Calculate overall
      const totals = channels.reduce((acc, ch) => ({
        sent: acc.sent + ch.total_sent,
        delivered: acc.delivered + ch.delivered,
        opened: acc.opened + ch.opened,
        clicked: acc.clicked + ch.clicked,
        converted: acc.converted + ch.converted,
        revenue: acc.revenue + ch.revenue
      }), { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0, revenue: 0 });

      return {
        channels,
        overall: {
          total_sent: totals.sent,
          total_delivered: totals.delivered,
          total_opened: totals.opened,
          total_clicked: totals.clicked,
          total_converted: totals.converted,
          total_revenue: totals.revenue,
          avg_open_rate: totals.delivered > 0 ? ((totals.opened / totals.delivered) * 100).toFixed(1) : 0,
          avg_conversion_rate: totals.clicked > 0 ? ((totals.converted / totals.clicked) * 100).toFixed(1) : 0
        },
        best_channel: channels[0]?.channel || null,
        date_range: { start_date, end_date }
      };
    } catch (error) {
      log.error('Failed to get recovery rate by channel', { orgId, error: error.message });
      throw error;
    }
  }

  /**
   * Get campaign performance metrics
   * @param {number} orgId - Organization ID
   * @param {string} campaignId - Campaign ID
   * @returns {Object} Campaign performance data
   */
  async getCampaignPerformance(orgId, campaignId) {
    try {
      // Get campaign details
      const campaignResult = await db.query(
        `SELECT * FROM recovery_campaigns WHERE id = $1 AND org_id = $2`,
        [campaignId, orgId]
      );

      if (campaignResult.rows.length === 0) {
        throw new Error('Campaign not found');
      }

      const campaign = campaignResult.rows[0];

      // Get event stats
      const eventResult = await db.query(
        `SELECT
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE status = 'recovered') as recovered,
          COUNT(*) FILTER (WHERE status = 'partially_recovered') as partially_recovered,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          COUNT(*) FILTER (WHERE status IN ('pending', 'processing')) as pending,
          COALESCE(SUM(potential_value), 0) as total_potential,
          COALESCE(SUM(recovered_value), 0) as total_recovered,
          COALESCE(AVG(recovered_value) FILTER (WHERE status = 'recovered'), 0) as avg_recovery
         FROM recovery_events
         WHERE campaign_id = $1`,
        [campaignId]
      );

      // Get message stats
      const messageResult = await db.query(
        `SELECT
          COUNT(*) as total_messages,
          COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opened,
          COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicked,
          COUNT(*) FILTER (WHERE converted_at IS NOT NULL) as converted,
          COUNT(*) FILTER (WHERE status = 'bounced') as bounced,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
         FROM recovery_messages
         WHERE campaign_id = $1`,
        [campaignId]
      );

      // Get daily performance
      const dailyResult = await db.query(
        `SELECT
          DATE(event_occurred_at) as date,
          COUNT(*) as events,
          COUNT(*) FILTER (WHERE status = 'recovered') as recovered,
          COALESCE(SUM(recovered_value), 0) as revenue
         FROM recovery_events
         WHERE campaign_id = $1
         GROUP BY DATE(event_occurred_at)
         ORDER BY date DESC
         LIMIT 30`,
        [campaignId]
      );

      const events = eventResult.rows[0];
      const messages = messageResult.rows[0];

      const totalEvents = parseInt(events.total_events);
      const totalRecovered = parseInt(events.recovered) + parseInt(events.partially_recovered);

      return {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          type: campaign.campaign_type,
          status: campaign.status,
          created_at: campaign.created_at
        },
        events: {
          total: totalEvents,
          recovered: parseInt(events.recovered),
          partially_recovered: parseInt(events.partially_recovered),
          failed: parseInt(events.failed),
          pending: parseInt(events.pending),
          recovery_rate: totalEvents > 0 ? ((totalRecovered / totalEvents) * 100).toFixed(1) : 0
        },
        revenue: {
          potential: parseFloat(events.total_potential),
          recovered: parseFloat(events.total_recovered),
          avg_recovery: parseFloat(events.avg_recovery),
          efficiency: parseFloat(events.total_potential) > 0
            ? ((parseFloat(events.total_recovered) / parseFloat(events.total_potential)) * 100).toFixed(1)
            : 0
        },
        messages: {
          total: parseInt(messages.total_messages),
          opened: parseInt(messages.opened),
          clicked: parseInt(messages.clicked),
          converted: parseInt(messages.converted),
          bounced: parseInt(messages.bounced),
          failed: parseInt(messages.failed),
          open_rate: parseInt(messages.total_messages) > 0
            ? ((parseInt(messages.opened) / parseInt(messages.total_messages)) * 100).toFixed(1)
            : 0
        },
        daily: dailyResult.rows
      };
    } catch (error) {
      log.error('Failed to get campaign performance', { orgId, campaignId, error: error.message });
      throw error;
    }
  }

  /**
   * Get abandoned cart statistics
   * @param {number} orgId - Organization ID
   * @param {Object} dateRange - Date range
   * @returns {Object} Abandoned cart stats
   */
  async getAbandonedCartStats(orgId, dateRange = {}) {
    const {
      start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end_date = new Date()
    } = dateRange;

    try {
      const result = await db.query(
        `SELECT
          COUNT(*) as total_abandoned,
          COUNT(*) FILTER (WHERE status = 'recovered') as recovered,
          COUNT(*) FILTER (WHERE status = 'partially_recovered') as partially_recovered,
          COUNT(*) FILTER (WHERE status IN ('failed', 'expired')) as lost,
          COALESCE(SUM(potential_value), 0) as total_cart_value,
          COALESCE(SUM(recovered_value), 0) as recovered_value,
          COALESCE(AVG(potential_value), 0) as avg_cart_value,
          COALESCE(AVG(EXTRACT(EPOCH FROM (recovered_at - event_occurred_at)) / 3600)
            FILTER (WHERE status = 'recovered'), 0) as avg_recovery_hours
         FROM recovery_events
         WHERE org_id = $1
         AND event_type = 'cart_abandoned'
         AND event_occurred_at >= $2
         AND event_occurred_at <= $3`,
        [orgId, start_date, end_date]
      );

      // Get cart value distribution
      const distributionResult = await db.query(
        `SELECT
          CASE
            WHEN potential_value < 50 THEN '0-50'
            WHEN potential_value < 100 THEN '50-100'
            WHEN potential_value < 200 THEN '100-200'
            WHEN potential_value < 500 THEN '200-500'
            ELSE '500+'
          END as value_range,
          COUNT(*) as count,
          COUNT(*) FILTER (WHERE status = 'recovered') as recovered
         FROM recovery_events
         WHERE org_id = $1
         AND event_type = 'cart_abandoned'
         AND event_occurred_at >= $2
         AND event_occurred_at <= $3
         GROUP BY value_range
         ORDER BY value_range`,
        [orgId, start_date, end_date]
      );

      const stats = result.rows[0];
      const total = parseInt(stats.total_abandoned);
      const recovered = parseInt(stats.recovered) + parseInt(stats.partially_recovered);

      return {
        summary: {
          total_abandoned: total,
          total_recovered: recovered,
          total_lost: parseInt(stats.lost),
          recovery_rate: total > 0 ? ((recovered / total) * 100).toFixed(1) : 0,
          total_cart_value: parseFloat(stats.total_cart_value),
          recovered_value: parseFloat(stats.recovered_value),
          lost_value: parseFloat(stats.total_cart_value) - parseFloat(stats.recovered_value),
          avg_cart_value: parseFloat(stats.avg_cart_value),
          avg_recovery_hours: parseFloat(stats.avg_recovery_hours).toFixed(1)
        },
        value_distribution: distributionResult.rows.map(row => ({
          range: row.value_range,
          count: parseInt(row.count),
          recovered: parseInt(row.recovered),
          recovery_rate: parseInt(row.count) > 0
            ? ((parseInt(row.recovered) / parseInt(row.count)) * 100).toFixed(1)
            : 0
        })),
        date_range: { start_date, end_date }
      };
    } catch (error) {
      log.error('Failed to get abandoned cart stats', { orgId, error: error.message });
      throw error;
    }
  }

  /**
   * Get churn statistics
   * @param {number} orgId - Organization ID
   * @param {Object} dateRange - Date range
   * @returns {Object} Churn stats
   */
  async getChurnStats(orgId, dateRange = {}) {
    const {
      start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end_date = new Date()
    } = dateRange;

    try {
      // Get churn events
      const churnResult = await db.query(
        `SELECT
          COUNT(*) as total_churn_risks,
          COUNT(*) FILTER (WHERE status = 'recovered') as prevented,
          COUNT(*) FILTER (WHERE status IN ('failed', 'expired')) as churned,
          COUNT(*) FILTER (WHERE status IN ('pending', 'processing')) as in_progress,
          COALESCE(SUM(potential_value), 0) as revenue_at_risk,
          COALESCE(SUM(CASE WHEN status = 'recovered' THEN potential_value ELSE 0 END), 0) as revenue_saved
         FROM recovery_events
         WHERE org_id = $1
         AND event_type IN ('churn_risk', 'inactivity', 'negative_sentiment')
         AND event_occurred_at >= $2
         AND event_occurred_at <= $3`,
        [orgId, start_date, end_date]
      );

      // Get health score trends
      const trendResult = await db.query(
        `SELECT
          DATE(recorded_at) as date,
          ROUND(AVG(health_score)) as avg_score,
          COUNT(*) FILTER (WHERE churn_risk_level IN ('critical', 'high')) as high_risk_count
         FROM customer_health_score_history
         WHERE org_id = $1
         AND recorded_at >= $2
         AND recorded_at <= $3
         GROUP BY DATE(recorded_at)
         ORDER BY date ASC`,
        [orgId, start_date, end_date]
      );

      // Get current risk distribution
      const riskResult = await db.query(
        `SELECT
          churn_risk_level,
          COUNT(*) as count,
          ROUND(AVG(churn_probability)::numeric, 4) as avg_probability
         FROM customer_health_scores
         WHERE org_id = $1
         GROUP BY churn_risk_level`,
        [orgId]
      );

      const churn = churnResult.rows[0];
      const total = parseInt(churn.total_churn_risks);
      const prevented = parseInt(churn.prevented);

      return {
        summary: {
          total_at_risk: total,
          prevented: prevented,
          churned: parseInt(churn.churned),
          in_progress: parseInt(churn.in_progress),
          prevention_rate: total > 0 ? ((prevented / total) * 100).toFixed(1) : 0,
          revenue_at_risk: parseFloat(churn.revenue_at_risk),
          revenue_saved: parseFloat(churn.revenue_saved)
        },
        risk_distribution: riskResult.rows.reduce((acc, row) => {
          acc[row.churn_risk_level] = {
            count: parseInt(row.count),
            avg_probability: parseFloat(row.avg_probability)
          };
          return acc;
        }, {}),
        trend: trendResult.rows,
        date_range: { start_date, end_date }
      };
    } catch (error) {
      log.error('Failed to get churn stats', { orgId, error: error.message });
      throw error;
    }
  }

  /**
   * Get customer health score distribution
   * @param {number} orgId - Organization ID
   * @returns {Object} Health distribution data
   */
  async getCustomerHealthDistribution(orgId) {
    try {
      // Get grade distribution
      const gradeResult = await db.query(
        `SELECT
          health_grade,
          COUNT(*) as count,
          ROUND(AVG(health_score)) as avg_score,
          ROUND(AVG(churn_probability)::numeric, 4) as avg_churn_prob
         FROM customer_health_scores
         WHERE org_id = $1
         GROUP BY health_grade
         ORDER BY health_grade`,
        [orgId]
      );

      // Get score histogram
      const histogramResult = await db.query(
        `SELECT
          FLOOR(health_score / 10) * 10 as score_range,
          COUNT(*) as count
         FROM customer_health_scores
         WHERE org_id = $1
         GROUP BY FLOOR(health_score / 10) * 10
         ORDER BY score_range`,
        [orgId]
      );

      // Get overall stats
      const overallResult = await db.query(
        `SELECT
          COUNT(*) as total_customers,
          ROUND(AVG(health_score)) as avg_score,
          MIN(health_score) as min_score,
          MAX(health_score) as max_score,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY health_score)) as median_score
         FROM customer_health_scores
         WHERE org_id = $1`,
        [orgId]
      );

      const overall = overallResult.rows[0];

      return {
        overall: {
          total_customers: parseInt(overall.total_customers),
          avg_score: parseInt(overall.avg_score),
          min_score: parseInt(overall.min_score),
          max_score: parseInt(overall.max_score),
          median_score: parseInt(overall.median_score)
        },
        by_grade: gradeResult.rows.map(row => ({
          grade: row.health_grade,
          count: parseInt(row.count),
          avg_score: parseInt(row.avg_score),
          avg_churn_probability: parseFloat(row.avg_churn_prob)
        })),
        histogram: histogramResult.rows.map(row => ({
          range: `${parseInt(row.score_range)}-${parseInt(row.score_range) + 9}`,
          count: parseInt(row.count)
        }))
      };
    } catch (error) {
      log.error('Failed to get customer health distribution', { orgId, error: error.message });
      throw error;
    }
  }

  /**
   * Get top recovered customers
   * @param {number} orgId - Organization ID
   * @param {number} limit - Number of customers to return
   * @returns {Array} Top recovered customers
   */
  async getTopRecoveredCustomers(orgId, limit = 10) {
    try {
      const result = await db.query(
        `SELECT
          e.customer_id,
          e.customer_email,
          e.customer_name,
          COUNT(*) as recovery_count,
          COALESCE(SUM(e.recovered_value), 0) as total_recovered,
          MAX(e.recovered_at) as last_recovery
         FROM recovery_events e
         WHERE e.org_id = $1
         AND e.status = 'recovered'
         GROUP BY e.customer_id, e.customer_email, e.customer_name
         ORDER BY total_recovered DESC
         LIMIT $2`,
        [orgId, limit]
      );

      return result.rows.map(row => ({
        customer_id: row.customer_id,
        customer_email: row.customer_email,
        customer_name: row.customer_name,
        recovery_count: parseInt(row.recovery_count),
        total_recovered: parseFloat(row.total_recovered),
        last_recovery: row.last_recovery
      }));
    } catch (error) {
      log.error('Failed to get top recovered customers', { orgId, error: error.message });
      throw error;
    }
  }

  /**
   * Get hourly performance for optimal timing analysis
   * @param {number} orgId - Organization ID
   * @param {Object} dateRange - Date range
   * @returns {Object} Hourly performance data
   */
  async getHourlyPerformance(orgId, dateRange = {}) {
    const {
      start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end_date = new Date()
    } = dateRange;

    try {
      // Get message performance by hour
      const hourlyResult = await db.query(
        `SELECT
          EXTRACT(HOUR FROM sent_at) as hour,
          COUNT(*) as total_sent,
          COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opened,
          COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicked,
          COUNT(*) FILTER (WHERE converted_at IS NOT NULL) as converted,
          COALESCE(SUM(conversion_value), 0) as revenue
         FROM recovery_messages
         WHERE org_id = $1
         AND sent_at >= $2
         AND sent_at <= $3
         AND sent_at IS NOT NULL
         GROUP BY EXTRACT(HOUR FROM sent_at)
         ORDER BY hour`,
        [orgId, start_date, end_date]
      );

      // Get day of week performance
      const dayResult = await db.query(
        `SELECT
          EXTRACT(DOW FROM sent_at) as day_of_week,
          COUNT(*) as total_sent,
          COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opened,
          COUNT(*) FILTER (WHERE converted_at IS NOT NULL) as converted
         FROM recovery_messages
         WHERE org_id = $1
         AND sent_at >= $2
         AND sent_at <= $3
         AND sent_at IS NOT NULL
         GROUP BY EXTRACT(DOW FROM sent_at)
         ORDER BY day_of_week`,
        [orgId, start_date, end_date]
      );

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      // Find best hour
      let bestHour = null;
      let bestHourRate = 0;

      const hourlyData = hourlyResult.rows.map(row => {
        const sent = parseInt(row.total_sent);
        const opened = parseInt(row.opened);
        const openRate = sent > 0 ? (opened / sent) * 100 : 0;

        if (openRate > bestHourRate && sent >= 10) {
          bestHourRate = openRate;
          bestHour = parseInt(row.hour);
        }

        return {
          hour: parseInt(row.hour),
          hour_label: `${row.hour}:00`,
          total_sent: sent,
          opened,
          clicked: parseInt(row.clicked),
          converted: parseInt(row.converted),
          revenue: parseFloat(row.revenue),
          open_rate: openRate.toFixed(1)
        };
      });

      return {
        hourly: hourlyData,
        daily: dayResult.rows.map(row => ({
          day: parseInt(row.day_of_week),
          day_name: dayNames[parseInt(row.day_of_week)],
          total_sent: parseInt(row.total_sent),
          opened: parseInt(row.opened),
          converted: parseInt(row.converted),
          open_rate: parseInt(row.total_sent) > 0
            ? ((parseInt(row.opened) / parseInt(row.total_sent)) * 100).toFixed(1)
            : 0
        })),
        recommendations: {
          best_hour: bestHour,
          best_hour_label: bestHour !== null ? `${bestHour}:00` : null,
          best_hour_open_rate: bestHourRate.toFixed(1)
        },
        date_range: { start_date, end_date }
      };
    } catch (error) {
      log.error('Failed to get hourly performance', { orgId, error: error.message });
      throw error;
    }
  }

  /**
   * Generate report in specified format
   * @param {number} orgId - Organization ID
   * @param {Object} dateRange - Date range
   * @param {string} format - Report format (json, csv)
   * @returns {Object} Generated report
   */
  async generateReport(orgId, dateRange = {}, format = 'json') {
    const {
      start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end_date = new Date()
    } = dateRange;

    try {
      // Gather all data
      const dashboard = await this.getDashboardStats(orgId);
      const revenue = await this.getRevenueRecovered(orgId, dateRange);
      const channels = await this.getRecoveryRateByChannel(orgId, dateRange);
      const carts = await this.getAbandonedCartStats(orgId, dateRange);
      const churn = await this.getChurnStats(orgId, dateRange);
      const health = await this.getCustomerHealthDistribution(orgId);
      const hourly = await this.getHourlyPerformance(orgId, dateRange);

      const report = {
        generated_at: new Date().toISOString(),
        org_id: orgId,
        date_range: { start_date, end_date },
        dashboard,
        revenue,
        channels,
        abandoned_carts: carts,
        churn,
        customer_health: health,
        timing_analysis: hourly
      };

      if (format === 'csv') {
        return this._convertToCSV(report);
      }

      return report;
    } catch (error) {
      log.error('Failed to generate report', { orgId, format, error: error.message });
      throw error;
    }
  }

  /**
   * Compare performance between two periods
   * @param {number} orgId - Organization ID
   * @param {Object} period1 - First period date range
   * @param {Object} period2 - Second period date range
   * @returns {Object} Comparison data
   */
  async comparePerformance(orgId, period1, period2) {
    try {
      const data1 = await this.getRevenueRecovered(orgId, period1);
      const data2 = await this.getRevenueRecovered(orgId, period2);

      const channels1 = await this.getRecoveryRateByChannel(orgId, period1);
      const channels2 = await this.getRecoveryRateByChannel(orgId, period2);

      const calcChange = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return (((current - previous) / previous) * 100).toFixed(1);
      };

      return {
        period1: {
          date_range: period1,
          revenue: data1.summary.total_recovered,
          recoveries: data1.summary.total_recoveries,
          efficiency: data1.summary.recovery_efficiency,
          best_channel: channels1.best_channel
        },
        period2: {
          date_range: period2,
          revenue: data2.summary.total_recovered,
          recoveries: data2.summary.total_recoveries,
          efficiency: data2.summary.recovery_efficiency,
          best_channel: channels2.best_channel
        },
        changes: {
          revenue_change: calcChange(data1.summary.total_recovered, data2.summary.total_recovered),
          recoveries_change: calcChange(data1.summary.total_recoveries, data2.summary.total_recoveries),
          efficiency_change: calcChange(
            parseFloat(data1.summary.recovery_efficiency),
            parseFloat(data2.summary.recovery_efficiency)
          )
        },
        trend: data1.summary.total_recovered > data2.summary.total_recovered ? 'improving' : 'declining'
      };
    } catch (error) {
      log.error('Failed to compare performance', { orgId, error: error.message });
      throw error;
    }
  }

  // ==================== Private Helper Methods ====================

  _convertToCSV(report) {
    const lines = [];

    // Header
    lines.push('Recovery Analytics Report');
    lines.push(`Generated: ${report.generated_at}`);
    lines.push(`Period: ${report.date_range.start_date} to ${report.date_range.end_date}`);
    lines.push('');

    // Dashboard Summary
    lines.push('DASHBOARD SUMMARY');
    lines.push('Metric,Value');
    lines.push(`Total Events (30d),${report.dashboard.overview.total_events_30d}`);
    lines.push(`Total Recovered,${report.dashboard.overview.total_recovered_30d}`);
    lines.push(`Recovery Rate,${report.dashboard.overview.recovery_rate}%`);
    lines.push(`Revenue Recovered,$${report.dashboard.overview.revenue_recovered}`);
    lines.push('');

    // Revenue by Type
    lines.push('REVENUE BY EVENT TYPE');
    lines.push('Event Type,Recoveries,Revenue');
    report.revenue.by_type.forEach(item => {
      lines.push(`${item.event_type},${item.recoveries},$${item.revenue}`);
    });
    lines.push('');

    // Channel Performance
    lines.push('CHANNEL PERFORMANCE');
    lines.push('Channel,Sent,Opened,Clicked,Converted,Revenue,Open Rate');
    report.channels.channels.forEach(ch => {
      lines.push(`${ch.channel},${ch.total_sent},${ch.opened},${ch.clicked},${ch.converted},$${ch.revenue},${ch.open_rate}%`);
    });

    return {
      format: 'csv',
      content: lines.join('\n'),
      filename: `recovery_report_${new Date().toISOString().split('T')[0]}.csv`
    };
  }
}

module.exports = new RecoveryAnalyticsService();
