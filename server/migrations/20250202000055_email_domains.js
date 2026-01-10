/**
 * @fileoverview Email Domains Migration
 * @description Creates table for domain verification (DKIM/SPF/DMARC)
 */

exports.up = function(knex) {
  return knex.schema.createTable('email_domains', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
    table.integer('workspace_id').unsigned().references('id').inTable('workspaces').onDelete('CASCADE');

    // Domain info
    table.string('domain', 255).notNullable();
    table.string('subdomain', 100).defaultTo('mail');
    table.enum('status', ['pending', 'verifying', 'verified', 'failed', 'expired']).defaultTo('pending');

    // DKIM configuration
    table.string('dkim_selector', 100).defaultTo('botbuilder');
    table.text('dkim_private_key'); // Encrypted
    table.text('dkim_public_key');
    table.string('dkim_record_name', 255);
    table.text('dkim_record_value');
    table.boolean('dkim_verified').defaultTo(false);
    table.timestamp('dkim_verified_at');

    // SPF configuration
    table.string('spf_record_value', 500);
    table.boolean('spf_verified').defaultTo(false);
    table.timestamp('spf_verified_at');

    // DMARC configuration
    table.string('dmarc_record_value', 500);
    table.boolean('dmarc_verified').defaultTo(false);
    table.timestamp('dmarc_verified_at');

    // MX configuration
    table.boolean('mx_verified').defaultTo(false);
    table.timestamp('mx_verified_at');

    // Return-Path / Bounce domain
    table.string('return_path_domain', 255);
    table.string('return_path_cname', 255);
    table.boolean('return_path_verified').defaultTo(false);

    // Provider specific
    table.string('provider', 50); // sendgrid, ses, etc.
    table.string('provider_domain_id', 255); // Provider's domain ID
    table.jsonb('provider_dns_records'); // DNS records from provider
    table.jsonb('provider_metadata'); // Additional provider data

    // Verification tracking
    table.integer('verification_attempts').defaultTo(0);
    table.timestamp('last_verification_at');
    table.text('last_verification_error');
    table.timestamp('verified_at');
    table.timestamp('expires_at');

    // Settings
    table.boolean('is_default').defaultTo(false);
    table.boolean('is_active').defaultTo(true);
    table.boolean('auto_verify').defaultTo(true); // Auto-check DNS periodically

    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('organization_id');
    table.index('workspace_id');
    table.index('domain');
    table.index('status');
    table.unique(['organization_id', 'domain']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('email_domains');
};
