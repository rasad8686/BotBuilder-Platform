/**
 * Cache Invalidation Strategy
 *
 * Provides structured cache invalidation patterns:
 * - Entity-based invalidation (user, bot, org changes)
 * - Pattern-based invalidation (wildcard matching)
 * - Event-driven invalidation (pub/sub)
 * - TTL-based automatic expiration
 */

const { getRedisClient, isRedisConnected, CACHE_PREFIX } = require('../config/redis');
const log = require('../utils/logger');

/**
 * Cache invalidation events
 */
const INVALIDATION_EVENTS = {
  USER_UPDATED: 'user:updated',
  USER_DELETED: 'user:deleted',
  BOT_UPDATED: 'bot:updated',
  BOT_DELETED: 'bot:deleted',
  ORG_UPDATED: 'org:updated',
  ORG_DELETED: 'org:deleted',
  SESSION_EXPIRED: 'session:expired',
  CACHE_CLEAR_ALL: 'cache:clear:all'
};

/**
 * Invalidate cache by exact key
 * @param {string} key - Cache key to invalidate
 */
async function invalidateKey(key) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const redis = await getRedisClient();
    await redis.del(key);
    log.debug('Cache key invalidated', { key });
    return true;
  } catch (error) {
    log.error('Cache invalidation error', { error: error.message, key });
    return false;
  }
}

/**
 * Invalidate cache by pattern
 * @param {string} pattern - Redis pattern (e.g., "user:123:*")
 */
async function invalidatePattern(pattern) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const redis = await getRedisClient();

    // Use SCAN for production (non-blocking)
    let cursor = '0';
    let deletedCount = 0;

    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== '0');

    log.debug('Cache pattern invalidated', { pattern, deletedCount });
    return deletedCount;
  } catch (error) {
    log.error('Cache pattern invalidation error', { error: error.message, pattern });
    return 0;
  }
}

/**
 * Invalidate all cache for a user
 * @param {string} userId - User ID
 */
async function invalidateUserCache(userId) {
  const patterns = [
    `${CACHE_PREFIX.USER}${userId}*`,
    `${CACHE_PREFIX.SESSION}${userId}*`,
    `${CACHE_PREFIX.API}*:${userId}:*`
  ];

  let totalDeleted = 0;
  for (const pattern of patterns) {
    totalDeleted += await invalidatePattern(pattern);
  }

  log.info('User cache invalidated', { userId, deletedCount: totalDeleted });
  return totalDeleted;
}

/**
 * Invalidate all cache for a bot
 * @param {string} botId - Bot ID
 */
async function invalidateBotCache(botId) {
  const patterns = [
    `${CACHE_PREFIX.BOT}${botId}*`,
    `${CACHE_PREFIX.API}*:/api/bots/${botId}*`
  ];

  let totalDeleted = 0;
  for (const pattern of patterns) {
    totalDeleted += await invalidatePattern(pattern);
  }

  log.info('Bot cache invalidated', { botId, deletedCount: totalDeleted });
  return totalDeleted;
}

/**
 * Invalidate all cache for an organization
 * @param {string} orgId - Organization ID
 */
async function invalidateOrgCache(orgId) {
  const patterns = [
    `${CACHE_PREFIX.ORG}${orgId}*`,
    `${CACHE_PREFIX.API}*:*:${orgId}:*`
  ];

  let totalDeleted = 0;
  for (const pattern of patterns) {
    totalDeleted += await invalidatePattern(pattern);
  }

  log.info('Organization cache invalidated', { orgId, deletedCount: totalDeleted });
  return totalDeleted;
}

/**
 * Clear all cache (use with caution!)
 * @param {string} prefix - Optional prefix to limit clearing
 */
async function clearAllCache(prefix = null) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const redis = await getRedisClient();

    if (prefix) {
      // Clear specific prefix
      return await invalidatePattern(`${prefix}*`);
    } else {
      // Clear all keys (DANGEROUS - only for development/testing)
      if (process.env.NODE_ENV === 'production') {
        log.warn('Attempted to clear all cache in production - blocked');
        return false;
      }

      await redis.flushdb();
      log.warn('All cache cleared');
      return true;
    }
  } catch (error) {
    log.error('Clear all cache error', { error: error.message });
    return false;
  }
}

/**
 * Publish invalidation event (for distributed systems)
 * @param {string} event - Event type from INVALIDATION_EVENTS
 * @param {Object} data - Event data
 */
async function publishInvalidation(event, data = {}) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const redis = await getRedisClient();
    const channel = 'cache:invalidation';

    await redis.publish(channel, JSON.stringify({
      event,
      data,
      timestamp: Date.now()
    }));

    log.debug('Invalidation event published', { event, data });
    return true;
  } catch (error) {
    log.error('Publish invalidation error', { error: error.message, event });
    return false;
  }
}

/**
 * Subscribe to invalidation events (for distributed systems)
 * @param {Function} handler - Event handler function
 */
async function subscribeToInvalidation(handler) {
  if (!isRedisConnected()) {
    return null;
  }

  try {
    const redis = await getRedisClient();
    const subscriber = redis.duplicate();

    await subscriber.subscribe('cache:invalidation');

    subscriber.on('message', (channel, message) => {
      try {
        const event = JSON.parse(message);
        handler(event);
      } catch (error) {
        log.error('Invalidation event handler error', { error: error.message });
      }
    });

    log.info('Subscribed to cache invalidation events');
    return subscriber;
  } catch (error) {
    log.error('Subscribe to invalidation error', { error: error.message });
    return null;
  }
}

/**
 * Cache invalidation middleware for write operations
 * Automatically invalidates related cache on POST/PUT/PATCH/DELETE
 */
function cacheInvalidationMiddleware(entityType = 'generic') {
  return async (req, res, next) => {
    // Only for write operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to invalidate cache after successful response
    res.json = function(data) {
      // Only invalidate on successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Fire and forget invalidation
        const invalidate = async () => {
          try {
            switch (entityType) {
              case 'user':
                if (req.params.userId || data?.user?.id) {
                  await invalidateUserCache(req.params.userId || data.user.id);
                }
                break;
              case 'bot':
                if (req.params.botId || req.params.id || data?.bot?.id) {
                  await invalidateBotCache(req.params.botId || req.params.id || data.bot.id);
                }
                break;
              case 'org':
                if (req.params.orgId || data?.organization?.id) {
                  await invalidateOrgCache(req.params.orgId || data.organization.id);
                }
                break;
              default:
                // Generic API cache invalidation
                await invalidatePattern(`${CACHE_PREFIX.API}*:${req.originalUrl}*`);
            }
          } catch (error) {
            log.error('Cache invalidation middleware error', { error: error.message });
          }
        };

        invalidate();
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Get cache statistics
 */
async function getCacheStats() {
  if (!isRedisConnected()) {
    return null;
  }

  try {
    const redis = await getRedisClient();
    const info = await redis.info('stats');
    const dbSize = await redis.dbsize();

    // Parse info string
    const stats = {};
    info.split('\r\n').forEach(line => {
      const [key, value] = line.split(':');
      if (key && value) {
        stats[key] = value;
      }
    });

    return {
      totalKeys: dbSize,
      hits: parseInt(stats.keyspace_hits || 0),
      misses: parseInt(stats.keyspace_misses || 0),
      hitRate: stats.keyspace_hits && stats.keyspace_misses
        ? (parseInt(stats.keyspace_hits) / (parseInt(stats.keyspace_hits) + parseInt(stats.keyspace_misses)) * 100).toFixed(2) + '%'
        : 'N/A',
      evictedKeys: parseInt(stats.evicted_keys || 0),
      expiredKeys: parseInt(stats.expired_keys || 0)
    };
  } catch (error) {
    log.error('Get cache stats error', { error: error.message });
    return null;
  }
}

module.exports = {
  INVALIDATION_EVENTS,
  invalidateKey,
  invalidatePattern,
  invalidateUserCache,
  invalidateBotCache,
  invalidateOrgCache,
  clearAllCache,
  publishInvalidation,
  subscribeToInvalidation,
  cacheInvalidationMiddleware,
  getCacheStats
};
