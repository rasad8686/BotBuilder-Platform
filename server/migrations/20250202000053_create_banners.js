/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Tablo 1: banners
  await knex.schema.createTable('banners', (table) => {
    table.increments('id').primary();
    table.string('title', 255).notNullable();
    table.text('message').notNullable();
    table.string('type', 20).defaultTo('info'); // info, warning, success, error, promo
    table.string('bg_color', 20).nullable(); // custom rəng
    table.string('text_color', 20).nullable();
    table.string('link_url', 500).nullable();
    table.string('link_text', 100).nullable();
    table.string('target_audience', 20).defaultTo('all'); // all, free, paid, trial
    table.timestamp('start_date').defaultTo(knex.fn.now());
    table.timestamp('end_date').nullable();
    table.boolean('is_dismissible').defaultTo(true);
    table.boolean('is_active').defaultTo(true);
    table.integer('priority').defaultTo(0);
    table.integer('organization_id').nullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.integer('created_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamps(true, true); // created_at, updated_at
  });

  // Tablo 2: banner_dismissals
  await knex.schema.createTable('banner_dismissals', (table) => {
    table.increments('id').primary();
    table.integer('banner_id').notNullable().references('id').inTable('banners').onDelete('CASCADE');
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('dismissed_at').defaultTo(knex.fn.now());
    table.unique(['banner_id', 'user_id']);
  });

  // Index-lər performans üçün
  await knex.schema.alterTable('banners', (table) => {
    table.index(['is_active', 'start_date', 'end_date'], 'idx_banners_active_dates');
    table.index(['organization_id'], 'idx_banners_organization');
    table.index(['target_audience'], 'idx_banners_audience');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('banner_dismissals');
  await knex.schema.dropTableIfExists('banners');
};
