const db = require('../db');

async function checkDemoUser() {
  try {
    console.log('Checking for demo user...\n');

    const result = await db.query(
      'SELECT id, email, name FROM users WHERE email = $1',
      ['demo@botbuilder.com']
    );

    if (result.rows.length > 0) {
      console.log('✅ Demo user EXISTS in database:');
      console.log('   ID:', result.rows[0].id);
      console.log('   Email:', result.rows[0].email);
      console.log('   Name:', result.rows[0].name);

      // Check organization
      const orgResult = await db.query(
        `SELECT om.org_id, o.name, o.slug
         FROM organization_members om
         JOIN organizations o ON o.id = om.org_id
         WHERE om.user_id = $1 AND om.status = 'active'`,
        [result.rows[0].id]
      );

      if (orgResult.rows.length > 0) {
        console.log('\n✅ Demo organization:');
        console.log('   Org ID:', orgResult.rows[0].org_id);
        console.log('   Name:', orgResult.rows[0].name);
        console.log('   Slug:', orgResult.rows[0].slug);
      } else {
        console.log('\n❌ No organization found for demo user');
      }

      process.exit(0);
    } else {
      console.log('❌ Demo user NOT found in database');
      console.log('\nRun: node server/scripts/seed-demo-account.js');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error checking demo user:', error.message);
    process.exit(1);
  }
}

checkDemoUser();
