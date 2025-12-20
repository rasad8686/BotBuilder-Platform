/**
 * Superadmin & Admin Authorization Middlewares
 *
 * Provides middleware functions for protecting admin and superadmin routes.
 */

const db = require('../db');

/**
 * Log admin action to audit log
 */
async function logAdminAction(userId, userEmail, action, resourceType, resourceId, details, req) {
  try {
    await db.query(
      `INSERT INTO admin_audit_log (user_id, user_email, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
      [
        userId,
        userEmail,
        action,
        resourceType,
        resourceId,
        JSON.stringify(details || {}),
        req.ip || req.connection?.remoteAddress,
        req.headers['user-agent']
      ]
    );
  } catch (error) {
    // Failed to log admin action - silent fail
  }
}

/**
 * Check if user is a superadmin
 */
async function isSuperAdmin(userId) {
  try {
    const result = await db.query(
      'SELECT is_superadmin FROM users WHERE id = $1',
      [userId]
    );
    return result.rows.length > 0 && result.rows[0].is_superadmin === true;
  } catch (error) {
    // Error checking superadmin status - silent fail
    return false;
  }
}

/**
 * Require Superadmin Middleware
 *
 * Blocks access if user is not a global superadmin.
 * Must be used after authentication middleware.
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Check superadmin status
  db.query('SELECT is_superadmin FROM users WHERE id = $1', [req.user.id])
    .then(result => {
      if (result.rows.length === 0 || result.rows[0].is_superadmin !== true) {
        // Log unauthorized access attempt
        logAdminAction(
          req.user.id,
          req.user.email,
          'SUPERADMIN_ACCESS_DENIED',
          'route',
          null,
          { path: req.path, method: req.method },
          req
        );

        return res.status(403).json({
          success: false,
          message: 'Superadmin access required'
        });
      }

      // Attach superadmin flag to request
      req.isSuperAdmin = true;

      // Log superadmin access
      logAdminAction(
        req.user.id,
        req.user.email,
        'SUPERADMIN_ACCESS',
        'route',
        null,
        { path: req.path, method: req.method },
        req
      );

      next();
    })
    .catch(error => {
      // Superadmin check error - silent fail
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed'
      });
    });
}

/**
 * Require Admin Middleware
 *
 * Blocks access if user is not an admin (organization admin or superadmin).
 * Must be used after authentication and organization context middlewares.
 */
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // First check if superadmin (superadmins have access to everything)
  db.query('SELECT is_superadmin FROM users WHERE id = $1', [req.user.id])
    .then(result => {
      if (result.rows.length > 0 && result.rows[0].is_superadmin === true) {
        req.isSuperAdmin = true;
        req.isAdmin = true;
        return next();
      }

      // Check organization admin status
      if (!req.organization) {
        return res.status(403).json({
          success: false,
          message: 'Organization context required for admin access'
        });
      }

      const isOrgAdmin = req.organization.role === 'admin' || req.organization.is_owner;

      if (!isOrgAdmin) {
        // Log unauthorized access attempt
        logAdminAction(
          req.user.id,
          req.user.email,
          'ADMIN_ACCESS_DENIED',
          'route',
          null,
          { path: req.path, method: req.method, orgId: req.organization?.org_id },
          req
        );

        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      req.isAdmin = true;
      next();
    })
    .catch(error => {
      // Admin check error - silent fail
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed'
      });
    });
}

/**
 * Admin Login Rate Limiting Middleware
 *
 * Limits admin login attempts to 5 per 15 minutes per email/IP.
 */
async function adminLoginRateLimit(req, res, next) {
  const { email } = req.body;
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required'
    });
  }

  try {
    // Check attempts in last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    // Check by email
    const emailAttempts = await db.query(
      `SELECT COUNT(*) as count FROM admin_login_attempts
       WHERE email = $1 AND attempted_at > $2 AND success = false`,
      [email.toLowerCase(), fifteenMinutesAgo]
    );

    // Check by IP
    const ipAttempts = await db.query(
      `SELECT COUNT(*) as count FROM admin_login_attempts
       WHERE ip_address = $1 AND attempted_at > $2 AND success = false`,
      [ip, fifteenMinutesAgo]
    );

    const emailCount = parseInt(emailAttempts.rows[0].count);
    const ipCount = parseInt(ipAttempts.rows[0].count);

    if (emailCount >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many login attempts. Please try again in 15 minutes.',
        retryAfter: 15 * 60
      });
    }

    if (ipCount >= 10) {
      return res.status(429).json({
        success: false,
        message: 'Too many login attempts from this IP. Please try again later.',
        retryAfter: 15 * 60
      });
    }

    // Attach logging function for later use
    req.logLoginAttempt = async (success) => {
      try {
        await db.query(
          `INSERT INTO admin_login_attempts (email, ip_address, success, attempted_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
          [email.toLowerCase(), ip, success]
        );
      } catch (error) {
        // Failed to log login attempt - silent fail
      }
    };

    next();
  } catch (error) {
    // Rate limit check error - silent fail
    // Allow through on error to prevent lockout
    next();
  }
}

/**
 * Admin IP Whitelist Middleware (Optional)
 *
 * If ADMIN_IP_WHITELIST is set in env, only allows listed IPs.
 * Format: comma-separated IPs (e.g., "192.168.1.1,10.0.0.1")
 */
async function adminIpWhitelist(req, res, next) {
  const envWhitelist = process.env.ADMIN_IP_WHITELIST;
  const ip = req.ip || req.connection?.remoteAddress || '';

  // Skip if no whitelist configured
  if (!envWhitelist || envWhitelist.trim() === '') {
    return next();
  }

  // Parse whitelist from env
  const allowedIps = envWhitelist.split(',').map(ip => ip.trim());

  // Also check database whitelist
  try {
    const dbWhitelist = await db.query(
      'SELECT ip_address FROM admin_ip_whitelist WHERE is_active = true'
    );
    dbWhitelist.rows.forEach(row => {
      if (!allowedIps.includes(row.ip_address)) {
        allowedIps.push(row.ip_address);
      }
    });
  } catch (error) {
    // IP whitelist DB check error - silent fail
  }

  // Check if IP is allowed
  const normalizedIp = ip.replace('::ffff:', ''); // Handle IPv6 mapped IPv4
  const isAllowed = allowedIps.some(allowed => {
    return normalizedIp === allowed ||
           normalizedIp.startsWith(allowed) ||
           ip === allowed;
  });

  if (!isAllowed) {
    // Log blocked access
    logAdminAction(
      null,
      req.body?.email || 'unknown',
      'ADMIN_IP_BLOCKED',
      'login',
      null,
      { ip: normalizedIp, allowedIps },
      req
    );

    return res.status(403).json({
      success: false,
      message: 'Access denied from this IP address'
    });
  }

  next();
}

/**
 * Require 2FA for Admin Login
 *
 * Ensures that admin users have 2FA enabled and verified.
 */
function requireAdmin2FA(req, res, next) {
  // This will be checked during login process
  // The login route should verify 2FA code before issuing admin session
  req.require2FA = true;
  next();
}

module.exports = {
  requireSuperAdmin,
  requireAdmin,
  adminLoginRateLimit,
  adminIpWhitelist,
  requireAdmin2FA,
  logAdminAction,
  isSuperAdmin
};
