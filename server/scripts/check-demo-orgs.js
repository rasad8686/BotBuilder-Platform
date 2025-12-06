const db = require('../db');
const log = require('../utils/logger');

async function checkDemoOrgs() {
  try {
    log.info('Checking demo user organization memberships...');

    const demoEmail = 'demo@botbuilder.com';

    // Get demo user
    const userResult = await db.query(
      'SELECT id, name, email FROM users WHERE email = $1',
      [demoEmail]
    );

    if (userResult.rows.length === 0) {
      log.warn('Demo user not found!');
      process.exit(1);
    }

    const user = userResult.rows[0];
    log.info('Demo user found', { id: user.id, email: user.email, name: user.name });

    // Get all organizations for demo user
    const orgResult = await db.query(
      `SELECT om.org_id, o.name, o.slug, om.role, om.status, om.joined_at
       FROM organization_members om
       JOIN organizations o ON o.id = om.org_id
       WHERE om.user_id = $1
       ORDER BY om.joined_at ASC`,
      [user.id]
    );

    log.info('Organizations for demo user', { total: orgResult.rows.length });

    if (orgResult.rows.length === 0) {
      log.warn('No organizations found!');
    } else {
      orgResult.rows.forEach((org, index) => {
        log.info(`Organization ${index + 1}`, {
          name: org.name,
          id: org.org_id,
          slug: org.slug,
          role: org.role,
          status: org.status,
          joined: org.joined_at
        });
      });

      // Highlight which one would be selected
      const firstOrg = orgResult.rows[0];
      log.info('FIRST org by joined_at (currently selected)', { name: firstOrg.name, slug: firstOrg.slug });
    }

    // Get bots for each organization
    for (const org of orgResult.rows) {
      const botResult = await db.query(
        'SELECT id, name, platform FROM bots WHERE organization_id = $1',
        [org.org_id]
      );

      if (botResult.rows.length === 0) {
        log.info(`Bots in "${org.name}" (${org.slug})`, { bots: 'none' });
      } else {
        log.info(`Bots in "${org.name}" (${org.slug})`, { bots: botResult.rows.map(b => `${b.name} (${b.platform}) - ID: ${b.id}`) });
      }
    }

    process.exit(0);
  } catch (error) {
    log.error('Error', { error: error.message });
    process.exit(1);
  }
}

checkDemoOrgs();
