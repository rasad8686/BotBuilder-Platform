/**
 * Security Enhancement Migration
 * - Two-Factor Authentication (2FA) columns
 * - User Sessions table for session management
 */

exports.up = async function(knex) {
  // Add 2FA columns to users table
  await knex.schema.alterTable('users', (table) => {
    table.string('two_factor_secret', 64).nullable();
    table.boolean('two_factor_enabled').defaultTo(false);
    table.timestamp('two_factor_enabled_at').nullable();
  });

  // Create user_sessions table for session management
  await knex.schema.createTable('user_sessions', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.string('session_token', 64).notNullable().unique();
    table.string('device_info', 255).nullable();
    table.string('ip_address', 45).nullable();
    table.string('user_agent', 500).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('last_activity_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable();
    table.boolean('is_active').defaultTo(true);

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.index(['user_id', 'is_active']);
    table.index(['session_token']);
    table.index(['expires_at']);
  });

  // Create 2FA backup codes table
  await knex.schema.createTable('two_factor_backup_codes', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.string('code_hash', 64).notNullable();
    table.boolean('used').defaultTo(false);
    table.timestamp('used_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.index(['user_id', 'used']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('two_factor_backup_codes');
  await knex.schema.dropTableIfExists('user_sessions');

  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('two_factor_secret');
    table.dropColumn('two_factor_enabled');
    table.dropColumn('two_factor_enabled_at');
  });
};
