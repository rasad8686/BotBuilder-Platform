/**
 * Message Usage Migration
 * Creates message_usage table for tracking message counts per organization
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('message_usage', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('bot_id').unsigned().references('id').inTable('bots').onDelete('CASCADE');
      table.integer('message_count').defaultTo(0);
      table.timestamp('period_start').notNullable();
      table.timestamp('period_end'); // NULL means current/active period
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('organization_id');
      table.index('bot_id');
      table.index('period_start');
      table.index('period_end');
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('message_usage');
};
