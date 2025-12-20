/**
 * AI Revenue Recovery Engine - Database Migration
 *
 * Creates tables for:
 * - recovery_campaigns: Campaign configurations for revenue recovery
 * - recovery_events: Customer events that trigger recovery actions
 * - recovery_messages: Messages sent for recovery campaigns
 * - recovery_analytics: Aggregated analytics for recovery performance
 * - customer_health_scores: AI-calculated customer health and churn risk
 * - customer_health_score_history: Historical tracking of health scores
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.raw(`
    -- =============================================
    -- 1. RECOVERY CAMPAIGNS TABLE
    -- =============================================
    CREATE TABLE IF NOT EXISTS recovery_campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        bot_id INTEGER REFERENCES bots(id) ON DELETE SET NULL,

        -- Campaign Info
        name VARCHAR(255) NOT NULL,
        description TEXT,
        campaign_type VARCHAR(50) NOT NULL CHECK (campaign_type IN (
            'cart_abandonment',
            'churn_prevention',
            'winback',
            'upsell',
            'renewal_reminder',
            'payment_failed',
            'inactive_user',
            'trial_expiring',
            'custom'
        )),

        -- Status
        status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN (
            'draft',
            'active',
            'paused',
            'completed',
            'archived'
        )),

        -- Targeting Rules (JSON)
        target_rules JSONB NOT NULL DEFAULT '{}',
        message_templates JSONB NOT NULL DEFAULT '[]',

        -- AI Configuration
        ai_enabled BOOLEAN NOT NULL DEFAULT true,
        ai_personalization BOOLEAN NOT NULL DEFAULT true,
        ai_optimal_timing BOOLEAN NOT NULL DEFAULT true,
        ai_model VARCHAR(50) DEFAULT 'gpt-4',

        -- Incentive Settings
        incentive_enabled BOOLEAN NOT NULL DEFAULT false,
        incentive_type VARCHAR(50) CHECK (incentive_type IN (
            'percentage_discount',
            'fixed_discount',
            'free_shipping',
            'bonus_points',
            'free_trial_extension',
            'custom'
        )),
        incentive_value DECIMAL(10, 2),
        incentive_max_uses INTEGER,
        incentive_expiry_hours INTEGER DEFAULT 48,

        -- Channels
        channels JSONB NOT NULL DEFAULT '["email"]',

        -- Schedule
        start_date TIMESTAMP WITH TIME ZONE,
        end_date TIMESTAMP WITH TIME ZONE,
        send_window_start TIME,
        send_window_end TIME,
        timezone VARCHAR(50) DEFAULT 'UTC',

        -- Limits
        max_messages_per_customer INTEGER DEFAULT 3,
        cooldown_hours INTEGER DEFAULT 24,
        daily_send_limit INTEGER,

        -- Performance Metrics
        total_targeted INTEGER DEFAULT 0,
        total_sent INTEGER DEFAULT 0,
        total_recovered INTEGER DEFAULT 0,
        total_revenue_recovered DECIMAL(15, 2) DEFAULT 0,
        conversion_rate DECIMAL(5, 2) DEFAULT 0,

        -- Metadata
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT unique_campaign_name_per_org UNIQUE (org_id, name)
    );

    CREATE INDEX IF NOT EXISTS idx_recovery_campaigns_org ON recovery_campaigns(org_id);
    CREATE INDEX IF NOT EXISTS idx_recovery_campaigns_status ON recovery_campaigns(status);
    CREATE INDEX IF NOT EXISTS idx_recovery_campaigns_type ON recovery_campaigns(campaign_type);
    CREATE INDEX IF NOT EXISTS idx_recovery_campaigns_bot ON recovery_campaigns(bot_id);
    CREATE INDEX IF NOT EXISTS idx_recovery_campaigns_dates ON recovery_campaigns(start_date, end_date);

    -- =============================================
    -- 2. RECOVERY EVENTS TABLE
    -- =============================================
    CREATE TABLE IF NOT EXISTS recovery_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        campaign_id UUID REFERENCES recovery_campaigns(id) ON DELETE SET NULL,

        -- Customer Info
        customer_id VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255),
        customer_phone VARCHAR(50),
        customer_name VARCHAR(255),

        -- Event Details
        event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
            'cart_abandoned',
            'checkout_abandoned',
            'churn_risk_detected',
            'subscription_cancelled',
            'payment_failed',
            'trial_expiring',
            'inactive_detected',
            'downgrade_detected',
            'negative_feedback',
            'support_escalation',
            'custom'
        )),

        -- Event Data
        event_data JSONB NOT NULL DEFAULT '{}',

        -- Value at Risk
        potential_value DECIMAL(15, 2),
        currency VARCHAR(3) DEFAULT 'USD',

        -- AI Predictions
        ai_recovery_probability DECIMAL(5, 4),
        ai_optimal_channel VARCHAR(50),
        ai_optimal_send_time TIMESTAMP WITH TIME ZONE,
        ai_recommended_incentive JSONB,
        ai_personalized_message TEXT,

        -- Status
        status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
            'pending',
            'processing',
            'message_sent',
            'recovered',
            'partially_recovered',
            'failed',
            'expired',
            'opted_out',
            'ignored'
        )),

        -- Recovery Tracking
        recovery_attempts INTEGER DEFAULT 0,
        last_attempt_at TIMESTAMP WITH TIME ZONE,
        recovered_at TIMESTAMP WITH TIME ZONE,
        recovered_value DECIMAL(15, 2),
        recovery_method VARCHAR(50),

        -- Source Info
        source_platform VARCHAR(50),
        source_event_id VARCHAR(255),

        -- Timestamps
        event_occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_recovery_events_org ON recovery_events(org_id);
    CREATE INDEX IF NOT EXISTS idx_recovery_events_campaign ON recovery_events(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_recovery_events_customer ON recovery_events(customer_id, org_id);
    CREATE INDEX IF NOT EXISTS idx_recovery_events_email ON recovery_events(customer_email);
    CREATE INDEX IF NOT EXISTS idx_recovery_events_type ON recovery_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_recovery_events_status ON recovery_events(status);
    CREATE INDEX IF NOT EXISTS idx_recovery_events_occurred ON recovery_events(event_occurred_at);
    CREATE INDEX IF NOT EXISTS idx_recovery_events_pending ON recovery_events(org_id, status) WHERE status = 'pending';

    -- =============================================
    -- 3. RECOVERY MESSAGES TABLE
    -- =============================================
    CREATE TABLE IF NOT EXISTS recovery_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        campaign_id UUID NOT NULL REFERENCES recovery_campaigns(id) ON DELETE CASCADE,
        event_id UUID NOT NULL REFERENCES recovery_events(id) ON DELETE CASCADE,

        -- Recipient Info
        customer_id VARCHAR(255) NOT NULL,
        recipient_email VARCHAR(255),
        recipient_phone VARCHAR(50),

        -- Message Details
        channel VARCHAR(30) NOT NULL CHECK (channel IN (
            'email',
            'sms',
            'whatsapp',
            'telegram',
            'push',
            'in_app',
            'messenger'
        )),

        -- Content
        subject VARCHAR(500),
        message_body TEXT NOT NULL,
        message_html TEXT,
        template_id VARCHAR(255),
        template_variables JSONB DEFAULT '{}',

        -- AI Personalization
        ai_generated BOOLEAN DEFAULT false,
        ai_personalization_score DECIMAL(5, 4),
        original_template TEXT,

        -- Incentive Included
        incentive_code VARCHAR(100),
        incentive_type VARCHAR(50),
        incentive_value DECIMAL(10, 2),
        incentive_expires_at TIMESTAMP WITH TIME ZONE,

        -- Delivery Status
        status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
            'pending',
            'queued',
            'sent',
            'delivered',
            'opened',
            'clicked',
            'converted',
            'bounced',
            'failed',
            'unsubscribed',
            'spam_reported'
        )),

        -- Tracking
        external_message_id VARCHAR(255),
        sent_at TIMESTAMP WITH TIME ZONE,
        delivered_at TIMESTAMP WITH TIME ZONE,
        opened_at TIMESTAMP WITH TIME ZONE,
        clicked_at TIMESTAMP WITH TIME ZONE,
        converted_at TIMESTAMP WITH TIME ZONE,

        -- Conversion Tracking
        conversion_value DECIMAL(15, 2),
        conversion_order_id VARCHAR(255),

        -- Error Handling
        error_code VARCHAR(50),
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        next_retry_at TIMESTAMP WITH TIME ZONE,

        -- Sequence Info
        sequence_number INTEGER DEFAULT 1,

        -- Timestamps
        scheduled_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_recovery_messages_org ON recovery_messages(org_id);
    CREATE INDEX IF NOT EXISTS idx_recovery_messages_campaign ON recovery_messages(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_recovery_messages_event ON recovery_messages(event_id);
    CREATE INDEX IF NOT EXISTS idx_recovery_messages_customer ON recovery_messages(customer_id);
    CREATE INDEX IF NOT EXISTS idx_recovery_messages_status ON recovery_messages(status);
    CREATE INDEX IF NOT EXISTS idx_recovery_messages_channel ON recovery_messages(channel);
    CREATE INDEX IF NOT EXISTS idx_recovery_messages_sent ON recovery_messages(sent_at);
    CREATE INDEX IF NOT EXISTS idx_recovery_messages_scheduled ON recovery_messages(scheduled_at) WHERE status = 'pending';

    -- =============================================
    -- 4. RECOVERY ANALYTICS TABLE
    -- =============================================
    CREATE TABLE IF NOT EXISTS recovery_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        campaign_id UUID REFERENCES recovery_campaigns(id) ON DELETE CASCADE,

        -- Time Period
        period_type VARCHAR(20) NOT NULL CHECK (period_type IN (
            'hourly',
            'daily',
            'weekly',
            'monthly'
        )),
        period_start TIMESTAMP WITH TIME ZONE NOT NULL,
        period_end TIMESTAMP WITH TIME ZONE NOT NULL,

        -- Event Metrics
        events_detected INTEGER DEFAULT 0,
        events_by_type JSONB DEFAULT '{}',

        -- Message Metrics
        messages_sent INTEGER DEFAULT 0,
        messages_delivered INTEGER DEFAULT 0,
        messages_opened INTEGER DEFAULT 0,
        messages_clicked INTEGER DEFAULT 0,
        messages_by_channel JSONB DEFAULT '{}',

        -- Recovery Metrics
        recoveries_total INTEGER DEFAULT 0,
        recoveries_full INTEGER DEFAULT 0,
        recoveries_partial INTEGER DEFAULT 0,

        -- Revenue Metrics
        revenue_at_risk DECIMAL(15, 2) DEFAULT 0,
        revenue_recovered DECIMAL(15, 2) DEFAULT 0,
        revenue_by_channel JSONB DEFAULT '{}',
        average_order_value DECIMAL(15, 2),

        -- Rate Metrics
        delivery_rate DECIMAL(5, 2),
        open_rate DECIMAL(5, 2),
        click_rate DECIMAL(5, 2),
        conversion_rate DECIMAL(5, 2),
        recovery_rate DECIMAL(5, 2),

        -- AI Metrics
        ai_prediction_accuracy DECIMAL(5, 4),
        ai_personalization_lift DECIMAL(5, 2),
        optimal_timing_adherence DECIMAL(5, 2),

        -- Incentive Metrics
        incentives_offered INTEGER DEFAULT 0,
        incentives_redeemed INTEGER DEFAULT 0,
        incentive_cost DECIMAL(15, 2) DEFAULT 0,

        -- ROI Metrics
        campaign_cost DECIMAL(15, 2) DEFAULT 0,
        roi_percentage DECIMAL(10, 2),
        cost_per_recovery DECIMAL(10, 2),

        -- Timestamps
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT unique_analytics_period UNIQUE (org_id, campaign_id, period_type, period_start)
    );

    CREATE INDEX IF NOT EXISTS idx_recovery_analytics_org ON recovery_analytics(org_id);
    CREATE INDEX IF NOT EXISTS idx_recovery_analytics_campaign ON recovery_analytics(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_recovery_analytics_period ON recovery_analytics(period_type, period_start);
    CREATE INDEX IF NOT EXISTS idx_recovery_analytics_date_range ON recovery_analytics(period_start, period_end);

    -- =============================================
    -- 5. CUSTOMER HEALTH SCORES TABLE
    -- =============================================
    CREATE TABLE IF NOT EXISTS customer_health_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

        -- Customer Identification
        customer_id VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255),
        customer_name VARCHAR(255),

        -- Health Score (0-100)
        health_score INTEGER NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
        health_grade VARCHAR(1) CHECK (health_grade IN ('A', 'B', 'C', 'D', 'F')),

        -- Churn Risk
        churn_probability DECIMAL(5, 4) NOT NULL,
        churn_risk_level VARCHAR(20) CHECK (churn_risk_level IN (
            'very_low',
            'low',
            'medium',
            'high',
            'critical'
        )),

        -- Predicted Churn Date
        predicted_churn_date DATE,
        days_until_churn INTEGER,

        -- Engagement Metrics
        engagement_score INTEGER CHECK (engagement_score >= 0 AND engagement_score <= 100),
        last_activity_at TIMESTAMP WITH TIME ZONE,
        days_since_activity INTEGER,
        session_count_30d INTEGER DEFAULT 0,
        action_count_30d INTEGER DEFAULT 0,

        -- Financial Metrics
        lifetime_value DECIMAL(15, 2),
        monthly_recurring_revenue DECIMAL(15, 2),
        average_order_value DECIMAL(15, 2),
        total_orders INTEGER DEFAULT 0,
        last_purchase_at TIMESTAMP WITH TIME ZONE,
        days_since_purchase INTEGER,

        -- Subscription Info
        subscription_status VARCHAR(30),
        subscription_plan VARCHAR(100),
        subscription_start_date DATE,
        subscription_renewal_date DATE,
        payment_failures_count INTEGER DEFAULT 0,

        -- Sentiment & Satisfaction
        nps_score INTEGER CHECK (nps_score >= -100 AND nps_score <= 100),
        satisfaction_score DECIMAL(3, 2),
        support_tickets_open INTEGER DEFAULT 0,
        support_tickets_30d INTEGER DEFAULT 0,
        negative_feedback_count INTEGER DEFAULT 0,

        -- Risk Factors
        risk_factors JSONB DEFAULT '[]',
        opportunities JSONB DEFAULT '[]',
        ai_recommended_actions JSONB DEFAULT '[]',
        score_breakdown JSONB DEFAULT '{}',

        -- Model Info
        model_version VARCHAR(50),
        confidence_score DECIMAL(5, 4),

        -- Tracking
        score_trend VARCHAR(20) CHECK (score_trend IN (
            'improving',
            'stable',
            'declining',
            'critical_decline'
        )),
        previous_score INTEGER,
        score_change INTEGER,

        -- Timestamps
        calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        next_calculation_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT unique_customer_health_per_org UNIQUE (org_id, customer_id)
    );

    CREATE INDEX IF NOT EXISTS idx_customer_health_org ON customer_health_scores(org_id);
    CREATE INDEX IF NOT EXISTS idx_customer_health_customer ON customer_health_scores(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customer_health_email ON customer_health_scores(customer_email);
    CREATE INDEX IF NOT EXISTS idx_customer_health_score ON customer_health_scores(health_score);
    CREATE INDEX IF NOT EXISTS idx_customer_health_churn ON customer_health_scores(churn_probability DESC);
    CREATE INDEX IF NOT EXISTS idx_customer_health_risk ON customer_health_scores(churn_risk_level);
    CREATE INDEX IF NOT EXISTS idx_customer_health_grade ON customer_health_scores(health_grade);
    CREATE INDEX IF NOT EXISTS idx_customer_health_critical ON customer_health_scores(org_id, churn_risk_level)
        WHERE churn_risk_level IN ('high', 'critical');

    -- =============================================
    -- 6. CUSTOMER HEALTH SCORE HISTORY TABLE
    -- =============================================
    CREATE TABLE IF NOT EXISTS customer_health_score_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_health_id UUID NOT NULL REFERENCES customer_health_scores(id) ON DELETE CASCADE,
        org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        customer_id VARCHAR(255) NOT NULL,

        -- Score Snapshot
        health_score INTEGER NOT NULL,
        health_grade VARCHAR(1),
        churn_probability DECIMAL(5, 4),
        churn_risk_level VARCHAR(20),

        -- Component Scores
        engagement_score INTEGER,
        score_breakdown JSONB,

        -- Risk Factors at Time
        risk_factors JSONB DEFAULT '[]',

        -- Timestamp
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_health_history_customer ON customer_health_score_history(customer_health_id);
    CREATE INDEX IF NOT EXISTS idx_health_history_org ON customer_health_score_history(org_id);
    CREATE INDEX IF NOT EXISTS idx_health_history_date ON customer_health_score_history(recorded_at);

    -- =============================================
    -- UPDATE TRIGGERS
    -- =============================================
    CREATE OR REPLACE FUNCTION update_recovery_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_recovery_campaigns_updated ON recovery_campaigns;
    CREATE TRIGGER trigger_recovery_campaigns_updated
        BEFORE UPDATE ON recovery_campaigns
        FOR EACH ROW EXECUTE FUNCTION update_recovery_updated_at();

    DROP TRIGGER IF EXISTS trigger_recovery_events_updated ON recovery_events;
    CREATE TRIGGER trigger_recovery_events_updated
        BEFORE UPDATE ON recovery_events
        FOR EACH ROW EXECUTE FUNCTION update_recovery_updated_at();

    DROP TRIGGER IF EXISTS trigger_recovery_messages_updated ON recovery_messages;
    CREATE TRIGGER trigger_recovery_messages_updated
        BEFORE UPDATE ON recovery_messages
        FOR EACH ROW EXECUTE FUNCTION update_recovery_updated_at();

    DROP TRIGGER IF EXISTS trigger_recovery_analytics_updated ON recovery_analytics;
    CREATE TRIGGER trigger_recovery_analytics_updated
        BEFORE UPDATE ON recovery_analytics
        FOR EACH ROW EXECUTE FUNCTION update_recovery_updated_at();

    DROP TRIGGER IF EXISTS trigger_customer_health_updated ON customer_health_scores;
    CREATE TRIGGER trigger_customer_health_updated
        BEFORE UPDATE ON customer_health_scores
        FOR EACH ROW EXECUTE FUNCTION update_recovery_updated_at();

    -- =============================================
    -- TABLE COMMENTS
    -- =============================================
    COMMENT ON TABLE recovery_campaigns IS 'Stores recovery campaign configurations for cart abandonment, churn prevention, etc.';
    COMMENT ON TABLE recovery_events IS 'Tracks customer events that trigger recovery actions';
    COMMENT ON TABLE recovery_messages IS 'Records all messages sent as part of recovery campaigns';
    COMMENT ON TABLE recovery_analytics IS 'Aggregated analytics for recovery performance by period';
    COMMENT ON TABLE customer_health_scores IS 'AI-calculated customer health and churn risk scores';
    COMMENT ON TABLE customer_health_score_history IS 'Historical tracking of customer health score changes';
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.raw(`
    -- Drop triggers
    DROP TRIGGER IF EXISTS trigger_customer_health_updated ON customer_health_scores;
    DROP TRIGGER IF EXISTS trigger_recovery_analytics_updated ON recovery_analytics;
    DROP TRIGGER IF EXISTS trigger_recovery_messages_updated ON recovery_messages;
    DROP TRIGGER IF EXISTS trigger_recovery_events_updated ON recovery_events;
    DROP TRIGGER IF EXISTS trigger_recovery_campaigns_updated ON recovery_campaigns;

    -- Drop function
    DROP FUNCTION IF EXISTS update_recovery_updated_at();

    -- Drop tables in reverse order (respecting foreign keys)
    DROP TABLE IF EXISTS customer_health_score_history;
    DROP TABLE IF EXISTS customer_health_scores;
    DROP TABLE IF EXISTS recovery_analytics;
    DROP TABLE IF EXISTS recovery_messages;
    DROP TABLE IF EXISTS recovery_events;
    DROP TABLE IF EXISTS recovery_campaigns;
  `);
};
