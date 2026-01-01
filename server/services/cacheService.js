/**
 * Cache Service
 *
 * Comprehensive caching service that provides:
 * - Basic cache operations (get, set, delete)
 * - TTL management
 * - Batch operations (mget, mset)
 * - Counter operations (increment, decrement)
 * - Pattern-based operations
 * - Key prefixing and namespacing
 * - Error handling with fallback
 * - Statistics and monitoring
 */

const { getRedisClient, isRedisConnected, CACHE_TTL, CACHE_PREFIX } = require('../config/redis');
const log = require('../utils/logger');

/**
 * Cache Service Class
 */
class CacheService {
  constructor(prefix = '') {
    this.prefix = prefix;
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      sets: 0,
      deletes: 0
    };
  }

  /**
   * Build full cache key with prefix
   * @param {string} key - Cache key
   * @returns {string} Prefixed key
   */
  _buildKey(key) {
    return this.prefix ? `${this.prefix}${key}` : key;
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @param {Object} options - Options
   * @param {boolean} options.parse - Auto-parse JSON (default: true)
   * @returns {Promise<any>} Cached value or null
   */
  async get(key, options = {}) {
    const { parse = true } = options;

    if (!isRedisConnected()) {
      log.warn('Cache get: Redis not connected', { key });
      return null;
    }

    try {
      const redis = await getRedisClient();
      const fullKey = this._buildKey(key);
      const value = await redis.get(fullKey);

      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;

      if (parse) {
        try {
          return JSON.parse(value);
        } catch {
          // Return as-is if not valid JSON
          return value;
        }
      }

      return value;
    } catch (error) {
      this.stats.errors++;
      log.error('Cache get error', { error: error.message, key });
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @param {Object} options - Options
   * @param {boolean} options.stringify - Auto-stringify objects (default: true)
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = null, options = {}) {
    const { stringify = true } = options;

    if (!isRedisConnected()) {
      log.warn('Cache set: Redis not connected', { key });
      return false;
    }

    try {
      const redis = await getRedisClient();
      const fullKey = this._buildKey(key);

      // Stringify if value is object
      let finalValue = value;
      if (stringify && typeof value === 'object') {
        finalValue = JSON.stringify(value);
      }

      // Set with or without TTL
      if (ttl) {
        await redis.setex(fullKey, ttl, finalValue);
      } else {
        await redis.set(fullKey, finalValue);
      }

      this.stats.sets++;
      return true;
    } catch (error) {
      this.stats.errors++;
      log.error('Cache set error', { error: error.message, key });
      return false;
    }
  }

  /**
   * Delete key from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async delete(key) {
    if (!isRedisConnected()) {
      log.warn('Cache delete: Redis not connected', { key });
      return false;
    }

    try {
      const redis = await getRedisClient();
      const fullKey = this._buildKey(key);
      const result = await redis.del(fullKey);

      this.stats.deletes++;
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      log.error('Cache delete error', { error: error.message, key });
      return false;
    }
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Existence status
   */
  async has(key) {
    if (!isRedisConnected()) {
      return false;
    }

    try {
      const redis = await getRedisClient();
      const fullKey = this._buildKey(key);
      const exists = await redis.exists(fullKey);

      return exists === 1;
    } catch (error) {
      this.stats.errors++;
      log.error('Cache has error', { error: error.message, key });
      return false;
    }
  }

  /**
   * Increment counter
   * @param {string} key - Cache key
   * @param {number} amount - Amount to increment (default: 1)
   * @returns {Promise<number|null>} New value or null on error
   */
  async increment(key, amount = 1) {
    if (!isRedisConnected()) {
      log.warn('Cache increment: Redis not connected', { key });
      return null;
    }

    try {
      const redis = await getRedisClient();
      const fullKey = this._buildKey(key);

      const result = await redis.incrby(fullKey, amount);
      return result;
    } catch (error) {
      this.stats.errors++;
      log.error('Cache increment error', { error: error.message, key });
      return null;
    }
  }

  /**
   * Decrement counter
   * @param {string} key - Cache key
   * @param {number} amount - Amount to decrement (default: 1)
   * @returns {Promise<number|null>} New value or null on error
   */
  async decrement(key, amount = 1) {
    if (!isRedisConnected()) {
      log.warn('Cache decrement: Redis not connected', { key });
      return null;
    }

    try {
      const redis = await getRedisClient();
      const fullKey = this._buildKey(key);

      const result = await redis.decrby(fullKey, amount);
      return result;
    } catch (error) {
      this.stats.errors++;
      log.error('Cache decrement error', { error: error.message, key });
      return null;
    }
  }

  /**
   * Get multiple keys at once
   * @param {string[]} keys - Array of cache keys
   * @param {Object} options - Options
   * @param {boolean} options.parse - Auto-parse JSON (default: true)
   * @returns {Promise<Object>} Object with key-value pairs
   */
  async mget(keys, options = {}) {
    const { parse = true } = options;

    if (!isRedisConnected() || !keys || keys.length === 0) {
      return {};
    }

    try {
      const redis = await getRedisClient();
      const fullKeys = keys.map(k => this._buildKey(k));
      const values = await redis.mget(...fullKeys);

      const result = {};
      keys.forEach((key, index) => {
        const value = values[index];

        if (value !== null) {
          this.stats.hits++;
          if (parse) {
            try {
              result[key] = JSON.parse(value);
            } catch {
              result[key] = value;
            }
          } else {
            result[key] = value;
          }
        } else {
          this.stats.misses++;
          result[key] = null;
        }
      });

      return result;
    } catch (error) {
      this.stats.errors++;
      log.error('Cache mget error', { error: error.message, keys });
      return {};
    }
  }

  /**
   * Set multiple keys at once
   * @param {Object} keyValues - Object with key-value pairs
   * @param {number} ttl - Optional TTL for all keys
   * @param {Object} options - Options
   * @param {boolean} options.stringify - Auto-stringify objects (default: true)
   * @returns {Promise<boolean>} Success status
   */
  async mset(keyValues, ttl = null, options = {}) {
    const { stringify = true } = options;

    if (!isRedisConnected() || !keyValues || Object.keys(keyValues).length === 0) {
      return false;
    }

    try {
      const redis = await getRedisClient();

      // If TTL is specified, we need to set each key individually
      if (ttl) {
        const pipeline = redis.pipeline();

        Object.entries(keyValues).forEach(([key, value]) => {
          const fullKey = this._buildKey(key);
          let finalValue = value;

          if (stringify && typeof value === 'object') {
            finalValue = JSON.stringify(value);
          }

          pipeline.setex(fullKey, ttl, finalValue);
        });

        await pipeline.exec();
      } else {
        // Use MSET for better performance without TTL
        const pairs = [];
        Object.entries(keyValues).forEach(([key, value]) => {
          const fullKey = this._buildKey(key);
          let finalValue = value;

          if (stringify && typeof value === 'object') {
            finalValue = JSON.stringify(value);
          }

          pairs.push(fullKey, finalValue);
        });

        await redis.mset(...pairs);
      }

      this.stats.sets += Object.keys(keyValues).length;
      return true;
    } catch (error) {
      this.stats.errors++;
      log.error('Cache mset error', { error: error.message });
      return false;
    }
  }

  /**
   * Update TTL for existing key
   * @param {string} key - Cache key
   * @param {number} ttl - New TTL in seconds
   * @returns {Promise<boolean>} Success status
   */
  async expire(key, ttl) {
    if (!isRedisConnected()) {
      return false;
    }

    try {
      const redis = await getRedisClient();
      const fullKey = this._buildKey(key);
      const result = await redis.expire(fullKey, ttl);

      return result === 1;
    } catch (error) {
      this.stats.errors++;
      log.error('Cache expire error', { error: error.message, key });
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   * @param {string} key - Cache key
   * @returns {Promise<number|null>} Remaining TTL in seconds, -1 if no expiry, -2 if key doesn't exist, null on error
   */
  async ttl(key) {
    if (!isRedisConnected()) {
      return null;
    }

    try {
      const redis = await getRedisClient();
      const fullKey = this._buildKey(key);
      const result = await redis.ttl(fullKey);

      return result;
    } catch (error) {
      this.stats.errors++;
      log.error('Cache ttl error', { error: error.message, key });
      return null;
    }
  }

  /**
   * Clear cache by pattern
   * @param {string} pattern - Redis pattern (e.g., "user:*")
   * @returns {Promise<number>} Number of keys deleted
   */
  async clear(pattern = '*') {
    if (!isRedisConnected()) {
      return 0;
    }

    try {
      const redis = await getRedisClient();
      const fullPattern = this._buildKey(pattern);

      // Use SCAN for safe deletion
      let cursor = '0';
      let deletedCount = 0;

      do {
        const [newCursor, keys] = await redis.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100);
        cursor = newCursor;

        if (keys.length > 0) {
          await redis.del(...keys);
          deletedCount += keys.length;
        }
      } while (cursor !== '0');

      this.stats.deletes += deletedCount;
      return deletedCount;
    } catch (error) {
      this.stats.errors++;
      log.error('Cache clear error', { error: error.message, pattern });
      return 0;
    }
  }

  /**
   * Clear all cache with this prefix
   * @returns {Promise<number>} Number of keys deleted
   */
  async clearAll() {
    return this.clear('*');
  }

  /**
   * Get cache statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : '0.00';

    return {
      ...this.stats,
      total,
      hitRate: `${hitRate}%`
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      sets: 0,
      deletes: 0
    };
  }

  /**
   * Get Redis info
   * @returns {Promise<Object|null>} Redis info or null
   */
  async getRedisInfo() {
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
        keyspaceHits: parseInt(stats.keyspace_hits || 0),
        keyspaceMisses: parseInt(stats.keyspace_misses || 0),
        evictedKeys: parseInt(stats.evicted_keys || 0),
        expiredKeys: parseInt(stats.expired_keys || 0),
        connected: isRedisConnected()
      };
    } catch (error) {
      log.error('Get Redis info error', { error: error.message });
      return null;
    }
  }

  /**
   * Flush all keys in current database (DANGEROUS!)
   * @returns {Promise<boolean>} Success status
   */
  async flush() {
    if (!isRedisConnected()) {
      return false;
    }

    // Prevent accidental flush in production
    if (process.env.NODE_ENV === 'production') {
      log.warn('Cache flush blocked in production');
      return false;
    }

    try {
      const redis = await getRedisClient();
      await redis.flushdb();

      log.warn('Cache flushed');
      return true;
    } catch (error) {
      this.stats.errors++;
      log.error('Cache flush error', { error: error.message });
      return false;
    }
  }

  /**
   * Execute Redis pipeline for batch operations
   * @param {Function} callback - Callback that receives pipeline
   * @returns {Promise<Array>} Pipeline results
   */
  async pipeline(callback) {
    if (!isRedisConnected()) {
      return [];
    }

    try {
      const redis = await getRedisClient();
      const pipeline = redis.pipeline();

      callback(pipeline, this._buildKey.bind(this));

      const results = await pipeline.exec();
      return results || [];
    } catch (error) {
      this.stats.errors++;
      log.error('Cache pipeline error', { error: error.message });
      return [];
    }
  }
}

/**
 * Create cache service instance with prefix
 * @param {string} prefix - Cache key prefix
 * @returns {CacheService} Cache service instance
 */
function createCacheService(prefix = '') {
  return new CacheService(prefix);
}

// Export default instance and factory
const defaultCache = new CacheService();

module.exports = {
  CacheService,
  createCacheService,
  defaultCache,
  CACHE_TTL,
  CACHE_PREFIX
};
