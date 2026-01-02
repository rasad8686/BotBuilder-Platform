/**
 * Showcase Gallery System Migration
 * Tables: showcase_projects, showcase_likes, showcase_comments
 */

exports.up = function(knex) {
  return knex.schema
    // Showcase Projects
    .createTable('showcase_projects', table => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().references('id').inTable('users');
      table.integer('organization_id').unsigned().references('id').inTable('organizations');

      // Project info
      table.string('title', 255).notNullable();
      table.string('slug', 150).unique();
      table.string('tagline', 255);
      table.text('description');

      // Media
      table.text('logo_url');
      table.text('cover_image');
      table.jsonb('screenshots');
      table.text('video_url');

      // Links
      table.text('website_url');
      table.text('demo_url');

      // Categorization
      table.string('category', 50); // 'chatbot', 'customer-support', 'sales', 'internal', 'other'
      table.string('industry', 50); // 'ecommerce', 'healthcare', 'finance', 'education'
      table.jsonb('tags');

      // Tech details
      table.jsonb('features_used'); // ['ai', 'voice', 'multi-channel']
      table.jsonb('integrations');

      // Stats
      table.integer('views_count').defaultTo(0);
      table.integer('likes_count').defaultTo(0);

      // Testimonial
      table.text('testimonial_text');
      table.string('testimonial_author', 255);
      table.string('testimonial_role', 255);

      // Status
      table.boolean('is_featured').defaultTo(false);
      table.string('status', 20).defaultTo('pending'); // 'pending', 'approved', 'rejected', 'archived'
      table.timestamp('approved_at');

      table.timestamp('created_at').defaultTo(knex.fn.now());

      // Indexes
      table.index('user_id');
      table.index('organization_id');
      table.index('status');
      table.index('category');
      table.index('industry');
      table.index('is_featured');
    })

    // Showcase Likes
    .createTable('showcase_likes', table => {
      table.increments('id').primary();
      table.integer('project_id').unsigned().references('id').inTable('showcase_projects').onDelete('CASCADE');
      table.integer('user_id').unsigned().references('id').inTable('users');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.unique(['project_id', 'user_id']);
      table.index('project_id');
      table.index('user_id');
    })

    // Showcase Comments
    .createTable('showcase_comments', table => {
      table.increments('id').primary();
      table.integer('project_id').unsigned().references('id').inTable('showcase_projects').onDelete('CASCADE');
      table.integer('user_id').unsigned().references('id').inTable('users');
      table.text('content').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('project_id');
      table.index('user_id');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('showcase_comments')
    .dropTableIfExists('showcase_likes')
    .dropTableIfExists('showcase_projects');
};
