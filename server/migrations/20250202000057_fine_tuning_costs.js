/**
 * Fine-Tuning Cost Tracking Migration
 * Creates tables for cost tracking, budgets, and notifications
 */

exports.up = async function(knex) {
  // Fine-Tuning Costs Table
  await knex.schema.createTable('fine_tuning_costs', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').unsigned().notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.integer('user_id').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    table.integer('job_id').unsigned()
      .references('id').inTable('fine_tune_jobs').onDelete('SET NULL');
    table.integer('model_id').unsigned()
      .references('id').inTable('fine_tune_models').onDelete('SET NULL');
    table.string('base_model', 100).notNullable(); // gpt-3.5-turbo, gpt-4, etc.
    table.decimal('estimated_cost', 10, 6).defaultTo(0);
    table.decimal('actual_cost', 10, 6).defaultTo(0);
    table.integer('tokens_used').defaultTo(0);
    table.integer('training_tokens').defaultTo(0);
    table.integer('epochs').defaultTo(1);
    table.string('status', 50).defaultTo('estimated'); // estimated, training, completed, failed
    table.jsonb('usage_details').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('completed_at');

    table.index('organization_id');
    table.index('job_id');
    table.index('base_model');
    table.index('status');
    table.index('created_at');
  });

  // Fine-Tuning Budgets Table
  await knex.schema.createTable('fine_tuning_budgets', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').unsigned().notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.decimal('monthly_limit', 10, 2).defaultTo(0); // 0 = unlimited
    table.decimal('current_spend', 10, 2).defaultTo(0);
    table.string('alert_threshold', 20).defaultTo('80'); // percentage
    table.boolean('alert_enabled').defaultTo(true);
    table.boolean('auto_stop').defaultTo(false); // Stop training when budget exceeded
    table.timestamp('period_start').defaultTo(knex.fn.now());
    table.timestamp('period_end');
    table.timestamps(true, true);

    table.unique('organization_id');
  });

  // Fine-Tuning Notifications Table
  await knex.schema.createTable('fine_tuning_notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('organization_id').unsigned().notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.integer('user_id').unsigned()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('job_id').unsigned()
      .references('id').inTable('fine_tune_jobs').onDelete('SET NULL');
    table.string('type', 50).notNullable(); // training_started, training_complete, training_failed, budget_warning, budget_exceeded
    table.string('title', 255).notNullable();
    table.text('message');
    table.string('channel', 50).defaultTo('in_app'); // in_app, email, slack, discord, webhook
    table.boolean('is_read').defaultTo(false);
    table.boolean('is_sent').defaultTo(false);
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('read_at');
    table.timestamp('sent_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('organization_id');
    table.index('user_id');
    table.index('type');
    table.index('is_read');
    table.index('created_at');
  });

  // Fine-Tuning Notification Settings Table
  await knex.schema.createTable('fine_tuning_notification_settings', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').unsigned().notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.integer('user_id').unsigned()
      .references('id').inTable('users').onDelete('CASCADE');
    table.boolean('email_enabled').defaultTo(true);
    table.boolean('in_app_enabled').defaultTo(true);
    table.boolean('slack_enabled').defaultTo(false);
    table.string('slack_webhook_url', 500);
    table.boolean('discord_enabled').defaultTo(false);
    table.string('discord_webhook_url', 500);
    table.boolean('notify_training_start').defaultTo(true);
    table.boolean('notify_training_complete').defaultTo(true);
    table.boolean('notify_training_failed').defaultTo(true);
    table.boolean('notify_budget_warning').defaultTo(true);
    table.boolean('notify_budget_exceeded').defaultTo(true);
    table.timestamps(true, true);

    table.unique(['organization_id', 'user_id']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('fine_tuning_notification_settings');
  await knex.schema.dropTableIfExists('fine_tuning_notifications');
  await knex.schema.dropTableIfExists('fine_tuning_budgets');
  await knex.schema.dropTableIfExists('fine_tuning_costs');
};
