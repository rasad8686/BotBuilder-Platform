/**
 * CSRF Protection Middleware
 * Uses Double Submit Cookie pattern
 *
 * How it works:
 * 1. Server generates a random token and sets it in a cookie (csrf_token)
 * 2. Client reads this cookie and sends it back in X-CSRF-Token header
 * 3. Server verifies that cookie value matches header value
 *
 * This works because:
 * - Attacker can't read cookies from another domain (Same-Origin Policy)
 * - Attacker can't set custom headers in cross-origin requests
 */

const crypto = require('crypto');
const log = require('../utils/logger');

// Token configuration
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;

// Methods that require CSRF validation
const PROTECTED_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

// Routes exempt from CSRF (webhooks, external callbacks, auth)
// Note: paths are relative to mount point (no /api/ prefix when mounted on /api/)
const EXEMPT_ROUTES = [
  '/auth/login',               // Login - no session yet
  '/auth/register',            // Register - no session yet
  '/auth/demo',                // Demo login - no session yet
  '/auth/logout',              // Logout
  '/auth/forgot-password',     // Password reset request
  '/auth/reset-password',      // Password reset
  '/auth/verify-email',        // Email verification
  '/auth/resend-verification', // Resend verification email
  '/auth/2fa/validate',        // 2FA validation during login
  '/admin-auth/login',         // Admin login - no session yet
  '/admin-auth/logout',        // Admin logout
  '/billing/webhook',          // Stripe webhook
  '/widget/',                  // Widget API (embedded in external sites)
  '/voice-to-bot/',            // Voice upload
  '/webhooks/',                // Channel webhooks (full path)
  '/fine-tuning/',             // Fine-tuning API (has own auth)
];

/**
 * Generate a cryptographically secure random token
 */
function generateToken() {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Check if route is exempt from CSRF protection
 */
function isExemptRoute(path) {
  return EXEMPT_ROUTES.some(route => path.startsWith(route));
}

/**
 * CSRF Token Generation Middleware
 * Sets CSRF token cookie on every response
 */
function csrfTokenMiddleware(req, res, next) {
  // Check if token already exists in cookie
  let token = req.cookies[CSRF_COOKIE_NAME];

  // Generate new token if not exists
  if (!token) {
    token = generateToken();
  }

  // Set cookie with security options
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,  // Must be readable by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/'
  });

  // Make token available for templates/responses
  req.csrfToken = token;
  res.locals.csrfToken = token;

  next();
}

/**
 * CSRF Validation Middleware
 * Validates CSRF token for protected methods
 */
function csrfValidationMiddleware(req, res, next) {
  // Skip validation for safe methods
  if (!PROTECTED_METHODS.includes(req.method)) {
    return next();
  }

  // Skip validation for exempt routes
  if (isExemptRoute(req.path)) {
    return next();
  }

  // Get token from cookie
  const cookieToken = req.cookies[CSRF_COOKIE_NAME];

  // Get token from header
  const headerToken = req.headers[CSRF_HEADER_NAME];

  // Validate tokens exist
  if (!cookieToken) {
    log.warn('CSRF validation failed: No cookie token', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    return res.status(403).json({
      success: false,
      error: 'CSRF_TOKEN_MISSING',
      message: 'CSRF token missing. Please refresh the page.'
    });
  }

  if (!headerToken) {
    log.warn('CSRF validation failed: No header token', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    return res.status(403).json({
      success: false,
      error: 'CSRF_TOKEN_MISSING',
      message: 'CSRF token missing in request header.'
    });
  }

  // Validate tokens match (timing-safe comparison)
  if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    log.warn('CSRF validation failed: Token mismatch', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    return res.status(403).json({
      success: false,
      error: 'CSRF_TOKEN_INVALID',
      message: 'Invalid CSRF token. Please refresh the page.'
    });
  }

  // Token is valid
  next();
}

/**
 * Endpoint to get CSRF token (for SPA initial load)
 */
function csrfTokenEndpoint(req, res) {
  const token = req.csrfToken || generateToken();

  // Set/refresh the cookie
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/'
  });

  res.json({
    success: true,
    csrfToken: token
  });
}

module.exports = {
  csrfTokenMiddleware,
  csrfValidationMiddleware,
  csrfTokenEndpoint,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME
};
