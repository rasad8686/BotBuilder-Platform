/**
 * Helpdesk/Tickets System Migration
 * Creates tables for ticket management: tickets, comments, categories,
 * SLA policies, activities, assignments, canned responses, satisfaction
 */

exports.up = function(knex) {
  return knex.schema
    // Ticket Categories table
    .createTable('ticket_categories', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.integer('workspace_id').unsigned().references('id').inTable('workspaces').onDelete('CASCADE');
      table.string('name', 100).notNullable();
      table.text('description');
      table.string('color', 7); // hex color
      table.string('icon', 50);
      table.uuid('parent_id').references('id').inTable('ticket_categories').onDelete('SET NULL');
      table.integer('sort_order').defaultTo(0);
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index('workspace_id');
      table.index('parent_id');
    })

    // SLA Policies table
    .createTable('sla_policies', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.integer('workspace_id').unsigned().references('id').inTable('workspaces').onDelete('CASCADE');
      table.string('name', 100).notNullable();
      table.text('description');
      table.integer('first_response_time'); // minutes
      table.integer('resolution_time'); // minutes
      table.boolean('business_hours_only').defaultTo(true);
      table.jsonb('priority_overrides').defaultTo(JSON.stringify({})); // {urgent: {first_response: 30, resolution: 240}}
      table.boolean('is_default').defaultTo(false);
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index('workspace_id');
    })

    // Main Tickets table
    .createTable('tickets', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.integer('workspace_id').unsigned().references('id').inTable('workspaces').onDelete('CASCADE');
      table.string('ticket_number', 20).notNullable();
      table.string('subject', 255).notNullable();
      table.text('description');
      table.string('status', 20).defaultTo('open'); // open, pending, resolved, closed
      table.string('priority', 20).defaultTo('medium'); // low, medium, high, urgent
      table.uuid('category_id').references('id').inTable('ticket_categories').onDelete('SET NULL');
      table.uuid('requester_id'); // FK to contacts if exists
      table.string('requester_email', 255);
      table.string('requester_name', 255);
      table.integer('assignee_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.uuid('team_id'); // FK to teams if exists
      table.string('source', 30).defaultTo('web'); // chat, email, web, api
      table.uuid('sla_policy_id').references('id').inTable('sla_policies').onDelete('SET NULL');
      table.timestamp('due_at', { useTz: true });
      table.timestamp('first_response_at', { useTz: true });
      table.timestamp('resolved_at', { useTz: true });
      table.timestamp('closed_at', { useTz: true });
      table.specificType('tags', 'TEXT[]');
      table.jsonb('custom_fields').defaultTo(JSON.stringify({}));
      table.jsonb('metadata').defaultTo(JSON.stringify({})); // chat_id, bot_id, etc.
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

      table.unique(['workspace_id', 'ticket_number']);
      table.index('workspace_id');
      table.index('status');
      table.index('priority');
      table.index('assignee_id');
      table.index('requester_email');
      table.index('ticket_number');
      table.index('created_at');
    })

    // Ticket Comments table
    .createTable('ticket_comments', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('ticket_id').references('id').inTable('tickets').onDelete('CASCADE').notNullable();
      table.string('author_type', 20).notNullable(); // agent, customer, system
      table.string('author_id', 255);
      table.string('author_name', 255);
      table.string('author_email', 255);
      table.text('body');
      table.text('body_html');
      table.boolean('is_internal').defaultTo(false); // agent-only notes
      table.jsonb('attachments').defaultTo(JSON.stringify([])); // [{name, url, size, type}]
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index('ticket_id');
      table.index('created_at');
    })

    // Ticket Activities table
    .createTable('ticket_activities', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('ticket_id').references('id').inTable('tickets').onDelete('CASCADE').notNullable();
      table.string('actor_type', 20); // agent, customer, system
      table.string('actor_id', 255);
      table.string('actor_name', 255);
      table.string('activity_type', 50).notNullable(); // created, status_changed, assigned, commented, priority_changed, merged, etc.
      table.text('old_value');
      table.text('new_value');
      table.jsonb('metadata').defaultTo(JSON.stringify({}));
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index('ticket_id');
      table.index('created_at');
    })

    // Ticket Assignments history table
    .createTable('ticket_assignments', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('ticket_id').references('id').inTable('tickets').onDelete('CASCADE').notNullable();
      table.integer('assignee_id').unsigned().references('id').inTable('users').onDelete('CASCADE').notNullable();
      table.integer('assigned_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('assigned_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('unassigned_at', { useTz: true });
      table.boolean('is_current').defaultTo(true);

      table.index('ticket_id');
      table.index('assignee_id');
    })

    // Canned Responses table
    .createTable('canned_responses', (table) => {
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
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index('workspace_id');
      table.index('shortcut');
    })

    // Ticket Satisfaction table
    .createTable('ticket_satisfaction', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('ticket_id').references('id').inTable('tickets').onDelete('CASCADE').notNullable();
      table.integer('rating').notNullable(); // 1-5
      table.text('feedback');
      table.timestamp('submitted_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index('ticket_id');
    })

    // Ticket number sequence table (for generating unique ticket numbers per workspace)
    .createTable('ticket_sequences', (table) => {
      table.integer('workspace_id').unsigned().primary().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('last_number').defaultTo(1000);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('ticket_sequences')
    .dropTableIfExists('ticket_satisfaction')
    .dropTableIfExists('canned_responses')
    .dropTableIfExists('ticket_assignments')
    .dropTableIfExists('ticket_activities')
    .dropTableIfExists('ticket_comments')
    .dropTableIfExists('tickets')
    .dropTableIfExists('sla_policies')
    .dropTableIfExists('ticket_categories');
};
