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
