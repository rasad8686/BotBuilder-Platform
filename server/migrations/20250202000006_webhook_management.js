/**
 * Migration: Webhook Management Enhancements
 * - Add columns to webhooks table for failure tracking
 * - Enhance webhook_delivery_logs with additional fields
 */

exports.up = async function(knex) {
  // Add new columns to webhooks table
  const hasSigningSecret = await knex.schema.hasColumn('webhooks', 'signing_secret');
  if (!hasSigningSecret) {
    await knex.schema.alterTable('webhooks', (table) => {
      table.string('signing_secret', 255);
      table.integer('failure_count').defaultTo(0);
      table.timestamp('last_failure_at');
      table.timestamp('disabled_at');
      table.jsonb('metadata').defaultTo('{}');
    });
  }

  // Check if webhook_delivery_logs exists
  const hasDeliveryLogs = await knex.schema.hasTable('webhook_delivery_logs');

  if (!hasDeliveryLogs) {
    // Create the table if it doesn't exist
    await knex.schema.createTable('webhook_delivery_logs', (table) => {
      table.increments('id').primary();
      table.uuid('webhook_id').references('id').inTable('webhooks').onDelete('CASCADE');
      table.string('event_type', 100);
      table.jsonb('payload');
      table.integer('response_status');
      table.text('response_body');
      table.integer('response_time_ms');
      table.integer('attempt_number').defaultTo(1);
      table.boolean('success').defaultTo(false);
      table.text('error_message');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      // Indexes
      table.index('webhook_id');
      table.index('event_type');
      table.index('success');
      table.index('created_at');
    });
  } else {
    // Add missing columns if table exists
    const hasPayload = await knex.schema.hasColumn('webhook_delivery_logs', 'payload');
    if (!hasPayload) {
      await knex.schema.alterTable('webhook_delivery_logs', (table) => {
        table.jsonb('payload');
      });
    }

    const hasAttemptNumber = await knex.schema.hasColumn('webhook_delivery_logs', 'attempt_number');
    if (!hasAttemptNumber) {
      await knex.schema.alterTable('webhook_delivery_logs', (table) => {
        table.integer('attempt_number').defaultTo(1);
      });
    }

    const hasSuccess = await knex.schema.hasColumn('webhook_delivery_logs', 'success');
    if (!hasSuccess) {
      await knex.schema.alterTable('webhook_delivery_logs', (table) => {
        table.boolean('success').defaultTo(false);
      });
    }

    const hasResponseStatus = await knex.schema.hasColumn('webhook_delivery_logs', 'response_status');
    if (!hasResponseStatus) {
      await knex.schema.alterTable('webhook_delivery_logs', (table) => {
        table.integer('response_status');
      });
    }
  }

  // Copy secret to signing_secret for existing webhooks
  await knex.raw(`
    UPDATE webhooks
    SET signing_secret = secret
    WHERE signing_secret IS NULL AND secret IS NOT NULL
  `);
};

exports.down = async function(knex) {
  // Remove added columns from webhooks
  const hasSigningSecret = await knex.schema.hasColumn('webhooks', 'signing_secret');
  if (hasSigningSecret) {
    await knex.schema.alterTable('webhooks', (table) => {
      table.dropColumn('signing_secret');
      table.dropColumn('failure_count');
      table.dropColumn('last_failure_at');
      table.dropColumn('disabled_at');
      table.dropColumn('metadata');
    });
  }

  // Note: We don't drop webhook_delivery_logs as it may contain valuable data
};
