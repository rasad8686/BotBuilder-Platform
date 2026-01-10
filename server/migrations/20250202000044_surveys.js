/**
 * Surveys Migration
 * Creates tables for survey system: surveys, survey_questions,
 * survey_responses, survey_answers, survey_analytics
 */

exports.up = function(knex) {
  return knex.schema
    // Main surveys table
    .createTable('surveys', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('workspace_id').unsigned().references('id').inTable('workspaces').onDelete('CASCADE');
      table.string('name', 255).notNullable();
      table.text('description');
      table.string('type', 20).notNullable().defaultTo('custom'); // nps, csat, ces, custom
      table.string('status', 20).defaultTo('draft'); // draft, active, paused, archived
      table.string('trigger_type', 30).defaultTo('manual'); // manual, after_chat, after_ticket, scheduled, on_page, on_exit
      table.jsonb('trigger_config').defaultTo('{}'); // delay, pages, conditions
      table.text('thank_you_message').defaultTo('Thank you for your feedback!');
      table.string('theme_color', 20).defaultTo('#6366F1');
      table.boolean('show_progress').defaultTo(true);
      table.boolean('allow_skip').defaultTo(false);
      table.boolean('anonymous').defaultTo(false);
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index('organization_id');
      table.index('workspace_id');
      table.index('status');
      table.index('type');
    })

    // Survey questions table
    .createTable('survey_questions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('survey_id').references('id').inTable('surveys').onDelete('CASCADE').notNullable();
      table.integer('question_order').notNullable().defaultTo(0);
      table.string('question_type', 30).notNullable(); // rating, scale, single_choice, multiple_choice, text, nps, emoji, star, boolean
      table.text('question_text').notNullable();
      table.text('description');
      table.boolean('is_required').defaultTo(true);
      table.jsonb('config').defaultTo('{}'); // options[], min, max, labels, placeholder
      table.jsonb('logic').defaultTo('{}'); // skip_logic, branching
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index('survey_id');
      table.index('question_order');
    })

    // Survey responses table (one per respondent per survey)
    .createTable('survey_responses', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('survey_id').references('id').inTable('surveys').onDelete('CASCADE').notNullable();
      table.uuid('contact_id').references('id').inTable('email_contacts').onDelete('SET NULL');
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.string('visitor_id', 255);
      table.uuid('conversation_id');
      table.uuid('ticket_id');
      table.string('status', 20).defaultTo('started'); // started, completed, partial, abandoned
      table.string('channel', 30); // web, widget, email, in_app
      table.string('device', 20); // desktop, mobile, tablet
      table.string('browser', 50);
      table.string('ip_address', 50);
      table.jsonb('metadata').defaultTo('{}');
      table.timestamp('started_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('completed_at', { useTz: true });
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index('survey_id');
      table.index('contact_id');
      table.index('user_id');
      table.index('visitor_id');
      table.index('status');
      table.index('started_at');
    })

    // Survey answers table (individual answers)
    .createTable('survey_answers', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('response_id').references('id').inTable('survey_responses').onDelete('CASCADE').notNullable();
      table.uuid('question_id').references('id').inTable('survey_questions').onDelete('CASCADE').notNullable();
      table.string('answer_value', 500); // numeric or option value
      table.text('answer_text'); // for text responses
      table.jsonb('answer_data').defaultTo('{}'); // for multiple choice or complex answers
      table.integer('time_spent_seconds'); // time spent on this question
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index('response_id');
      table.index('question_id');
    })

    // Survey analytics table (aggregated stats)
    .createTable('survey_analytics', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('survey_id').references('id').inTable('surveys').onDelete('CASCADE').notNullable();
      table.date('date');
      table.integer('total_sent').defaultTo(0);
      table.integer('total_started').defaultTo(0);
      table.integer('total_completed').defaultTo(0);
      table.integer('total_partial').defaultTo(0);
      table.decimal('completion_rate', 5, 2).defaultTo(0);
      table.decimal('avg_completion_time', 10, 2).defaultTo(0); // in seconds
      table.decimal('avg_score', 5, 2); // for rating-type surveys
      table.integer('nps_promoters').defaultTo(0);
      table.integer('nps_passives').defaultTo(0);
      table.integer('nps_detractors').defaultTo(0);
      table.decimal('nps_score', 5, 2); // -100 to 100
      table.decimal('csat_score', 5, 2); // 0 to 100
      table.decimal('ces_score', 5, 2); // 1 to 7
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

      table.unique(['survey_id', 'date']);
      table.index('survey_id');
      table.index('date');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('survey_analytics')
    .dropTableIfExists('survey_answers')
    .dropTableIfExists('survey_responses')
    .dropTableIfExists('survey_questions')
    .dropTableIfExists('surveys');
};
