/**
 * Add queue-related fields to email_sends table
 * Supports scheduled sending, retry logic, and better queue management
 */

exports.up = async function(knex) {
  // Add queue-related columns to email_sends
  await knex.schema.alterTable('email_sends', (table) => {
    table.timestamp('scheduled_at').nullable();
    table.integer('attempts').defaultTo(0);
    table.integer('max_attempts').defaultTo(3);
    table.timestamp('next_retry_at').nullable();
    table.string('processing_started_at').nullable();
    table.integer('priority').defaultTo(0); // Higher = higher priority
    table.string('worker_id', 100).nullable(); // Which worker is processing
    table.jsonb('metadata').defaultTo('{}'); // Extra data
  });

  // Add indexes for queue processing
  await knex.schema.alterTable('email_sends', (table) => {
    table.index('scheduled_at');
    table.index('next_retry_at');
    table.index('priority');
    table.index(['status', 'scheduled_at']); // Composite for queue queries
  });

  // Create email_queue_stats table for monitoring
  await knex.schema.createTable('email_queue_stats', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('campaign_id').references('id').inTable('email_campaigns').onDelete('CASCADE');
    table.integer('workspace_id').unsigned().references('id').inTable('workspaces').onDelete('CASCADE');
    table.integer('total_queued').defaultTo(0);
    table.integer('total_processing').defaultTo(0);
    table.integer('total_sent').defaultTo(0);
    table.integer('total_failed').defaultTo(0);
    table.integer('total_retried').defaultTo(0);
    table.float('avg_send_time_ms').defaultTo(0);
    table.timestamp('last_processed_at');
    table.timestamps(true, true);

    table.unique('campaign_id');
    table.index('workspace_id');
  });

  // Create email_queue_logs for debugging
  await knex.schema.createTable('email_queue_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('campaign_id').references('id').inTable('email_campaigns').onDelete('CASCADE');
    table.uuid('send_id').references('id').inTable('email_sends').onDelete('CASCADE');
    table.string('event', 50).notNullable(); // queued, processing, sent, failed, retried
    table.string('worker_id', 100);
    table.text('message');
    table.jsonb('details').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('campaign_id');
    table.index('send_id');
    table.index('event');
    table.index('created_at');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('email_queue_logs');
  await knex.schema.dropTableIfExists('email_queue_stats');

  await knex.schema.alterTable('email_sends', (table) => {
    table.dropIndex(['status', 'scheduled_at']);
    table.dropIndex('priority');
    table.dropIndex('next_retry_at');
    table.dropIndex('scheduled_at');
    table.dropColumn('metadata');
    table.dropColumn('worker_id');
    table.dropColumn('priority');
    table.dropColumn('processing_started_at');
    table.dropColumn('next_retry_at');
    table.dropColumn('max_attempts');
    table.dropColumn('attempts');
    table.dropColumn('scheduled_at');
  });
};
