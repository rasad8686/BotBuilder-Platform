/**
 * Migration: Marketplace System
 * Creates marketplace_items, marketplace_reviews, marketplace_purchases, seller_earnings tables
 */

exports.up = async function(knex) {
  const tableExists = async (tableName) => knex.schema.hasTable(tableName);

  // Marketplace Items
  if (!(await tableExists('marketplace_items'))) {
    await knex.schema.createTable('marketplace_items', (table) => {
      table.increments('id').primary();
      table.integer('seller_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.string('type', 50).notNullable(); // 'plugin', 'template', 'integration', 'theme'
      table.string('name', 255).notNullable();
      table.string('slug', 100).notNullable().unique();
      table.text('description');
      table.text('long_description');

      // Pricing
      table.string('price_type', 20).defaultTo('free'); // 'free', 'one_time', 'subscription'
      table.decimal('price', 10, 2).defaultTo(0);
      table.string('currency', 3).defaultTo('USD');

      // Stats
      table.integer('downloads').defaultTo(0);
      table.decimal('rating', 3, 2).defaultTo(0);
      table.integer('reviews_count').defaultTo(0);

      // Media
      table.text('icon_url');
      table.jsonb('screenshots').defaultTo('[]');
      table.text('demo_url');

      // Technical
      table.string('version', 20).defaultTo('1.0.0');
      table.string('min_platform_version', 20);
      table.jsonb('categories').defaultTo('[]');
      table.jsonb('tags').defaultTo('[]');

      // Status
      table.string('status', 20).defaultTo('draft'); // 'draft', 'pending', 'published', 'rejected'
      table.timestamp('published_at');

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // Indexes
      table.index('seller_id');
      table.index('type');
      table.index('status');
      table.index('price_type');
      table.index(['status', 'downloads']);
      table.index(['status', 'rating']);
    });
  }

  // Marketplace Reviews
  if (!(await tableExists('marketplace_reviews'))) {
    await knex.schema.createTable('marketplace_reviews', (table) => {
      table.increments('id').primary();
      table.integer('item_id').unsigned().references('id').inTable('marketplace_items').onDelete('CASCADE');
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.integer('rating').notNullable().checkBetween([1, 5]);
      table.string('title', 255);
      table.text('content');
      table.integer('helpful_count').defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // Each user can only review an item once
      table.unique(['item_id', 'user_id']);
      table.index(['item_id', 'rating']);
    });
  }

  // Marketplace Purchases
  if (!(await tableExists('marketplace_purchases'))) {
    await knex.schema.createTable('marketplace_purchases', (table) => {
      table.increments('id').primary();
      table.integer('item_id').unsigned().references('id').inTable('marketplace_items').onDelete('SET NULL');
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('SET NULL');
      table.decimal('price', 10, 2).notNullable();
      table.string('status', 20).defaultTo('pending'); // 'pending', 'completed', 'failed', 'refunded'
      table.string('stripe_payment_id', 255);
      table.timestamp('completed_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      // Indexes
      table.index('item_id');
      table.index('user_id');
      table.index('organization_id');
      table.index('status');
    });
  }

  // Seller Earnings
  if (!(await tableExists('seller_earnings'))) {
    await knex.schema.createTable('seller_earnings', (table) => {
      table.increments('id').primary();
      table.integer('seller_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.integer('item_id').unsigned().references('id').inTable('marketplace_items').onDelete('SET NULL');
      table.integer('purchase_id').unsigned().references('id').inTable('marketplace_purchases').onDelete('SET NULL');
      table.decimal('gross_amount', 10, 2).notNullable();
      table.decimal('platform_fee', 10, 2).notNullable(); // 30%
      table.decimal('net_amount', 10, 2).notNullable(); // 70%
      table.string('status', 20).defaultTo('pending'); // 'pending', 'available', 'paid'
      table.integer('payout_id').unsigned();
      table.timestamp('paid_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      // Indexes
      table.index('seller_id');
      table.index(['seller_id', 'status']);
      table.index('item_id');
    });
  }

  // Marketplace Item Installations
  if (!(await tableExists('marketplace_installations'))) {
    await knex.schema.createTable('marketplace_installations', (table) => {
      table.increments('id').primary();
      table.integer('item_id').unsigned().references('id').inTable('marketplace_items').onDelete('CASCADE');
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.string('version', 20);
      table.jsonb('settings').defaultTo('{}');
      table.boolean('is_active').defaultTo(true);
      table.timestamp('installed_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // Each org can only install an item once
      table.unique(['item_id', 'organization_id']);
      table.index('organization_id');
    });
  }

  // Seller Payouts
  if (!(await tableExists('seller_payouts'))) {
    await knex.schema.createTable('seller_payouts', (table) => {
      table.increments('id').primary();
      table.integer('seller_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.decimal('amount', 10, 2).notNullable();
      table.string('payout_method', 50); // 'paypal', 'bank', 'stripe'
      table.jsonb('payout_details');
      table.string('payout_reference', 255);
      table.string('status', 20).defaultTo('pending'); // 'pending', 'processing', 'completed', 'failed'
      table.timestamp('processed_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      // Indexes
      table.index('seller_id');
      table.index('status');
    });
  }

  // Seller Payout Info
  if (!(await tableExists('seller_payout_info'))) {
    await knex.schema.createTable('seller_payout_info', (table) => {
      table.increments('id').primary();
      table.integer('seller_id').unsigned().references('id').inTable('users').onDelete('CASCADE').unique();
      table.string('payout_method', 50); // 'paypal', 'bank', 'stripe'
      table.string('paypal_email', 255);
      table.string('bank_name', 100);
      table.string('bank_account_last4', 4);
      table.string('bank_routing', 50);
      table.string('stripe_connect_id', 100);
      table.boolean('is_verified').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  // Add foreign key for seller_earnings payout_id
  if (await tableExists('seller_earnings') && await tableExists('seller_payouts')) {
    try {
      await knex.schema.alterTable('seller_earnings', (table) => {
        table.foreign('payout_id').references('id').inTable('seller_payouts').onDelete('SET NULL');
      });
    } catch (e) {
      // Foreign key might already exist
    }
  }

  // Marketplace Categories
  if (!(await tableExists('marketplace_categories'))) {
    await knex.schema.createTable('marketplace_categories', (table) => {
      table.increments('id').primary();
      table.string('name', 100).notNullable();
      table.string('slug', 100).notNullable().unique();
      table.text('description');
      table.string('icon', 100);
      table.integer('sort_order').defaultTo(0);
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });

    // Insert default categories
    await knex('marketplace_categories').insert([
      { name: 'Plugins', slug: 'plugins', description: 'Extend functionality with plugins', icon: 'puzzle', sort_order: 1 },
      { name: 'Templates', slug: 'templates', description: 'Pre-built bot templates', icon: 'template', sort_order: 2 },
      { name: 'Integrations', slug: 'integrations', description: 'Third-party integrations', icon: 'link', sort_order: 3 },
      { name: 'Themes', slug: 'themes', description: 'Widget themes and styles', icon: 'palette', sort_order: 4 },
      { name: 'AI Models', slug: 'ai-models', description: 'Custom AI models and fine-tuned models', icon: 'brain', sort_order: 5 },
      { name: 'Workflows', slug: 'workflows', description: 'Pre-built workflow templates', icon: 'workflow', sort_order: 6 },
      { name: 'Analytics', slug: 'analytics', description: 'Analytics and reporting tools', icon: 'chart', sort_order: 7 },
      { name: 'E-commerce', slug: 'ecommerce', description: 'E-commerce integrations', icon: 'cart', sort_order: 8 }
    ]);
  }
};

exports.down = async function(knex) {
  // Drop foreign key first
  try {
    await knex.schema.alterTable('seller_earnings', (table) => {
      table.dropForeign('payout_id');
    });
  } catch (e) {
    // Foreign key might not exist
  }

  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('marketplace_categories');
  await knex.schema.dropTableIfExists('seller_payout_info');
  await knex.schema.dropTableIfExists('seller_payouts');
  await knex.schema.dropTableIfExists('marketplace_installations');
  await knex.schema.dropTableIfExists('seller_earnings');
  await knex.schema.dropTableIfExists('marketplace_purchases');
  await knex.schema.dropTableIfExists('marketplace_reviews');
  await knex.schema.dropTableIfExists('marketplace_items');
};
