const db = require('../db');

async function checkDemoOrgs() {
  try {
    console.log('Checking demo user organization memberships...\n');

    const demoEmail = 'demo@botbuilder.com';

    // Get demo user
    const userResult = await db.query(
      'SELECT id, name, email FROM users WHERE email = $1',
      [demoEmail]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ Demo user not found!');
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log('✅ Demo user found:');
    console.log('   ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Name:', user.name);
    console.log('');

    // Get all organizations for demo user
    const orgResult = await db.query(
      `SELECT om.org_id, o.name, o.slug, om.role, om.status, om.joined_at
       FROM organization_members om
       JOIN organizations o ON o.id = om.org_id
       WHERE om.user_id = $1
       ORDER BY om.joined_at ASC`,
      [user.id]
    );

    console.log('Organizations for demo user:');
    console.log('Total:', orgResult.rows.length);
    console.log('');

    if (orgResult.rows.length === 0) {
      console.log('❌ No organizations found!');
    } else {
      orgResult.rows.forEach((org, index) => {
        console.log(`${index + 1}. ${org.name} (ID: ${org.org_id})`);
        console.log(`   Slug: ${org.slug}`);
        console.log(`   Role: ${org.role}`);
        console.log(`   Status: ${org.status}`);
        console.log(`   Joined: ${org.joined_at}`);
        console.log('');
      });

      // Highlight which one would be selected
      console.log('⚠️  FIRST org by joined_at (currently selected):');
      const firstOrg = orgResult.rows[0];
      console.log(`   ${firstOrg.name} (${firstOrg.slug})`);
      console.log('');
    }

    // Get bots for each organization
    for (const org of orgResult.rows) {
      const botResult = await db.query(
        'SELECT id, name, platform FROM bots WHERE organization_id = $1',
        [org.org_id]
      );

      console.log(`Bots in "${org.name}" (${org.slug}):`);
      if (botResult.rows.length === 0) {
        console.log('   No bots');
      } else {
        botResult.rows.forEach(bot => {
          console.log(`   - ${bot.name} (${bot.platform}) - ID: ${bot.id}`);
        });
      }
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDemoOrgs();
