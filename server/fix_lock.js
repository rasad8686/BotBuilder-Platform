const db = require('./db');

async function fixLock() {
  try {
    await db.query('DELETE FROM knex_migrations_lock');
    await db.query('INSERT INTO knex_migrations_lock (is_locked) VALUES (0)');
    console.log('Migration lock cleared');
    process.exit(0);
  } catch(e) {
    console.log('Error:', e.message);
    process.exit(1);
  }
}

fixLock();
