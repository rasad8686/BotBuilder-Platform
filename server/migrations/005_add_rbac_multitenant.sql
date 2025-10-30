-- =====================================================
-- RBAC + Multi-Tenant Architecture Migration
-- Version: 005
-- Description: Add organizations, roles, and multi-tenancy support
-- =====================================================

-- =====================================================
-- STEP 1: CREATE ROLES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- =====================================================
-- STEP 2: CREATE ORGANIZATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    plan_tier VARCHAR(50) DEFAULT 'free',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations(owner_id);

-- =====================================================
-- STEP 3: CREATE ORGANIZATION_MEMBERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS organization_members (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',
    UNIQUE(org_id, user_id),
    CONSTRAINT valid_role CHECK (role IN ('admin', 'member', 'viewer'))
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_status ON organization_members(status);

-- =====================================================
-- STEP 4: SEED ROLES TABLE
-- =====================================================
INSERT INTO roles (name, description, permissions) VALUES
('admin', 'Full administrative access',
 '{
   "bots": ["create", "read", "update", "delete"],
   "messages": ["create", "read", "update", "delete"],
   "flows": ["create", "read", "update", "delete"],
   "organization": ["read", "update", "invite", "remove_members"],
   "api_tokens": ["create", "read", "delete"]
 }'::JSONB),
('member', 'Can create and manage bots',
 '{
   "bots": ["create", "read", "update", "delete"],
   "messages": ["create", "read", "update", "delete"],
   "flows": ["create", "read", "update", "delete"],
   "organization": ["read"],
   "api_tokens": ["create", "read", "delete"]
 }'::JSONB),
('viewer', 'Read-only access',
 '{
   "bots": ["read"],
   "messages": ["read"],
   "flows": ["read"],
   "organization": ["read"],
   "api_tokens": []
 }'::JSONB)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- STEP 5: ADD ORGANIZATION_ID TO BOTS TABLE
-- =====================================================
-- Add column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bots' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE bots ADD COLUMN organization_id INTEGER;
    END IF;
END $$;

-- =====================================================
-- STEP 6: ADD ORGANIZATION_ID TO BOT_MESSAGES TABLE
-- =====================================================
-- Add column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bot_messages' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE bot_messages ADD COLUMN organization_id INTEGER;
    END IF;
END $$;

-- =====================================================
-- STEP 7: ADD ORGANIZATION_ID TO API_TOKENS TABLE (IF EXISTS)
-- =====================================================
-- Add column if table and column don't exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_tokens') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'api_tokens' AND column_name = 'organization_id'
        ) THEN
            ALTER TABLE api_tokens ADD COLUMN organization_id INTEGER;
        END IF;
    END IF;
END $$;

-- =====================================================
-- STEP 8: DATA MIGRATION - CREATE PERSONAL ORGANIZATIONS
-- =====================================================
-- Create a personal organization for each existing user
INSERT INTO organizations (name, slug, owner_id, plan_tier, settings)
SELECT
    COALESCE(u.name, 'User ' || u.id) || '''s Organization',
    LOWER(REGEXP_REPLACE(COALESCE(u.name, 'user-' || u.id), '[^a-zA-Z0-9]', '-', 'g')) || '-' || u.id,
    u.id,
    'free',
    '{}'::JSONB
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM organizations o WHERE o.owner_id = u.id
);

-- =====================================================
-- STEP 9: ADD USERS AS ADMINS TO THEIR ORGANIZATIONS
-- =====================================================
-- Add each user as admin to their personal organization
INSERT INTO organization_members (org_id, user_id, role, status, joined_at)
SELECT
    o.id,
    o.owner_id,
    'admin',
    'active',
    NOW()
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.org_id = o.id AND om.user_id = o.owner_id
);

-- =====================================================
-- STEP 10: MIGRATE EXISTING BOTS TO ORGANIZATIONS
-- =====================================================
-- Move all existing bots to their owner's personal organization
UPDATE bots b
SET organization_id = o.id
FROM organizations o
WHERE b.user_id = o.owner_id
  AND b.organization_id IS NULL;

-- =====================================================
-- STEP 11: MIGRATE EXISTING BOT_MESSAGES TO ORGANIZATIONS
-- =====================================================
-- Move all existing bot_messages to the bot's organization
UPDATE bot_messages m
SET organization_id = b.organization_id
FROM bots b
WHERE m.bot_id = b.id
  AND m.organization_id IS NULL;

-- =====================================================
-- STEP 12: MIGRATE EXISTING API_TOKENS TO ORGANIZATIONS (IF TABLE EXISTS)
-- =====================================================
-- Move all existing api tokens to user's organization
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_tokens') THEN
        EXECUTE '
            UPDATE api_tokens a
            SET organization_id = o.id
            FROM organizations o
            WHERE a.user_id = o.owner_id
              AND a.organization_id IS NULL
        ';
    END IF;
END $$;

-- =====================================================
-- STEP 13: ADD FOREIGN KEY CONSTRAINTS
-- =====================================================
-- Add FK constraint to bots.organization_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'bots_organization_id_fkey' AND table_name = 'bots'
    ) THEN
        ALTER TABLE bots
        ADD CONSTRAINT bots_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add FK constraint to bot_messages.organization_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'bot_messages_organization_id_fkey' AND table_name = 'bot_messages'
    ) THEN
        ALTER TABLE bot_messages
        ADD CONSTRAINT bot_messages_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add FK constraint to api_tokens.organization_id (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_tokens') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'api_tokens_organization_id_fkey' AND table_name = 'api_tokens'
        ) THEN
            EXECUTE '
                ALTER TABLE api_tokens
                ADD CONSTRAINT api_tokens_organization_id_fkey
                FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            ';
        END IF;
    END IF;
END $$;

-- =====================================================
-- STEP 14: CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_bots_organization_id ON bots(organization_id);
CREATE INDEX IF NOT EXISTS idx_bot_messages_organization_id ON bot_messages(organization_id);

-- Create index for api_tokens if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_tokens') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_api_tokens_organization_id ON api_tokens(organization_id)';
    END IF;
END $$;

-- =====================================================
-- STEP 15: CLEANUP - HANDLE ANY REMAINING NULL VALUES
-- =====================================================
-- Delete any bots that still have NULL organization_id (orphaned bots)
DELETE FROM bots WHERE organization_id IS NULL;

-- Delete any bot_messages that still have NULL organization_id (orphaned messages)
DELETE FROM bot_messages WHERE organization_id IS NULL;

-- Delete any api_tokens that still have NULL organization_id (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_tokens') THEN
        EXECUTE 'DELETE FROM api_tokens WHERE organization_id IS NULL';
    END IF;
END $$;

-- =====================================================
-- STEP 16: MAKE ORGANIZATION_ID NOT NULL (AFTER CLEANUP)
-- =====================================================
-- Make organization_id NOT NULL for bots
ALTER TABLE bots ALTER COLUMN organization_id SET NOT NULL;

-- Make organization_id NOT NULL for bot_messages
ALTER TABLE bot_messages ALTER COLUMN organization_id SET NOT NULL;

-- Make organization_id NOT NULL for api_tokens (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_tokens') THEN
        EXECUTE 'ALTER TABLE api_tokens ALTER COLUMN organization_id SET NOT NULL';
    END IF;
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Summary:
-- ✅ Created roles table with 3 default roles
-- ✅ Created organizations table
-- ✅ Created organization_members table
-- ✅ Added organization_id to bots, bot_messages, api_tokens
-- ✅ Created personal organization for each user
-- ✅ Added users as admins to their organizations
-- ✅ Migrated all existing data to organizations
-- ✅ Added foreign key constraints
-- ✅ Created performance indexes
