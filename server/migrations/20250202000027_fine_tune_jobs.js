/**
 * Migration: Fine-tune jobs table for OpenAI fine-tuning
 */

exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('fine_tune_jobs');
  if (exists) return;

  return knex.schema.createTable('fine_tune_jobs', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.integer('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.integer('bot_id').references('id').inTable('bots').onDelete('SET NULL');

    // OpenAI Fine-tune
    table.string('openai_job_id', 255);
    table.string('model', 100);
    table.string('base_model', 100);

    // Status: 'pending', 'validating', 'queued', 'running', 'succeeded', 'failed', 'cancelled'
    table.string('status', 50).defaultTo('pending');

    // Training data
    table.string('training_file_id', 255);
    table.string('validation_file_id', 255);
    table.text('training_file_url');

    // Results
    table.string('fine_tuned_model', 255);
    table.integer('trained_tokens');
    table.jsonb('result_files');

    // Config: { n_epochs, batch_size, learning_rate_multiplier }
    table.jsonb('hyperparameters');

    // Error handling
    table.text('error_message');

    // Timestamps
    table.timestamp('started_at');
    table.timestamp('completed_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('organization_id', 'idx_fine_tune_jobs_org');
    table.index('status', 'idx_fine_tune_jobs_status');
    table.index('openai_job_id', 'idx_fine_tune_jobs_openai');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('fine_tune_jobs');
};
