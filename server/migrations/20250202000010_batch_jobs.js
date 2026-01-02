/**
 * Migration: Batch Jobs
 *
 * Creates tables for batch API processing system.
 * Allows users to submit multiple API requests in a single batch
 * for asynchronous processing.
 */

exports.up = function(knex) {
  return knex.schema
    // Create batch_jobs table
    .createTable('batch_jobs', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable()
        .references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('user_id').unsigned()
        .references('id').inTable('users').onDelete('SET NULL');
      table.integer('api_token_id').unsigned()
        .references('id').inTable('api_tokens').onDelete('SET NULL');

      table.string('name', 255);
      table.string('status', 20).notNullable().defaultTo('pending');
      // Status: 'pending', 'processing', 'completed', 'failed', 'cancelled'

      table.integer('total_requests').notNullable().defaultTo(0);
      table.integer('completed_requests').notNullable().defaultTo(0);
      table.integer('failed_requests').notNullable().defaultTo(0);

      table.text('input_file_url');
      table.text('output_file_url');
      table.text('error_file_url');

      table.timestamp('started_at');
      table.timestamp('completed_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      // Indexes
      table.index('organization_id', 'idx_batch_jobs_org');
      table.index('user_id', 'idx_batch_jobs_user');
      table.index('status', 'idx_batch_jobs_status');
      table.index('created_at', 'idx_batch_jobs_created');
    })
    // Create batch_job_items table
    .then(() => {
      return knex.schema.createTable('batch_job_items', (table) => {
        table.increments('id').primary();
        table.integer('batch_job_id').unsigned().notNullable()
          .references('id').inTable('batch_jobs').onDelete('CASCADE');

        table.integer('request_index').notNullable();
        table.jsonb('request_data').notNullable();
        table.jsonb('response_data');
        table.string('status', 20).notNullable().defaultTo('pending');
        // Status: 'pending', 'processing', 'completed', 'failed'
        table.text('error_message');
        table.timestamp('processed_at');

        // Indexes
        table.index('batch_job_id', 'idx_batch_job_items_job');
        table.index(['batch_job_id', 'request_index'], 'idx_batch_job_items_job_index');
        table.index('status', 'idx_batch_job_items_status');
      });
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('batch_job_items')
    .then(() => knex.schema.dropTableIfExists('batch_jobs'));
};
