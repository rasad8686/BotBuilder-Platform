/**
 * Migration: API Token IP Allowlist
 *
 * Creates ip allowlist table for API tokens and adds restriction flag:
 * - api_token_ip_allowlist table for storing allowed IPs/CIDR ranges
 * - ip_restriction_enabled flag on api_tokens table
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('api_token_ip_allowlist', (table) => {
      table.increments('id').primary();
      table.integer('api_token_id').unsigned().notNullable()
        .references('id').inTable('api_tokens').onDelete('CASCADE');
      table.string('ip_address', 45).notNullable(); // IPv4 and IPv6 support
      table.string('cidr_range', 50).nullable(); // Optional: 192.168.1.0/24
      table.string('description', 255).nullable();
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      // Indexes
      table.index(['api_token_id', 'is_active'], 'idx_ip_allowlist_token');
      table.index('ip_address', 'idx_ip_allowlist_ip');
    })
    .then(() => {
      return knex.schema.alterTable('api_tokens', (table) => {
        table.boolean('ip_restriction_enabled').defaultTo(false);
      });
    });
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('api_tokens', (table) => {
      table.dropColumn('ip_restriction_enabled');
    })
    .then(() => {
      return knex.schema.dropTableIfExists('api_token_ip_allowlist');
    });
};
