/**
 * Migration: Add verification_token_expires_at column to users table
 * This column stores the expiration timestamp for email verification tokens
 */

exports.up = function(knex) {
  return knex.schema.hasColumn('users', 'verification_token_expires_at').then(exists => {
    if (!exists) {
      return knex.schema.alterTable('users', table => {
        table.timestamp('verification_token_expires_at').nullable();
      });
    }
  });
};

exports.down = function(knex) {
  return knex.schema.hasColumn('users', 'verification_token_expires_at').then(exists => {
    if (exists) {
      return knex.schema.alterTable('users', table => {
        table.dropColumn('verification_token_expires_at');
      });
    }
  });
};
