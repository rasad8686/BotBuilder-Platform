const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkUsers() {
  try {
    const result = await pool.query(
      'SELECT id, email, name, created_at FROM users ORDER BY created_at DESC'
    );

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║          EXISTING USERS IN DATABASE                       ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    if (result.rows.length === 0) {
      console.log('✅ No users found in database.\n');
    } else {
      console.log(`Found ${result.rows.length} user(s):\n`);
      result.rows.forEach((user, index) => {
        console.log(`${index + 1}. ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Name: ${user.name || 'N/A'}`);
        console.log(`   Created: ${user.created_at}`);
        console.log('');
      });
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error checking users:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkUsers();
