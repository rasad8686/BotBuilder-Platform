const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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
      path.join(__dirname, 'migrations', '004_create_bot_flows.sql'),
      'utf8'
    );

    console.log('🔄 Executing migration...');
    await client.query(sql);

    console.log('✅ Migration executed successfully!');
    console.log('📊 Table bot_flows created with indexes');

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
