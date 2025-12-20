/**
 * Redis-based Rate Limiter
 *
 * High-performance distributed rate limiting using Redis.
 * Supports sliding window algorithm for accurate rate limiting.
 */

const { getRedisClient, isRedisConnected, CACHE_TTL, CACHE_PREFIX } = require('../config/redis');
const log = require('../utils/logger');

/**
 * Rate limit configuration defaults
 */
const RATE_LIMIT_DEFAULTS = {
  // API rate limits
  API: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // requests per window
    message: 'Too many requests from this IP, please try again later.'
  },
  // Auth rate limits (stricter)
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // requests per window
    message: 'Too many login attempts, please try again later.'
  },
  // Sensitive operations (very strict)
  SENSITIVE: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // requests per window
    message: 'Rate limit exceeded for sensitive operations.'
  }
};

/**
 * Generate rate limit key
 * @param {string} identifier - IP address or user ID
 * @param {string} type - Rate limit type (api, auth, sensitive)
 * @returns {string} Redis key
 */
function getRateLimitKey(identifier, type = 'api') {
  return `${CACHE_PREFIX.RATE_LIMIT}${type}:${identifier}`;
}

/**
 * Check rate limit using sliding window algorithm
 * @param {string} identifier - IP address or user ID
 * @param {Object} options - Rate limit options
 * @returns {Object} Rate limit status
 */
async function checkRateLimit(identifier, options = {}) {
  const {
    windowMs = RATE_LIMIT_DEFAULTS.API.windowMs,
    max = RATE_LIMIT_DEFAULTS.API.max,
    type = 'api'
  } = options;

  // Fallback if Redis not connected
  if (!isRedisConnected()) {
    return {
      allowed: true,
      remaining: max,
      resetTime: Date.now() + windowMs,
      usingFallback: true
    };
  }

  try {
    const redis = await getRedisClient();
    const key = getRateLimitKey(identifier, type);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Use Redis transaction for atomic operations
    const multi = redis.multi();

    // Remove old entries outside the window
    multi.zremrangebyscore(key, 0, windowStart);

    // Count current requests in window
    multi.zcard(key);

    // Add current request
    multi.zadd(key, now, `${now}-${Math.random()}`);

    // Set expiry on the key
    multi.expire(key, Math.ceil(windowMs / 1000));

    const results = await multi.exec();

    // Get count (second command result)
    const currentCount = results[1][1];

    const allowed = currentCount < max;
    const remaining = Math.max(0, max - currentCount - 1);

    // Get oldest entry for reset time
    const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const resetTime = oldest.length > 1
      ? parseInt(oldest[1]) + windowMs
      : now + windowMs;

    return {
      allowed,
      remaining,
      resetTime,
      current: currentCount + 1,
      limit: max
    };
  } catch (error) {
    log.error('Redis rate limit error', { error: error.message, identifier });
    // Allow request on error (fail open)
    return {
      allowed: true,
      remaining: max,
      resetTime: Date.now() + windowMs,
      error: true
    };
  }
}

/**
 * Block an identifier (IP/user) for a duration
 * @param {string} identifier - IP address or user ID
 * @param {number} durationMs - Block duration in milliseconds
 * @param {string} reason - Reason for block
 */
async function blockIdentifier(identifier, durationMs, reason = 'Rate limit exceeded') {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const redis = await getRedisClient();
    const key = `${CACHE_PREFIX.RATE_LIMIT}blocked:${identifier}`;

    await redis.setex(key, Math.ceil(durationMs / 1000), JSON.stringify({
      reason,
      blockedAt: Date.now(),
      expiresAt: Date.now() + durationMs
    }));

    log.warn('Identifier blocked', { identifier, durationMs, reason });
    return true;
  } catch (error) {
    log.error('Block identifier error', { error: error.message, identifier });
    return false;
  }
}

/**
 * Check if identifier is blocked
 * @param {string} identifier - IP address or user ID
 * @returns {Object|null} Block info or null if not blocked
 */
async function isBlocked(identifier) {
  if (!isRedisConnected()) {
    return null;
  }

  try {
    const redis = await getRedisClient();
    const key = `${CACHE_PREFIX.RATE_LIMIT}blocked:${identifier}`;

    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    log.error('Check blocked error', { error: error.message, identifier });
    return null;
  }
}

/**
 * Unblock an identifier
 * @param {string} identifier - IP address or user ID
 */
async function unblockIdentifier(identifier) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const redis = await getRedisClient();
    const key = `${CACHE_PREFIX.RATE_LIMIT}blocked:${identifier}`;
    await redis.del(key);
    log.info('Identifier unblocked', { identifier });
    return true;
  } catch (error) {
    log.error('Unblock identifier error', { error: error.message, identifier });
    return false;
  }
}

/**
 * Redis Rate Limiter Middleware Factory
 * @param {Object} options - Rate limit options
 * @returns {Function} Express middleware
 */
function redisRateLimiter(options = {}) {
  const {
    windowMs = RATE_LIMIT_DEFAULTS.API.windowMs,
    max = RATE_LIMIT_DEFAULTS.API.max,
    message = RATE_LIMIT_DEFAULTS.API.message,
    type = 'api',
    keyGenerator = (req) => req.ip || req.connection.remoteAddress || 'unknown',
    skip = () => false,
    onLimitReached = null
  } = options;

  return async (req, res, next) => {
    // Check if should skip
    if (skip(req)) {
      return next();
    }

    const identifier = keyGenerator(req);

    // Check if blocked
    const blocked = await isBlocked(identifier);
    if (blocked) {
      const remainingMs = blocked.expiresAt - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);

      res.setHeader('Retry-After', Math.ceil(remainingMs / 1000));
      res.setHeader('X-RateLimit-Blocked', 'true');

      return res.status(429).json({
        success: false,
        message: `You are temporarily blocked. Please try again in ${remainingMinutes} minute(s).`,
        blocked: true,
        retryAfter: Math.ceil(remainingMs / 1000)
      });
    }

    // Check rate limit
    const result = await checkRateLimit(identifier, { windowMs, max, type });

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

    if (!result.allowed) {
      // Call onLimitReached callback if provided
      if (onLimitReached) {
        onLimitReached(req, res, identifier);
      }

      res.setHeader('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000));

      return res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
      });
    }

    next();
  };
}

/**
 * Pre-configured rate limiters
 */
const rateLimiters = {
  // Standard API rate limiter
  api: redisRateLimiter({
    ...RATE_LIMIT_DEFAULTS.API,
    type: 'api'
  }),

  // Auth endpoints rate limiter
  auth: redisRateLimiter({
    ...RATE_LIMIT_DEFAULTS.AUTH,
    type: 'auth',
    onLimitReached: async (req, res, identifier) => {
      // Block for 15 minutes after hitting auth rate limit
      await blockIdentifier(identifier, 15 * 60 * 1000, 'Too many auth attempts');
    }
  }),

  // Sensitive operations rate limiter
  sensitive: redisRateLimiter({
    ...RATE_LIMIT_DEFAULTS.SENSITIVE,
    type: 'sensitive'
  })
};

module.exports = {
  getRateLimitKey,
  checkRateLimit,
  blockIdentifier,
  isBlocked,
  unblockIdentifier,
  redisRateLimiter,
  rateLimiters,
  RATE_LIMIT_DEFAULTS
};
