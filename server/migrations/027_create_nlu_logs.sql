-- =====================================================
-- NLU LOGS TABLE
-- Version: 027
-- Description: Store NLU analysis logs for analytics
-- =====================================================

-- Create nlu_logs table
CREATE TABLE IF NOT EXISTS nlu_logs (
    id SERIAL PRIMARY KEY,
    bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    detected_intent_id INTEGER REFERENCES intents(id) ON DELETE SET NULL,
    detected_intent_name VARCHAR(255),
    confidence DECIMAL(5,4) DEFAULT 0,
    entities_extracted JSONB DEFAULT '[]'::jsonb,
    matched BOOLEAN DEFAULT false,
    response_time_ms INTEGER DEFAULT 0,
    user_session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_nlu_logs_bot_id ON nlu_logs(bot_id);
CREATE INDEX IF NOT EXISTS idx_nlu_logs_created_at ON nlu_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nlu_logs_detected_intent ON nlu_logs(detected_intent_id);
CREATE INDEX IF NOT EXISTS idx_nlu_logs_confidence ON nlu_logs(confidence);
CREATE INDEX IF NOT EXISTS idx_nlu_logs_matched ON nlu_logs(matched);
CREATE INDEX IF NOT EXISTS idx_nlu_logs_org_id ON nlu_logs(organization_id);

-- Composite index for common analytics queries
CREATE INDEX IF NOT EXISTS idx_nlu_logs_bot_date ON nlu_logs(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nlu_logs_bot_intent ON nlu_logs(bot_id, detected_intent_id);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
