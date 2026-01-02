/**
 * Migration: API Key Usage Tracking
 *
 * Creates the api_key_usage table for tracking per-API-key usage statistics.
 * This enables detailed analytics for each API token including:
 * - Request counts and endpoints
 * - Response times
 * - Token usage and costs
 * - IP addresses and user agents
 */

exports.up = function(knex) {
  return knex.schema.createTable('api_key_usage', (table) => {
    table.increments('id').primary();
    table.integer('api_token_id').unsigned().notNullable()
      .references('id').inTable('api_tokens').onDelete('CASCADE');
    table.string('endpoint', 255).notNullable();
    table.string('method', 10).notNullable();
    table.integer('status_code');
    table.integer('response_time_ms');
    table.integer('tokens_used').defaultTo(0);
    table.decimal('cost_usd', 10, 6).defaultTo(0);
    table.string('ip_address', 45);
    table.text('user_agent');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes for efficient querying
    table.index(['api_token_id', 'created_at'], 'idx_api_key_usage_token');
    table.index('created_at', 'idx_api_key_usage_date');
    table.index('endpoint', 'idx_api_key_usage_endpoint');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('api_key_usage');
};
