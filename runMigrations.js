require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('render.com') ? {
    rejectUnauthorized: false
  } : false
});

async function runMigrations() {
  try {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║          RUNNING DATABASE MIGRATIONS                      ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    // Get all migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration file(s):\n`);
    files.forEach(file => console.log(`  - ${file}`));
    console.log('');

    // Run each migration
    for (const file of files) {
      console.log(`\n📦 Running migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await pool.query(sql);
        console.log(`   ✅ ${file} completed successfully`);
      } catch (error) {
        console.error(`   ❌ ${file} failed:`, error.message);
        // Continue with other migrations
      }
    }

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║          MIGRATIONS COMPLETED                             ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    // Show subscription plans
    try {
      const plans = await pool.query('SELECT * FROM subscription_plans ORDER BY price_monthly');
      console.log('📊 Available Subscription Plans:\n');
      plans.rows.forEach(plan => {
        console.log(`   ${plan.display_name} ($${plan.price_monthly}/mo)`);
        console.log(`   - Max Bots: ${plan.max_bots === -1 ? 'Unlimited' : plan.max_bots}`);
        console.log(`   - Max Messages: ${plan.max_messages_per_month === -1 ? 'Unlimited' : plan.max_messages_per_month}/mo`);
        console.log('');
      });
    } catch (error) {
      // Ignore if subscription_plans table doesn't exist yet
    }

    await pool.end();
    console.log('✅ Database connection closed\n');

  } catch (error) {
    console.error('❌ Migration error:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigrations();