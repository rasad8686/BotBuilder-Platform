exports.up = function(knex) {
  return knex.schema.alterTable('ab_tests', function(table) {
    // Əgər yoxdursa əlavə et
    table.integer('workspace_id').references('id').inTable('workspaces').onDelete('CASCADE');
    table.boolean('auto_winner_enabled').defaultTo(false);
    table.integer('auto_winner_threshold').defaultTo(95);

    // Index əlavə et
    table.index('workspace_id');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('ab_tests', function(table) {
    table.dropColumn('workspace_id');
    table.dropColumn('auto_winner_enabled');
    table.dropColumn('auto_winner_threshold');
  });
};
