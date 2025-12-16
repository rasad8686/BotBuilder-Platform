-- =====================================================
-- SUPERADMIN MIGRATION
-- Version: 033
-- Description: Add global superadmin support to users table
-- =====================================================

-- =====================================================
-- STEP 1: ADD IS_SUPERADMIN COLUMN TO USERS TABLE
-- =====================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT false;

-- Create index for faster superadmin lookups
CREATE INDEX IF NOT EXISTS idx_users_is_superadmin ON users(is_superadmin) WHERE is_superadmin = true;

-- =====================================================
-- STEP 2: CREATE ADMIN_LOGIN_ATTEMPTS TABLE FOR RATE LIMITING
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_login_attempts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT false
);

-- Index for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_email_time ON admin_login_attempts(email, attempted_at);
CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_ip_time ON admin_login_attempts(ip_address, attempted_at);

-- =====================================================
-- STEP 3: CREATE ADMIN_SESSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- Index for session lookups
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

-- =====================================================
-- STEP 4: CREATE ADMIN_AUDIT_LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id INTEGER,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_user_id ON admin_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_resource ON admin_audit_log(resource_type, resource_id);

-- =====================================================
-- STEP 5: CREATE IP_WHITELIST TABLE FOR ADMIN ACCESS
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_ip_whitelist (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    description VARCHAR(255),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_admin_ip_whitelist_ip ON admin_ip_whitelist(ip_address) WHERE is_active = true;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Summary:
-- Added is_superadmin column to users table
-- Created admin_login_attempts table for rate limiting
-- Created admin_sessions table for admin-specific sessions
-- Created admin_audit_log table for tracking admin actions
-- Created admin_ip_whitelist table for IP restrictions
-- =====================================================
