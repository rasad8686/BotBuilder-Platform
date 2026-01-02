/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Add region columns to organizations table
  await knex.schema.alterTable('organizations', (table) => {
    table.string('primary_region', 20).defaultTo('us-east-1');
    table.jsonb('allowed_regions').defaultTo('["us-east-1"]');
  });

  // Add region column to bots table
  await knex.schema.alterTable('bots', (table) => {
    table.string('region', 20).defaultTo('us-east-1');
    table.index('region');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('organizations', (table) => {
    table.dropColumn('primary_region');
    table.dropColumn('allowed_regions');
  });

  await knex.schema.alterTable('bots', (table) => {
    table.dropColumn('region');
  });
};
