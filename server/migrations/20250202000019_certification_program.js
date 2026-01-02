/**
 * @fileoverview Certification Program Migration
 * @description Creates tables for certifications, questions, attempts, and certificates
 */

exports.up = function(knex) {
  return knex.schema
    // Certifications table
    .createTable('certifications', (table) => {
      table.increments('id').primary();
      table.string('name', 255).notNullable();
      table.string('slug', 100).unique();
      table.text('description');
      table.string('level', 20).defaultTo('beginner'); // 'beginner', 'intermediate', 'advanced', 'expert'

      // Requirements
      table.integer('required_score').defaultTo(70); // percentage
      table.integer('time_limit'); // minutes
      table.integer('questions_count');

      // Pricing
      table.decimal('price', 10, 2).defaultTo(0);

      // Badge
      table.text('badge_image');
      table.string('badge_color', 20).defaultTo('#3B82F6');

      // Validity
      table.integer('validity_months').defaultTo(24);

      // Metadata
      table.jsonb('prerequisites').defaultTo('[]'); // array of certification slugs
      table.jsonb('skills').defaultTo('[]'); // skills covered
      table.string('category', 100);

      table.string('status', 20).defaultTo('draft'); // 'draft', 'active', 'archived'
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('slug');
      table.index('status');
      table.index('level');
    })

    // Certification Questions table
    .createTable('certification_questions', (table) => {
      table.increments('id').primary();
      table.integer('certification_id').references('id').inTable('certifications').onDelete('CASCADE');
      table.text('question').notNullable();
      table.string('question_type', 20).defaultTo('single'); // 'single', 'multiple', 'code', 'scenario'
      table.jsonb('options').defaultTo('[]'); // for multiple choice
      table.jsonb('correct_answer'); // can be string, array, or object
      table.text('explanation'); // shown after answer
      table.text('code_template'); // for code questions
      table.integer('points').defaultTo(1);
      table.integer('order_num').defaultTo(0);
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('certification_id');
      table.index('is_active');
    })

    // Certification Attempts table
    .createTable('certification_attempts', (table) => {
      table.increments('id').primary();
      table.integer('certification_id').references('id').inTable('certifications');
      table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');

      // Results
      table.integer('score'); // percentage
      table.integer('points_earned');
      table.integer('total_points');
      table.boolean('passed');
      table.jsonb('answers').defaultTo('{}'); // { questionId: { answer, correct, points } }

      // Timing
      table.timestamp('started_at');
      table.timestamp('completed_at');
      table.integer('time_taken'); // seconds

      // Status
      table.string('status', 20).defaultTo('in_progress'); // 'in_progress', 'completed', 'expired', 'abandoned'

      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('user_id');
      table.index('certification_id');
      table.index('status');
    })

    // User Certifications table (issued certificates)
    .createTable('user_certifications', (table) => {
      table.increments('id').primary();
      table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.integer('certification_id').references('id').inTable('certifications');
      table.integer('attempt_id').references('id').inTable('certification_attempts');

      // Certificate
      table.string('certificate_number', 50).unique();
      table.timestamp('issued_at').defaultTo(knex.fn.now());
      table.timestamp('expires_at');

      // Public profile
      table.boolean('is_public').defaultTo(true);
      table.boolean('show_on_profile').defaultTo(true);

      // Revocation
      table.boolean('is_revoked').defaultTo(false);
      table.text('revocation_reason');
      table.timestamp('revoked_at');

      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.unique(['user_id', 'certification_id']);
      table.index('certificate_number');
      table.index('user_id');
    })

    // Certification Study Guides table
    .createTable('certification_study_guides', (table) => {
      table.increments('id').primary();
      table.integer('certification_id').references('id').inTable('certifications').onDelete('CASCADE');
      table.string('title', 255).notNullable();
      table.text('content'); // markdown content
      table.jsonb('resources').defaultTo('[]'); // [{ type, title, url }]
      table.integer('order_num').defaultTo(0);
      table.integer('estimated_time'); // minutes
      table.boolean('is_published').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('certification_id');
      table.index('order_num');
    })

    // Certification Progress (for tracking study progress)
    .createTable('certification_progress', (table) => {
      table.increments('id').primary();
      table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.integer('certification_id').references('id').inTable('certifications').onDelete('CASCADE');
      table.jsonb('completed_guides').defaultTo('[]'); // array of guide IDs
      table.jsonb('practice_scores').defaultTo('[]'); // array of practice attempt scores
      table.integer('study_time').defaultTo(0); // total minutes
      table.timestamp('last_activity_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.unique(['user_id', 'certification_id']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('certification_progress')
    .dropTableIfExists('certification_study_guides')
    .dropTableIfExists('user_certifications')
    .dropTableIfExists('certification_attempts')
    .dropTableIfExists('certification_questions')
    .dropTableIfExists('certifications');
};
