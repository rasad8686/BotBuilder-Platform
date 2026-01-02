/**
 * Migration: Custom Domains System
 * Allows organizations to use custom domains for widget, API, and portal
 */

exports.up = async function(knex) {
  // Create custom_domains table
  await knex.schema.createTable('custom_domains', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
    table.string('domain', 255).notNullable().unique();
    table.string('subdomain', 100); // for *.botbuilder.com
    table.string('type', 20).defaultTo('widget'); // 'widget', 'api', 'portal'
    table.string('status', 20).defaultTo('pending'); // 'pending', 'verifying', 'active', 'failed'

    // SSL
    table.string('ssl_status', 20).defaultTo('pending'); // 'pending', 'issued', 'expired'
    table.timestamp('ssl_expires_at');
    table.text('ssl_certificate'); // PEM encoded certificate
    table.text('ssl_private_key'); // PEM encoded private key (encrypted)

    // DNS verification
    table.string('verification_token', 255);
    table.string('verification_method', 20).defaultTo('cname'); // 'cname', 'txt'
    table.timestamp('verified_at');
    table.string('verification_error', 500);

    // Metadata
    table.jsonb('settings').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('organization_id');
    table.index('domain');
    table.index('status');
    table.index('ssl_status');
  });

  // Create domain_verification_logs table for tracking verification attempts
  await knex.schema.createTable('domain_verification_logs', (table) => {
    table.increments('id').primary();
    table.integer('domain_id').unsigned().references('id').inTable('custom_domains').onDelete('CASCADE');
    table.string('verification_type', 20); // 'dns', 'ssl'
    table.boolean('success').defaultTo(false);
    table.text('details');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('domain_id');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('domain_verification_logs');
  await knex.schema.dropTableIfExists('custom_domains');
};
