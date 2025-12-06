const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const log = require('./utils/logger');

async function checkTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    log.info('Connected to database');

    const result = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    log.info('Existing tables', { tables: result.rows.map(r => r.tablename) });

    await client.end();
  } catch (error) {
    log.error('Error checking tables', { error: error.message });
    await client.end();
    process.exit(1);
  }
}

checkTables();
