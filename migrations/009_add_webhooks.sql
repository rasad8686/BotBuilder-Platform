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
