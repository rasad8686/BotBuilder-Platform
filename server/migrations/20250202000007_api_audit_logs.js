/**
 * API Audit Logs Migration
 * Creates table for comprehensive API request/response logging
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('api_audit_logs', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('SET NULL');
      table.integer('user_id').unsigned();
      table.integer('api_token_id').unsigned();
      table.integer('service_account_id').unsigned();

      // Request info
      table.string('method', 10).notNullable();
      table.string('endpoint', 500).notNullable();
      table.jsonb('path_params').defaultTo('{}');
      table.jsonb('query_params').defaultTo('{}');
      table.jsonb('request_body').defaultTo('{}'); // sensitive fields masked
      table.jsonb('request_headers').defaultTo('{}');

      // Response info
      table.integer('status_code');
      table.integer('response_time_ms');
      table.integer('response_size_bytes');

      // Context
      table.string('ip_address', 45);
      table.text('user_agent');
      table.string('geo_country', 2);
      table.string('geo_city', 100);

      // Metadata
      table.text('error_message');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      // Indexes for common queries
      table.index(['organization_id', 'created_at'], 'idx_audit_org_date');
      table.index(['api_token_id', 'created_at'], 'idx_audit_token');
      table.index(['user_id', 'created_at'], 'idx_audit_user');
      table.index(['service_account_id', 'created_at'], 'idx_audit_service_account');
      table.index(['method']);
      table.index(['status_code']);
      table.index(['endpoint']);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('api_audit_logs');
};
