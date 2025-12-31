/**
 * @fileoverview Cookie Helper Module
 * @description Manages JWT token storage and retrieval via secure httpOnly cookies.
 * Implements security best practices for token handling.
 * @module utils/cookieHelper
 * @author BotBuilder Team
 *
 * @security
 * - httpOnly: Prevents XSS attacks from reading the token via JavaScript
 * - secure: Cookie only sent over HTTPS in production
 * - sameSite: Prevents CSRF attacks by restricting cross-site cookie sending
 * - maxAge: Token expiration matches JWT expiration for automatic cleanup
 */

/**
 * Cookie name constant for JWT storage
 * @constant {string}
 */
const JWT_COOKIE_NAME = 'auth_token';

/**
 * JWT cookie expiration time in milliseconds (24 hours)
 * @constant {number}
 */
const JWT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Sets a JWT token as an httpOnly cookie on the response
 * @function setAuthCookie
 * @param {Object} res - Express response object
 * @param {string} token - JWT token to store
 * @returns {void}
 *
 * @example
 * const { setAuthCookie } = require('./utils/cookieHelper');
 * // After successful login
 * setAuthCookie(res, jwtToken);
 * res.json({ success: true, user: userData });
 */
function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie(JWT_COOKIE_NAME, token, {
    httpOnly: true,           // Not accessible via JavaScript
    secure: isProduction,     // HTTPS only in production
    sameSite: isProduction ? 'strict' : 'lax', // CSRF protection
    maxAge: JWT_EXPIRY_MS,    // 24 hours
    path: '/'                 // Available for all routes
  });
}

/**
 * Clears the JWT authentication cookie (logout)
 * @function clearAuthCookie
 * @param {Object} res - Express response object
 * @returns {void}
 *
 * @example
 * const { clearAuthCookie } = require('./utils/cookieHelper');
 * // On logout
 * clearAuthCookie(res);
 * res.json({ success: true, message: 'Logged out' });
 */
function clearAuthCookie(res) {
  res.cookie(JWT_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 0,
    path: '/'
  });
}

/**
 * Retrieves the JWT token from the request cookies
 * @function getAuthToken
 * @param {Object} req - Express request object (must have cookie-parser middleware)
 * @returns {string|null} JWT token if present, null otherwise
 *
 * @example
 * const { getAuthToken } = require('./utils/cookieHelper');
 * const token = getAuthToken(req);
 * if (token) {
 *   // Verify token
 * }
 */
function getAuthToken(req) {
  return req.cookies[JWT_COOKIE_NAME] || null;
}

module.exports = {
  JWT_COOKIE_NAME,
  setAuthCookie,
  clearAuthCookie,
  getAuthToken
};
