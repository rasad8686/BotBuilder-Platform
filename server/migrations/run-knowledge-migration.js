const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const log = require('../utils/logger');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  log.info('Starting Knowledge Base migration...', { database: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@') });

  try {
    const sqlPath = path.join(__dirname, '022_create_knowledge_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    log.info('Executing migration SQL...');

    // Execute each statement separately
    const statements = sql.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        try {
          await pool.query(stmt);
        } catch (err) {
          // Ignore "already exists" errors
          if (!err.message.includes('already exists')) {
            throw err;
          }
        }
      }
    }

    log.info('Migration completed successfully');

    // Verify tables were created
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('knowledge_bases', 'documents', 'chunks', 'agent_knowledge_bases')
      ORDER BY table_name
    `);

    log.info('Tables created', { tables: tables.rows.map(r => r.table_name) });

  } catch (error) {
    log.error('Migration failed', { error: error.message, code: error.code });
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
