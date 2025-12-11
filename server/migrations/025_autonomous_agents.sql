-- Autonomous Agents Migration
-- Phase 1: Base System

-- Autonomous Agents table
CREATE TABLE IF NOT EXISTS autonomous_agents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    capabilities JSONB DEFAULT '[]'::jsonb,
    model VARCHAR(100) DEFAULT 'gpt-4',
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 4096,
    system_prompt TEXT,
    status VARCHAR(50) DEFAULT 'active',
    settings JSONB DEFAULT '{}'::jsonb,
    total_tasks INTEGER DEFAULT 0,
    successful_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Agent Tasks table
CREATE TABLE IF NOT EXISTS agent_tasks (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL REFERENCES autonomous_agents(id) ON DELETE CASCADE,
    task_description TEXT NOT NULL,
    input_data JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'pending',
    result JSONB,
    error_message TEXT,
    total_steps INTEGER DEFAULT 0,
    completed_steps INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    cost DECIMAL(10,6) DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Task Steps table (execution log)
CREATE TABLE IF NOT EXISTS task_steps (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    action VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) DEFAULT 'think',
    input JSONB,
    output JSONB,
    reasoning TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    tokens_used INTEGER DEFAULT 0,
    duration_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_autonomous_agents_user_id ON autonomous_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_autonomous_agents_status ON autonomous_agents(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_id ON agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_created_at ON agent_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_steps_task_id ON task_steps(task_id);
CREATE INDEX IF NOT EXISTS idx_task_steps_step_number ON task_steps(task_id, step_number);

-- Update trigger for autonomous_agents
CREATE OR REPLACE FUNCTION update_autonomous_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_autonomous_agents_updated_at ON autonomous_agents;
CREATE TRIGGER trigger_autonomous_agents_updated_at
    BEFORE UPDATE ON autonomous_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_autonomous_agents_updated_at();
