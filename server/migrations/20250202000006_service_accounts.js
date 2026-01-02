/**
 * Migration: Service Accounts
 *
 * Creates service_accounts table and adds service account fields to api_tokens.
 * Service accounts allow organizations to create long-lived API credentials
 * for CI/CD pipelines, automated systems, and server-to-server communication.
 */

exports.up = function(knex) {
  return knex.schema
    // Create service_accounts table
    .createTable('service_accounts', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable()
        .references('id').inTable('organizations').onDelete('CASCADE');
      table.string('name', 255).notNullable();
      table.text('description');
      table.integer('created_by').unsigned()
        .references('id').inTable('users').onDelete('SET NULL');
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // Indexes
      table.index('organization_id', 'idx_service_accounts_org');
      table.index('is_active', 'idx_service_accounts_active');
    })
    // Add service account fields to api_tokens
    .then(() => {
      return knex.schema.alterTable('api_tokens', (table) => {
        table.integer('service_account_id').unsigned()
          .references('id').inTable('service_accounts').onDelete('CASCADE');
        table.boolean('is_service_account').defaultTo(false);

        // Index for service account tokens
        table.index('service_account_id', 'idx_api_tokens_service_account');
        table.index('is_service_account', 'idx_api_tokens_is_service_account');
      });
    })
    // Make expires_at nullable for long-lived service account tokens
    .then(() => {
      return knex.raw('ALTER TABLE api_tokens ALTER COLUMN expires_at DROP NOT NULL');
    })
    .catch(() => {
      // expires_at might already be nullable
      return Promise.resolve();
    });
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('api_tokens', (table) => {
      table.dropIndex('service_account_id', 'idx_api_tokens_service_account');
      table.dropIndex('is_service_account', 'idx_api_tokens_is_service_account');
      table.dropColumn('service_account_id');
      table.dropColumn('is_service_account');
    })
    .then(() => {
      return knex.schema.dropTableIfExists('service_accounts');
    });
};
