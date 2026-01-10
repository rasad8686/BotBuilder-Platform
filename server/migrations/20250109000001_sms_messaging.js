/**
 * SMS Messaging System Migration
 * Creates tables for SMS settings, templates, and logs
 */

exports.up = function(knex) {
  return knex.schema
    // SMS Settings - Organization-specific Twilio configuration
    .createTable('sms_settings', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable();
      table.string('twilio_account_sid', 255);
      table.string('twilio_auth_token', 255);
      table.string('twilio_phone_number', 20);
      table.boolean('enabled').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.foreign('organization_id')
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE');

      table.unique('organization_id');
    })

    // SMS Templates - Reusable message templates
    .createTable('sms_templates', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable();
      table.string('name', 255).notNullable();
      table.text('content').notNullable();
      table.json('variables').defaultTo('[]');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.foreign('organization_id')
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE');

      table.index('organization_id');
    })

    // SMS Logs - Message history and delivery tracking
    .createTable('sms_logs', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable();
      table.string('to_number', 20).notNullable();
      table.string('from_number', 20).notNullable();
      table.integer('template_id').unsigned();
      table.text('content').notNullable();
      table.enum('status', ['pending', 'sent', 'failed', 'delivered']).defaultTo('pending');
      table.string('twilio_sid', 50);
      table.text('error_message');
      table.timestamp('sent_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.foreign('organization_id')
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE');

      table.foreign('template_id')
        .references('id')
        .inTable('sms_templates')
        .onDelete('SET NULL');

      table.index('organization_id');
      table.index('status');
      table.index('created_at');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('sms_logs')
    .dropTableIfExists('sms_templates')
    .dropTableIfExists('sms_settings');
};
