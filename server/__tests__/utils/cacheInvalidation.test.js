/**
 * Cache Invalidation Tests
 * Comprehensive tests for cache invalidation strategies
 */

jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn(),
  isRedisConnected: jest.fn(),
  CACHE_PREFIX: {
    USER: 'user:',
    SESSION: 'session:',
    API: 'api:',
    BOT: 'bot:',
    ORG: 'org:'
  }
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const {
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
} = require('../../utils/cacheInvalidation');

const { getRedisClient, isRedisConnected } = require('../../config/redis');
const log = require('../../utils/logger');

describe('cacheInvalidation', () => {
  let mockRedis;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedis = {
      del: jest.fn().mockResolvedValue(1),
      scan: jest.fn(),
      flushdb: jest.fn().mockResolvedValue('OK'),
      publish: jest.fn().mockResolvedValue(1),
      duplicate: jest.fn(),
      subscribe: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
      info: jest.fn(),
      dbsize: jest.fn().mockResolvedValue(100)
    };

    getRedisClient.mockResolvedValue(mockRedis);
    isRedisConnected.mockReturnValue(true);
  });

  describe('INVALIDATION_EVENTS', () => {
    it('should define all invalidation events', () => {
      expect(INVALIDATION_EVENTS).toBeDefined();
      expect(INVALIDATION_EVENTS.USER_UPDATED).toBe('user:updated');
      expect(INVALIDATION_EVENTS.USER_DELETED).toBe('user:deleted');
      expect(INVALIDATION_EVENTS.BOT_UPDATED).toBe('bot:updated');
      expect(INVALIDATION_EVENTS.BOT_DELETED).toBe('bot:deleted');
      expect(INVALIDATION_EVENTS.ORG_UPDATED).toBe('org:updated');
      expect(INVALIDATION_EVENTS.ORG_DELETED).toBe('org:deleted');
      expect(INVALIDATION_EVENTS.SESSION_EXPIRED).toBe('session:expired');
      expect(INVALIDATION_EVENTS.CACHE_CLEAR_ALL).toBe('cache:clear:all');
    });

    it('should have unique event values', () => {
      const events = Object.values(INVALIDATION_EVENTS);
      const uniqueEvents = new Set(events);
      expect(events.length).toBe(uniqueEvents.size);
    });
  });

  describe('invalidateKey', () => {
    it('should delete a single key', async () => {
      const result = await invalidateKey('test:key');

      expect(mockRedis.del).toHaveBeenCalledWith('test:key');
      expect(result).toBe(true);
    });

    it('should return false if Redis is not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const result = await invalidateKey('test:key');

      expect(result).toBe(false);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      const result = await invalidateKey('test:key');

      expect(result).toBe(false);
      expect(log.error).toHaveBeenCalled();
    });

    it('should log debug message on success', async () => {
      await invalidateKey('test:key');

      expect(log.debug).toHaveBeenCalledWith('Cache key invalidated', { key: 'test:key' });
    });

    it('should handle special characters in key', async () => {
      const specialKey = 'test:key:with:colons:123';
      await invalidateKey(specialKey);

      expect(mockRedis.del).toHaveBeenCalledWith(specialKey);
    });
  });

  describe('invalidatePattern', () => {
    it('should delete keys matching pattern', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['10', ['key1', 'key2']])
        .mockResolvedValueOnce(['0', ['key3']]);

      const result = await invalidatePattern('user:*');

      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2');
      expect(mockRedis.del).toHaveBeenCalledWith('key3');
      expect(result).toBe(3);
    });

    it('should return 0 if Redis is not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const result = await invalidatePattern('user:*');

      expect(result).toBe(0);
      expect(mockRedis.scan).not.toHaveBeenCalled();
    });

    it('should handle empty scan results', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      const result = await invalidatePattern('user:*');

      expect(result).toBe(0);
    });

    it('should use SCAN with correct parameters', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      await invalidatePattern('test:*');

      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'test:*', 'COUNT', 100);
    });

    it('should handle errors gracefully', async () => {
      mockRedis.scan.mockRejectedValue(new Error('Scan error'));

      const result = await invalidatePattern('user:*');

      expect(result).toBe(0);
      expect(log.error).toHaveBeenCalled();
    });

    it('should iterate through all cursor positions', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['10', ['key1']])
        .mockResolvedValueOnce(['20', ['key2']])
        .mockResolvedValueOnce(['0', ['key3']]);

      await invalidatePattern('user:*');

      expect(mockRedis.scan).toHaveBeenCalledTimes(3);
    });

    it('should log debug message with count', async () => {
      mockRedis.scan.mockResolvedValue(['0', ['key1', 'key2']]);

      await invalidatePattern('test:*');

      expect(log.debug).toHaveBeenCalledWith('Cache pattern invalidated', {
        pattern: 'test:*',
        deletedCount: 2
      });
    });
  });

  describe('invalidateUserCache', () => {
    it('should invalidate all user-related cache', async () => {
      mockRedis.scan.mockResolvedValue(['0', ['key1']]);

      const result = await invalidateUserCache('user123');

      expect(mockRedis.scan).toHaveBeenCalledTimes(3);
      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'user:user123*', 'COUNT', 100);
      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'session:user123*', 'COUNT', 100);
      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'api:*:user123:*', 'COUNT', 100);
    });

    it('should return total deleted count', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['key1', 'key2']])
        .mockResolvedValueOnce(['0', ['key3']])
        .mockResolvedValueOnce(['0', []]);

      const result = await invalidateUserCache('user123');

      expect(result).toBe(3);
    });

    it('should log info message', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      await invalidateUserCache('user123');

      expect(log.info).toHaveBeenCalledWith('User cache invalidated', {
        userId: 'user123',
        deletedCount: 0
      });
    });
  });

  describe('invalidateBotCache', () => {
    it('should invalidate all bot-related cache', async () => {
      mockRedis.scan.mockResolvedValue(['0', ['key1']]);

      await invalidateBotCache('bot456');

      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'bot:bot456*', 'COUNT', 100);
      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'api:*:/api/bots/bot456*', 'COUNT', 100);
    });

    it('should return total deleted count', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['key1', 'key2', 'key3']])
        .mockResolvedValueOnce(['0', ['key4']]);

      const result = await invalidateBotCache('bot456');

      expect(result).toBe(4);
    });

    it('should log info message', async () => {
      mockRedis.scan.mockResolvedValue(['0', ['key1']]);

      await invalidateBotCache('bot456');

      expect(log.info).toHaveBeenCalledWith('Bot cache invalidated', {
        botId: 'bot456',
        deletedCount: 1
      });
    });
  });

  describe('invalidateOrgCache', () => {
    it('should invalidate all organization-related cache', async () => {
      mockRedis.scan.mockResolvedValue(['0', ['key1']]);

      await invalidateOrgCache('org789');

      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'org:org789*', 'COUNT', 100);
      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'api:*:*:org789:*', 'COUNT', 100);
    });

    it('should return total deleted count', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['key1']])
        .mockResolvedValueOnce(['0', ['key2', 'key3']]);

      const result = await invalidateOrgCache('org789');

      expect(result).toBe(3);
    });

    it('should log info message', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      await invalidateOrgCache('org789');

      expect(log.info).toHaveBeenCalledWith('Organization cache invalidated', {
        orgId: 'org789',
        deletedCount: 0
      });
    });
  });

  describe('clearAllCache', () => {
    const originalEnv = process.env.NODE_ENV;

    afterAll(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should clear cache by prefix in development', async () => {
      process.env.NODE_ENV = 'development';
      mockRedis.scan.mockResolvedValue(['0', ['key1', 'key2']]);

      const result = await clearAllCache('user:');

      expect(mockRedis.scan).toHaveBeenCalled();
      expect(result).toBe(2);
    });

    it('should flush all cache in non-production', async () => {
      process.env.NODE_ENV = 'development';

      const result = await clearAllCache();

      expect(mockRedis.flushdb).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should block clearing all cache in production', async () => {
      process.env.NODE_ENV = 'production';

      const result = await clearAllCache();

      expect(mockRedis.flushdb).not.toHaveBeenCalled();
      expect(result).toBe(false);
      expect(log.warn).toHaveBeenCalledWith('Attempted to clear all cache in production - blocked');
    });

    it('should allow prefix clearing in production', async () => {
      process.env.NODE_ENV = 'production';
      mockRedis.scan.mockResolvedValue(['0', ['key1']]);

      const result = await clearAllCache('temp:');

      expect(mockRedis.scan).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('should return false if Redis is not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const result = await clearAllCache();

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockRedis.flushdb.mockRejectedValue(new Error('Flush error'));
      process.env.NODE_ENV = 'development';

      const result = await clearAllCache();

      expect(result).toBe(false);
      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('publishInvalidation', () => {
    it('should publish invalidation event', async () => {
      await publishInvalidation(INVALIDATION_EVENTS.USER_UPDATED, { userId: '123' });

      expect(mockRedis.publish).toHaveBeenCalledWith(
        'cache:invalidation',
        expect.stringContaining('"event":"user:updated"')
      );
      expect(mockRedis.publish).toHaveBeenCalledWith(
        'cache:invalidation',
        expect.stringContaining('"userId":"123"')
      );
    });

    it('should include timestamp in event', async () => {
      const beforeTime = Date.now();
      await publishInvalidation(INVALIDATION_EVENTS.BOT_DELETED, {});
      const afterTime = Date.now();

      const publishedData = JSON.parse(mockRedis.publish.mock.calls[0][1]);
      expect(publishedData.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(publishedData.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should return false if Redis is not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const result = await publishInvalidation(INVALIDATION_EVENTS.USER_UPDATED, {});

      expect(result).toBe(false);
      expect(mockRedis.publish).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockRedis.publish.mockRejectedValue(new Error('Publish error'));

      const result = await publishInvalidation(INVALIDATION_EVENTS.USER_UPDATED, {});

      expect(result).toBe(false);
      expect(log.error).toHaveBeenCalled();
    });

    it('should handle empty data', async () => {
      await publishInvalidation(INVALIDATION_EVENTS.CACHE_CLEAR_ALL);

      expect(mockRedis.publish).toHaveBeenCalled();
      const publishedData = JSON.parse(mockRedis.publish.mock.calls[0][1]);
      expect(publishedData.data).toEqual({});
    });
  });

  describe('subscribeToInvalidation', () => {
    it('should subscribe to invalidation channel', async () => {
      const mockSubscriber = {
        subscribe: jest.fn().mockResolvedValue('OK'),
        on: jest.fn()
      };
      mockRedis.duplicate.mockReturnValue(mockSubscriber);
      const handler = jest.fn();

      await subscribeToInvalidation(handler);

      expect(mockSubscriber.subscribe).toHaveBeenCalledWith('cache:invalidation');
      expect(mockSubscriber.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should call handler when message received', async () => {
      const mockSubscriber = {
        subscribe: jest.fn().mockResolvedValue('OK'),
        on: jest.fn()
      };
      mockRedis.duplicate.mockReturnValue(mockSubscriber);
      const handler = jest.fn();

      await subscribeToInvalidation(handler);

      const messageHandler = mockSubscriber.on.mock.calls[0][1];
      const event = { event: 'test', data: { id: '123' }, timestamp: Date.now() };
      messageHandler('cache:invalidation', JSON.stringify(event));

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should handle invalid JSON gracefully', async () => {
      const mockSubscriber = {
        subscribe: jest.fn().mockResolvedValue('OK'),
        on: jest.fn()
      };
      mockRedis.duplicate.mockReturnValue(mockSubscriber);
      const handler = jest.fn();

      await subscribeToInvalidation(handler);

      const messageHandler = mockSubscriber.on.mock.calls[0][1];
      messageHandler('cache:invalidation', 'invalid-json');

      expect(handler).not.toHaveBeenCalled();
      expect(log.error).toHaveBeenCalled();
    });

    it('should return null if Redis is not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const result = await subscribeToInvalidation(jest.fn());

      expect(result).toBeNull();
    });

    it('should handle subscription errors', async () => {
      mockRedis.duplicate.mockImplementation(() => {
        throw new Error('Duplicate error');
      });

      const result = await subscribeToInvalidation(jest.fn());

      expect(result).toBeNull();
      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('cacheInvalidationMiddleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        method: 'POST',
        params: {},
        originalUrl: '/api/test'
      };
      res = {
        json: jest.fn(),
        statusCode: 200
      };
      next = jest.fn();
    });

    it('should pass through for GET requests', async () => {
      req.method = 'GET';
      const middleware = cacheInvalidationMiddleware();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should invalidate user cache on successful user update', async () => {
      mockRedis.scan.mockResolvedValue(['0', ['key1']]);
      req.params.userId = 'user123';
      const middleware = cacheInvalidationMiddleware('user');

      middleware(req, res, next);

      const originalJson = res.json;
      const data = { user: { id: 'user123' } };
      await res.json(data);

      // Give async operations time to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(next).toHaveBeenCalled();
    });

    it('should invalidate bot cache on successful bot update', async () => {
      mockRedis.scan.mockResolvedValue(['0', ['key1']]);
      req.params.botId = 'bot456';
      const middleware = cacheInvalidationMiddleware('bot');

      middleware(req, res, next);

      await res.json({ bot: { id: 'bot456' } });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(next).toHaveBeenCalled();
    });

    it('should not invalidate on error responses', async () => {
      res.statusCode = 400;
      const middleware = cacheInvalidationMiddleware('user');

      middleware(req, res, next);

      await res.json({ error: 'Bad request' });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRedis.scan).not.toHaveBeenCalled();
    });

    it('should handle DELETE method', async () => {
      req.method = 'DELETE';
      const middleware = cacheInvalidationMiddleware();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle PUT method', async () => {
      req.method = 'PUT';
      const middleware = cacheInvalidationMiddleware();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle PATCH method', async () => {
      req.method = 'PATCH';
      const middleware = cacheInvalidationMiddleware();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      mockRedis.info.mockResolvedValue(
        'keyspace_hits:1000\r\nkeyspace_misses:200\r\nevicted_keys:10\r\nexpired_keys:50'
      );
      mockRedis.dbsize.mockResolvedValue(5000);

      const stats = await getCacheStats();

      expect(stats).toEqual({
        totalKeys: 5000,
        hits: 1000,
        misses: 200,
        hitRate: '83.33%',
        evictedKeys: 10,
        expiredKeys: 50
      });
    });

    it('should return null if Redis is not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const stats = await getCacheStats();

      expect(stats).toBeNull();
    });

    it('should handle missing stats gracefully', async () => {
      mockRedis.info.mockResolvedValue('');
      mockRedis.dbsize.mockResolvedValue(100);

      const stats = await getCacheStats();

      expect(stats).toEqual({
        totalKeys: 100,
        hits: 0,
        misses: 0,
        hitRate: 'N/A',
        evictedKeys: 0,
        expiredKeys: 0
      });
    });

    it('should handle errors gracefully', async () => {
      mockRedis.info.mockRejectedValue(new Error('Info error'));

      const stats = await getCacheStats();

      expect(stats).toBeNull();
      expect(log.error).toHaveBeenCalled();
    });

    it('should calculate hit rate correctly', async () => {
      mockRedis.info.mockResolvedValue('keyspace_hits:750\r\nkeyspace_misses:250');
      mockRedis.dbsize.mockResolvedValue(1000);

      const stats = await getCacheStats();

      expect(stats.hitRate).toBe('75.00%');
    });

    it('should handle zero hits and misses', async () => {
      mockRedis.info.mockResolvedValue('keyspace_hits:0\r\nkeyspace_misses:0');
      mockRedis.dbsize.mockResolvedValue(0);

      const stats = await getCacheStats();

      expect(stats.hitRate).toBe('N/A');
    });
  });
});
