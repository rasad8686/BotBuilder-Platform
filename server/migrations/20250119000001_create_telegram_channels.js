/**
 * Migration: Create Telegram Channels Tables
 * Creates tables for Telegram bot integration
 */

exports.up = async function(knex) {
  // Create telegram_channels table
  await knex.schema.createTable('telegram_channels', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').unsigned().notNullable();
    table.integer('bot_id').unsigned().references('id').inTable('bots').onDelete('CASCADE');
    table.string('bot_token', 100).notNullable();
    table.string('bot_username', 100);
    table.string('webhook_url', 500);
    table.string('webhook_secret', 100);
    table.string('chat_id', 50);
    table.boolean('is_active').defaultTo(true);
    table.jsonb('settings').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('organization_id');
    table.index('bot_id');
    table.unique('bot_token');
    table.index('is_active');
  });

  // Create telegram_messages table
  await knex.schema.createTable('telegram_messages', (table) => {
    table.increments('id').primary();
    table.integer('channel_id').unsigned().references('id').inTable('telegram_channels').onDelete('CASCADE');
    table.bigInteger('update_id');
    table.string('message_type', 50).defaultTo('text');
    table.string('chat_id', 50);
    table.string('user_id', 50);
    table.string('username', 100);
    table.text('message_text');
    table.string('message_id', 50);
    table.jsonb('raw_data');
    table.string('status', 20).defaultTo('received');
    table.text('response_text');
    table.timestamp('responded_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('channel_id');
    table.index('chat_id');
    table.index('user_id');
    table.index('message_type');
    table.index('created_at');
    table.index(['channel_id', 'created_at']);
  });

  // Create telegram_sessions table for conversation context
  await knex.schema.createTable('telegram_sessions', (table) => {
    table.increments('id').primary();
    table.integer('channel_id').unsigned().references('id').inTable('telegram_channels').onDelete('CASCADE');
    table.string('chat_id', 50).notNullable();
    table.string('user_id', 50);
    table.string('username', 100);
    table.jsonb('context').defaultTo('[]');
    table.jsonb('user_data').defaultTo('{}');
    table.string('current_state', 100);
    table.timestamp('last_activity').defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('channel_id');
    table.unique(['channel_id', 'chat_id']);
    table.index('user_id');
    table.index('last_activity');
  });

  // Create telegram_keyboards table for storing keyboard templates
  await knex.schema.createTable('telegram_keyboards', (table) => {
    table.increments('id').primary();
    table.integer('channel_id').unsigned().references('id').inTable('telegram_channels').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.string('keyboard_type', 20).defaultTo('inline'); // inline or reply
    table.jsonb('buttons').notNullable();
    table.boolean('is_default').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('channel_id');
    table.index(['channel_id', 'name']);
  });

  console.log('Created Telegram channel tables');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('telegram_keyboards');
  await knex.schema.dropTableIfExists('telegram_sessions');
  await knex.schema.dropTableIfExists('telegram_messages');
  await knex.schema.dropTableIfExists('telegram_channels');

  console.log('Dropped Telegram channel tables');
};
