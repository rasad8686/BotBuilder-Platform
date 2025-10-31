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
    console.log('🚀 Running billing columns migration...');
    console.log(`📍 Database: ${process.env.DATABASE_URL?.split('@')[1] || 'local'}`);

    const migrationPath = path.join(__dirname, 'migrations', '008_add_billing_columns.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Executing migration SQL...');
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('📋 Billing columns added to organizations table');
    console.log('🔍 Verifying columns...');

    // Verify the columns were created
    const verifyResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'organizations'
      AND column_name IN ('stripe_customer_id', 'stripe_subscription_id', 'subscription_status', 'subscription_current_period_end')
      ORDER BY column_name
    `);

    console.log('\n✅ Verified columns:');
    verifyResult.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

    // Check indexes
    const indexResult = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'organizations'
      AND indexname LIKE '%stripe%'
      OR indexname LIKE '%subscription%'
    `);

    if (indexResult.rows.length > 0) {
      console.log('\n✅ Verified indexes:');
      indexResult.rows.forEach(idx => {
        console.log(`   - ${idx.indexname}`);
      });
    }

    console.log('\n🎉 Billing system database is ready!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
