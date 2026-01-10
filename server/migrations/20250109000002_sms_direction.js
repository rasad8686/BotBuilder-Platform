/**
 * Add direction column to sms_logs for 2-way SMS
 */

exports.up = function(knex) {
  return knex.schema.alterTable('sms_logs', (table) => {
    table.enum('direction', ['outbound', 'inbound']).defaultTo('outbound').after('from_number');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('sms_logs', (table) => {
    table.dropColumn('direction');
  });
};
