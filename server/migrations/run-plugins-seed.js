const fs = require('fs');
const path = require('path');
const pool = require('../db');
const log = require('../utils/logger');

async function runSeed() {
  log.info('Running demo plugins seed migration...');

  try {
    const sqlPath = path.join(__dirname, '024_seed_demo_plugins.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await pool.query(sql);

    log.info('Demo plugins seeded successfully');

    // Verify
    const result = await pool.query('SELECT name, slug, price, is_free, downloads, rating FROM plugins ORDER BY downloads DESC');
    log.info('Plugins in database', { plugins: result.rows });

  } catch (error) {
    log.error('Error seeding plugins', { error: error.message });
  } finally {
    process.exit(0);
  }
}

runSeed();
