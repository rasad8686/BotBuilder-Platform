-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bots table
CREATE TABLE IF NOT EXISTS bots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  platform VARCHAR(50) NOT NULL,
  api_token TEXT,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bot messages table
CREATE TABLE IF NOT EXISTS bot_messages (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  message_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  trigger_keywords TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_messages_bot_id ON bot_messages(bot_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);-- Add missing columns to bots table
ALTER TABLE bots ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS platform VARCHAR(50);
ALTER TABLE bots ADD COLUMN IF NOT EXISTS api_token TEXT;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Drop old columns
ALTER TABLE bots DROP COLUMN IF EXISTS token;
ALTER TABLE bots DROP COLUMN IF EXISTS status;

-- Add foreign key constraint
ALTER TABLE bots DROP CONSTRAINT IF EXISTS bots_user_id_fkey;
ALTER TABLE bots ADD CONSTRAINT bots_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create bot_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS bot_messages (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  message_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  trigger_keywords TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add session_id to bot_messages for analytics tracking
ALTER TABLE bot_messages ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_messages_bot_id ON bot_messages(bot_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_bot_messages_session_id ON bot_messages(session_id);

-- Add updated_at column to users if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
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
-- Migration: Create bot_flows table for visual flow builder
-- This table stores the visual flow configuration for bots
-- Each bot can have multiple versions of flows

CREATE TABLE IF NOT EXISTS bot_flows (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  flow_data JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bot_id, version)
);

-- Create indexes for better query performance
CREATE INDEX idx_bot_flows_bot_id ON bot_flows(bot_id);
CREATE INDEX idx_bot_flows_active ON bot_flows(is_active);

-- Comments for documentation
COMMENT ON TABLE bot_flows IS 'Stores visual flow configurations for bots';
COMMENT ON COLUMN bot_flows.flow_data IS 'JSONB object containing the visual flow structure (nodes, edges, etc.)';
COMMENT ON COLUMN bot_flows.version IS 'Version number for flow history tracking';
COMMENT ON COLUMN bot_flows.is_active IS 'Indicates if this is the currently active flow for the bot';
-- =====================================================
-- RBAC + Multi-Tenant Architecture Migration
-- Version: 005
-- Description: Add organizations, roles, and multi-tenancy support
-- =====================================================

-- =====================================================
-- STEP 1: CREATE ROLES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- =====================================================
-- STEP 2: CREATE ORGANIZATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    plan_tier VARCHAR(50) DEFAULT 'free',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations(owner_id);

-- =====================================================
-- STEP 3: CREATE ORGANIZATION_MEMBERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS organization_members (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',
    UNIQUE(org_id, user_id),
    CONSTRAINT valid_role CHECK (role IN ('admin', 'member', 'viewer'))
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_status ON organization_members(status);

-- =====================================================
-- STEP 4: SEED ROLES TABLE
-- =====================================================
INSERT INTO roles (name, description, permissions) VALUES
('admin', 'Full administrative access',
 '{
   "bots": ["create", "read", "update", "delete"],
   "messages": ["create", "read", "update", "delete"],
   "flows": ["create", "read", "update", "delete"],
   "organization": ["read", "update", "invite", "remove_members"],
   "api_tokens": ["create", "read", "delete"]
 }'::JSONB),
('member', 'Can create and manage bots',
 '{
   "bots": ["create", "read", "update", "delete"],
   "messages": ["create", "read", "update", "delete"],
   "flows": ["create", "read", "update", "delete"],
   "organization": ["read"],
   "api_tokens": ["create", "read", "delete"]
 }'::JSONB),
('viewer', 'Read-only access',
 '{
   "bots": ["read"],
   "messages": ["read"],
   "flows": ["read"],
   "organization": ["read"],
   "api_tokens": []
 }'::JSONB)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- STEP 5: ADD ORGANIZATION_ID TO BOTS TABLE
-- =====================================================
-- Add column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bots' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE bots ADD COLUMN organization_id INTEGER;
    END IF;
END $$;

-- =====================================================
-- STEP 6: ADD ORGANIZATION_ID TO BOT_MESSAGES TABLE
-- =====================================================
-- Add column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bot_messages' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE bot_messages ADD COLUMN organization_id INTEGER;
    END IF;
END $$;

-- =====================================================
-- STEP 7: ADD ORGANIZATION_ID TO API_TOKENS TABLE (IF EXISTS)
-- =====================================================
-- Add column if table and column don't exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_tokens') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'api_tokens' AND column_name = 'organization_id'
        ) THEN
            ALTER TABLE api_tokens ADD COLUMN organization_id INTEGER;
        END IF;
    END IF;
END $$;

-- =====================================================
-- STEP 8: DATA MIGRATION - CREATE PERSONAL ORGANIZATIONS
-- =====================================================
-- Create a personal organization for each existing user
INSERT INTO organizations (name, slug, owner_id, plan_tier, settings)
SELECT
    COALESCE(u.name, 'User ' || u.id) || '''s Organization',
    LOWER(REGEXP_REPLACE(COALESCE(u.name, 'user-' || u.id), '[^a-zA-Z0-9]', '-', 'g')) || '-' || u.id,
    u.id,
    'free',
    '{}'::JSONB
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM organizations o WHERE o.owner_id = u.id
);

-- =====================================================
-- STEP 9: ADD USERS AS ADMINS TO THEIR ORGANIZATIONS
-- =====================================================
-- Add each user as admin to their personal organization
INSERT INTO organization_members (org_id, user_id, role, status, joined_at)
SELECT
    o.id,
    o.owner_id,
    'admin',
    'active',
    NOW()
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.org_id = o.id AND om.user_id = o.owner_id
);

-- =====================================================
-- STEP 10: MIGRATE EXISTING BOTS TO ORGANIZATIONS
-- =====================================================
-- Move all existing bots to their owner's personal organization
UPDATE bots b
SET organization_id = o.id
FROM organizations o
WHERE b.user_id = o.owner_id
  AND b.organization_id IS NULL;

-- =====================================================
-- STEP 11: MIGRATE EXISTING BOT_MESSAGES TO ORGANIZATIONS
-- =====================================================
-- Move all existing bot_messages to the bot's organization
UPDATE bot_messages m
SET organization_id = b.organization_id
FROM bots b
WHERE m.bot_id = b.id
  AND m.organization_id IS NULL;

-- =====================================================
-- STEP 12: MIGRATE EXISTING API_TOKENS TO ORGANIZATIONS (IF TABLE EXISTS)
-- =====================================================
-- Move all existing api tokens to user's organization
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_tokens') THEN
        EXECUTE '
            UPDATE api_tokens a
            SET organization_id = o.id
            FROM organizations o
            WHERE a.user_id = o.owner_id
              AND a.organization_id IS NULL
        ';
    END IF;
END $$;

-- =====================================================
-- STEP 13: ADD FOREIGN KEY CONSTRAINTS
-- =====================================================
-- Add FK constraint to bots.organization_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'bots_organization_id_fkey' AND table_name = 'bots'
    ) THEN
        ALTER TABLE bots
        ADD CONSTRAINT bots_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add FK constraint to bot_messages.organization_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'bot_messages_organization_id_fkey' AND table_name = 'bot_messages'
    ) THEN
        ALTER TABLE bot_messages
        ADD CONSTRAINT bot_messages_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add FK constraint to api_tokens.organization_id (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_tokens') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'api_tokens_organization_id_fkey' AND table_name = 'api_tokens'
        ) THEN
            EXECUTE '
                ALTER TABLE api_tokens
                ADD CONSTRAINT api_tokens_organization_id_fkey
                FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            ';
        END IF;
    END IF;
END $$;

-- =====================================================
-- STEP 14: CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_bots_organization_id ON bots(organization_id);
CREATE INDEX IF NOT EXISTS idx_bot_messages_organization_id ON bot_messages(organization_id);

-- Create index for api_tokens if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_tokens') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_api_tokens_organization_id ON api_tokens(organization_id)';
    END IF;
END $$;

-- =====================================================
-- STEP 15: CLEANUP - HANDLE ANY REMAINING NULL VALUES
-- =====================================================
-- Delete any bots that still have NULL organization_id (orphaned bots)
DELETE FROM bots WHERE organization_id IS NULL;

-- Delete any bot_messages that still have NULL organization_id (orphaned messages)
DELETE FROM bot_messages WHERE organization_id IS NULL;

-- Delete any api_tokens that still have NULL organization_id (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_tokens') THEN
        EXECUTE 'DELETE FROM api_tokens WHERE organization_id IS NULL';
    END IF;
END $$;

-- =====================================================
-- STEP 16: MAKE ORGANIZATION_ID NOT NULL (AFTER CLEANUP)
-- =====================================================
-- Make organization_id NOT NULL for bots
ALTER TABLE bots ALTER COLUMN organization_id SET NOT NULL;

-- Make organization_id NOT NULL for bot_messages
ALTER TABLE bot_messages ALTER COLUMN organization_id SET NOT NULL;

-- Make organization_id NOT NULL for api_tokens (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_tokens') THEN
        EXECUTE 'ALTER TABLE api_tokens ALTER COLUMN organization_id SET NOT NULL';
    END IF;
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Summary:
-- ✅ Created roles table with 3 default roles
-- ✅ Created organizations table
-- ✅ Created organization_members table
-- ✅ Added organization_id to bots, bot_messages, api_tokens
-- ✅ Created personal organization for each user
-- ✅ Added users as admins to their organizations
-- ✅ Migrated all existing data to organizations
-- ✅ Added foreign key constraints
-- ✅ Created performance indexes
-- Migration: Create audit_logs table for tracking all user actions
-- Created: 2025-10-31
-- Purpose: Comprehensive audit trail for security, debugging, and compliance

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_org_date
  ON audit_logs(user_id, organization_id, created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail of all user actions';
COMMENT ON COLUMN audit_logs.user_id IS 'User who performed the action (nullable for system actions)';
COMMENT ON COLUMN audit_logs.organization_id IS 'Organization context of the action';
COMMENT ON COLUMN audit_logs.action IS 'Action type (e.g., user.login, bot.created, org.member.invited)';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource affected (user, bot, organization, member)';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID of the affected resource';
COMMENT ON COLUMN audit_logs.old_values IS 'Previous state before action (for updates/deletes)';
COMMENT ON COLUMN audit_logs.new_values IS 'New state after action (for creates/updates)';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the request';
COMMENT ON COLUMN audit_logs.user_agent IS 'Browser/client user agent string';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional contextual information';
COMMENT ON COLUMN audit_logs.created_at IS 'When the action occurred';

-- Insert initial audit log for migration
INSERT INTO audit_logs (
  action,
  resource_type,
  resource_id,
  metadata,
  created_at
) VALUES (
  'system.migration.executed',
  'database',
  6,
  '{"migration": "006_audit_logs", "description": "Created audit_logs table"}',
  CURRENT_TIMESTAMP
);

-- Create view for recent audit activity (last 30 days)
CREATE OR REPLACE VIEW recent_audit_activity AS
SELECT
  al.id,
  al.action,
  al.resource_type,
  al.resource_id,
  u.name as username,
  u.email as user_email,
  o.name as organization_name,
  al.ip_address,
  al.created_at
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
LEFT JOIN organizations o ON al.organization_id = o.id
WHERE al.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
ORDER BY al.created_at DESC;

-- Create view for user activity summary
CREATE OR REPLACE VIEW user_activity_summary AS
WITH action_counts AS (
  SELECT
    user_id,
    action,
    COUNT(*) as action_count
  FROM audit_logs
  WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
  GROUP BY user_id, action
)
SELECT
  u.id as user_id,
  u.name as username,
  u.email,
  COALESCE(SUM(ac.action_count), 0) as total_actions,
  COUNT(DISTINCT al.organization_id) as organizations_accessed,
  MAX(al.created_at) as last_activity,
  jsonb_object_agg(ac.action, ac.action_count) FILTER (WHERE ac.action IS NOT NULL) as action_counts
FROM users u
LEFT JOIN audit_logs al ON u.id = al.user_id AND al.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
LEFT JOIN action_counts ac ON u.id = ac.user_id
GROUP BY u.id, u.name, u.email;

-- Create function to cleanup old audit logs (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL
    AND action NOT IN ('user.login.failed', 'security.breach', 'data.deleted');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log the cleanup action
  INSERT INTO audit_logs (
    action,
    resource_type,
    metadata,
    created_at
  ) VALUES (
    'system.audit.cleanup',
    'audit_logs',
    jsonb_build_object(
      'deleted_count', deleted_count,
      'days_kept', days_to_keep
    ),
    CURRENT_TIMESTAMP
  );

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Cleanup audit logs older than specified days (default 365), keeps security-critical events';
-- Migration: White-label Settings
-- Description: Add white-label/custom branding support for organizations
-- Date: 2025-10-31

-- Create whitelabel_settings table
CREATE TABLE IF NOT EXISTS whitelabel_settings (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

  -- Brand Identity
  brand_name VARCHAR(100) DEFAULT 'BotBuilder',
  logo_url TEXT,
  logo_dark_url TEXT,
  favicon_url TEXT,

  -- Color Scheme (hex colors)
  primary_color VARCHAR(7) DEFAULT '#8b5cf6',
  secondary_color VARCHAR(7) DEFAULT '#6366f1',
  accent_color VARCHAR(7) DEFAULT '#ec4899',
  background_color VARCHAR(7) DEFAULT '#ffffff',
  text_color VARCHAR(7) DEFAULT '#1f2937',

  -- Custom Domain
  custom_domain VARCHAR(255),
  custom_domain_verified BOOLEAN DEFAULT false,

  -- Contact Information
  support_email VARCHAR(255),
  company_name VARCHAR(255),
  company_website VARCHAR(255),

  -- Email Branding
  email_from_name VARCHAR(100),
  email_from_address VARCHAR(255),
  email_header_color VARCHAR(7),
  email_footer_text TEXT,

  -- Legal Links
  privacy_policy_url TEXT,
  terms_of_service_url TEXT,

  -- Features
  show_powered_by BOOLEAN DEFAULT true,
  custom_css TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_whitelabel_domain ON whitelabel_settings(custom_domain);
CREATE INDEX IF NOT EXISTS idx_whitelabel_org ON whitelabel_settings(organization_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_whitelabel_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER whitelabel_updated_at_trigger
  BEFORE UPDATE ON whitelabel_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_whitelabel_updated_at();

-- Create default whitelabel settings for existing organizations
INSERT INTO whitelabel_settings (organization_id, brand_name, show_powered_by)
SELECT id, 'BotBuilder', true
FROM organizations
WHERE id NOT IN (SELECT organization_id FROM whitelabel_settings WHERE organization_id IS NOT NULL)
ON CONFLICT (organization_id) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE whitelabel_settings IS 'White-label/custom branding settings for organizations';
COMMENT ON COLUMN whitelabel_settings.organization_id IS 'Organization that owns these branding settings';
COMMENT ON COLUMN whitelabel_settings.brand_name IS 'Custom brand name to display throughout the platform';
COMMENT ON COLUMN whitelabel_settings.logo_url IS 'URL to custom logo (light mode)';
COMMENT ON COLUMN whitelabel_settings.logo_dark_url IS 'URL to custom logo (dark mode)';
COMMENT ON COLUMN whitelabel_settings.favicon_url IS 'URL to custom favicon';
COMMENT ON COLUMN whitelabel_settings.custom_domain IS 'Custom domain for white-label deployment';
COMMENT ON COLUMN whitelabel_settings.custom_domain_verified IS 'Whether custom domain DNS is verified';
COMMENT ON COLUMN whitelabel_settings.show_powered_by IS 'Whether to show "Powered by BotBuilder" branding';
COMMENT ON COLUMN whitelabel_settings.custom_css IS 'Custom CSS to inject into the platform';
-- Migration: Add billing and subscription columns to organizations table
-- Description: Adds Stripe integration columns for subscription management
-- Date: 2024-11-01

-- Add billing-related columns to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer
ON organizations(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_organizations_stripe_subscription
ON organizations(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_organizations_subscription_status
ON organizations(subscription_status);

-- Add comments for documentation
COMMENT ON COLUMN organizations.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN organizations.stripe_subscription_id IS 'Stripe subscription ID for active subscription';
COMMENT ON COLUMN organizations.subscription_status IS 'Subscription status: active, trialing, past_due, canceled, incomplete';
COMMENT ON COLUMN organizations.subscription_current_period_end IS 'Current billing period end date';

-- Verify the columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations'
    AND column_name = 'stripe_customer_id'
  ) THEN
    RAISE EXCEPTION 'Migration failed: stripe_customer_id column not created';
  END IF;

  RAISE NOTICE 'Migration 008 completed successfully - Billing columns added to organizations table';
END $$;
-- =====================================================
-- ORGANIZATION WEBHOOKS MIGRATION
-- Version: 009
-- Description: Add organization webhooks and webhook delivery logs
-- =====================================================

-- =====================================================
-- STEP 1: CREATE WEBHOOKS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS webhooks (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    secret VARCHAR(255),
    events TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_webhooks_organization_id ON webhooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_is_active ON webhooks(is_active);

-- =====================================================
-- STEP 2: CREATE WEBHOOK_DELIVERY_LOGS TABLE
-- =====================================================
-- Note: webhook_logs already exists for bot webhook calls
-- This table is for organization webhook delivery tracking
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    delivery_status VARCHAR(50) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    response_body TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_webhook_id ON webhook_delivery_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_created_at ON webhook_delivery_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_status ON webhook_delivery_logs(delivery_status);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Summary:
-- ✅ Created webhooks table for organization webhooks
-- ✅ Created webhook_delivery_logs table for tracking deliveries
-- ✅ Added performance indexes
-- =====================================================
-- FIX WEBHOOK_DELIVERY_LOGS TABLE
-- Version: 010
-- Description: Fix webhook_delivery_logs table to match webhooks table schema
-- =====================================================

-- Drop existing table if it exists (to start fresh)
DROP TABLE IF EXISTS webhook_delivery_logs CASCADE;

-- Create webhook_delivery_logs table with correct schema
-- Note: webhooks table uses SERIAL (INTEGER) for id
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    delivery_status VARCHAR(50) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    response_body TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_webhook_id ON webhook_delivery_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_created_at ON webhook_delivery_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_status ON webhook_delivery_logs(delivery_status);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Migration: Create feedback table
-- Description: Stores user feedback submissions with categorization

-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('bug', 'feature', 'question', 'suggestion', 'other')),
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'closed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);

-- Create index on organization_id
CREATE INDEX IF NOT EXISTS idx_feedback_organization_id ON feedback(organization_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- Add comment
COMMENT ON TABLE feedback IS 'Stores user feedback submissions including bug reports, feature requests, and questions';
-- Migration: Create agents tables for Multi-Agent AI system
-- Run this migration to enable the multi-agent functionality

-- 1. agents - AI agent definitions
CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    system_prompt TEXT NOT NULL,
    model_provider VARCHAR(50) NOT NULL DEFAULT 'openai',
    model_name VARCHAR(100) NOT NULL DEFAULT 'gpt-4o-mini',
    temperature DECIMAL(3, 2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 2048,
    capabilities JSONB DEFAULT '[]',
    tools JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agents_bot_id ON agents(bot_id);
CREATE INDEX IF NOT EXISTS idx_agents_org_id ON agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_agents_role ON agents(role);
CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(bot_id, is_active);

-- 2. agent_workflows - workflow configurations
CREATE TABLE IF NOT EXISTS agent_workflows (
    id SERIAL PRIMARY KEY,
    bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    workflow_type VARCHAR(50) NOT NULL DEFAULT 'sequential',
    agents_config JSONB NOT NULL DEFAULT '[]',
    flow_config JSONB NOT NULL DEFAULT '{}',
    entry_agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflows_bot_id ON agent_workflows(bot_id);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON agent_workflows(bot_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_default ON agent_workflows(is_default);

-- 3. workflow_executions - execution logs
CREATE TABLE IF NOT EXISTS workflow_executions (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES agent_workflows(id) ON DELETE CASCADE,
    bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    input JSONB NOT NULL DEFAULT '{}',
    output JSONB DEFAULT '{}',
    total_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 6) DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_bot_id ON workflow_executions(bot_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_created ON workflow_executions(created_at);

-- 4. agent_execution_steps - individual agent steps
CREATE TABLE IF NOT EXISTS agent_execution_steps (
    id SERIAL PRIMARY KEY,
    execution_id INTEGER REFERENCES workflow_executions(id) ON DELETE CASCADE,
    agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    input JSONB NOT NULL DEFAULT '{}',
    output JSONB DEFAULT '{}',
    reasoning TEXT,
    tokens_used INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_steps_execution_id ON agent_execution_steps(execution_id);
CREATE INDEX IF NOT EXISTS idx_steps_agent_id ON agent_execution_steps(agent_id);
CREATE INDEX IF NOT EXISTS idx_steps_order ON agent_execution_steps(step_order);

-- 5. agent_messages - agent-to-agent messages
CREATE TABLE IF NOT EXISTS agent_messages (
    id SERIAL PRIMARY KEY,
    execution_id INTEGER REFERENCES workflow_executions(id) ON DELETE CASCADE,
    from_agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    to_agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    message_type VARCHAR(50) NOT NULL DEFAULT 'data',
    content JSONB NOT NULL DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_execution_id ON agent_messages(execution_id);
CREATE INDEX IF NOT EXISTS idx_messages_from_agent ON agent_messages(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_to_agent ON agent_messages(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_type ON agent_messages(message_type);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Multi-Agent AI tables created successfully!';
END $$;
-- Migration: Create tools tables for Tool Calling / Function Calling system
-- Date: 2025-01-29

-- Tools table - stores tool definitions
CREATE TABLE tools (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  tool_type VARCHAR(50) NOT NULL, -- 'http_request', 'database_query', 'code_execution', 'custom'
  configuration JSONB NOT NULL DEFAULT '{}',
  input_schema JSONB, -- JSON Schema for input parameters
  output_schema JSONB, -- JSON Schema for output
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Agent-Tool relationship table
CREATE TABLE agent_tools (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
  tool_id INTEGER REFERENCES tools(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(agent_id, tool_id)
);

-- Tool execution history table
CREATE TABLE tool_executions (
  id SERIAL PRIMARY KEY,
  tool_id INTEGER REFERENCES tools(id) ON DELETE CASCADE,
  agent_id INTEGER REFERENCES agents(id),
  execution_id INTEGER REFERENCES workflow_executions(id),
  input JSONB,
  output JSONB,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_tools_bot_id ON tools(bot_id);
CREATE INDEX idx_tools_tool_type ON tools(tool_type);
CREATE INDEX idx_tools_is_active ON tools(is_active);
CREATE INDEX idx_agent_tools_agent_id ON agent_tools(agent_id);
CREATE INDEX idx_agent_tools_tool_id ON agent_tools(tool_id);
CREATE INDEX idx_tool_executions_tool_id ON tool_executions(tool_id);
CREATE INDEX idx_tool_executions_agent_id ON tool_executions(agent_id);
CREATE INDEX idx_tool_executions_execution_id ON tool_executions(execution_id);
CREATE INDEX idx_tool_executions_status ON tool_executions(status);
CREATE INDEX idx_tool_executions_created_at ON tool_executions(created_at);
-- Knowledge Base Vector DB Migration
-- Run this when PostgreSQL is available

-- Enable vector extension (optional - only if pgvector is installed)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge Bases table
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  embedding_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
  chunk_size INTEGER DEFAULT 500,
  chunk_overlap INTEGER DEFAULT 50,
  status VARCHAR(50) DEFAULT 'active',
  document_count INTEGER DEFAULT 0,
  total_chunks INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  knowledge_base_id INTEGER NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  source_url TEXT,
  file_path TEXT,
  file_size INTEGER,
  content_hash VARCHAR(64),
  status VARCHAR(50) DEFAULT 'pending',
  chunk_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chunks table with vector embedding
CREATE TABLE IF NOT EXISTS chunks (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  knowledge_base_id INTEGER NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding TEXT,
  chunk_index INTEGER NOT NULL,
  start_char INTEGER,
  end_char INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent Knowledge Bases junction table
CREATE TABLE IF NOT EXISTS agent_knowledge_bases (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL,
  knowledge_base_id INTEGER NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agent_id, knowledge_base_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_tenant ON knowledge_bases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_status ON knowledge_bases(status);
CREATE INDEX IF NOT EXISTS idx_documents_knowledge_base ON documents(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_knowledge_base ON chunks(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_bases_agent ON agent_knowledge_bases(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_bases_kb ON agent_knowledge_bases(knowledge_base_id);

-- Vector similarity search index (IVFFlat for approximate nearest neighbor)
-- Note: This requires at least some data before creation, or use HNSW instead
-- CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- =====================================================
-- AI CONFIGURATIONS TABLE
-- Stores AI provider settings per bot
-- =====================================================

-- Create ai_configurations table if not exists
CREATE TABLE IF NOT EXISTS ai_configurations (
    id SERIAL PRIMARY KEY,
    bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,

    -- Provider settings
    provider VARCHAR(50) NOT NULL DEFAULT 'openai',
    model VARCHAR(100) NOT NULL DEFAULT 'gpt-3.5-turbo',

    -- API Keys (encrypted)
    api_key_encrypted TEXT,
    use_platform_key BOOLEAN DEFAULT true,

    -- Model parameters
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 1000,
    top_p DECIMAL(3,2) DEFAULT 1.0,
    frequency_penalty DECIMAL(3,2) DEFAULT 0.0,
    presence_penalty DECIMAL(3,2) DEFAULT 0.0,

    -- System prompt / instructions
    system_prompt TEXT,

    -- Knowledge base integration
    knowledge_base_id INTEGER REFERENCES knowledge_bases(id) ON DELETE SET NULL,
    use_knowledge_base BOOLEAN DEFAULT false,

    -- Response settings
    response_format VARCHAR(20) DEFAULT 'text',
    streaming_enabled BOOLEAN DEFAULT true,

    -- Usage tracking
    total_tokens_used BIGINT DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_provider CHECK (provider IN ('openai', 'anthropic', 'google', 'azure', 'custom')),
    CONSTRAINT valid_temperature CHECK (temperature >= 0 AND temperature <= 2),
    CONSTRAINT valid_top_p CHECK (top_p >= 0 AND top_p <= 1),
    CONSTRAINT unique_bot_config UNIQUE (bot_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_ai_config_bot_id ON ai_configurations(bot_id);
CREATE INDEX IF NOT EXISTS idx_ai_config_org_id ON ai_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_config_provider ON ai_configurations(provider);
CREATE INDEX IF NOT EXISTS idx_ai_config_active ON ai_configurations(is_active);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_ai_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ai_config_updated_at ON ai_configurations;
CREATE TRIGGER trigger_ai_config_updated_at
    BEFORE UPDATE ON ai_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_config_timestamp();

-- Add comment
COMMENT ON TABLE ai_configurations IS 'Stores AI provider configurations for each bot';
-- Plugin Marketplace Tables Migration

-- Plugin Categories
CREATE TABLE IF NOT EXISTS plugin_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  icon VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plugins
CREATE TABLE IF NOT EXISTS plugins (
  id SERIAL PRIMARY KEY,
  developer_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
  category_id INTEGER REFERENCES plugin_categories(id),
  icon_url TEXT,
  banner_url TEXT,
  price DECIMAL(10,2) DEFAULT 0,
  is_free BOOLEAN DEFAULT true,
  status VARCHAR(50) DEFAULT 'pending',
  downloads INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  manifest JSONB DEFAULT '{}',
  permissions JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plugin Versions
CREATE TABLE IF NOT EXISTS plugin_versions (
  id SERIAL PRIMARY KEY,
  plugin_id INTEGER NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL,
  changelog TEXT,
  file_url TEXT,
  min_platform_version VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plugin_id, version)
);

-- Plugin Installations
CREATE TABLE IF NOT EXISTS plugin_installations (
  id SERIAL PRIMARY KEY,
  plugin_id INTEGER NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL,
  installed_version VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plugin_id, tenant_id)
);

-- Plugin Reviews
CREATE TABLE IF NOT EXISTS plugin_reviews (
  id SERIAL PRIMARY KEY,
  plugin_id INTEGER NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plugin_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plugins_developer ON plugins(developer_id);
CREATE INDEX IF NOT EXISTS idx_plugins_category ON plugins(category_id);
CREATE INDEX IF NOT EXISTS idx_plugins_status ON plugins(status);
CREATE INDEX IF NOT EXISTS idx_plugins_slug ON plugins(slug);
CREATE INDEX IF NOT EXISTS idx_plugin_versions_plugin ON plugin_versions(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_installations_tenant ON plugin_installations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plugin_installations_plugin ON plugin_installations(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_reviews_plugin ON plugin_reviews(plugin_id);

-- Insert default categories
INSERT INTO plugin_categories (name, slug, icon, description) VALUES
  ('AI & Automation', 'ai-automation', '🤖', 'AI-powered tools and automation plugins'),
  ('Analytics', 'analytics', '📊', 'Analytics and reporting plugins'),
  ('Communication', 'communication', '💬', 'Messaging and communication integrations'),
  ('CRM', 'crm', '👥', 'Customer relationship management'),
  ('E-commerce', 'ecommerce', '🛒', 'Shopping and payment integrations'),
  ('Marketing', 'marketing', '📣', 'Marketing and promotion tools'),
  ('Productivity', 'productivity', '⚡', 'Workflow and productivity enhancers'),
  ('Security', 'security', '🔒', 'Security and compliance tools'),
  ('Social Media', 'social-media', '📱', 'Social media integrations'),
  ('Utilities', 'utilities', '🔧', 'General utility plugins')
ON CONFLICT (slug) DO NOTHING;
-- Seed Demo Plugins for Marketplace
-- Run this after 023_create_plugins_tables.sql

-- First, ensure categories exist (get their IDs)
-- Categories from 023: AI & Automation(1), Analytics(2), Communication(3), CRM(4), E-commerce(5),
-- Marketing(6), Productivity(7), Security(8), Social Media(9), Utilities(10)

-- Insert demo plugins
INSERT INTO plugins (
    developer_id,
    name,
    slug,
    description,
    category_id,
    version,
    icon_url,
    banner_url,
    price,
    is_free,
    status,
    downloads,
    rating,
    review_count,
    manifest,
    permissions,
    created_at,
    updated_at
) VALUES
-- 1. WhatsApp Integration (Communication, Free)
(
    1,
    'WhatsApp Integration',
    'whatsapp-integration',
    'Connect your bots to WhatsApp Business API. Send and receive messages, media, and templates. Supports multi-device, webhooks, and real-time notifications. Perfect for customer support and marketing automation.',
    3, -- Communication
    '2.1.0',
    'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/whatsapp/whatsapp-original.svg',
    NULL,
    0,
    true,
    'published',
    12543,
    4.8,
    287,
    '{"name": "whatsapp-integration", "version": "2.1.0", "type": "channel", "main": "index.js", "features": ["Multi-device support", "Media messages", "Template messages", "Webhooks", "Read receipts"]}',
    '["send_messages", "read_messages", "webhook_access"]',
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '3 days'
),

-- 2. OpenAI GPT-4 Connector (AI & Automation, $9.99)
(
    1,
    'OpenAI GPT-4 Connector',
    'openai-gpt4-connector',
    'Integrate OpenAI GPT-4 and GPT-4 Turbo into your bots. Features include conversation memory, function calling, vision capabilities, and streaming responses. Build intelligent AI assistants with ease.',
    1, -- AI & Automation
    '3.0.2',
    'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/openai.svg',
    NULL,
    9.99,
    false,
    'published',
    8921,
    4.9,
    412,
    '{"name": "openai-gpt4-connector", "version": "3.0.2", "type": "ai", "main": "index.js", "features": ["GPT-4 & GPT-4 Turbo", "Function calling", "Vision support", "Streaming responses", "Conversation memory", "Token optimization"]}',
    '["external_api", "read_messages", "send_messages"]',
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '1 day'
),

-- 3. Google Analytics (Analytics, Free)
(
    1,
    'Google Analytics',
    'google-analytics',
    'Track bot interactions with Google Analytics 4. Monitor user engagement, conversation flows, conversion funnels, and custom events. Includes dashboard widgets and automated reporting.',
    2, -- Analytics
    '1.5.0',
    'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg',
    NULL,
    0,
    true,
    'published',
    6234,
    4.5,
    156,
    '{"name": "google-analytics", "version": "1.5.0", "type": "integration", "main": "index.js", "features": ["GA4 integration", "Custom events", "Conversion tracking", "Dashboard widgets", "Automated reports"]}',
    '["analytics_access", "read_messages"]',
    NOW() - INTERVAL '90 days',
    NOW() - INTERVAL '14 days'
),

-- 4. Stripe Payments (E-commerce, $19.99)
(
    1,
    'Stripe Payments',
    'stripe-payments',
    'Accept payments directly in your bot conversations. Supports one-time payments, subscriptions, invoices, and refunds. PCI compliant with 3D Secure support. Perfect for e-commerce bots.',
    5, -- E-commerce
    '2.3.1',
    'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/stripe.svg',
    NULL,
    19.99,
    false,
    'published',
    4567,
    4.7,
    198,
    '{"name": "stripe-payments", "version": "2.3.1", "type": "integration", "main": "index.js", "features": ["One-time payments", "Subscriptions", "Invoices", "Refunds", "3D Secure", "Multiple currencies"]}',
    '["external_api", "send_messages", "webhook_access"]',
    NOW() - INTERVAL '120 days',
    NOW() - INTERVAL '7 days'
),

-- 5. Email Marketing (Marketing, $4.99)
(
    1,
    'Email Marketing',
    'email-marketing',
    'Send automated email campaigns from your bots. Integrates with Mailchimp, SendGrid, and SMTP. Features include templates, scheduling, A/B testing, and analytics. Grow your email list automatically.',
    6, -- Marketing
    '1.8.0',
    'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg',
    NULL,
    4.99,
    false,
    'published',
    3892,
    4.4,
    134,
    '{"name": "email-marketing", "version": "1.8.0", "type": "integration", "main": "index.js", "features": ["Mailchimp integration", "SendGrid support", "Email templates", "Scheduling", "A/B testing", "Analytics"]}',
    '["external_api", "read_users", "send_messages"]',
    NOW() - INTERVAL '75 days',
    NOW() - INTERVAL '10 days'
)
ON CONFLICT (slug) DO UPDATE SET
    description = EXCLUDED.description,
    version = EXCLUDED.version,
    downloads = EXCLUDED.downloads,
    rating = EXCLUDED.rating,
    review_count = EXCLUDED.review_count,
    updated_at = NOW();

-- Add some demo reviews for the plugins
INSERT INTO plugin_reviews (plugin_id, user_id, rating, comment, created_at)
SELECT
    p.id,
    1,
    5,
    'Excellent plugin! Works perfectly with my bots.',
    NOW() - INTERVAL '10 days'
FROM plugins p WHERE p.slug = 'whatsapp-integration'
ON CONFLICT DO NOTHING;

INSERT INTO plugin_reviews (plugin_id, user_id, rating, comment, created_at)
SELECT
    p.id,
    1,
    5,
    'GPT-4 integration is seamless. Great documentation!',
    NOW() - INTERVAL '5 days'
FROM plugins p WHERE p.slug = 'openai-gpt4-connector'
ON CONFLICT DO NOTHING;

INSERT INTO plugin_reviews (plugin_id, user_id, rating, comment, created_at)
SELECT
    p.id,
    1,
    4,
    'Good analytics integration. Would love more custom events.',
    NOW() - INTERVAL '20 days'
FROM plugins p WHERE p.slug = 'google-analytics'
ON CONFLICT DO NOTHING;

SELECT 'Demo plugins seeded successfully!' as result;
-- Channels Tables for WhatsApp, Instagram, Telegram Integration
-- Run this migration to set up messaging channel infrastructure

-- Main channels table
CREATE TABLE IF NOT EXISTS channels (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('whatsapp', 'instagram', 'telegram', 'messenger', 'sms')),
    name VARCHAR(255) NOT NULL,
    credentials JSONB DEFAULT '{}',
    phone_number VARCHAR(50),
    username VARCHAR(255),
    status VARCHAR(50) DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'pending', 'error')),
    webhook_secret VARCHAR(255),
    webhook_url VARCHAR(500),
    api_key VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    business_account_id VARCHAR(255),
    settings JSONB DEFAULT '{}',
    last_sync_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Channel messages table
CREATE TABLE IF NOT EXISTS channel_messages (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    bot_id INTEGER,
    conversation_id VARCHAR(255),
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    from_number VARCHAR(100),
    to_number VARCHAR(100),
    from_name VARCHAR(255),
    message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'sticker', 'template', 'interactive', 'reaction')),
    content TEXT,
    media_url TEXT,
    media_mime_type VARCHAR(100),
    media_filename VARCHAR(255),
    caption TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'received')),
    external_id VARCHAR(255),
    reply_to_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    error_message TEXT,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Channel templates table (for WhatsApp approved templates)
CREATE TABLE IF NOT EXISTS channel_templates (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    category VARCHAR(100) CHECK (category IN ('marketing', 'utility', 'authentication', 'service')),
    content TEXT NOT NULL,
    header_type VARCHAR(50) CHECK (header_type IN ('text', 'image', 'video', 'document', 'none')),
    header_content TEXT,
    footer TEXT,
    buttons JSONB DEFAULT '[]',
    variables JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disabled')),
    external_id VARCHAR(255),
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel_id, name, language)
);

-- Channel webhooks table (for incoming webhook events)
CREATE TABLE IF NOT EXISTS channel_webhooks (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER REFERENCES channels(id) ON DELETE SET NULL,
    channel_type VARCHAR(50),
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    headers JSONB DEFAULT '{}',
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Channel contacts table (for tracking conversations)
CREATE TABLE IF NOT EXISTS channel_contacts (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    external_id VARCHAR(255) NOT NULL,
    phone_number VARCHAR(100),
    username VARCHAR(255),
    display_name VARCHAR(255),
    profile_picture_url TEXT,
    metadata JSONB DEFAULT '{}',
    first_message_at TIMESTAMP,
    last_message_at TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    is_blocked BOOLEAN DEFAULT FALSE,
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel_id, external_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_channels_tenant ON channels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(type);
CREATE INDEX IF NOT EXISTS idx_channels_status ON channels(status);

CREATE INDEX IF NOT EXISTS idx_channel_messages_channel ON channel_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_conversation ON channel_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_direction ON channel_messages(direction);
CREATE INDEX IF NOT EXISTS idx_channel_messages_status ON channel_messages(status);
CREATE INDEX IF NOT EXISTS idx_channel_messages_external ON channel_messages(external_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_created ON channel_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_channel_templates_channel ON channel_templates(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_templates_status ON channel_templates(status);

CREATE INDEX IF NOT EXISTS idx_channel_webhooks_channel ON channel_webhooks(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_webhooks_processed ON channel_webhooks(processed);
CREATE INDEX IF NOT EXISTS idx_channel_webhooks_created ON channel_webhooks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_channel_contacts_channel ON channel_contacts(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_contacts_phone ON channel_contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_channel_contacts_external ON channel_contacts(external_id);

SELECT 'Channels tables created successfully!' as result;
-- Team Collaboration Tables Migration
-- Creates tables for team management, invitations, activity logging, and version control

-- Team Roles table
CREATE TABLE IF NOT EXISTS team_roles (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, name)
);

-- Team Members table
CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES team_roles(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, user_id)
);

-- Team Invitations table
CREATE TABLE IF NOT EXISTS team_invitations (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL REFERENCES team_roles(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Activity Logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INTEGER,
    changes JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Entity Versions table (for version control)
CREATE TABLE IF NOT EXISTS entity_versions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    data JSONB NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    commit_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, entity_type, entity_id, version_number)
);

-- Entity Branches table (for branching support)
CREATE TABLE IF NOT EXISTS entity_branches (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INTEGER NOT NULL,
    branch_name VARCHAR(100) NOT NULL,
    base_version_id INTEGER REFERENCES entity_versions(id) ON DELETE SET NULL,
    is_main BOOLEAN NOT NULL DEFAULT FALSE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, entity_type, entity_id, branch_name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_roles_tenant ON team_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_members_tenant ON team_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_tenant ON team_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant ON activity_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_entity_versions_tenant ON entity_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_entity_versions_entity ON entity_versions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_branches_tenant ON entity_branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_entity_branches_entity ON entity_branches(entity_type, entity_id);

-- Insert default roles for existing organizations
INSERT INTO team_roles (tenant_id, name, permissions, is_default)
SELECT id, 'Owner', '{"all": true}', false FROM organizations
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO team_roles (tenant_id, name, permissions, is_default)
SELECT id, 'Admin', '{"manage_team": true, "manage_bots": true, "manage_workflows": true, "manage_knowledge": true, "view_analytics": true}', false FROM organizations
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO team_roles (tenant_id, name, permissions, is_default)
SELECT id, 'Member', '{"manage_bots": true, "manage_workflows": true, "view_analytics": true}', true FROM organizations
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO team_roles (tenant_id, name, permissions, is_default)
SELECT id, 'Viewer', '{"view_bots": true, "view_workflows": true, "view_analytics": true}', false FROM organizations
ON CONFLICT (tenant_id, name) DO NOTHING;
-- =====================================================
-- Add Knowledge Base support to AI Configuration
-- =====================================================

-- Add knowledge_base_id column to ai_configurations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_configurations' AND column_name = 'knowledge_base_id'
  ) THEN
    ALTER TABLE ai_configurations
    ADD COLUMN knowledge_base_id INTEGER REFERENCES knowledge_bases(id) ON DELETE SET NULL;

    COMMENT ON COLUMN ai_configurations.knowledge_base_id IS 'Linked knowledge base for RAG (Retrieval-Augmented Generation)';
  END IF;
END $$;

-- Add enable_rag column to control RAG behavior
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_configurations' AND column_name = 'enable_rag'
  ) THEN
    ALTER TABLE ai_configurations
    ADD COLUMN enable_rag BOOLEAN DEFAULT true;

    COMMENT ON COLUMN ai_configurations.enable_rag IS 'Enable RAG (uses knowledge base for context)';
  END IF;
END $$;

-- Add rag_threshold column for similarity threshold
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_configurations' AND column_name = 'rag_threshold'
  ) THEN
    ALTER TABLE ai_configurations
    ADD COLUMN rag_threshold DECIMAL(3,2) DEFAULT 0.7;

    COMMENT ON COLUMN ai_configurations.rag_threshold IS 'Minimum similarity score for RAG results (0.0-1.0)';
  END IF;
END $$;

-- Add rag_max_chunks column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_configurations' AND column_name = 'rag_max_chunks'
  ) THEN
    ALTER TABLE ai_configurations
    ADD COLUMN rag_max_chunks INTEGER DEFAULT 5;

    COMMENT ON COLUMN ai_configurations.rag_max_chunks IS 'Maximum number of chunks to include in RAG context';
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_config_knowledge_base
  ON ai_configurations(knowledge_base_id)
  WHERE knowledge_base_id IS NOT NULL;

-- =====================================================
-- Migration Complete
-- =====================================================
-- Migration: Create widget tables for embeddable chat widget
-- Date: 2025-12-07

-- Widget configurations table
CREATE TABLE IF NOT EXISTS widget_configs (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE UNIQUE,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Widget messages table
CREATE TABLE IF NOT EXISTS widget_messages (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
  session_id VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL, -- 'user', 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_widget_configs_bot_id ON widget_configs(bot_id);
CREATE INDEX idx_widget_messages_bot_id ON widget_messages(bot_id);
CREATE INDEX idx_widget_messages_session_id ON widget_messages(session_id);
CREATE INDEX idx_widget_messages_created_at ON widget_messages(created_at);
