/**
 * Migration: API Token Spending Limits
 * Adds spending limit columns to api_tokens table
 */

exports.up = async function(knex) {
  // Add spending limit columns to api_tokens table
  await knex.schema.alterTable('api_tokens', (table) => {
    // Hard spending limit in USD
    table.decimal('spending_limit_usd', 10, 2).nullable();

    // Soft limit for warning alerts
    table.decimal('spending_warning_usd', 10, 2).nullable();

    // Current period spend tracking
    table.decimal('current_period_spend_usd', 10, 2).defaultTo(0);

    // When the current period resets
    table.timestamp('period_reset_at').nullable();

    // Period type: daily or monthly
    table.string('spending_period_type', 10).defaultTo('monthly');

    // Auto-disable when limit reached
    table.boolean('auto_disable_on_limit').defaultTo(true);

    // Disabled due to spending limit (separate from is_active)
    table.boolean('disabled_by_limit').defaultTo(false);

    // Last warning sent timestamp (to avoid spam)
    table.timestamp('last_warning_sent_at').nullable();
  });

  // Create index for period reset queries
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_api_tokens_period_reset
    ON api_tokens (period_reset_at)
    WHERE period_reset_at IS NOT NULL
  `);

  console.log('Migration: Added spending limit columns to api_tokens');
};

exports.down = async function(knex) {
  // Remove index
  await knex.schema.raw('DROP INDEX IF EXISTS idx_api_tokens_period_reset');

  // Remove columns
  await knex.schema.alterTable('api_tokens', (table) => {
    table.dropColumn('spending_limit_usd');
    table.dropColumn('spending_warning_usd');
    table.dropColumn('current_period_spend_usd');
    table.dropColumn('period_reset_at');
    table.dropColumn('spending_period_type');
    table.dropColumn('auto_disable_on_limit');
    table.dropColumn('disabled_by_limit');
    table.dropColumn('last_warning_sent_at');
  });

  console.log('Migration: Removed spending limit columns from api_tokens');
};
