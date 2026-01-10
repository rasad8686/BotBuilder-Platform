/**
 * Product Tours Migration
 * Creates tables for product tours system: tours, tour_steps, tour_targeting,
 * tour_user_progress, tour_analytics, tour_events
 */

exports.up = function(knex) {
  return knex.schema
    // Main tours table
    .createTable('tours', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.integer('workspace_id').unsigned().references('id').inTable('workspaces').onDelete('CASCADE');
      table.string('name', 255).notNullable();
      table.text('description');
      table.enum('status', ['draft', 'active', 'paused', 'archived']).defaultTo('draft');
      table.jsonb('settings').defaultTo(JSON.stringify({
        dismissible: true,
        showProgressBar: true,
        showStepNumbers: true,
        overlayEnabled: true,
        overlayOpacity: 0.5
      }));
      table.jsonb('theme').defaultTo(JSON.stringify({
        primaryColor: '#3B82F6',
        backgroundColor: '#FFFFFF',
        textColor: '#1F2937',
        borderRadius: 8
      }));
      table.enum('trigger_type', ['manual', 'auto', 'event', 'delay']).defaultTo('manual');
      table.jsonb('trigger_config');
      table.integer('priority').defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.timestamp('published_at');

      table.index('workspace_id');
      table.index('status');
      table.index('trigger_type');
      table.index('priority');
    })

    // Tour steps table
    .createTable('tour_steps', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tour_id').references('id').inTable('tours').onDelete('CASCADE').notNullable();
      table.integer('step_order').notNullable();
      table.enum('step_type', ['tooltip', 'modal', 'hotspot', 'slideout', 'driven_action']).defaultTo('tooltip');
      table.string('target_selector', 500);
      table.string('title', 255);
      table.text('content');
      table.enum('content_type', ['text', 'html', 'video']).defaultTo('text');
      table.enum('position', ['top', 'bottom', 'left', 'right', 'auto', 'center']).defaultTo('auto');
      table.enum('alignment', ['start', 'center', 'end']).defaultTo('center');
      table.jsonb('actions').defaultTo(JSON.stringify([]));
      table.boolean('highlight_element').defaultTo(true);
      table.boolean('scroll_to_element').defaultTo(true);
      table.string('wait_for_event', 100);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('tour_id');
      table.index('step_order');
    })

    // Tour targeting rules table
    .createTable('tour_targeting', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tour_id').references('id').inTable('tours').onDelete('CASCADE').notNullable();
      table.enum('target_type', ['url', 'user_property', 'event', 'segment']).notNullable();
      table.enum('operator', ['equals', 'contains', 'starts_with', 'regex', 'gt', 'lt']).defaultTo('equals');
      table.string('property', 100);
      table.text('value');
      table.enum('logic_operator', ['AND', 'OR']).defaultTo('AND');

      table.index('tour_id');
      table.index('target_type');
    })

    // Tour user progress table
    .createTable('tour_user_progress', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tour_id').references('id').inTable('tours').onDelete('CASCADE').notNullable();
      table.string('visitor_id', 255).notNullable();
      table.string('user_id', 255);
      table.enum('status', ['not_started', 'in_progress', 'completed', 'dismissed']).defaultTo('not_started');
      table.integer('current_step').defaultTo(0);
      table.specificType('completed_steps', 'integer[]').defaultTo('{}');
      table.timestamp('started_at');
      table.timestamp('completed_at');
      table.timestamp('last_seen_at');

      table.unique(['tour_id', 'visitor_id']);
      table.index('tour_id');
      table.index('visitor_id');
      table.index('user_id');
      table.index('status');
    })

    // Tour analytics (daily aggregates)
    .createTable('tour_analytics', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tour_id').references('id').inTable('tours').onDelete('CASCADE').notNullable();
      table.date('date').notNullable();
      table.integer('impressions').defaultTo(0);
      table.integer('starts').defaultTo(0);
      table.integer('completions').defaultTo(0);
      table.integer('dismissals').defaultTo(0);
      table.jsonb('step_metrics').defaultTo(JSON.stringify({}));
      table.decimal('completion_rate', 5, 2).defaultTo(0);
      table.integer('avg_time_seconds').defaultTo(0);

      table.unique(['tour_id', 'date']);
      table.index('tour_id');
      table.index('date');
    })

    // Tour events (individual events log)
    .createTable('tour_events', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tour_id').references('id').inTable('tours').onDelete('CASCADE').notNullable();
      table.uuid('step_id').references('id').inTable('tour_steps').onDelete('SET NULL');
      table.string('visitor_id', 255).notNullable();
      table.string('user_id', 255);
      table.enum('event_type', ['tour_started', 'step_viewed', 'step_completed', 'tour_completed', 'tour_dismissed']).notNullable();
      table.jsonb('event_data');
      table.string('page_url', 2048);
      table.string('session_id', 255);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('tour_id');
      table.index('step_id');
      table.index('visitor_id');
      table.index('event_type');
      table.index('created_at');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('tour_events')
    .dropTableIfExists('tour_analytics')
    .dropTableIfExists('tour_user_progress')
    .dropTableIfExists('tour_targeting')
    .dropTableIfExists('tour_steps')
    .dropTableIfExists('tours');
};
