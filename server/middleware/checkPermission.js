/**
 * Permission Checking Middleware
 *
 * Verifies user has required role to perform action
 * Must be used after organizationContext middleware
 *
 * Role hierarchy: viewer < member < admin
 * - viewer: Can only read
 * - member: Can read and write (create/update)
 * - admin: Full access including delete
 *
 * Usage:
 * - checkPermission('viewer') - any authenticated member
 * - checkPermission('member') - member or admin only
 * - checkPermission('admin') - admin only
 * - checkPermission('owner') - organization owner only
 */

function checkPermission(requiredRole) {
  return function(req, res, next) {
    // Ensure organization context is loaded
    if (!req.organization || !req.organization.role) {
      return res.status(403).json({
        success: false,
        message: 'Organization context required',
        code: 'ORGANIZATION_CONTEXT_MISSING'
      });
    }

    // Special case: owner check
    if (requiredRole === 'owner') {
      if (!req.organization.is_owner) {
        return res.status(403).json({
          success: false,
          message: 'Only organization owner can perform this action',
          code: 'OWNER_REQUIRED'
        });
      }
      return next();
    }

    // Check role hierarchy
    const roleHierarchy = {
      viewer: 1,
      member: 2,
      admin: 3
    };

    const userRoleLevel = roleHierarchy[req.organization.role] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 999;

    if (userRoleLevel < requiredRoleLevel) {
      return res.status(403).json({
        success: false,
        message: `Insufficient permissions. Required role: ${requiredRole}, your role: ${req.organization.role}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        required_role: requiredRole,
        user_role: req.organization.role
      });
    }

    next();
  };
}

/**
 * Check specific permission from roles table
 * Checks JSONB permissions field
 *
 * Usage: checkSpecificPermission('bots', 'delete')
 */
function checkSpecificPermission(resource, action) {
  return async function(req, res, next) {
    try {
      if (!req.organization || !req.organization.role) {
        return res.status(403).json({
          success: false,
          message: 'Organization context required'
        });
      }

      const db = require('../config/db');

      // Get role permissions from database
      const roleQuery = 'SELECT permissions FROM roles WHERE name = $1';
      const result = await db.query(roleQuery, [req.organization.role]);

      if (result.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Invalid role'
        });
      }

      const permissions = result.rows[0].permissions;

      // Check if user has permission
      if (permissions[resource] && permissions[resource].includes(action)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `You do not have permission to ${action} ${resource}`,
        code: 'PERMISSION_DENIED'
      });
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking permissions',
        error: error.message
      });
    }
  };
}

module.exports = {
  checkPermission,
  checkSpecificPermission
};
