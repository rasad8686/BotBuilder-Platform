/**
 * Migration: Create Slack AI Support Tables
 * Creates tables for Slack AI sessions and analytics
 */

exports.up = async function(knex) {
  // Create slack_sessions table for conversation context tracking
  await knex.schema.createTable('slack_sessions', (table) => {
    table.increments('id').primary();
    table.integer('channel_id').unsigned().references('id').inTable('slack_channels').onDelete('CASCADE');
    table.string('slack_channel_id', 50).notNullable();
    table.string('user_id', 50).notNullable();
    table.string('thread_ts', 50);
    table.jsonb('context').defaultTo('[]');
    table.integer('message_count').defaultTo(0);
    table.timestamp('last_activity').defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('channel_id');
    table.index('slack_channel_id');
    table.index('user_id');
    table.index(['channel_id', 'slack_channel_id', 'user_id']);
    table.index('last_activity');
  });

  // Create slack_analytics table for message analytics
  await knex.schema.createTable('slack_analytics', (table) => {
    table.increments('id').primary();
    table.integer('channel_id').unsigned().references('id').inTable('slack_channels').onDelete('CASCADE');
    table.string('slack_channel_id', 50);
    table.string('user_id', 50);
    table.string('message_type', 50).defaultTo('message');
    table.integer('message_length').defaultTo(0);
    table.integer('response_length').defaultTo(0);
    table.string('ai_provider', 50);
    table.string('ai_model', 100);
    table.integer('tokens_used').defaultTo(0);
    table.integer('response_time_ms').defaultTo(0);
    table.string('thread_ts', 50);
    table.boolean('used_rag').defaultTo(false);
    table.integer('rag_docs_count').defaultTo(0);
    table.string('status', 20).defaultTo('success');
    table.text('error_message');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('channel_id');
    table.index('slack_channel_id');
    table.index('user_id');
    table.index('message_type');
    table.index('ai_provider');
    table.index('created_at');
    table.index(['channel_id', 'created_at']);
  });

  console.log('Created Slack AI support tables (slack_sessions, slack_analytics)');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('slack_analytics');
  await knex.schema.dropTableIfExists('slack_sessions');

  console.log('Dropped Slack AI support tables');
};
