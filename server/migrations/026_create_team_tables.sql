-- Team Collaboration Tables Migration
-- Creates tables for team management, invitations, activity logging, and version control

-- Team Roles table
CREATE TABLE IF NOT EXISTS team_roles (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, name)
);

-- Team Members table
CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES team_roles(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, user_id)
);

-- Team Invitations table
CREATE TABLE IF NOT EXISTS team_invitations (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL REFERENCES team_roles(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Activity Logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INTEGER,
    changes JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Entity Versions table (for version control)
CREATE TABLE IF NOT EXISTS entity_versions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    data JSONB NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    commit_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, entity_type, entity_id, version_number)
);

-- Entity Branches table (for branching support)
CREATE TABLE IF NOT EXISTS entity_branches (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INTEGER NOT NULL,
    branch_name VARCHAR(100) NOT NULL,
    base_version_id INTEGER REFERENCES entity_versions(id) ON DELETE SET NULL,
    is_main BOOLEAN NOT NULL DEFAULT FALSE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, entity_type, entity_id, branch_name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_roles_tenant ON team_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_members_tenant ON team_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_tenant ON team_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant ON activity_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_entity_versions_tenant ON entity_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_entity_versions_entity ON entity_versions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_branches_tenant ON entity_branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_entity_branches_entity ON entity_branches(entity_type, entity_id);

-- Insert default roles for existing organizations
INSERT INTO team_roles (tenant_id, name, permissions, is_default)
SELECT id, 'Owner', '{"all": true}', false FROM organizations
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO team_roles (tenant_id, name, permissions, is_default)
SELECT id, 'Admin', '{"manage_team": true, "manage_bots": true, "manage_workflows": true, "manage_knowledge": true, "view_analytics": true}', false FROM organizations
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO team_roles (tenant_id, name, permissions, is_default)
SELECT id, 'Member', '{"manage_bots": true, "manage_workflows": true, "view_analytics": true}', true FROM organizations
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO team_roles (tenant_id, name, permissions, is_default)
SELECT id, 'Viewer', '{"view_bots": true, "view_workflows": true, "view_analytics": true}', false FROM organizations
ON CONFLICT (tenant_id, name) DO NOTHING;
