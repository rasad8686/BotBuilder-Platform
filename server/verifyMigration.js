const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function verifyMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check roles table
    console.log('📊 ROLES TABLE:');
    const roles = await client.query('SELECT name, description FROM roles ORDER BY name');
    roles.rows.forEach(row => {
      console.log(`  - ${row.name}: ${row.description}`);
    });

    // Check organizations table
    console.log('\n📊 ORGANIZATIONS TABLE:');
    const orgs = await client.query('SELECT id, name, slug, owner_id, plan_tier FROM organizations');
    console.log(`  Total organizations: ${orgs.rows.length}`);
    orgs.rows.forEach(row => {
      console.log(`  - ${row.name} (ID: ${row.id}, Owner: ${row.owner_id}, Plan: ${row.plan_tier})`);
    });

    // Check organization_members table
    console.log('\n📊 ORGANIZATION_MEMBERS TABLE:');
    const members = await client.query('SELECT org_id, user_id, role, status FROM organization_members');
    console.log(`  Total members: ${members.rows.length}`);
    members.rows.forEach(row => {
      console.log(`  - User ${row.user_id} in Org ${row.org_id} as ${row.role} (${row.status})`);
    });

    // Check bots table has organization_id
    console.log('\n📊 BOTS TABLE (organization_id column):');
    const bots = await client.query('SELECT id, name, user_id, organization_id FROM bots LIMIT 5');
    console.log(`  Sample bots: ${bots.rows.length}`);
    bots.rows.forEach(row => {
      console.log(`  - Bot ${row.id}: "${row.name}" (User: ${row.user_id}, Org: ${row.organization_id})`);
    });

    // Check bot_messages table has organization_id
    console.log('\n📊 BOT_MESSAGES TABLE (organization_id column):');
    const messages = await client.query('SELECT id, bot_id, organization_id FROM bot_messages LIMIT 5');
    console.log(`  Sample messages: ${messages.rows.length}`);
    messages.rows.forEach(row => {
      console.log(`  - Message ${row.id} (Bot: ${row.bot_id}, Org: ${row.organization_id})`);
    });

    // Check api_tokens table has organization_id
    console.log('\n📊 API_TOKENS TABLE (organization_id column):');
    const tokens = await client.query('SELECT id, user_id, organization_id FROM api_tokens LIMIT 5');
    console.log(`  Sample tokens: ${tokens.rows.length}`);
    tokens.rows.forEach(row => {
      console.log(`  - Token ${row.id} (User: ${row.user_id}, Org: ${row.organization_id})`);
    });

    console.log('\n✅ Migration verification complete!');
    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

verifyMigration();
