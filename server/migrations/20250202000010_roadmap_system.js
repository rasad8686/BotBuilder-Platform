/**
 * Roadmap System Migration
 * Tables: roadmap_items, roadmap_votes, roadmap_comments, feature_requests, feature_request_votes
 */

exports.up = function(knex) {
  return knex.schema
    // Roadmap Items
    .createTable('roadmap_items', table => {
      table.increments('id').primary();
      table.string('title', 255).notNullable();
      table.string('slug', 150).unique();
      table.text('description');
      table.text('detailed_description');

      // Status
      table.string('status', 20).defaultTo('planned'); // 'planned', 'in_progress', 'completed', 'cancelled'
      table.string('priority', 20).defaultTo('medium'); // 'low', 'medium', 'high', 'critical'
      table.string('category', 50); // 'feature', 'improvement', 'integration', 'api'

      // Timeline
      table.string('quarter', 10); // 'Q1 2025', 'Q2 2025'
      table.date('estimated_date');
      table.date('completed_date');

      // Voting
      table.integer('votes_count').defaultTo(0);
      table.integer('comments_count').defaultTo(0);

      // Visibility
      table.boolean('is_public').defaultTo(true);

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // Indexes
      table.index('status');
      table.index('category');
      table.index('quarter');
      table.index('is_public');
    })

    // Roadmap Votes
    .createTable('roadmap_votes', table => {
      table.increments('id').primary();
      table.integer('roadmap_item_id').unsigned().references('id').inTable('roadmap_items').onDelete('CASCADE');
      table.integer('user_id').unsigned().references('id').inTable('users');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.unique(['roadmap_item_id', 'user_id']);
      table.index('roadmap_item_id');
      table.index('user_id');
    })

    // Roadmap Comments
    .createTable('roadmap_comments', table => {
      table.increments('id').primary();
      table.integer('roadmap_item_id').unsigned().references('id').inTable('roadmap_items').onDelete('CASCADE');
      table.integer('user_id').unsigned().references('id').inTable('users');
      table.text('content').notNullable();
      table.boolean('is_official').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('roadmap_item_id');
      table.index('user_id');
    })

    // Feature Requests
    .createTable('feature_requests', table => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().references('id').inTable('users');
      table.string('title', 255).notNullable();
      table.text('description').notNullable();
      table.string('category', 50);
      table.string('status', 20).defaultTo('pending'); // 'pending', 'reviewing', 'planned', 'declined'
      table.integer('votes_count').defaultTo(0);
      table.integer('roadmap_item_id').unsigned().references('id').inTable('roadmap_items');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('user_id');
      table.index('status');
      table.index('category');
    })

    // Feature Request Votes
    .createTable('feature_request_votes', table => {
      table.increments('id').primary();
      table.integer('feature_request_id').unsigned().references('id').inTable('feature_requests').onDelete('CASCADE');
      table.integer('user_id').unsigned().references('id').inTable('users');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.unique(['feature_request_id', 'user_id']);
      table.index('feature_request_id');
      table.index('user_id');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('feature_request_votes')
    .dropTableIfExists('feature_requests')
    .dropTableIfExists('roadmap_comments')
    .dropTableIfExists('roadmap_votes')
    .dropTableIfExists('roadmap_items');
};
