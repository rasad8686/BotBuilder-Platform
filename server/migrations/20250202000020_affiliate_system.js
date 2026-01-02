/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Affiliates table - Main affiliate accounts
  await knex.schema.createTable('affiliates', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('affiliate_code', 50).unique().notNullable();
    table.string('status', 20).defaultTo('pending'); // pending, active, suspended
    table.decimal('commission_rate', 5, 2).defaultTo(20.00); // percentage
    table.string('payment_method', 50); // paypal, bank_transfer, crypto
    table.jsonb('payment_details').defaultTo('{}');
    table.decimal('minimum_payout', 10, 2).defaultTo(50.00);
    table.decimal('lifetime_earnings', 12, 2).defaultTo(0);
    table.decimal('pending_balance', 12, 2).defaultTo(0);
    table.decimal('paid_balance', 12, 2).defaultTo(0);
    table.integer('total_clicks').defaultTo(0);
    table.integer('total_conversions').defaultTo(0);
    table.timestamp('approved_at');
    table.timestamps(true, true);

    table.index('user_id');
    table.index('affiliate_code');
    table.index('status');
  });

  // Affiliate links table
  await knex.schema.createTable('affiliate_links', (table) => {
    table.increments('id').primary();
    table.integer('affiliate_id').unsigned().notNullable().references('id').inTable('affiliates').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.string('slug', 100).unique().notNullable();
    table.string('destination_url', 500).notNullable();
    table.string('campaign', 100);
    table.integer('clicks').defaultTo(0);
    table.integer('conversions').defaultTo(0);
    table.decimal('earnings', 12, 2).defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);

    table.index('affiliate_id');
    table.index('slug');
    table.index('is_active');
  });

  // Affiliate clicks table - Track all clicks
  await knex.schema.createTable('affiliate_clicks', (table) => {
    table.increments('id').primary();
    table.integer('affiliate_id').unsigned().notNullable().references('id').inTable('affiliates').onDelete('CASCADE');
    table.integer('link_id').unsigned().references('id').inTable('affiliate_links').onDelete('SET NULL');
    table.string('ip_address', 45);
    table.string('user_agent', 500);
    table.string('referrer', 500);
    table.string('country', 2);
    table.string('device', 50);
    table.string('browser', 50);
    table.boolean('is_unique').defaultTo(true);
    table.timestamp('clicked_at').defaultTo(knex.fn.now());

    table.index('affiliate_id');
    table.index('link_id');
    table.index('clicked_at');
  });

  // Affiliate conversions table
  await knex.schema.createTable('affiliate_conversions', (table) => {
    table.increments('id').primary();
    table.integer('affiliate_id').unsigned().notNullable().references('id').inTable('affiliates').onDelete('CASCADE');
    table.integer('link_id').unsigned().references('id').inTable('affiliate_links').onDelete('SET NULL');
    table.integer('click_id').unsigned().references('id').inTable('affiliate_clicks').onDelete('SET NULL');
    table.integer('referred_user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.string('order_id', 100);
    table.decimal('order_amount', 12, 2).notNullable();
    table.decimal('commission_rate', 5, 2).notNullable();
    table.decimal('commission_amount', 12, 2).notNullable();
    table.string('status', 20).defaultTo('pending'); // pending, approved, rejected, paid
    table.string('type', 20).defaultTo('signup'); // signup, subscription, upgrade
    table.timestamp('converted_at').defaultTo(knex.fn.now());
    table.timestamp('approved_at');
    table.timestamps(true, true);

    table.index('affiliate_id');
    table.index('status');
    table.index('converted_at');
  });

  // Affiliate payouts table
  await knex.schema.createTable('affiliate_payouts', (table) => {
    table.increments('id').primary();
    table.integer('affiliate_id').unsigned().notNullable().references('id').inTable('affiliates').onDelete('CASCADE');
    table.decimal('amount', 12, 2).notNullable();
    table.string('payment_method', 50).notNullable();
    table.jsonb('payment_details').defaultTo('{}');
    table.string('status', 20).defaultTo('pending'); // pending, processing, completed, failed
    table.string('transaction_id', 100);
    table.text('notes');
    table.timestamp('requested_at').defaultTo(knex.fn.now());
    table.timestamp('processed_at');
    table.timestamp('completed_at');
    table.timestamps(true, true);

    table.index('affiliate_id');
    table.index('status');
    table.index('requested_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('affiliate_payouts');
  await knex.schema.dropTableIfExists('affiliate_conversions');
  await knex.schema.dropTableIfExists('affiliate_clicks');
  await knex.schema.dropTableIfExists('affiliate_links');
  await knex.schema.dropTableIfExists('affiliates');
};
