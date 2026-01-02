/**
 * Migration: Enterprise Contracts System
 * Manages enterprise contracts, invoices, and amendments
 */

exports.up = async function(knex) {
  // Create enterprise_contracts table
  await knex.schema.createTable('enterprise_contracts', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
    table.string('contract_number', 50).unique();

    // Terms
    table.date('start_date');
    table.date('end_date');
    table.boolean('auto_renew').defaultTo(false);
    table.integer('payment_terms').defaultTo(30); // NET 30

    // Pricing
    table.decimal('annual_value', 12, 2);
    table.decimal('monthly_value', 10, 2);
    table.decimal('discount_percentage', 5, 2).defaultTo(0);
    table.jsonb('custom_pricing').defaultTo('{}');

    // Limits
    table.bigInteger('included_requests');
    table.integer('included_storage_gb');
    table.integer('included_seats');
    table.jsonb('overage_rates').defaultTo('{}');

    // Status
    table.string('status', 20).defaultTo('draft'); // 'draft', 'pending', 'active', 'expired', 'cancelled'
    table.timestamp('signed_at');
    table.string('signed_by', 255);

    // Documents
    table.text('contract_pdf_url');
    table.text('notes');

    // Metadata
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('organization_id');
    table.index('status');
    table.index('end_date');
  });

  // Create enterprise_invoices table
  await knex.schema.createTable('enterprise_invoices', (table) => {
    table.increments('id').primary();
    table.integer('contract_id').unsigned().references('id').inTable('enterprise_contracts').onDelete('CASCADE');
    table.string('invoice_number', 50).unique();
    table.date('period_start');
    table.date('period_end');
    table.decimal('subtotal', 10, 2);
    table.decimal('tax', 10, 2).defaultTo(0);
    table.decimal('total', 10, 2);
    table.string('status', 20).defaultTo('draft'); // 'draft', 'sent', 'paid', 'overdue'
    table.date('due_date');
    table.timestamp('paid_at');
    table.text('pdf_url');
    table.jsonb('line_items').defaultTo('[]');
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('contract_id');
    table.index('status');
    table.index('due_date');
  });

  // Create contract_amendments table
  await knex.schema.createTable('contract_amendments', (table) => {
    table.increments('id').primary();
    table.integer('contract_id').unsigned().references('id').inTable('enterprise_contracts').onDelete('CASCADE');
    table.string('amendment_type', 50); // 'price_change', 'term_extension', 'seats_change', 'limit_change'
    table.text('description');
    table.jsonb('old_value');
    table.jsonb('new_value');
    table.date('effective_date');
    table.string('approved_by', 255);
    table.timestamp('approved_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('contract_id');
    table.index('effective_date');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('contract_amendments');
  await knex.schema.dropTableIfExists('enterprise_invoices');
  await knex.schema.dropTableIfExists('enterprise_contracts');
};
