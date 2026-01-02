/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Workspaces table
  await knex.schema.createTable('workspaces', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.string('slug', 100).unique();
    table.text('description');
    table.jsonb('settings').defaultTo('{}');
    table.boolean('is_default').defaultTo(false);
    table.integer('created_by').unsigned().references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('organization_id');
    table.index('slug');
  });

  // Workspace members table
  await knex.schema.createTable('workspace_members', (table) => {
    table.increments('id').primary();
    table.integer('workspace_id').unsigned().references('id').inTable('workspaces').onDelete('CASCADE');
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.string('role', 50).defaultTo('viewer'); // 'owner', 'admin', 'editor', 'viewer'
    table.timestamp('joined_at').defaultTo(knex.fn.now());

    table.unique(['workspace_id', 'user_id']);
    table.index('workspace_id');
    table.index('user_id');
  });

  // Workspace resources table
  await knex.schema.createTable('workspace_resources', (table) => {
    table.increments('id').primary();
    table.integer('workspace_id').unsigned().references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('resource_type', 50).notNullable(); // 'bot', 'api_token', 'webhook', 'integration'
    table.integer('resource_id').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['workspace_id', 'resource_type', 'resource_id']);
    table.index('workspace_id');
    table.index(['resource_type', 'resource_id']);
  });

  // Add workspace_id to bots table
  await knex.schema.alterTable('bots', (table) => {
    table.integer('workspace_id').unsigned().references('id').inTable('workspaces').onDelete('SET NULL');
    table.index('workspace_id');
  });

  // Add workspace_id to api_tokens table
  await knex.schema.alterTable('api_tokens', (table) => {
    table.integer('workspace_id').unsigned().references('id').inTable('workspaces').onDelete('SET NULL');
    table.index('workspace_id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Remove workspace_id from api_tokens
  await knex.schema.alterTable('api_tokens', (table) => {
    table.dropColumn('workspace_id');
  });

  // Remove workspace_id from bots
  await knex.schema.alterTable('bots', (table) => {
    table.dropColumn('workspace_id');
  });

  // Drop tables
  await knex.schema.dropTableIfExists('workspace_resources');
  await knex.schema.dropTableIfExists('workspace_members');
  await knex.schema.dropTableIfExists('workspaces');
};
