/**
 * Email A/B Tests Migration
 * Creates the email_ab_tests table for A/B testing email campaigns
 */

exports.up = function(knex) {
  return knex.schema.createTable('email_ab_tests', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('campaign_id').notNullable().references('id').inTable('email_campaigns').onDelete('CASCADE');
    table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.enum('status', ['draft', 'running', 'paused', 'completed', 'cancelled']).defaultTo('draft');
    table.enum('test_type', ['subject', 'content', 'sender', 'send_time', 'combined']).notNullable();
    table.enum('winner_criteria', ['open_rate', 'click_rate', 'conversion_rate', 'revenue']).defaultTo('open_rate');
    table.integer('sample_size_percent').defaultTo(20).notNullable();
    table.boolean('auto_send_winner').defaultTo(true);
    table.integer('test_duration_hours').defaultTo(24);
    table.integer('minimum_sample_size').defaultTo(100);
    table.float('confidence_level').defaultTo(95);
    table.uuid('winner_variant_id').nullable();
    table.jsonb('settings').defaultTo('{}');
    table.timestamp('scheduled_at').nullable();
    table.timestamp('started_at').nullable();
    table.timestamp('completed_at').nullable();
    table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    // Indexes
    table.index('campaign_id');
    table.index('organization_id');
    table.index('status');
    table.index('created_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('email_ab_tests');
};
