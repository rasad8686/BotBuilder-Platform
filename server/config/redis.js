/**
 * Redis Client Configuration
 *
 * Provides Redis connection for:
 * - Session caching
 * - API response caching
 * - Rate limiting
 * - Cache invalidation
 *
 * Supports both local Redis and cloud providers (Redis Cloud, Upstash, etc.)
 */

const Redis = require('ioredis');
const log = require('../utils/logger');

/**
 * Redis connection configuration
 */
const redisConfig = {
  // Connection URL (supports Redis Cloud, Upstash, local)
  url: process.env.REDIS_URL || 'redis://localhost:6379',

  // Connection options
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,

  // Reconnection strategy
  retryStrategy: (times) => {
    if (times > 10) {
      log.error('Redis: Max retry attempts reached, giving up');
      return null; // Stop retrying
    }
    const delay = Math.min(times * 100, 3000);
    log.warn(`Redis: Reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },

  // TLS for production (Redis Cloud, Upstash)
  ...(process.env.NODE_ENV === 'production' && process.env.REDIS_URL?.startsWith('rediss://') && {
    tls: {
      rejectUnauthorized: false
    }
  })
};

/**
 * Create Redis client instance
 */
let redisClient = null;
let isConnected = false;
let connectionPromise = null;

/**
 * Initialize Redis connection
 * @returns {Promise<Redis>} Redis client instance
 */
async function initRedis() {
  if (redisClient && isConnected) {
    return redisClient;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = new Promise((resolve, reject) => {
    try {
      // Parse Redis URL or use config
      if (process.env.REDIS_URL) {
        redisClient = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
          retryStrategy: redisConfig.retryStrategy,
          enableReadyCheck: redisConfig.enableReadyCheck,
          lazyConnect: true,
          ...(process.env.REDIS_URL.startsWith('rediss://') && {
            tls: { rejectUnauthorized: false }
          })
        });
      } else {
        redisClient = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          db: parseInt(process.env.REDIS_DB || '0'),
          maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
          retryStrategy: redisConfig.retryStrategy,
          enableReadyCheck: redisConfig.enableReadyCheck,
          lazyConnect: true
        });
      }

      // Event handlers
      redisClient.on('connect', () => {
        log.info('Redis: Connecting...');
      });

      redisClient.on('ready', () => {
        isConnected = true;
        log.info('Redis: Connected and ready');
        resolve(redisClient);
      });

      redisClient.on('error', (err) => {
        log.error('Redis: Connection error', { error: err.message });
        if (!isConnected) {
          reject(err);
        }
      });

      redisClient.on('close', () => {
        isConnected = false;
        log.warn('Redis: Connection closed');
      });

      redisClient.on('reconnecting', () => {
        log.info('Redis: Reconnecting...');
      });

      // Connect
      redisClient.connect().catch(reject);

    } catch (error) {
      log.error('Redis: Failed to initialize', { error: error.message });
      reject(error);
    }
  });

  return connectionPromise;
}

/**
 * Get Redis client (lazy initialization)
 * @returns {Promise<Redis>} Redis client instance
 */
async function getRedisClient() {
  if (!redisClient || !isConnected) {
    await initRedis();
  }
  return redisClient;
}

/**
 * Check if Redis is available
 * @returns {boolean} Connection status
 */
function isRedisConnected() {
  return isConnected && redisClient !== null;
}

/**
 * Close Redis connection gracefully
 */
async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
      isConnected = false;
      redisClient = null;
      connectionPromise = null;
      log.info('Redis: Connection closed gracefully');
    } catch (error) {
      log.error('Redis: Error closing connection', { error: error.message });
    }
  }
}

/**
 * Default TTL values for different cache types (in seconds)
 */
const CACHE_TTL = {
  SESSION: 60 * 60 * 24, // 24 hours
  API_RESPONSE: 60 * 5, // 5 minutes
  RATE_LIMIT: 60 * 15, // 15 minutes
  USER_DATA: 60 * 10, // 10 minutes
  BOT_CONFIG: 60 * 30, // 30 minutes
  ORGANIZATION: 60 * 15, // 15 minutes
  SHORT: 60, // 1 minute
  MEDIUM: 60 * 5, // 5 minutes
  LONG: 60 * 60, // 1 hour
};

/**
 * Cache key prefixes for namespacing
 */
const CACHE_PREFIX = {
  SESSION: 'session:',
  API: 'api:',
  RATE_LIMIT: 'ratelimit:',
  USER: 'user:',
  BOT: 'bot:',
  ORG: 'org:',
  TEMP: 'temp:'
};

module.exports = {
  initRedis,
  getRedisClient,
  isRedisConnected,
  closeRedis,
  CACHE_TTL,
  CACHE_PREFIX
};
