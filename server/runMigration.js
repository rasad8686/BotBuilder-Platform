const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const log = require('./utils/logger');

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    log.info('Connecting to database...');
    await client.connect();
    log.info('Connected');

    log.info('Reading migration file...');
    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations', '005_add_rbac_multitenant.sql'),
      'utf8'
    );

    log.info('Executing migration...');
    await client.query(sql);

    log.info('Migration executed successfully', {
      schema: [
        'organizations table',
        'organization_members table',
        'roles table (seeded)',
        'Added organization_id to bots, messages, api_tokens',
        'Migrated existing data to personal organizations'
      ]
    });

    await client.end();
    process.exit(0);
  } catch (error) {
    log.error('Migration error', { error: error.message, stack: error.stack });
    await client.end();
    process.exit(1);
  }
}

runMigration();
