/**
 * Ticket Automation System Migration
 * Creates tables for automation rules, schedules, business hours, and escalation policies
 */

exports.up = async function(knex) {
  // Ticket Automation Rules
  await knex.schema.createTable('ticket_automation_rules', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('workspace_id').unsigned().notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.text('description');
    table.boolean('is_active').defaultTo(true);
    table.string('trigger_type', 30).notNullable(); // ticket_created, ticket_updated, time_based, sla_breach
    table.jsonb('conditions').defaultTo('[]'); // [{field, operator, value}]
    table.jsonb('actions').defaultTo('[]'); // [{action, params}]
    table.integer('priority').defaultTo(0); // execution order
    table.boolean('stop_processing').defaultTo(false); // stop after this rule matches
    table.integer('execution_count').defaultTo(0);
    table.timestamp('last_executed_at');
    table.integer('created_by').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.index(['workspace_id', 'is_active']);
    table.index(['workspace_id', 'trigger_type']);
  });

  // Ticket Automation Logs
  await knex.schema.createTable('ticket_automation_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('rule_id').notNullable()
      .references('id').inTable('ticket_automation_rules').onDelete('CASCADE');
    table.uuid('ticket_id')
      .references('id').inTable('tickets').onDelete('CASCADE');
    table.string('trigger_type', 30).notNullable();
    table.jsonb('conditions_matched').defaultTo('[]');
    table.jsonb('actions_executed').defaultTo('[]');
    table.string('status', 20).notNullable(); // success, failed, skipped
    table.text('error_message');
    table.integer('execution_time_ms');
    table.timestamp('executed_at').defaultTo(knex.fn.now());

    table.index(['rule_id', 'executed_at']);
    table.index(['ticket_id', 'executed_at']);
    table.index('status');
  });

  // Ticket Schedules (Scheduled Jobs Configuration)
  await knex.schema.createTable('ticket_schedules', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('workspace_id').unsigned().notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.string('schedule_type', 30).notNullable(); // auto_close, reminder, escalation, report
    table.jsonb('config').defaultTo('{}');
    table.string('cron_expression', 50).notNullable(); // "0 9 * * *"
    table.boolean('is_active').defaultTo(true);
    table.timestamp('last_run_at');
    table.timestamp('next_run_at');
    table.string('last_run_status', 20);
    table.text('last_run_error');
    table.integer('run_count').defaultTo(0);
    table.timestamps(true, true);

    table.index(['workspace_id', 'is_active']);
    table.index('next_run_at');
  });

  // Business Hours
  await knex.schema.createTable('business_hours', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('workspace_id').unsigned().notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.string('timezone', 50).notNullable().defaultTo('UTC');
    table.jsonb('schedule').defaultTo('{}'); // {monday: {start: "09:00", end: "18:00"}, ...}
    table.jsonb('holidays').defaultTo('[]'); // [{date: "2025-01-01", name: "New Year"}]
    table.boolean('is_default').defaultTo(false);
    table.timestamps(true, true);

    table.index('workspace_id');
  });

  // Escalation Policies
  await knex.schema.createTable('escalation_policies', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('workspace_id').unsigned().notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.text('description');
    table.jsonb('rules').defaultTo('[]'); // [{after_minutes, action, target, notify}]
    table.boolean('is_active').defaultTo(true);
    table.boolean('is_default').defaultTo(false);
    table.timestamps(true, true);

    table.index(['workspace_id', 'is_active']);
  });

  // Agent Assignment Settings
  await knex.schema.createTable('agent_assignment_settings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('workspace_id').unsigned().notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('assignment_strategy', 30).defaultTo('round_robin'); // round_robin, least_busy, load_balanced, skill_based, manual
    table.boolean('auto_assign_enabled').defaultTo(true);
    table.boolean('respect_business_hours').defaultTo(true);
    table.boolean('consider_agent_status').defaultTo(true);
    table.integer('max_tickets_per_agent').defaultTo(20);
    table.uuid('default_team_id');
    table.jsonb('skill_matching_config').defaultTo('{}');
    table.timestamps(true, true);

    table.unique('workspace_id');
  });

  // Agent Capacity & Availability
  await knex.schema.createTable('agent_availability', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('agent_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('workspace_id').unsigned().notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('status', 20).defaultTo('available'); // available, busy, away, offline
    table.integer('max_capacity').defaultTo(20);
    table.integer('current_load').defaultTo(0);
    table.jsonb('skills').defaultTo('[]'); // [{skill_id, level}]
    table.uuid('business_hours_id')
      .references('id').inTable('business_hours').onDelete('SET NULL');
    table.timestamp('status_changed_at').defaultTo(knex.fn.now());
    table.timestamp('last_assigned_at');
    table.timestamps(true, true);

    table.unique(['agent_id', 'workspace_id']);
    table.index(['workspace_id', 'status']);
  });

  // Assignment Queue (for round-robin tracking)
  await knex.schema.createTable('assignment_queue', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('workspace_id').unsigned().notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.uuid('team_id');
    table.integer('last_assigned_agent_id').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    table.integer('position').defaultTo(0);
    table.timestamps(true, true);

    table.unique(['workspace_id', 'team_id']);
  });

  // Webhook Configurations
  await knex.schema.createTable('ticket_webhooks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('workspace_id').unsigned().notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.string('url', 500).notNullable();
    table.string('secret', 100);
    table.jsonb('events').defaultTo('[]'); // ['ticket.created', 'ticket.updated', ...]
    table.jsonb('headers').defaultTo('{}');
    table.boolean('is_active').defaultTo(true);
    table.integer('retry_count').defaultTo(3);
    table.integer('timeout_ms').defaultTo(30000);
    table.integer('success_count').defaultTo(0);
    table.integer('failure_count').defaultTo(0);
    table.timestamp('last_triggered_at');
    table.string('last_status', 20);
    table.timestamps(true, true);

    table.index(['workspace_id', 'is_active']);
  });

  // Webhook Delivery Logs (check if exists first)
  const hasWebhookDeliveryLogs = await knex.schema.hasTable('webhook_delivery_logs');
  if (!hasWebhookDeliveryLogs) {
    await knex.schema.createTable('webhook_delivery_logs', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('webhook_id').notNullable()
        .references('id').inTable('ticket_webhooks').onDelete('CASCADE');
      table.string('event', 50).notNullable();
      table.jsonb('payload');
      table.integer('response_status');
      table.text('response_body');
      table.integer('duration_ms');
      table.string('status', 20).notNullable(); // success, failed, pending
      table.integer('attempt_number').defaultTo(1);
      table.text('error_message');
      table.timestamp('delivered_at').defaultTo(knex.fn.now());

      table.index(['webhook_id', 'delivered_at']);
      table.index('status');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('webhook_delivery_logs');
  await knex.schema.dropTableIfExists('ticket_webhooks');
  await knex.schema.dropTableIfExists('assignment_queue');
  await knex.schema.dropTableIfExists('agent_availability');
  await knex.schema.dropTableIfExists('agent_assignment_settings');
  await knex.schema.dropTableIfExists('escalation_policies');
  await knex.schema.dropTableIfExists('business_hours');
  await knex.schema.dropTableIfExists('ticket_schedules');
  await knex.schema.dropTableIfExists('ticket_automation_logs');
  await knex.schema.dropTableIfExists('ticket_automation_rules');
};
