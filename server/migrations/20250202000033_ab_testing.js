/**
 * A/B Testing Migration
 * Creates tables for A/B testing system: ab_tests, ab_test_variants,
 * ab_test_assignments, ab_test_conversions, ab_test_analytics
 */

exports.up = function(knex) {
  return knex.schema
    // Main A/B tests table
    .createTable('ab_tests', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.integer('workspace_id').unsigned().references('id').inTable('workspaces').onDelete('CASCADE');
      table.string('name', 255).notNullable();
      table.text('description');
      table.string('status', 20).defaultTo('draft'); // draft, running, paused, completed
      table.string('test_type', 30).notNullable(); // message, flow, widget, welcome, button, tour
      table.string('goal_metric', 30).defaultTo('conversion'); // conversion, engagement, response_rate, click_rate
      table.jsonb('traffic_split').defaultTo(JSON.stringify({ A: 50, B: 50 }));
      table.string('winner_variant', 10);
      table.decimal('winner_confidence', 5, 2);
      table.boolean('auto_winner_enabled').defaultTo(false);
      table.integer('auto_winner_threshold').defaultTo(95);
      table.timestamp('started_at', { useTz: true });
      table.timestamp('ended_at', { useTz: true });
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index('workspace_id');
      table.index('status');
    })

    // A/B test variants table
    .createTable('ab_test_variants', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('test_id').references('id').inTable('ab_tests').onDelete('CASCADE').notNullable();
      table.string('name', 10).notNullable(); // A, B, C, D
      table.boolean('is_control').defaultTo(false);
      table.jsonb('content').defaultTo(JSON.stringify({}));
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index('test_id');
    })

    // A/B test visitor assignments table
    .createTable('ab_test_assignments', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('test_id').references('id').inTable('ab_tests').onDelete('CASCADE').notNullable();
      table.uuid('variant_id').references('id').inTable('ab_test_variants').onDelete('CASCADE').notNullable();
      table.string('visitor_id', 255).notNullable();
      table.string('user_id', 255);
      table.string('session_id', 255);
      table.timestamp('assigned_at', { useTz: true }).defaultTo(knex.fn.now());

      table.unique(['test_id', 'visitor_id']);
      table.index('test_id');
      table.index('visitor_id');
      table.index('variant_id');
    })

    // A/B test conversions table
    .createTable('ab_test_conversions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('test_id').references('id').inTable('ab_tests').onDelete('CASCADE').notNullable();
      table.uuid('variant_id').references('id').inTable('ab_test_variants').onDelete('CASCADE').notNullable();
      table.string('visitor_id', 255).notNullable();
      table.string('user_id', 255);
      table.string('conversion_type', 50).notNullable(); // click, submit, purchase, signup, goal
      table.decimal('conversion_value', 12, 2);
      table.jsonb('metadata');
      table.timestamp('converted_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index('test_id');
      table.index('variant_id');
      table.index('visitor_id');
      table.index('converted_at');
    })

    // A/B test daily analytics table
    .createTable('ab_test_analytics', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('test_id').references('id').inTable('ab_tests').onDelete('CASCADE').notNullable();
      table.uuid('variant_id').references('id').inTable('ab_test_variants').onDelete('CASCADE').notNullable();
      table.date('date').notNullable();
      table.integer('impressions').defaultTo(0);
      table.integer('conversions').defaultTo(0);
      table.decimal('conversion_rate', 8, 4).defaultTo(0);
      table.decimal('total_value', 12, 2).defaultTo(0);
      table.integer('unique_visitors').defaultTo(0);
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

      table.unique(['test_id', 'variant_id', 'date']);
      table.index('test_id');
      table.index('variant_id');
      table.index('date');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('ab_test_analytics')
    .dropTableIfExists('ab_test_conversions')
    .dropTableIfExists('ab_test_assignments')
    .dropTableIfExists('ab_test_variants')
    .dropTableIfExists('ab_tests');
};
