const db = require('../../db');
const log = require('../../utils/logger');

// Permission Constants
const PERMISSIONS = {
  // Bots
  BOTS_VIEW: 'bots_view',
  BOTS_EDIT: 'bots_edit',
  BOTS_DELETE: 'bots_delete',
  BOTS_CREATE: 'bots_create',

  // Flows/Workflows
  FLOWS_VIEW: 'flows_view',
  FLOWS_EDIT: 'flows_edit',
  FLOWS_DELETE: 'flows_delete',
  FLOWS_CREATE: 'flows_create',

  // Team Management
  TEAM_MANAGE: 'team_manage',
  TEAM_VIEW: 'team_view',
  TEAM_INVITE: 'team_invite',

  // Billing
  BILLING_VIEW: 'billing_view',
  BILLING_MANAGE: 'billing_manage',

  // Knowledge Base
  KNOWLEDGE_VIEW: 'knowledge_view',
  KNOWLEDGE_EDIT: 'knowledge_edit',

  // Analytics
  ANALYTICS_VIEW: 'analytics_view',

  // Settings
  SETTINGS_VIEW: 'settings_view',
  SETTINGS_EDIT: 'settings_edit',

  // API Keys
  API_KEYS_VIEW: 'api_keys_view',
  API_KEYS_MANAGE: 'api_keys_manage',

  // Channels
  CHANNELS_VIEW: 'channels_view',
  CHANNELS_MANAGE: 'channels_manage'
};

class PermissionChecker {
  static async getUserPermissions(userId, tenantId) {
    const result = await db.query(
      `SELECT tr.permissions
       FROM team_members tm
       JOIN team_roles tr ON tm.role_id = tr.id
       WHERE tm.user_id = $1 AND tm.tenant_id = $2 AND tm.status = 'active'`,
      [userId, tenantId]
    );

    if (!result.rows[0]) {
      return null;
    }

    return result.rows[0].permissions;
  }

  static async hasPermission(userId, tenantId, permission) {
    const permissions = await this.getUserPermissions(userId, tenantId);

    // If user is not in team_members, check if they own the organization
    if (!permissions) {
      const ownerCheck = await db.query(
        `SELECT id FROM organizations WHERE id = $1 AND owner_id = $2`,
        [tenantId, userId]
      );
      // Organization owner has all permissions
      if (ownerCheck.rows.length > 0) {
        return true;
      }
      return false;
    }

    if (permissions.all === true) {
      return true;
    }

    return permissions[permission] === true;
  }

  // Middleware factory
  static requirePermission(permission) {
    return async (req, res, next) => {
      try {
        const userId = req.user?.id;
        const tenantId = req.user?.current_organization_id || req.user?.organization_id;

        if (!userId || !tenantId) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const hasAccess = await PermissionChecker.hasPermission(userId, tenantId, permission);

        if (!hasAccess) {
          return res.status(403).json({
            error: 'Permission denied',
            required: permission
          });
        }

        next();
      } catch (error) {
        log.error('Permission check error:', { error: error.message, userId: req.user?.id });
        res.status(500).json({ error: 'Permission check failed' });
      }
    };
  }

  // Multiple permissions (AND logic)
  static requireAllPermissions(permissions) {
    return async (req, res, next) => {
      try {
        const userId = req.user?.id;
        const tenantId = req.user?.current_organization_id || req.user?.organization_id;

        if (!userId || !tenantId) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        for (const permission of permissions) {
          const hasAccess = await PermissionChecker.hasPermission(userId, tenantId, permission);
          if (!hasAccess) {
            return res.status(403).json({
              error: 'Permission denied',
              required: permissions,
              missing: permission
            });
          }
        }

        next();
      } catch (error) {
        log.error('Permission check error:', { error: error.message, userId: req.user?.id });
        res.status(500).json({ error: 'Permission check failed' });
      }
    };
  }

  // Multiple permissions (OR logic)
  static requireAnyPermission(permissions) {
    return async (req, res, next) => {
      try {
        const userId = req.user?.id;
        const tenantId = req.user?.current_organization_id || req.user?.organization_id;

        if (!userId || !tenantId) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        for (const permission of permissions) {
          const hasAccess = await PermissionChecker.hasPermission(userId, tenantId, permission);
          if (hasAccess) {
            return next();
          }
        }

        return res.status(403).json({
          error: 'Permission denied',
          required: `One of: ${permissions.join(', ')}`
        });
      } catch (error) {
        log.error('Permission check error:', { error: error.message, userId: req.user?.id });
        res.status(500).json({ error: 'Permission check failed' });
      }
    };
  }

  // Convenience methods
  static async canView(userId, tenantId, entityType) {
    const permission = `${entityType}_view`;
    return this.hasPermission(userId, tenantId, permission);
  }

  static async canEdit(userId, tenantId, entityType) {
    const permission = `${entityType}_edit`;
    return this.hasPermission(userId, tenantId, permission);
  }

  static async canDelete(userId, tenantId, entityType) {
    const permission = `${entityType}_delete`;
    return this.hasPermission(userId, tenantId, permission);
  }

  static async canCreate(userId, tenantId, entityType) {
    const permission = `${entityType}_create`;
    return this.hasPermission(userId, tenantId, permission);
  }

  static async canManageTeam(userId, tenantId) {
    return this.hasPermission(userId, tenantId, PERMISSIONS.TEAM_MANAGE);
  }

  static async canViewBilling(userId, tenantId) {
    return this.hasPermission(userId, tenantId, PERMISSIONS.BILLING_VIEW);
  }

  static async canManageBilling(userId, tenantId) {
    return this.hasPermission(userId, tenantId, PERMISSIONS.BILLING_MANAGE);
  }

  // Check if user is owner (has all permissions)
  static async isOwner(userId, tenantId) {
    const permissions = await this.getUserPermissions(userId, tenantId);
    return permissions?.all === true;
  }

  // Get all permissions for a user (for frontend)
  static async getAllUserPermissions(userId, tenantId) {
    const permissions = await this.getUserPermissions(userId, tenantId);

    if (!permissions) {
      return { hasAccess: false, permissions: {} };
    }

    if (permissions.all === true) {
      const allPermissions = {};
      Object.values(PERMISSIONS).forEach(p => {
        allPermissions[p] = true;
      });
      return { hasAccess: true, isOwner: true, permissions: allPermissions };
    }

    return { hasAccess: true, isOwner: false, permissions };
  }
}

module.exports = {
  PermissionChecker,
  PERMISSIONS,
  requirePermission: PermissionChecker.requirePermission.bind(PermissionChecker),
  requireAllPermissions: PermissionChecker.requireAllPermissions.bind(PermissionChecker),
  requireAnyPermission: PermissionChecker.requireAnyPermission.bind(PermissionChecker)
};
