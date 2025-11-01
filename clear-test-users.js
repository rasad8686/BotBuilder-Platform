const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function clearTestUsers() {
  try {
    console.log('\n⚠️  This script will delete ALL test users from the database!');
    console.log('Press Ctrl+C within 5 seconds to cancel...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete all users (be careful with this!)
    const result = await pool.query(
      'DELETE FROM users WHERE email LIKE $1 OR email LIKE $2 OR email LIKE $3',
      ['%@test.com', '%@example.com', 'test%@%']
    );

    console.log(`✅ Deleted ${result.rowCount} test user(s) from database.\n`);

    // Show remaining users
    const remaining = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`📊 Remaining users: ${remaining.rows[0].count}\n`);

    await pool.end();
  } catch (error) {
    console.error('❌ Error clearing users:', error.message);
    await pool.end();
    process.exit(1);
  }
}

clearTestUsers();
