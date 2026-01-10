/**
 * Email A/B Test Variants Migration
 * Creates the email_ab_variants table for storing test variants
 */

exports.up = function(knex) {
  return knex.schema.createTable('email_ab_variants', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('ab_test_id').notNullable().references('id').inTable('email_ab_tests').onDelete('CASCADE');
    table.string('name', 50).notNullable(); // A, B, C, D or custom name
    table.string('label', 255).nullable(); // Human-readable label

    // Variant content
    table.string('subject', 500).nullable();
    table.text('content').nullable();
    table.string('preview_text', 255).nullable();
    table.string('sender_name', 255).nullable();
    table.string('sender_email', 255).nullable();
    table.string('reply_to', 255).nullable();

    // Send time variant
    table.timestamp('send_time').nullable();
    table.string('send_timezone', 100).nullable();

    // Distribution
    table.float('weight_percent').defaultTo(50);
    table.boolean('is_control').defaultTo(false);
    table.boolean('is_winner').defaultTo(false);

    // Metrics
    table.integer('sent_count').defaultTo(0);
    table.integer('delivered_count').defaultTo(0);
    table.integer('opened_count').defaultTo(0);
    table.integer('unique_opens').defaultTo(0);
    table.integer('clicked_count').defaultTo(0);
    table.integer('unique_clicks').defaultTo(0);
    table.integer('converted_count').defaultTo(0);
    table.integer('unsubscribed_count').defaultTo(0);
    table.integer('bounced_count').defaultTo(0);
    table.integer('complained_count').defaultTo(0);
    table.decimal('revenue', 12, 2).defaultTo(0);

    // Calculated rates (cached for performance)
    table.float('open_rate').defaultTo(0);
    table.float('click_rate').defaultTo(0);
    table.float('conversion_rate').defaultTo(0);
    table.float('ctr').defaultTo(0); // Click-through rate (clicks / opens)

    // Statistical analysis
    table.float('confidence_score').nullable();
    table.float('uplift_percent').nullable(); // vs control
    table.boolean('statistically_significant').defaultTo(false);

    table.jsonb('metadata').defaultTo('{}');
    table.timestamps(true, true);

    // Indexes
    table.index('ab_test_id');
    table.index('name');
    table.index('is_winner');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('email_ab_variants');
};
