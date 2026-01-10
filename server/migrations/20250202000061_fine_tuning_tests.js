/**
 * Fine-Tuning Tests & Deployments Migration
 *
 * Creates tables for:
 * - fine_tuning_tests: Model test results and benchmarks
 * - fine_tuning_deployments: Model deployment tracking
 * - fine_tuning_model_ab_tests: A/B testing for models
 * - fine_tuning_model_ab_results: A/B test results
 */

exports.up = async function(knex) {
  // Fine-Tuning Tests Table
  await knex.schema.createTable('fine_tuning_tests', (table) => {
    table.increments('id').primary();
    table.integer('model_id').notNullable()
      .references('id').inTable('fine_tune_models').onDelete('CASCADE');
    table.string('test_type', 20).defaultTo('single'); // single, benchmark, comparison
    table.text('test_prompt').notNullable();
    table.text('response');
    table.integer('latency_ms');
    table.integer('tokens_used');
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('model_id');
    table.index('test_type');
    table.index('created_at');
  });

  // Fine-Tuning Deployments Table
  await knex.schema.createTable('fine_tuning_deployments', (table) => {
    table.increments('id').primary();
    table.integer('model_id').notNullable()
      .references('id').inTable('fine_tune_models').onDelete('CASCADE');
    table.integer('bot_id').notNullable()
      .references('id').inTable('bots').onDelete('CASCADE');
    table.integer('deployed_by')
      .references('id').inTable('users').onDelete('SET NULL');
    table.boolean('is_active').defaultTo(true);
    table.boolean('is_default').defaultTo(false);
    table.timestamp('deployed_at').defaultTo(knex.fn.now());
    table.timestamp('undeployed_at');
    table.timestamps(true, true);

    table.index('model_id');
    table.index('bot_id');
    table.index('is_active');
    table.unique(['model_id', 'bot_id', 'is_active']);
  });

  // Add is_default column to fine_tune_models if not exists
  const hasIsDefault = await knex.schema.hasColumn('fine_tune_models', 'is_default');
  if (!hasIsDefault) {
    await knex.schema.alterTable('fine_tune_models', (table) => {
      table.boolean('is_default').defaultTo(false);
    });
  }

  // Fine-Tuning Model A/B Tests Table
  await knex.schema.createTable('fine_tuning_model_ab_tests', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.text('description');
    table.integer('model_a_id').notNullable()
      .references('id').inTable('fine_tune_models').onDelete('CASCADE');
    table.integer('model_b_id').notNullable()
      .references('id').inTable('fine_tune_models').onDelete('CASCADE');
    table.integer('traffic_split_a').defaultTo(50);
    table.integer('traffic_split_b').defaultTo(50);
    table.string('status', 20).defaultTo('draft'); // draft, running, paused, completed
    table.integer('winner_model_id')
      .references('id').inTable('fine_tune_models').onDelete('SET NULL');
    table.integer('created_by')
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('started_at');
    table.timestamp('completed_at');
    table.timestamps(true, true);

    table.index('organization_id');
    table.index('status');
    table.index('model_a_id');
    table.index('model_b_id');
  });

  // Fine-Tuning Model A/B Results Table
  await knex.schema.createTable('fine_tuning_model_ab_results', (table) => {
    table.increments('id').primary();
    table.integer('ab_test_id').notNullable()
      .references('id').inTable('fine_tuning_model_ab_tests').onDelete('CASCADE');
    table.integer('model_id').notNullable()
      .references('id').inTable('fine_tune_models').onDelete('CASCADE');
    table.text('prompt').notNullable();
    table.text('response');
    table.integer('latency_ms');
    table.integer('tokens_used');
    table.integer('user_rating'); // 1-5 rating
    table.boolean('is_preferred').defaultTo(false);
    table.string('session_id', 100);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('ab_test_id');
    table.index('model_id');
    table.index('session_id');
    table.index('created_at');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('fine_tuning_model_ab_results');
  await knex.schema.dropTableIfExists('fine_tuning_model_ab_tests');
  await knex.schema.dropTableIfExists('fine_tuning_deployments');
  await knex.schema.dropTableIfExists('fine_tuning_tests');

  // Remove is_default column if it was added
  const hasIsDefault = await knex.schema.hasColumn('fine_tune_models', 'is_default');
  if (hasIsDefault) {
    await knex.schema.alterTable('fine_tune_models', (table) => {
      table.dropColumn('is_default');
    });
  }
};
