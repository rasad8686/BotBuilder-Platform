/**
 * Rate Limiting Professional System Migration
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Check if rate_limit_settings exists and needs restructuring
  const hasRateLimitSettings = await knex.schema.hasTable('rate_limit_settings');

  if (hasRateLimitSettings) {
    // Check if it has the new structure (key column)
    const hasKeyColumn = await knex.schema.hasColumn('rate_limit_settings', 'key');

    if (!hasKeyColumn) {
      // Drop old table and create new structure
      await knex.schema.dropTable('rate_limit_settings');
    }
  }

  // Create rate_limit_settings with new structure if not exists
  const hasNewSettings = await knex.schema.hasTable('rate_limit_settings');
  if (!hasNewSettings) {
    await knex.schema.createTable('rate_limit_settings', (table) => {
      table.increments('id').primary();
      table.string('key', 50).unique().notNullable(); // 'login', 'register', 'api', 'password_reset'
      table.integer('max_attempts').defaultTo(5);
      table.integer('window_ms').defaultTo(600000); // 10 minutes
      table.integer('block_duration_ms').defaultTo(600000); // 10 minutes
      table.boolean('is_enabled').defaultTo(true);
      table.integer('updated_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    // Insert default settings
    await knex('rate_limit_settings').insert([
      { key: 'login', max_attempts: 5, window_ms: 600000, block_duration_ms: 600000, is_enabled: true },
      { key: 'register', max_attempts: 3, window_ms: 3600000, block_duration_ms: 3600000, is_enabled: true },
      { key: 'api', max_attempts: 100, window_ms: 60000, block_duration_ms: 60000, is_enabled: true },
      { key: 'password_reset', max_attempts: 3, window_ms: 3600000, block_duration_ms: 3600000, is_enabled: true }
    ]);
  }

  // Create blocked_ips table
  const hasBlockedIps = await knex.schema.hasTable('blocked_ips');
  if (!hasBlockedIps) {
    await knex.schema.createTable('blocked_ips', (table) => {
      table.increments('id').primary();
      table.string('ip_address', 45).notNullable();
      table.string('reason', 100); // 'login', 'register', 'api', 'manual'
      table.integer('attempts').defaultTo(1);
      table.timestamp('blocked_at').defaultTo(knex.fn.now());
      table.timestamp('expires_at');
      table.boolean('is_permanent').defaultTo(false);
      table.integer('unblocked_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('unblocked_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['ip_address'], 'idx_blocked_ips_ip');
      table.index(['expires_at'], 'idx_blocked_ips_expires');
      table.index(['is_permanent'], 'idx_blocked_ips_permanent');
    });
  }

  // Create rate_limit_logs table (audit)
  const hasRateLimitLogs = await knex.schema.hasTable('rate_limit_logs');
  if (!hasRateLimitLogs) {
    await knex.schema.createTable('rate_limit_logs', (table) => {
      table.increments('id').primary();
      table.string('ip_address', 45);
      table.string('endpoint', 100);
      table.integer('user_id').references('id').inTable('users').onDelete('SET NULL');
      table.string('action', 20); // 'attempt', 'blocked', 'unblocked'
      table.jsonb('details');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['ip_address'], 'idx_rate_limit_logs_ip');
      table.index(['action'], 'idx_rate_limit_logs_action');
      table.index(['created_at'], 'idx_rate_limit_logs_created');
      table.index(['endpoint'], 'idx_rate_limit_logs_endpoint');
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('rate_limit_logs');
  await knex.schema.dropTableIfExists('blocked_ips');
  // Don't drop rate_limit_settings to preserve existing data
};
