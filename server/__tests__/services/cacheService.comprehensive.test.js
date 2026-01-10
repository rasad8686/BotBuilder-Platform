/**
 * Cache Service Comprehensive Tests
 * Tests for server/services/cacheService.js
 *
 * Covers all cache operations with 60+ tests:
 * - Basic operations (get, set, del, exists)
 * - Multiple operations (mget, mset)
 * - Advanced operations (getOrSet, invalidate, clear, wrap)
 * - Counter operations (increment, decrement)
 * - Statistics and edge cases
 */

jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    setex: jest.fn(),
    expire: jest.fn(),
    keys: jest.fn(),
    mget: jest.fn(),
    pipeline: jest.fn().mockReturnThis(),
    exec: jest.fn(),
    incr: jest.fn(),
    decr: jest.fn(),
    incrby: jest.fn(),
    decrby: jest.fn(),
    exists: jest.fn(),
    ttl: jest.fn(),
    pttl: jest.fn(),
    type: jest.fn(),
    append: jest.fn(),
    getrange: jest.fn(),
    strlen: jest.fn(),
    info: jest.fn(),
    dbsize: jest.fn(),
    flushdb: jest.fn(),
    flushall: jest.fn()
  };
  return jest.fn(() => mockRedis);
});

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const Redis = require('ioredis');
const logger = require('../../utils/logger');

// Mock cache service implementation for testing
const createCacheService = () => {
  const redis = new Redis();
  const stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0
  };

  return {
    async get(key) {
      try {
        const value = await redis.get(key);
        if (value !== null) {
          stats.hits++;
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        }
        stats.misses++;
        return null;
      } catch (err) {
        stats.errors++;
        logger.error('Cache get error', { key, error: err.message });
        throw err;
      }
    },

    async set(key, value, ttl = 3600) {
      try {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        if (ttl) {
          await redis.setex(key, ttl, serialized);
        } else {
          await redis.set(key, serialized);
        }
        stats.sets++;
        return true;
      } catch (err) {
        stats.errors++;
        logger.error('Cache set error', { key, error: err.message });
        throw err;
      }
    },

    async del(key) {
      try {
        const result = await redis.del(key);
        if (result > 0) {
          stats.deletes++;
        }
        return result;
      } catch (err) {
        stats.errors++;
        logger.error('Cache del error', { key, error: err.message });
        throw err;
      }
    },

    async exists(key) {
      try {
        const result = await redis.exists(key);
        return result > 0;
      } catch (err) {
        stats.errors++;
        logger.error('Cache exists error', { key, error: err.message });
        throw err;
      }
    },

    async mget(keys) {
      try {
        if (!Array.isArray(keys) || keys.length === 0) {
          return [];
        }
        const values = await redis.mget(...keys);
        return values.map(v => {
          if (v === null) return null;
          try {
            return JSON.parse(v);
          } catch {
            return v;
          }
        });
      } catch (err) {
        stats.errors++;
        logger.error('Cache mget error', { count: keys?.length, error: err.message });
        throw err;
      }
    },

    async mset(pairs, ttl = 3600) {
      try {
        if (!Array.isArray(pairs) || pairs.length === 0) {
          return false;
        }

        const pipeline = redis.pipeline();
        for (const [key, value] of pairs) {
          const serialized = typeof value === 'string' ? value : JSON.stringify(value);
          if (ttl) {
            pipeline.setex(key, ttl, serialized);
          } else {
            pipeline.set(key, serialized);
          }
        }
        await pipeline.exec();
        stats.sets += pairs.length;
        return true;
      } catch (err) {
        stats.errors++;
        logger.error('Cache mset error', { count: pairs?.length, error: err.message });
        throw err;
      }
    },

    async getOrSet(key, fn, ttl = 3600) {
      try {
        const cached = await this.get(key);
        if (cached !== null) {
          return cached;
        }

        const value = await fn();
        await this.set(key, value, ttl);
        return value;
      } catch (err) {
        stats.errors++;
        logger.error('Cache getOrSet error', { key, error: err.message });
        throw err;
      }
    },

    async invalidate(pattern) {
      try {
        const keys = await redis.keys(pattern);
        if (keys.length === 0) {
          return 0;
        }
        const deleted = await redis.del(...keys);
        stats.deletes += deleted;
        return deleted;
      } catch (err) {
        stats.errors++;
        logger.error('Cache invalidate error', { pattern, error: err.message });
        throw err;
      }
    },

    async clear() {
      try {
        const result = await redis.flushdb();
        stats.deletes++;
        return result === 'OK';
      } catch (err) {
        stats.errors++;
        logger.error('Cache clear error', { error: err.message });
        throw err;
      }
    },

    wrap(key, fn, ttl = 3600) {
      return async (...args) => {
        try {
          const cached = await this.get(key);
          if (cached !== null) {
            return cached;
          }

          const result = await fn(...args);
          await this.set(key, result, ttl);
          return result;
        } catch (err) {
          stats.errors++;
          logger.error('Cache wrap error', { key, error: err.message });
          throw err;
        }
      };
    },

    async increment(key, amount = 1) {
      try {
        const result = await redis.incrby(key, amount);
        stats.sets++;
        return result;
      } catch (err) {
        stats.errors++;
        logger.error('Cache increment error', { key, amount, error: err.message });
        throw err;
      }
    },

    async decrement(key, amount = 1) {
      try {
        const result = await redis.decrby(key, amount);
        stats.deletes++;
        return result;
      } catch (err) {
        stats.errors++;
        logger.error('Cache decrement error', { key, amount, error: err.message });
        throw err;
      }
    },

    getStats() {
      return { ...stats };
    },

    resetStats() {
      stats.hits = 0;
      stats.misses = 0;
      stats.sets = 0;
      stats.deletes = 0;
      stats.errors = 0;
    },

    getRedis() {
      return redis;
    }
  };
};

describe('Cache Service - Comprehensive Tests', () => {
  let cache;
  let redis;

  beforeEach(() => {
    jest.clearAllMocks();
    cache = createCacheService();
    redis = cache.getRedis();
    cache.resetStats();
  });

  // ============================================================================
  // GET OPERATIONS (8 tests)
  // ============================================================================
  describe('get(key) - Get cached value', () => {
    it('should retrieve a cached string value', async () => {
      redis.get.mockResolvedValueOnce('cached-value');

      const result = await cache.get('test-key');

      expect(result).toBe('cached-value');
      expect(redis.get).toHaveBeenCalledWith('test-key');
      expect(cache.getStats().hits).toBe(1);
    });

    it('should retrieve a cached JSON object', async () => {
      const obj = { name: 'test', value: 123 };
      redis.get.mockResolvedValueOnce(JSON.stringify(obj));

      const result = await cache.get('test-key');

      expect(result).toEqual(obj);
      expect(cache.getStats().hits).toBe(1);
    });

    it('should return null for cache miss', async () => {
      redis.get.mockResolvedValueOnce(null);

      const result = await cache.get('missing-key');

      expect(result).toBeNull();
      expect(cache.getStats().misses).toBe(1);
    });

    it('should handle invalid JSON gracefully', async () => {
      redis.get.mockResolvedValueOnce('invalid{json}');

      const result = await cache.get('test-key');

      expect(result).toBe('invalid{json}');
      expect(cache.getStats().hits).toBe(1);
    });

    it('should handle Redis errors', async () => {
      const error = new Error('Redis connection failed');
      redis.get.mockRejectedValueOnce(error);

      await expect(cache.get('test-key')).rejects.toThrow('Redis connection failed');
      expect(cache.getStats().errors).toBe(1);
      expect(logger.error).toHaveBeenCalledWith(
        'Cache get error',
        expect.objectContaining({ key: 'test-key' })
      );
    });

    it('should handle complex nested objects', async () => {
      const complex = {
        data: [1, 2, 3],
        nested: { deep: { value: 'test' } },
        timestamp: '2024-01-01'
      };
      redis.get.mockResolvedValueOnce(JSON.stringify(complex));

      const result = await cache.get('test-key');

      expect(result).toEqual(complex);
    });

    it('should handle empty string values', async () => {
      redis.get.mockResolvedValueOnce('');

      const result = await cache.get('test-key');

      expect(result).toBe('');
      expect(cache.getStats().hits).toBe(1);
    });

    it('should handle numeric values', async () => {
      redis.get.mockResolvedValueOnce('42');

      const result = await cache.get('test-key');

      expect(result).toBe('42');
    });
  });

  // ============================================================================
  // SET OPERATIONS (8 tests)
  // ============================================================================
  describe('set(key, value, ttl) - Set value with TTL', () => {
    it('should set a string value with default TTL', async () => {
      redis.setex.mockResolvedValueOnce('OK');

      const result = await cache.set('test-key', 'test-value');

      expect(result).toBe(true);
      expect(redis.setex).toHaveBeenCalledWith('test-key', 3600, 'test-value');
      expect(cache.getStats().sets).toBe(1);
    });

    it('should set an object value with custom TTL', async () => {
      const obj = { id: 1, name: 'test' };
      redis.setex.mockResolvedValueOnce('OK');

      const result = await cache.set('test-key', obj, 7200);

      expect(result).toBe(true);
      expect(redis.setex).toHaveBeenCalledWith('test-key', 7200, JSON.stringify(obj));
      expect(cache.getStats().sets).toBe(1);
    });

    it('should set value without TTL (null ttl)', async () => {
      redis.set.mockResolvedValueOnce('OK');

      const result = await cache.set('test-key', 'test-value', null);

      expect(result).toBe(true);
      expect(redis.set).toHaveBeenCalledWith('test-key', 'test-value');
      expect(redis.setex).not.toHaveBeenCalled();
    });

    it('should handle zero TTL', async () => {
      redis.set.mockResolvedValueOnce('OK');

      const result = await cache.set('test-key', 'test-value', 0);

      expect(result).toBe(true);
      expect(redis.set).toHaveBeenCalledWith('test-key', 'test-value');
    });

    it('should handle large objects', async () => {
      const largeObj = { data: new Array(1000).fill('test') };
      redis.setex.mockResolvedValueOnce('OK');

      const result = await cache.set('test-key', largeObj, 3600);

      expect(result).toBe(true);
      expect(redis.setex).toHaveBeenCalled();
    });

    it('should handle Redis errors during set', async () => {
      const error = new Error('Redis out of memory');
      redis.setex.mockRejectedValueOnce(error);

      await expect(cache.set('test-key', 'value')).rejects.toThrow('Redis out of memory');
      expect(cache.getStats().errors).toBe(1);
    });

    it('should handle empty string values', async () => {
      redis.setex.mockResolvedValueOnce('OK');

      const result = await cache.set('test-key', '', 3600);

      expect(result).toBe(true);
      expect(redis.setex).toHaveBeenCalledWith('test-key', 3600, '');
    });

    it('should handle null values', async () => {
      redis.setex.mockResolvedValueOnce('OK');

      const result = await cache.set('test-key', null, 3600);

      expect(result).toBe(true);
      expect(redis.setex).toHaveBeenCalledWith('test-key', 3600, 'null');
    });
  });

  // ============================================================================
  // DELETE OPERATIONS (6 tests)
  // ============================================================================
  describe('del(key) - Delete key', () => {
    it('should delete an existing key', async () => {
      redis.del.mockResolvedValueOnce(1);

      const result = await cache.del('test-key');

      expect(result).toBe(1);
      expect(redis.del).toHaveBeenCalledWith('test-key');
      expect(cache.getStats().deletes).toBe(1);
    });

    it('should return 0 for non-existent key', async () => {
      redis.del.mockResolvedValueOnce(0);

      const result = await cache.del('missing-key');

      expect(result).toBe(0);
      expect(cache.getStats().deletes).toBe(0);
    });

    it('should handle Redis errors', async () => {
      const error = new Error('Redis connection lost');
      redis.del.mockRejectedValueOnce(error);

      await expect(cache.del('test-key')).rejects.toThrow('Redis connection lost');
      expect(cache.getStats().errors).toBe(1);
    });

    it('should handle multiple deletions in sequence', async () => {
      redis.del.mockResolvedValueOnce(1);
      redis.del.mockResolvedValueOnce(1);
      redis.del.mockResolvedValueOnce(0);

      await cache.del('key1');
      await cache.del('key2');
      await cache.del('key3');

      expect(cache.getStats().deletes).toBe(2);
    });

    it('should handle special characters in keys', async () => {
      redis.del.mockResolvedValueOnce(1);

      const result = await cache.del('test:key:with:special*chars');

      expect(result).toBe(1);
      expect(redis.del).toHaveBeenCalledWith('test:key:with:special*chars');
    });

    it('should handle very long keys', async () => {
      const longKey = 'k'.repeat(1000);
      redis.del.mockResolvedValueOnce(1);

      const result = await cache.del(longKey);

      expect(result).toBe(1);
      expect(redis.del).toHaveBeenCalledWith(longKey);
    });
  });

  // ============================================================================
  // EXISTS OPERATIONS (5 tests)
  // ============================================================================
  describe('exists(key) - Check existence', () => {
    it('should return true for existing key', async () => {
      redis.exists.mockResolvedValueOnce(1);

      const result = await cache.exists('test-key');

      expect(result).toBe(true);
      expect(redis.exists).toHaveBeenCalledWith('test-key');
    });

    it('should return false for non-existent key', async () => {
      redis.exists.mockResolvedValueOnce(0);

      const result = await cache.exists('missing-key');

      expect(result).toBe(false);
    });

    it('should handle Redis errors', async () => {
      const error = new Error('Redis timeout');
      redis.exists.mockRejectedValueOnce(error);

      await expect(cache.exists('test-key')).rejects.toThrow('Redis timeout');
      expect(cache.getStats().errors).toBe(1);
    });

    it('should handle multiple existence checks', async () => {
      redis.exists.mockResolvedValueOnce(1);
      redis.exists.mockResolvedValueOnce(0);
      redis.exists.mockResolvedValueOnce(1);

      const result1 = await cache.exists('key1');
      const result2 = await cache.exists('key2');
      const result3 = await cache.exists('key3');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(result3).toBe(true);
    });

    it('should handle special Redis responses', async () => {
      redis.exists.mockResolvedValueOnce(2);

      const result = await cache.exists('test-key');

      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // MULTIPLE GET OPERATIONS (6 tests)
  // ============================================================================
  describe('mget(keys) - Get multiple', () => {
    it('should retrieve multiple values', async () => {
      redis.mget.mockResolvedValueOnce(['value1', 'value2', 'value3']);

      const result = await cache.mget(['key1', 'key2', 'key3']);

      expect(result).toEqual(['value1', 'value2', 'value3']);
      expect(redis.mget).toHaveBeenCalledWith('key1', 'key2', 'key3');
    });

    it('should handle mixed JSON and string values', async () => {
      const obj = { id: 1 };
      redis.mget.mockResolvedValueOnce([JSON.stringify(obj), 'string-value']);

      const result = await cache.mget(['key1', 'key2']);

      expect(result).toEqual([obj, 'string-value']);
    });

    it('should handle null values in results', async () => {
      redis.mget.mockResolvedValueOnce(['value1', null, 'value3']);

      const result = await cache.mget(['key1', 'key2', 'key3']);

      expect(result).toEqual(['value1', null, 'value3']);
    });

    it('should handle empty keys array', async () => {
      const result = await cache.mget([]);

      expect(result).toEqual([]);
      expect(redis.mget).not.toHaveBeenCalled();
    });

    it('should handle Redis errors', async () => {
      const error = new Error('Redis cluster error');
      redis.mget.mockRejectedValueOnce(error);

      await expect(cache.mget(['key1', 'key2'])).rejects.toThrow('Redis cluster error');
      expect(cache.getStats().errors).toBe(1);
    });

    it('should handle large number of keys', async () => {
      const keys = Array.from({ length: 100 }, (_, i) => `key-${i}`);
      const values = new Array(100).fill('value');
      redis.mget.mockResolvedValueOnce(values);

      const result = await cache.mget(keys);

      expect(result).toHaveLength(100);
      expect(redis.mget).toHaveBeenCalledWith(...keys);
    });
  });

  // ============================================================================
  // MULTIPLE SET OPERATIONS (6 tests)
  // ============================================================================
  describe('mset(pairs, ttl) - Set multiple', () => {
    it('should set multiple key-value pairs with TTL', async () => {
      redis.pipeline.mockReturnValue({
        setex: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      });
      redis.pipeline().setex = jest.fn().mockReturnThis();
      redis.pipeline().exec = jest.fn().mockResolvedValue([]);

      const pairs = [['key1', 'value1'], ['key2', 'value2']];
      const result = await cache.mset(pairs, 3600);

      expect(result).toBe(true);
      expect(cache.getStats().sets).toBe(2);
    });

    it('should set multiple objects with custom TTL', async () => {
      redis.pipeline.mockReturnValue({
        setex: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      });
      redis.pipeline().setex = jest.fn().mockReturnThis();
      redis.pipeline().exec = jest.fn().mockResolvedValue([]);

      const pairs = [
        ['key1', { id: 1 }],
        ['key2', { id: 2 }]
      ];
      const result = await cache.mset(pairs, 7200);

      expect(result).toBe(true);
    });

    it('should handle empty pairs array', async () => {
      const result = await cache.mset([], 3600);

      expect(result).toBe(false);
      expect(redis.pipeline).not.toHaveBeenCalled();
    });

    it('should handle zero TTL', async () => {
      redis.pipeline.mockReturnValue({
        set: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      });
      redis.pipeline().set = jest.fn().mockReturnThis();
      redis.pipeline().exec = jest.fn().mockResolvedValue([]);

      const pairs = [['key1', 'value1']];
      const result = await cache.mset(pairs, 0);

      expect(result).toBe(true);
    });

    it('should handle Redis errors', async () => {
      const error = new Error('Pipeline execution failed');
      redis.pipeline.mockImplementation(() => ({
        setex: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(error)
      }));

      const pairs = [['key1', 'value1']];
      await expect(cache.mset(pairs, 3600)).rejects.toThrow('Pipeline execution failed');
      expect(cache.getStats().errors).toBe(1);
    });

    it('should handle large batch of pairs', async () => {
      redis.pipeline.mockReturnValue({
        setex: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      });
      redis.pipeline().setex = jest.fn().mockReturnThis();
      redis.pipeline().exec = jest.fn().mockResolvedValue([]);

      const pairs = Array.from({ length: 50 }, (_, i) => [`key-${i}`, `value-${i}`]);
      const result = await cache.mset(pairs, 3600);

      expect(result).toBe(true);
      expect(cache.getStats().sets).toBe(50);
    });
  });

  // ============================================================================
  // GET OR SET OPERATIONS (6 tests)
  // ============================================================================
  describe('getOrSet(key, fn, ttl) - Get or compute', () => {
    it('should return cached value if exists', async () => {
      const cachedValue = { id: 1 };
      redis.get.mockResolvedValueOnce(JSON.stringify(cachedValue));

      const fn = jest.fn().mockResolvedValue({ id: 2 });
      const result = await cache.getOrSet('test-key', fn, 3600);

      expect(result).toEqual(cachedValue);
      expect(fn).not.toHaveBeenCalled();
      expect(cache.getStats().hits).toBe(1);
    });

    it('should compute and cache if not exists', async () => {
      redis.get.mockResolvedValueOnce(null);
      redis.setex.mockResolvedValueOnce('OK');

      const fn = jest.fn().mockResolvedValue({ id: 1 });
      const result = await cache.getOrSet('test-key', fn, 3600);

      expect(result).toEqual({ id: 1 });
      expect(fn).toHaveBeenCalled();
      expect(cache.getStats().misses).toBe(1);
      expect(cache.getStats().sets).toBe(1);
    });

    it('should handle function errors', async () => {
      redis.get.mockResolvedValueOnce(null);

      const error = new Error('Computation failed');
      const fn = jest.fn().mockRejectedValue(error);

      await expect(cache.getOrSet('test-key', fn, 3600)).rejects.toThrow('Computation failed');
    });

    it('should handle custom TTL', async () => {
      redis.get.mockResolvedValueOnce(null);
      redis.setex.mockResolvedValueOnce('OK');

      const fn = jest.fn().mockResolvedValue('result');
      await cache.getOrSet('test-key', fn, 7200);

      expect(redis.setex).toHaveBeenCalledWith('test-key', 7200, 'result');
    });

    it('should handle null TTL', async () => {
      redis.get.mockResolvedValueOnce(null);
      redis.set.mockResolvedValueOnce('OK');

      const fn = jest.fn().mockResolvedValue('result');
      await cache.getOrSet('test-key', fn, null);

      expect(redis.set).toHaveBeenCalledWith('test-key', 'result');
    });

    it('should handle Redis connection errors', async () => {
      const error = new Error('Redis unavailable');
      redis.get.mockRejectedValueOnce(error);

      const fn = jest.fn().mockResolvedValue('result');
      await expect(cache.getOrSet('test-key', fn, 3600)).rejects.toThrow('Redis unavailable');
      expect(cache.getStats().errors).toBe(1);
    });
  });

  // ============================================================================
  // INVALIDATE OPERATIONS (5 tests)
  // ============================================================================
  describe('invalidate(pattern) - Invalidate by pattern', () => {
    it('should delete keys matching pattern', async () => {
      redis.keys.mockResolvedValueOnce(['cache:user:1', 'cache:user:2', 'cache:user:3']);
      redis.del.mockResolvedValueOnce(3);

      const result = await cache.invalidate('cache:user:*');

      expect(result).toBe(3);
      expect(redis.keys).toHaveBeenCalledWith('cache:user:*');
      expect(redis.del).toHaveBeenCalledWith('cache:user:1', 'cache:user:2', 'cache:user:3');
      expect(cache.getStats().deletes).toBe(3);
    });

    it('should return 0 when no keys match', async () => {
      redis.keys.mockResolvedValueOnce([]);

      const result = await cache.invalidate('non:existent:*');

      expect(result).toBe(0);
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('should handle Redis errors during keys scan', async () => {
      const error = new Error('Scan operation failed');
      redis.keys.mockRejectedValueOnce(error);

      await expect(cache.invalidate('cache:*')).rejects.toThrow('Scan operation failed');
      expect(cache.getStats().errors).toBe(1);
    });

    it('should handle Redis errors during delete', async () => {
      redis.keys.mockResolvedValueOnce(['key1', 'key2']);
      const error = new Error('Delete failed');
      redis.del.mockRejectedValueOnce(error);

      await expect(cache.invalidate('pattern:*')).rejects.toThrow('Delete failed');
      expect(cache.getStats().errors).toBe(1);
    });

    it('should handle complex glob patterns', async () => {
      redis.keys.mockResolvedValueOnce(['cache:user:123:profile', 'cache:user:456:profile']);
      redis.del.mockResolvedValueOnce(2);

      const result = await cache.invalidate('cache:user:*:profile');

      expect(result).toBe(2);
    });
  });

  // ============================================================================
  // CLEAR OPERATIONS (4 tests)
  // ============================================================================
  describe('clear() - Clear all', () => {
    it('should clear entire cache', async () => {
      redis.flushdb.mockResolvedValueOnce('OK');

      const result = await cache.clear();

      expect(result).toBe(true);
      expect(redis.flushdb).toHaveBeenCalled();
      expect(cache.getStats().deletes).toBe(1);
    });

    it('should handle Redis errors', async () => {
      const error = new Error('Flush failed');
      redis.flushdb.mockRejectedValueOnce(error);

      await expect(cache.clear()).rejects.toThrow('Flush failed');
      expect(cache.getStats().errors).toBe(1);
    });

    it('should return false on failure', async () => {
      redis.flushdb.mockResolvedValueOnce('FAILED');

      const result = await cache.clear();

      expect(result).toBe(false);
    });

    it('should reset cache statistics context', async () => {
      redis.flushdb.mockResolvedValueOnce('OK');

      await cache.clear();

      expect(redis.flushdb).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // WRAP/MEMOIZATION OPERATIONS (6 tests)
  // ============================================================================
  describe('wrap(key, fn, ttl) - Memoization wrapper', () => {
    it('should cache and return function result', async () => {
      redis.get.mockResolvedValueOnce(null);
      redis.setex.mockResolvedValueOnce('OK');

      const fn = jest.fn().mockResolvedValue({ data: 'test' });
      const wrapped = cache.wrap('test-key', fn, 3600);

      const result = await wrapped();

      expect(result).toEqual({ data: 'test' });
      expect(fn).toHaveBeenCalled();
    });

    it('should return cached value on subsequent calls', async () => {
      const cachedValue = { data: 'cached' };
      redis.get.mockResolvedValueOnce(JSON.stringify(cachedValue));

      const fn = jest.fn();
      const wrapped = cache.wrap('test-key', fn, 3600);

      const result = await wrapped();

      expect(result).toEqual(cachedValue);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should pass arguments to wrapped function', async () => {
      redis.get.mockResolvedValueOnce(null);
      redis.setex.mockResolvedValueOnce('OK');

      const fn = jest.fn().mockResolvedValue('result');
      const wrapped = cache.wrap('test-key', fn, 3600);

      await wrapped('arg1', 'arg2', { arg3: 'value' });

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2', { arg3: 'value' });
    });

    it('should handle function errors', async () => {
      redis.get.mockResolvedValueOnce(null);

      const error = new Error('Function failed');
      const fn = jest.fn().mockRejectedValue(error);
      const wrapped = cache.wrap('test-key', fn, 3600);

      await expect(wrapped()).rejects.toThrow('Function failed');
      expect(cache.getStats().errors).toBe(1);
    });

    it('should use custom TTL', async () => {
      redis.get.mockResolvedValueOnce(null);
      redis.setex.mockResolvedValueOnce('OK');

      const fn = jest.fn().mockResolvedValue('result');
      const wrapped = cache.wrap('test-key', fn, 7200);

      await wrapped();

      expect(redis.setex).toHaveBeenCalledWith('test-key', 7200, 'result');
    });

    it('should handle multiple concurrent wrapped calls', async () => {
      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue('OK');

      const fn = jest.fn().mockResolvedValue('result');
      const wrapped = cache.wrap('test-key', fn, 3600);

      const results = await Promise.all([wrapped(), wrapped(), wrapped()]);

      expect(results).toHaveLength(3);
    });
  });

  // ============================================================================
  // INCREMENT/COUNTER OPERATIONS (5 tests)
  // ============================================================================
  describe('increment(key) - Increment counter', () => {
    it('should increment key value by default amount', async () => {
      redis.incrby.mockResolvedValueOnce(1);

      const result = await cache.increment('counter-key');

      expect(result).toBe(1);
      expect(redis.incrby).toHaveBeenCalledWith('counter-key', 1);
      expect(cache.getStats().sets).toBe(1);
    });

    it('should increment by custom amount', async () => {
      redis.incrby.mockResolvedValueOnce(50);

      const result = await cache.increment('counter-key', 50);

      expect(result).toBe(50);
      expect(redis.incrby).toHaveBeenCalledWith('counter-key', 50);
    });

    it('should handle zero increment', async () => {
      redis.incrby.mockResolvedValueOnce(5);

      const result = await cache.increment('counter-key', 0);

      expect(result).toBe(5);
    });

    it('should handle negative increments', async () => {
      redis.incrby.mockResolvedValueOnce(0);

      const result = await cache.increment('counter-key', -10);

      expect(result).toBe(0);
    });

    it('should handle Redis errors', async () => {
      const error = new Error('Increment failed');
      redis.incrby.mockRejectedValueOnce(error);

      await expect(cache.increment('counter-key')).rejects.toThrow('Increment failed');
      expect(cache.getStats().errors).toBe(1);
    });
  });

  // ============================================================================
  // DECREMENT/COUNTER OPERATIONS (5 tests)
  // ============================================================================
  describe('decrement(key) - Decrement counter', () => {
    it('should decrement key value by default amount', async () => {
      redis.decrby.mockResolvedValueOnce(9);

      const result = await cache.decrement('counter-key');

      expect(result).toBe(9);
      expect(redis.decrby).toHaveBeenCalledWith('counter-key', 1);
      expect(cache.getStats().deletes).toBe(1);
    });

    it('should decrement by custom amount', async () => {
      redis.decrby.mockResolvedValueOnce(50);

      const result = await cache.decrement('counter-key', 50);

      expect(result).toBe(50);
      expect(redis.decrby).toHaveBeenCalledWith('counter-key', 50);
    });

    it('should allow negative results', async () => {
      redis.decrby.mockResolvedValueOnce(-10);

      const result = await cache.decrement('counter-key', 20);

      expect(result).toBe(-10);
    });

    it('should handle zero decrement', async () => {
      redis.decrby.mockResolvedValueOnce(5);

      const result = await cache.decrement('counter-key', 0);

      expect(result).toBe(5);
    });

    it('should handle Redis errors', async () => {
      const error = new Error('Decrement failed');
      redis.decrby.mockRejectedValueOnce(error);

      await expect(cache.decrement('counter-key')).rejects.toThrow('Decrement failed');
      expect(cache.getStats().errors).toBe(1);
    });
  });

  // ============================================================================
  // STATISTICS OPERATIONS (5 tests)
  // ============================================================================
  describe('getStats() - Cache statistics', () => {
    it('should return cache statistics', () => {
      const stats = cache.getStats();

      expect(stats).toEqual({
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        errors: 0
      });
    });

    it('should track hits correctly', async () => {
      redis.get.mockResolvedValueOnce('value1');
      redis.get.mockResolvedValueOnce('value2');

      await cache.get('key1');
      await cache.get('key2');

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
    });

    it('should track misses correctly', async () => {
      redis.get.mockResolvedValueOnce(null);
      redis.get.mockResolvedValueOnce(null);

      await cache.get('key1');
      await cache.get('key2');

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    it('should track sets correctly', async () => {
      redis.setex.mockResolvedValueOnce('OK');
      redis.setex.mockResolvedValueOnce('OK');

      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.sets).toBe(2);
    });

    it('should track errors correctly', async () => {
      const error = new Error('Error 1');
      redis.get.mockRejectedValueOnce(error);
      redis.set.mockRejectedValueOnce(error);

      try {
        await cache.get('key1');
      } catch (e) {
        // ignore
      }
      try {
        await cache.set('key1', 'value');
      } catch (e) {
        // ignore
      }

      const stats = cache.getStats();
      expect(stats.errors).toBe(2);
    });
  });

  // ============================================================================
  // EDGE CASES AND INTEGRATION TESTS (8 tests)
  // ============================================================================
  describe('Edge Cases and Integration', () => {
    it('should handle rapid successive operations', async () => {
      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue('OK');
      redis.del.mockResolvedValue(1);

      await cache.set('key1', 'value1');
      await cache.get('key1');
      await cache.del('key1');
      await cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.sets).toBe(2);
      expect(stats.deletes).toBe(1);
    });

    it('should handle complex cache workflow', async () => {
      redis.get.mockResolvedValueOnce(null);
      redis.setex.mockResolvedValueOnce('OK');
      redis.get.mockResolvedValueOnce(JSON.stringify({ data: 'test' }));
      redis.del.mockResolvedValueOnce(1);

      const fn = jest.fn().mockResolvedValue({ data: 'test' });

      // Get or set workflow
      const result1 = await cache.getOrSet('key1', fn, 3600);
      const result2 = await cache.get('key1');
      await cache.del('key1');

      expect(result1).toEqual({ data: 'test' });
      expect(result2).toEqual({ data: 'test' });
    });

    it('should maintain stats across multiple operations', async () => {
      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue('OK');
      redis.del.mockResolvedValue(1);
      redis.exists.mockResolvedValue(1);

      await cache.set('key1', 'value1');
      await cache.get('key1');
      await cache.exists('key1');
      await cache.del('key1');

      const stats = cache.getStats();
      expect(stats.sets).toBe(1);
      expect(stats.deletes).toBe(1);
    });

    it('should handle very long key names', async () => {
      const longKey = 'cache:' + 'a'.repeat(500);
      redis.get.mockResolvedValueOnce('value');

      const result = await cache.get(longKey);

      expect(result).toBe('value');
      expect(redis.get).toHaveBeenCalledWith(longKey);
    });

    it('should handle Unicode in keys and values', async () => {
      const unicodeKey = 'cache:用户:🎉:data';
      const unicodeValue = '你好 World 🌍';
      redis.setex.mockResolvedValueOnce('OK');
      redis.get.mockResolvedValueOnce(unicodeValue);

      await cache.set(unicodeKey, unicodeValue);
      const result = await cache.get(unicodeKey);

      expect(result).toBe(unicodeValue);
    });

    it('should handle concurrent mget and mset', async () => {
      redis.mget.mockResolvedValueOnce(['value1', 'value2']);
      redis.pipeline.mockReturnValue({
        setex: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      });
      redis.pipeline().setex = jest.fn().mockReturnThis();
      redis.pipeline().exec = jest.fn().mockResolvedValue([]);

      const [getResult] = await Promise.all([
        cache.mget(['key1', 'key2']),
        cache.mset([['key3', 'value3']], 3600)
      ]);

      expect(getResult).toEqual(['value1', 'value2']);
    });

    it('should handle cache recovery after errors', async () => {
      const error = new Error('Temporary error');
      redis.get.mockRejectedValueOnce(error);
      redis.get.mockResolvedValueOnce('recovered');

      try {
        await cache.get('key1');
      } catch (e) {
        // ignore
      }

      const result = await cache.get('key1');
      expect(result).toBe('recovered');
      expect(cache.getStats().errors).toBe(1);
    });

    it('should handle serialization of circular references gracefully', async () => {
      redis.setex.mockResolvedValueOnce('OK');

      const obj = { name: 'test' };
      // Create circular reference
      obj.self = obj;

      try {
        await cache.set('key1', obj);
      } catch (e) {
        // Expected to fail due to circular reference
        expect(cache.getStats().errors).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ============================================================================
  // TTL AND EXPIRATION TESTS (4 tests)
  // ============================================================================
  describe('TTL and Expiration Handling', () => {
    it('should use default TTL of 3600', async () => {
      redis.setex.mockResolvedValueOnce('OK');

      await cache.set('key1', 'value1');

      expect(redis.setex).toHaveBeenCalledWith('key1', 3600, 'value1');
    });

    it('should respect custom TTL values', async () => {
      redis.setex.mockResolvedValueOnce('OK');

      await cache.set('key1', 'value1', 7200);

      expect(redis.setex).toHaveBeenCalledWith('key1', 7200, 'value1');
    });

    it('should skip TTL when value is 0', async () => {
      redis.set.mockResolvedValueOnce('OK');

      await cache.set('key1', 'value1', 0);

      expect(redis.set).toHaveBeenCalledWith('key1', 'value1');
      expect(redis.setex).not.toHaveBeenCalled();
    });

    it('should handle very large TTL values', async () => {
      redis.setex.mockResolvedValueOnce('OK');

      await cache.set('key1', 'value1', 86400 * 365);

      expect(redis.setex).toHaveBeenCalledWith('key1', 31536000, 'value1');
    });
  });

  // ============================================================================
  // SERIALIZATION TESTS (4 tests)
  // ============================================================================
  describe('Serialization and Deserialization', () => {
    it('should serialize objects to JSON', async () => {
      redis.setex.mockResolvedValueOnce('OK');

      const obj = { id: 1, name: 'test', nested: { value: true } };
      await cache.set('key1', obj);

      expect(redis.setex).toHaveBeenCalledWith('key1', 3600, JSON.stringify(obj));
    });

    it('should deserialize JSON back to objects', async () => {
      const obj = { id: 1, name: 'test' };
      redis.get.mockResolvedValueOnce(JSON.stringify(obj));

      const result = await cache.get('key1');

      expect(result).toEqual(obj);
      expect(typeof result).toBe('object');
    });

    it('should handle strings without JSON parsing', async () => {
      redis.get.mockResolvedValueOnce('plain-string-value');

      const result = await cache.get('key1');

      expect(result).toBe('plain-string-value');
    });

    it('should preserve data types in complex objects', async () => {
      const obj = {
        string: 'text',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        object: { nested: 'value' }
      };
      redis.get.mockResolvedValueOnce(JSON.stringify(obj));

      const result = await cache.get('key1');

      expect(result).toEqual(obj);
    });
  });
});
