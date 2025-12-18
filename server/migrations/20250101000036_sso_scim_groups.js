/**
 * SSO Phase 2 Migration
 * Tables: scim_tokens, sso_group_mappings, sso_attribute_mappings, sso_analytics
 */

exports.up = async function(knex) {
  const isPostgres = knex.client.config.client === 'pg' || knex.client.config.client === 'postgresql';

  // 1. SCIM Tokens table - for SCIM provisioning authentication
  await knex.schema.createTable('scim_tokens', (table) => {
    table.increments('id').primary();
    table.integer('sso_configuration_id').unsigned().notNullable()
      .references('id').inTable('sso_configurations').onDelete('CASCADE');

    table.string('name', 255).notNullable();
    table.string('token_hash', 64).notNullable(); // SHA-256 hash of token
    table.string('token_prefix', 8).notNullable(); // First 8 chars for identification
    table.boolean('is_active').defaultTo(true);
    table.timestamp('last_used_at');
    table.timestamp('expires_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('sso_configuration_id');
    table.index('token_hash');
    table.index('is_active');
  });

  // 2. SSO Group Mappings table - map IdP groups to app roles
  await knex.schema.createTable('sso_group_mappings', (table) => {
    table.increments('id').primary();
    table.integer('sso_configuration_id').unsigned().notNullable()
      .references('id').inTable('sso_configurations').onDelete('CASCADE');

    table.string('external_group_id', 255).notNullable(); // Group ID from IdP
    table.string('external_group_name', 255); // Group name from IdP
    table.integer('role_id').unsigned().notNullable()
      .references('id').inTable('roles').onDelete('CASCADE');
    table.boolean('is_default').defaultTo(false); // Default mapping for new users
    table.integer('priority').defaultTo(0); // Higher priority wins
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['sso_configuration_id', 'external_group_id']);
    table.index('role_id');
  });

  // 3. SSO Attribute Mappings table - map IdP attributes to user fields
  await knex.schema.createTable('sso_attribute_mappings', (table) => {
    table.increments('id').primary();
    table.integer('sso_configuration_id').unsigned().notNullable()
      .references('id').inTable('sso_configurations').onDelete('CASCADE');

    table.string('source_attribute', 255).notNullable(); // Attribute name from IdP
    table.string('target_field', 100).notNullable(); // User field (email, name, etc.)
    table.string('transform', 50); // Optional: lowercase, uppercase, trim
    table.string('default_value', 255); // Default if attribute missing
    table.boolean('is_required').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['sso_configuration_id', 'target_field']);
    table.index('source_attribute');
  });

  // 4. SSO Analytics table - aggregated SSO usage stats
  await knex.schema.createTable('sso_analytics', (table) => {
    table.increments('id').primary();
    table.integer('sso_configuration_id').unsigned().notNullable()
      .references('id').inTable('sso_configurations').onDelete('CASCADE');

    table.date('date').notNullable();
    table.integer('total_logins').defaultTo(0);
    table.integer('successful_logins').defaultTo(0);
    table.integer('failed_logins').defaultTo(0);
    table.integer('unique_users').defaultTo(0);
    table.integer('new_users_provisioned').defaultTo(0);
    table.decimal('avg_login_time_ms', 10, 2); // Average login time
    table.jsonb('hourly_distribution').defaultTo('{}'); // Logins by hour
    table.jsonb('error_breakdown').defaultTo('{}'); // Error types count
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['sso_configuration_id', 'date']);
    table.index('date');
  });

  // 5. SCIM Sync Logs table - track SCIM provisioning events
  await knex.schema.createTable('scim_sync_logs', (table) => {
    table.increments('id').primary();
    table.integer('sso_configuration_id').unsigned().notNullable()
      .references('id').inTable('sso_configurations').onDelete('CASCADE');

    table.string('operation', 50).notNullable(); // CREATE, UPDATE, DELETE, SYNC
    table.string('resource_type', 50).notNullable(); // User, Group
    table.string('external_id', 255);
    table.integer('user_id').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    table.string('status', 20).notNullable(); // success, failed, skipped
    table.text('error_message');
    table.jsonb('request_data');
    table.jsonb('response_data');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('sso_configuration_id');
    table.index('operation');
    table.index('status');
    table.index('created_at');
  });

  // Add SCIM-related columns to sso_configurations
  await knex.schema.alterTable('sso_configurations', (table) => {
    table.boolean('scim_enabled').defaultTo(false);
    table.string('scim_base_url', 500);
    table.jsonb('scim_settings').defaultTo('{}');
    table.boolean('auto_provision_users').defaultTo(true);
    table.boolean('auto_deprovision_users').defaultTo(false);
    table.boolean('sync_groups').defaultTo(false);
    table.integer('default_role_id').unsigned()
      .references('id').inTable('roles').onDelete('SET NULL');
  });

  // Create updated_at triggers for PostgreSQL
  if (isPostgres) {
    await knex.raw(`
      CREATE TRIGGER update_sso_group_mappings_updated_at
      BEFORE UPDATE ON sso_group_mappings
      FOR EACH ROW EXECUTE FUNCTION update_sso_updated_at();
    `);

    await knex.raw(`
      CREATE TRIGGER update_sso_analytics_updated_at
      BEFORE UPDATE ON sso_analytics
      FOR EACH ROW EXECUTE FUNCTION update_sso_updated_at();
    `);
  }
};

exports.down = async function(knex) {
  const isPostgres = knex.client.config.client === 'pg' || knex.client.config.client === 'postgresql';

  // Drop triggers
  if (isPostgres) {
    await knex.raw('DROP TRIGGER IF EXISTS update_sso_group_mappings_updated_at ON sso_group_mappings');
    await knex.raw('DROP TRIGGER IF EXISTS update_sso_analytics_updated_at ON sso_analytics');
  }

  // Remove columns from sso_configurations
  await knex.schema.alterTable('sso_configurations', (table) => {
    table.dropColumn('scim_enabled');
    table.dropColumn('scim_base_url');
    table.dropColumn('scim_settings');
    table.dropColumn('auto_provision_users');
    table.dropColumn('auto_deprovision_users');
    table.dropColumn('sync_groups');
    table.dropColumn('default_role_id');
  });

  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('scim_sync_logs');
  await knex.schema.dropTableIfExists('sso_analytics');
  await knex.schema.dropTableIfExists('sso_attribute_mappings');
  await knex.schema.dropTableIfExists('sso_group_mappings');
  await knex.schema.dropTableIfExists('scim_tokens');
};
