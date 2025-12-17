/**
 * AI Fine-tuning Platform - Database Migration
 *
 * Creates tables for:
 * - fine_tune_models: Custom trained AI models
 * - fine_tune_datasets: Training data files
 * - fine_tune_jobs: Training job tracking
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.raw(`
    -- =====================================================
    -- FINE-TUNE MODELS TABLE
    -- Stores custom trained AI model configurations
    -- =====================================================
    CREATE TABLE IF NOT EXISTS fine_tune_models (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        base_model VARCHAR(100) NOT NULL DEFAULT 'gpt-3.5-turbo',
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        training_file_url TEXT,
        model_id VARCHAR(255),
        training_started_at TIMESTAMP WITH TIME ZONE,
        training_completed_at TIMESTAMP WITH TIME ZONE,
        training_cost DECIMAL(10, 4) DEFAULT 0,
        metrics JSONB DEFAULT '{}'::jsonb,
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_status CHECK (status IN ('pending', 'uploading', 'validating', 'training', 'completed', 'failed', 'cancelled')),
        CONSTRAINT valid_base_model CHECK (base_model IN ('gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'))
    );

    -- Indexes for fine_tune_models
    CREATE INDEX IF NOT EXISTS idx_fine_tune_models_user_id ON fine_tune_models(user_id);
    CREATE INDEX IF NOT EXISTS idx_fine_tune_models_org_id ON fine_tune_models(organization_id);
    CREATE INDEX IF NOT EXISTS idx_fine_tune_models_status ON fine_tune_models(status);
    CREATE INDEX IF NOT EXISTS idx_fine_tune_models_created_at ON fine_tune_models(created_at DESC);

    -- =====================================================
    -- FINE-TUNE DATASETS TABLE
    -- Stores training data files for models
    -- =====================================================
    CREATE TABLE IF NOT EXISTS fine_tune_datasets (
        id SERIAL PRIMARY KEY,
        fine_tune_model_id INTEGER NOT NULL REFERENCES fine_tune_models(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_url TEXT,
        file_path TEXT,
        file_size INTEGER DEFAULT 0,
        row_count INTEGER DEFAULT 0,
        format VARCHAR(20) NOT NULL DEFAULT 'jsonl',
        status VARCHAR(50) NOT NULL DEFAULT 'uploading',
        validation_errors JSONB DEFAULT '[]'::jsonb,
        openai_file_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_format CHECK (format IN ('jsonl', 'csv', 'json')),
        CONSTRAINT valid_dataset_status CHECK (status IN ('uploading', 'processing', 'validating', 'ready', 'error'))
    );

    -- Indexes for fine_tune_datasets
    CREATE INDEX IF NOT EXISTS idx_fine_tune_datasets_model_id ON fine_tune_datasets(fine_tune_model_id);
    CREATE INDEX IF NOT EXISTS idx_fine_tune_datasets_status ON fine_tune_datasets(status);

    -- =====================================================
    -- FINE-TUNE JOBS TABLE
    -- Tracks training job progress and configuration
    -- =====================================================
    CREATE TABLE IF NOT EXISTS fine_tune_jobs (
        id SERIAL PRIMARY KEY,
        fine_tune_model_id INTEGER NOT NULL REFERENCES fine_tune_models(id) ON DELETE CASCADE,
        job_id VARCHAR(255),
        provider VARCHAR(50) NOT NULL DEFAULT 'openai',
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        trained_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        epochs INTEGER DEFAULT 3,
        batch_size INTEGER DEFAULT 1,
        learning_rate DECIMAL(10, 8) DEFAULT 0.0001,
        validation_file_id VARCHAR(255),
        result_model_id VARCHAR(255),
        error_message TEXT,
        hyperparameters JSONB DEFAULT '{}'::jsonb,
        training_metrics JSONB DEFAULT '{}'::jsonb,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_job_status CHECK (status IN ('pending', 'validating_files', 'queued', 'running', 'succeeded', 'failed', 'cancelled')),
        CONSTRAINT valid_provider CHECK (provider IN ('openai', 'anthropic', 'custom'))
    );

    -- Indexes for fine_tune_jobs
    CREATE INDEX IF NOT EXISTS idx_fine_tune_jobs_model_id ON fine_tune_jobs(fine_tune_model_id);
    CREATE INDEX IF NOT EXISTS idx_fine_tune_jobs_job_id ON fine_tune_jobs(job_id);
    CREATE INDEX IF NOT EXISTS idx_fine_tune_jobs_status ON fine_tune_jobs(status);

    -- =====================================================
    -- UPDATE TRIGGERS
    -- =====================================================
    CREATE OR REPLACE FUNCTION update_fine_tune_models_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_fine_tune_models_updated_at ON fine_tune_models;
    CREATE TRIGGER trigger_fine_tune_models_updated_at
        BEFORE UPDATE ON fine_tune_models
        FOR EACH ROW
        EXECUTE FUNCTION update_fine_tune_models_updated_at();

    CREATE OR REPLACE FUNCTION update_fine_tune_jobs_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_fine_tune_jobs_updated_at ON fine_tune_jobs;
    CREATE TRIGGER trigger_fine_tune_jobs_updated_at
        BEFORE UPDATE ON fine_tune_jobs
        FOR EACH ROW
        EXECUTE FUNCTION update_fine_tune_jobs_updated_at();
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.raw(`
    DROP TRIGGER IF EXISTS trigger_fine_tune_jobs_updated_at ON fine_tune_jobs;
    DROP FUNCTION IF EXISTS update_fine_tune_jobs_updated_at();
    DROP TRIGGER IF EXISTS trigger_fine_tune_models_updated_at ON fine_tune_models;
    DROP FUNCTION IF EXISTS update_fine_tune_models_updated_at();
    DROP TABLE IF EXISTS fine_tune_jobs;
    DROP TABLE IF EXISTS fine_tune_datasets;
    DROP TABLE IF EXISTS fine_tune_models;
  `);
};
