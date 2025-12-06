-- Channels Tables for WhatsApp, Instagram, Telegram Integration
-- Run this migration to set up messaging channel infrastructure

-- Main channels table
CREATE TABLE IF NOT EXISTS channels (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('whatsapp', 'instagram', 'telegram', 'messenger', 'sms')),
    name VARCHAR(255) NOT NULL,
    credentials JSONB DEFAULT '{}',
    phone_number VARCHAR(50),
    username VARCHAR(255),
    status VARCHAR(50) DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'pending', 'error')),
    webhook_secret VARCHAR(255),
    webhook_url VARCHAR(500),
    api_key VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    business_account_id VARCHAR(255),
    settings JSONB DEFAULT '{}',
    last_sync_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Channel messages table
CREATE TABLE IF NOT EXISTS channel_messages (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    bot_id INTEGER,
    conversation_id VARCHAR(255),
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    from_number VARCHAR(100),
    to_number VARCHAR(100),
    from_name VARCHAR(255),
    message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'sticker', 'template', 'interactive', 'reaction')),
    content TEXT,
    media_url TEXT,
    media_mime_type VARCHAR(100),
    media_filename VARCHAR(255),
    caption TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'received')),
    external_id VARCHAR(255),
    reply_to_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    error_message TEXT,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Channel templates table (for WhatsApp approved templates)
CREATE TABLE IF NOT EXISTS channel_templates (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    category VARCHAR(100) CHECK (category IN ('marketing', 'utility', 'authentication', 'service')),
    content TEXT NOT NULL,
    header_type VARCHAR(50) CHECK (header_type IN ('text', 'image', 'video', 'document', 'none')),
    header_content TEXT,
    footer TEXT,
    buttons JSONB DEFAULT '[]',
    variables JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disabled')),
    external_id VARCHAR(255),
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel_id, name, language)
);

-- Channel webhooks table (for incoming webhook events)
CREATE TABLE IF NOT EXISTS channel_webhooks (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER REFERENCES channels(id) ON DELETE SET NULL,
    channel_type VARCHAR(50),
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    headers JSONB DEFAULT '{}',
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Channel contacts table (for tracking conversations)
CREATE TABLE IF NOT EXISTS channel_contacts (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    external_id VARCHAR(255) NOT NULL,
    phone_number VARCHAR(100),
    username VARCHAR(255),
    display_name VARCHAR(255),
    profile_picture_url TEXT,
    metadata JSONB DEFAULT '{}',
    first_message_at TIMESTAMP,
    last_message_at TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    is_blocked BOOLEAN DEFAULT FALSE,
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel_id, external_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_channels_tenant ON channels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(type);
CREATE INDEX IF NOT EXISTS idx_channels_status ON channels(status);

CREATE INDEX IF NOT EXISTS idx_channel_messages_channel ON channel_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_conversation ON channel_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_direction ON channel_messages(direction);
CREATE INDEX IF NOT EXISTS idx_channel_messages_status ON channel_messages(status);
CREATE INDEX IF NOT EXISTS idx_channel_messages_external ON channel_messages(external_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_created ON channel_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_channel_templates_channel ON channel_templates(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_templates_status ON channel_templates(status);

CREATE INDEX IF NOT EXISTS idx_channel_webhooks_channel ON channel_webhooks(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_webhooks_processed ON channel_webhooks(processed);
CREATE INDEX IF NOT EXISTS idx_channel_webhooks_created ON channel_webhooks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_channel_contacts_channel ON channel_contacts(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_contacts_phone ON channel_contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_channel_contacts_external ON channel_contacts(external_id);

SELECT 'Channels tables created successfully!' as result;
