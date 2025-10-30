-- Migration: Create bot_flows table for visual flow builder
-- This table stores the visual flow configuration for bots
-- Each bot can have multiple versions of flows

CREATE TABLE IF NOT EXISTS bot_flows (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  flow_data JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bot_id, version)
);

-- Create indexes for better query performance
CREATE INDEX idx_bot_flows_bot_id ON bot_flows(bot_id);
CREATE INDEX idx_bot_flows_active ON bot_flows(is_active);

-- Comments for documentation
COMMENT ON TABLE bot_flows IS 'Stores visual flow configurations for bots';
COMMENT ON COLUMN bot_flows.flow_data IS 'JSONB object containing the visual flow structure (nodes, edges, etc.)';
COMMENT ON COLUMN bot_flows.version IS 'Version number for flow history tracking';
COMMENT ON COLUMN bot_flows.is_active IS 'Indicates if this is the currently active flow for the bot';
