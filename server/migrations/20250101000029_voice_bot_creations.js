/**
 * Voice Bot Creations Migration
 * Creates tables for voice-to-bot feature
 */

exports.up = function(knex) {
  return knex.raw(`
    -- Voice Bot Creations table
    CREATE TABLE IF NOT EXISTS voice_bot_creations (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id VARCHAR(100) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'recording',

        -- Audio data
        audio_url VARCHAR(500),
        audio_duration INTEGER DEFAULT 0,
        audio_format VARCHAR(50) DEFAULT 'webm',

        -- Transcription
        transcription TEXT,
        transcription_confidence DECIMAL(5,4) DEFAULT 0,
        language VARCHAR(10) DEFAULT 'en',

        -- Extracted data
        extracted_name VARCHAR(255),
        extracted_description TEXT,
        extracted_intents JSONB DEFAULT '[]'::jsonb,
        extracted_entities JSONB DEFAULT '[]'::jsonb,
        extracted_responses JSONB DEFAULT '[]'::jsonb,
        extracted_flows JSONB DEFAULT '[]'::jsonb,

        -- Generated bot
        generated_bot_id INTEGER REFERENCES bots(id) ON DELETE SET NULL,
        generation_config JSONB DEFAULT '{}'::jsonb,

        -- AI processing
        ai_model VARCHAR(100) DEFAULT 'gpt-4',
        ai_analysis JSONB DEFAULT '{}'::jsonb,
        processing_time_ms INTEGER DEFAULT 0,

        -- Metadata
        metadata JSONB DEFAULT '{}'::jsonb,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
    );

    -- Voice Bot Sessions table (for real-time streaming)
    CREATE TABLE IF NOT EXISTS voice_bot_sessions (
        id SERIAL PRIMARY KEY,
        creation_id INTEGER REFERENCES voice_bot_creations(id) ON DELETE CASCADE,
        chunk_number INTEGER NOT NULL,
        audio_chunk BYTEA,
        chunk_transcription TEXT,
        chunk_confidence DECIMAL(5,4) DEFAULT 0,
        is_final BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Voice Bot Templates table
    CREATE TABLE IF NOT EXISTS voice_bot_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        prompt_template TEXT NOT NULL,
        example_phrases JSONB DEFAULT '[]'::jsonb,
        default_intents JSONB DEFAULT '[]'::jsonb,
        default_entities JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_voice_bot_creations_org ON voice_bot_creations(organization_id);
    CREATE INDEX IF NOT EXISTS idx_voice_bot_creations_user ON voice_bot_creations(user_id);
    CREATE INDEX IF NOT EXISTS idx_voice_bot_creations_status ON voice_bot_creations(status);
    CREATE INDEX IF NOT EXISTS idx_voice_bot_creations_session ON voice_bot_creations(session_id);
    CREATE INDEX IF NOT EXISTS idx_voice_bot_sessions_creation ON voice_bot_sessions(creation_id);
    CREATE INDEX IF NOT EXISTS idx_voice_bot_templates_category ON voice_bot_templates(category);

    -- Insert default templates
    INSERT INTO voice_bot_templates (name, description, category, prompt_template, example_phrases, default_intents) VALUES
    ('Customer Support', 'Bot for handling customer inquiries', 'support',
     'Create a customer support bot that can help with inquiries, complaints, and FAQs.',
     '["I need help with my order", "How do I return a product", "Track my shipment"]'::jsonb,
     '[{"name": "greeting", "examples": ["hello", "hi"]}, {"name": "help", "examples": ["help me", "I need assistance"]}]'::jsonb),

    ('Sales Assistant', 'Bot for product recommendations and sales', 'sales',
     'Create a sales assistant bot that recommends products and helps with purchases.',
     '["Show me your products", "What do you recommend", "I want to buy"]'::jsonb,
     '[{"name": "browse", "examples": ["show products"]}, {"name": "purchase", "examples": ["buy now"]}]'::jsonb),

    ('FAQ Bot', 'Bot for answering frequently asked questions', 'faq',
     'Create an FAQ bot that answers common questions about the business.',
     '["What are your hours", "Where are you located", "What services do you offer"]'::jsonb,
     '[{"name": "hours", "examples": ["opening hours"]}, {"name": "location", "examples": ["where are you"]}]'::jsonb),

    ('Appointment Booking', 'Bot for scheduling appointments', 'booking',
     'Create a booking bot that helps users schedule appointments and manage reservations.',
     '["Book an appointment", "Check availability", "Cancel my booking"]'::jsonb,
     '[{"name": "book", "examples": ["schedule", "reserve"]}, {"name": "cancel", "examples": ["cancel booking"]}]'::jsonb);
  `);
};

exports.down = function(knex) {
  return knex.raw(`
    DROP TABLE IF EXISTS voice_bot_sessions;
    DROP TABLE IF EXISTS voice_bot_creations;
    DROP TABLE IF EXISTS voice_bot_templates;
  `);
};
