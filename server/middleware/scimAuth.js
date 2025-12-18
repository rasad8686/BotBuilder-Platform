/**
 * SCIM Authentication Middleware
 * Handles Bearer token authentication for SCIM endpoints
 */

const SCIMService = require('../services/scimService');
const log = require('../utils/logger');

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per window

/**
 * Clean up old rate limit entries
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW) {
      rateLimitStore.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW);

/**
 * SCIM Bearer Token Authentication
 */
const scimAuth = async (req, res, next) => {
  const startTime = Date.now();

  try {
    const authHeader = req.headers.authorization;

    // Check authorization header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logRequest(req, null, 401, 'Missing authorization header', startTime);
      return res.status(401).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '401',
        detail: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7);

    // Validate token
    const config = await SCIMService.validateToken(token);

    if (!config) {
      logRequest(req, null, 401, 'Invalid token', startTime);
      return res.status(401).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '401',
        detail: 'Invalid or expired token'
      });
    }

    // Check if SCIM is enabled
    if (!config.scim_enabled) {
      logRequest(req, config.id, 403, 'SCIM disabled', startTime);
      return res.status(403).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '403',
        detail: 'SCIM is not enabled for this configuration'
      });
    }

    // Rate limiting
    const rateLimitKey = `scim:${config.id}`;
    const rateLimitResult = checkRateLimit(rateLimitKey);

    if (!rateLimitResult.allowed) {
      logRequest(req, config.id, 429, 'Rate limited', startTime);
      return res.status(429).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '429',
        detail: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds`
      });
    }

    // Add rate limit headers
    res.set('X-RateLimit-Limit', RATE_LIMIT_MAX);
    res.set('X-RateLimit-Remaining', rateLimitResult.remaining);
    res.set('X-RateLimit-Reset', Math.ceil((rateLimitResult.windowStart + RATE_LIMIT_WINDOW) / 1000));

    // Attach config to request
    req.ssoConfig = config;

    // Log successful auth
    logRequest(req, config.id, null, null, startTime);

    next();
  } catch (error) {
    log.error('SCIM auth middleware error:', { error: error.message });
    return res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '500',
      detail: 'Authentication error'
    });
  }
};

/**
 * Check rate limit for key
 * @param {string} key - Rate limit key
 * @returns {Object} { allowed, remaining, retryAfter, windowStart }
 */
function checkRateLimit(key) {
  const now = Date.now();
  let data = rateLimitStore.get(key);

  if (!data || now - data.windowStart > RATE_LIMIT_WINDOW) {
    // New window
    data = {
      count: 1,
      windowStart: now
    };
    rateLimitStore.set(key, data);
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      windowStart: now
    };
  }

  data.count++;
  rateLimitStore.set(key, data);

  if (data.count > RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((data.windowStart + RATE_LIMIT_WINDOW - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfter,
      windowStart: data.windowStart
    };
  }

  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX - data.count,
    windowStart: data.windowStart
  };
}

/**
 * Log SCIM request
 */
function logRequest(req, configId, errorStatus, errorMessage, startTime) {
  const duration = Date.now() - startTime;

  const logData = {
    method: req.method,
    path: req.path,
    configId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    duration: `${duration}ms`
  };

  if (errorStatus) {
    logData.status = errorStatus;
    logData.error = errorMessage;
    log.warn('SCIM request failed:', logData);
  } else {
    log.info('SCIM request:', logData);
  }
}

/**
 * SCIM content type middleware
 */
const scimContentType = (req, res, next) => {
  res.set('Content-Type', 'application/scim+json');
  next();
};

/**
 * SCIM error handler middleware
 */
const scimErrorHandler = (err, req, res, next) => {
  log.error('SCIM error:', { error: err.message, stack: err.stack });

  const status = err.status || 500;
  const scimType = err.scimType || null;

  const response = {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    status: status.toString(),
    detail: err.message || 'Internal server error'
  };

  if (scimType) {
    response.scimType = scimType;
  }

  res.status(status).json(response);
};

module.exports = {
  scimAuth,
  scimContentType,
  scimErrorHandler,
  checkRateLimit
};
