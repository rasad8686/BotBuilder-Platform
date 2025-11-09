-- =====================================================
-- FIX WEBHOOK_DELIVERY_LOGS TABLE
-- Version: 010
-- Description: Fix webhook_delivery_logs table to match webhooks table schema
-- =====================================================

-- Drop existing table if it exists (to start fresh)
DROP TABLE IF EXISTS webhook_delivery_logs CASCADE;

-- Create webhook_delivery_logs table with correct schema
-- Note: webhooks table uses UUID for id
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
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
