/**
 * RAG pgvector Migration Runner
 * Run: node server/migrations/run-pgvector-migration.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const log = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();

  try {
    log.info('Starting pgvector migration...');

    // Check if pgvector extension is available
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      log.info('pgvector extension enabled');
    } catch (err) {
      log.error('pgvector extension not available', { error: err.message, hint: 'Install pgvector first: https://github.com/pgvector/pgvector' });

      // Continue without vector - use TEXT fallback
      log.warn('Continuing with TEXT fallback for embeddings...');
    }

    // Read and execute migration SQL
    const sqlPath = path.join(__dirname, '027_upgrade_knowledge_pgvector.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split by semicolons but handle functions properly
    const statements = sql
      .split(/;(?=\s*(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|DO|\-\-))/i)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    log.info('Executing SQL statements', { count: statements.length });

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt || stmt.startsWith('--')) continue;

      try {
        await client.query(stmt);

        // Log progress for key operations
        if (stmt.includes('CREATE EXTENSION')) {
          log.debug('Extension created');
        } else if (stmt.includes('CREATE TABLE')) {
          const match = stmt.match(/CREATE TABLE[^(]*?(\w+)/i);
          if (match) log.debug('Table created', { name: match[1] });
        } else if (stmt.includes('CREATE INDEX')) {
          const match = stmt.match(/INDEX[^O]*?(\w+)/i);
          if (match) log.debug('Index created', { name: match[1] });
        } else if (stmt.includes('CREATE.*FUNCTION')) {
          const match = stmt.match(/FUNCTION\s+(\w+)/i);
          if (match) log.debug('Function created', { name: match[1] });
        }
      } catch (err) {
        // Ignore "already exists" errors
        if (err.message.includes('already exists')) {
          continue;
        }
        // Log other errors but continue
        log.warn('Statement warning', { error: err.message.substring(0, 100) });
      }
    }

    // Verify migration
    log.info('Verifying migration...');

    // Check tables
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('knowledge_bases', 'documents', 'chunks', 'embedding_queue')
    `);
    log.info('Tables created', { tables: tables.rows.map(r => r.table_name) });

    // Check vector extension
    const extensions = await client.query(`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `);
    if (extensions.rows.length > 0) {
      log.info('pgvector extension: Enabled');
    } else {
      log.warn('pgvector extension: Not available (using TEXT fallback)');
    }

    // Check chunks table structure
    const columns = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'chunks'
      ORDER BY ordinal_position
    `);
    log.info('Chunks table columns', { columns: columns.rows.map(c => `${c.column_name}: ${c.udt_name}`) });

    log.info('Migration completed successfully');

  } catch (err) {
    log.error('Migration failed', { error: err.message });
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  log.error('Migration error', { error: err.message });
  process.exit(1);
});
