-- Migration: Create audit_logs table for tracking all user actions
-- Created: 2025-10-31
-- Purpose: Comprehensive audit trail for security, debugging, and compliance

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_org_date
  ON audit_logs(user_id, organization_id, created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail of all user actions';
COMMENT ON COLUMN audit_logs.user_id IS 'User who performed the action (nullable for system actions)';
COMMENT ON COLUMN audit_logs.organization_id IS 'Organization context of the action';
COMMENT ON COLUMN audit_logs.action IS 'Action type (e.g., user.login, bot.created, org.member.invited)';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource affected (user, bot, organization, member)';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID of the affected resource';
COMMENT ON COLUMN audit_logs.old_values IS 'Previous state before action (for updates/deletes)';
COMMENT ON COLUMN audit_logs.new_values IS 'New state after action (for creates/updates)';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the request';
COMMENT ON COLUMN audit_logs.user_agent IS 'Browser/client user agent string';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional contextual information';
COMMENT ON COLUMN audit_logs.created_at IS 'When the action occurred';

-- Insert initial audit log for migration
INSERT INTO audit_logs (
  action,
  resource_type,
  resource_id,
  metadata,
  created_at
) VALUES (
  'system.migration.executed',
  'database',
  6,
  '{"migration": "006_audit_logs", "description": "Created audit_logs table"}',
  CURRENT_TIMESTAMP
);

-- Create view for recent audit activity (last 30 days)
CREATE OR REPLACE VIEW recent_audit_activity AS
SELECT
  al.id,
  al.action,
  al.resource_type,
  al.resource_id,
  u.name as username,
  u.email as user_email,
  o.name as organization_name,
  al.ip_address,
  al.created_at
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
LEFT JOIN organizations o ON al.organization_id = o.id
WHERE al.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
ORDER BY al.created_at DESC;

-- Create view for user activity summary
CREATE OR REPLACE VIEW user_activity_summary AS
WITH action_counts AS (
  SELECT
    user_id,
    action,
    COUNT(*) as action_count
  FROM audit_logs
  WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
  GROUP BY user_id, action
)
SELECT
  u.id as user_id,
  u.name as username,
  u.email,
  COALESCE(SUM(ac.action_count), 0) as total_actions,
  COUNT(DISTINCT al.organization_id) as organizations_accessed,
  MAX(al.created_at) as last_activity,
  jsonb_object_agg(ac.action, ac.action_count) FILTER (WHERE ac.action IS NOT NULL) as action_counts
FROM users u
LEFT JOIN audit_logs al ON u.id = al.user_id AND al.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
LEFT JOIN action_counts ac ON u.id = ac.user_id
GROUP BY u.id, u.name, u.email;

-- Create function to cleanup old audit logs (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL
    AND action NOT IN ('user.login.failed', 'security.breach', 'data.deleted');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log the cleanup action
  INSERT INTO audit_logs (
    action,
    resource_type,
    metadata,
    created_at
  ) VALUES (
    'system.audit.cleanup',
    'audit_logs',
    jsonb_build_object(
      'deleted_count', deleted_count,
      'days_kept', days_to_keep
    ),
    CURRENT_TIMESTAMP
  );

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Cleanup audit logs older than specified days (default 365), keeps security-critical events';
