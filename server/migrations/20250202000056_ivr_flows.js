/**
 * IVR Flows Migration
 * Creates table for storing IVR flow definitions
 */

exports.up = async function(knex) {
  await knex.schema.createTable('ivr_flows', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('organization_id').unsigned().notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.text('description');
    table.string('phone_number', 20);
    table.boolean('is_active').defaultTo(false);
    table.jsonb('flow_data').defaultTo('{}'); // Complete flow definition
    table.jsonb('settings').defaultTo('{}'); // Flow settings (timeout, language, etc.)
    table.string('welcome_message', 500);
    table.string('goodbye_message', 500);
    table.string('error_message', 500);
    table.string('default_language', 10).defaultTo('en');
    table.integer('max_retries').defaultTo(3);
    table.integer('input_timeout').defaultTo(5000); // milliseconds
    table.integer('speech_timeout').defaultTo(3000); // milliseconds
    table.string('voice', 50).defaultTo('Polly.Joanna'); // TTS voice
    table.string('status', 20).defaultTo('draft'); // draft, published, archived
    table.integer('version').defaultTo(1);
    table.integer('call_count').defaultTo(0);
    table.integer('created_by').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    table.integer('updated_by').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.index('organization_id');
    table.index('phone_number');
    table.index('is_active');
    table.index('status');
  });

  // IVR Flow versions for history
  await knex.schema.createTable('ivr_flow_versions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('flow_id').notNullable()
      .references('id').inTable('ivr_flows').onDelete('CASCADE');
    table.integer('version').notNullable();
    table.jsonb('flow_data').notNullable();
    table.jsonb('settings');
    table.text('change_notes');
    table.integer('created_by').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['flow_id', 'version']);
    table.index('flow_id');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('ivr_flow_versions');
  await knex.schema.dropTableIfExists('ivr_flows');
};
