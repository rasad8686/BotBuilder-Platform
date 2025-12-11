/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.raw(`
    -- Voice Bots table
    CREATE TABLE IF NOT EXISTS voice_bots (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        phone_number_id INTEGER,
        voice_provider VARCHAR(50) DEFAULT 'elevenlabs',
        voice_id VARCHAR(100),
        voice_settings JSONB DEFAULT '{}'::jsonb,
        stt_provider VARCHAR(50) DEFAULT 'whisper',
        stt_settings JSONB DEFAULT '{}'::jsonb,
        tts_provider VARCHAR(50) DEFAULT 'elevenlabs',
        tts_settings JSONB DEFAULT '{}'::jsonb,
        ai_model VARCHAR(100) DEFAULT 'gpt-4',
        system_prompt TEXT,
        greeting_message TEXT DEFAULT 'Hello! How can I help you today?',
        fallback_message TEXT DEFAULT 'I''m sorry, I didn''t understand that. Could you please repeat?',
        max_call_duration INTEGER DEFAULT 600,
        language VARCHAR(10) DEFAULT 'en-US',
        status VARCHAR(50) DEFAULT 'active',
        total_calls INTEGER DEFAULT 0,
        total_duration INTEGER DEFAULT 0,
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Phone Numbers table
    CREATE TABLE IF NOT EXISTS phone_numbers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(50) DEFAULT 'twilio',
        phone_number VARCHAR(20) NOT NULL,
        friendly_name VARCHAR(255),
        country_code VARCHAR(5),
        capabilities JSONB DEFAULT '{"voice": true, "sms": false}'::jsonb,
        provider_sid VARCHAR(100),
        status VARCHAR(50) DEFAULT 'active',
        assigned_bot_id INTEGER REFERENCES voice_bots(id) ON DELETE SET NULL,
        monthly_cost DECIMAL(10,2) DEFAULT 0,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(provider, phone_number)
    );

    -- Add foreign key to voice_bots
    ALTER TABLE voice_bots
    ADD CONSTRAINT fk_voice_bots_phone_number
    FOREIGN KEY (phone_number_id) REFERENCES phone_numbers(id) ON DELETE SET NULL;

    -- Calls table
    CREATE TABLE IF NOT EXISTS calls (
        id SERIAL PRIMARY KEY,
        voice_bot_id INTEGER NOT NULL REFERENCES voice_bots(id) ON DELETE CASCADE,
        phone_number_id INTEGER REFERENCES phone_numbers(id) ON DELETE SET NULL,
        provider_call_sid VARCHAR(100),
        direction VARCHAR(20) DEFAULT 'inbound',
        from_number VARCHAR(20),
        to_number VARCHAR(20),
        status VARCHAR(50) DEFAULT 'initiated',
        start_time TIMESTAMP WITH TIME ZONE,
        end_time TIMESTAMP WITH TIME ZONE,
        duration INTEGER DEFAULT 0,
        recording_url TEXT,
        recording_duration INTEGER,
        transcription TEXT,
        ai_summary TEXT,
        sentiment VARCHAR(20),
        tokens_used INTEGER DEFAULT 0,
        cost DECIMAL(10,4) DEFAULT 0,
        error_message TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Call Segments table (for conversation turns)
    CREATE TABLE IF NOT EXISTS call_segments (
        id SERIAL PRIMARY KEY,
        call_id INTEGER NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
        segment_number INTEGER NOT NULL,
        speaker VARCHAR(20) NOT NULL,
        text TEXT NOT NULL,
        audio_url TEXT,
        start_time DECIMAL(10,3),
        end_time DECIMAL(10,3),
        duration DECIMAL(10,3),
        confidence DECIMAL(5,4),
        sentiment VARCHAR(20),
        intent VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_voice_bots_user_id ON voice_bots(user_id);
    CREATE INDEX IF NOT EXISTS idx_voice_bots_status ON voice_bots(status);
    CREATE INDEX IF NOT EXISTS idx_phone_numbers_user_id ON phone_numbers(user_id);
    CREATE INDEX IF NOT EXISTS idx_phone_numbers_number ON phone_numbers(phone_number);
    CREATE INDEX IF NOT EXISTS idx_calls_voice_bot_id ON calls(voice_bot_id);
    CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
    CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_calls_direction ON calls(direction);
    CREATE INDEX IF NOT EXISTS idx_call_segments_call_id ON call_segments(call_id);

    -- Update triggers
    CREATE OR REPLACE FUNCTION update_voice_bots_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_voice_bots_updated_at ON voice_bots;
    CREATE TRIGGER trigger_voice_bots_updated_at
        BEFORE UPDATE ON voice_bots
        FOR EACH ROW
        EXECUTE FUNCTION update_voice_bots_updated_at();

    CREATE OR REPLACE FUNCTION update_phone_numbers_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_phone_numbers_updated_at ON phone_numbers;
    CREATE TRIGGER trigger_phone_numbers_updated_at
        BEFORE UPDATE ON phone_numbers
        FOR EACH ROW
        EXECUTE FUNCTION update_phone_numbers_updated_at();
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.raw(`
    DROP TRIGGER IF EXISTS trigger_phone_numbers_updated_at ON phone_numbers;
    DROP FUNCTION IF EXISTS update_phone_numbers_updated_at();
    DROP TRIGGER IF EXISTS trigger_voice_bots_updated_at ON voice_bots;
    DROP FUNCTION IF EXISTS update_voice_bots_updated_at();
    DROP TABLE IF EXISTS call_segments;
    DROP TABLE IF EXISTS calls;
    ALTER TABLE voice_bots DROP CONSTRAINT IF EXISTS fk_voice_bots_phone_number;
    DROP TABLE IF EXISTS phone_numbers;
    DROP TABLE IF EXISTS voice_bots;
  `);
};
