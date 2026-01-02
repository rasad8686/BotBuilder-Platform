/**
 * @fileoverview Service Account Authentication Middleware
 * @description Token-based authentication for service accounts.
 * Unlike user authentication, service accounts don't have sessions.
 * They use long-lived API tokens with higher rate limits.
 * @module middleware/serviceAccountAuth
 */

const db = require('../db');
const crypto = require('crypto');
const log = require('../utils/logger');
const rateLimit = require('express-rate-limit');

/**
 * Service Account Rate Limits
 * Higher limits than user API due to automated nature of service accounts
 */
const SERVICE_ACCOUNT_RATE_LIMITS = {
  free: { requestsPerMinute: 60, requestsPerDay: 5000 },
  pro: { requestsPerMinute: 300, requestsPerDay: 50000 },
  enterprise: { requestsPerMinute: 1000, requestsPerDay: 500000 }
};

/**
 * Rate limiter for service account requests
 * More permissive than user API rate limiter
 */
const serviceAccountLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute (default, adjusted per tier)
  message: {
    success: false,
    message: 'Service account rate limit exceeded. Please slow down your requests.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use token hash as key instead of IP for service accounts
    return req.serviceAccountTokenHash || req.ip;
  }
});

/**
 * Authenticate Service Account Token
 * @description Validates API token and attaches service account info to request.
 * Service accounts use token-only authentication (no JWT/session).
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authenticateServiceAccount = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Service account authentication required. Provide Bearer token.'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization header format'
      });
    }

    // Hash the token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Store for rate limiting
    req.serviceAccountTokenHash = tokenHash;

    // Find token in database
    const tokenResult = await db.query(
      `SELECT
        at.id as token_id,
        at.token_name,
        at.is_active as token_active,
        at.expires_at,
        at.service_account_id,
        at.organization_id,
        at.last_used_at,
        sa.id as sa_id,
        sa.name as sa_name,
        sa.is_active as sa_active,
        o.plan_tier
      FROM api_tokens at
      JOIN service_accounts sa ON at.service_account_id = sa.id
      JOIN organizations o ON at.organization_id = o.id
      WHERE at.token_hash = $1 AND at.is_service_account = true`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      log.warn('[SERVICE_ACCOUNT_AUTH] Invalid token attempt', {
        tokenPreview: token.substring(0, 8) + '...',
        ip: req.ip
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid or unknown service account token'
      });
    }

    const tokenData = tokenResult.rows[0];

    // Check if token is active
    if (!tokenData.token_active) {
      return res.status(401).json({
        success: false,
        message: 'Service account token has been deactivated'
      });
    }

    // Check if service account is active
    if (!tokenData.sa_active) {
      return res.status(401).json({
        success: false,
        message: 'Service account has been deactivated'
      });
    }

    // Check token expiration
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'Service account token has expired'
      });
    }

    // Update last used timestamp (non-blocking)
    db.query(
      'UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
      [tokenData.token_id]
    ).catch(err => {
      log.error('[SERVICE_ACCOUNT_AUTH] Failed to update last_used_at', { error: err.message });
    });

    // Attach service account info to request
    req.serviceAccount = {
      id: tokenData.sa_id,
      name: tokenData.sa_name,
      tokenId: tokenData.token_id,
      tokenName: tokenData.token_name,
      organizationId: tokenData.organization_id,
      planTier: tokenData.plan_tier || 'free'
    };

    // Also set organization for compatibility with other middleware
    req.organization = {
      id: tokenData.organization_id,
      plan_tier: tokenData.plan_tier
    };

    // Set rate limits based on plan tier
    const tier = (tokenData.plan_tier || 'free').toLowerCase();
    req.serviceAccountRateLimits = SERVICE_ACCOUNT_RATE_LIMITS[tier] || SERVICE_ACCOUNT_RATE_LIMITS.free;

    next();
  } catch (error) {
    log.error('[SERVICE_ACCOUNT_AUTH] Authentication error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Service account authentication error'
    });
  }
};

/**
 * Optional Service Account Authentication
 * @description Tries to authenticate as service account, falls through if not.
 * Useful for endpoints that support both user and service account auth.
 */
const optionalServiceAccountAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  // If no Bearer token or already authenticated as user, skip
  if (!authHeader || !authHeader.startsWith('Bearer ') || req.user) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    // Check if this is a service account token
    const tokenResult = await db.query(
      `SELECT at.id, at.is_service_account
       FROM api_tokens at
       WHERE at.token_hash = $1`,
      [tokenHash]
    );

    if (tokenResult.rows.length > 0 && tokenResult.rows[0].is_service_account) {
      // It's a service account token, use full authentication
      return authenticateServiceAccount(req, res, next);
    }

    // Not a service account token, continue with normal flow
    next();
  } catch (error) {
    // Error checking, continue with normal flow
    next();
  }
};

/**
 * Middleware to add service account rate limit headers
 */
const serviceAccountRateLimitHeaders = (req, res, next) => {
  if (req.serviceAccount && req.serviceAccountRateLimits) {
    const limits = req.serviceAccountRateLimits;
    const now = new Date();
    const resetTime = new Date(now);
    resetTime.setMinutes(resetTime.getMinutes() + 1);
    resetTime.setSeconds(0, 0);

    res.setHeader('X-RateLimit-Limit', limits.requestsPerMinute);
    res.setHeader('X-RateLimit-Tier', req.serviceAccount.planTier);
    res.setHeader('X-RateLimit-Reset', Math.floor(resetTime.getTime() / 1000));
    res.setHeader('X-Service-Account', req.serviceAccount.name);
  }
  next();
};

/**
 * Track service account API usage
 * @description Records API usage for service account tokens
 */
const trackServiceAccountUsage = async (req, res, next) => {
  if (!req.serviceAccount) {
    return next();
  }

  const startTime = Date.now();

  // Override res.json to capture response
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    const responseTime = Date.now() - startTime;

    // Record usage (non-blocking)
    db.query(
      `INSERT INTO api_key_usage (
        api_token_id, endpoint, method, status_code,
        response_time_ms, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [
        req.serviceAccount.tokenId,
        req.path,
        req.method,
        res.statusCode,
        responseTime,
        req.ip,
        req.headers['user-agent'] || 'unknown'
      ]
    ).catch(err => {
      log.error('[SERVICE_ACCOUNT_AUTH] Failed to track usage', { error: err.message });
    });

    return originalJson(data);
  };

  next();
};

module.exports = {
  authenticateServiceAccount,
  optionalServiceAccountAuth,
  serviceAccountLimiter,
  serviceAccountRateLimitHeaders,
  trackServiceAccountUsage,
  SERVICE_ACCOUNT_RATE_LIMITS
};
