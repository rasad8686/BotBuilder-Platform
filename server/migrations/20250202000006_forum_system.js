/**
 * @fileoverview Forum System Migration
 * @description Creates tables for developer forum
 */

exports.up = function(knex) {
  return knex.schema
    // Forum Categories
    .createTable('forum_categories', table => {
      table.increments('id').primary();
      table.string('name', 100).notNullable();
      table.string('slug', 100).notNullable().unique();
      table.text('description');
      table.string('icon', 50);
      table.string('color', 20);
      table.integer('display_order').defaultTo(0);
      table.integer('topics_count').defaultTo(0);
      table.integer('replies_count').defaultTo(0);
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('slug');
      table.index('display_order');
      table.index('is_active');
    })

    // Forum Topics
    .createTable('forum_topics', table => {
      table.increments('id').primary();
      table.integer('category_id').unsigned().notNullable()
        .references('id').inTable('forum_categories').onDelete('CASCADE');
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.string('title', 255).notNullable();
      table.string('slug', 300).notNullable();
      table.text('content').notNullable();
      table.jsonb('tags').defaultTo('[]');
      table.integer('views_count').defaultTo(0);
      table.integer('replies_count').defaultTo(0);
      table.integer('likes_count').defaultTo(0);
      table.boolean('is_pinned').defaultTo(false);
      table.boolean('is_locked').defaultTo(false);
      table.boolean('is_solved').defaultTo(false);
      table.integer('solution_reply_id').unsigned();
      table.timestamp('last_reply_at');
      table.integer('last_reply_user_id').unsigned()
        .references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('category_id');
      table.index('user_id');
      table.index('slug');
      table.index('is_pinned');
      table.index('is_solved');
      table.index('created_at');
      table.index('last_reply_at');
      table.index('views_count');
      table.index('likes_count');
    })

    // Forum Replies
    .createTable('forum_replies', table => {
      table.increments('id').primary();
      table.integer('topic_id').unsigned().notNullable()
        .references('id').inTable('forum_topics').onDelete('CASCADE');
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.integer('parent_reply_id').unsigned()
        .references('id').inTable('forum_replies').onDelete('CASCADE');
      table.text('content').notNullable();
      table.integer('likes_count').defaultTo(0);
      table.boolean('is_solution').defaultTo(false);
      table.boolean('is_edited').defaultTo(false);
      table.timestamp('edited_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('topic_id');
      table.index('user_id');
      table.index('parent_reply_id');
      table.index('is_solution');
      table.index('created_at');
    })

    // Forum Likes
    .createTable('forum_likes', table => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.integer('topic_id').unsigned()
        .references('id').inTable('forum_topics').onDelete('CASCADE');
      table.integer('reply_id').unsigned()
        .references('id').inTable('forum_replies').onDelete('CASCADE');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.unique(['user_id', 'topic_id']);
      table.unique(['user_id', 'reply_id']);
      table.index('topic_id');
      table.index('reply_id');
    })

    // Forum Subscriptions
    .createTable('forum_subscriptions', table => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.integer('topic_id').unsigned()
        .references('id').inTable('forum_topics').onDelete('CASCADE');
      table.integer('category_id').unsigned()
        .references('id').inTable('forum_categories').onDelete('CASCADE');
      table.boolean('email_notifications').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.unique(['user_id', 'topic_id']);
      table.unique(['user_id', 'category_id']);
      table.index('user_id');
    })

    // Forum User Stats
    .createTable('forum_user_stats', table => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable().unique()
        .references('id').inTable('users').onDelete('CASCADE');
      table.integer('topics_count').defaultTo(0);
      table.integer('replies_count').defaultTo(0);
      table.integer('solutions_count').defaultTo(0);
      table.integer('likes_received').defaultTo(0);
      table.integer('likes_given').defaultTo(0);
      table.integer('reputation').defaultTo(0);
      table.string('badge', 50).defaultTo('newcomer');
      table.timestamp('last_activity_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('user_id');
      table.index('reputation');
      table.index('solutions_count');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('forum_user_stats')
    .dropTableIfExists('forum_subscriptions')
    .dropTableIfExists('forum_likes')
    .dropTableIfExists('forum_replies')
    .dropTableIfExists('forum_topics')
    .dropTableIfExists('forum_categories');
};
