/**
 * Facebook Channels Database Migration
 * Tables for Facebook Messenger integration
 */

const db = require('../db');

async function up() {
  // Facebook Pages - Connected page accounts
  await db.query(`
    CREATE TABLE IF NOT EXISTS facebook_pages (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      page_id VARCHAR(100) NOT NULL UNIQUE,
      page_name VARCHAR(255),
      access_token TEXT NOT NULL,
      bot_id INTEGER REFERENCES bots(id) ON DELETE SET NULL,
      welcome_message TEXT,
      default_response TEXT,
      settings JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      webhook_subscribed BOOLEAN DEFAULT false,
      last_webhook_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Facebook Conversations - Chat sessions with users
  await db.query(`
    CREATE TABLE IF NOT EXISTS facebook_conversations (
      id SERIAL PRIMARY KEY,
      facebook_page_id INTEGER REFERENCES facebook_pages(id) ON DELETE CASCADE,
      page_id VARCHAR(100) NOT NULL,
      sender_id VARCHAR(100) NOT NULL,
      user_first_name VARCHAR(100),
      user_last_name VARCHAR(100),
      user_profile_pic TEXT,
      user_locale VARCHAR(20),
      user_timezone INTEGER,
      status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'blocked', 'archived')),
      referral_ref VARCHAR(255),
      referral_source VARCHAR(50),
      referral_ad_id VARCHAR(100),
      labels JSONB DEFAULT '[]',
      custom_data JSONB DEFAULT '{}',
      message_count INTEGER DEFAULT 0,
      last_activity_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(page_id, sender_id)
    )
  `);

  // Facebook Messages - Individual messages in conversations
  await db.query(`
    CREATE TABLE IF NOT EXISTS facebook_messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER REFERENCES facebook_conversations(id) ON DELETE CASCADE,
      message_id VARCHAR(255) UNIQUE,
      direction VARCHAR(20) NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
      type VARCHAR(50) NOT NULL DEFAULT 'text',
      content TEXT,
      payload JSONB DEFAULT '{}',
      quick_reply_payload VARCHAR(255),
      attachments JSONB DEFAULT '[]',
      reaction VARCHAR(50),
      reaction_emoji VARCHAR(10),
      delivered_at TIMESTAMP,
      read_at TIMESTAMP,
      error_code VARCHAR(50),
      error_message TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Facebook Broadcasts - Broadcast messages
  await db.query(`
    CREATE TABLE IF NOT EXISTS facebook_broadcasts (
      id SERIAL PRIMARY KEY,
      facebook_page_id INTEGER REFERENCES facebook_pages(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      message_creative_id VARCHAR(100),
      broadcast_id VARCHAR(100),
      status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed')),
      message_content JSONB NOT NULL,
      target_labels JSONB DEFAULT '[]',
      scheduled_at TIMESTAMP,
      sent_at TIMESTAMP,
      reach_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      created_by INTEGER REFERENCES users(id)
    )
  `);

  // Facebook Labels - Custom labels for user segmentation
  await db.query(`
    CREATE TABLE IF NOT EXISTS facebook_labels (
      id SERIAL PRIMARY KEY,
      facebook_page_id INTEGER REFERENCES facebook_pages(id) ON DELETE CASCADE,
      label_id VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      user_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(facebook_page_id, label_id)
    )
  `);

  // Facebook User Labels - Association between users and labels
  await db.query(`
    CREATE TABLE IF NOT EXISTS facebook_user_labels (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER REFERENCES facebook_conversations(id) ON DELETE CASCADE,
      label_id INTEGER REFERENCES facebook_labels(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(conversation_id, label_id)
    )
  `);

  // Facebook Automations - Automated responses
  await db.query(`
    CREATE TABLE IF NOT EXISTS facebook_automations (
      id SERIAL PRIMARY KEY,
      facebook_page_id INTEGER REFERENCES facebook_pages(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('keyword', 'postback', 'referral', 'first_message')),
      trigger_value VARCHAR(255),
      response_type VARCHAR(50) NOT NULL DEFAULT 'text',
      response_content JSONB NOT NULL,
      is_active BOOLEAN DEFAULT true,
      priority INTEGER DEFAULT 0,
      usage_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Facebook Analytics - Daily aggregated stats
  await db.query(`
    CREATE TABLE IF NOT EXISTS facebook_analytics (
      id SERIAL PRIMARY KEY,
      facebook_page_id INTEGER REFERENCES facebook_pages(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      new_conversations INTEGER DEFAULT 0,
      active_conversations INTEGER DEFAULT 0,
      messages_received INTEGER DEFAULT 0,
      messages_sent INTEGER DEFAULT 0,
      unique_users INTEGER DEFAULT 0,
      avg_response_time_ms INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(facebook_page_id, date)
    )
  `);

  // Create indexes
  await db.query(`CREATE INDEX IF NOT EXISTS idx_facebook_pages_user ON facebook_pages(user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_facebook_pages_org ON facebook_pages(organization_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_facebook_pages_page_id ON facebook_pages(page_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_facebook_pages_bot ON facebook_pages(bot_id)`);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_facebook_conversations_page ON facebook_conversations(facebook_page_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_facebook_conversations_sender ON facebook_conversations(sender_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_facebook_conversations_page_sender ON facebook_conversations(page_id, sender_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_facebook_conversations_status ON facebook_conversations(status)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_facebook_conversations_activity ON facebook_conversations(last_activity_at)`);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_facebook_messages_conversation ON facebook_messages(conversation_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_facebook_messages_message_id ON facebook_messages(message_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_facebook_messages_direction ON facebook_messages(direction)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_facebook_messages_created ON facebook_messages(created_at)`);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_facebook_broadcasts_page ON facebook_broadcasts(facebook_page_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_facebook_broadcasts_status ON facebook_broadcasts(status)`);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_facebook_analytics_page_date ON facebook_analytics(facebook_page_id, date)`);

  console.log('Facebook channels migration completed successfully');
}

async function down() {
  await db.query(`DROP TABLE IF EXISTS facebook_analytics CASCADE`);
  await db.query(`DROP TABLE IF EXISTS facebook_automations CASCADE`);
  await db.query(`DROP TABLE IF EXISTS facebook_user_labels CASCADE`);
  await db.query(`DROP TABLE IF EXISTS facebook_labels CASCADE`);
  await db.query(`DROP TABLE IF EXISTS facebook_broadcasts CASCADE`);
  await db.query(`DROP TABLE IF EXISTS facebook_messages CASCADE`);
  await db.query(`DROP TABLE IF EXISTS facebook_conversations CASCADE`);
  await db.query(`DROP TABLE IF EXISTS facebook_pages CASCADE`);

  console.log('Facebook channels migration rolled back');
}

module.exports = { up, down };
