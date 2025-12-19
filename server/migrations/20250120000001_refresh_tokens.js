/**
 * Migration: Refresh Tokens
 *
 * Creates refresh_tokens table for JWT token rotation mechanism.
 * - Access token: 15 minutes
 * - Refresh token: 7 days
 * - Token rotation on each refresh
 */

exports.up = async function(knex) {
  // Create refresh_tokens table
  await knex.schema.createTable('refresh_tokens', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.string('token_hash', 64).notNullable().unique(); // SHA-256 hash
    table.string('family_id', 36).notNullable(); // UUID for token family (rotation tracking)
    table.boolean('is_revoked').defaultTo(false);
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.string('ip_address', 45); // IPv6 support
    table.string('user_agent', 500);

    // Foreign key
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    // Indexes for fast lookup
    table.index('token_hash');
    table.index('user_id');
    table.index('family_id');
    table.index('expires_at');
  });

  console.log('✅ Created refresh_tokens table');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('refresh_tokens');
  console.log('✅ Dropped refresh_tokens table');
};
