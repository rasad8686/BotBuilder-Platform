const jwt = require('jsonwebtoken');
require('dotenv').config();
const log = require('../utils/logger');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user information to request object
 * Usage: Add to any route that requires authentication
 */
const authenticateToken = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

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
