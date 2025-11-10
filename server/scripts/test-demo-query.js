const db = require('../db');

async function testDemoQuery() {
  try {
    console.log('Testing exact query from /api/auth/demo endpoint...\n');

    const demoEmail = 'demo@botbuilder.com';

    console.log('Query:', 'SELECT id, name, email, password_hash FROM users WHERE email = $1');
    console.log('Parameter:', demoEmail);
    console.log('');

    const result = await db.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [demoEmail]
    );

    console.log('Result rows:', result.rows.length);
    console.log('');

    if (result.rows.length > 0) {
      console.log('✅ Demo user FOUND:');
      console.log('   ID:', result.rows[0].id);
      console.log('   Email:', result.rows[0].email);
      console.log('   Name:', result.rows[0].name);
      console.log('   Has password_hash:', !!result.rows[0].password_hash);
    } else {
      console.log('❌ Demo user NOT FOUND');

      // Try without the email parameter to see all users
      const allUsers = await db.query('SELECT id, email, name FROM users');
      console.log('\nAll users in database:');
      allUsers.rows.forEach(u => {
        console.log(`  - ID ${u.id}: ${u.email} (${u.name})`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testDemoQuery();
