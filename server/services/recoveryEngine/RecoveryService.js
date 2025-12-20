/**
 * AI Revenue Recovery Engine - Recovery Service
 *
 * Main service for managing recovery campaigns, tracking events,
 * and analyzing customer health scores.
 */

const db = require('../../db');
const log = require('../../utils/logger');

/**
 * Valid event types for recovery tracking
 */
const EVENT_TYPES = [
  'cart_abandoned',
  'purchase_completed',
  'churn_risk',
  'inactivity',
  'payment_failed',
  'negative_sentiment'
];

/**
 * Valid campaign types
 */
const CAMPAIGN_TYPES = [
  'cart_abandonment',
  'churn_prevention',
  'winback',
  'upsell',
  'renewal_reminder',
  'payment_failed',
  'inactive_user',
  'trial_expiring',
  'custom'
];

class RecoveryService {
  /**
   * Create a new recovery campaign
   * @param {number} orgId - Organization ID
   * @param {Object} campaignData - Campaign configuration
   * @returns {Object} Created campaign
   */
  async createCampaign(orgId, campaignData) {
    const {
      name,
      description,
      campaign_type,
      bot_id,
      target_rules = {},
      message_templates = [],
      ai_enabled = true,
      ai_personalization = true,
      ai_optimal_timing = true,
      ai_model = 'gpt-4',
      incentive_enabled = false,
      incentive_type,
      incentive_value,
      incentive_max_uses,
      incentive_expiry_hours = 48,
      channels = ['email'],
      start_date,
      end_date,
      send_window_start,
      send_window_end,
      timezone = 'UTC',
      max_messages_per_customer = 3,
      cooldown_hours = 24,
      daily_send_limit,
      created_by
    } = campaignData;

    // Validate campaign type
    if (!CAMPAIGN_TYPES.includes(campaign_type)) {
      throw new Error(`Invalid campaign type: ${campaign_type}`);
    }

    try {
      const result = await db.query(
        `INSERT INTO recovery_campaigns (
          org_id, name, description, campaign_type, bot_id,
          target_rules, message_templates,
          ai_enabled, ai_personalization, ai_optimal_timing, ai_model,
          incentive_enabled, incentive_type, incentive_value, incentive_max_uses, incentive_expiry_hours,
          channels, start_date, end_date, send_window_start, send_window_end, timezone,
          max_messages_per_customer, cooldown_hours, daily_send_limit,
          created_by, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, 'draft')
        RETURNING *`,
        [
          orgId, name, description, campaign_type, bot_id,
          JSON.stringify(target_rules), JSON.stringify(message_templates),
          ai_enabled, ai_personalization, ai_optimal_timing, ai_model,
          incentive_enabled, incentive_type, incentive_value, incentive_max_uses, incentive_expiry_hours,
          JSON.stringify(channels), start_date, end_date, send_window_start, send_window_end, timezone,
          max_messages_per_customer, cooldown_hours, daily_send_limit,
          created_by
        ]
      );

      log.info('Recovery campaign created', { orgId, campaignId: result.rows[0].id, name });
      return result.rows[0];
    } catch (error) {
      log.error('Failed to create recovery campaign', { orgId, error: error.message });
      throw error;
    }
  }

  /**
   * Get campaigns for an organization with optional filters
   * @param {number} orgId - Organization ID
   * @param {Object} filters - Filter options
   * @returns {Array} List of campaigns
   */
  async getCampaigns(orgId, filters = {}) {
    const {
      status,
      campaign_type,
      bot_id,
      limit = 50,
      offset = 0
    } = filters;

    try {
      let query = `
        SELECT * FROM recovery_campaigns
        WHERE org_id = $1
      `;
      const params = [orgId];
      let paramIndex = 2;

      if (status) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (campaign_type) {
        query += ` AND campaign_type = $${paramIndex}`;
        params.push(campaign_type);
        paramIndex++;
      }

      if (bot_id) {
        query += ` AND bot_id = $${paramIndex}`;
        params.push(bot_id);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) FROM recovery_campaigns WHERE org_id = $1`;
      const countParams = [orgId];
      let countParamIndex = 2;

      if (status) {
        countQuery += ` AND status = $${countParamIndex}`;
        countParams.push(status);
        countParamIndex++;
      }

      if (campaign_type) {
        countQuery += ` AND campaign_type = $${countParamIndex}`;
        countParams.push(campaign_type);
        countParamIndex++;
      }

      if (bot_id) {
        countQuery += ` AND bot_id = $${countParamIndex}`;
        countParams.push(bot_id);
      }

      const countResult = await db.query(countQuery, countParams);

      return {
        campaigns: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit,
        offset
      };
    } catch (error) {
      log.error('Failed to get recovery campaigns', { orgId, error: error.message });
      throw error;
    }
  }

  /**
   * Update a recovery campaign
   * @param {string} campaignId - Campaign ID (UUID)
   * @param {Object} data - Updated campaign data
   * @returns {Object} Updated campaign
   */
  async updateCampaign(campaignId, data) {
    const allowedFields = [
      'name', 'description', 'status', 'bot_id',
      'target_rules', 'message_templates',
      'ai_enabled', 'ai_personalization', 'ai_optimal_timing', 'ai_model',
      'incentive_enabled', 'incentive_type', 'incentive_value', 'incentive_max_uses', 'incentive_expiry_hours',
      'channels', 'start_date', 'end_date', 'send_window_start', 'send_window_end', 'timezone',
      'max_messages_per_customer', 'cooldown_hours', 'daily_send_limit'
    ];

    const updates = [];
    const params = [campaignId];
    let paramIndex = 2;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        let value = data[field];

        // Serialize JSON fields
        if (['target_rules', 'message_templates', 'channels'].includes(field)) {
          value = JSON.stringify(value);
        }

        updates.push(`${field} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    try {
      const result = await db.query(
        `UPDATE recovery_campaigns
         SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        throw new Error('Campaign not found');
      }

      log.info('Recovery campaign updated', { campaignId });
      return result.rows[0];
    } catch (error) {
      log.error('Failed to update recovery campaign', { campaignId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete a recovery campaign
   * @param {string} campaignId - Campaign ID (UUID)
   * @returns {boolean} Success status
   */
  async deleteCampaign(campaignId) {
    try {
      const result = await db.query(
        `DELETE FROM recovery_campaigns WHERE id = $1 RETURNING id`,
        [campaignId]
      );

      if (result.rows.length === 0) {
        throw new Error('Campaign not found');
      }

      log.info('Recovery campaign deleted', { campaignId });
      return true;
    } catch (error) {
      log.error('Failed to delete recovery campaign', { campaignId, error: error.message });
      throw error;
    }
  }

  /**
   * Track a recovery event
   * @param {number} orgId - Organization ID
   * @param {string} eventType - Type of event
   * @param {Object} eventData - Event details
   * @returns {Object} Created event
   */
  async trackEvent(orgId, eventType, eventData) {
    // Validate event type
    if (!EVENT_TYPES.includes(eventType)) {
      throw new Error(`Invalid event type: ${eventType}. Valid types: ${EVENT_TYPES.join(', ')}`);
    }

    const {
      customer_id,
      customer_email,
      customer_phone,
      customer_name,
      potential_value,
      currency = 'USD',
      source_platform,
      source_event_id,
      event_occurred_at = new Date(),
      expires_at,
      data = {}
    } = eventData;

    if (!customer_id) {
      throw new Error('customer_id is required');
    }

    try {
      const result = await db.query(
        `INSERT INTO recovery_events (
          org_id, event_type, customer_id, customer_email, customer_phone, customer_name,
          potential_value, currency, event_data,
          source_platform, source_event_id,
          event_occurred_at, expires_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending')
        RETURNING *`,
        [
          orgId, eventType, customer_id, customer_email, customer_phone, customer_name,
          potential_value, currency, JSON.stringify(data),
          source_platform, source_event_id,
          event_occurred_at, expires_at
        ]
      );

      const event = result.rows[0];
      log.info('Recovery event tracked', { orgId, eventId: event.id, eventType, customerId: customer_id });

      // Process the event asynchronously
      this.processEvent(event).catch(err => {
        log.error('Failed to process recovery event', { eventId: event.id, error: err.message });
      });

      return event;
    } catch (error) {
      log.error('Failed to track recovery event', { orgId, eventType, error: error.message });
      throw error;
    }
  }

  /**
   * Process an event and find matching campaigns
   * @param {Object} event - Recovery event
   * @returns {Object} Processing result
   */
  async processEvent(event) {
    try {
      // Update event status to processing
      await db.query(
        `UPDATE recovery_events SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [event.id]
      );

      // Map event types to campaign types
      const eventToCampaignMap = {
        'cart_abandoned': 'cart_abandonment',
        'purchase_completed': null, // No campaign needed
        'churn_risk': 'churn_prevention',
        'inactivity': 'inactive_user',
        'payment_failed': 'payment_failed',
        'negative_sentiment': 'churn_prevention'
      };

      const campaignType = eventToCampaignMap[event.event_type];

      // If no campaign type needed (e.g., purchase_completed)
      if (campaignType === null) {
        await db.query(
          `UPDATE recovery_events SET status = 'ignored', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [event.id]
        );
        return { processed: true, action: 'ignored', reason: 'No campaign needed for this event type' };
      }

      // Find active campaigns matching this event type
      const campaignsResult = await db.query(
        `SELECT * FROM recovery_campaigns
         WHERE org_id = $1
         AND campaign_type = $2
         AND status = 'active'
         AND (start_date IS NULL OR start_date <= CURRENT_TIMESTAMP)
         AND (end_date IS NULL OR end_date >= CURRENT_TIMESTAMP)
         ORDER BY created_at DESC
         LIMIT 1`,
        [event.org_id, campaignType]
      );

      if (campaignsResult.rows.length === 0) {
        await db.query(
          `UPDATE recovery_events SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [event.id]
        );
        return { processed: true, action: 'no_campaign', reason: 'No active campaign found' };
      }

      const campaign = campaignsResult.rows[0];

      // Link event to campaign
      await db.query(
        `UPDATE recovery_events
         SET campaign_id = $1, status = 'pending', updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [campaign.id, event.id]
      );

      log.info('Event matched to campaign', {
        eventId: event.id,
        campaignId: campaign.id,
        campaignName: campaign.name
      });

      return {
        processed: true,
        action: 'matched',
        campaignId: campaign.id,
        campaignName: campaign.name
      };
    } catch (error) {
      log.error('Failed to process recovery event', { eventId: event.id, error: error.message });

      await db.query(
        `UPDATE recovery_events SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [event.id]
      );

      throw error;
    }
  }

  /**
   * Get customer health score
   * @param {string} customerId - Customer ID
   * @param {number} orgId - Organization ID (optional)
   * @returns {Object} Customer health score data
   */
  async getCustomerHealthScore(customerId, orgId = null) {
    try {
      let query = `SELECT * FROM customer_health_scores WHERE customer_id = $1`;
      const params = [customerId];

      if (orgId) {
        query += ` AND org_id = $2`;
        params.push(orgId);
      }

      query += ` ORDER BY calculated_at DESC LIMIT 1`;

      const result = await db.query(query, params);

      if (result.rows.length === 0) {
        return null;
      }

      const healthScore = result.rows[0];

      // Get score history
      const historyResult = await db.query(
        `SELECT health_score, churn_probability, recorded_at
         FROM customer_health_score_history
         WHERE customer_health_id = $1
         ORDER BY recorded_at DESC
         LIMIT 30`,
        [healthScore.id]
      );

      return {
        ...healthScore,
        history: historyResult.rows
      };
    } catch (error) {
      log.error('Failed to get customer health score', { customerId, error: error.message });
      throw error;
    }
  }

  /**
   * Get analytics for an organization
   * @param {number} orgId - Organization ID
   * @param {Object} dateRange - Date range for analytics
   * @returns {Object} Analytics data
   */
  async getAnalytics(orgId, dateRange = {}) {
    const {
      start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end_date = new Date(),
      campaign_id = null,
      period_type = 'daily'
    } = dateRange;

    try {
      // Get aggregated analytics
      let analyticsQuery = `
        SELECT * FROM recovery_analytics
        WHERE org_id = $1
        AND period_type = $2
        AND period_start >= $3
        AND period_end <= $4
      `;
      const analyticsParams = [orgId, period_type, start_date, end_date];

      if (campaign_id) {
        analyticsQuery += ` AND campaign_id = $5`;
        analyticsParams.push(campaign_id);
      }

      analyticsQuery += ` ORDER BY period_start ASC`;

      const analyticsResult = await db.query(analyticsQuery, analyticsParams);

      // Get summary stats
      const summaryResult = await db.query(
        `SELECT
          COUNT(*) FILTER (WHERE status = 'recovered') as total_recovered,
          COUNT(*) as total_events,
          COALESCE(SUM(recovered_value), 0) as total_revenue_recovered,
          COALESCE(SUM(potential_value), 0) as total_revenue_at_risk,
          COALESCE(AVG(recovered_value), 0) as avg_recovery_value
         FROM recovery_events
         WHERE org_id = $1
         AND event_occurred_at >= $2
         AND event_occurred_at <= $3`,
        [orgId, start_date, end_date]
      );

      // Get campaign performance
      const campaignStatsResult = await db.query(
        `SELECT
          c.id,
          c.name,
          c.campaign_type,
          c.status,
          COUNT(e.id) as events_count,
          COUNT(e.id) FILTER (WHERE e.status = 'recovered') as recovered_count,
          COALESCE(SUM(e.recovered_value), 0) as revenue_recovered
         FROM recovery_campaigns c
         LEFT JOIN recovery_events e ON e.campaign_id = c.id
         WHERE c.org_id = $1
         GROUP BY c.id, c.name, c.campaign_type, c.status
         ORDER BY revenue_recovered DESC`,
        [orgId]
      );

      // Get events by type
      const eventsByTypeResult = await db.query(
        `SELECT
          event_type,
          COUNT(*) as count,
          COUNT(*) FILTER (WHERE status = 'recovered') as recovered,
          COALESCE(SUM(potential_value), 0) as value_at_risk,
          COALESCE(SUM(recovered_value), 0) as value_recovered
         FROM recovery_events
         WHERE org_id = $1
         AND event_occurred_at >= $2
         AND event_occurred_at <= $3
         GROUP BY event_type`,
        [orgId, start_date, end_date]
      );

      const summary = summaryResult.rows[0];

      return {
        summary: {
          total_events: parseInt(summary.total_events),
          total_recovered: parseInt(summary.total_recovered),
          total_revenue_recovered: parseFloat(summary.total_revenue_recovered),
          total_revenue_at_risk: parseFloat(summary.total_revenue_at_risk),
          avg_recovery_value: parseFloat(summary.avg_recovery_value),
          recovery_rate: summary.total_events > 0
            ? ((summary.total_recovered / summary.total_events) * 100).toFixed(2)
            : 0
        },
        timeline: analyticsResult.rows,
        campaigns: campaignStatsResult.rows,
        events_by_type: eventsByTypeResult.rows,
        date_range: {
          start_date,
          end_date,
          period_type
        }
      };
    } catch (error) {
      log.error('Failed to get recovery analytics', { orgId, error: error.message });
      throw error;
    }
  }
}

module.exports = new RecoveryService();
