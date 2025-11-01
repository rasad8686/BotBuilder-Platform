const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

/**
 * Flexible Migration Runner
 * Usage: node server/scripts/runMigration.js [migration-file-name]
 * Example: node server/scripts/runMigration.js 20250102_add_ai_tables.sql
 */

async function runMigration() {
  // Get migration file from command line argument
  const migrationFile = process.argv[2];

  if (!migrationFile) {
    console.error('❌ Error: Please specify a migration file');
    console.log('Usage: node server/scripts/runMigration.js <migration-file>');
    console.log('Example: node server/scripts/runMigration.js 20250102_add_ai_tables.sql');
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
    console.log('📦 Connecting to database...');
    console.log(`   Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[1] || 'Unknown'}`);
    await client.connect();
    console.log('✅ Connected!');

    console.log(`\n📦 Reading migration file: ${migrationFile}`);
    const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile);

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(`   File size: ${sql.length} bytes`);

    console.log('\n🔄 Executing migration...');
    console.log('━'.repeat(60));

    await client.query(sql);

    console.log('━'.repeat(60));
    console.log('✅ Migration executed successfully!');
    console.log(`   File: ${migrationFile}`);
    console.log(`   Time: ${new Date().toLocaleString()}`);

    await client.end();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration error:');
    console.error('━'.repeat(60));
    console.error('Message:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    if (error.hint) console.error('Hint:', error.hint);
    console.error('Stack:', error.stack);
    console.error('━'.repeat(60));

    await client.end();
    process.exit(1);
  }
}

runMigration();
