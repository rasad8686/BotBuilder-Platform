/**
 * Usage-based Billing Migration
 * Creates usage_billing, usage_tiers, and metered_events tables
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('usage_billing', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.date('billing_period_start').notNullable();
      table.date('billing_period_end').notNullable();

      // Usage metrics
      table.integer('api_requests').defaultTo(0);
      table.bigInteger('ai_tokens_used').defaultTo(0);
      table.decimal('storage_gb', 10, 4).defaultTo(0);
      table.decimal('bandwidth_gb', 10, 4).defaultTo(0);

      // Costs
      table.decimal('base_cost', 10, 2);
      table.decimal('usage_cost', 10, 2);
      table.decimal('overage_cost', 10, 2);
      table.decimal('total_cost', 10, 2);

      table.string('status', 20).defaultTo('pending'); // 'pending', 'calculated', 'invoiced', 'paid'
      table.string('invoice_id', 255); // Stripe invoice ID
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('organization_id');
      table.index('billing_period_start');
      table.index('billing_period_end');
      table.index('status');
    })
    .createTable('usage_tiers', (table) => {
      table.increments('id').primary();
      table.string('name', 100).notNullable();
      table.integer('min_units').notNullable();
      table.integer('max_units'); // NULL means unlimited
      table.decimal('price_per_unit', 10, 6).notNullable();
      table.string('unit_type', 50).notNullable(); // 'request', 'token', 'gb_storage', 'gb_bandwidth'
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('unit_type');
    })
    .createTable('metered_events', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.string('event_type', 50).notNullable();
      table.integer('quantity').notNullable();
      table.decimal('unit_price', 10, 6);
      table.jsonb('metadata');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('organization_id');
      table.index('event_type');
      table.index('created_at');
    })
    .then(() => {
      // Insert default usage tiers
      return knex('usage_tiers').insert([
        // API Request tiers
        { name: 'API Requests - Free Tier', min_units: 0, max_units: 10000, price_per_unit: 0.000000, unit_type: 'request' },
        { name: 'API Requests - Standard', min_units: 10001, max_units: 100000, price_per_unit: 0.000100, unit_type: 'request' },
        { name: 'API Requests - High Volume', min_units: 100001, max_units: 1000000, price_per_unit: 0.000050, unit_type: 'request' },
        { name: 'API Requests - Enterprise', min_units: 1000001, max_units: null, price_per_unit: 0.000025, unit_type: 'request' },

        // AI Token tiers
        { name: 'AI Tokens - Free Tier', min_units: 0, max_units: 100000, price_per_unit: 0.000000, unit_type: 'token' },
        { name: 'AI Tokens - Standard', min_units: 100001, max_units: 1000000, price_per_unit: 0.000020, unit_type: 'token' },
        { name: 'AI Tokens - High Volume', min_units: 1000001, max_units: 10000000, price_per_unit: 0.000015, unit_type: 'token' },
        { name: 'AI Tokens - Enterprise', min_units: 10000001, max_units: null, price_per_unit: 0.000010, unit_type: 'token' },

        // Storage tiers (per GB)
        { name: 'Storage - Free Tier', min_units: 0, max_units: 5, price_per_unit: 0.000000, unit_type: 'gb_storage' },
        { name: 'Storage - Standard', min_units: 6, max_units: 100, price_per_unit: 0.100000, unit_type: 'gb_storage' },
        { name: 'Storage - High Volume', min_units: 101, max_units: 1000, price_per_unit: 0.080000, unit_type: 'gb_storage' },
        { name: 'Storage - Enterprise', min_units: 1001, max_units: null, price_per_unit: 0.050000, unit_type: 'gb_storage' },

        // Bandwidth tiers (per GB)
        { name: 'Bandwidth - Free Tier', min_units: 0, max_units: 10, price_per_unit: 0.000000, unit_type: 'gb_bandwidth' },
        { name: 'Bandwidth - Standard', min_units: 11, max_units: 100, price_per_unit: 0.120000, unit_type: 'gb_bandwidth' },
        { name: 'Bandwidth - High Volume', min_units: 101, max_units: 1000, price_per_unit: 0.090000, unit_type: 'gb_bandwidth' },
        { name: 'Bandwidth - Enterprise', min_units: 1001, max_units: null, price_per_unit: 0.060000, unit_type: 'gb_bandwidth' }
      ]);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('metered_events')
    .dropTableIfExists('usage_tiers')
    .dropTableIfExists('usage_billing');
};
