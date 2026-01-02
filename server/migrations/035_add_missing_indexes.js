/**
 * Migration: Add missing database indexes for performance optimization
 */

exports.up = async function(knex) {
  // 1. bot_messages - composite index for bot and date queries
  // Note: organization_id column may not exist in all setups
  const hasBotMessages = await knex.schema.hasTable('bot_messages');
  if (hasBotMessages) {
    const hasOrgColumn = await knex.schema.hasColumn('bot_messages', 'organization_id');
    if (hasOrgColumn) {
      await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_bot_messages_org_bot_created
        ON bot_messages(organization_id, bot_id, created_at)
      `);
    } else {
      // Create simpler index without organization_id
      await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_bot_messages_bot_created
        ON bot_messages(bot_id, created_at)
      `);
    }
  }

  // 2. intents - index for bot's active intents lookup (if table exists)
  const hasIntents = await knex.schema.hasTable('intents');
  if (hasIntents) {
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_intents_bot_active
      ON intents(bot_id, is_active)
    `);
  }

  // 3. sso_domains - index for domain verification lookup (if table exists)
  const hasSsoDomains = await knex.schema.hasTable('sso_domains');
  if (hasSsoDomains) {
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_sso_domains_domain_verified
      ON sso_domains(domain, is_verified)
    `);
  }

  // 4. recovery_events - index for org event type queries (if table exists)
  const hasRecoveryEvents = await knex.schema.hasTable('recovery_events');
  if (hasRecoveryEvents) {
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_recovery_events_org_type
      ON recovery_events(org_id, event_type)
    `);
  }

  // 5. recovery_messages - index for status and sent_at queries (if table exists)
  const hasRecoveryMessages = await knex.schema.hasTable('recovery_messages');
  if (hasRecoveryMessages) {
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_recovery_messages_status
      ON recovery_messages(status, sent_at)
    `);
  }
};

exports.down = async function(knex) {
  // Drop indexes in reverse order
  const hasRecoveryMessages = await knex.schema.hasTable('recovery_messages');
  if (hasRecoveryMessages) {
    await knex.raw('DROP INDEX IF EXISTS idx_recovery_messages_status');
  }

  const hasRecoveryEvents = await knex.schema.hasTable('recovery_events');
  if (hasRecoveryEvents) {
    await knex.raw('DROP INDEX IF EXISTS idx_recovery_events_org_type');
  }

  await knex.raw('DROP INDEX IF EXISTS idx_sso_domains_domain_verified');
  await knex.raw('DROP INDEX IF EXISTS idx_intents_bot_active');
  await knex.raw('DROP INDEX IF EXISTS idx_bot_messages_org_bot_created');
};
