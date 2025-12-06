const db = require('../db');
const log = require('../utils/logger');

async function checkAllBots() {
  try {
    log.info('Checking all bots in database...');

    const result = await db.query(
      `SELECT b.id, b.name, b.platform, b.user_id, b.organization_id,
              u.email as user_email, o.name as org_name, o.slug as org_slug
       FROM bots b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN organizations o ON b.organization_id = o.id
       ORDER BY b.created_at DESC`
    );

    log.info('Total bots', { count: result.rows.length });

    result.rows.forEach((bot, index) => {
      log.info(`Bot ${index + 1}`, {
        name: bot.name,
        id: bot.id,
        platform: bot.platform,
        user: bot.user_email,
        userId: bot.user_id,
        organization: bot.org_name,
        orgSlug: bot.org_slug,
        orgId: bot.organization_id
      });
    });

    // Check specifically for Customer Support Bot
    const csBot = result.rows.find(b => b.name === 'Customer Support Bot');
    if (csBot) {
      log.info('Customer Support Bot found', { organization: csBot.org_name, slug: csBot.org_slug });
    } else {
      log.warn('Customer Support Bot NOT found. Need to run seed script to create it.');
    }

    process.exit(0);
  } catch (error) {
    log.error('Error', { error: error.message });
    process.exit(1);
  }
}

checkAllBots();
