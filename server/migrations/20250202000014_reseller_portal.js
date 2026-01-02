/**
 * @fileoverview Reseller/Partner Portal Migration
 * @description Creates tables for reseller management, customers, commissions, and payouts
 */

exports.up = function(knex) {
  return knex.schema
    // 1. Resellers table (first - no dependencies)
    .createTable('resellers', (table) => {
      table.increments('id').primary();
      table.string('name', 255).notNullable();
      table.string('email', 255).unique();
      table.string('company_name', 255);
      table.string('status', 20).defaultTo('pending'); // 'pending', 'approved', 'active', 'suspended'
      table.string('tier', 20).defaultTo('silver'); // 'silver', 'gold', 'platinum'
      table.decimal('commission_rate', 5, 2).defaultTo(10.00); // percentage
      table.jsonb('custom_branding').defaultTo('{}');
      table.string('api_key', 255).unique();
      table.string('phone', 50);
      table.string('website', 255);
      table.text('description');
      table.string('country', 100);
      table.jsonb('payment_info').defaultTo('{}'); // bank details, paypal, etc.
      table.integer('user_id').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('approved_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('status');
      table.index('tier');
      table.index('email');
    })

    // 2. Reseller Payouts table (second - only depends on resellers)
    .createTable('reseller_payouts', (table) => {
      table.increments('id').primary();
      table.integer('reseller_id').references('id').inTable('resellers').onDelete('CASCADE');
      table.decimal('amount', 10, 2).notNullable();
      table.string('method', 50).defaultTo('bank_transfer'); // 'bank_transfer', 'paypal', 'stripe'
      table.string('status', 20).defaultTo('pending'); // 'pending', 'processing', 'completed', 'failed'
      table.string('reference', 255); // transaction reference
      table.string('currency', 3).defaultTo('USD');
      table.jsonb('payment_details').defaultTo('{}'); // payment method details
      table.text('notes');
      table.timestamp('requested_at').defaultTo(knex.fn.now());
      table.timestamp('processed_at');
      table.timestamp('paid_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('reseller_id');
      table.index('status');
    })

    // 3. Reseller Customers table (third)
    .createTable('reseller_customers', (table) => {
      table.increments('id').primary();
      table.integer('reseller_id').references('id').inTable('resellers').onDelete('CASCADE');
      table.integer('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
      table.decimal('custom_price', 10, 2);
      table.decimal('margin', 5, 2); // percentage margin on top of base price
      table.string('status', 20).defaultTo('active'); // 'active', 'inactive', 'churned'
      table.jsonb('custom_settings').defaultTo('{}');
      table.text('notes');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.unique(['reseller_id', 'organization_id']);
      table.index('reseller_id');
      table.index('organization_id');
    })

    // 4. Reseller Commissions table (fourth - depends on reseller_payouts)
    .createTable('reseller_commissions', (table) => {
      table.increments('id').primary();
      table.integer('reseller_id').references('id').inTable('resellers').onDelete('CASCADE');
      table.integer('organization_id').references('id').inTable('organizations').onDelete('SET NULL');
      table.date('period_start').notNullable();
      table.date('period_end').notNullable();
      table.decimal('revenue', 10, 2).defaultTo(0);
      table.decimal('commission_amount', 10, 2).defaultTo(0);
      table.string('status', 20).defaultTo('pending'); // 'pending', 'approved', 'paid'
      table.integer('payout_id').references('id').inTable('reseller_payouts').onDelete('SET NULL');
      table.timestamp('approved_at');
      table.timestamp('paid_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('reseller_id');
      table.index('status');
      table.index(['period_start', 'period_end']);
    })

    // 5. Reseller Activity Logs (last)
    .createTable('reseller_activity_logs', (table) => {
      table.increments('id').primary();
      table.integer('reseller_id').references('id').inTable('resellers').onDelete('CASCADE');
      table.string('action', 100).notNullable();
      table.string('entity_type', 50); // 'customer', 'commission', 'payout', 'branding'
      table.integer('entity_id');
      table.jsonb('details').defaultTo('{}');
      table.string('ip_address', 45);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('reseller_id');
      table.index('action');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('reseller_activity_logs')
    .dropTableIfExists('reseller_commissions')
    .dropTableIfExists('reseller_customers')
    .dropTableIfExists('reseller_payouts')
    .dropTableIfExists('resellers');
};
