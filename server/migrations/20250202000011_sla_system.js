/**
 * Migration: SLA System
 *
 * Creates tables for SLA (Service Level Agreement) tracking:
 * - sla_configs: SLA configuration per organization
 * - sla_metrics: Historical SLA metrics
 * - sla_credits: SLA breach credits
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('sla_configs', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable()
        .references('id').inTable('organizations').onDelete('CASCADE');
      table.string('tier', 20).defaultTo('standard'); // 'standard', 'premium', 'enterprise'
      table.decimal('uptime_target', 5, 2).defaultTo(99.9); // 99.9, 99.95, 99.99
      table.integer('response_time_target').defaultTo(500); // ms
      table.integer('support_response_hours').defaultTo(24);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      // Indexes
      table.index('organization_id', 'idx_sla_configs_org');
      table.unique('organization_id', 'uq_sla_configs_org');
    })
    .then(() => {
      return knex.schema.createTable('sla_metrics', (table) => {
        table.increments('id').primary();
        table.integer('organization_id').unsigned().notNullable()
          .references('id').inTable('organizations').onDelete('CASCADE');
        table.date('period_start').notNullable();
        table.date('period_end').notNullable();
        table.decimal('uptime_actual', 5, 4).defaultTo(100.0000); // e.g., 99.9875
        table.integer('avg_response_time').defaultTo(0); // ms
        table.integer('total_downtime_minutes').defaultTo(0);
        table.integer('incidents_count').defaultTo(0);
        table.jsonb('sla_breaches').defaultTo('[]');
        table.timestamp('created_at').defaultTo(knex.fn.now());

        // Indexes
        table.index('organization_id', 'idx_sla_metrics_org');
        table.index(['period_start', 'period_end'], 'idx_sla_metrics_period');
        table.unique(['organization_id', 'period_start', 'period_end'], 'uq_sla_metrics_org_period');
      });
    })
    .then(() => {
      return knex.schema.createTable('sla_credits', (table) => {
        table.increments('id').primary();
        table.integer('organization_id').unsigned().notNullable()
          .references('id').inTable('organizations').onDelete('CASCADE');
        table.date('period').notNullable();
        table.string('breach_type', 50).notNullable(); // 'uptime', 'response_time', 'support'
        table.decimal('credit_percentage', 5, 2).defaultTo(0);
        table.decimal('credit_amount', 10, 2).defaultTo(0);
        table.string('status', 20).defaultTo('pending'); // 'pending', 'approved', 'applied'
        table.timestamp('created_at').defaultTo(knex.fn.now());

        // Indexes
        table.index('organization_id', 'idx_sla_credits_org');
        table.index('status', 'idx_sla_credits_status');
        table.index('period', 'idx_sla_credits_period');
      });
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('sla_credits')
    .then(() => knex.schema.dropTableIfExists('sla_metrics'))
    .then(() => knex.schema.dropTableIfExists('sla_configs'));
};
