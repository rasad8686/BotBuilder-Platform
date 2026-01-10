/**
 * IVR Simulation History Migration
 * Stores simulation test results for debugging and analysis
 */

exports.up = async function(knex) {
  await knex.schema.createTable('ivr_simulation_history', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('flow_id').notNullable()
      .references('id').inTable('ivr_flows').onDelete('CASCADE');
    table.string('simulation_id', 100).notNullable();
    table.string('test_number', 20);
    table.string('status', 30);
    table.jsonb('data').defaultTo('{}'); // Full simulation data
    table.integer('duration_ms');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('ended_at');

    table.index('flow_id');
    table.index('simulation_id');
    table.index('created_at');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('ivr_simulation_history');
};
