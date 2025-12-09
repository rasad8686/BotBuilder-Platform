const db = require('../db');
const log = require('../utils/logger');

/**
 * Organization Context Middleware
 *
 * Extracts organization context from JWT or request header
 * Verifies user is a member of the organization
 * Attaches organization and user role to request object
 *
 * Usage: app.use(organizationContext)
 */

async function organizationContext(req, res, next) {
  try {
    // Skip if no user (will be handled by auth middleware)
    if (!req.user || !req.user.id) {
      return next();
    }

    const userId = req.user.id;

    // Get organization ID from JWT, header, or query param
    let organizationId = req.user.current_organization_id ||
                         req.headers['x-organization-id'] ||
                         req.query.organization_id;

    // Helper function to get user's default organization (member or owner)
    const getUserDefaultOrg = async (uid) => {
      // First try organization_members
      const memberQuery = `
        SELECT om.org_id, om.role, o.name, o.slug, o.owner_id
        FROM organization_members om
        JOIN organizations o ON o.id = om.org_id
        WHERE om.user_id = $1 AND om.status = 'active'
        ORDER BY om.joined_at ASC
        LIMIT 1
      `;
      const memberResult = await db.query(memberQuery, [uid]);
      if (memberResult.rows.length > 0) {
        return memberResult.rows[0];
      }

      // Fallback: check if user owns an organization
      const ownerQuery = `
        SELECT id as org_id, 'admin' as role, name, slug, owner_id
        FROM organizations
        WHERE owner_id = $1
        LIMIT 1
      `;
      const ownerResult = await db.query(ownerQuery, [uid]);
      if (ownerResult.rows.length > 0) {
        return ownerResult.rows[0];
      }

      return null;
    };

    // If no organization specified, get user's first organization
    if (!organizationId) {
      const defaultOrg = await getUserDefaultOrg(userId);

      if (!defaultOrg) {
        return res.status(403).json({
          success: false,
          message: 'No organization found. Please contact support.',
          code: 'NO_ORGANIZATION'
        });
      }

      organizationId = defaultOrg.org_id;
      req.organization = defaultOrg;
    } else {
      // Verify user is member of specified organization
      const memberQuery = `
        SELECT om.org_id, om.role, o.name, o.slug, o.owner_id
        FROM organization_members om
        JOIN organizations o ON o.id = om.org_id
        WHERE om.user_id = $1 AND om.org_id = $2 AND om.status = 'active'
      `;

      const result = await db.query(memberQuery, [userId, organizationId]);

      if (result.rows.length === 0) {
        // Check if user is owner of this organization
        const ownerQuery = `
          SELECT id as org_id, 'admin' as role, name, slug, owner_id
          FROM organizations
          WHERE id = $1 AND owner_id = $2
        `;
        const ownerResult = await db.query(ownerQuery, [organizationId, userId]);

        if (ownerResult.rows.length > 0) {
          req.organization = ownerResult.rows[0];
        } else {
          // Fallback to user's default organization
          const defaultOrg = await getUserDefaultOrg(userId);

          if (!defaultOrg) {
            return res.status(403).json({
              success: false,
              message: 'You do not have access to this organization',
              code: 'NO_ORGANIZATION_ACCESS'
            });
          }

          req.organization = defaultOrg;
        }
      } else {
        req.organization = result.rows[0];
      }
    }

    // Attach organization context to request
    req.organization.id = req.organization.org_id;
    req.organization.is_owner = req.organization.owner_id === userId;

    // Attach helper function to check if user has role
    req.hasRole = function(requiredRole) {
      const roleHierarchy = { viewer: 1, member: 2, admin: 3 };
      const userRoleLevel = roleHierarchy[req.organization.role] || 0;
      const requiredRoleLevel = roleHierarchy[requiredRole] || 999;
      return userRoleLevel >= requiredRoleLevel;
    };

    next();
  } catch (error) {
    log.error('Organization context error', { error: error.message, stack: error.stack, userId: req.user?.id });

    // Handle specific database errors gracefully
    if (error.code === 'ECONNREFUSED' || error.code === '57P01') {
      return res.status(503).json({
        success: false,
        message: 'Database temporarily unavailable. Please try again.',
        code: 'DATABASE_UNAVAILABLE'
      });
    }

    // For other errors, return 403 instead of 500 to avoid breaking the client
    return res.status(403).json({
      success: false,
      message: 'Unable to load organization context. Please try logging in again.',
      code: 'ORGANIZATION_CONTEXT_ERROR'
    });
  }
}

/**
 * Require Organization Middleware
 *
 * Ensures organization context is loaded
 * Use after organizationContext middleware
 */
function requireOrganization(req, res, next) {
  if (!req.organization || !req.organization.id) {
    return res.status(403).json({
      success: false,
      message: 'Organization context required',
      code: 'ORGANIZATION_REQUIRED'
    });
  }
  next();
}

module.exports = {
  organizationContext,
  requireOrganization
};
