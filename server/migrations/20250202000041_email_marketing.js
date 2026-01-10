/**
 * Email Marketing System Migration
 * Creates tables for contacts, lists, templates, campaigns, automations, and analytics
 */

exports.up = async function(knex) {
  // Email Contacts
  await knex.schema.createTable('email_contacts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('workspace_id').unsigned().notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('email', 255).notNullable();
    table.string('first_name', 100);
    table.string('last_name', 100);
    table.string('phone', 50);
    table.string('company', 255);
    table.string('job_title', 100);
    table.string('status', 20).defaultTo('subscribed'); // subscribed, unsubscribed, bounced, complained
    table.string('source', 50).defaultTo('manual'); // manual, import, api, chatbot, form
    table.specificType('tags', 'text[]').defaultTo('{}');
    table.jsonb('custom_fields').defaultTo('{}');
    table.timestamp('subscribed_at').defaultTo(knex.fn.now());
    table.timestamp('unsubscribed_at');
    table.timestamp('last_activity_at');
    table.timestamps(true, true);

    table.unique(['workspace_id', 'email']);
    table.index('workspace_id');
    table.index('email');
    table.index('status');
    table.index('created_at');
  });

  // Email Lists
  await knex.schema.createTable('email_lists', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('workspace_id').unsigned().notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.text('description');
    table.string('type', 20).defaultTo('static'); // static, dynamic
    table.jsonb('dynamic_rules').defaultTo('[]'); // [{field, operator, value}]
    table.integer('contact_count').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);

    table.index('workspace_id');
  });

  // Email List Contacts (junction table)
  await knex.schema.createTable('email_list_contacts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('list_id').notNullable()
      .references('id').inTable('email_lists').onDelete('CASCADE');
    table.uuid('contact_id').notNullable()
      .references('id').inTable('email_contacts').onDelete('CASCADE');
    table.timestamp('added_at').defaultTo(knex.fn.now());

    table.unique(['list_id', 'contact_id']);
    table.index('list_id');
    table.index('contact_id');
  });

  // Email Templates
  await knex.schema.createTable('email_templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('workspace_id').unsigned().notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.text('description');
    table.string('subject', 255);
    table.string('preview_text', 255);
    table.text('content_html');
    table.jsonb('content_json').defaultTo('{}'); // for drag-drop builder
    table.string('thumbnail_url', 500);
    table.string('category', 50).defaultTo('marketing'); // marketing, transactional, newsletter, welcome, promotional
    table.boolean('is_active').defaultTo(true);
    table.integer('usage_count').defaultTo(0);
    table.integer('created_by').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.index('workspace_id');
    table.index('category');
  });

  // Email Campaigns
  await knex.schema.createTable('email_campaigns', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('workspace_id').unsigned().notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.text('description');
    table.string('type', 30).defaultTo('broadcast'); // broadcast, automated, drip, trigger
    table.string('status', 20).defaultTo('draft'); // draft, scheduled, sending, sent, paused, cancelled
    table.uuid('template_id')
      .references('id').inTable('email_templates').onDelete('SET NULL');
    table.specificType('list_ids', 'uuid[]').defaultTo('{}'); // target lists
    table.jsonb('segment_rules').defaultTo('[]'); // additional filtering
    table.string('subject', 255);
    table.string('preview_text', 255);
    table.string('from_name', 100);
    table.string('from_email', 255);
    table.string('reply_to', 255);
    table.text('content_html');
    table.jsonb('content_json').defaultTo('{}');
    table.timestamp('scheduled_at');
    table.timestamp('started_at');
    table.timestamp('completed_at');
    table.integer('total_recipients').defaultTo(0);
    table.integer('sent_count').defaultTo(0);
    table.jsonb('settings').defaultTo('{"trackOpens": true, "trackClicks": true, "unsubscribeLink": true}');
    table.integer('created_by').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.index('workspace_id');
    table.index('status');
    table.index('scheduled_at');
  });

  // Email Sends (individual email tracking)
  await knex.schema.createTable('email_sends', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('campaign_id').notNullable()
      .references('id').inTable('email_campaigns').onDelete('CASCADE');
    table.uuid('contact_id')
      .references('id').inTable('email_contacts').onDelete('SET NULL');
    table.string('email', 255).notNullable();
    table.string('status', 20).defaultTo('queued'); // queued, sent, delivered, bounced, failed
    table.timestamp('sent_at');
    table.timestamp('delivered_at');
    table.string('bounce_type', 20); // hard, soft
    table.text('bounce_reason');
    table.string('message_id', 255); // ESP message ID
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('campaign_id');
    table.index('contact_id');
    table.index('status');
  });

  // Email Events (opens, clicks, etc.)
  await knex.schema.createTable('email_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('campaign_id')
      .references('id').inTable('email_campaigns').onDelete('CASCADE');
    table.uuid('contact_id')
      .references('id').inTable('email_contacts').onDelete('SET NULL');
    table.uuid('send_id')
      .references('id').inTable('email_sends').onDelete('CASCADE');
    table.string('event_type', 30).notNullable(); // sent, delivered, opened, clicked, bounced, unsubscribed, complained, failed
    table.text('link_url'); // for click events
    table.text('user_agent');
    table.string('ip_address', 45);
    table.jsonb('location').defaultTo('{}'); // {country, city}
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('campaign_id');
    table.index('contact_id');
    table.index('event_type');
    table.index('created_at');
  });

  // Email Automations
  await knex.schema.createTable('email_automations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('workspace_id').unsigned().notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.text('description');
    table.string('trigger_type', 50).notNullable(); // signup, tag_added, date_based, event, api
    table.jsonb('trigger_config').defaultTo('{}');
    table.string('status', 20).defaultTo('draft'); // draft, active, paused
    table.jsonb('steps').defaultTo('[]'); // automation workflow steps
    table.integer('entry_count').defaultTo(0);
    table.integer('completed_count').defaultTo(0);
    table.integer('created_by').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.index('workspace_id');
    table.index('status');
  });

  // Email Automation Enrollments
  await knex.schema.createTable('email_automation_enrollments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('automation_id').notNullable()
      .references('id').inTable('email_automations').onDelete('CASCADE');
    table.uuid('contact_id').notNullable()
      .references('id').inTable('email_contacts').onDelete('CASCADE');
    table.integer('current_step').defaultTo(0);
    table.string('status', 20).defaultTo('active'); // active, completed, exited, paused
    table.timestamp('enrolled_at').defaultTo(knex.fn.now());
    table.timestamp('completed_at');
    table.timestamp('next_step_at');

    table.unique(['automation_id', 'contact_id']);
    table.index('automation_id');
    table.index('contact_id');
    table.index('status');
  });

  // Email Unsubscribes
  await knex.schema.createTable('email_unsubscribes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('workspace_id').unsigned().notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.uuid('contact_id')
      .references('id').inTable('email_contacts').onDelete('SET NULL');
    table.uuid('campaign_id')
      .references('id').inTable('email_campaigns').onDelete('SET NULL');
    table.string('email', 255).notNullable();
    table.string('reason', 100);
    table.text('feedback');
    table.timestamp('unsubscribed_at').defaultTo(knex.fn.now());

    table.index('workspace_id');
    table.index('contact_id');
    table.index('email');
  });

  // Email Settings (per workspace)
  await knex.schema.createTable('email_settings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('workspace_id').unsigned().notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('default_from_name', 100);
    table.string('default_from_email', 255);
    table.string('default_reply_to', 255);
    table.string('provider', 50).defaultTo('smtp'); // sendgrid, ses, resend, smtp
    table.jsonb('provider_config').defaultTo('{}'); // encrypted credentials
    table.jsonb('domain_settings').defaultTo('{}'); // verified domains
    table.boolean('double_opt_in').defaultTo(false);
    table.string('unsubscribe_page_url', 500);
    table.text('email_footer');
    table.jsonb('tracking_settings').defaultTo('{"opens": true, "clicks": true}');
    table.timestamps(true, true);

    table.unique('workspace_id');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('email_settings');
  await knex.schema.dropTableIfExists('email_unsubscribes');
  await knex.schema.dropTableIfExists('email_automation_enrollments');
  await knex.schema.dropTableIfExists('email_automations');
  await knex.schema.dropTableIfExists('email_events');
  await knex.schema.dropTableIfExists('email_sends');
  await knex.schema.dropTableIfExists('email_campaigns');
  await knex.schema.dropTableIfExists('email_templates');
  await knex.schema.dropTableIfExists('email_list_contacts');
  await knex.schema.dropTableIfExists('email_lists');
  await knex.schema.dropTableIfExists('email_contacts');
};
