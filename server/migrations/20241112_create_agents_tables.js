/**
 * Migration: Create agents tables for Multi-Agent AI system
 */

exports.up = function(knex) {
  return knex.schema
    // 1. agents - AI agent definitions
    .createTable('agents', function(table) {
      table.increments('id').primary();
      table.integer('bot_id').unsigned().references('id').inTable('bots').onDelete('CASCADE');
      table.string('name', 255).notNullable();
      table.string('role', 100).notNullable();
      table.text('system_prompt').notNullable();
      table.string('model_provider', 50).notNullable().defaultTo('openai');
      table.string('model_name', 100).notNullable().defaultTo('gpt-4');
      table.decimal('temperature', 3, 2).defaultTo(0.7);
      table.integer('max_tokens').defaultTo(2048);
      table.jsonb('capabilities').defaultTo('[]');
      table.jsonb('tools').defaultTo('[]');
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index(['bot_id', 'is_active']);
      table.index(['role']);
    })

    // 2. agent_workflows - workflow configurations
    .createTable('agent_workflows', function(table) {
      table.increments('id').primary();
      table.integer('bot_id').unsigned().references('id').inTable('bots').onDelete('CASCADE');
      table.string('name', 255).notNullable();
      table.string('workflow_type', 50).notNullable().defaultTo('sequential');
      table.jsonb('agents_config').notNullable().defaultTo('[]');
      table.jsonb('flow_config').notNullable().defaultTo('{}');
      table.integer('entry_agent_id').unsigned().references('id').inTable('agents').onDelete('SET NULL');
      table.boolean('is_default').defaultTo(false);
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index(['bot_id', 'is_active']);
      table.index(['is_default']);
    })

    // 3. workflow_executions - execution logs
    .createTable('workflow_executions', function(table) {
      table.increments('id').primary();
      table.integer('workflow_id').unsigned().references('id').inTable('agent_workflows').onDelete('CASCADE');
      table.integer('bot_id').unsigned().references('id').inTable('bots').onDelete('CASCADE');
      table.string('status', 50).notNullable().defaultTo('pending');
      table.jsonb('input').notNullable().defaultTo('{}');
      table.jsonb('output').defaultTo('{}');
      table.integer('total_tokens').defaultTo(0);
      table.decimal('total_cost', 10, 6).defaultTo(0);
      table.integer('duration_ms').defaultTo(0);
      table.text('error');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index(['workflow_id']);
      table.index(['bot_id']);
      table.index(['status']);
      table.index(['created_at']);
    })

    // 4. agent_execution_steps - individual agent steps
    .createTable('agent_execution_steps', function(table) {
      table.increments('id').primary();
      table.integer('execution_id').unsigned().references('id').inTable('workflow_executions').onDelete('CASCADE');
      table.integer('agent_id').unsigned().references('id').inTable('agents').onDelete('CASCADE');
      table.integer('step_order').notNullable().defaultTo(0);
      table.string('status', 50).notNullable().defaultTo('pending');
      table.jsonb('input').notNullable().defaultTo('{}');
      table.jsonb('output').defaultTo('{}');
      table.text('reasoning');
      table.integer('tokens_used').defaultTo(0);
      table.integer('duration_ms').defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index(['execution_id']);
      table.index(['agent_id']);
      table.index(['step_order']);
    })

    // 5. agent_messages - agent-to-agent messages
    .createTable('agent_messages', function(table) {
      table.increments('id').primary();
      table.integer('execution_id').unsigned().references('id').inTable('workflow_executions').onDelete('CASCADE');
      table.integer('from_agent_id').unsigned().references('id').inTable('agents').onDelete('CASCADE');
      table.integer('to_agent_id').unsigned().references('id').inTable('agents').onDelete('CASCADE');
      table.string('message_type', 50).notNullable().defaultTo('data');
      table.jsonb('content').notNullable().defaultTo('{}');
      table.jsonb('metadata').defaultTo('{}');
      table.timestamp('timestamp').defaultTo(knex.fn.now());

      table.index(['execution_id']);
      table.index(['from_agent_id']);
      table.index(['to_agent_id']);
      table.index(['message_type']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('agent_messages')
    .dropTableIfExists('agent_execution_steps')
    .dropTableIfExists('workflow_executions')
    .dropTableIfExists('agent_workflows')
    .dropTableIfExists('agents');
};
