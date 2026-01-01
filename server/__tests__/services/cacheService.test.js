/**
 * Cache Service Tests
 *
 * Comprehensive test suite covering:
 * - Basic operations (get, set, delete, has)
 * - TTL management
 * - Counter operations (increment, decrement)
 * - Batch operations (mget, mset)
 * - Pattern-based operations (clear)
 * - Key prefixing
 * - Error handling and fallback
 * - Statistics tracking
 * - Redis failures
 */

// Mock dependencies FIRST before importing cache service
jest.mock('../../config/redis');
jest.mock('../../utils/logger');

// Then import the mocked modules
const redis = require('../../config/redis');
const log = require('../../utils/logger');

// Finally import the cache service (which will use the mocked modules)
const { CacheService, createCacheService, defaultCache, CACHE_TTL, CACHE_PREFIX } = require('../../services/cacheService');

describe('CacheService', () => {
  let mockRedis;
  let cacheService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock logger functions
    log.debug = jest.fn();
    log.info = jest.fn();
    log.warn = jest.fn();
    log.error = jest.fn();

    // Create mock Redis client
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      incrby: jest.fn(),
      decrby: jest.fn(),
      mget: jest.fn(),
      mset: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      scan: jest.fn(),
      info: jest.fn(),
      dbsize: jest.fn(),
      flushdb: jest.fn(),
      pipeline: jest.fn(() => ({
        setex: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      }))
    };

    // Mock Redis functions - ensure they return the right values
    redis.getRedisClient.mockResolvedValue(mockRedis);
    redis.isRedisConnected.mockReturnValue(true);

    // Create fresh cache service instance
    cacheService = new CacheService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    test('should create instance without prefix', () => {
      const cache = new CacheService();
      expect(cache.prefix).toBe('');
      expect(cache.stats).toBeDefined();
    });

    test('should create instance with prefix', () => {
      const cache = new CacheService('test:');
      expect(cache.prefix).toBe('test:');
    });

    test('should initialize stats object', () => {
      const cache = new CacheService();
      expect(cache.stats).toEqual({
        hits: 0,
        misses: 0,
        errors: 0,
        sets: 0,
        deletes: 0
      });
    });

    test('should create instance via factory function', () => {
      const cache = createCacheService('factory:');
      expect(cache).toBeInstanceOf(CacheService);
      expect(cache.prefix).toBe('factory:');
    });

    test('should provide default cache instance', () => {
      expect(defaultCache).toBeInstanceOf(CacheService);
    });
  });

  describe('get - Get from cache', () => {
    test('should get string value from cache', async () => {
      mockRedis.get.mockResolvedValue('test-value');

      const result = await cacheService.get('test-key');

      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
      expect(result).toBe('test-value');
      expect(cacheService.stats.hits).toBe(1);
    });

    test('should get and parse JSON value from cache', async () => {
      const testData = { foo: 'bar', num: 123 };
      mockRedis.get.mockResolvedValue(JSON.stringify(testData));

      const result = await cacheService.get('test-key');

      expect(result).toEqual(testData);
      expect(cacheService.stats.hits).toBe(1);
    });

    test('should return null for non-existent key', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.get('missing-key');

      expect(result).toBeNull();
      expect(cacheService.stats.misses).toBe(1);
    });

    test('should apply prefix to key', async () => {
      const prefixedCache = new CacheService('prefix:');
      mockRedis.get.mockResolvedValue('value');

      await prefixedCache.get('key');

      expect(mockRedis.get).toHaveBeenCalledWith('prefix:key');
    });

    test('should handle non-JSON values when parse option is true', async () => {
      mockRedis.get.mockResolvedValue('plain-text');

      const result = await cacheService.get('key', { parse: true });

      expect(result).toBe('plain-text');
    });

    test('should not parse when parse option is false', async () => {
      mockRedis.get.mockResolvedValue('{"foo":"bar"}');

      const result = await cacheService.get('key', { parse: false });

      expect(result).toBe('{"foo":"bar"}');
      expect(typeof result).toBe('string');
    });

    test('should return null when Redis not connected', async () => {
      redis.isRedisConnected.mockReturnValue(false);

      const result = await cacheService.get('key');

      expect(result).toBeNull();
      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(log.warn).toHaveBeenCalled();
    });

    test('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.get('key');

      expect(result).toBeNull();
      expect(cacheService.stats.errors).toBe(1);
      expect(log.error).toHaveBeenCalled();
    });

    test('should track cache hits correctly', async () => {
      mockRedis.get.mockResolvedValue('value');

      await cacheService.get('key1');
      await cacheService.get('key2');
      await cacheService.get('key3');

      expect(cacheService.stats.hits).toBe(3);
    });

    test('should track cache misses correctly', async () => {
      mockRedis.get.mockResolvedValue(null);

      await cacheService.get('key1');
      await cacheService.get('key2');

      expect(cacheService.stats.misses).toBe(2);
    });
  });

  describe('set - Set with TTL', () => {
    test('should set string value without TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await cacheService.set('key', 'value');

      expect(mockRedis.set).toHaveBeenCalledWith('key', 'value');
      expect(result).toBe(true);
      expect(cacheService.stats.sets).toBe(1);
    });

    test('should set string value with TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const result = await cacheService.set('key', 'value', 300);

      expect(mockRedis.setex).toHaveBeenCalledWith('key', 300, 'value');
      expect(result).toBe(true);
      expect(cacheService.stats.sets).toBe(1);
    });

    test('should stringify object values by default', async () => {
      mockRedis.set.mockResolvedValue('OK');
      const obj = { foo: 'bar', num: 123 };

      await cacheService.set('key', obj);

      expect(mockRedis.set).toHaveBeenCalledWith('key', JSON.stringify(obj));
    });

    test('should not stringify when stringify option is false', async () => {
      mockRedis.set.mockResolvedValue('OK');
      const obj = { foo: 'bar' };

      await cacheService.set('key', obj, null, { stringify: false });

      expect(mockRedis.set).toHaveBeenCalledWith('key', obj);
    });

    test('should apply prefix to key', async () => {
      const prefixedCache = new CacheService('prefix:');
      mockRedis.set.mockResolvedValue('OK');

      await prefixedCache.set('key', 'value');

      expect(mockRedis.set).toHaveBeenCalledWith('prefix:key', 'value');
    });

    test('should return false when Redis not connected', async () => {
      redis.isRedisConnected.mockReturnValue(false);

      const result = await cacheService.set('key', 'value');

      expect(result).toBe(false);
      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(log.warn).toHaveBeenCalled();
    });

    test('should handle Redis errors gracefully', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.set('key', 'value');

      expect(result).toBe(false);
      expect(cacheService.stats.errors).toBe(1);
      expect(log.error).toHaveBeenCalled();
    });

    test('should handle array values', async () => {
      mockRedis.set.mockResolvedValue('OK');
      const arr = [1, 2, 3];

      await cacheService.set('key', arr);

      expect(mockRedis.set).toHaveBeenCalledWith('key', JSON.stringify(arr));
    });

    test('should handle null values', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await cacheService.set('key', null);

      expect(mockRedis.set).toHaveBeenCalledWith('key', 'null');
    });

    test('should track set operations', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await cacheService.set('key1', 'value1');
      await cacheService.set('key2', 'value2');

      expect(cacheService.stats.sets).toBe(2);
    });
  });

  describe('delete - Remove from cache', () => {
    test('should delete existing key', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await cacheService.delete('key');

      expect(mockRedis.del).toHaveBeenCalledWith('key');
      expect(result).toBe(true);
      expect(cacheService.stats.deletes).toBe(1);
    });

    test('should return false when key does not exist', async () => {
      mockRedis.del.mockResolvedValue(0);

      const result = await cacheService.delete('missing-key');

      expect(result).toBe(false);
      expect(cacheService.stats.deletes).toBe(1);
    });

    test('should apply prefix to key', async () => {
      const prefixedCache = new CacheService('prefix:');
      mockRedis.del.mockResolvedValue(1);

      await prefixedCache.delete('key');

      expect(mockRedis.del).toHaveBeenCalledWith('prefix:key');
    });

    test('should return false when Redis not connected', async () => {
      redis.isRedisConnected.mockReturnValue(false);

      const result = await cacheService.delete('key');

      expect(result).toBe(false);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    test('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.delete('key');

      expect(result).toBe(false);
      expect(cacheService.stats.errors).toBe(1);
      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('has - Check existence', () => {
    test('should return true for existing key', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await cacheService.has('key');

      expect(mockRedis.exists).toHaveBeenCalledWith('key');
      expect(result).toBe(true);
    });

    test('should return false for non-existent key', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await cacheService.has('missing-key');

      expect(result).toBe(false);
    });

    test('should apply prefix to key', async () => {
      const prefixedCache = new CacheService('prefix:');
      mockRedis.exists.mockResolvedValue(1);

      await prefixedCache.has('key');

      expect(mockRedis.exists).toHaveBeenCalledWith('prefix:key');
    });

    test('should return false when Redis not connected', async () => {
      redis.isRedisConnected.mockReturnValue(false);

      const result = await cacheService.has('key');

      expect(result).toBe(false);
      expect(mockRedis.exists).not.toHaveBeenCalled();
    });

    test('should handle Redis errors gracefully', async () => {
      mockRedis.exists.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.has('key');

      expect(result).toBe(false);
      expect(cacheService.stats.errors).toBe(1);
    });
  });

  describe('increment - Counter operations', () => {
    test('should increment counter by 1 by default', async () => {
      mockRedis.incrby.mockResolvedValue(1);

      const result = await cacheService.increment('counter');

      expect(mockRedis.incrby).toHaveBeenCalledWith('counter', 1);
      expect(result).toBe(1);
    });

    test('should increment counter by custom amount', async () => {
      mockRedis.incrby.mockResolvedValue(10);

      const result = await cacheService.increment('counter', 5);

      expect(mockRedis.incrby).toHaveBeenCalledWith('counter', 5);
      expect(result).toBe(10);
    });

    test('should apply prefix to key', async () => {
      const prefixedCache = new CacheService('prefix:');
      mockRedis.incrby.mockResolvedValue(1);

      await prefixedCache.increment('counter');

      expect(mockRedis.incrby).toHaveBeenCalledWith('prefix:counter', 1);
    });

    test('should return null when Redis not connected', async () => {
      redis.isRedisConnected.mockReturnValue(false);

      const result = await cacheService.increment('counter');

      expect(result).toBeNull();
      expect(mockRedis.incrby).not.toHaveBeenCalled();
    });

    test('should handle Redis errors gracefully', async () => {
      mockRedis.incrby.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.increment('counter');

      expect(result).toBeNull();
      expect(cacheService.stats.errors).toBe(1);
    });

    test('should handle negative increments', async () => {
      mockRedis.incrby.mockResolvedValue(-5);

      const result = await cacheService.increment('counter', -5);

      expect(result).toBe(-5);
    });
  });

  describe('decrement - Counter operations', () => {
    test('should decrement counter by 1 by default', async () => {
      mockRedis.decrby.mockResolvedValue(9);

      const result = await cacheService.decrement('counter');

      expect(mockRedis.decrby).toHaveBeenCalledWith('counter', 1);
      expect(result).toBe(9);
    });

    test('should decrement counter by custom amount', async () => {
      mockRedis.decrby.mockResolvedValue(5);

      const result = await cacheService.decrement('counter', 5);

      expect(mockRedis.decrby).toHaveBeenCalledWith('counter', 5);
      expect(result).toBe(5);
    });

    test('should apply prefix to key', async () => {
      const prefixedCache = new CacheService('prefix:');
      mockRedis.decrby.mockResolvedValue(0);

      await prefixedCache.decrement('counter');

      expect(mockRedis.decrby).toHaveBeenCalledWith('prefix:counter', 1);
    });

    test('should return null when Redis not connected', async () => {
      redis.isRedisConnected.mockReturnValue(false);

      const result = await cacheService.decrement('counter');

      expect(result).toBeNull();
      expect(mockRedis.decrby).not.toHaveBeenCalled();
    });

    test('should handle Redis errors gracefully', async () => {
      mockRedis.decrby.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.decrement('counter');

      expect(result).toBeNull();
      expect(cacheService.stats.errors).toBe(1);
    });

    test('should allow negative values', async () => {
      mockRedis.decrby.mockResolvedValue(-10);

      const result = await cacheService.decrement('counter', 5);

      expect(result).toBe(-10);
    });
  });

  describe('mget - Batch get operations', () => {
    test('should get multiple values at once', async () => {
      mockRedis.mget.mockResolvedValue(['value1', 'value2', 'value3']);

      const result = await cacheService.mget(['key1', 'key2', 'key3']);

      expect(mockRedis.mget).toHaveBeenCalledWith('key1', 'key2', 'key3');
      expect(result).toEqual({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3'
      });
      expect(cacheService.stats.hits).toBe(3);
    });

    test('should handle mix of existing and missing keys', async () => {
      mockRedis.mget.mockResolvedValue(['value1', null, 'value3']);

      const result = await cacheService.mget(['key1', 'key2', 'key3']);

      expect(result).toEqual({
        key1: 'value1',
        key2: null,
        key3: 'value3'
      });
      expect(cacheService.stats.hits).toBe(2);
      expect(cacheService.stats.misses).toBe(1);
    });

    test('should parse JSON values by default', async () => {
      mockRedis.mget.mockResolvedValue([
        JSON.stringify({ foo: 'bar' }),
        JSON.stringify([1, 2, 3])
      ]);

      const result = await cacheService.mget(['key1', 'key2']);

      expect(result).toEqual({
        key1: { foo: 'bar' },
        key2: [1, 2, 3]
      });
    });

    test('should not parse when parse option is false', async () => {
      mockRedis.mget.mockResolvedValue(['{"foo":"bar"}', '[1,2,3]']);

      const result = await cacheService.mget(['key1', 'key2'], { parse: false });

      expect(result).toEqual({
        key1: '{"foo":"bar"}',
        key2: '[1,2,3]'
      });
    });

    test('should apply prefix to all keys', async () => {
      const prefixedCache = new CacheService('prefix:');
      mockRedis.mget.mockResolvedValue(['v1', 'v2']);

      await prefixedCache.mget(['key1', 'key2']);

      expect(mockRedis.mget).toHaveBeenCalledWith('prefix:key1', 'prefix:key2');
    });

    test('should return empty object when Redis not connected', async () => {
      redis.isRedisConnected.mockReturnValue(false);

      const result = await cacheService.mget(['key1', 'key2']);

      expect(result).toEqual({});
      expect(mockRedis.mget).not.toHaveBeenCalled();
    });

    test('should return empty object for empty keys array', async () => {
      const result = await cacheService.mget([]);

      expect(result).toEqual({});
      expect(mockRedis.mget).not.toHaveBeenCalled();
    });

    test('should handle Redis errors gracefully', async () => {
      mockRedis.mget.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.mget(['key1', 'key2']);

      expect(result).toEqual({});
      expect(cacheService.stats.errors).toBe(1);
    });

    test('should handle non-JSON values gracefully', async () => {
      mockRedis.mget.mockResolvedValue(['plain-text', 'another-text']);

      const result = await cacheService.mget(['key1', 'key2']);

      expect(result).toEqual({
        key1: 'plain-text',
        key2: 'another-text'
      });
    });
  });

  describe('mset - Batch set operations', () => {
    test('should set multiple values without TTL', async () => {
      mockRedis.mset.mockResolvedValue('OK');

      const result = await cacheService.mset({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3'
      });

      expect(mockRedis.mset).toHaveBeenCalledWith(
        'key1', 'value1',
        'key2', 'value2',
        'key3', 'value3'
      );
      expect(result).toBe(true);
      expect(cacheService.stats.sets).toBe(3);
    });

    test('should set multiple values with TTL using pipeline', async () => {
      const mockPipeline = {
        setex: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const result = await cacheService.mset({
        key1: 'value1',
        key2: 'value2'
      }, 300);

      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(mockPipeline.setex).toHaveBeenCalledWith('key1', 300, 'value1');
      expect(mockPipeline.setex).toHaveBeenCalledWith('key2', 300, 'value2');
      expect(mockPipeline.exec).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    test('should stringify object values by default', async () => {
      mockRedis.mset.mockResolvedValue('OK');

      await cacheService.mset({
        key1: { foo: 'bar' },
        key2: [1, 2, 3]
      });

      expect(mockRedis.mset).toHaveBeenCalledWith(
        'key1', JSON.stringify({ foo: 'bar' }),
        'key2', JSON.stringify([1, 2, 3])
      );
    });

    test('should not stringify when stringify option is false', async () => {
      mockRedis.mset.mockResolvedValue('OK');

      const obj = { foo: 'bar' };
      await cacheService.mset({ key1: obj }, null, { stringify: false });

      expect(mockRedis.mset).toHaveBeenCalledWith('key1', obj);
    });

    test('should apply prefix to all keys', async () => {
      const prefixedCache = new CacheService('prefix:');
      mockRedis.mset.mockResolvedValue('OK');

      await prefixedCache.mset({ key1: 'v1', key2: 'v2' });

      expect(mockRedis.mset).toHaveBeenCalledWith(
        'prefix:key1', 'v1',
        'prefix:key2', 'v2'
      );
    });

    test('should return false when Redis not connected', async () => {
      redis.isRedisConnected.mockReturnValue(false);

      const result = await cacheService.mset({ key: 'value' });

      expect(result).toBe(false);
      expect(mockRedis.mset).not.toHaveBeenCalled();
    });

    test('should return false for empty object', async () => {
      const result = await cacheService.mset({});

      expect(result).toBe(false);
      expect(mockRedis.mset).not.toHaveBeenCalled();
    });

    test('should handle Redis errors gracefully', async () => {
      mockRedis.mset.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.mset({ key: 'value' });

      expect(result).toBe(false);
      expect(cacheService.stats.errors).toBe(1);
    });

    test('should handle single key-value pair', async () => {
      mockRedis.mset.mockResolvedValue('OK');

      await cacheService.mset({ key: 'value' });

      expect(mockRedis.mset).toHaveBeenCalledWith('key', 'value');
      expect(cacheService.stats.sets).toBe(1);
    });
  });

  describe('expire - Update TTL', () => {
    test('should update TTL for existing key', async () => {
      mockRedis.expire.mockResolvedValue(1);

      const result = await cacheService.expire('key', 300);

      expect(mockRedis.expire).toHaveBeenCalledWith('key', 300);
      expect(result).toBe(true);
    });

    test('should return false for non-existent key', async () => {
      mockRedis.expire.mockResolvedValue(0);

      const result = await cacheService.expire('missing-key', 300);

      expect(result).toBe(false);
    });

    test('should apply prefix to key', async () => {
      const prefixedCache = new CacheService('prefix:');
      mockRedis.expire.mockResolvedValue(1);

      await prefixedCache.expire('key', 300);

      expect(mockRedis.expire).toHaveBeenCalledWith('prefix:key', 300);
    });

    test('should return false when Redis not connected', async () => {
      redis.isRedisConnected.mockReturnValue(false);

      const result = await cacheService.expire('key', 300);

      expect(result).toBe(false);
      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    test('should handle Redis errors gracefully', async () => {
      mockRedis.expire.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.expire('key', 300);

      expect(result).toBe(false);
      expect(cacheService.stats.errors).toBe(1);
    });

    test('should accept different TTL values', async () => {
      mockRedis.expire.mockResolvedValue(1);

      await cacheService.expire('key1', 60);
      await cacheService.expire('key2', 3600);
      await cacheService.expire('key3', 86400);

      expect(mockRedis.expire).toHaveBeenCalledWith('key1', 60);
      expect(mockRedis.expire).toHaveBeenCalledWith('key2', 3600);
      expect(mockRedis.expire).toHaveBeenCalledWith('key3', 86400);
    });
  });

  describe('ttl - Get remaining TTL', () => {
    test('should return remaining TTL for key with expiry', async () => {
      mockRedis.ttl.mockResolvedValue(300);

      const result = await cacheService.ttl('key');

      expect(mockRedis.ttl).toHaveBeenCalledWith('key');
      expect(result).toBe(300);
    });

    test('should return -1 for key without expiry', async () => {
      mockRedis.ttl.mockResolvedValue(-1);

      const result = await cacheService.ttl('key');

      expect(result).toBe(-1);
    });

    test('should return -2 for non-existent key', async () => {
      mockRedis.ttl.mockResolvedValue(-2);

      const result = await cacheService.ttl('missing-key');

      expect(result).toBe(-2);
    });

    test('should apply prefix to key', async () => {
      const prefixedCache = new CacheService('prefix:');
      mockRedis.ttl.mockResolvedValue(300);

      await prefixedCache.ttl('key');

      expect(mockRedis.ttl).toHaveBeenCalledWith('prefix:key');
    });

    test('should return null when Redis not connected', async () => {
      redis.isRedisConnected.mockReturnValue(false);

      const result = await cacheService.ttl('key');

      expect(result).toBeNull();
      expect(mockRedis.ttl).not.toHaveBeenCalled();
    });

    test('should handle Redis errors gracefully', async () => {
      mockRedis.ttl.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.ttl('key');

      expect(result).toBeNull();
      expect(cacheService.stats.errors).toBe(1);
    });
  });

  describe('clear - Clear all/pattern', () => {
    test('should clear keys matching pattern', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['10', ['key1', 'key2', 'key3']])
        .mockResolvedValueOnce(['0', ['key4', 'key5']]);
      mockRedis.del.mockResolvedValue(1);

      const result = await cacheService.clear('test:*');

      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'test:*', 'COUNT', 100);
      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
      expect(mockRedis.del).toHaveBeenCalledWith('key4', 'key5');
      expect(result).toBe(5);
    });

    test('should clear all keys with wildcard pattern', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', ['key1', 'key2']]);
      mockRedis.del.mockResolvedValue(1);

      const result = await cacheService.clear('*');

      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', '*', 'COUNT', 100);
      expect(result).toBe(2);
    });

    test('should handle empty scan results', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', []]);

      const result = await cacheService.clear('test:*');

      expect(result).toBe(0);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    test('should apply prefix to pattern', async () => {
      const prefixedCache = new CacheService('prefix:');
      mockRedis.scan.mockResolvedValueOnce(['0', []]);

      await prefixedCache.clear('test:*');

      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'prefix:test:*', 'COUNT', 100);
    });

    test('should return 0 when Redis not connected', async () => {
      redis.isRedisConnected.mockReturnValue(false);

      const result = await cacheService.clear('*');

      expect(result).toBe(0);
      expect(mockRedis.scan).not.toHaveBeenCalled();
    });

    test('should handle Redis errors gracefully', async () => {
      mockRedis.scan.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.clear('*');

      expect(result).toBe(0);
      expect(cacheService.stats.errors).toBe(1);
    });

    test('should track delete operations', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', ['key1', 'key2', 'key3']]);
      mockRedis.del.mockResolvedValue(1);

      await cacheService.clear('*');

      expect(cacheService.stats.deletes).toBe(3);
    });

    test('should handle multiple scan iterations', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['100', ['key1', 'key2']])
        .mockResolvedValueOnce(['200', ['key3', 'key4']])
        .mockResolvedValueOnce(['0', ['key5']]);
      mockRedis.del.mockResolvedValue(1);

      const result = await cacheService.clear('*');

      expect(mockRedis.scan).toHaveBeenCalledTimes(3);
      expect(result).toBe(5);
    });
  });

  describe('clearAll - Clear all with prefix', () => {
    test('should clear all keys with prefix', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', ['key1', 'key2']]);
      mockRedis.del.mockResolvedValue(1);

      const result = await cacheService.clearAll();

      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', '*', 'COUNT', 100);
      expect(result).toBe(2);
    });
  });

  describe('Cache key prefixing', () => {
    test('should build key without prefix', () => {
      const cache = new CacheService();
      const key = cache._buildKey('test');

      expect(key).toBe('test');
    });

    test('should build key with prefix', () => {
      const cache = new CacheService('myapp:');
      const key = cache._buildKey('test');

      expect(key).toBe('myapp:test');
    });

    test('should handle nested prefixes', () => {
      const cache = new CacheService('app:user:');
      const key = cache._buildKey('123');

      expect(key).toBe('app:user:123');
    });

    test('should use CACHE_PREFIX constants', async () => {
      const cache = new CacheService(CACHE_PREFIX.SESSION);
      mockRedis.get.mockResolvedValue('value');

      await cache.get('user123');

      expect(mockRedis.get).toHaveBeenCalledWith(`${CACHE_PREFIX.SESSION}user123`);
    });
  });

  describe('Error handling - Redis failures', () => {
    test('should handle connection errors in get', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection lost'));

      const result = await cacheService.get('key');

      expect(result).toBeNull();
      expect(log.error).toHaveBeenCalledWith('Cache get error', expect.any(Object));
    });

    test('should handle connection errors in set', async () => {
      mockRedis.set.mockRejectedValue(new Error('Connection lost'));

      const result = await cacheService.set('key', 'value');

      expect(result).toBe(false);
      expect(log.error).toHaveBeenCalledWith('Cache set error', expect.any(Object));
    });

    test('should handle connection errors in delete', async () => {
      mockRedis.del.mockRejectedValue(new Error('Connection lost'));

      const result = await cacheService.delete('key');

      expect(result).toBe(false);
    });

    test('should handle timeout errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Operation timed out'));

      const result = await cacheService.get('key');

      expect(result).toBeNull();
      expect(cacheService.stats.errors).toBe(1);
    });

    test('should handle permission errors', async () => {
      mockRedis.set.mockRejectedValue(new Error('NOPERM Operation not permitted'));

      const result = await cacheService.set('key', 'value');

      expect(result).toBe(false);
    });

    test('should continue working after errors', async () => {
      // First call fails
      mockRedis.get.mockRejectedValueOnce(new Error('Error'));
      // Second call succeeds
      mockRedis.get.mockResolvedValueOnce('value');

      const result1 = await cacheService.get('key1');
      const result2 = await cacheService.get('key2');

      expect(result1).toBeNull();
      expect(result2).toBe('value');
    });
  });

  describe('Fallback behavior', () => {
    test('should return null when Redis is disconnected for get', async () => {
      redis.isRedisConnected.mockReturnValue(false);

      const result = await cacheService.get('key');

      expect(result).toBeNull();
      expect(log.warn).toHaveBeenCalled();
    });

    test('should return false when Redis is disconnected for set', async () => {
      redis.isRedisConnected.mockReturnValue(false);

      const result = await cacheService.set('key', 'value');

      expect(result).toBe(false);
      expect(log.warn).toHaveBeenCalled();
    });

    test('should handle reconnection gracefully', async () => {
      // Initially disconnected
      redis.isRedisConnected.mockReturnValueOnce(false);
      const result1 = await cacheService.get('key');

      // Then reconnects
      redis.isRedisConnected.mockReturnValueOnce(true);
      mockRedis.get.mockResolvedValue('value');
      const result2 = await cacheService.get('key');

      expect(result1).toBeNull();
      expect(result2).toBe('value');
    });
  });

  describe('Statistics and monitoring', () => {
    test('should track hit rate correctly', async () => {
      mockRedis.get
        .mockResolvedValueOnce('value1')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('value2')
        .mockResolvedValueOnce(null);

      await cacheService.get('key1');
      await cacheService.get('key2');
      await cacheService.get('key3');
      await cacheService.get('key4');

      const stats = cacheService.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.total).toBe(4);
      expect(stats.hitRate).toBe('50.00%');
    });

    test('should track all operation types', async () => {
      mockRedis.get.mockResolvedValue('value');
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1);
      mockRedis.incrby.mockRejectedValue(new Error('Error'));

      await cacheService.get('key1');
      await cacheService.set('key2', 'value');
      await cacheService.delete('key3');
      await cacheService.increment('key4');

      const stats = cacheService.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.sets).toBe(1);
      expect(stats.deletes).toBe(1);
      expect(stats.errors).toBe(1);
    });

    test('should reset statistics', () => {
      cacheService.stats.hits = 10;
      cacheService.stats.misses = 5;

      cacheService.resetStats();

      expect(cacheService.stats).toEqual({
        hits: 0,
        misses: 0,
        errors: 0,
        sets: 0,
        deletes: 0
      });
    });

    test('should calculate hit rate with no operations', () => {
      const stats = cacheService.getStats();

      expect(stats.hitRate).toBe('0.00%');
    });

    test('should get Redis info', async () => {
      mockRedis.info.mockResolvedValue('keyspace_hits:1000\r\nkeyspace_misses:500\r\nevicted_keys:10\r\nexpired_keys:20');
      mockRedis.dbsize.mockResolvedValue(5000);

      const info = await cacheService.getRedisInfo();

      expect(info).toEqual({
        totalKeys: 5000,
        keyspaceHits: 1000,
        keyspaceMisses: 500,
        evictedKeys: 10,
        expiredKeys: 20,
        connected: true
      });
    });

    test('should return null for Redis info when disconnected', async () => {
      redis.isRedisConnected.mockReturnValue(false);

      const info = await cacheService.getRedisInfo();

      expect(info).toBeNull();
    });

    test('should handle errors in getRedisInfo', async () => {
      mockRedis.info.mockRejectedValue(new Error('Redis error'));

      const info = await cacheService.getRedisInfo();

      expect(info).toBeNull();
      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('flush - Dangerous operations', () => {
    test('should flush database in non-production', async () => {
      process.env.NODE_ENV = 'development';
      mockRedis.flushdb.mockResolvedValue('OK');

      const result = await cacheService.flush();

      expect(mockRedis.flushdb).toHaveBeenCalled();
      expect(result).toBe(true);
      expect(log.warn).toHaveBeenCalledWith('Cache flushed');
    });

    test('should block flush in production', async () => {
      process.env.NODE_ENV = 'production';

      const result = await cacheService.flush();

      expect(result).toBe(false);
      expect(mockRedis.flushdb).not.toHaveBeenCalled();
      expect(log.warn).toHaveBeenCalledWith('Cache flush blocked in production');
    });

    test('should handle flush errors', async () => {
      process.env.NODE_ENV = 'test';
      mockRedis.flushdb.mockRejectedValue(new Error('Flush error'));

      const result = await cacheService.flush();

      expect(result).toBe(false);
      expect(cacheService.stats.errors).toBe(1);
    });

    test('should return false when Redis not connected', async () => {
      redis.isRedisConnected.mockReturnValue(false);

      const result = await cacheService.flush();

      expect(result).toBe(false);
    });
  });

  describe('pipeline - Batch operations', () => {
    test('should execute pipeline successfully', async () => {
      const mockPipeline = {
        get: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 'value1'], [null, 'OK']])
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const results = await cacheService.pipeline((pipeline) => {
        pipeline.get('key1');
        pipeline.set('key2', 'value2');
      });

      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(mockPipeline.exec).toHaveBeenCalled();
      expect(results).toHaveLength(2);
    });

    test('should provide buildKey function to callback', async () => {
      const mockPipeline = {
        exec: jest.fn().mockResolvedValue([])
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const prefixedCache = new CacheService('prefix:');
      let buildKeyFunc;

      await prefixedCache.pipeline((pipeline, buildKey) => {
        buildKeyFunc = buildKey;
      });

      expect(buildKeyFunc('key')).toBe('prefix:key');
    });

    test('should return empty array when Redis not connected', async () => {
      redis.isRedisConnected.mockReturnValue(false);

      const results = await cacheService.pipeline(() => {});

      expect(results).toEqual([]);
    });

    test('should handle pipeline errors', async () => {
      mockRedis.pipeline.mockImplementation(() => {
        throw new Error('Pipeline error');
      });

      const results = await cacheService.pipeline(() => {});

      expect(results).toEqual([]);
      expect(cacheService.stats.errors).toBe(1);
    });

    test('should handle exec errors', async () => {
      const mockPipeline = {
        exec: jest.fn().mockRejectedValue(new Error('Exec error'))
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const results = await cacheService.pipeline(() => {});

      expect(results).toEqual([]);
      expect(cacheService.stats.errors).toBe(1);
    });
  });

  describe('Integration with CACHE_TTL and CACHE_PREFIX', () => {
    test('should export CACHE_TTL constants', () => {
      expect(CACHE_TTL).toBeDefined();
      expect(CACHE_TTL.SESSION).toBeDefined();
      expect(CACHE_TTL.API_RESPONSE).toBeDefined();
    });

    test('should export CACHE_PREFIX constants', () => {
      expect(CACHE_PREFIX).toBeDefined();
      expect(CACHE_PREFIX.SESSION).toBeDefined();
      expect(CACHE_PREFIX.API).toBeDefined();
    });

    test('should use CACHE_TTL in set operation', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.set('key', 'value', CACHE_TTL.SESSION);

      expect(mockRedis.setex).toHaveBeenCalledWith('key', CACHE_TTL.SESSION, 'value');
    });

    test('should use CACHE_PREFIX in constructor', () => {
      const cache = new CacheService(CACHE_PREFIX.USER);

      expect(cache.prefix).toBe(CACHE_PREFIX.USER);
    });
  });

  describe('Edge cases and special scenarios', () => {
    test('should handle very large TTL values', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.set('key', 'value', 999999999);

      expect(mockRedis.setex).toHaveBeenCalledWith('key', 999999999, 'value');
    });

    test('should handle zero TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await cacheService.set('key', 'value', 0);

      // TTL of 0 is falsy, so it uses set instead of setex
      expect(mockRedis.set).toHaveBeenCalledWith('key', 'value');
    });

    test('should handle empty string as key', async () => {
      mockRedis.get.mockResolvedValue('value');

      await cacheService.get('');

      expect(mockRedis.get).toHaveBeenCalledWith('');
    });

    test('should handle empty string as value', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await cacheService.set('key', '');

      expect(mockRedis.set).toHaveBeenCalledWith('key', '');
    });

    test('should handle boolean values', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await cacheService.set('key1', true);
      await cacheService.set('key2', false);

      // Booleans are passed as-is (typeof true !== 'object')
      expect(mockRedis.set).toHaveBeenCalledWith('key1', true);
      expect(mockRedis.set).toHaveBeenCalledWith('key2', false);
    });

    test('should handle number values', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await cacheService.set('key', 12345);

      // Numbers are passed as-is (typeof 12345 !== 'object')
      expect(mockRedis.set).toHaveBeenCalledWith('key', 12345);
    });

    test('should handle undefined values', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await cacheService.set('key', undefined);

      expect(mockRedis.set).toHaveBeenCalled();
    });

    test('should handle special characters in keys', async () => {
      mockRedis.get.mockResolvedValue('value');

      await cacheService.get('key:with:colons');
      await cacheService.get('key-with-dashes');
      await cacheService.get('key_with_underscores');

      expect(mockRedis.get).toHaveBeenCalledWith('key:with:colons');
      expect(mockRedis.get).toHaveBeenCalledWith('key-with-dashes');
      expect(mockRedis.get).toHaveBeenCalledWith('key_with_underscores');
    });

    test('should handle deeply nested objects', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const deepObj = {
        level1: {
          level2: {
            level3: {
              value: 'deep'
            }
          }
        }
      };

      await cacheService.set('key', deepObj);

      expect(mockRedis.set).toHaveBeenCalledWith('key', JSON.stringify(deepObj));
    });

    test('should handle circular reference gracefully', async () => {
      // Circular references will throw during JSON.stringify
      const obj = { name: 'test' };
      obj.self = obj; // Circular reference

      // The cache service will catch the error and return false
      const result = await cacheService.set('key', obj);

      expect(result).toBe(false);
      expect(cacheService.stats.errors).toBe(1);
      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('Module exports', () => {
    test('should export CacheService class', () => {
      expect(CacheService).toBeDefined();
      expect(typeof CacheService).toBe('function');
    });

    test('should export createCacheService factory', () => {
      expect(createCacheService).toBeDefined();
      expect(typeof createCacheService).toBe('function');
    });

    test('should export defaultCache instance', () => {
      expect(defaultCache).toBeDefined();
      expect(defaultCache).toBeInstanceOf(CacheService);
    });

    test('should export CACHE_TTL', () => {
      expect(CACHE_TTL).toBeDefined();
    });

    test('should export CACHE_PREFIX', () => {
      expect(CACHE_PREFIX).toBeDefined();
    });
  });
});
