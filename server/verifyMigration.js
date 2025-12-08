const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const log = require('./utils/logger');

async function verifyMigration() {
  // NOTE: rejectUnauthorized: false is acceptable for local/dev migration scripts only
  // This script is NOT used in production - it's a one-time verification utility
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    log.info('Connected to database');

    // Check roles table
    const roles = await client.query('SELECT name, description FROM roles ORDER BY name');
    log.info('ROLES TABLE', { roles: roles.rows });

    // Check organizations table
    const orgs = await client.query('SELECT id, name, slug, owner_id, plan_tier FROM organizations');
    log.info('ORGANIZATIONS TABLE', { total: orgs.rows.length, organizations: orgs.rows });

    // Check organization_members table
    const members = await client.query('SELECT org_id, user_id, role, status FROM organization_members');
    log.info('ORGANIZATION_MEMBERS TABLE', { total: members.rows.length, members: members.rows });

    // Check bots table has organization_id
    const bots = await client.query('SELECT id, name, user_id, organization_id FROM bots LIMIT 5');
    log.info('BOTS TABLE sample', { count: bots.rows.length, bots: bots.rows });

    // Check bot_messages table has organization_id
    const messages = await client.query('SELECT id, bot_id, organization_id FROM bot_messages LIMIT 5');
    log.info('BOT_MESSAGES TABLE sample', { count: messages.rows.length, messages: messages.rows });

    // Check api_tokens table has organization_id
    const tokens = await client.query('SELECT id, user_id, organization_id FROM api_tokens LIMIT 5');
    log.info('API_TOKENS TABLE sample', { count: tokens.rows.length, tokens: tokens.rows });

    log.info('Migration verification complete');
    await client.end();
  } catch (error) {
    log.error('Verification error', { error: error.message });
    await client.end();
    process.exit(1);
  }
}

verifyMigration();
