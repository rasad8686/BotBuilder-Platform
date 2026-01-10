/**
 * Helpdesk/Tickets System Migration
 * Creates tables for ticket management system
 */

exports.up = async function(knex) {
  // 1. ticket_categories table
  if (!(await knex.schema.hasTable('ticket_categories'))) {
    await knex.schema.createTable('ticket_categories', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.integer('workspace_id').unsigned().references('id').inTable('workspaces').onDelete('CASCADE');
      table.string('name', 100).notNullable();
      table.text('description');
      table.string('color', 7); // hex color
      table.string('icon', 50);
      table.uuid('parent_id').references('id').inTable('ticket_categories').onDelete('SET NULL');
      table.integer('sort_order').defaultTo(0);
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('workspace_id');
    });
  }

  // 2. sla_policies table
  if (!(await knex.schema.hasTable('sla_policies'))) {
    await knex.schema.createTable('sla_policies', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.integer('workspace_id').unsigned().references('id').inTable('workspaces').onDelete('CASCADE');
      table.string('name', 100).notNullable();
      table.text('description');
      table.integer('first_response_time'); // minutes
      table.integer('resolution_time'); // minutes
      table.boolean('business_hours_only').defaultTo(true);
      table.jsonb('priority_overrides'); // {urgent: {first_response: 30, resolution: 240}}
      table.boolean('is_default').defaultTo(false);
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('workspace_id');
    });
  }

  // 3. tickets table
  if (!(await knex.schema.hasTable('tickets'))) {
    await knex.schema.createTable('tickets', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.integer('workspace_id').unsigned().references('id').inTable('workspaces').onDelete('CASCADE');
      table.string('ticket_number', 20).notNullable();
      table.string('subject', 255).notNullable();
      table.text('description');
      table.string('status', 20).defaultTo('open'); // open | pending | resolved | closed
      table.string('priority', 20).defaultTo('medium'); // low | medium | high | urgent
      table.uuid('category_id').references('id').inTable('ticket_categories').onDelete('SET NULL');
      table.uuid('requester_id'); // FK to contacts if exists
      table.string('requester_email', 255);
      table.string('requester_name', 255);
      table.integer('assignee_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.uuid('team_id'); // FK to teams if exists
      table.string('source', 30).defaultTo('web'); // chat | email | web | api
      table.uuid('sla_policy_id').references('id').inTable('sla_policies').onDelete('SET NULL');
      table.timestamp('due_at');
      table.timestamp('first_response_at');
      table.timestamp('resolved_at');
      table.timestamp('closed_at');
      table.specificType('tags', 'TEXT[]');
      table.jsonb('custom_fields');
      table.jsonb('metadata'); // chat_id, bot_id, etc.
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.unique(['workspace_id', 'ticket_number']);
      table.index('workspace_id');
      table.index('status');
      table.index('priority');
      table.index('assignee_id');
      table.index('requester_email');
      table.index('created_at');
    });
  }

  // 4. ticket_comments table
  if (!(await knex.schema.hasTable('ticket_comments'))) {
    await knex.schema.createTable('ticket_comments', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('ticket_id').references('id').inTable('tickets').onDelete('CASCADE');
      table.string('author_type', 20).notNullable(); // agent | customer | system
      table.string('author_id', 255);
      table.string('author_name', 255);
      table.string('author_email', 255);
      table.text('body');
      table.text('body_html');
      table.boolean('is_internal').defaultTo(false); // agent-only notes
      table.jsonb('attachments'); // [{name, url, size, type}]
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('ticket_id');
      table.index('created_at');
    });
  }

  // 5. ticket_activities table
  if (!(await knex.schema.hasTable('ticket_activities'))) {
    await knex.schema.createTable('ticket_activities', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('ticket_id').references('id').inTable('tickets').onDelete('CASCADE');
      table.string('actor_type', 20); // agent | customer | system
      table.string('actor_id', 255);
      table.string('actor_name', 255);
      table.string('activity_type', 50).notNullable(); // created | status_changed | assigned | commented | priority_changed | merged
      table.text('old_value');
      table.text('new_value');
      table.jsonb('metadata');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('ticket_id');
      table.index('created_at');
    });
  }

  // 6. ticket_assignments table
  if (!(await knex.schema.hasTable('ticket_assignments'))) {
    await knex.schema.createTable('ticket_assignments', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('ticket_id').references('id').inTable('tickets').onDelete('CASCADE');
      table.integer('assignee_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.integer('assigned_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('assigned_at').defaultTo(knex.fn.now());
      table.timestamp('unassigned_at');
      table.boolean('is_current').defaultTo(true);

      table.index('ticket_id');
      table.index('assignee_id');
    });
  }

  // 7. canned_responses table
  if (!(await knex.schema.hasTable('canned_responses'))) {
    await knex.schema.createTable('canned_responses', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.integer('workspace_id').unsigned().references('id').inTable('workspaces').onDelete('CASCADE');
      table.string('title', 100).notNullable();
      table.text('content');
      table.text('content_html');
      table.string('shortcut', 50); // typing shortcut like "/thanks"
      table.string('category', 50);
      table.boolean('is_active').defaultTo(true);
      table.integer('usage_count').defaultTo(0);
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('workspace_id');
      table.index('shortcut');
    });
  }

  // 8. ticket_satisfaction table
  if (!(await knex.schema.hasTable('ticket_satisfaction'))) {
    await knex.schema.createTable('ticket_satisfaction', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('ticket_id').references('id').inTable('tickets').onDelete('CASCADE');
      table.integer('rating').notNullable(); // 1-5
      table.text('feedback');
      table.timestamp('submitted_at').defaultTo(knex.fn.now());

      table.unique('ticket_id');
    });
  }

  // 9. ticket_sequences table (for concurrent-safe ticket number generation)
  if (!(await knex.schema.hasTable('ticket_sequences'))) {
    await knex.schema.createTable('ticket_sequences', (table) => {
      table.integer('workspace_id').unsigned().primary().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('last_number').defaultTo(1000);
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('ticket_sequences');
  await knex.schema.dropTableIfExists('ticket_satisfaction');
  await knex.schema.dropTableIfExists('canned_responses');
  await knex.schema.dropTableIfExists('ticket_assignments');
  await knex.schema.dropTableIfExists('ticket_activities');
  await knex.schema.dropTableIfExists('ticket_comments');
  await knex.schema.dropTableIfExists('tickets');
  await knex.schema.dropTableIfExists('sla_policies');
  await knex.schema.dropTableIfExists('ticket_categories');
};
