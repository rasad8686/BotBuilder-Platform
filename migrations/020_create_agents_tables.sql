-- Migration: Create agents tables for Multi-Agent AI system
-- Run this migration to enable the multi-agent functionality

-- 1. agents - AI agent definitions
CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    system_prompt TEXT NOT NULL,
    model_provider VARCHAR(50) NOT NULL DEFAULT 'openai',
    model_name VARCHAR(100) NOT NULL DEFAULT 'gpt-4o-mini',
    temperature DECIMAL(3, 2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 2048,
    capabilities JSONB DEFAULT '[]',
    tools JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agents_bot_id ON agents(bot_id);
CREATE INDEX IF NOT EXISTS idx_agents_org_id ON agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_agents_role ON agents(role);
CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(bot_id, is_active);

-- 2. agent_workflows - workflow configurations
CREATE TABLE IF NOT EXISTS agent_workflows (
    id SERIAL PRIMARY KEY,
    bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    workflow_type VARCHAR(50) NOT NULL DEFAULT 'sequential',
    agents_config JSONB NOT NULL DEFAULT '[]',
    flow_config JSONB NOT NULL DEFAULT '{}',
    entry_agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflows_bot_id ON agent_workflows(bot_id);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON agent_workflows(bot_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_default ON agent_workflows(is_default);

-- 3. workflow_executions - execution logs
CREATE TABLE IF NOT EXISTS workflow_executions (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES agent_workflows(id) ON DELETE CASCADE,
    bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    input JSONB NOT NULL DEFAULT '{}',
    output JSONB DEFAULT '{}',
    total_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 6) DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_bot_id ON workflow_executions(bot_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_created ON workflow_executions(created_at);

-- 4. agent_execution_steps - individual agent steps
CREATE TABLE IF NOT EXISTS agent_execution_steps (
    id SERIAL PRIMARY KEY,
    execution_id INTEGER REFERENCES workflow_executions(id) ON DELETE CASCADE,
    agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    input JSONB NOT NULL DEFAULT '{}',
    output JSONB DEFAULT '{}',
    reasoning TEXT,
    tokens_used INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_steps_execution_id ON agent_execution_steps(execution_id);
CREATE INDEX IF NOT EXISTS idx_steps_agent_id ON agent_execution_steps(agent_id);
CREATE INDEX IF NOT EXISTS idx_steps_order ON agent_execution_steps(step_order);

-- 5. agent_messages - agent-to-agent messages
CREATE TABLE IF NOT EXISTS agent_messages (
    id SERIAL PRIMARY KEY,
    execution_id INTEGER REFERENCES workflow_executions(id) ON DELETE CASCADE,
    from_agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    to_agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    message_type VARCHAR(50) NOT NULL DEFAULT 'data',
    content JSONB NOT NULL DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_execution_id ON agent_messages(execution_id);
CREATE INDEX IF NOT EXISTS idx_messages_from_agent ON agent_messages(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_to_agent ON agent_messages(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_type ON agent_messages(message_type);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Multi-Agent AI tables created successfully!';
END $$;
