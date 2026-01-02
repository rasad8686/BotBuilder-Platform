/**
 * Blog and Tutorials Migration
 * Creates blog_posts, blog_comments, tutorials, tutorial_steps, tutorial_progress tables
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('blog_posts', (table) => {
      table.increments('id').primary();
      table.integer('author_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.string('title', 255).notNullable();
      table.string('slug', 150).unique();
      table.text('excerpt');
      table.text('content').notNullable();

      // Media
      table.text('featured_image');

      // Categorization
      table.string('category', 50); // 'news', 'tutorial', 'case-study', 'announcement'
      table.jsonb('tags');

      // SEO
      table.string('meta_title', 255);
      table.text('meta_description');

      // Stats
      table.integer('views_count').defaultTo(0);
      table.integer('likes_count').defaultTo(0);
      table.integer('comments_count').defaultTo(0);
      table.integer('reading_time'); // minutes

      // Status
      table.string('status', 20).defaultTo('draft'); // 'draft', 'published', 'archived'
      table.timestamp('published_at');

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('slug');
      table.index('category');
      table.index('status');
      table.index('published_at');
    })
    .createTable('blog_comments', (table) => {
      table.increments('id').primary();
      table.integer('post_id').unsigned().references('id').inTable('blog_posts').onDelete('CASCADE');
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.integer('parent_comment_id').unsigned().references('id').inTable('blog_comments').onDelete('CASCADE');
      table.text('content').notNullable();
      table.boolean('is_approved').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('post_id');
      table.index('user_id');
      table.index('parent_comment_id');
    })
    .createTable('tutorials', (table) => {
      table.increments('id').primary();
      table.integer('author_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.string('title', 255).notNullable();
      table.string('slug', 150).unique();
      table.text('description');

      // Content
      table.string('difficulty', 20); // 'beginner', 'intermediate', 'advanced'
      table.integer('estimated_time'); // minutes
      table.jsonb('prerequisites');

      // Series
      table.integer('series_id');
      table.integer('series_order');

      // Stats
      table.integer('views_count').defaultTo(0);
      table.integer('completions_count').defaultTo(0);
      table.decimal('rating', 3, 2).defaultTo(0);

      // Status
      table.string('status', 20).defaultTo('draft');
      table.timestamp('published_at');

      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('slug');
      table.index('difficulty');
      table.index('series_id');
      table.index('status');
    })
    .createTable('tutorial_steps', (table) => {
      table.increments('id').primary();
      table.integer('tutorial_id').unsigned().references('id').inTable('tutorials').onDelete('CASCADE');
      table.integer('step_number').notNullable();
      table.string('title', 255);
      table.text('content').notNullable();
      table.text('code_snippet');
      table.string('code_language', 50);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('tutorial_id');
      table.index('step_number');
    })
    .createTable('tutorial_progress', (table) => {
      table.increments('id').primary();
      table.integer('tutorial_id').unsigned().references('id').inTable('tutorials').onDelete('CASCADE');
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.jsonb('completed_steps').defaultTo('[]');
      table.boolean('is_completed').defaultTo(false);
      table.timestamp('completed_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.unique(['tutorial_id', 'user_id']);
      table.index('tutorial_id');
      table.index('user_id');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('tutorial_progress')
    .dropTableIfExists('tutorial_steps')
    .dropTableIfExists('tutorials')
    .dropTableIfExists('blog_comments')
    .dropTableIfExists('blog_posts');
};
