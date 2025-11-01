const db = require('../db');

/**
 * Verify AI Tables
 * Checks if AI tables were created successfully
 */

async function verifyAiTables() {
  try {
    console.log('🔍 Verifying AI tables...\n');

    // Check ai_configurations table
    console.log('1️⃣ Checking ai_configurations table...');
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
      console.log('   ✅ ai_configurations table exists');
      console.log(`   └─ Columns: ${configResult.rows.length}`);
      configResult.rows.forEach(col => {
        console.log(`      - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('   ❌ ai_configurations table NOT FOUND');
    }

    // Check ai_usage_logs table
    console.log('\n2️⃣ Checking ai_usage_logs table...');
    const usageResult = await db.query(`
      SELECT
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'ai_usage_logs'
      ORDER BY ordinal_position
    `);

    if (usageResult.rows.length > 0) {
      console.log('   ✅ ai_usage_logs table exists');
      console.log(`   └─ Columns: ${usageResult.rows.length}`);
      usageResult.rows.forEach(col => {
        console.log(`      - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('   ❌ ai_usage_logs table NOT FOUND');
    }

    // Check ai_conversations table
    console.log('\n3️⃣ Checking ai_conversations table...');
    const conversationResult = await db.query(`
      SELECT
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'ai_conversations'
      ORDER BY ordinal_position
    `);

    if (conversationResult.rows.length > 0) {
      console.log('   ✅ ai_conversations table exists');
      console.log(`   └─ Columns: ${conversationResult.rows.length}`);
      conversationResult.rows.forEach(col => {
        console.log(`      - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('   ❌ ai_conversations table NOT FOUND');
    }

    // Check indexes
    console.log('\n4️⃣ Checking indexes...');
    const indexResult = await db.query(`
      SELECT
        indexname,
        tablename
      FROM pg_indexes
      WHERE tablename IN ('ai_configurations', 'ai_usage_logs', 'ai_conversations')
      ORDER BY tablename, indexname
    `);

    if (indexResult.rows.length > 0) {
      console.log(`   ✅ Found ${indexResult.rows.length} indexes`);
      indexResult.rows.forEach(idx => {
        console.log(`      - ${idx.tablename}.${idx.indexname}`);
      });
    } else {
      console.log('   ⚠️ No indexes found');
    }

    // Check constraints
    console.log('\n5️⃣ Checking constraints...');
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
      console.log(`   ✅ Found ${constraintResult.rows.length} constraints`);
      constraintResult.rows.forEach(con => {
        const type = {
          'p': 'PRIMARY KEY',
          'f': 'FOREIGN KEY',
          'c': 'CHECK',
          'u': 'UNIQUE'
        }[con.constraint_type] || con.constraint_type;
        console.log(`      - ${con.table_name}.${con.constraint_name} (${type})`);
      });
    } else {
      console.log('   ⚠️ No constraints found');
    }

    console.log('\n✅ Verification complete!');
    console.log('━'.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification error:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

verifyAiTables();
