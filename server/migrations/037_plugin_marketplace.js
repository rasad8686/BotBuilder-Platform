/**
 * Migration: Plugin Marketplace System
 * Creates complete plugin system tables
 */

exports.up = async function(knex) {
  // Plugin Categories
  await knex.schema.createTable('plugin_categories', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table.string('slug', 100).notNullable().unique();
    table.text('description');
    table.string('icon', 50);
    table.integer('sort_order').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // Plugins
  await knex.schema.createTable('plugins', (table) => {
    table.increments('id').primary();
    table.integer('developer_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.string('name', 100).notNullable();
    table.string('slug', 100).notNullable().unique();
    table.text('description');
    table.text('long_description');
    table.string('version', 20).defaultTo('1.0.0');
    table.integer('category_id').unsigned().references('id').inTable('plugin_categories').onDelete('SET NULL');
    table.string('icon_url', 500);
    table.string('banner_url', 500);
    table.decimal('price', 10, 2).defaultTo(0);
    table.boolean('is_free').defaultTo(true);
    table.string('status', 20).defaultTo('pending'); // pending, published, rejected, suspended
    table.json('manifest').defaultTo('{}');
    table.json('permissions').defaultTo('[]');
    table.json('tags').defaultTo('[]');
    table.decimal('rating', 3, 2).defaultTo(0);
    table.integer('review_count').defaultTo(0);
    table.integer('downloads').defaultTo(0);
    table.boolean('is_featured').defaultTo(false);
    table.string('support_url', 500);
    table.string('documentation_url', 500);
    table.string('repository_url', 500);
    table.timestamp('published_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('developer_id');
    table.index('category_id');
    table.index('status');
    table.index(['status', 'downloads']);
    table.index(['status', 'rating']);
  });

  // Plugin Versions
  await knex.schema.createTable('plugin_versions', (table) => {
    table.increments('id').primary();
    table.integer('plugin_id').unsigned().references('id').inTable('plugins').onDelete('CASCADE');
    table.string('version', 20).notNullable();
    table.text('changelog');
    table.text('code');
    table.json('manifest');
    table.string('min_app_version', 20);
    table.string('max_app_version', 20);
    table.boolean('breaking_changes').defaultTo(false);
    table.string('status', 20).defaultTo('pending'); // pending, published, deprecated
    table.text('deprecation_reason');
    table.timestamp('published_at');
    table.timestamp('deprecated_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['plugin_id', 'version']);
    table.index(['plugin_id', 'status']);
  });

  // Plugin Installations
  await knex.schema.createTable('plugin_installations', (table) => {
    table.increments('id').primary();
    table.integer('plugin_id').unsigned().references('id').inTable('plugins').onDelete('CASCADE');
    table.integer('tenant_id').unsigned().notNullable();
    table.string('version', 20);
    table.json('settings').defaultTo('{}');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('installed_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['plugin_id', 'tenant_id']);
    table.index('tenant_id');
  });

  // Plugin Reviews
  await knex.schema.createTable('plugin_reviews', (table) => {
    table.increments('id').primary();
    table.integer('plugin_id').unsigned().references('id').inTable('plugins').onDelete('CASCADE');
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.integer('rating').notNullable().checkBetween([1, 5]);
    table.text('comment');
    table.integer('helpful_count').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['plugin_id', 'user_id']);
    table.index(['plugin_id', 'rating']);
  });

  // Plugin Purchases
  await knex.schema.createTable('plugin_purchases', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.integer('plugin_id').unsigned().references('id').inTable('plugins').onDelete('SET NULL');
    table.integer('developer_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.decimal('gross_amount', 10, 2).notNullable();
    table.decimal('platform_fee', 10, 2).notNullable();
    table.decimal('developer_revenue', 10, 2).notNullable();
    table.string('payment_method', 50);
    table.string('payment_id', 255);
    table.string('status', 20).defaultTo('pending'); // pending, completed, failed, refunded
    table.timestamp('completed_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('user_id');
    table.index('plugin_id');
    table.index('developer_id');
    table.index('status');
  });

  // Developer Earnings
  await knex.schema.createTable('developer_earnings', (table) => {
    table.increments('id').primary();
    table.integer('developer_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.integer('plugin_id').unsigned().references('id').inTable('plugins').onDelete('SET NULL');
    table.integer('purchase_id').unsigned().references('id').inTable('plugin_purchases').onDelete('SET NULL');
    table.integer('payout_id').unsigned();
    table.decimal('amount', 10, 2).notNullable();
    table.string('status', 20).defaultTo('pending'); // pending, processing, paid
    table.timestamp('paid_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('developer_id');
    table.index(['developer_id', 'status']);
  });

  // Developer Payout Info
  await knex.schema.createTable('developer_payout_info', (table) => {
    table.increments('id').primary();
    table.integer('developer_id').unsigned().references('id').inTable('users').onDelete('CASCADE').unique();
    table.string('payout_method', 50); // paypal, bank, stripe
    table.string('paypal_email', 255);
    table.string('bank_name', 100);
    table.string('bank_account_last4', 4);
    table.string('bank_routing', 50);
    table.string('stripe_connect_id', 100);
    table.boolean('is_verified').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // Developer Payouts
  await knex.schema.createTable('developer_payouts', (table) => {
    table.increments('id').primary();
    table.integer('developer_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.decimal('amount', 10, 2).notNullable();
    table.string('payout_method', 50);
    table.json('payout_details');
    table.string('payout_reference', 255);
    table.string('status', 20).defaultTo('pending'); // pending, processing, completed, failed
    table.timestamp('processed_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('developer_id');
    table.index('status');
  });

  // Plugin Update History
  await knex.schema.createTable('plugin_update_history', (table) => {
    table.increments('id').primary();
    table.integer('plugin_id').unsigned().references('id').inTable('plugins').onDelete('CASCADE');
    table.integer('tenant_id').unsigned().notNullable();
    table.string('from_version', 20);
    table.string('to_version', 20);
    table.string('status', 20).defaultTo('completed');
    table.boolean('is_rollback').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['plugin_id', 'tenant_id']);
  });

  // Plugin Storage (for plugin data)
  await knex.schema.createTable('plugin_storage', (table) => {
    table.increments('id').primary();
    table.string('plugin_id', 100).notNullable();
    table.string('key', 255).notNullable();
    table.text('value');
    table.timestamp('expires_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['plugin_id', 'key']);
    table.index('expires_at');
  });

  // Plugin Analytics
  await knex.schema.createTable('plugin_analytics', (table) => {
    table.increments('id').primary();
    table.string('plugin_id', 100).notNullable();
    table.integer('tenant_id').unsigned();
    table.string('event_name', 100).notNullable();
    table.json('properties').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['plugin_id', 'tenant_id']);
    table.index(['plugin_id', 'event_name']);
    table.index('created_at');
  });

  // Add foreign key for developer_earnings payout_id
  await knex.schema.alterTable('developer_earnings', (table) => {
    table.foreign('payout_id').references('id').inTable('developer_payouts').onDelete('SET NULL');
  });

  // Insert default categories
  await knex('plugin_categories').insert([
    { name: 'Channels', slug: 'channels', description: 'Messaging platform integrations', icon: '&#128172;', sort_order: 1 },
    { name: 'AI & NLP', slug: 'ai-nlp', description: 'AI models and natural language processing', icon: '&#129302;', sort_order: 2 },
    { name: 'Integrations', slug: 'integrations', description: 'Third-party service connections', icon: '&#128279;', sort_order: 3 },
    { name: 'Tools', slug: 'tools', description: 'Custom tools for agents', icon: '&#128736;', sort_order: 4 },
    { name: 'Analytics', slug: 'analytics', description: 'Analytics and reporting tools', icon: '&#128200;', sort_order: 5 },
    { name: 'E-commerce', slug: 'ecommerce', description: 'E-commerce and payment tools', icon: '&#128722;', sort_order: 6 },
    { name: 'CRM', slug: 'crm', description: 'Customer relationship management', icon: '&#128101;', sort_order: 7 },
    { name: 'Utilities', slug: 'utilities', description: 'General utility plugins', icon: '&#128295;', sort_order: 8 }
  ]);
};

exports.down = async function(knex) {
  // Drop foreign key first
  await knex.schema.alterTable('developer_earnings', (table) => {
    table.dropForeign('payout_id');
  });

  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('plugin_analytics');
  await knex.schema.dropTableIfExists('plugin_storage');
  await knex.schema.dropTableIfExists('plugin_update_history');
  await knex.schema.dropTableIfExists('developer_payouts');
  await knex.schema.dropTableIfExists('developer_payout_info');
  await knex.schema.dropTableIfExists('developer_earnings');
  await knex.schema.dropTableIfExists('plugin_purchases');
  await knex.schema.dropTableIfExists('plugin_reviews');
  await knex.schema.dropTableIfExists('plugin_installations');
  await knex.schema.dropTableIfExists('plugin_versions');
  await knex.schema.dropTableIfExists('plugins');
  await knex.schema.dropTableIfExists('plugin_categories');
};
