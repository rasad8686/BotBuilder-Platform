/**
 * Migration: Add is_superadmin column to users table
 */

exports.up = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('users', 'is_superadmin');
  if (hasColumn) return;

  return knex.schema.alterTable('users', (table) => {
    table.boolean('is_superadmin').defaultTo(false);
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('users', (table) => {
    table.dropColumn('is_superadmin');
  });
};
