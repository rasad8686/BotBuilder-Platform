/**
 * Migration: Add organization_id to bots and api_tokens tables
 */

exports.up = async function(knex) {
  // Add organization_id to bots table
  const botsHasOrgId = await knex.schema.hasColumn('bots', 'organization_id');
  if (!botsHasOrgId) {
    await knex.schema.alterTable('bots', (table) => {
      table.integer('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
    });
    // Create index for bots.organization_id
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_bots_organization_id ON bots(organization_id)');
  }

  // Add organization_id to api_tokens table
  const tokensHasOrgId = await knex.schema.hasColumn('api_tokens', 'organization_id');
  if (!tokensHasOrgId) {
    await knex.schema.alterTable('api_tokens', (table) => {
      table.integer('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
    });
    // Create index for api_tokens.organization_id
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_api_tokens_organization_id ON api_tokens(organization_id)');
  }
};

exports.down = async function(knex) {
  const botsHasOrgId = await knex.schema.hasColumn('bots', 'organization_id');
  if (botsHasOrgId) {
    await knex.raw('DROP INDEX IF EXISTS idx_bots_organization_id');
    await knex.schema.alterTable('bots', (table) => {
      table.dropColumn('organization_id');
    });
  }

  const tokensHasOrgId = await knex.schema.hasColumn('api_tokens', 'organization_id');
  if (tokensHasOrgId) {
    await knex.raw('DROP INDEX IF EXISTS idx_api_tokens_organization_id');
    await knex.schema.alterTable('api_tokens', (table) => {
      table.dropColumn('organization_id');
    });
  }
};
