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
        return res.status(403).json({
          success: false,
          message: 'Invalid or expired token.'
        });
      }

      // Attach user information to request object
      req.user = {
        id: decoded.id,
        email: decoded.email,
        username: decoded.username,
        current_organization_id: decoded.current_organization_id,
        organization_id: decoded.current_organization_id
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

module.exports = authenticateToken;
