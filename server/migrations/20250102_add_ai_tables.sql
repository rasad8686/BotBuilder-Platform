-- ═══════════════════════════════════════════════════════════
-- AI INTEGRATION MIGRATION
-- Created: 2025-01-02
-- Description: Add tables for AI configuration and usage tracking
-- ═══════════════════════════════════════════════════════════

-- AI Configuration per Bot
-- Stores AI provider settings (OpenAI, Claude) for each bot
CREATE TABLE IF NOT EXISTS ai_configurations (
    id SERIAL PRIMARY KEY,
    bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'openai' or 'claude'
    model VARCHAR(100) NOT NULL,   -- 'gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet-20241022', etc.
    api_key_encrypted TEXT,        -- Encrypted API key (optional, for BYO key)
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 1000,
    system_prompt TEXT DEFAULT 'You are a helpful assistant.',
    context_window INTEGER DEFAULT 10,
    enable_streaming BOOLEAN DEFAULT true,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Ensure one AI config per bot
    CONSTRAINT unique_bot_ai_config UNIQUE (bot_id),

    -- Validate provider
    CONSTRAINT valid_provider CHECK (provider IN ('openai', 'claude')),

    -- Validate temperature range
    CONSTRAINT valid_temperature CHECK (temperature >= 0 AND temperature <= 2.0),

    -- Validate max_tokens
    CONSTRAINT valid_max_tokens CHECK (max_tokens > 0 AND max_tokens <= 100000),

    -- Validate context_window
    CONSTRAINT valid_context_window CHECK (context_window >= 0 AND context_window <= 100)
);

-- AI Usage Tracking (for billing and analytics)
-- Logs every AI API call with token usage and cost
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost_usd DECIMAL(10,6) DEFAULT 0,
    response_time_ms INTEGER DEFAULT 0,
    user_message TEXT,
    ai_response TEXT,
    error_message TEXT,            -- Store error if API call failed
    status VARCHAR(20) DEFAULT 'success', -- 'success', 'error', 'rate_limited'
    created_at TIMESTAMP DEFAULT NOW(),

    -- Validate status
    CONSTRAINT valid_status CHECK (status IN ('success', 'error', 'rate_limited', 'timeout'))
);

-- Conversation History (for context tracking)
-- Stores message history for maintaining conversation context
CREATE TABLE IF NOT EXISTS ai_conversations (
    id SERIAL PRIMARY KEY,
    bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL, -- Unique session identifier (e.g., user_id or chat_id)
    role VARCHAR(20) NOT NULL,        -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),

    -- Validate role
    CONSTRAINT valid_role CHECK (role IN ('user', 'assistant', 'system'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_config_bot_id ON ai_configurations(bot_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_org_id ON ai_usage_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_bot_id ON ai_usage_logs(bot_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_status ON ai_usage_logs(status);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_bot_session ON ai_conversations(bot_id, session_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at ON ai_conversations(created_at);

-- Comments for documentation
COMMENT ON TABLE ai_configurations IS 'AI provider configuration per bot - stores OpenAI/Claude settings';
COMMENT ON TABLE ai_usage_logs IS 'Tracks AI API usage for billing and analytics';
COMMENT ON TABLE ai_conversations IS 'Stores conversation history for context-aware AI responses';

COMMENT ON COLUMN ai_configurations.api_key_encrypted IS 'Encrypted API key using AES-256. NULL means use platform key.';
COMMENT ON COLUMN ai_configurations.context_window IS 'Number of previous messages to include in context (0-100)';
COMMENT ON COLUMN ai_usage_logs.cost_usd IS 'Calculated cost in USD based on provider pricing';
COMMENT ON COLUMN ai_conversations.session_id IS 'Unique session identifier (e.g., telegram_user_id, discord_user_id)';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ AI tables created successfully!';
    RAISE NOTICE '   - ai_configurations (AI settings per bot)';
    RAISE NOTICE '   - ai_usage_logs (usage tracking for billing)';
    RAISE NOTICE '   - ai_conversations (conversation history)';
END $$;
