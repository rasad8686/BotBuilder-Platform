exports.up = function(knex) {
  return knex.schema.alterTable('email_campaigns', function(table) {
    table.specificType('exclude_list_ids', 'uuid[]').defaultTo('{}');
    table.string('send_to', 50).defaultTo('all');
    table.boolean('use_template').defaultTo(false);
    table.string('schedule_type', 30).defaultTo('immediate');
    table.boolean('optimal_time').defaultTo(false);
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('email_campaigns', function(table) {
    table.dropColumn('exclude_list_ids');
    table.dropColumn('send_to');
    table.dropColumn('use_template');
    table.dropColumn('schedule_type');
    table.dropColumn('optimal_time');
  });
};
