/**
 * Session Cache Middleware
 *
 * Caches user sessions in Redis for fast authentication lookups.
 * Falls back to database if Redis is unavailable.
 */

const { getRedisClient, isRedisConnected, CACHE_TTL, CACHE_PREFIX } = require('../config/redis');
const log = require('../utils/logger');

/**
 * Generate session cache key
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID (optional)
 * @returns {string} Cache key
 */
function getSessionKey(userId, sessionId = null) {
  if (sessionId) {
    return `${CACHE_PREFIX.SESSION}${userId}:${sessionId}`;
  }
  return `${CACHE_PREFIX.SESSION}${userId}`;
}

/**
 * Cache session data
 * @param {string} userId - User ID
 * @param {Object} sessionData - Session data to cache
 * @param {number} ttl - Time to live in seconds (default: 24 hours)
 */
async function cacheSession(userId, sessionData, ttl = CACHE_TTL.SESSION) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const redis = await getRedisClient();
    const key = getSessionKey(userId, sessionData.sessionId);

    await redis.setex(key, ttl, JSON.stringify({
      ...sessionData,
      cachedAt: Date.now()
    }));

    log.debug('Session cached', { userId, ttl });
    return true;
  } catch (error) {
    log.error('Session cache error', { error: error.message, userId });
    return false;
  }
}

/**
 * Get cached session
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID (optional)
 * @returns {Object|null} Cached session data or null
 */
async function getCachedSession(userId, sessionId = null) {
  if (!isRedisConnected()) {
    return null;
  }

  try {
    const redis = await getRedisClient();
    const key = getSessionKey(userId, sessionId);

    const data = await redis.get(key);

    if (data) {
      log.debug('Session cache hit', { userId });
      return JSON.parse(data);
    }

    log.debug('Session cache miss', { userId });
    return null;
  } catch (error) {
    log.error('Session cache get error', { error: error.message, userId });
    return null;
  }
}

/**
 * Invalidate session cache
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID (optional, if null invalidates all sessions)
 */
async function invalidateSession(userId, sessionId = null) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const redis = await getRedisClient();

    if (sessionId) {
      // Invalidate specific session
      const key = getSessionKey(userId, sessionId);
      await redis.del(key);
      log.debug('Session invalidated', { userId, sessionId });
    } else {
      // Invalidate all sessions for user
      const pattern = `${CACHE_PREFIX.SESSION}${userId}:*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(...keys);
        log.debug('All sessions invalidated', { userId, count: keys.length });
      }
    }

    return true;
  } catch (error) {
    log.error('Session invalidation error', { error: error.message, userId });
    return false;
  }
}

/**
 * Cache user data for quick lookups
 * @param {string} userId - User ID
 * @param {Object} userData - User data to cache
 * @param {number} ttl - Time to live in seconds
 */
async function cacheUserData(userId, userData, ttl = CACHE_TTL.USER_DATA) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const redis = await getRedisClient();
    const key = `${CACHE_PREFIX.USER}${userId}`;

    // Remove sensitive data before caching
    const safeData = { ...userData };
    delete safeData.password_hash;
    delete safeData.two_factor_secret;

    await redis.setex(key, ttl, JSON.stringify({
      ...safeData,
      cachedAt: Date.now()
    }));

    return true;
  } catch (error) {
    log.error('User data cache error', { error: error.message, userId });
    return false;
  }
}

/**
 * Get cached user data
 * @param {string} userId - User ID
 * @returns {Object|null} Cached user data or null
 */
async function getCachedUserData(userId) {
  if (!isRedisConnected()) {
    return null;
  }

  try {
    const redis = await getRedisClient();
    const key = `${CACHE_PREFIX.USER}${userId}`;

    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    log.error('User data cache get error', { error: error.message, userId });
    return null;
  }
}

/**
 * Invalidate user data cache
 * @param {string} userId - User ID
 */
async function invalidateUserData(userId) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const redis = await getRedisClient();
    const key = `${CACHE_PREFIX.USER}${userId}`;
    await redis.del(key);
    return true;
  } catch (error) {
    log.error('User data cache invalidation error', { error: error.message, userId });
    return false;
  }
}

/**
 * Middleware to check session cache before database lookup
 * Attaches cached session to req.cachedSession if found
 */
function sessionCacheMiddleware(req, res, next) {
  // Skip if no user in request
  if (!req.user || !req.user.id) {
    return next();
  }

  getCachedSession(req.user.id)
    .then(cachedSession => {
      if (cachedSession) {
        req.cachedSession = cachedSession;
      }
      next();
    })
    .catch(() => {
      // Continue without cache on error
      next();
    });
}

module.exports = {
  getSessionKey,
  cacheSession,
  getCachedSession,
  invalidateSession,
  cacheUserData,
  getCachedUserData,
  invalidateUserData,
  sessionCacheMiddleware
};
