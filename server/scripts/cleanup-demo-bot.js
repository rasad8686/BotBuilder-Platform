const db = require('../db');

async function cleanupDemoBot() {
  try {
    console.log('Cleaning up old demo test bot...\n');

    // Delete the old "demo test" bot (ID: 102)
    const botId = 102;
    const botName = 'demo test';

    const result = await db.query(
      'DELETE FROM bots WHERE id = $1 AND name = $2 RETURNING id, name',
      [botId, botName]
    );

    if (result.rows.length > 0) {
      console.log(`✅ Deleted bot: ${result.rows[0].name} (ID: ${result.rows[0].id})`);
    } else {
      console.log('⚠️  Bot not found or already deleted');
    }

    // Verify remaining bots for demo organization
    const demoOrgResult = await db.query(
      `SELECT b.id, b.name, b.platform
       FROM bots b
       WHERE b.organization_id = 44
       ORDER BY b.created_at DESC`
    );

    console.log('\nRemaining bots in Demo Organization:');
    if (demoOrgResult.rows.length === 0) {
      console.log('   No bots');
    } else {
      demoOrgResult.rows.forEach(bot => {
        console.log(`   - ${bot.name} (${bot.platform}) - ID: ${bot.id}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cleanupDemoBot();
