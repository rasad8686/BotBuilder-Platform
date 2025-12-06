const db = require('../db');
const log = require('../utils/logger');

async function checkDemoUser() {
  try {
    log.info('Checking for demo user...');

    const result = await db.query(
      'SELECT id, email, name FROM users WHERE email = $1',
      ['demo@botbuilder.com']
    );

    if (result.rows.length > 0) {
      log.info('Demo user EXISTS in database', {
        id: result.rows[0].id,
        email: result.rows[0].email,
        name: result.rows[0].name
      });

      // Check organization
      const orgResult = await db.query(
        `SELECT om.org_id, o.name, o.slug
         FROM organization_members om
         JOIN organizations o ON o.id = om.org_id
         WHERE om.user_id = $1 AND om.status = 'active'`,
        [result.rows[0].id]
      );

      if (orgResult.rows.length > 0) {
        log.info('Demo organization found', {
          orgId: orgResult.rows[0].org_id,
          name: orgResult.rows[0].name,
          slug: orgResult.rows[0].slug
        });
      } else {
        log.warn('No organization found for demo user');
      }

      process.exit(0);
    } else {
      log.warn('Demo user NOT found in database. Run: node server/scripts/seed-demo-account.js');
      process.exit(1);
    }
  } catch (error) {
    log.error('Error checking demo user', { error: error.message });
    process.exit(1);
  }
}

checkDemoUser();
