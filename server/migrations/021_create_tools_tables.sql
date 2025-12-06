-- Migration: Create tools tables for Tool Calling / Function Calling system
-- Date: 2025-01-29

-- Tools table - stores tool definitions
CREATE TABLE tools (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  tool_type VARCHAR(50) NOT NULL, -- 'http_request', 'database_query', 'code_execution', 'custom'
  configuration JSONB NOT NULL DEFAULT '{}',
  input_schema JSONB, -- JSON Schema for input parameters
  output_schema JSONB, -- JSON Schema for output
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Agent-Tool relationship table
CREATE TABLE agent_tools (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
  tool_id INTEGER REFERENCES tools(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(agent_id, tool_id)
);

-- Tool execution history table
CREATE TABLE tool_executions (
  id SERIAL PRIMARY KEY,
  tool_id INTEGER REFERENCES tools(id) ON DELETE CASCADE,
  agent_id INTEGER REFERENCES agents(id),
  execution_id INTEGER REFERENCES workflow_executions(id),
  input JSONB,
  output JSONB,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_tools_bot_id ON tools(bot_id);
CREATE INDEX idx_tools_tool_type ON tools(tool_type);
CREATE INDEX idx_tools_is_active ON tools(is_active);
CREATE INDEX idx_agent_tools_agent_id ON agent_tools(agent_id);
CREATE INDEX idx_agent_tools_tool_id ON agent_tools(tool_id);
CREATE INDEX idx_tool_executions_tool_id ON tool_executions(tool_id);
CREATE INDEX idx_tool_executions_agent_id ON tool_executions(agent_id);
CREATE INDEX idx_tool_executions_execution_id ON tool_executions(execution_id);
CREATE INDEX idx_tool_executions_status ON tool_executions(status);
CREATE INDEX idx_tool_executions_created_at ON tool_executions(created_at);
