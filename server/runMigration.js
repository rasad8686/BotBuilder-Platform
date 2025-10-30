const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('📦 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!');

    console.log('📦 Reading migration file...');
    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations', '005_add_rbac_multitenant.sql'),
      'utf8'
    );

    console.log('🔄 Executing migration...');
    await client.query(sql);

    console.log('✅ Migration executed successfully!');
    console.log('📊 RBAC + Multi-tenant schema created:');
    console.log('   - organizations table');
    console.log('   - organization_members table');
    console.log('   - roles table (seeded)');
    console.log('   - Added organization_id to bots, messages, api_tokens');
    console.log('   - Migrated existing data to personal organizations');

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    await client.end();
    process.exit(1);
  }
}

runMigration();
