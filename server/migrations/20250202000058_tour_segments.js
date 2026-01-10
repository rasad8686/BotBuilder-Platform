/**
 * Tour Segments Migration
 * Creates table for user segments and targeting
 */

exports.up = async function(knex) {
  // Tour Segments Table
  await knex.schema.createTable('tour_segments', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').unsigned().notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.text('description');
    table.jsonb('rules').defaultTo('{}');
    table.integer('user_count').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);

    table.index('organization_id');
    table.index('is_active');
  });

  // Add targeting_rules column to tours if not exists
  const hasTargetingRules = await knex.schema.hasColumn('tours', 'targeting_rules');
  if (!hasTargetingRules) {
    await knex.schema.alterTable('tours', (table) => {
      table.jsonb('targeting_rules').defaultTo('{}');
    });
  }

  // Add priority column to tours if not exists
  const hasPriority = await knex.schema.hasColumn('tours', 'priority');
  if (!hasPriority) {
    await knex.schema.alterTable('tours', (table) => {
      table.integer('priority').defaultTo(0);
    });
  }

  // Add allow_replay column to tours if not exists
  const hasAllowReplay = await knex.schema.hasColumn('tours', 'allow_replay');
  if (!hasAllowReplay) {
    await knex.schema.alterTable('tours', (table) => {
      table.boolean('allow_replay').defaultTo(false);
    });
  }

  // Tour Targeting Logs Table (for analytics)
  await knex.schema.createTable('tour_targeting_logs', (table) => {
    table.increments('id').primary();
    table.uuid('tour_id')
      .references('id').inTable('tours').onDelete('CASCADE');
    table.integer('user_id').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    table.string('session_id', 100);
    table.boolean('eligible').defaultTo(false);
    table.string('reason', 255);
    table.jsonb('context').defaultTo('{}');
    table.jsonb('checks').defaultTo('[]');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('tour_id');
    table.index('user_id');
    table.index('eligible');
    table.index('created_at');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('tour_targeting_logs');
  await knex.schema.dropTableIfExists('tour_segments');

  // Remove added columns from tours
  const hasTargetingRules = await knex.schema.hasColumn('tours', 'targeting_rules');
  if (hasTargetingRules) {
    await knex.schema.alterTable('tours', (table) => {
      table.dropColumn('targeting_rules');
    });
  }

  const hasPriority = await knex.schema.hasColumn('tours', 'priority');
  if (hasPriority) {
    await knex.schema.alterTable('tours', (table) => {
      table.dropColumn('priority');
    });
  }

  const hasAllowReplay = await knex.schema.hasColumn('tours', 'allow_replay');
  if (hasAllowReplay) {
    await knex.schema.alterTable('tours', (table) => {
      table.dropColumn('allow_replay');
    });
  }
};
