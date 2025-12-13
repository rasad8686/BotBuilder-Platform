const jwt = require('jsonwebtoken');
require('dotenv').config();
const log = require('../utils/logger');
const { getAuthToken } = require('../utils/cookieHelper');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user information to request object
 *
 * Token sources (in order of priority):
 * 1. httpOnly cookie (auth_token) - Most secure, preferred
 * 2. Authorization header (Bearer token) - For backward compatibility and API clients
 *
 * Usage: Add to any route that requires authentication
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
