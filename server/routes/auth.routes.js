/**
 * OAuth Authentication Routes
 * Google and Microsoft OAuth2 login endpoints
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { passport } = require('../config/passport');
const log = require('../utils/logger');
const { setAuthCookie } = require('../utils/cookieHelper');

/**
 * Generate JWT token for user
 */
function generateToken(user) {
  const JWT_SECRET = process.env.JWT_SECRET;

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'user',
      plan: user.plan || 'free',
      organizationId: user.current_organization_id
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Log token creation with preview
  log.info('OAuth token generated', {
    userId: user.id,
    tokenPreview: token.substring(0, 30) + '...',
    jwtSecretLength: JWT_SECRET ? JWT_SECRET.length : 0
  });

  return token;
}

/**
 * Get frontend URL
 */
function getFrontendUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:5174';
}

/**
 * Handle OAuth callback success
 */
function handleOAuthSuccess(req, res, provider) {
  const FRONTEND_URL = getFrontendUrl();

  try {
    const user = req.user;

    if (!user) {
      log.error(`${provider} OAuth callback - no user`);
      return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
    }

    const token = generateToken(user);

    // Set token as httpOnly cookie
    setAuthCookie(res, token);

    log.info(`${provider} OAuth success`, { userId: user.id, email: user.email });

    // Redirect to frontend with token
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (err) {
    log.error(`${provider} OAuth callback error`, { error: err.message });
    res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
  }
}

/**
 * Handle OAuth callback failure
 */
function handleOAuthFailure(req, res, provider) {
  const FRONTEND_URL = getFrontendUrl();
  log.error(`${provider} OAuth failed`);
  res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
}

// ========================================
// GOOGLE OAUTH ROUTES
// ========================================

/**
 * GET /api/auth/google
 * Initiate Google OAuth login
 */
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Google OAuth not configured' });
  }
  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })(req, res, next);
});

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback', (req, res, next) => {
  const FRONTEND_URL = getFrontendUrl();
  passport.authenticate('google', {
    failureRedirect: `${FRONTEND_URL}/login?error=google_auth_failed`,
    session: false
  })(req, res, (err) => {
    if (err) return next(err);
    handleOAuthSuccess(req, res, 'Google');
  });
});

// ========================================
// MICROSOFT OAUTH ROUTES
// ========================================

/**
 * GET /api/auth/microsoft
 * Initiate Microsoft OAuth login
 */
router.get('/microsoft', (req, res, next) => {
  if (!process.env.MICROSOFT_CLIENT_ID) {
    return res.status(503).json({ error: 'Microsoft OAuth not configured' });
  }
  passport.authenticate('microsoft', { scope: ['user.read'], prompt: 'select_account' })(req, res, next);
});

/**
 * GET /api/auth/microsoft/callback
 * Handle Microsoft OAuth callback
 */
router.get('/microsoft/callback', (req, res, next) => {
  const FRONTEND_URL = getFrontendUrl();
  passport.authenticate('microsoft', {
    failureRedirect: `${FRONTEND_URL}/login?error=microsoft_auth_failed`,
    session: false
  })(req, res, (err) => {
    if (err) return next(err);
    handleOAuthSuccess(req, res, 'Microsoft');
  });
});

// ========================================
// OAUTH STATUS CHECK
// ========================================

/**
 * GET /api/auth/oauth/status
 * Check which OAuth providers are configured
 */
router.get('/oauth/status', (req, res) => {
  res.json({
    google: !!process.env.GOOGLE_CLIENT_ID,
    microsoft: !!process.env.MICROSOFT_CLIENT_ID
  });
});

module.exports = router;
