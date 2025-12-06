const db = require('../db');
const log = require('../utils/logger');

async function testDemoQuery() {
  try {
    log.info('Testing exact query from /api/auth/demo endpoint...');

    const demoEmail = 'demo@botbuilder.com';

    log.info('Query details', { query: 'SELECT id, name, email, password_hash FROM users WHERE email = $1', parameter: demoEmail });

    const result = await db.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [demoEmail]
    );

    log.info('Query result', { rows: result.rows.length });

    if (result.rows.length > 0) {
      log.info('Demo user FOUND', {
        id: result.rows[0].id,
        email: result.rows[0].email,
        name: result.rows[0].name,
        hasPasswordHash: !!result.rows[0].password_hash
      });
    } else {
      log.warn('Demo user NOT FOUND');

      // Try without the email parameter to see all users
      const allUsers = await db.query('SELECT id, email, name FROM users');
      log.info('All users in database', { users: allUsers.rows.map(u => `ID ${u.id}: ${u.email} (${u.name})`) });
    }

    process.exit(0);
  } catch (error) {
    log.error('Error', { error: error.message });
    process.exit(1);
  }
}

testDemoQuery();
