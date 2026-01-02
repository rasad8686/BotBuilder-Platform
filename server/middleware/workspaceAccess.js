const db = require('../db');
const log = require('../utils/logger');

/**
 * Check if user has access to workspace
 * @param {string} requiredRole - Minimum role required ('viewer', 'editor', 'admin', 'owner')
 */
const checkWorkspaceAccess = (requiredRole = 'viewer') => {
  const roleHierarchy = ['viewer', 'editor', 'admin', 'owner'];

  return async (req, res, next) => {
    try {
      const workspaceId = req.params.workspaceId || req.params.id || req.body.workspaceId;
      const userId = req.user?.id;

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workspace ID required'
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Get user's role in workspace
      const result = await db.query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this workspace'
        });
      }

      const userRole = result.rows[0].role;
      const userRoleLevel = roleHierarchy.indexOf(userRole);
      const requiredRoleLevel = roleHierarchy.indexOf(requiredRole);

      if (userRoleLevel < requiredRoleLevel) {
        return res.status(403).json({
          success: false,
          message: `${requiredRole} access required`
        });
      }

      // Add workspace info to request
      req.workspace = {
        id: parseInt(workspaceId),
        userRole
      };

      next();
    } catch (error) {
      log.error('Workspace access check error', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to check workspace access'
      });
    }
  };
};

/**
 * Inject current workspace context into request
 * Gets workspace from header, query, or user's default
 */
const injectWorkspace = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return next();
    }

    // Get workspace from header or query
    let workspaceId = req.headers['x-workspace-id'] || req.query.workspace_id;

    if (!workspaceId) {
      // Get user's default workspace
      const result = await db.query(`
        SELECT w.id FROM workspaces w
        JOIN workspace_members wm ON wm.workspace_id = w.id
        JOIN organization_members om ON om.org_id = w.organization_id
        WHERE wm.user_id = $1 AND om.user_id = $1 AND om.status = 'active'
        ORDER BY w.is_default DESC, wm.joined_at ASC
        LIMIT 1
      `, [userId]);

      if (result.rows.length > 0) {
        workspaceId = result.rows[0].id;
      }
    }

    if (workspaceId) {
      // Verify access
      const accessResult = await db.query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
      );

      if (accessResult.rows.length > 0) {
        req.workspace = {
          id: parseInt(workspaceId),
          userRole: accessResult.rows[0].role
        };

        // Set response header
        res.setHeader('X-Workspace-Id', workspaceId);
      }
    }

    next();
  } catch (error) {
    log.error('Inject workspace error', { error: error.message });
    // Don't block request, just continue without workspace context
    next();
  }
};

/**
 * Filter resources by workspace
 * Adds workspace filter to database queries
 */
const filterByWorkspace = (tableName) => {
  return async (req, res, next) => {
    if (req.workspace?.id) {
      req.workspaceFilter = {
        column: `${tableName}.workspace_id`,
        value: req.workspace.id
      };
    }
    next();
  };
};

module.exports = {
  checkWorkspaceAccess,
  injectWorkspace,
  filterByWorkspace
};
