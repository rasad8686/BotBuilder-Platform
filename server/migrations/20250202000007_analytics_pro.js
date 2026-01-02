/**
 * Analytics Pro Migration
 * Creates analytics_reports and analytics_anomalies tables
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('analytics_reports', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.string('name', 255).notNullable();
      table.text('description');
      table.string('report_type', 50).notNullable(); // 'usage', 'performance', 'errors', 'custom'
      table.jsonb('config'); // filters, metrics, dimensions
      table.string('schedule', 50); // 'daily', 'weekly', 'monthly', null
      table.timestamp('last_run_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('organization_id');
      table.index('report_type');
      table.index('schedule');
    })
    .createTable('analytics_anomalies', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.string('metric_name', 100).notNullable();
      table.decimal('expected_value', 15, 4);
      table.decimal('actual_value', 15, 4);
      table.decimal('deviation_percent', 5, 2);
      table.string('severity', 20).notNullable(); // 'low', 'medium', 'high', 'critical'
      table.timestamp('detected_at').defaultTo(knex.fn.now());
      table.timestamp('acknowledged_at');
      table.integer('acknowledged_by').unsigned().references('id').inTable('users').onDelete('SET NULL');

      table.index('organization_id');
      table.index('metric_name');
      table.index('severity');
      table.index('detected_at');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('analytics_anomalies')
    .dropTableIfExists('analytics_reports');
};
