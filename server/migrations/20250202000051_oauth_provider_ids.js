/**
 * Migration: Add OAuth Provider IDs to users table
 * Adds google_id and microsoft_id columns for OAuth authentication
 */

exports.up = async function(knex) {
  // Check if columns exist before adding
  const hasGoogleId = await knex.schema.hasColumn('users', 'google_id');
  const hasMicrosoftId = await knex.schema.hasColumn('users', 'microsoft_id');

  if (!hasGoogleId || !hasMicrosoftId) {
    await knex.schema.alterTable('users', (table) => {
      if (!hasGoogleId) {
        table.string('google_id').nullable().unique();
      }
      if (!hasMicrosoftId) {
        table.string('microsoft_id').nullable().unique();
      }
    });
  }

  // Add indexes for faster lookup
  const indexExists = await knex.schema.raw(`
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'users' AND indexname = 'idx_users_google_id'
  `);

  if (indexExists.rows.length === 0) {
    await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL');
  }

  const msIndexExists = await knex.schema.raw(`
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'users' AND indexname = 'idx_users_microsoft_id'
  `);

  if (msIndexExists.rows.length === 0) {
    await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_users_microsoft_id ON users(microsoft_id) WHERE microsoft_id IS NOT NULL');
  }

  console.log('✅ OAuth provider ID columns added to users table');
};

exports.down = async function(knex) {
  // Drop indexes first
  await knex.schema.raw('DROP INDEX IF EXISTS idx_users_google_id');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_users_microsoft_id');

  // Remove columns
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('google_id');
    table.dropColumn('microsoft_id');
  });

  console.log('✅ OAuth provider ID columns removed from users table');
};
