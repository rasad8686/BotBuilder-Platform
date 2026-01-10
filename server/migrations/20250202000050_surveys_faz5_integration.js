/**
 * Migration: Surveys FAZ 5 Integration
 * Adds targeting, schedule, style configs and new tables for translations, notifications, integrations
 */

exports.up = function(knex) {
  return knex.schema
    // Add new columns to surveys table
    .alterTable('surveys', (table) => {
      table.jsonb('targeting_config').defaultTo('{}');
      table.jsonb('schedule_config').defaultTo('{}');
      table.jsonb('style_config').defaultTo('{}');
      table.boolean('ab_test_enabled').defaultTo(false);
      table.jsonb('ab_test_config').defaultTo('{}');
    })
    // Create survey_translations table
    .createTable('survey_translations', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('survey_id').notNullable().references('id').inTable('surveys').onDelete('CASCADE');
      table.string('language_code', 10).notNullable();
      table.jsonb('translations').defaultTo('{}');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['survey_id', 'language_code']);
      table.index('survey_id');
    })
    // Create survey_notification_settings table
    .createTable('survey_notification_settings', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('survey_id').notNullable().references('id').inTable('surveys').onDelete('CASCADE');
      table.string('type', 50).notNullable(); // email, slack, webhook, in_app
      table.jsonb('config').defaultTo('{}');
      table.boolean('enabled').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['survey_id', 'type']);
      table.index('survey_id');
    })
    // Create survey_integrations table
    .createTable('survey_integrations', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('survey_id').notNullable().references('id').inTable('surveys').onDelete('CASCADE');
      table.string('provider', 50).notNullable(); // hubspot, salesforce, zapier, etc.
      table.jsonb('config').defaultTo('{}');
      table.boolean('enabled').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['survey_id', 'provider']);
      table.index('survey_id');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('survey_integrations')
    .dropTableIfExists('survey_notification_settings')
    .dropTableIfExists('survey_translations')
    .alterTable('surveys', (table) => {
      table.dropColumn('targeting_config');
      table.dropColumn('schedule_config');
      table.dropColumn('style_config');
      table.dropColumn('ab_test_enabled');
      table.dropColumn('ab_test_config');
    });
};
