/**
 * Migration: Create Slack Channels Tables
 * Creates tables for Slack workspace integration
 */

exports.up = async function(knex) {
  // Create slack_channels table
  await knex.schema.createTable('slack_channels', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').unsigned().notNullable();
    table.integer('bot_id').unsigned().references('id').inTable('bots').onDelete('SET NULL');
    table.string('team_id', 50).notNullable();
    table.string('team_name', 255);
    table.text('bot_token').notNullable();
    table.string('bot_user_id', 50);
    table.string('app_id', 50);
    table.string('client_id', 100);
    table.text('client_secret');
    table.string('signing_secret', 100);
    table.string('webhook_url', 500);
    table.jsonb('scopes').defaultTo('[]');
    table.string('authed_user_id', 50);
    table.text('authed_user_token');
    table.boolean('is_active').defaultTo(true);
    table.jsonb('settings').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('organization_id');
    table.index('bot_id');
    table.unique('team_id');
    table.index('is_active');
  });

  // Create slack_messages table
  await knex.schema.createTable('slack_messages', (table) => {
    table.increments('id').primary();
    table.integer('channel_id').unsigned().references('id').inTable('slack_channels').onDelete('CASCADE');
    table.string('event_type', 50).defaultTo('message');
    table.string('user_id', 50);
    table.string('slack_channel_id', 50);
    table.text('message_text');
    table.string('message_ts', 50);
    table.string('thread_ts', 50);
    table.string('bot_id', 50);
    table.jsonb('raw_data');
    table.string('status', 20).defaultTo('received');
    table.text('response_text');
    table.timestamp('responded_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('channel_id');
    table.index('user_id');
    table.index('slack_channel_id');
    table.index('event_type');
    table.index('created_at');
    table.index(['channel_id', 'created_at']);
  });

  // Create slack_commands table
  await knex.schema.createTable('slack_commands', (table) => {
    table.increments('id').primary();
    table.integer('channel_id').unsigned().references('id').inTable('slack_channels').onDelete('CASCADE');
    table.string('command', 100).notNullable();
    table.text('text');
    table.string('user_id', 50);
    table.string('user_name', 100);
    table.string('slack_channel_id', 50);
    table.text('response_url');
    table.string('trigger_id', 100);
    table.string('status', 20).defaultTo('received');
    table.text('response');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('channel_id');
    table.index('command');
    table.index('user_id');
    table.index('created_at');
  });

  // Create slack_interactions table
  await knex.schema.createTable('slack_interactions', (table) => {
    table.increments('id').primary();
    table.integer('channel_id').unsigned().references('id').inTable('slack_channels').onDelete('CASCADE');
    table.string('interaction_type', 50).notNullable();
    table.string('user_id', 50);
    table.string('user_name', 100);
    table.string('slack_channel_id', 50);
    table.string('trigger_id', 100);
    table.text('response_url');
    table.jsonb('raw_data');
    table.string('status', 20).defaultTo('received');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('channel_id');
    table.index('interaction_type');
    table.index('user_id');
    table.index('created_at');
  });

  // Create slack_oauth_states table for OAuth flow
  await knex.schema.createTable('slack_oauth_states', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').unsigned().notNullable();
    table.integer('user_id').unsigned();
    table.string('state', 100).notNullable().unique();
    table.integer('bot_id').unsigned();
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('state');
    table.index('organization_id');
    table.index('expires_at');
  });

  console.log('Created Slack channel tables');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('slack_oauth_states');
  await knex.schema.dropTableIfExists('slack_interactions');
  await knex.schema.dropTableIfExists('slack_commands');
  await knex.schema.dropTableIfExists('slack_messages');
  await knex.schema.dropTableIfExists('slack_channels');

  console.log('Dropped Slack channel tables');
};
