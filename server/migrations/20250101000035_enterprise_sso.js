/**
 * Enterprise SSO Migration
 * Tables: sso_configurations, sso_domains, sso_user_mappings, sso_login_logs
 */

exports.up = async function(knex) {
  // Check if using PostgreSQL
  const isPostgres = knex.client.config.client === 'pg' || knex.client.config.client === 'postgresql';

  if (isPostgres) {
    // Create ENUM types for PostgreSQL
    await knex.raw(`
      DO $$ BEGIN
        CREATE TYPE sso_provider_type AS ENUM ('saml', 'oidc', 'azure_ad', 'okta', 'google', 'onelogin');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await knex.raw(`
      DO $$ BEGIN
        CREATE TYPE sso_login_status AS ENUM ('success', 'failed', 'pending');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  // 1. SSO Configurations table
  await knex.schema.createTable('sso_configurations', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').unsigned().notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');

    if (isPostgres) {
      table.specificType('provider_type', 'sso_provider_type').notNullable();
    } else {
      table.enum('provider_type', ['saml', 'oidc', 'azure_ad', 'okta', 'google', 'onelogin']).notNullable();
    }

    table.string('name', 255).notNullable();
    table.boolean('is_enabled').defaultTo(false);
    table.boolean('is_enforced').defaultTo(false);
    table.jsonb('settings').defaultTo('{}');

    // SAML specific fields
    table.string('metadata_url', 1000);
    table.string('entity_id', 500);
    table.string('acs_url', 500);
    table.text('certificate');
    table.text('private_key_encrypted'); // Encrypted storage

    // OIDC specific fields
    table.string('client_id', 255);
    table.text('client_secret_encrypted'); // Encrypted storage
    table.string('issuer_url', 500);
    table.string('authorization_url', 500);
    table.string('token_url', 500);
    table.string('userinfo_url', 500);
    table.string('jwks_url', 500);
    table.string('scopes', 500).defaultTo('openid profile email');

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('organization_id');
    table.index('provider_type');
    table.index('is_enabled');
  });

  // 2. SSO Domains table
  await knex.schema.createTable('sso_domains', (table) => {
    table.increments('id').primary();
    table.integer('sso_configuration_id').unsigned().notNullable()
      .references('id').inTable('sso_configurations').onDelete('CASCADE');

    table.string('domain', 255).notNullable();
    table.boolean('is_verified').defaultTo(false);
    table.string('verification_token', 64);
    table.timestamp('verified_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.unique('domain');
    table.index('sso_configuration_id');
    table.index('is_verified');
  });

  // 3. SSO User Mappings table
  await knex.schema.createTable('sso_user_mappings', (table) => {
    table.increments('id').primary();
    table.integer('sso_configuration_id').unsigned().notNullable()
      .references('id').inTable('sso_configurations').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');

    table.string('external_id', 255).notNullable(); // SSO provider user ID
    table.string('email', 255);
    table.jsonb('attributes').defaultTo('{}'); // Mapped attributes from SSO
    table.timestamp('last_login_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.unique(['sso_configuration_id', 'external_id']);
    table.unique(['sso_configuration_id', 'user_id']);
    table.index('user_id');
    table.index('email');
  });

  // 4. SSO Login Logs table
  await knex.schema.createTable('sso_login_logs', (table) => {
    table.increments('id').primary();
    table.integer('sso_configuration_id').unsigned()
      .references('id').inTable('sso_configurations').onDelete('SET NULL');
    table.integer('user_id').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');

    table.string('email', 255);

    if (isPostgres) {
      table.specificType('status', 'sso_login_status').notNullable().defaultTo('pending');
    } else {
      table.enum('status', ['success', 'failed', 'pending']).notNullable().defaultTo('pending');
    }

    table.text('error_message');
    table.string('ip_address', 45);
    table.text('user_agent');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('sso_configuration_id');
    table.index('user_id');
    table.index('email');
    table.index('status');
    table.index('created_at');
  });

  // Create updated_at trigger for PostgreSQL
  if (isPostgres) {
    await knex.raw(`
      CREATE OR REPLACE FUNCTION update_sso_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await knex.raw(`
      CREATE TRIGGER update_sso_configurations_updated_at
      BEFORE UPDATE ON sso_configurations
      FOR EACH ROW EXECUTE FUNCTION update_sso_updated_at();
    `);

    await knex.raw(`
      CREATE TRIGGER update_sso_user_mappings_updated_at
      BEFORE UPDATE ON sso_user_mappings
      FOR EACH ROW EXECUTE FUNCTION update_sso_updated_at();
    `);
  }
};

exports.down = async function(knex) {
  const isPostgres = knex.client.config.client === 'pg' || knex.client.config.client === 'postgresql';

  // Drop triggers first
  if (isPostgres) {
    await knex.raw('DROP TRIGGER IF EXISTS update_sso_configurations_updated_at ON sso_configurations');
    await knex.raw('DROP TRIGGER IF EXISTS update_sso_user_mappings_updated_at ON sso_user_mappings');
    await knex.raw('DROP FUNCTION IF EXISTS update_sso_updated_at()');
  }

  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('sso_login_logs');
  await knex.schema.dropTableIfExists('sso_user_mappings');
  await knex.schema.dropTableIfExists('sso_domains');
  await knex.schema.dropTableIfExists('sso_configurations');

  // Drop ENUM types
  if (isPostgres) {
    await knex.raw('DROP TYPE IF EXISTS sso_login_status');
    await knex.raw('DROP TYPE IF EXISTS sso_provider_type');
  }
};
