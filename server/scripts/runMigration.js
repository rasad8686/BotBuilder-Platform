const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const log = require('../utils/logger');

/**
 * Flexible Migration Runner
 * Usage: node server/scripts/runMigration.js [migration-file-name]
 * Example: node server/scripts/runMigration.js 20250102_add_ai_tables.sql
 */

async function runMigration() {
  // Get migration file from command line argument
  const migrationFile = process.argv[2];

  if (!migrationFile) {
    log.error('Please specify a migration file', {
      usage: 'node server/scripts/runMigration.js <migration-file>',
      example: 'node server/scripts/runMigration.js 20250102_add_ai_tables.sql'
    });
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && (
      process.env.DATABASE_URL.includes('render.com') ||
      process.env.DATABASE_URL.includes('railway.app') ||
      process.env.NODE_ENV === 'production'
    ) ? {
      rejectUnauthorized: false
    } : false
  });

  try {
    log.info('Connecting to database...', { database: process.env.DATABASE_URL?.split('@')[1]?.split('/')[1] || 'Unknown' });
    await client.connect();
    log.info('Connected');

    log.info('Reading migration file', { file: migrationFile });
    const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile);

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    log.info('Migration file loaded', { size: sql.length });

    log.info('Executing migration...');

    await client.query(sql);

    log.info('Migration executed successfully', { file: migrationFile, time: new Date().toLocaleString() });

    await client.end();
    log.info('Database connection closed');
    process.exit(0);
  } catch (error) {
    log.error('Migration error', {
      message: error.message,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    });

    await client.end();
    process.exit(1);
  }
}

runMigration();
