const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  try {
    console.log('🚀 Running white-label settings migration...');

    const migrationPath = path.join(__dirname, 'migrations', '007_whitelabel_settings.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('📋 White-label settings table created');
    console.log('🔍 Checking table...');

    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM whitelabel_settings
    `);

    console.log(`✅ Found ${result.rows[0].count} white-label settings in database`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
