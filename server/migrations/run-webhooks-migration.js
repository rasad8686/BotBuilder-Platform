/**
 * Webhook Migration Runner
 * Creates webhook tables: webhooks, webhook_delivery_logs, webhook_events
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const log = require('../utils/logger');

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') ? {
    rejectUnauthorized: false
  } : (process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false)
});

async function runMigration() {
  let client;

  try {
    log.info('Connecting to database...');

    // Test connection
    client = await pool.connect();
    log.info('Connected successfully');

    log.info('Reading migration file...');

    // Read the SQL migration files
    const migration009Path = path.join(__dirname, '../../migrations/009_add_webhooks.sql');
    const migration010Path = path.join(__dirname, '../../migrations/010_fix_webhook_delivery_logs.sql');

    if (!fs.existsSync(migration009Path)) {
      throw new Error(`Migration file not found: ${migration009Path}`);
    }

    const migration009SQL = fs.readFileSync(migration009Path, 'utf-8');
    log.info('Migration file loaded');

    log.info('Running webhooks migration...');

    // Run migration 009 (creates webhooks and webhook_delivery_logs tables)
    await client.query(migration009SQL);

    // Check if migration 010 exists and run it (fixes webhook_delivery_logs to use UUID)
    if (fs.existsSync(migration010Path)) {
      log.info('Applying webhook_delivery_logs UUID fix...');
      const migration010SQL = fs.readFileSync(migration010Path, 'utf-8');
      await client.query(migration010SQL);
    }

    log.info('Webhooks tables created successfully');

    log.info('Verifying tables...');

    // Verify tables were created
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('webhooks', 'webhook_delivery_logs')
      ORDER BY table_name
    `);

    log.info('Tables created', { tables: [...tablesResult.rows.map(r => r.table_name), 'webhook_events (handled by webhookService)'] });

    log.info('Migration completed successfully');

  } catch (error) {
    log.error('MIGRATION FAILED', { error: error.message, stack: error.stack });
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the migration
runMigration();
