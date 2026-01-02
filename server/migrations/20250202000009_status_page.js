/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Service Status table
  await knex.schema.createTable('service_status', (table) => {
    table.increments('id').primary();
    table.string('service_name', 100).notNullable(); // 'api', 'database', 'redis', 'webhooks', 'ai'
    table.string('status', 20).defaultTo('operational'); // 'operational', 'degraded', 'partial_outage', 'major_outage'
    table.integer('response_time_ms');
    table.timestamp('last_check_at');
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique('service_name');
    table.index('status');
  });

  // Incidents table
  await knex.schema.createTable('incidents', (table) => {
    table.increments('id').primary();
    table.string('title', 255).notNullable();
    table.text('description');
    table.string('status', 20).defaultTo('investigating'); // 'investigating', 'identified', 'monitoring', 'resolved'
    table.string('severity', 20).defaultTo('minor'); // 'minor', 'major', 'critical'
    table.jsonb('affected_services').defaultTo('[]'); // ['api', 'database']
    table.timestamp('started_at').defaultTo(knex.fn.now());
    table.timestamp('resolved_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('status');
    table.index('severity');
    table.index('started_at');
  });

  // Incident Updates table
  await knex.schema.createTable('incident_updates', (table) => {
    table.increments('id').primary();
    table.integer('incident_id').unsigned().references('id').inTable('incidents').onDelete('CASCADE');
    table.text('message').notNullable();
    table.string('status', 20);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('incident_id');
    table.index('created_at');
  });

  // Insert default services
  await knex('service_status').insert([
    { service_name: 'api', status: 'operational', response_time_ms: 50, last_check_at: knex.fn.now() },
    { service_name: 'database', status: 'operational', response_time_ms: 10, last_check_at: knex.fn.now() },
    { service_name: 'redis', status: 'operational', response_time_ms: 5, last_check_at: knex.fn.now() },
    { service_name: 'webhooks', status: 'operational', response_time_ms: 100, last_check_at: knex.fn.now() },
    { service_name: 'ai', status: 'operational', response_time_ms: 500, last_check_at: knex.fn.now() }
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('incident_updates');
  await knex.schema.dropTableIfExists('incidents');
  await knex.schema.dropTableIfExists('service_status');
};
