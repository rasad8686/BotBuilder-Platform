const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const log = require('./utils/logger');

async function checkUsersColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    log.info('Connected to database');

    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    log.info('Users table columns', { columns: result.rows.map(r => `${r.column_name} (${r.data_type})`) });

    // Also get a sample user
    const userSample = await client.query('SELECT * FROM users LIMIT 1');
    if (userSample.rows[0]) {
      log.info('Sample user record', { user: userSample.rows[0] });
    } else {
      log.info('No users found');
    }

    await client.end();
  } catch (error) {
    log.error('Error checking users columns', { error: error.message });
    await client.end();
    process.exit(1);
  }
}

checkUsersColumns();
