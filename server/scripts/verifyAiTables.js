const db = require('../db');
const log = require('../utils/logger');

/**
 * Verify AI Tables
 * Checks if AI tables were created successfully
 */

async function verifyAiTables() {
  try {
    log.info('Verifying AI tables...');

    // Check ai_configurations table
    const configResult = await db.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'ai_configurations'
      ORDER BY ordinal_position
    `);

    if (configResult.rows.length > 0) {
      log.info('ai_configurations table exists', { columns: configResult.rows.map(c => `${c.column_name} (${c.data_type})`) });
    } else {
      log.warn('ai_configurations table NOT FOUND');
    }

    // Check ai_usage_logs table
    const usageResult = await db.query(`
      SELECT
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'ai_usage_logs'
      ORDER BY ordinal_position
    `);

    if (usageResult.rows.length > 0) {
      log.info('ai_usage_logs table exists', { columns: usageResult.rows.map(c => `${c.column_name} (${c.data_type})`) });
    } else {
      log.warn('ai_usage_logs table NOT FOUND');
    }

    // Check ai_conversations table
    const conversationResult = await db.query(`
      SELECT
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'ai_conversations'
      ORDER BY ordinal_position
    `);

    if (conversationResult.rows.length > 0) {
      log.info('ai_conversations table exists', { columns: conversationResult.rows.map(c => `${c.column_name} (${c.data_type})`) });
    } else {
      log.warn('ai_conversations table NOT FOUND');
    }

    // Check indexes
    const indexResult = await db.query(`
      SELECT
        indexname,
        tablename
      FROM pg_indexes
      WHERE tablename IN ('ai_configurations', 'ai_usage_logs', 'ai_conversations')
      ORDER BY tablename, indexname
    `);

    if (indexResult.rows.length > 0) {
      log.info('Indexes found', { count: indexResult.rows.length, indexes: indexResult.rows.map(i => `${i.tablename}.${i.indexname}`) });
    } else {
      log.warn('No indexes found');
    }

    // Check constraints
    const constraintResult = await db.query(`
      SELECT
        conname as constraint_name,
        contype as constraint_type,
        conrelid::regclass as table_name
      FROM pg_constraint
      WHERE conrelid IN (
        'ai_configurations'::regclass,
        'ai_usage_logs'::regclass,
        'ai_conversations'::regclass
      )
      ORDER BY table_name, constraint_name
    `);

    if (constraintResult.rows.length > 0) {
      const typeMap = { 'p': 'PRIMARY KEY', 'f': 'FOREIGN KEY', 'c': 'CHECK', 'u': 'UNIQUE' };
      log.info('Constraints found', { count: constraintResult.rows.length, constraints: constraintResult.rows.map(c => `${c.table_name}.${c.constraint_name} (${typeMap[c.constraint_type] || c.constraint_type})`) });
    } else {
      log.warn('No constraints found');
    }

    log.info('Verification complete');
    process.exit(0);
  } catch (error) {
    log.error('Verification error', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

verifyAiTables();
