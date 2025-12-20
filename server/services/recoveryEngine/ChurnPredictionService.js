/**
 * Churn Prediction AI Service
 *
 * AI-powered customer churn prediction and prevention.
 * Analyzes customer behavior to identify at-risk customers
 * and generates retention strategies.
 */

const db = require('../../db');
const log = require('../../utils/logger');

/**
 * Risk signal types
 */
const RISK_SIGNALS = [
  'login_decrease',
  'usage_drop',
  'support_tickets',
  'negative_feedback',
  'payment_issues',
  'competitor_mention'
];

/**
 * Health score weights for different factors
 */
const SCORE_WEIGHTS = {
  engagement: 0.25,
  financial: 0.25,
  satisfaction: 0.20,
  tenure: 0.15,
  activity: 0.15
};

class ChurnPredictionService {
  /**
   * Calculate customer health score (0-100)
   * @param {string} customerId - Customer identifier
   * @param {number} orgId - Organization ID
   * @returns {Object} Health score and breakdown
   */
  async calculateHealthScore(customerId, orgId) {
    try {
      // Get customer data
      const customerResult = await db.query(
        `SELECT * FROM customer_health_scores
         WHERE customer_id = $1 AND org_id = $2
         ORDER BY calculated_at DESC LIMIT 1`,
        [customerId, orgId]
      );

      // Get engagement data
      const engagement = await this.analyzeEngagement(customerId, 30);

      // Get churn signals
      const signals = await this.detectChurnSignals(customerId, orgId);

      // Calculate component scores
      const engagementScore = this._calculateEngagementScore(engagement);
      const financialScore = await this._calculateFinancialScore(customerId, orgId);
      const satisfactionScore = await this._calculateSatisfactionScore(customerId, orgId);
      const tenureScore = await this._calculateTenureScore(customerId, orgId);
      const activityScore = this._calculateActivityScore(engagement);

      // Apply signal penalties
      const signalPenalty = signals.length * 5; // -5 points per signal

      // Calculate weighted score
      const rawScore = (
        engagementScore * SCORE_WEIGHTS.engagement +
        financialScore * SCORE_WEIGHTS.financial +
        satisfactionScore * SCORE_WEIGHTS.satisfaction +
        tenureScore * SCORE_WEIGHTS.tenure +
        activityScore * SCORE_WEIGHTS.activity
      );

      const healthScore = Math.max(0, Math.min(100, Math.round(rawScore - signalPenalty)));

      // Determine grade
      const healthGrade = this._getHealthGrade(healthScore);

      // Calculate churn probability
      const churnProbability = this.predictChurnProbability(healthScore, signals);

      // Risk level
      const riskLevel = this.categorizeRisk(healthScore);

      const result = {
        customer_id: customerId,
        org_id: orgId,
        health_score: healthScore,
        health_grade: healthGrade,
        churn_probability: churnProbability,
        churn_risk_level: riskLevel,
        score_breakdown: {
          engagement: Math.round(engagementScore),
          financial: Math.round(financialScore),
          satisfaction: Math.round(satisfactionScore),
          tenure: Math.round(tenureScore),
          activity: Math.round(activityScore)
        },
        risk_factors: signals,
        signal_penalty: signalPenalty,
        calculated_at: new Date()
      };

      // Save to database
      await this._saveHealthScore(result);

      // Update history
      await this.updateHealthScoreHistory(customerId, healthScore, orgId);

      log.info('Health score calculated', { customerId, healthScore, riskLevel });

      return result;
    } catch (error) {
      log.error('Failed to calculate health score', { customerId, error: error.message });
      throw error;
    }
  }

  /**
   * Analyze customer engagement over specified days
   * @param {string} customerId - Customer identifier
   * @param {number} days - Number of days to analyze
   * @returns {Object} Engagement metrics
   */
  async analyzeEngagement(customerId, days = 30) {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Get message engagement
      const messageResult = await db.query(
        `SELECT
          COUNT(*) as total_messages,
          COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opened,
          COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicked,
          COUNT(*) FILTER (WHERE converted_at IS NOT NULL) as converted
         FROM recovery_messages
         WHERE customer_id = $1
         AND created_at >= $2`,
        [customerId, startDate]
      );

      // Get event activity
      const eventResult = await db.query(
        `SELECT
          COUNT(*) as total_events,
          COUNT(DISTINCT DATE(event_occurred_at)) as active_days,
          MAX(event_occurred_at) as last_activity
         FROM recovery_events
         WHERE customer_id = $1
         AND event_occurred_at >= $2`,
        [customerId, startDate]
      );

      const messages = messageResult.rows[0];
      const events = eventResult.rows[0];

      // Calculate engagement metrics
      const totalMessages = parseInt(messages.total_messages) || 0;
      const openRate = totalMessages > 0 ? (parseInt(messages.opened) / totalMessages) * 100 : 0;
      const clickRate = totalMessages > 0 ? (parseInt(messages.clicked) / totalMessages) * 100 : 0;
      const conversionRate = totalMessages > 0 ? (parseInt(messages.converted) / totalMessages) * 100 : 0;

      const activeDays = parseInt(events.active_days) || 0;
      const activityRate = (activeDays / days) * 100;

      const daysSinceActivity = events.last_activity
        ? Math.floor((Date.now() - new Date(events.last_activity).getTime()) / (1000 * 60 * 60 * 24))
        : days;

      return {
        period_days: days,
        total_messages: totalMessages,
        messages_opened: parseInt(messages.opened) || 0,
        messages_clicked: parseInt(messages.clicked) || 0,
        messages_converted: parseInt(messages.converted) || 0,
        open_rate: parseFloat(openRate.toFixed(2)),
        click_rate: parseFloat(clickRate.toFixed(2)),
        conversion_rate: parseFloat(conversionRate.toFixed(2)),
        total_events: parseInt(events.total_events) || 0,
        active_days: activeDays,
        activity_rate: parseFloat(activityRate.toFixed(2)),
        days_since_activity: daysSinceActivity,
        last_activity: events.last_activity
      };
    } catch (error) {
      log.error('Failed to analyze engagement', { customerId, days, error: error.message });
      throw error;
    }
  }

  /**
   * Detect churn warning signals
   * @param {string} customerId - Customer identifier
   * @param {number} orgId - Organization ID
   * @returns {Array} Detected risk signals
   */
  async detectChurnSignals(customerId, orgId) {
    const signals = [];

    try {
      // Check login decrease (compare last 7 days vs previous 7 days)
      const recentEngagement = await this.analyzeEngagement(customerId, 7);
      const previousEngagement = await this.analyzeEngagement(customerId, 14);

      if (previousEngagement.active_days > 0) {
        const recentActivity = recentEngagement.active_days;
        const previousActivity = previousEngagement.active_days - recentEngagement.active_days;

        if (previousActivity > 0 && recentActivity < previousActivity * 0.5) {
          signals.push({
            type: 'login_decrease',
            severity: 'high',
            description: 'Login frequency decreased by more than 50%',
            data: { recent: recentActivity, previous: previousActivity }
          });
        }
      }

      // Check usage drop
      if (recentEngagement.days_since_activity > 7) {
        signals.push({
          type: 'usage_drop',
          severity: recentEngagement.days_since_activity > 14 ? 'critical' : 'medium',
          description: `No activity for ${recentEngagement.days_since_activity} days`,
          data: { days_inactive: recentEngagement.days_since_activity }
        });
      }

      // Check support tickets
      const ticketResult = await db.query(
        `SELECT COUNT(*) as ticket_count
         FROM recovery_events
         WHERE customer_id = $1
         AND org_id = $2
         AND event_type = 'negative_sentiment'
         AND event_occurred_at >= NOW() - INTERVAL '30 days'`,
        [customerId, orgId]
      );

      const ticketCount = parseInt(ticketResult.rows[0].ticket_count);
      if (ticketCount >= 3) {
        signals.push({
          type: 'support_tickets',
          severity: ticketCount >= 5 ? 'critical' : 'high',
          description: `${ticketCount} support issues in last 30 days`,
          data: { ticket_count: ticketCount }
        });
      }

      // Check negative feedback
      const feedbackResult = await db.query(
        `SELECT COUNT(*) as negative_count
         FROM recovery_events
         WHERE customer_id = $1
         AND org_id = $2
         AND event_type = 'negative_sentiment'
         AND event_occurred_at >= NOW() - INTERVAL '60 days'`,
        [customerId, orgId]
      );

      const negativeCount = parseInt(feedbackResult.rows[0].negative_count);
      if (negativeCount > 0) {
        signals.push({
          type: 'negative_feedback',
          severity: negativeCount >= 2 ? 'high' : 'medium',
          description: `${negativeCount} negative feedback instances`,
          data: { negative_count: negativeCount }
        });
      }

      // Check payment issues
      const paymentResult = await db.query(
        `SELECT COUNT(*) as failed_count
         FROM recovery_events
         WHERE customer_id = $1
         AND org_id = $2
         AND event_type = 'payment_failed'
         AND event_occurred_at >= NOW() - INTERVAL '30 days'`,
        [customerId, orgId]
      );

      const failedPayments = parseInt(paymentResult.rows[0].failed_count);
      if (failedPayments > 0) {
        signals.push({
          type: 'payment_issues',
          severity: failedPayments >= 2 ? 'critical' : 'high',
          description: `${failedPayments} failed payments in last 30 days`,
          data: { failed_count: failedPayments }
        });
      }

      // Check for competitor mentions in feedback
      const competitorResult = await db.query(
        `SELECT COUNT(*) as mention_count
         FROM recovery_events
         WHERE customer_id = $1
         AND org_id = $2
         AND event_data::text ILIKE '%competitor%'
         AND event_occurred_at >= NOW() - INTERVAL '90 days'`,
        [customerId, orgId]
      );

      const competitorMentions = parseInt(competitorResult.rows[0].mention_count);
      if (competitorMentions > 0) {
        signals.push({
          type: 'competitor_mention',
          severity: 'high',
          description: 'Customer mentioned competitors',
          data: { mention_count: competitorMentions }
        });
      }

      log.debug('Churn signals detected', { customerId, signalCount: signals.length });

      return signals;
    } catch (error) {
      log.error('Failed to detect churn signals', { customerId, error: error.message });
      throw error;
    }
  }

  /**
   * Predict churn probability
   * @param {number} healthScore - Customer health score
   * @param {Array} signals - Risk signals
   * @returns {number} Churn probability (0-1)
   */
  predictChurnProbability(healthScore, signals = []) {
    // Base probability from health score (inverse relationship)
    let baseProbability = (100 - healthScore) / 100;

    // Adjust for signals
    const signalMultiplier = signals.reduce((mult, signal) => {
      switch (signal.severity) {
        case 'critical': return mult * 1.3;
        case 'high': return mult * 1.2;
        case 'medium': return mult * 1.1;
        default: return mult * 1.05;
      }
    }, 1);

    let probability = baseProbability * signalMultiplier;

    // Cap at 0.95 (never 100% certain)
    probability = Math.min(0.95, Math.max(0, probability));

    return parseFloat(probability.toFixed(4));
  }

  /**
   * Categorize risk level based on score
   * @param {number} score - Health score (0-100)
   * @returns {string} Risk level
   */
  categorizeRisk(score) {
    if (score >= 80) return 'very_low';
    if (score >= 60) return 'low';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'high';
    return 'critical';
  }

  /**
   * Generate retention strategy based on risk level
   * @param {string} customerId - Customer identifier
   * @param {string} riskLevel - Risk category
   * @returns {Object} Retention strategy
   */
  async generateRetentionStrategy(customerId, riskLevel) {
    const strategies = {
      critical: {
        priority: 'immediate',
        actions: [
          { type: 'personal_call', description: 'Schedule personal call with account manager', timing: 'within_24h' },
          { type: 'executive_outreach', description: 'Executive-level intervention', timing: 'within_48h' },
          { type: 'custom_offer', description: 'Prepare significant retention offer (30-50% discount)', discount: 40 },
          { type: 'feedback_session', description: 'Request detailed feedback session', timing: 'within_week' }
        ],
        messaging: {
          tone: 'urgent_caring',
          emphasis: 'value_and_partnership',
          offer_aggressiveness: 'high'
        }
      },
      high: {
        priority: 'urgent',
        actions: [
          { type: 'account_review', description: 'Proactive account health review', timing: 'within_48h' },
          { type: 'success_call', description: 'Customer success check-in call', timing: 'within_week' },
          { type: 'retention_offer', description: 'Prepare retention offer (20-30% discount)', discount: 25 },
          { type: 'feature_training', description: 'Offer personalized feature training', timing: 'within_2weeks' }
        ],
        messaging: {
          tone: 'proactive_helpful',
          emphasis: 'value_realization',
          offer_aggressiveness: 'medium'
        }
      },
      medium: {
        priority: 'proactive',
        actions: [
          { type: 'engagement_campaign', description: 'Start re-engagement email campaign', timing: 'within_week' },
          { type: 'value_highlight', description: 'Send ROI/value report', timing: 'within_2weeks' },
          { type: 'loyalty_offer', description: 'Offer loyalty discount (10-15%)', discount: 12 },
          { type: 'webinar_invite', description: 'Invite to exclusive webinar/training', timing: 'within_month' }
        ],
        messaging: {
          tone: 'friendly_engaging',
          emphasis: 'feature_benefits',
          offer_aggressiveness: 'low'
        }
      },
      low: {
        priority: 'nurture',
        actions: [
          { type: 'newsletter', description: 'Include in premium newsletter', timing: 'ongoing' },
          { type: 'feature_updates', description: 'Share new feature announcements', timing: 'as_released' },
          { type: 'referral_program', description: 'Invite to referral program', timing: 'within_month' },
          { type: 'feedback_request', description: 'Request product feedback', timing: 'quarterly' }
        ],
        messaging: {
          tone: 'appreciative',
          emphasis: 'partnership_growth',
          offer_aggressiveness: 'none'
        }
      },
      very_low: {
        priority: 'maintain',
        actions: [
          { type: 'advocacy', description: 'Invite to customer advocacy program', timing: 'within_month' },
          { type: 'case_study', description: 'Request case study participation', timing: 'within_quarter' },
          { type: 'beta_access', description: 'Offer early access to new features', timing: 'ongoing' },
          { type: 'upsell', description: 'Present upgrade opportunities', timing: 'when_appropriate' }
        ],
        messaging: {
          tone: 'celebratory',
          emphasis: 'growth_partnership',
          offer_aggressiveness: 'none'
        }
      }
    };

    const strategy = strategies[riskLevel] || strategies.medium;

    log.info('Retention strategy generated', { customerId, riskLevel, priority: strategy.priority });

    return {
      customer_id: customerId,
      risk_level: riskLevel,
      ...strategy,
      generated_at: new Date()
    };
  }

  /**
   * Schedule proactive outreach based on strategy
   * @param {string} customerId - Customer identifier
   * @param {Object} strategy - Retention strategy
   * @returns {Object} Scheduled outreach plan
   */
  async scheduleProactiveOutreach(customerId, strategy) {
    try {
      const { actions, priority, messaging } = strategy;
      const scheduledActions = [];

      const now = new Date();

      for (const action of actions) {
        let scheduledAt;

        // Calculate scheduled time based on timing
        switch (action.timing) {
          case 'within_24h':
            scheduledAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            break;
          case 'within_48h':
            scheduledAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
            break;
          case 'within_week':
            scheduledAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            break;
          case 'within_2weeks':
            scheduledAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
            break;
          case 'within_month':
            scheduledAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            break;
          case 'within_quarter':
            scheduledAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
            break;
          default:
            scheduledAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        }

        scheduledActions.push({
          action_type: action.type,
          description: action.description,
          scheduled_at: scheduledAt,
          priority,
          status: 'scheduled',
          discount: action.discount || null
        });
      }

      // Store outreach plan in recovery_events
      const outreachResult = await db.query(
        `INSERT INTO recovery_events (
          org_id, customer_id, event_type, status,
          event_data, event_occurred_at
        )
        SELECT
          (SELECT org_id FROM customer_health_scores WHERE customer_id = $1 LIMIT 1),
          $1, 'churn_risk', 'processing',
          $2, CURRENT_TIMESTAMP
        RETURNING *`,
        [customerId, JSON.stringify({
          strategy,
          scheduled_actions: scheduledActions,
          messaging
        })]
      );

      log.info('Proactive outreach scheduled', {
        customerId,
        actionCount: scheduledActions.length,
        priority
      });

      return {
        customer_id: customerId,
        outreach_id: outreachResult.rows[0]?.id,
        scheduled_actions: scheduledActions,
        messaging,
        priority,
        created_at: now
      };
    } catch (error) {
      log.error('Failed to schedule proactive outreach', { customerId, error: error.message });
      throw error;
    }
  }

  /**
   * Get customers at risk above threshold
   * @param {number} orgId - Organization ID
   * @param {number} threshold - Risk threshold (churn probability)
   * @returns {Object} At-risk customers list
   */
  async getAtRiskCustomers(orgId, threshold = 0.5) {
    try {
      const result = await db.query(
        `SELECT
          chs.*,
          (SELECT COUNT(*) FROM recovery_events re
           WHERE re.customer_id = chs.customer_id
           AND re.org_id = chs.org_id
           AND re.event_type = 'churn_risk'
           AND re.status = 'processing') as active_interventions
         FROM customer_health_scores chs
         WHERE chs.org_id = $1
         AND chs.churn_probability >= $2
         ORDER BY chs.churn_probability DESC, chs.health_score ASC`,
        [orgId, threshold]
      );

      // Group by risk level
      const byRiskLevel = {
        critical: [],
        high: [],
        medium: []
      };

      result.rows.forEach(customer => {
        if (customer.churn_risk_level === 'critical') {
          byRiskLevel.critical.push(customer);
        } else if (customer.churn_risk_level === 'high') {
          byRiskLevel.high.push(customer);
        } else {
          byRiskLevel.medium.push(customer);
        }
      });

      return {
        total_at_risk: result.rows.length,
        threshold,
        by_risk_level: byRiskLevel,
        customers: result.rows,
        summary: {
          critical_count: byRiskLevel.critical.length,
          high_count: byRiskLevel.high.length,
          medium_count: byRiskLevel.medium.length
        }
      };
    } catch (error) {
      log.error('Failed to get at-risk customers', { orgId, error: error.message });
      throw error;
    }
  }

  /**
   * Update health score history
   * @param {string} customerId - Customer identifier
   * @param {number} score - New health score
   * @param {number} orgId - Organization ID
   * @returns {Object} Updated history record
   */
  async updateHealthScoreHistory(customerId, score, orgId) {
    try {
      // Get current health score record
      const currentResult = await db.query(
        `SELECT id, health_score, health_grade, churn_probability, churn_risk_level
         FROM customer_health_scores
         WHERE customer_id = $1 AND org_id = $2
         ORDER BY calculated_at DESC LIMIT 1`,
        [customerId, orgId]
      );

      if (currentResult.rows.length === 0) {
        return null;
      }

      const current = currentResult.rows[0];

      // Insert history record
      const historyResult = await db.query(
        `INSERT INTO customer_health_score_history (
          customer_health_id, org_id, customer_id,
          health_score, health_grade, churn_probability, churn_risk_level,
          recorded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          current.id, orgId, customerId,
          score, current.health_grade, current.churn_probability, current.churn_risk_level
        ]
      );

      // Update score trend
      const trendResult = await db.query(
        `SELECT health_score FROM customer_health_score_history
         WHERE customer_id = $1 AND org_id = $2
         ORDER BY recorded_at DESC LIMIT 5`,
        [customerId, orgId]
      );

      let trend = 'stable';
      if (trendResult.rows.length >= 2) {
        const scores = trendResult.rows.map(r => r.health_score);
        const avgRecent = scores.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
        const avgOlder = scores.slice(2).reduce((a, b) => a + b, 0) / Math.max(1, scores.length - 2);

        if (avgRecent > avgOlder + 5) trend = 'improving';
        else if (avgRecent < avgOlder - 10) trend = 'critical_decline';
        else if (avgRecent < avgOlder - 5) trend = 'declining';
      }

      // Update trend in main record
      await db.query(
        `UPDATE customer_health_scores
         SET score_trend = $1, previous_score = $2, score_change = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [trend, current.health_score, score - current.health_score, current.id]
      );

      log.debug('Health score history updated', { customerId, score, trend });

      return {
        history_id: historyResult.rows[0].id,
        score,
        trend,
        previous_score: current.health_score,
        change: score - current.health_score
      };
    } catch (error) {
      log.error('Failed to update health score history', { customerId, error: error.message });
      throw error;
    }
  }

  /**
   * Get churn analytics for organization
   * @param {number} orgId - Organization ID
   * @param {Object} dateRange - Date range for analytics
   * @returns {Object} Churn analytics
   */
  async getChurnAnalytics(orgId, dateRange = {}) {
    const {
      start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end_date = new Date()
    } = dateRange;

    try {
      // Get overall stats
      const overallResult = await db.query(
        `SELECT
          COUNT(*) as total_customers,
          AVG(health_score) as avg_health_score,
          AVG(churn_probability) as avg_churn_probability,
          COUNT(*) FILTER (WHERE churn_risk_level = 'critical') as critical_count,
          COUNT(*) FILTER (WHERE churn_risk_level = 'high') as high_count,
          COUNT(*) FILTER (WHERE churn_risk_level = 'medium') as medium_count,
          COUNT(*) FILTER (WHERE churn_risk_level = 'low') as low_count,
          COUNT(*) FILTER (WHERE churn_risk_level = 'very_low') as very_low_count
         FROM customer_health_scores
         WHERE org_id = $1`,
        [orgId]
      );

      // Get trend over time
      const trendResult = await db.query(
        `SELECT
          DATE(recorded_at) as date,
          AVG(health_score) as avg_score,
          COUNT(*) as records
         FROM customer_health_score_history
         WHERE org_id = $1
         AND recorded_at >= $2
         AND recorded_at <= $3
         GROUP BY DATE(recorded_at)
         ORDER BY DATE(recorded_at) ASC`,
        [orgId, start_date, end_date]
      );

      // Get churn events
      const churnEventsResult = await db.query(
        `SELECT
          COUNT(*) as total_churn_events,
          COUNT(*) FILTER (WHERE status = 'recovered') as prevented,
          COUNT(*) FILTER (WHERE status IN ('failed', 'expired')) as lost
         FROM recovery_events
         WHERE org_id = $1
         AND event_type = 'churn_risk'
         AND event_occurred_at >= $2
         AND event_occurred_at <= $3`,
        [orgId, start_date, end_date]
      );

      // Get risk signal distribution
      const signalResult = await db.query(
        `SELECT
          jsonb_array_elements_text(risk_factors) as signal_type,
          COUNT(*) as count
         FROM customer_health_scores
         WHERE org_id = $1
         AND risk_factors IS NOT NULL
         AND jsonb_array_length(risk_factors) > 0
         GROUP BY jsonb_array_elements_text(risk_factors)
         ORDER BY count DESC`,
        [orgId]
      );

      const overall = overallResult.rows[0];
      const churnEvents = churnEventsResult.rows[0];

      const preventionRate = parseInt(churnEvents.total_churn_events) > 0
        ? ((parseInt(churnEvents.prevented) / parseInt(churnEvents.total_churn_events)) * 100).toFixed(2)
        : 0;

      return {
        summary: {
          total_customers: parseInt(overall.total_customers),
          avg_health_score: parseFloat(parseFloat(overall.avg_health_score || 0).toFixed(1)),
          avg_churn_probability: parseFloat(parseFloat(overall.avg_churn_probability || 0).toFixed(4)),
          at_risk_count: parseInt(overall.critical_count) + parseInt(overall.high_count) + parseInt(overall.medium_count)
        },
        risk_distribution: {
          critical: parseInt(overall.critical_count),
          high: parseInt(overall.high_count),
          medium: parseInt(overall.medium_count),
          low: parseInt(overall.low_count),
          very_low: parseInt(overall.very_low_count)
        },
        churn_events: {
          total: parseInt(churnEvents.total_churn_events),
          prevented: parseInt(churnEvents.prevented),
          lost: parseInt(churnEvents.lost),
          prevention_rate: parseFloat(preventionRate)
        },
        trend: trendResult.rows,
        risk_signals: signalResult.rows,
        date_range: { start_date, end_date }
      };
    } catch (error) {
      log.error('Failed to get churn analytics', { orgId, error: error.message });
      throw error;
    }
  }

  // ==================== Private Helper Methods ====================

  _getHealthGrade(score) {
    if (score >= 80) return 'A';
    if (score >= 60) return 'B';
    if (score >= 40) return 'C';
    if (score >= 20) return 'D';
    return 'F';
  }

  _calculateEngagementScore(engagement) {
    const { open_rate, click_rate, activity_rate } = engagement;
    return (open_rate * 0.3 + click_rate * 0.3 + activity_rate * 0.4);
  }

  async _calculateFinancialScore(customerId, orgId) {
    const result = await db.query(
      `SELECT lifetime_value, monthly_recurring_revenue, payment_failures_count
       FROM customer_health_scores
       WHERE customer_id = $1 AND org_id = $2
       ORDER BY calculated_at DESC LIMIT 1`,
      [customerId, orgId]
    );

    if (result.rows.length === 0) return 50;

    const { lifetime_value, monthly_recurring_revenue, payment_failures_count } = result.rows[0];
    let score = 50;

    if (lifetime_value > 1000) score += 25;
    else if (lifetime_value > 500) score += 15;
    else if (lifetime_value > 100) score += 5;

    if (monthly_recurring_revenue > 100) score += 15;
    else if (monthly_recurring_revenue > 50) score += 10;

    score -= (payment_failures_count || 0) * 10;

    return Math.max(0, Math.min(100, score));
  }

  async _calculateSatisfactionScore(customerId, orgId) {
    const result = await db.query(
      `SELECT nps_score, satisfaction_score, support_tickets_30d, negative_feedback_count
       FROM customer_health_scores
       WHERE customer_id = $1 AND org_id = $2
       ORDER BY calculated_at DESC LIMIT 1`,
      [customerId, orgId]
    );

    if (result.rows.length === 0) return 50;

    const { nps_score, satisfaction_score, support_tickets_30d, negative_feedback_count } = result.rows[0];
    let score = 50;

    if (nps_score !== null) {
      score += (nps_score + 100) / 4; // Convert -100 to 100 range to 0-50
    }

    if (satisfaction_score) {
      score += (satisfaction_score - 1) * 12.5; // Convert 1-5 to 0-50
    }

    score -= (support_tickets_30d || 0) * 5;
    score -= (negative_feedback_count || 0) * 10;

    return Math.max(0, Math.min(100, score));
  }

  async _calculateTenureScore(customerId, orgId) {
    const result = await db.query(
      `SELECT subscription_start_date
       FROM customer_health_scores
       WHERE customer_id = $1 AND org_id = $2
       ORDER BY calculated_at DESC LIMIT 1`,
      [customerId, orgId]
    );

    if (result.rows.length === 0 || !result.rows[0].subscription_start_date) return 50;

    const startDate = new Date(result.rows[0].subscription_start_date);
    const monthsActive = (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

    if (monthsActive >= 24) return 100;
    if (monthsActive >= 12) return 80;
    if (monthsActive >= 6) return 60;
    if (monthsActive >= 3) return 40;
    return 20;
  }

  _calculateActivityScore(engagement) {
    const { days_since_activity, active_days, period_days } = engagement;

    let score = 100;

    // Penalize for inactivity
    if (days_since_activity > 30) score -= 50;
    else if (days_since_activity > 14) score -= 30;
    else if (days_since_activity > 7) score -= 15;

    // Reward for active days
    const activityRatio = active_days / period_days;
    score = score * (0.5 + activityRatio * 0.5);

    return Math.max(0, Math.min(100, score));
  }

  async _saveHealthScore(data) {
    const {
      customer_id, org_id, health_score, health_grade,
      churn_probability, churn_risk_level, score_breakdown, risk_factors
    } = data;

    await db.query(
      `INSERT INTO customer_health_scores (
        org_id, customer_id, health_score, health_grade,
        churn_probability, churn_risk_level, score_breakdown, risk_factors,
        calculated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (org_id, customer_id)
      DO UPDATE SET
        health_score = $3,
        health_grade = $4,
        churn_probability = $5,
        churn_risk_level = $6,
        score_breakdown = $7,
        risk_factors = $8,
        calculated_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP`,
      [
        org_id, customer_id, health_score, health_grade,
        churn_probability, churn_risk_level,
        JSON.stringify(score_breakdown), JSON.stringify(risk_factors)
      ]
    );
  }
}

module.exports = new ChurnPredictionService();
