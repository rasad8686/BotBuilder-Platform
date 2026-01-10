/**
 * IVR Nodes Migration
 * Creates table for storing individual IVR flow nodes
 */

exports.up = async function(knex) {
  // IVR Nodes
  await knex.schema.createTable('ivr_nodes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('flow_id').notNullable()
      .references('id').inTable('ivr_flows').onDelete('CASCADE');
    table.string('type', 50).notNullable(); // start, menu, input, transfer, hangup, etc.
    table.string('name', 100);
    table.float('position_x').defaultTo(0);
    table.float('position_y').defaultTo(0);
    table.jsonb('config').defaultTo('{}'); // Node-specific configuration
    table.jsonb('connections').defaultTo('[]'); // [{sourceHandle, targetNodeId, targetHandle}]
    table.boolean('is_entry_point').defaultTo(false);
    table.integer('order_index').defaultTo(0);
    table.timestamps(true, true);

    table.index('flow_id');
    table.index('type');
  });

  // IVR Menu Options (for analytics)
  await knex.schema.createTable('ivr_menu_stats', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('flow_id').notNullable()
      .references('id').inTable('ivr_flows').onDelete('CASCADE');
    table.uuid('node_id').notNullable()
      .references('id').inTable('ivr_nodes').onDelete('CASCADE');
    table.string('option_key', 10); // 1, 2, 3, etc.
    table.integer('selection_count').defaultTo(0);
    table.date('date').notNullable();
    table.timestamps(true, true);

    table.unique(['node_id', 'option_key', 'date']);
    table.index('flow_id');
    table.index('node_id');
    table.index('date');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('ivr_menu_stats');
  await knex.schema.dropTableIfExists('ivr_nodes');
};
