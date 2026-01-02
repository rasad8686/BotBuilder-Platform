/**
 * Usage Alerts Migration
 * Creates tables for alert configuration and history tracking
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('usage_alerts', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.string('alert_type', 50).notNullable(); // 'spending', 'rate_limit', 'usage', 'error_rate'
      table.string('name', 255);
      table.decimal('threshold_value', 10, 2).notNullable();
      table.string('threshold_type', 20).defaultTo('absolute'); // 'absolute', 'percentage'
      table.jsonb('notification_channels').defaultTo('["email"]'); // ['email', 'webhook', 'slack']
      table.text('webhook_url');
      table.string('slack_channel', 255);
      table.boolean('is_active').defaultTo(true);
      table.timestamp('last_triggered_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // Indexes
      table.index(['organization_id']);
      table.index(['user_id']);
      table.index(['alert_type']);
      table.index(['is_active']);
    })
    .createTable('alert_history', (table) => {
      table.increments('id').primary();
      table.integer('alert_id').unsigned().references('id').inTable('usage_alerts').onDelete('CASCADE');
      table.decimal('triggered_value', 10, 2).notNullable();
      table.jsonb('notification_sent').defaultTo('{}');
      table.string('status', 50).defaultTo('sent'); // 'sent', 'failed', 'pending'
      table.text('error_message');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      // Indexes
      table.index(['alert_id']);
      table.index(['created_at']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('alert_history')
    .dropTableIfExists('usage_alerts');
};
