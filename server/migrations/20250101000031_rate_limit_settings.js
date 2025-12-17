/**
 * Rate Limiting Admin Settings Migration
 * - rate_limit_settings table for admin configuration
 * - blocked_users table for tracking blocked IPs/emails
 */

exports.up = async function(knex) {
  // Create rate_limit_settings table
  await knex.schema.createTable('rate_limit_settings', (table) => {
    table.increments('id').primary();
    table.boolean('enabled').defaultTo(true);
    table.integer('max_attempts').defaultTo(5);
    table.integer('window_minutes').defaultTo(15);
    table.integer('block_duration_minutes').defaultTo(15);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // Create blocked_users table for tracking blocked login attempts
  await knex.schema.createTable('rate_limit_blocked', (table) => {
    table.increments('id').primary();
    table.string('email', 255).nullable();
    table.string('ip_address', 45).notNullable();
    table.integer('attempt_count').defaultTo(0);
    table.timestamp('blocked_at').defaultTo(knex.fn.now());
    table.timestamp('blocked_until').notNullable();
    table.string('reason', 255).defaultTo('Too many login attempts');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['ip_address']);
    table.index(['email']);
    table.index(['blocked_until']);
  });

  // Insert default settings
  await knex('rate_limit_settings').insert({
    enabled: true,
    max_attempts: 5,
    window_minutes: 15,
    block_duration_minutes: 15
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('rate_limit_blocked');
  await knex.schema.dropTableIfExists('rate_limit_settings');
};
