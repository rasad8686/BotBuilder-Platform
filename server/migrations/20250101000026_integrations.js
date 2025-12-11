/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.raw(`
    -- Integrations table
    CREATE TABLE IF NOT EXISTS integrations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        credentials JSONB DEFAULT '{}'::jsonb,
        config JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(50) DEFAULT 'disconnected',
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TIMESTAMP WITH TIME ZONE,
        scopes TEXT[],
        metadata JSONB DEFAULT '{}'::jsonb,
        last_sync_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, type, name)
    );

    -- Integration logs table
    CREATE TABLE IF NOT EXISTS integration_logs (
        id SERIAL PRIMARY KEY,
        integration_id INTEGER NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
        action VARCHAR(100) NOT NULL,
        action_type VARCHAR(50) DEFAULT 'api_call',
        request_data JSONB,
        response_data JSONB,
        result VARCHAR(50) DEFAULT 'success',
        error_message TEXT,
        duration_ms INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
    CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(type);
    CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);
    CREATE INDEX IF NOT EXISTS idx_integrations_user_type ON integrations(user_id, type);
    CREATE INDEX IF NOT EXISTS idx_integration_logs_integration_id ON integration_logs(integration_id);
    CREATE INDEX IF NOT EXISTS idx_integration_logs_action ON integration_logs(action);
    CREATE INDEX IF NOT EXISTS idx_integration_logs_created_at ON integration_logs(created_at DESC);

    -- Update trigger
    CREATE OR REPLACE FUNCTION update_integrations_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_integrations_updated_at ON integrations;
    CREATE TRIGGER trigger_integrations_updated_at
        BEFORE UPDATE ON integrations
        FOR EACH ROW
        EXECUTE FUNCTION update_integrations_updated_at();
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.raw(`
    DROP TRIGGER IF EXISTS trigger_integrations_updated_at ON integrations;
    DROP FUNCTION IF EXISTS update_integrations_updated_at();
    DROP TABLE IF EXISTS integration_logs;
    DROP TABLE IF EXISTS integrations;
  `);
};
