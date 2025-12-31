/**
 * Migration: Create Discord Channels Tables
 * Creates tables for Discord bot integration with full feature support
 */

exports.up = async function(knex) {
  // Create discord_channels table
  await knex.schema.createTable('discord_channels', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').unsigned().notNullable();
    table.integer('bot_id').unsigned().references('id').inTable('bots').onDelete('CASCADE');
    table.string('bot_token', 200).notNullable();
    table.string('client_id', 50).notNullable();
    table.string('client_secret', 200);
    table.string('public_key', 200);
    table.string('bot_username', 100);
    table.string('webhook_url', 500);
    table.string('webhook_secret', 100);
    table.boolean('is_active').defaultTo(true);
    table.jsonb('settings').defaultTo('{}');
    table.jsonb('permissions').defaultTo('{}');
    table.jsonb('registered_commands').defaultTo('[]');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('organization_id');
    table.index('bot_id');
    table.unique('bot_token');
    table.unique('client_id');
    table.index('is_active');
  });

  // Create discord_guilds table (servers the bot is in)
  await knex.schema.createTable('discord_guilds', (table) => {
    table.increments('id').primary();
    table.integer('channel_id').unsigned().references('id').inTable('discord_channels').onDelete('CASCADE');
    table.string('guild_id', 50).notNullable();
    table.string('guild_name', 200);
    table.string('guild_icon', 500);
    table.integer('member_count').defaultTo(0);
    table.string('owner_id', 50);
    table.boolean('is_active').defaultTo(true);
    table.jsonb('settings').defaultTo('{}');
    table.jsonb('enabled_features').defaultTo('[]');
    table.timestamp('joined_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('channel_id');
    table.unique(['channel_id', 'guild_id']);
    table.index('guild_id');
    table.index('is_active');
  });

  // Create discord_messages table
  await knex.schema.createTable('discord_messages', (table) => {
    table.increments('id').primary();
    table.integer('channel_id').unsigned().references('id').inTable('discord_channels').onDelete('CASCADE');
    table.string('event_type', 50).defaultTo('MESSAGE_CREATE');
    table.string('guild_id', 50);
    table.string('discord_channel_id', 50);
    table.string('user_id', 50);
    table.string('username', 100);
    table.text('message_content');
    table.string('message_id', 50);
    table.string('message_type', 30).defaultTo('text');
    table.jsonb('attachments').defaultTo('[]');
    table.jsonb('embeds').defaultTo('[]');
    table.jsonb('components').defaultTo('[]');
    table.string('thread_id', 50);
    table.string('reply_to_id', 50);
    table.jsonb('raw_data');
    table.string('status', 20).defaultTo('received');
    table.text('response_text');
    table.jsonb('response_embeds').defaultTo('[]');
    table.timestamp('responded_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('channel_id');
    table.index('guild_id');
    table.index('discord_channel_id');
    table.index('user_id');
    table.index('message_type');
    table.index('thread_id');
    table.index('created_at');
    table.index(['channel_id', 'created_at']);
    table.index(['guild_id', 'discord_channel_id']);
  });

  // Create discord_sessions table for conversation context
  await knex.schema.createTable('discord_sessions', (table) => {
    table.increments('id').primary();
    table.integer('channel_id').unsigned().references('id').inTable('discord_channels').onDelete('CASCADE');
    table.string('user_id', 50).notNullable();
    table.string('username', 100);
    table.string('display_name', 100);
    table.string('guild_id', 50);
    table.string('discord_channel_id', 50);
    table.jsonb('context').defaultTo('[]');
    table.jsonb('user_data').defaultTo('{}');
    table.jsonb('preferences').defaultTo('{}');
    table.string('current_state', 100);
    table.timestamp('last_activity').defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('channel_id');
    table.unique(['channel_id', 'user_id']);
    table.index('user_id');
    table.index('guild_id');
    table.index('last_activity');
  });

  // Create discord_interactions table for tracking slash commands, buttons, etc.
  await knex.schema.createTable('discord_interactions', (table) => {
    table.increments('id').primary();
    table.integer('channel_id').unsigned().references('id').inTable('discord_channels').onDelete('CASCADE');
    table.string('interaction_id', 50).notNullable();
    table.string('interaction_type', 30).notNullable(); // slash_command, button, select_menu, modal
    table.string('command_name', 100);
    table.string('custom_id', 200);
    table.jsonb('options').defaultTo('{}');
    table.jsonb('values').defaultTo('[]');
    table.string('user_id', 50).notNullable();
    table.string('username', 100);
    table.string('guild_id', 50);
    table.string('discord_channel_id', 50);
    table.text('response_content');
    table.jsonb('response_embeds').defaultTo('[]');
    table.boolean('ephemeral').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('channel_id');
    table.index('interaction_type');
    table.index('command_name');
    table.index('user_id');
    table.index('guild_id');
    table.index('created_at');
    table.index(['channel_id', 'interaction_type']);
  });

  // Create discord_threads table
  await knex.schema.createTable('discord_threads', (table) => {
    table.increments('id').primary();
    table.integer('channel_id').unsigned().references('id').inTable('discord_channels').onDelete('CASCADE');
    table.string('thread_id', 50).notNullable();
    table.string('thread_name', 200);
    table.string('parent_channel_id', 50);
    table.string('guild_id', 50);
    table.string('owner_id', 50);
    table.string('thread_type', 30); // public, private
    table.boolean('is_archived').defaultTo(false);
    table.boolean('is_locked').defaultTo(false);
    table.integer('message_count').defaultTo(0);
    table.integer('member_count').defaultTo(0);
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('archive_timestamp');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('channel_id');
    table.unique(['channel_id', 'thread_id']);
    table.index('thread_id');
    table.index('guild_id');
    table.index('parent_channel_id');
    table.index('is_archived');
    table.index('created_at');
  });

  // Create discord_reactions table for feedback tracking
  await knex.schema.createTable('discord_reactions', (table) => {
    table.increments('id').primary();
    table.integer('channel_id').unsigned().references('id').inTable('discord_channels').onDelete('CASCADE');
    table.string('message_id', 50).notNullable();
    table.string('user_id', 50).notNullable();
    table.string('emoji', 100).notNullable();
    table.string('guild_id', 50);
    table.string('discord_channel_id', 50);
    table.boolean('is_bot_message').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('channel_id');
    table.index('message_id');
    table.index('user_id');
    table.index(['message_id', 'user_id', 'emoji']);
    table.index('created_at');
  });

  // Create discord_analytics table
  await knex.schema.createTable('discord_analytics', (table) => {
    table.increments('id').primary();
    table.integer('channel_id').unsigned().references('id').inTable('discord_channels').onDelete('CASCADE');
    table.string('guild_id', 50);
    table.string('user_id', 50);
    table.string('message_type', 30);
    table.integer('message_length').defaultTo(0);
    table.integer('response_length').defaultTo(0);
    table.boolean('has_sources').defaultTo(false);
    table.integer('source_count').defaultTo(0);
    table.integer('response_time_ms');
    table.string('ai_model', 50);
    table.boolean('used_rag').defaultTo(false);
    table.float('confidence_score');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('channel_id');
    table.index('guild_id');
    table.index('user_id');
    table.index('message_type');
    table.index('created_at');
    table.index(['channel_id', 'created_at']);
  });

  // Create discord_command_analytics table
  await knex.schema.createTable('discord_command_analytics', (table) => {
    table.increments('id').primary();
    table.integer('channel_id').unsigned().references('id').inTable('discord_channels').onDelete('CASCADE');
    table.string('command_name', 100).notNullable();
    table.string('user_id', 50);
    table.string('username', 100);
    table.string('guild_id', 50);
    table.jsonb('options_used').defaultTo('{}');
    table.boolean('success').defaultTo(true);
    table.string('error_type', 100);
    table.integer('execution_time_ms');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('channel_id');
    table.index('command_name');
    table.index('guild_id');
    table.index('user_id');
    table.index('created_at');
    table.index(['channel_id', 'command_name']);
    table.index(['command_name', 'created_at']);
  });

  // Create discord_embeds table for storing reusable embed templates
  await knex.schema.createTable('discord_embeds', (table) => {
    table.increments('id').primary();
    table.integer('channel_id').unsigned().references('id').inTable('discord_channels').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.string('embed_type', 50).defaultTo('custom'); // welcome, help, error, success, info, custom
    table.string('title', 256);
    table.text('description');
    table.string('color', 10).defaultTo('#7289DA');
    table.string('url', 500);
    table.jsonb('author').defaultTo('{}');
    table.string('thumbnail', 500);
    table.string('image', 500);
    table.jsonb('footer').defaultTo('{}');
    table.jsonb('fields').defaultTo('[]');
    table.boolean('include_timestamp').defaultTo(false);
    table.boolean('is_default').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('channel_id');
    table.index(['channel_id', 'name']);
    table.index('embed_type');
  });

  // Create discord_buttons table for storing button configurations
  await knex.schema.createTable('discord_buttons', (table) => {
    table.increments('id').primary();
    table.integer('channel_id').unsigned().references('id').inTable('discord_channels').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.string('custom_id', 200).notNullable();
    table.string('label', 80).notNullable();
    table.string('style', 20).defaultTo('primary'); // primary, secondary, success, danger, link
    table.string('emoji', 100);
    table.string('url', 500); // For link buttons
    table.boolean('disabled').defaultTo(false);
    table.jsonb('action').defaultTo('{}'); // What happens when clicked
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('channel_id');
    table.unique(['channel_id', 'custom_id']);
    table.index(['channel_id', 'name']);
  });

  // Create discord_select_menus table for storing select menu configurations
  await knex.schema.createTable('discord_select_menus', (table) => {
    table.increments('id').primary();
    table.integer('channel_id').unsigned().references('id').inTable('discord_channels').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.string('custom_id', 200).notNullable();
    table.string('placeholder', 150);
    table.integer('min_values').defaultTo(1);
    table.integer('max_values').defaultTo(1);
    table.jsonb('options').notNullable(); // Array of options
    table.boolean('disabled').defaultTo(false);
    table.jsonb('actions').defaultTo('{}'); // Actions for each option
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('channel_id');
    table.unique(['channel_id', 'custom_id']);
    table.index(['channel_id', 'name']);
  });

  console.log('Created Discord channel tables');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('discord_select_menus');
  await knex.schema.dropTableIfExists('discord_buttons');
  await knex.schema.dropTableIfExists('discord_embeds');
  await knex.schema.dropTableIfExists('discord_command_analytics');
  await knex.schema.dropTableIfExists('discord_analytics');
  await knex.schema.dropTableIfExists('discord_reactions');
  await knex.schema.dropTableIfExists('discord_threads');
  await knex.schema.dropTableIfExists('discord_interactions');
  await knex.schema.dropTableIfExists('discord_sessions');
  await knex.schema.dropTableIfExists('discord_messages');
  await knex.schema.dropTableIfExists('discord_guilds');
  await knex.schema.dropTableIfExists('discord_channels');

  console.log('Dropped Discord channel tables');
};
