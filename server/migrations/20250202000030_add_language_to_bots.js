/**
 * Migration: Add language column to bots table
 */

exports.up = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('bots', 'language');
  if (hasColumn) return;

  return knex.schema.alterTable('bots', (table) => {
    table.string('language', 10).defaultTo('en');
  });
};

exports.down = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('bots', 'language');
  if (!hasColumn) return;

  return knex.schema.alterTable('bots', (table) => {
    table.dropColumn('language');
  });
};
