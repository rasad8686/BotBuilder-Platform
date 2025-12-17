/**
 * Fine-Tuning Metrics Table Migration
 *
 * Creates table for storing training metrics:
 * - Loss values (training and validation)
 * - Accuracy values
 * - Learning rate history
 * - Token processing stats
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.raw(`
    -- =====================================================
    -- FINE-TUNING METRICS TABLE
    -- Stores training metrics for visualization and analysis
    -- =====================================================
    CREATE TABLE IF NOT EXISTS fine_tuning_metrics (
        id SERIAL PRIMARY KEY,
        fine_tune_model_id INTEGER NOT NULL REFERENCES fine_tune_models(id) ON DELETE CASCADE,
        job_id VARCHAR(255),
        step INTEGER NOT NULL DEFAULT 0,
        epoch INTEGER NOT NULL DEFAULT 0,
        train_loss DECIMAL(10, 6),
        valid_loss DECIMAL(10, 6),
        train_accuracy DECIMAL(10, 6),
        valid_accuracy DECIMAL(10, 6),
        learning_rate DECIMAL(15, 10),
        tokens_processed INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_model_step UNIQUE (fine_tune_model_id, job_id, step)
    );

    -- Indexes for efficient querying
    CREATE INDEX IF NOT EXISTS idx_ft_metrics_model_id ON fine_tuning_metrics(fine_tune_model_id);
    CREATE INDEX IF NOT EXISTS idx_ft_metrics_job_id ON fine_tuning_metrics(job_id);
    CREATE INDEX IF NOT EXISTS idx_ft_metrics_step ON fine_tuning_metrics(step);
    CREATE INDEX IF NOT EXISTS idx_ft_metrics_epoch ON fine_tuning_metrics(epoch);
    CREATE INDEX IF NOT EXISTS idx_ft_metrics_created ON fine_tuning_metrics(created_at DESC);

    -- =====================================================
    -- MODEL USAGE TRACKING TABLE
    -- Tracks usage of fine-tuned models
    -- =====================================================
    CREATE TABLE IF NOT EXISTS fine_tune_model_usage (
        id SERIAL PRIMARY KEY,
        fine_tune_model_id INTEGER NOT NULL REFERENCES fine_tune_models(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        response_time_ms INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Index for usage tracking
    CREATE INDEX IF NOT EXISTS idx_ft_usage_model_id ON fine_tune_model_usage(fine_tune_model_id);
    CREATE INDEX IF NOT EXISTS idx_ft_usage_created ON fine_tune_model_usage(created_at DESC);
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.raw(`
    DROP TABLE IF EXISTS fine_tune_model_usage;
    DROP TABLE IF EXISTS fine_tuning_metrics;
  `);
};
