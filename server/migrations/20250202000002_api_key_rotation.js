/**
 * Migration: API Key Rotation Support
 *
 * Adds rotation-related fields to api_tokens table for:
 * - Tracking rotation history (rotated_from_id)
 * - Scheduling automatic rotations (rotation_scheduled_at)
 * - Overlap period for seamless transitions (overlap_expires_at)
 */

exports.up = function(knex) {
  return knex.schema.alterTable('api_tokens', (table) => {
    // Reference to the token this was rotated from
    table.integer('rotated_from_id').unsigned()
      .references('id').inTable('api_tokens').onDelete('SET NULL');

    // When automatic rotation is scheduled
    table.timestamp('rotation_scheduled_at').nullable();

    // When the old token stops working (overlap period end)
    table.timestamp('overlap_expires_at').nullable();

    // Index for finding tokens due for rotation
    table.index('rotation_scheduled_at', 'idx_api_tokens_rotation_scheduled');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('api_tokens', (table) => {
    table.dropIndex('rotation_scheduled_at', 'idx_api_tokens_rotation_scheduled');
    table.dropColumn('overlap_expires_at');
    table.dropColumn('rotation_scheduled_at');
    table.dropColumn('rotated_from_id');
  });
};
