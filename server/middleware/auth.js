/**
 * @fileoverview Authentication Middleware
 * @description JWT token verification middleware for protecting API routes.
 * Supports both cookie-based and header-based authentication.
 * @module middleware/auth
 * @author BotBuilder Team
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();
const log = require('../utils/logger');
const { getAuthToken } = require('../utils/cookieHelper');

/**
 * Authentication Middleware
 * @function authenticateToken
 * @description Verifies JWT token and attaches user information to the request object.
 * Supports two token sources for flexibility:
 * 1. httpOnly cookie (auth_token) - Most secure, preferred for web apps
 * 2. Authorization header (Bearer token) - For API clients and mobile apps
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 *
 * @example
 * // Protect a route
 * const authenticateToken = require('./middleware/auth');
 * router.get('/protected', authenticateToken, (req, res) => {
 *   // req.user contains: { id, email, username, organization_id }
 *   res.json({ user: req.user });
 * });
 *
 * @throws {401} When no token is provided
 * @throws {403} When token is invalid or expired
 * @throws {500} When authentication error occurs
 */
const authenticateToken = (req, res, next) => {
  try {
    // Try to get token from cookie first (most secure)
    let token = getAuthToken(req);

    // Fallback to Authorization header for backward compatibility
    if (!token) {
      const authHeader = req.headers['authorization'];
      token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        log.error('JWT verification failed', {
          error: err.message,
          tokenPreview: token ? token.substring(0, 20) + '...' : 'no token',
          jwtSecretExists: !!process.env.JWT_SECRET
        });
        return res.status(403).json({
          success: false,
          message: 'Invalid or expired token.'
        });
      }

      // Attach user information to request object
      // Support both organizationId and current_organization_id for compatibility
      const orgId = decoded.current_organization_id || decoded.organizationId || decoded.organization_id;
      req.user = {
        id: decoded.id,
        email: decoded.email,
        username: decoded.username,
        role: decoded.role || 'user',
        plan: decoded.plan || 'free',
        is_superadmin: decoded.is_superadmin || false,
        current_organization_id: orgId,
        organization_id: orgId
      };

      next();
    });
  } catch (error) {
    log.error('Auth middleware error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message
    });
  }
};

/**
 * Optional Authentication Middleware
 * @function optionalAuth
 * @description Tries to authenticate user but continues even without valid token.
 * Useful for routes that work for both guests and authenticated users.
 */
const optionalAuth = (req, res, next) => {
  try {
    let token = getAuthToken(req);
    if (!token) {
      const authHeader = req.headers['authorization'];
      token = authHeader && authHeader.split(' ')[1];
    }

    if (!token) {
      req.user = null;
      return next();
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        req.user = null;
        return next();
      }

      const orgId = decoded.current_organization_id || decoded.organizationId || decoded.organization_id;
      req.user = {
        id: decoded.id,
        email: decoded.email,
        username: decoded.username,
        current_organization_id: orgId,
        organization_id: orgId
      };
      next();
    });
  } catch (error) {
    req.user = null;
    next();
  }
};

// Require admin role middleware
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  // Check role or is_superadmin flag
  const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin' || req.user.is_superadmin === true;
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
};

// Require superadmin role middleware
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  const isSuperAdmin = req.user.role === 'superadmin' || req.user.is_superadmin === true;
  if (!isSuperAdmin) {
    return res.status(403).json({ success: false, error: 'Superadmin access required' });
  }
  next();
};

// Support both import syntaxes:
// const authenticateToken = require('./auth');
// const { authenticateToken, optionalAuth, requireAdmin, requireSuperAdmin } = require('./auth');
module.exports = authenticateToken;
module.exports.authenticateToken = authenticateToken;
module.exports.optionalAuth = optionalAuth;
module.exports.requireAdmin = requireAdmin;
module.exports.requireSuperAdmin = requireSuperAdmin;
