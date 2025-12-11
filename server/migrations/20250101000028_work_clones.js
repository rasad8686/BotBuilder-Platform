/**
 * Work Clones Migration
 * Creates tables for AI work clone feature
 */

exports.up = function(knex) {
  return knex.raw(`
    -- Work Clones table
    CREATE TABLE IF NOT EXISTS work_clones (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        avatar_url VARCHAR(500),
        status VARCHAR(50) DEFAULT 'draft',
        ai_model VARCHAR(100) DEFAULT 'gpt-4',
        temperature DECIMAL(3,2) DEFAULT 0.7,
        max_tokens INTEGER DEFAULT 2048,
        base_system_prompt TEXT,
        personality_prompt TEXT,
        writing_style_prompt TEXT,
        style_profile JSONB DEFAULT '{}'::jsonb,
        tone_settings JSONB DEFAULT '{}'::jsonb,
        vocabulary_preferences JSONB DEFAULT '{}'::jsonb,
        response_patterns JSONB DEFAULT '{}'::jsonb,
        training_samples_count INTEGER DEFAULT 0,
        training_score DECIMAL(5,2) DEFAULT 0,
        last_trained_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        settings JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Clone Training Data table
    CREATE TABLE IF NOT EXISTS clone_training_data (
        id SERIAL PRIMARY KEY,
        clone_id INTEGER NOT NULL REFERENCES work_clones(id) ON DELETE CASCADE,
        data_type VARCHAR(50) NOT NULL,
        source VARCHAR(255),
        original_content TEXT NOT NULL,
        processed_content TEXT,
        extracted_features JSONB DEFAULT '{}'::jsonb,
        style_markers JSONB DEFAULT '{}'::jsonb,
        tone_analysis JSONB DEFAULT '{}'::jsonb,
        quality_score DECIMAL(5,2) DEFAULT 0,
        is_approved BOOLEAN DEFAULT true,
        is_processed BOOLEAN DEFAULT false,
        processed_at TIMESTAMP,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Clone Responses table
    CREATE TABLE IF NOT EXISTS clone_responses (
        id SERIAL PRIMARY KEY,
        clone_id INTEGER NOT NULL REFERENCES work_clones(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        input_prompt TEXT NOT NULL,
        generated_response TEXT NOT NULL,
        edited_response TEXT,
        response_type VARCHAR(50),
        context VARCHAR(255),
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        latency_ms INTEGER DEFAULT 0,
        similarity_score DECIMAL(5,2),
        rating INTEGER,
        feedback TEXT,
        was_edited BOOLEAN DEFAULT false,
        was_used BOOLEAN DEFAULT false,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Clone Sessions table
    CREATE TABLE IF NOT EXISTS clone_sessions (
        id SERIAL PRIMARY KEY,
        clone_id INTEGER NOT NULL REFERENCES work_clones(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        session_type VARCHAR(50),
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP,
        messages_count INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        context_data JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_work_clones_org ON work_clones(organization_id);
    CREATE INDEX IF NOT EXISTS idx_work_clones_user ON work_clones(user_id);
    CREATE INDEX IF NOT EXISTS idx_work_clones_status ON work_clones(status);
    CREATE INDEX IF NOT EXISTS idx_clone_training_clone ON clone_training_data(clone_id);
    CREATE INDEX IF NOT EXISTS idx_clone_training_type ON clone_training_data(data_type);
    CREATE INDEX IF NOT EXISTS idx_clone_responses_clone ON clone_responses(clone_id);
    CREATE INDEX IF NOT EXISTS idx_clone_responses_user ON clone_responses(user_id);
    CREATE INDEX IF NOT EXISTS idx_clone_sessions_clone ON clone_sessions(clone_id);
  `);
};

exports.down = function(knex) {
  return knex.raw(`
    DROP TABLE IF EXISTS clone_sessions;
    DROP TABLE IF EXISTS clone_responses;
    DROP TABLE IF EXISTS clone_training_data;
    DROP TABLE IF EXISTS work_clones;
  `);
};
