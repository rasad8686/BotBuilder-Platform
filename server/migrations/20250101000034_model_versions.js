/**
 * Model Versions & A/B Testing Tables Migration
 *
 * Creates tables for:
 * - Model versioning (tracking different versions of fine-tuned models)
 * - A/B testing (comparing model versions)
 * - Test results (storing comparison data)
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.raw(`
    -- =====================================================
    -- MODEL VERSIONS TABLE
    -- Tracks different versions of fine-tuned models
    -- =====================================================
    CREATE TABLE IF NOT EXISTS model_versions (
        id SERIAL PRIMARY KEY,
        fine_tune_model_id INTEGER NOT NULL REFERENCES fine_tune_models(id) ON DELETE CASCADE,
        version_number VARCHAR(20) NOT NULL,
        openai_model_id VARCHAR(255),
        description TEXT,
        is_active BOOLEAN DEFAULT false,
        is_production BOOLEAN DEFAULT false,
        performance_score DECIMAL(5, 2),
        metrics JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_model_version UNIQUE (fine_tune_model_id, version_number)
    );

    -- Indexes for model_versions
    CREATE INDEX IF NOT EXISTS idx_model_versions_model_id ON model_versions(fine_tune_model_id);
    CREATE INDEX IF NOT EXISTS idx_model_versions_active ON model_versions(is_active) WHERE is_active = true;
    CREATE INDEX IF NOT EXISTS idx_model_versions_production ON model_versions(is_production) WHERE is_production = true;
    CREATE INDEX IF NOT EXISTS idx_model_versions_created ON model_versions(created_at DESC);

    -- =====================================================
    -- A/B TESTS TABLE
    -- Stores A/B test configurations
    -- =====================================================
    CREATE TABLE IF NOT EXISTS ab_tests (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        model_a_version_id INTEGER NOT NULL REFERENCES model_versions(id) ON DELETE CASCADE,
        model_b_version_id INTEGER NOT NULL REFERENCES model_versions(id) ON DELETE CASCADE,
        traffic_split INTEGER NOT NULL DEFAULT 50 CHECK (traffic_split >= 0 AND traffic_split <= 100),
        status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed', 'cancelled')),
        winner_version_id INTEGER REFERENCES model_versions(id) ON DELETE SET NULL,
        total_requests INTEGER DEFAULT 0,
        started_at TIMESTAMP WITH TIME ZONE,
        ended_at TIMESTAMP WITH TIME ZONE,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for ab_tests
    CREATE INDEX IF NOT EXISTS idx_ab_tests_org_id ON ab_tests(organization_id);
    CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);
    CREATE INDEX IF NOT EXISTS idx_ab_tests_model_a ON ab_tests(model_a_version_id);
    CREATE INDEX IF NOT EXISTS idx_ab_tests_model_b ON ab_tests(model_b_version_id);
    CREATE INDEX IF NOT EXISTS idx_ab_tests_created ON ab_tests(created_at DESC);

    -- =====================================================
    -- A/B TEST RESULTS TABLE
    -- Stores individual test results
    -- =====================================================
    CREATE TABLE IF NOT EXISTS ab_test_results (
        id SERIAL PRIMARY KEY,
        ab_test_id INTEGER NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
        version_id INTEGER NOT NULL REFERENCES model_versions(id) ON DELETE CASCADE,
        prompt TEXT NOT NULL,
        response TEXT,
        response_time_ms INTEGER,
        tokens_used INTEGER DEFAULT 0,
        user_rating INTEGER CHECK (user_rating IS NULL OR (user_rating >= 1 AND user_rating <= 5)),
        is_preferred BOOLEAN,
        session_id VARCHAR(255),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for ab_test_results
    CREATE INDEX IF NOT EXISTS idx_ab_results_test_id ON ab_test_results(ab_test_id);
    CREATE INDEX IF NOT EXISTS idx_ab_results_version_id ON ab_test_results(version_id);
    CREATE INDEX IF NOT EXISTS idx_ab_results_created ON ab_test_results(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ab_results_session ON ab_test_results(session_id);

    -- =====================================================
    -- TRIGGER: Update updated_at timestamp
    -- =====================================================
    CREATE OR REPLACE FUNCTION update_model_versions_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_model_versions_updated_at ON model_versions;
    CREATE TRIGGER trigger_model_versions_updated_at
        BEFORE UPDATE ON model_versions
        FOR EACH ROW
        EXECUTE FUNCTION update_model_versions_updated_at();

    DROP TRIGGER IF EXISTS trigger_ab_tests_updated_at ON ab_tests;
    CREATE TRIGGER trigger_ab_tests_updated_at
        BEFORE UPDATE ON ab_tests
        FOR EACH ROW
        EXECUTE FUNCTION update_model_versions_updated_at();
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.raw(`
    DROP TRIGGER IF EXISTS trigger_ab_tests_updated_at ON ab_tests;
    DROP TRIGGER IF EXISTS trigger_model_versions_updated_at ON model_versions;
    DROP FUNCTION IF EXISTS update_model_versions_updated_at();
    DROP TABLE IF EXISTS ab_test_results;
    DROP TABLE IF EXISTS ab_tests;
    DROP TABLE IF EXISTS model_versions;
  `);
};
