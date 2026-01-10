/**
 * Migration: Add role and plan columns to users table
 */

exports.up = async function(knex) {
  // Check if columns exist before adding
  const hasRole = await knex.schema.hasColumn('users', 'role');
  const hasPlan = await knex.schema.hasColumn('users', 'plan');

  if (!hasRole || !hasPlan) {
    await knex.schema.alterTable('users', (table) => {
      if (!hasRole) {
        table.string('role', 50).defaultTo('user');
      }
      if (!hasPlan) {
        table.string('plan', 50).defaultTo('free');
      }
    });
  }

  // Set first user as admin (usually the owner)
  await knex.raw(`
    UPDATE users SET role = 'admin'
    WHERE id = (SELECT MIN(id) FROM users)
    AND (role IS NULL OR role = 'user')
  `);
};

exports.down = async function(knex) {
  const hasRole = await knex.schema.hasColumn('users', 'role');
  const hasPlan = await knex.schema.hasColumn('users', 'plan');

  if (hasRole || hasPlan) {
    await knex.schema.alterTable('users', (table) => {
      if (hasRole) table.dropColumn('role');
      if (hasPlan) table.dropColumn('plan');
    });
  }
};
