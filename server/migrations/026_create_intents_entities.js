const db = require('../db');
const log = require('../utils/logger');

async function up() {
  await db.query(`
    -- Intents table
    CREATE TABLE IF NOT EXISTS intents (
      id SERIAL PRIMARY KEY,
      bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      display_name VARCHAR(200),
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      confidence_threshold DECIMAL(3,2) DEFAULT 0.70,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Intent examples table
    CREATE TABLE IF NOT EXISTS intent_examples (
      id SERIAL PRIMARY KEY,
      intent_id INTEGER NOT NULL REFERENCES intents(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      language VARCHAR(10) DEFAULT 'az',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Entities table
    CREATE TABLE IF NOT EXISTS entities (
      id SERIAL PRIMARY KEY,
      bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      display_name VARCHAR(200),
      type VARCHAR(50) NOT NULL DEFAULT 'text',
      is_system BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Entity values table
    CREATE TABLE IF NOT EXISTS entity_values (
      id SERIAL PRIMARY KEY,
      entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      value VARCHAR(200) NOT NULL,
      synonyms JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for intents
    CREATE INDEX IF NOT EXISTS idx_intents_bot_id ON intents(bot_id);
    CREATE INDEX IF NOT EXISTS idx_intents_name ON intents(name);

    -- Index for intent_examples
    CREATE INDEX IF NOT EXISTS idx_intent_examples_intent_id ON intent_examples(intent_id);

    -- Indexes for entities
    CREATE INDEX IF NOT EXISTS idx_entities_bot_id ON entities(bot_id);
    CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);

    -- Index for entity_values
    CREATE INDEX IF NOT EXISTS idx_entity_values_entity_id ON entity_values(entity_id);
  `);

  log.info('Migration 026: Created intents and entities tables');
}

async function down() {
  await db.query(`
    DROP TABLE IF EXISTS entity_values;
    DROP TABLE IF EXISTS entities;
    DROP TABLE IF EXISTS intent_examples;
    DROP TABLE IF EXISTS intents;
  `);

  log.info('Migration 026: Dropped intents and entities tables');
}

module.exports = { up, down };

// Run migration directly
if (require.main === module) {
  up()
    .then(() => {
      log.info('Migration completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      log.error('Migration failed', { error: err.message });
      process.exit(1);
    });
}
