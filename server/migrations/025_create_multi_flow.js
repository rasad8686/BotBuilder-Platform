const { Pool } = require('pg');
require('dotenv').config();
const log = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function up() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. flow_orchestrations - Multi-flow orchestration management
    await client.query(`
      CREATE TABLE IF NOT EXISTS flow_orchestrations (
        id SERIAL PRIMARY KEY,
        bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        entry_flow_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. flow_transitions - Transitions between flows
    await client.query(`
      CREATE TABLE IF NOT EXISTS flow_transitions (
        id SERIAL PRIMARY KEY,
        orchestration_id INTEGER NOT NULL REFERENCES flow_orchestrations(id) ON DELETE CASCADE,
        from_flow_id INTEGER NOT NULL,
        to_flow_id INTEGER NOT NULL,
        trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('on_complete', 'on_condition', 'on_intent', 'on_keyword')),
        trigger_value JSONB DEFAULT '{}',
        priority INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. flow_variables - Shared variables between flows
    await client.query(`
      CREATE TABLE IF NOT EXISTS flow_variables (
        id SERIAL PRIMARY KEY,
        orchestration_id INTEGER NOT NULL REFERENCES flow_orchestrations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'string',
        default_value TEXT,
        scope VARCHAR(50) NOT NULL DEFAULT 'session' CHECK (scope IN ('global', 'session', 'flow')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes for better performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_flow_orchestrations_bot_id ON flow_orchestrations(bot_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_flow_transitions_orchestration_id ON flow_transitions(orchestration_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_flow_transitions_from_flow_id ON flow_transitions(from_flow_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_flow_variables_orchestration_id ON flow_variables(orchestration_id)`);

    await client.query('COMMIT');
    log.info('Migration 025_create_multi_flow completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    log.error('Migration 025_create_multi_flow failed', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query('DROP TABLE IF EXISTS flow_variables CASCADE');
    await client.query('DROP TABLE IF EXISTS flow_transitions CASCADE');
    await client.query('DROP TABLE IF EXISTS flow_orchestrations CASCADE');

    await client.query('COMMIT');
    log.info('Migration 025_create_multi_flow rolled back successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    log.error('Migration 025_create_multi_flow rollback failed', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

// Run migration
if (require.main === module) {
  up()
    .then(() => {
      log.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      log.error('Migration failed', { error: error.message });
      process.exit(1);
    });
}

module.exports = { up, down };
