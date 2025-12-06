const db = require('../db');
const log = require('../utils/logger');

async function cleanupDemoBot() {
  try {
    log.info('Cleaning up old demo test bot...');

    // Delete the old "demo test" bot (ID: 102)
    const botId = 102;
    const botName = 'demo test';

    const result = await db.query(
      'DELETE FROM bots WHERE id = $1 AND name = $2 RETURNING id, name',
      [botId, botName]
    );

    if (result.rows.length > 0) {
      log.info('Deleted bot', { name: result.rows[0].name, id: result.rows[0].id });
    } else {
      log.warn('Bot not found or already deleted');
    }

    // Verify remaining bots for demo organization
    const demoOrgResult = await db.query(
      `SELECT b.id, b.name, b.platform
       FROM bots b
       WHERE b.organization_id = 44
       ORDER BY b.created_at DESC`
    );

    if (demoOrgResult.rows.length === 0) {
      log.info('Remaining bots in Demo Organization: none');
    } else {
      log.info('Remaining bots in Demo Organization', { bots: demoOrgResult.rows.map(b => `${b.name} (${b.platform}) - ID: ${b.id}`) });
    }

    process.exit(0);
  } catch (error) {
    log.error('Error', { error: error.message });
    process.exit(1);
  }
}

cleanupDemoBot();
