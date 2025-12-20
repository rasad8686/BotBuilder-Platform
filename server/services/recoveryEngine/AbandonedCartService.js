/**
 * Abandoned Cart Recovery Service
 *
 * Handles detection, tracking, and recovery of abandoned shopping carts.
 * Includes AI-powered optimal timing and personalized offer generation.
 */

const db = require('../../db');
const log = require('../../utils/logger');
const RecoveryService = require('./RecoveryService');

/**
 * Default recovery sequence timing (in hours)
 */
const DEFAULT_SEQUENCE_TIMING = [2, 24, 48];

/**
 * Cart abandonment threshold (in minutes)
 */
const ABANDONMENT_THRESHOLD_MINUTES = 30;

class AbandonedCartService {
  /**
   * Detect abandoned cart from session data
   * @param {string} sessionId - Session identifier
   * @param {Object} cartData - Cart information
   * @returns {Object} Detected abandoned cart event
   */
  async detectAbandonedCart(sessionId, cartData) {
    const {
      org_id,
      customer_id,
      customer_email,
      customer_phone,
      customer_name,
      cart_id,
      items = [],
      cart_total,
      currency = 'USD',
      last_activity_at,
      checkout_started = false,
      source_platform
    } = cartData;

    if (!org_id || !customer_id || !cart_id) {
      throw new Error('org_id, customer_id, and cart_id are required');
    }

    try {
      // Check if cart was already tracked
      const existingEvent = await db.query(
        `SELECT id, status FROM recovery_events
         WHERE org_id = $1 AND customer_id = $2
         AND event_data->>'cart_id' = $3
         AND event_type = 'cart_abandoned'
         AND status NOT IN ('recovered', 'expired', 'opted_out')
         ORDER BY created_at DESC LIMIT 1`,
        [org_id, customer_id, cart_id]
      );

      if (existingEvent.rows.length > 0) {
        log.debug('Cart already tracked', { cartId: cart_id, eventId: existingEvent.rows[0].id });
        return { alreadyTracked: true, eventId: existingEvent.rows[0].id };
      }

      // Calculate time since last activity
      const lastActivity = new Date(last_activity_at || Date.now());
      const minutesSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60);

      // Check if cart is truly abandoned
      if (minutesSinceActivity < ABANDONMENT_THRESHOLD_MINUTES) {
        return { abandoned: false, minutesSinceActivity };
      }

      // Track the abandoned cart event
      const event = await RecoveryService.trackEvent(org_id, 'cart_abandoned', {
        customer_id,
        customer_email,
        customer_phone,
        customer_name,
        potential_value: cart_total,
        currency,
        source_platform,
        source_event_id: cart_id,
        event_occurred_at: lastActivity,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        data: {
          cart_id,
          session_id: sessionId,
          items,
          cart_total,
          item_count: items.length,
          checkout_started
        }
      });

      log.info('Abandoned cart detected', {
        orgId: org_id,
        cartId: cart_id,
        customerId: customer_id,
        cartTotal: cart_total
      });

      return {
        abandoned: true,
        eventId: event.id,
        cart_id,
        cart_total,
        item_count: items.length
      };
    } catch (error) {
      log.error('Failed to detect abandoned cart', { sessionId, error: error.message });
      throw error;
    }
  }

  /**
   * Create a recovery message sequence for abandoned cart
   * @param {string} cartId - Cart identifier
   * @param {string} customerId - Customer identifier
   * @returns {Object} Created recovery sequence
   */
  async createRecoverySequence(cartId, customerId) {
    try {
      // Find the abandoned cart event
      const eventResult = await db.query(
        `SELECT e.*, c.id as campaign_id, c.message_templates, c.channels
         FROM recovery_events e
         LEFT JOIN recovery_campaigns c ON e.campaign_id = c.id
         WHERE e.event_data->>'cart_id' = $1
         AND e.customer_id = $2
         AND e.event_type = 'cart_abandoned'
         ORDER BY e.created_at DESC LIMIT 1`,
        [cartId, customerId]
      );

      if (eventResult.rows.length === 0) {
        throw new Error('Abandoned cart event not found');
      }

      const event = eventResult.rows[0];
      const messageTemplates = event.message_templates || [];
      const channels = event.channels || ['email'];

      // Create sequence record
      const sequenceId = `seq_${cartId}_${Date.now()}`;

      // Create messages for each step in the sequence
      const messages = [];
      const timing = DEFAULT_SEQUENCE_TIMING;

      for (let i = 0; i < timing.length; i++) {
        const template = messageTemplates[i] || {};
        const channel = template.channel || channels[0] || 'email';

        const messageResult = await db.query(
          `INSERT INTO recovery_messages (
            org_id, campaign_id, event_id,
            customer_id, recipient_email, recipient_phone,
            channel, subject, message_body,
            template_id, sequence_number, status,
            scheduled_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12)
          RETURNING *`,
          [
            event.org_id,
            event.campaign_id,
            event.id,
            customerId,
            event.customer_email,
            event.customer_phone,
            channel,
            template.subject || `Don't forget your items!`,
            template.body || `You left items in your cart. Complete your purchase now!`,
            template.template_id || null,
            i + 1,
            new Date(Date.now() + timing[i] * 60 * 60 * 1000)
          ]
        );

        messages.push(messageResult.rows[0]);
      }

      log.info('Recovery sequence created', {
        sequenceId,
        cartId,
        customerId,
        messageCount: messages.length
      });

      return {
        sequence_id: sequenceId,
        event_id: event.id,
        cart_id: cartId,
        customer_id: customerId,
        messages,
        timing
      };
    } catch (error) {
      log.error('Failed to create recovery sequence', { cartId, customerId, error: error.message });
      throw error;
    }
  }

  /**
   * Schedule recovery messages with specified timing
   * @param {string} sequenceId - Sequence identifier (event_id)
   * @param {Array} timing - Array of delay hours [2, 24, 48]
   * @returns {Object} Scheduled messages
   */
  async scheduleRecoveryMessages(sequenceId, timing = DEFAULT_SEQUENCE_TIMING) {
    try {
      // Get pending messages for this sequence/event
      const messagesResult = await db.query(
        `SELECT * FROM recovery_messages
         WHERE event_id = $1
         AND status = 'pending'
         ORDER BY sequence_number ASC`,
        [sequenceId]
      );

      if (messagesResult.rows.length === 0) {
        throw new Error('No pending messages found for sequence');
      }

      const scheduledMessages = [];
      const now = Date.now();

      for (let i = 0; i < messagesResult.rows.length; i++) {
        const message = messagesResult.rows[i];
        const delayHours = timing[i] || timing[timing.length - 1];
        const scheduledAt = new Date(now + delayHours * 60 * 60 * 1000);

        await db.query(
          `UPDATE recovery_messages
           SET scheduled_at = $1, status = 'queued', updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [scheduledAt, message.id]
        );

        scheduledMessages.push({
          message_id: message.id,
          sequence_number: message.sequence_number,
          channel: message.channel,
          scheduled_at: scheduledAt,
          delay_hours: delayHours
        });
      }

      log.info('Recovery messages scheduled', {
        sequenceId,
        messageCount: scheduledMessages.length,
        timing
      });

      return {
        sequence_id: sequenceId,
        scheduled_messages: scheduledMessages
      };
    } catch (error) {
      log.error('Failed to schedule recovery messages', { sequenceId, error: error.message });
      throw error;
    }
  }

  /**
   * Calculate optimal timing for recovery messages using AI
   * @param {string} customerId - Customer identifier
   * @returns {Object} Optimal timing recommendations
   */
  async calculateOptimalTiming(customerId) {
    try {
      // Get customer's historical engagement data
      const engagementResult = await db.query(
        `SELECT
          EXTRACT(HOUR FROM opened_at) as open_hour,
          EXTRACT(DOW FROM opened_at) as open_day,
          COUNT(*) as open_count
         FROM recovery_messages
         WHERE customer_id = $1
         AND opened_at IS NOT NULL
         GROUP BY EXTRACT(HOUR FROM opened_at), EXTRACT(DOW FROM opened_at)
         ORDER BY open_count DESC
         LIMIT 10`,
        [customerId]
      );

      // Get customer's purchase patterns
      const purchaseResult = await db.query(
        `SELECT
          EXTRACT(HOUR FROM converted_at) as purchase_hour,
          EXTRACT(DOW FROM converted_at) as purchase_day,
          COUNT(*) as purchase_count
         FROM recovery_messages
         WHERE customer_id = $1
         AND converted_at IS NOT NULL
         GROUP BY EXTRACT(HOUR FROM converted_at), EXTRACT(DOW FROM converted_at)
         ORDER BY purchase_count DESC
         LIMIT 5`,
        [customerId]
      );

      // Default optimal times if no data
      let optimalHours = [10, 14, 19]; // 10 AM, 2 PM, 7 PM
      let optimalDays = [2, 4, 6]; // Tuesday, Thursday, Saturday

      // Analyze engagement data
      if (engagementResult.rows.length > 0) {
        const hourCounts = {};
        const dayCounts = {};

        engagementResult.rows.forEach(row => {
          const hour = parseInt(row.open_hour);
          const day = parseInt(row.open_day);
          hourCounts[hour] = (hourCounts[hour] || 0) + parseInt(row.open_count);
          dayCounts[day] = (dayCounts[day] || 0) + parseInt(row.open_count);
        });

        // Get top 3 hours
        optimalHours = Object.entries(hourCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([hour]) => parseInt(hour));

        // Get top 3 days
        optimalDays = Object.entries(dayCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([day]) => parseInt(day));
      }

      // Calculate recommended sequence timing
      const now = new Date();
      const currentHour = now.getHours();

      // Find next optimal send time
      let firstSendHour = optimalHours.find(h => h > currentHour) || optimalHours[0];
      let hoursUntilFirst = firstSendHour > currentHour
        ? firstSendHour - currentHour
        : 24 - currentHour + firstSendHour;

      // Ensure minimum 2 hour delay
      if (hoursUntilFirst < 2) {
        hoursUntilFirst = 2;
      }

      const recommendedTiming = [
        hoursUntilFirst,
        hoursUntilFirst + 24,
        hoursUntilFirst + 48
      ];

      log.info('Optimal timing calculated', { customerId, optimalHours, optimalDays });

      return {
        customer_id: customerId,
        optimal_hours: optimalHours,
        optimal_days: optimalDays,
        recommended_timing: recommendedTiming,
        confidence: engagementResult.rows.length > 5 ? 'high' : engagementResult.rows.length > 0 ? 'medium' : 'low',
        data_points: engagementResult.rows.length
      };
    } catch (error) {
      log.error('Failed to calculate optimal timing', { customerId, error: error.message });
      throw error;
    }
  }

  /**
   * Generate personalized offer based on cart and customer history
   * @param {Object} cartData - Cart information
   * @param {Object} customerHistory - Customer purchase history
   * @returns {Object} Personalized offer
   */
  async generatePersonalizedOffer(cartData, customerHistory) {
    const {
      cart_total,
      items = [],
      currency = 'USD'
    } = cartData;

    const {
      total_orders = 0,
      lifetime_value = 0,
      average_order_value = 0,
      last_purchase_days_ago = null,
      recovery_history = []
    } = customerHistory;

    try {
      let offerType = 'none';
      let offerValue = 0;
      let offerCode = null;
      let offerMessage = '';
      let urgency = 'normal';

      // Determine offer based on customer value and behavior
      const isHighValue = lifetime_value > 500 || total_orders > 5;
      const isNewCustomer = total_orders === 0;
      const isAtRisk = last_purchase_days_ago !== null && last_purchase_days_ago > 60;
      const previousRecoveryFailed = recovery_history.some(r => r.status === 'failed');

      // High value cart (> $100)
      if (cart_total > 100) {
        if (isHighValue) {
          offerType = 'percentage_discount';
          offerValue = 15;
          offerMessage = 'As a valued customer, enjoy 15% off your order!';
          urgency = 'high';
        } else if (isNewCustomer) {
          offerType = 'percentage_discount';
          offerValue = 10;
          offerMessage = 'Complete your first order and get 10% off!';
        } else {
          offerType = 'free_shipping';
          offerValue = 0;
          offerMessage = 'Complete your order now and get FREE shipping!';
        }
      }
      // Medium value cart ($50-$100)
      else if (cart_total >= 50) {
        if (isAtRisk || previousRecoveryFailed) {
          offerType = 'percentage_discount';
          offerValue = 20;
          offerMessage = 'We miss you! Here\'s 20% off to welcome you back.';
          urgency = 'critical';
        } else {
          offerType = 'fixed_discount';
          offerValue = 10;
          offerMessage = 'Complete your purchase and save $10!';
        }
      }
      // Lower value cart (< $50)
      else {
        if (isNewCustomer) {
          offerType = 'percentage_discount';
          offerValue = 5;
          offerMessage = 'First time? Enjoy 5% off your order!';
        } else {
          offerType = 'none';
          offerMessage = 'Your items are waiting! Complete your order now.';
        }
      }

      // Generate unique offer code
      if (offerType !== 'none') {
        offerCode = `RECOVER${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      }

      // Calculate final price if discount applies
      let discountAmount = 0;
      if (offerType === 'percentage_discount') {
        discountAmount = cart_total * (offerValue / 100);
      } else if (offerType === 'fixed_discount') {
        discountAmount = offerValue;
      }

      const finalTotal = Math.max(0, cart_total - discountAmount);

      log.info('Personalized offer generated', {
        cartTotal: cart_total,
        offerType,
        offerValue,
        isHighValue,
        isNewCustomer
      });

      return {
        offer_type: offerType,
        offer_value: offerValue,
        offer_code: offerCode,
        offer_message: offerMessage,
        urgency,
        discount_amount: discountAmount,
        original_total: cart_total,
        final_total: finalTotal,
        currency,
        expires_in_hours: 48,
        personalization_factors: {
          is_high_value: isHighValue,
          is_new_customer: isNewCustomer,
          is_at_risk: isAtRisk,
          previous_recovery_failed: previousRecoveryFailed
        }
      };
    } catch (error) {
      log.error('Failed to generate personalized offer', { error: error.message });
      throw error;
    }
  }

  /**
   * Track cart recovery status
   * @param {string} cartId - Cart identifier
   * @param {string} status - Recovery status
   * @returns {Object} Updated recovery event
   */
  async trackCartRecovery(cartId, status) {
    const validStatuses = ['recovered', 'partially_recovered', 'failed', 'expired', 'opted_out'];

    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Valid: ${validStatuses.join(', ')}`);
    }

    try {
      const result = await db.query(
        `UPDATE recovery_events
         SET status = $1,
             recovered_at = CASE WHEN $1 IN ('recovered', 'partially_recovered') THEN CURRENT_TIMESTAMP ELSE recovered_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE event_data->>'cart_id' = $2
         AND event_type = 'cart_abandoned'
         RETURNING *`,
        [status, cartId]
      );

      if (result.rows.length === 0) {
        throw new Error('Cart recovery event not found');
      }

      // Cancel pending messages if recovered or opted out
      if (['recovered', 'opted_out', 'expired'].includes(status)) {
        await db.query(
          `UPDATE recovery_messages
           SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
           WHERE event_id = $1
           AND status IN ('pending', 'queued')`,
          [result.rows[0].id]
        );
      }

      log.info('Cart recovery status updated', { cartId, status });

      return result.rows[0];
    } catch (error) {
      log.error('Failed to track cart recovery', { cartId, status, error: error.message });
      throw error;
    }
  }

  /**
   * Get abandoned carts for an organization
   * @param {number} orgId - Organization ID
   * @param {Object} filters - Filter options
   * @returns {Object} List of abandoned carts
   */
  async getAbandonedCarts(orgId, filters = {}) {
    const {
      status,
      min_value,
      max_value,
      start_date,
      end_date,
      limit = 50,
      offset = 0
    } = filters;

    try {
      let query = `
        SELECT
          e.*,
          e.event_data->>'cart_id' as cart_id,
          e.event_data->>'items' as items,
          e.event_data->>'cart_total' as cart_total,
          e.event_data->>'item_count' as item_count,
          (SELECT COUNT(*) FROM recovery_messages rm WHERE rm.event_id = e.id) as message_count,
          (SELECT COUNT(*) FROM recovery_messages rm WHERE rm.event_id = e.id AND rm.status = 'sent') as messages_sent
        FROM recovery_events e
        WHERE e.org_id = $1
        AND e.event_type = 'cart_abandoned'
      `;
      const params = [orgId];
      let paramIndex = 2;

      if (status) {
        query += ` AND e.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (min_value !== undefined) {
        query += ` AND e.potential_value >= $${paramIndex}`;
        params.push(min_value);
        paramIndex++;
      }

      if (max_value !== undefined) {
        query += ` AND e.potential_value <= $${paramIndex}`;
        params.push(max_value);
        paramIndex++;
      }

      if (start_date) {
        query += ` AND e.event_occurred_at >= $${paramIndex}`;
        params.push(start_date);
        paramIndex++;
      }

      if (end_date) {
        query += ` AND e.event_occurred_at <= $${paramIndex}`;
        params.push(end_date);
        paramIndex++;
      }

      query += ` ORDER BY e.event_occurred_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) FROM recovery_events
        WHERE org_id = $1 AND event_type = 'cart_abandoned'
      `;
      const countParams = [orgId];

      if (status) {
        countQuery += ` AND status = $2`;
        countParams.push(status);
      }

      const countResult = await db.query(countQuery, countParams);

      return {
        carts: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit,
        offset
      };
    } catch (error) {
      log.error('Failed to get abandoned carts', { orgId, error: error.message });
      throw error;
    }
  }

  /**
   * Get cart recovery rate for an organization
   * @param {number} orgId - Organization ID
   * @param {Object} dateRange - Date range for calculation
   * @returns {Object} Recovery rate statistics
   */
  async getRecoveryRate(orgId, dateRange = {}) {
    const {
      start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end_date = new Date()
    } = dateRange;

    try {
      const result = await db.query(
        `SELECT
          COUNT(*) as total_abandoned,
          COUNT(*) FILTER (WHERE status = 'recovered') as fully_recovered,
          COUNT(*) FILTER (WHERE status = 'partially_recovered') as partially_recovered,
          COUNT(*) FILTER (WHERE status IN ('failed', 'expired')) as lost,
          COUNT(*) FILTER (WHERE status IN ('pending', 'processing', 'message_sent')) as in_progress,
          COALESCE(SUM(potential_value), 0) as total_value_at_risk,
          COALESCE(SUM(recovered_value), 0) as total_value_recovered,
          COALESCE(SUM(CASE WHEN status = 'recovered' THEN potential_value ELSE 0 END), 0) as full_recovery_value,
          COALESCE(AVG(potential_value), 0) as avg_cart_value,
          COALESCE(AVG(CASE WHEN status = 'recovered' THEN recovered_value ELSE NULL END), 0) as avg_recovered_value
         FROM recovery_events
         WHERE org_id = $1
         AND event_type = 'cart_abandoned'
         AND event_occurred_at >= $2
         AND event_occurred_at <= $3`,
        [orgId, start_date, end_date]
      );

      const stats = result.rows[0];
      const totalAbandoned = parseInt(stats.total_abandoned);
      const totalRecovered = parseInt(stats.fully_recovered) + parseInt(stats.partially_recovered);

      // Calculate rates
      const recoveryRate = totalAbandoned > 0 ? ((totalRecovered / totalAbandoned) * 100).toFixed(2) : 0;
      const valueRecoveryRate = parseFloat(stats.total_value_at_risk) > 0
        ? ((parseFloat(stats.total_value_recovered) / parseFloat(stats.total_value_at_risk)) * 100).toFixed(2)
        : 0;

      // Get daily breakdown
      const dailyResult = await db.query(
        `SELECT
          DATE(event_occurred_at) as date,
          COUNT(*) as abandoned,
          COUNT(*) FILTER (WHERE status IN ('recovered', 'partially_recovered')) as recovered,
          COALESCE(SUM(potential_value), 0) as value_at_risk,
          COALESCE(SUM(recovered_value), 0) as value_recovered
         FROM recovery_events
         WHERE org_id = $1
         AND event_type = 'cart_abandoned'
         AND event_occurred_at >= $2
         AND event_occurred_at <= $3
         GROUP BY DATE(event_occurred_at)
         ORDER BY DATE(event_occurred_at) ASC`,
        [orgId, start_date, end_date]
      );

      return {
        summary: {
          total_abandoned: totalAbandoned,
          fully_recovered: parseInt(stats.fully_recovered),
          partially_recovered: parseInt(stats.partially_recovered),
          lost: parseInt(stats.lost),
          in_progress: parseInt(stats.in_progress),
          recovery_rate: parseFloat(recoveryRate),
          value_recovery_rate: parseFloat(valueRecoveryRate),
          total_value_at_risk: parseFloat(stats.total_value_at_risk),
          total_value_recovered: parseFloat(stats.total_value_recovered),
          avg_cart_value: parseFloat(stats.avg_cart_value),
          avg_recovered_value: parseFloat(stats.avg_recovered_value)
        },
        daily_breakdown: dailyResult.rows,
        date_range: {
          start_date,
          end_date
        }
      };
    } catch (error) {
      log.error('Failed to get recovery rate', { orgId, error: error.message });
      throw error;
    }
  }
}

module.exports = new AbandonedCartService();
