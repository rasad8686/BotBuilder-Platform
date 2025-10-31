const db = require('../db');
const log = require('../utils/logger');

/**
 * Audit Middleware
 * Captures user actions for security, debugging, and compliance
 * Logs to both database (audit_logs table) and file system (audit.log)
 */

/**
 * Core audit logging function
 * @param {Object} params - Audit log parameters
 * @param {number} params.userId - User who performed the action
 * @param {number} params.organizationId - Organization context
 * @param {string} params.action - Action type (e.g., 'user.login', 'bot.created')
 * @param {string} params.resourceType - Type of resource (user, bot, organization, member)
 * @param {number} params.resourceId - ID of the affected resource
 * @param {Object} params.oldValues - Previous state (for updates/deletes)
 * @param {Object} params.newValues - New state (for creates/updates)
 * @param {string} params.ipAddress - IP address of the request
 * @param {string} params.userAgent - Browser/client user agent
 * @param {Object} params.metadata - Additional context
 */
async function auditLog({
  userId = null,
  organizationId = null,
  action,
  resourceType,
  resourceId = null,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null,
  metadata = {}
}) {
  try {
    // Log to file system via Winston
    log.audit(action, {
      userId,
      organizationId,
      resourceType,
      resourceId,
      ipAddress,
      ...metadata
    });

    // Log to database (async, non-blocking)
    setImmediate(async () => {
      try {
        const query = `
          INSERT INTO audit_logs (
            user_id,
            organization_id,
            action,
            resource_type,
            resource_id,
            old_values,
            new_values,
            ip_address,
            user_agent,
            metadata,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        `;

        await db.query(query, [
          userId,
          organizationId,
          action,
          resourceType,
          resourceId,
          oldValues ? JSON.stringify(oldValues) : null,
          newValues ? JSON.stringify(newValues) : null,
          ipAddress,
          userAgent,
          JSON.stringify(metadata)
        ]);
      } catch (dbError) {
        log.error('Failed to write audit log to database', {
          error: dbError.message,
          action,
          resourceType
        });
      }
    });
  } catch (error) {
    log.error('Audit logging failed', {
      error: error.message,
      action,
      resourceType
    });
  }
}

/**
 * Extract IP address from request
 * Handles proxies and load balancers
 */
function getIpAddress(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.connection?.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Extract user agent from request
 */
function getUserAgent(req) {
  return req.headers['user-agent'] || 'unknown';
}

/**
 * Audit middleware factory
 * Creates middleware that automatically logs actions
 * @param {string} action - Action type
 * @param {string} resourceType - Resource type
 * @param {Function} getResourceId - Function to extract resource ID from req
 */
function auditMiddleware(action, resourceType, getResourceId = null) {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to capture response
    res.json = function (body) {
      // Only log on successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user?.id || null;
        const organizationId = req.organization?.id || null;
        const resourceId = getResourceId ? getResourceId(req, body) : null;
        const ipAddress = getIpAddress(req);
        const userAgent = getUserAgent(req);

        // Log audit event (async, non-blocking)
        auditLog({
          userId,
          organizationId,
          action,
          resourceType,
          resourceId,
          newValues: body.data || null,
          ipAddress,
          userAgent,
          metadata: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode
          }
        });
      }

      // Call original json method
      return originalJson(body);
    };

    next();
  };
}

/**
 * Helper functions for common audit events
 */

// Authentication events
function logLogin(req, userId, success = true, reason = null) {
  return auditLog({
    userId: success ? userId : null,
    action: success ? 'user.login.success' : 'user.login.failed',
    resourceType: 'user',
    resourceId: userId,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    metadata: success ? {} : { reason }
  });
}

function logLogout(req, userId) {
  return auditLog({
    userId,
    action: 'user.logout',
    resourceType: 'user',
    resourceId: userId,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req)
  });
}

function logRegister(req, userId, email) {
  return auditLog({
    userId,
    action: 'user.registered',
    resourceType: 'user',
    resourceId: userId,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    newValues: { email },
    metadata: { registrationMethod: 'email' }
  });
}

function logPasswordChange(req, userId) {
  return auditLog({
    userId,
    action: 'user.password.changed',
    resourceType: 'user',
    resourceId: userId,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req)
  });
}

// Organization events
function logOrganizationCreated(req, organizationId, organizationData) {
  return auditLog({
    userId: req.user.id,
    organizationId,
    action: 'organization.created',
    resourceType: 'organization',
    resourceId: organizationId,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    newValues: organizationData
  });
}

function logOrganizationUpdated(req, organizationId, oldData, newData) {
  return auditLog({
    userId: req.user.id,
    organizationId,
    action: 'organization.updated',
    resourceType: 'organization',
    resourceId: organizationId,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    oldValues: oldData,
    newValues: newData
  });
}

function logOrganizationDeleted(req, organizationId, organizationData) {
  return auditLog({
    userId: req.user.id,
    organizationId,
    action: 'organization.deleted',
    resourceType: 'organization',
    resourceId: organizationId,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    oldValues: organizationData
  });
}

function logOrganizationSwitched(req, organizationId) {
  return auditLog({
    userId: req.user.id,
    organizationId,
    action: 'organization.switched',
    resourceType: 'organization',
    resourceId: organizationId,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req)
  });
}

// Member events
function logMemberInvited(req, organizationId, targetUserId, role) {
  return auditLog({
    userId: req.user.id,
    organizationId,
    action: 'member.invited',
    resourceType: 'member',
    resourceId: targetUserId,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    newValues: { role },
    metadata: { invitedBy: req.user.id }
  });
}

function logMemberRoleChanged(req, organizationId, targetUserId, oldRole, newRole) {
  return auditLog({
    userId: req.user.id,
    organizationId,
    action: 'member.role.changed',
    resourceType: 'member',
    resourceId: targetUserId,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    oldValues: { role: oldRole },
    newValues: { role: newRole }
  });
}

function logMemberRemoved(req, organizationId, targetUserId, memberData) {
  return auditLog({
    userId: req.user.id,
    organizationId,
    action: 'member.removed',
    resourceType: 'member',
    resourceId: targetUserId,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    oldValues: memberData
  });
}

// Bot events
function logBotCreated(req, organizationId, botId, botData) {
  return auditLog({
    userId: req.user.id,
    organizationId,
    action: 'bot.created',
    resourceType: 'bot',
    resourceId: botId,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    newValues: botData
  });
}

function logBotUpdated(req, organizationId, botId, oldData, newData) {
  return auditLog({
    userId: req.user.id,
    organizationId,
    action: 'bot.updated',
    resourceType: 'bot',
    resourceId: botId,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    oldValues: oldData,
    newValues: newData
  });
}

function logBotDeleted(req, organizationId, botId, botData) {
  return auditLog({
    userId: req.user.id,
    organizationId,
    action: 'bot.deleted',
    resourceType: 'bot',
    resourceId: botId,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    oldValues: botData
  });
}

// Message events (optional - might be too verbose)
function logMessageSent(req, organizationId, botId, messageId) {
  return auditLog({
    userId: req.user.id,
    organizationId,
    action: 'message.sent',
    resourceType: 'message',
    resourceId: messageId,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    metadata: { botId }
  });
}

// Security events
function logUnauthorizedAccess(req, reason) {
  return auditLog({
    userId: req.user?.id || null,
    organizationId: req.organization?.id || null,
    action: 'security.unauthorized.access',
    resourceType: 'security',
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    metadata: {
      reason,
      path: req.path,
      method: req.method
    }
  });
}

function logSuspiciousActivity(req, activityType, details) {
  return auditLog({
    userId: req.user?.id || null,
    organizationId: req.organization?.id || null,
    action: 'security.suspicious.activity',
    resourceType: 'security',
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    metadata: {
      activityType,
      details
    }
  });
}

module.exports = {
  auditLog,
  auditMiddleware,
  getIpAddress,
  getUserAgent,

  // Authentication
  logLogin,
  logLogout,
  logRegister,
  logPasswordChange,

  // Organization
  logOrganizationCreated,
  logOrganizationUpdated,
  logOrganizationDeleted,
  logOrganizationSwitched,

  // Members
  logMemberInvited,
  logMemberRoleChanged,
  logMemberRemoved,

  // Bots
  logBotCreated,
  logBotUpdated,
  logBotDeleted,

  // Messages
  logMessageSent,

  // Security
  logUnauthorizedAccess,
  logSuspiciousActivity
};
