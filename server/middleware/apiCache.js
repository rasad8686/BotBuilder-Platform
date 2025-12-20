/**
 * API Response Cache Middleware
 *
 * Caches API responses in Redis for improved performance.
 * Supports cache-control headers and conditional caching.
 */

const { getRedisClient, isRedisConnected, CACHE_TTL, CACHE_PREFIX } = require('../config/redis');
const log = require('../utils/logger');
const crypto = require('crypto');

/**
 * Generate cache key from request
 * @param {Object} req - Express request object
 * @returns {string} Cache key
 */
function generateCacheKey(req) {
  const userId = req.user?.id || 'anonymous';
  const orgId = req.headers['x-organization-id'] || 'default';

  // Create hash of query params for uniqueness
  const queryHash = crypto
    .createHash('md5')
    .update(JSON.stringify(req.query || {}))
    .digest('hex')
    .substring(0, 8);

  return `${CACHE_PREFIX.API}${req.method}:${req.originalUrl}:${userId}:${orgId}:${queryHash}`;
}

/**
 * Cache API response
 * @param {string} key - Cache key
 * @param {Object} data - Response data
 * @param {number} ttl - Time to live in seconds
 */
async function cacheResponse(key, data, ttl = CACHE_TTL.API_RESPONSE) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const redis = await getRedisClient();

    await redis.setex(key, ttl, JSON.stringify({
      data,
      cachedAt: Date.now(),
      expiresAt: Date.now() + (ttl * 1000)
    }));

    log.debug('API response cached', { key: key.substring(0, 50), ttl });
    return true;
  } catch (error) {
    log.error('API cache set error', { error: error.message });
    return false;
  }
}

/**
 * Get cached API response
 * @param {string} key - Cache key
 * @returns {Object|null} Cached response or null
 */
async function getCachedResponse(key) {
  if (!isRedisConnected()) {
    return null;
  }

  try {
    const redis = await getRedisClient();
    const data = await redis.get(key);

    if (data) {
      const parsed = JSON.parse(data);
      log.debug('API cache hit', { key: key.substring(0, 50) });
      return parsed;
    }

    log.debug('API cache miss', { key: key.substring(0, 50) });
    return null;
  } catch (error) {
    log.error('API cache get error', { error: error.message });
    return null;
  }
}

/**
 * Invalidate API cache by pattern
 * @param {string} pattern - Redis key pattern (e.g., "api:GET:/api/bots*")
 */
async function invalidateByPattern(pattern) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const redis = await getRedisClient();
    const keys = await redis.keys(`${CACHE_PREFIX.API}${pattern}`);

    if (keys.length > 0) {
      await redis.del(...keys);
      log.debug('API cache invalidated by pattern', { pattern, count: keys.length });
    }

    return true;
  } catch (error) {
    log.error('API cache invalidation error', { error: error.message, pattern });
    return false;
  }
}

/**
 * API Cache Middleware Factory
 * @param {Object} options - Cache options
 * @param {number} options.ttl - Time to live in seconds
 * @param {Function} options.keyGenerator - Custom key generator function
 * @param {Function} options.condition - Condition function to determine if should cache
 * @returns {Function} Express middleware
 */
function apiCacheMiddleware(options = {}) {
  const {
    ttl = CACHE_TTL.API_RESPONSE,
    keyGenerator = generateCacheKey,
    condition = () => true
  } = options;

  return async (req, res, next) => {
    // Only cache GET requests by default
    if (req.method !== 'GET') {
      return next();
    }

    // Check custom condition
    if (!condition(req)) {
      return next();
    }

    // Skip if no-cache header
    if (req.headers['cache-control'] === 'no-cache') {
      return next();
    }

    const cacheKey = keyGenerator(req);

    try {
      // Try to get cached response
      const cached = await getCachedResponse(cacheKey);

      if (cached) {
        // Add cache headers
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Age', Math.floor((Date.now() - cached.cachedAt) / 1000));

        return res.json(cached.data);
      }

      // Cache miss - intercept response
      res.setHeader('X-Cache', 'MISS');

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheResponse(cacheKey, data, ttl).catch(() => {
            // Silent fail for caching
          });
        }

        return originalJson(data);
      };

      next();
    } catch (error) {
      log.error('API cache middleware error', { error: error.message });
      next();
    }
  };
}

/**
 * Cache specific routes with custom TTL
 */
const cacheRoutes = {
  // Bot configurations - cache for 30 minutes
  bots: apiCacheMiddleware({ ttl: CACHE_TTL.BOT_CONFIG }),

  // Organization data - cache for 15 minutes
  organizations: apiCacheMiddleware({ ttl: CACHE_TTL.ORGANIZATION }),

  // User data - cache for 10 minutes
  users: apiCacheMiddleware({ ttl: CACHE_TTL.USER_DATA }),

  // Short cache for frequently changing data
  short: apiCacheMiddleware({ ttl: CACHE_TTL.SHORT }),

  // Medium cache for moderately changing data
  medium: apiCacheMiddleware({ ttl: CACHE_TTL.MEDIUM }),

  // Long cache for rarely changing data
  long: apiCacheMiddleware({ ttl: CACHE_TTL.LONG })
};

module.exports = {
  generateCacheKey,
  cacheResponse,
  getCachedResponse,
  invalidateByPattern,
  apiCacheMiddleware,
  cacheRoutes
};
