/**
 * Email Bounces Migration
 * Creates tables for bounce tracking, blacklist management, and soft bounce history
 */

exports.up = async function(knex) {
  // Email Bounces - tracks all bounce events
  await knex.schema.createTable('email_bounces', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('workspace_id').unsigned().notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('email', 255).notNullable();
    table.string('type', 20).notNullable(); // hard, soft
    table.text('reason');
    table.text('provider_response');
    table.uuid('contact_id')
      .references('id').inTable('email_contacts').onDelete('SET NULL');
    table.uuid('campaign_id')
      .references('id').inTable('email_campaigns').onDelete('SET NULL');
    table.uuid('send_id')
      .references('id').inTable('email_sends').onDelete('SET NULL');
    table.string('provider', 50); // sendgrid, ses, smtp
    table.string('diagnostic_code', 255);
    table.timestamp('bounced_at').defaultTo(knex.fn.now());

    table.index('workspace_id');
    table.index('email');
    table.index('type');
    table.index('bounced_at');
    table.index('contact_id');
  });

  // Email Blacklist - permanently blocked emails
  await knex.schema.createTable('email_blacklist', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('workspace_id').unsigned().notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('email', 255).notNullable();
    table.string('reason', 100).notNullable(); // hard_bounce, soft_bounce_limit, complaint, manual
    table.text('details');
    table.integer('soft_bounce_count').defaultTo(0);
    table.integer('added_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.boolean('is_global').defaultTo(false); // workspace-specific or global
    table.timestamp('blacklisted_at').defaultTo(knex.fn.now());

    table.unique(['workspace_id', 'email']);
    table.index('workspace_id');
    table.index('email');
    table.index('is_global');
  });

  // Email Complaints - spam reports from recipients
  await knex.schema.createTable('email_complaints', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('workspace_id').unsigned().notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('email', 255).notNullable();
    table.string('complaint_type', 50); // abuse, fraud, virus, other
    table.text('feedback');
    table.uuid('contact_id')
      .references('id').inTable('email_contacts').onDelete('SET NULL');
    table.uuid('campaign_id')
      .references('id').inTable('email_campaigns').onDelete('SET NULL');
    table.string('provider', 50);
    table.timestamp('complained_at').defaultTo(knex.fn.now());

    table.index('workspace_id');
    table.index('email');
    table.index('complained_at');
  });

  // Soft bounce tracking for threshold management
  await knex.schema.createTable('email_soft_bounce_tracker', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('workspace_id').unsigned().notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('email', 255).notNullable();
    table.integer('bounce_count').defaultTo(1);
    table.timestamp('first_bounce_at').defaultTo(knex.fn.now());
    table.timestamp('last_bounce_at').defaultTo(knex.fn.now());

    table.unique(['workspace_id', 'email']);
    table.index('workspace_id');
    table.index('email');
    table.index('bounce_count');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('email_soft_bounce_tracker');
  await knex.schema.dropTableIfExists('email_complaints');
  await knex.schema.dropTableIfExists('email_blacklist');
  await knex.schema.dropTableIfExists('email_bounces');
};
