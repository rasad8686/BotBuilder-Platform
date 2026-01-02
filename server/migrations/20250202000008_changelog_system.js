/**
 * Migration: Changelog System
 *
 * Creates tables for changelog/release notes:
 * - changelog_entries: Main changelog versions
 * - changelog_items: Individual items within a changelog entry
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('changelog_entries', (table) => {
      table.increments('id').primary();
      table.string('version', 20).notNullable(); // '2.1.0', '2.0.5'
      table.string('title', 255).notNullable();
      table.text('description').nullable();
      table.string('type', 20).nullable(); // 'feature', 'improvement', 'bugfix', 'breaking', 'security', 'deprecated'
      table.string('category', 50).nullable(); // 'api', 'dashboard', 'sdk', 'billing', 'security'
      table.boolean('is_breaking').defaultTo(false);
      table.boolean('is_published').defaultTo(false);
      table.timestamp('published_at').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      // Indexes
      table.index('version', 'idx_changelog_version');
      table.index('is_published', 'idx_changelog_published');
      table.index('type', 'idx_changelog_type');
      table.index('published_at', 'idx_changelog_published_at');
    })
    .then(() => {
      return knex.schema.createTable('changelog_items', (table) => {
        table.increments('id').primary();
        table.integer('changelog_entry_id').unsigned().notNullable()
          .references('id').inTable('changelog_entries').onDelete('CASCADE');
        table.text('content').notNullable();
        table.string('api_endpoint', 255).nullable(); // related endpoint
        table.timestamp('created_at').defaultTo(knex.fn.now());

        // Indexes
        table.index('changelog_entry_id', 'idx_changelog_items_entry');
      });
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('changelog_items')
    .then(() => {
      return knex.schema.dropTableIfExists('changelog_entries');
    });
};
