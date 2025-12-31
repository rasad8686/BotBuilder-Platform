/**
 * Clone System Database Migration
 * Voice cloning, Style transfer, Personality cloning support
 */

const db = require('../db');

async function up() {
  // Clone Jobs - Main table for all clone operations
  await db.query(`
    CREATE TABLE IF NOT EXISTS clone_jobs (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      bot_id INTEGER REFERENCES bots(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      type VARCHAR(50) NOT NULL CHECK (type IN ('voice', 'style', 'personality', 'full')),
      status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'training', 'ready', 'failed', 'archived')),
      config JSONB DEFAULT '{}',
      model_path VARCHAR(500),
      model_provider VARCHAR(50) DEFAULT 'openai',
      base_model VARCHAR(100),
      training_progress INTEGER DEFAULT 0,
      training_started_at TIMESTAMP,
      training_completed_at TIMESTAMP,
      error_message TEXT,
      metrics JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Clone Samples - Training data samples
  await db.query(`
    CREATE TABLE IF NOT EXISTS clone_samples (
      id SERIAL PRIMARY KEY,
      clone_job_id INTEGER REFERENCES clone_jobs(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL CHECK (type IN ('audio', 'text', 'chat_history', 'document', 'email')),
      file_path VARCHAR(500),
      file_name VARCHAR(255),
      file_size INTEGER,
      mime_type VARCHAR(100),
      content TEXT,
      duration_seconds DECIMAL(10,2),
      metadata JSONB DEFAULT '{}',
      processed BOOLEAN DEFAULT false,
      processed_data JSONB,
      quality_score DECIMAL(5,2),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Clone Versions - Version history for clones
  await db.query(`
    CREATE TABLE IF NOT EXISTS clone_versions (
      id SERIAL PRIMARY KEY,
      clone_job_id INTEGER REFERENCES clone_jobs(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      version_tag VARCHAR(50),
      model_path VARCHAR(500),
      config JSONB DEFAULT '{}',
      metrics JSONB DEFAULT '{}',
      training_samples_count INTEGER DEFAULT 0,
      accuracy_score DECIMAL(5,2),
      similarity_score DECIMAL(5,2),
      is_active BOOLEAN DEFAULT false,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      created_by INTEGER REFERENCES users(id)
    )
  `);

  // Clone Applications - Track where clones are applied
  await db.query(`
    CREATE TABLE IF NOT EXISTS clone_applications (
      id SERIAL PRIMARY KEY,
      clone_job_id INTEGER REFERENCES clone_jobs(id) ON DELETE CASCADE,
      clone_version_id INTEGER REFERENCES clone_versions(id) ON DELETE SET NULL,
      bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
      applied_at TIMESTAMP DEFAULT NOW(),
      applied_by INTEGER REFERENCES users(id),
      config_snapshot JSONB,
      is_active BOOLEAN DEFAULT true,
      removed_at TIMESTAMP,
      removed_by INTEGER REFERENCES users(id)
    )
  `);

  // Voice Clone Profiles - Voice-specific settings
  await db.query(`
    CREATE TABLE IF NOT EXISTS voice_clone_profiles (
      id SERIAL PRIMARY KEY,
      clone_job_id INTEGER REFERENCES clone_jobs(id) ON DELETE CASCADE,
      voice_id VARCHAR(100),
      voice_name VARCHAR(255),
      language VARCHAR(10) DEFAULT 'en',
      accent VARCHAR(50),
      gender VARCHAR(20),
      age_range VARCHAR(20),
      pitch_adjustment DECIMAL(5,2) DEFAULT 0,
      speed_adjustment DECIMAL(5,2) DEFAULT 1.0,
      voice_provider VARCHAR(50) DEFAULT 'elevenlabs',
      provider_voice_id VARCHAR(100),
      audio_settings JSONB DEFAULT '{}',
      sample_audio_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Style Clone Profiles - Writing style settings
  await db.query(`
    CREATE TABLE IF NOT EXISTS style_clone_profiles (
      id SERIAL PRIMARY KEY,
      clone_job_id INTEGER REFERENCES clone_jobs(id) ON DELETE CASCADE,
      formality_level VARCHAR(20) DEFAULT 'neutral',
      tone VARCHAR(50) DEFAULT 'professional',
      vocabulary_complexity VARCHAR(20) DEFAULT 'medium',
      avg_sentence_length INTEGER DEFAULT 15,
      avg_paragraph_length INTEGER DEFAULT 4,
      use_contractions BOOLEAN DEFAULT true,
      use_emoji BOOLEAN DEFAULT false,
      emoji_frequency VARCHAR(20) DEFAULT 'never',
      punctuation_style VARCHAR(50) DEFAULT 'standard',
      capitalization_style VARCHAR(50) DEFAULT 'standard',
      common_phrases JSONB DEFAULT '[]',
      avoided_words JSONB DEFAULT '[]',
      signature_patterns JSONB DEFAULT '[]',
      style_vector JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Personality Clone Profiles - Bot personality settings
  await db.query(`
    CREATE TABLE IF NOT EXISTS personality_clone_profiles (
      id SERIAL PRIMARY KEY,
      clone_job_id INTEGER REFERENCES clone_jobs(id) ON DELETE CASCADE,
      personality_name VARCHAR(255),
      traits JSONB DEFAULT '{}',
      tone_settings JSONB DEFAULT '{}',
      response_patterns JSONB DEFAULT '{}',
      greeting_templates JSONB DEFAULT '[]',
      farewell_templates JSONB DEFAULT '[]',
      error_responses JSONB DEFAULT '[]',
      fallback_responses JSONB DEFAULT '[]',
      humor_level INTEGER DEFAULT 5,
      empathy_level INTEGER DEFAULT 5,
      formality_level INTEGER DEFAULT 5,
      enthusiasm_level INTEGER DEFAULT 5,
      directness_level INTEGER DEFAULT 5,
      patience_level INTEGER DEFAULT 5,
      creativity_level INTEGER DEFAULT 5,
      system_prompt TEXT,
      personality_prompt TEXT,
      example_conversations JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Clone AB Tests - A/B testing for clones
  await db.query(`
    CREATE TABLE IF NOT EXISTS clone_ab_tests (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
      variant_a_clone_id INTEGER REFERENCES clone_jobs(id),
      variant_b_clone_id INTEGER REFERENCES clone_jobs(id),
      traffic_split INTEGER DEFAULT 50,
      status VARCHAR(50) DEFAULT 'draft',
      start_date TIMESTAMP,
      end_date TIMESTAMP,
      winner_clone_id INTEGER REFERENCES clone_jobs(id),
      metrics JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      created_by INTEGER REFERENCES users(id)
    )
  `);

  // Clone Usage Logs - Track clone usage
  await db.query(`
    CREATE TABLE IF NOT EXISTS clone_usage_logs (
      id SERIAL PRIMARY KEY,
      clone_job_id INTEGER REFERENCES clone_jobs(id) ON DELETE CASCADE,
      clone_version_id INTEGER REFERENCES clone_versions(id),
      bot_id INTEGER REFERENCES bots(id),
      user_input TEXT,
      generated_output TEXT,
      output_type VARCHAR(50),
      tokens_used INTEGER,
      latency_ms INTEGER,
      similarity_score DECIMAL(5,2),
      user_rating INTEGER,
      feedback TEXT,
      was_edited BOOLEAN DEFAULT false,
      edited_output TEXT,
      session_id VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Create indexes
  await db.query(`CREATE INDEX IF NOT EXISTS idx_clone_jobs_org ON clone_jobs(organization_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_clone_jobs_user ON clone_jobs(user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_clone_jobs_bot ON clone_jobs(bot_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_clone_jobs_type ON clone_jobs(type)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_clone_jobs_status ON clone_jobs(status)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_clone_samples_job ON clone_samples(clone_job_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_clone_versions_job ON clone_versions(clone_job_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_clone_applications_bot ON clone_applications(bot_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_clone_usage_logs_job ON clone_usage_logs(clone_job_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_clone_usage_logs_created ON clone_usage_logs(created_at)`);

  console.log('Clone system migration completed successfully');
}

async function down() {
  await db.query(`DROP TABLE IF EXISTS clone_usage_logs CASCADE`);
  await db.query(`DROP TABLE IF EXISTS clone_ab_tests CASCADE`);
  await db.query(`DROP TABLE IF EXISTS personality_clone_profiles CASCADE`);
  await db.query(`DROP TABLE IF EXISTS style_clone_profiles CASCADE`);
  await db.query(`DROP TABLE IF EXISTS voice_clone_profiles CASCADE`);
  await db.query(`DROP TABLE IF EXISTS clone_applications CASCADE`);
  await db.query(`DROP TABLE IF EXISTS clone_versions CASCADE`);
  await db.query(`DROP TABLE IF EXISTS clone_samples CASCADE`);
  await db.query(`DROP TABLE IF EXISTS clone_jobs CASCADE`);

  console.log('Clone system migration rolled back');
}

module.exports = { up, down };
