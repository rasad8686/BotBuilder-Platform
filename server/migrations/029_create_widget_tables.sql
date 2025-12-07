-- Migration: Create widget tables for embeddable chat widget
-- Date: 2025-12-07

-- Widget configurations table
CREATE TABLE IF NOT EXISTS widget_configs (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE UNIQUE,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Widget messages table
CREATE TABLE IF NOT EXISTS widget_messages (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
  session_id VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL, -- 'user', 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_widget_configs_bot_id ON widget_configs(bot_id);
CREATE INDEX idx_widget_messages_bot_id ON widget_messages(bot_id);
CREATE INDEX idx_widget_messages_session_id ON widget_messages(session_id);
CREATE INDEX idx_widget_messages_created_at ON widget_messages(created_at);
