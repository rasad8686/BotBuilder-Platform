/**
 * Cookie Helper - JWT Token Cookie Management
 *
 * Security best practices:
 * - httpOnly: Prevents XSS attacks from reading the token
 * - secure: Only sent over HTTPS in production
 * - sameSite: Prevents CSRF attacks
 * - maxAge: Token expiration matches JWT expiration
 */

const JWT_COOKIE_NAME = 'auth_token';
const JWT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Set JWT token as httpOnly cookie
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
 * Clear JWT cookie (logout)
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
 * Get JWT token from cookie
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
