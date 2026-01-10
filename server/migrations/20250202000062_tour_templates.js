/**
 * Tour Templates & Themes Migration
 *
 * Creates tables for:
 * - tour_templates: Reusable tour templates
 * - tour_themes: Custom tour themes/styling
 */

exports.up = async function(knex) {
  // Tour Templates Table
  await knex.schema.createTable('tour_templates', (table) => {
    table.increments('id').primary();
    table.integer('organization_id')
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.text('description');
    table.string('category', 50).defaultTo('onboarding'); // onboarding, feature, announcement, survey
    table.jsonb('steps').defaultTo('[]');
    table.jsonb('settings').defaultTo('{}');
    table.boolean('is_system').defaultTo(false);
    table.string('thumbnail_url', 500);
    table.integer('use_count').defaultTo(0);
    table.timestamps(true, true);

    table.index('organization_id');
    table.index('category');
    table.index('is_system');
    table.index('use_count');
  });

  // Tour Themes Table
  await knex.schema.createTable('tour_themes', (table) => {
    table.increments('id').primary();
    table.integer('organization_id')
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.text('description');
    table.boolean('is_system').defaultTo(false);
    table.jsonb('colors').defaultTo('{}');
    table.jsonb('typography').defaultTo('{}');
    table.jsonb('styling').defaultTo('{}');
    table.jsonb('animation').defaultTo('{}');
    table.timestamps(true, true);

    table.index('organization_id');
    table.index('is_system');
  });

  // Add theme column to tours if not exists
  const hasTheme = await knex.schema.hasColumn('tours', 'theme');
  if (!hasTheme) {
    await knex.schema.alterTable('tours', (table) => {
      table.jsonb('theme').defaultTo('{}');
    });
  }

  // Add template_id column to tours for tracking which template was used
  const hasTemplateId = await knex.schema.hasColumn('tours', 'template_id');
  if (!hasTemplateId) {
    await knex.schema.alterTable('tours', (table) => {
      table.integer('template_id')
        .references('id').inTable('tour_templates').onDelete('SET NULL');
    });
  }
};

exports.down = async function(knex) {
  // Remove columns from tours
  const hasTemplateId = await knex.schema.hasColumn('tours', 'template_id');
  if (hasTemplateId) {
    await knex.schema.alterTable('tours', (table) => {
      table.dropColumn('template_id');
    });
  }

  const hasTheme = await knex.schema.hasColumn('tours', 'theme');
  if (hasTheme) {
    await knex.schema.alterTable('tours', (table) => {
      table.dropColumn('theme');
    });
  }

  await knex.schema.dropTableIfExists('tour_themes');
  await knex.schema.dropTableIfExists('tour_templates');
};
