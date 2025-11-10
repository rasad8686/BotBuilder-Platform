const db = require('../db');

async function checkAllBots() {
  try {
    console.log('Checking all bots in database...\n');

    const result = await db.query(
      `SELECT b.id, b.name, b.platform, b.user_id, b.organization_id,
              u.email as user_email, o.name as org_name, o.slug as org_slug
       FROM bots b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN organizations o ON b.organization_id = o.id
       ORDER BY b.created_at DESC`
    );

    console.log('Total bots:', result.rows.length);
    console.log('');

    result.rows.forEach((bot, index) => {
      console.log(`${index + 1}. ${bot.name} (ID: ${bot.id})`);
      console.log(`   Platform: ${bot.platform}`);
      console.log(`   User: ${bot.user_email} (ID: ${bot.user_id})`);
      console.log(`   Organization: ${bot.org_name} (${bot.org_slug}) - ID: ${bot.organization_id}`);
      console.log('');
    });

    // Check specifically for Customer Support Bot
    const csBot = result.rows.find(b => b.name === 'Customer Support Bot');
    if (csBot) {
      console.log('✅ "Customer Support Bot" found!');
      console.log(`   Organization: ${csBot.org_name} (${csBot.org_slug})`);
    } else {
      console.log('❌ "Customer Support Bot" NOT found!');
      console.log('   Need to run seed script to create it.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAllBots();
