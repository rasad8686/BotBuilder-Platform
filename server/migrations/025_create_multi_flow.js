/**
 * Migration: Multi-flow orchestration tables
 */

exports.up = function(knex) {
  return knex.schema
    // 1. flow_orchestrations - Multi-flow orchestration management
    .createTable('flow_orchestrations', (table) => {
      table.increments('id').primary();
      table.integer('bot_id').notNullable().references('id').inTable('bots').onDelete('CASCADE');
      table.string('name', 255).notNullable();
      table.text('description');
      table.boolean('is_active').defaultTo(true);
      table.integer('entry_flow_id');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('bot_id');
    })
    // 2. flow_transitions - Transitions between flows
    .createTable('flow_transitions', (table) => {
      table.increments('id').primary();
      table.integer('orchestration_id').notNullable().references('id').inTable('flow_orchestrations').onDelete('CASCADE');
      table.integer('from_flow_id').notNullable();
      table.integer('to_flow_id').notNullable();
      table.string('trigger_type', 50).notNullable();
      table.jsonb('trigger_value').defaultTo('{}');
      table.integer('priority').defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('orchestration_id');
      table.index('from_flow_id');
    })
    // 3. flow_variables - Shared variables between flows
    .createTable('flow_variables', (table) => {
      table.increments('id').primary();
      table.integer('orchestration_id').notNullable().references('id').inTable('flow_orchestrations').onDelete('CASCADE');
      table.string('name', 255).notNullable();
      table.string('type', 50).notNullable().defaultTo('string');
      table.text('default_value');
      table.string('scope', 50).notNullable().defaultTo('session');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('orchestration_id');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('flow_variables')
    .dropTableIfExists('flow_transitions')
    .dropTableIfExists('flow_orchestrations');
};
