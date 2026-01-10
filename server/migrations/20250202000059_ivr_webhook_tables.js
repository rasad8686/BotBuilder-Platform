/**
 * IVR Webhook Tables Migration
 * Creates tables for IVR sessions, recordings, and analytics
 */

exports.up = function(knex) {
  return knex.schema
    // IVR Sessions table
    .createTable('ivr_sessions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('call_sid', 100).notNullable().unique();
      table.string('from_number', 50).notNullable();
      table.string('to_number', 50).notNullable();
      table.enum('direction', ['inbound', 'outbound']).defaultTo('inbound');
      table.string('status', 50).defaultTo('in-progress');
      table.uuid('ivr_flow_id').references('id').inTable('ivr_flows').onDelete('SET NULL');
      table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.string('current_node_id', 100).nullable();
      table.jsonb('variables').defaultTo('{}');
      table.jsonb('caller_info').defaultTo('{}');
      table.jsonb('recordings').defaultTo('[]');
      table.integer('retry_count').defaultTo(0);
      table.integer('duration').defaultTo(0);
      table.string('error_code', 50).nullable();
      table.text('error_message').nullable();
      table.timestamp('started_at').nullable();
      table.timestamp('ended_at').nullable();
      table.timestamps(true, true);

      table.index('call_sid');
      table.index('organization_id');
      table.index('ivr_flow_id');
      table.index('status');
      table.index('created_at');
    })

    // IVR Recordings table
    .createTable('ivr_recordings', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('session_id').notNullable().references('id').inTable('ivr_sessions').onDelete('CASCADE');
      table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.string('recording_sid', 100).notNullable();
      table.text('recording_url').nullable();
      table.string('local_path', 500).nullable();
      table.integer('duration').defaultTo(0);
      table.string('status', 50).defaultTo('completed');
      table.string('transcription_sid', 100).nullable();
      table.text('transcription_text').nullable();
      table.string('transcription_status', 50).nullable();
      table.jsonb('metadata').defaultTo('{}');
      table.timestamps(true, true);

      table.index('session_id');
      table.index('organization_id');
      table.index('recording_sid');
    })

    // IVR Analytics table
    .createTable('ivr_analytics', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('session_id').notNullable().references('id').inTable('ivr_sessions').onDelete('CASCADE');
      table.string('event', 100).notNullable();
      table.jsonb('data').defaultTo('{}');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('session_id');
      table.index('event');
      table.index('created_at');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('ivr_analytics')
    .dropTableIfExists('ivr_recordings')
    .dropTableIfExists('ivr_sessions');
};
