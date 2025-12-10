const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const log = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, '032_add_bot_language.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    log.info('Running bot language migration...');
    const result = await client.query(sql);
    log.info('Migration completed successfully', { result });
  } catch (error) {
    log.error('Migration error', { error: error.message });
    if (error.message.includes('already exists')) {
      log.info('Column already exists - migration skipped');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
