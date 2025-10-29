-- =====================================================
-- SAAS FEATURES MIGRATION
-- Adds subscription plans, payments, usage tracking, webhooks
-- =====================================================

-- =====================================================
-- 1. SUBSCRIPTION PLANS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10, 2) NOT NULL,
  price_yearly DECIMAL(10, 2),
  max_bots INTEGER NOT NULL,
  max_messages_per_month INTEGER,
  features JSONB,
  stripe_price_id_monthly VARCHAR(255),
  stripe_price_id_yearly VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default plans
INSERT INTO subscription_plans (name, display_name, description, price_monthly, price_yearly, max_bots, max_messages_per_month, features) VALUES
('free', 'Free Plan', 'Perfect for testing and personal use', 0.00, 0.00, 1, 1000, '{"api_access": false, "webhook_support": true, "priority_support": false, "custom_branding": false}'),
('pro', 'Pro Plan', 'For growing businesses and teams', 29.00, 290.00, 10, 50000, '{"api_access": true, "webhook_support": true, "priority_support": true, "custom_branding": false}'),
('enterprise', 'Enterprise Plan', 'Unlimited power for large organizations', 99.00, 990.00, -1, -1, '{"api_access": true, "webhook_support": true, "priority_support": true, "custom_branding": true}')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 2. USER SUBSCRIPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, canceled, past_due, unpaid
  billing_cycle VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Give all existing users free plan
INSERT INTO user_subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
SELECT u.id, sp.id, 'active', NOW(), NOW() + INTERVAL '100 years'
FROM users u
CROSS JOIN subscription_plans sp
WHERE sp.name = 'free'
AND NOT EXISTS (SELECT 1 FROM user_subscriptions us WHERE us.user_id = u.id);

-- =====================================================
-- 3. PAYMENT HISTORY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  stripe_payment_intent_id VARCHAR(255),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) NOT NULL, -- succeeded, pending, failed, refunded
  description TEXT,
  payment_method VARCHAR(50),
  receipt_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 4. USAGE TRACKING TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS usage_tracking (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bot_id INTEGER REFERENCES bots(id) ON DELETE SET NULL,
  metric_type VARCHAR(50) NOT NULL, -- message_sent, message_received, api_call, webhook_call
  count INTEGER DEFAULT 1,
  metadata JSONB,
  tracked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster usage queries
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_date ON usage_tracking(user_id, tracked_at);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_bot_date ON usage_tracking(bot_id, tracked_at);

-- =====================================================
-- 5. API TOKENS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS api_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
  token_name VARCHAR(100) NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  token_preview VARCHAR(20) NOT NULL,
  permissions JSONB DEFAULT '{"read": true, "write": true, "delete": false}',
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. WEBHOOK LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS webhook_logs (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  request_method VARCHAR(10) NOT NULL,
  request_headers JSONB,
  request_body JSONB,
  response_status INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for webhook logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_bot_date ON webhook_logs(bot_id, created_at DESC);

-- =====================================================
-- 7. EMAIL NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS email_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_type VARCHAR(50) NOT NULL, -- welcome, password_reset, bot_alert, subscription_notification
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed
  sent_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 8. UPDATE BOTS TABLE - Add new SaaS columns
-- =====================================================
ALTER TABLE bots ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(255);
ALTER TABLE bots ADD COLUMN IF NOT EXISTS last_webhook_call TIMESTAMP;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS total_messages_sent INTEGER DEFAULT 0;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS total_messages_received INTEGER DEFAULT 0;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS monthly_message_count INTEGER DEFAULT 0;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS last_message_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- =====================================================
-- 9. UPDATE USERS TABLE - Add email verification
-- =====================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- =====================================================
-- CREATE USEFUL VIEWS
-- =====================================================

-- View: User subscription details with plan info
CREATE OR REPLACE VIEW user_subscription_details AS
SELECT
  us.user_id,
  us.id as subscription_id,
  sp.name as plan_name,
  sp.display_name,
  sp.max_bots,
  sp.max_messages_per_month,
  sp.features,
  us.status,
  us.current_period_end,
  us.cancel_at_period_end
FROM user_subscriptions us
JOIN subscription_plans sp ON us.plan_id = sp.id;

-- View: User usage summary
CREATE OR REPLACE VIEW user_usage_summary AS
SELECT
  user_id,
  DATE_TRUNC('month', tracked_at) as month,
  metric_type,
  SUM(count) as total_count
FROM usage_tracking
GROUP BY user_id, DATE_TRUNC('month', tracked_at), metric_type;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to check if user can create more bots
CREATE OR REPLACE FUNCTION can_create_bot(p_user_id INTEGER) RETURNS BOOLEAN AS $$
DECLARE
  v_current_bot_count INTEGER;
  v_max_bots INTEGER;
BEGIN
  -- Get current bot count
  SELECT COUNT(*) INTO v_current_bot_count
  FROM bots
  WHERE user_id = p_user_id;

  -- Get max bots allowed
  SELECT sp.max_bots INTO v_max_bots
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = p_user_id AND us.status = 'active';

  -- If max_bots is -1, it's unlimited
  IF v_max_bots = -1 THEN
    RETURN true;
  END IF;

  RETURN v_current_bot_count < v_max_bots;
END;
$$ LANGUAGE plpgsql;

-- Function to track usage
CREATE OR REPLACE FUNCTION track_usage(
  p_user_id INTEGER,
  p_bot_id INTEGER,
  p_metric_type VARCHAR,
  p_count INTEGER DEFAULT 1
) RETURNS VOID AS $$
BEGIN
  INSERT INTO usage_tracking (user_id, bot_id, metric_type, count)
  VALUES (p_user_id, p_bot_id, p_metric_type, p_count);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payment_history_user ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_bot ON api_tokens(bot_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_user ON email_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications(status);

COMMENT ON TABLE subscription_plans IS 'Available subscription plans for the SaaS platform';
COMMENT ON TABLE user_subscriptions IS 'User subscription status and billing information';
COMMENT ON TABLE payment_history IS 'Complete payment transaction history';
COMMENT ON TABLE usage_tracking IS 'Track API calls, messages, and other usage metrics';
COMMENT ON TABLE api_tokens IS 'API tokens for programmatic access';
COMMENT ON TABLE webhook_logs IS 'Webhook call logs for debugging and monitoring';
COMMENT ON TABLE email_notifications IS 'Email notification queue and history';
