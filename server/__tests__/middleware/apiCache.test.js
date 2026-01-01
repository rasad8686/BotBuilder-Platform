/**
 * API Cache Middleware Tests
 * Comprehensive tests for Redis-based API response caching
 */

const httpMocks = require('node-mocks-http');

jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn(),
  isRedisConnected: jest.fn(),
  CACHE_TTL: {
    API_RESPONSE: 300,
    BOT_CONFIG: 1800,
    ORGANIZATION: 900,
    USER_DATA: 600,
    SHORT: 60,
    MEDIUM: 300,
    LONG: 3600
  },
  CACHE_PREFIX: {
    API: 'api:'
  }
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const { getRedisClient, isRedisConnected } = require('../../config/redis');
const logger = require('../../utils/logger');
const {
  generateCacheKey,
  cacheResponse,
  getCachedResponse,
  invalidateByPattern,
  apiCacheMiddleware,
  cacheRoutes
} = require('../../middleware/apiCache');

describe('API Cache Middleware', () => {
  let mockRedis;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedis = {
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      keys: jest.fn().mockResolvedValue([]),
      del: jest.fn().mockResolvedValue(1)
    };

    getRedisClient.mockResolvedValue(mockRedis);
    isRedisConnected.mockReturnValue(true);

    mockReq = httpMocks.createRequest({
      method: 'GET',
      originalUrl: '/api/bots',
      path: '/api/bots',
      user: { id: 'user-1' },
      headers: {
        'x-organization-id': 'org-1'
      },
      query: {}
    });

    mockRes = httpMocks.createResponse();
    mockNext = jest.fn();
  });

  describe('generateCacheKey', () => {
    it('should generate key with all components', () => {
      const key = generateCacheKey(mockReq);

      expect(key).toContain('api:');
      expect(key).toContain('GET');
      expect(key).toContain('/api/bots');
      expect(key).toContain('user-1');
      expect(key).toContain('org-1');
    });

    it('should use anonymous for no user', () => {
      mockReq.user = null;

      const key = generateCacheKey(mockReq);

      expect(key).toContain('anonymous');
      expect(key).not.toContain('user-1');
    });

    it('should use default for no organization', () => {
      mockReq.headers = {};

      const key = generateCacheKey(mockReq);

      expect(key).toContain('default');
      expect(key).not.toContain('org-1');
    });

    it('should include query hash for uniqueness', () => {
      mockReq.query = { page: 1, limit: 10 };
      const key1 = generateCacheKey(mockReq);

      mockReq.query = { page: 2, limit: 10 };
      const key2 = generateCacheKey(mockReq);

      expect(key1).not.toBe(key2);
    });

    it('should generate same key for same query params', () => {
      mockReq.query = { page: 1, limit: 10, sort: 'name' };
      const key1 = generateCacheKey(mockReq);

      const key2 = generateCacheKey(mockReq);

      expect(key1).toBe(key2);
    });

    it('should include HTTP method in key', () => {
      mockReq.method = 'POST';

      const key = generateCacheKey(mockReq);

      expect(key).toContain('POST');
    });

    it('should include full URL path', () => {
      mockReq.originalUrl = '/api/bots/123/messages?page=1';

      const key = generateCacheKey(mockReq);

      expect(key).toContain('/api/bots/123/messages?page=1');
    });

    it('should handle undefined query params', () => {
      mockReq.query = undefined;

      const key = generateCacheKey(mockReq);

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
    });

    it('should handle nested query params', () => {
      mockReq.query = { filter: { status: 'active', type: 'bot' }, page: 1 };

      const key = generateCacheKey(mockReq);

      expect(key).toBeDefined();
      expect(key).toContain('api:');
    });

    it('should hash query params to fixed length', () => {
      mockReq.query = { very: 'long', query: 'string', with: 'many', parameters: 'here' };
      const key1 = generateCacheKey(mockReq);

      mockReq.query = { a: 1 };
      const key2 = generateCacheKey(mockReq);

      // Both should have same structure length (8-char hash)
      const hash1 = key1.split(':').pop();
      const hash2 = key2.split(':').pop();
      expect(hash1.length).toBe(hash2.length);
    });
  });

  describe('cacheResponse', () => {
    it('should cache response data', async () => {
      const data = { success: true, items: [] };

      const result = await cacheResponse('test-key', data);

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should include cachedAt timestamp', async () => {
      await cacheResponse('test-key', { data: 'test' });

      const cachedData = JSON.parse(mockRedis.setex.mock.calls[0][2]);
      expect(cachedData.cachedAt).toBeDefined();
      expect(typeof cachedData.cachedAt).toBe('number');
      expect(cachedData.expiresAt).toBeDefined();
    });

    it('should calculate correct expiresAt', async () => {
      const ttl = 600;
      const beforeTime = Date.now();

      await cacheResponse('test-key', { data: 'test' }, ttl);

      const cachedData = JSON.parse(mockRedis.setex.mock.calls[0][2]);
      const afterTime = Date.now();

      expect(cachedData.expiresAt).toBeGreaterThanOrEqual(beforeTime + ttl * 1000);
      expect(cachedData.expiresAt).toBeLessThanOrEqual(afterTime + ttl * 1000);
    });

    it('should use custom TTL', async () => {
      await cacheResponse('test-key', { data: 'test' }, 600);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test-key',
        600,
        expect.any(String)
      );
    });

    it('should use default TTL when not specified', async () => {
      await cacheResponse('test-key', { data: 'test' });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test-key',
        300, // CACHE_TTL.API_RESPONSE
        expect.any(String)
      );
    });

    it('should return false when Redis not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const result = await cacheResponse('test-key', {});

      expect(result).toBe(false);
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should handle Redis errors', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      const result = await cacheResponse('test-key', {});

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'API cache set error',
        expect.objectContaining({ error: 'Redis error' })
      );
    });

    it('should log debug info on successful cache', async () => {
      await cacheResponse('test-key-long-name', { data: 'test' }, 300);

      expect(logger.debug).toHaveBeenCalledWith(
        'API response cached',
        expect.objectContaining({
          key: expect.stringContaining('test-key'),
          ttl: 300
        })
      );
    });

    it('should cache complex nested objects', async () => {
      const complexData = {
        users: [{ id: 1, name: 'Test' }],
        meta: { page: 1, total: 100 },
        nested: { deep: { value: 'test' } }
      };

      await cacheResponse('test-key', complexData);

      const cached = JSON.parse(mockRedis.setex.mock.calls[0][2]);
      expect(cached.data).toEqual(complexData);
    });
  });

  describe('getCachedResponse', () => {
    it('should return cached response', async () => {
      const cachedData = { data: { items: [] }, cachedAt: Date.now() };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await getCachedResponse('test-key');

      expect(result).toEqual(cachedData);
    });

    it('should return null on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await getCachedResponse('test-key');

      expect(result).toBeNull();
    });

    it('should return null when Redis not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const result = await getCachedResponse('test-key');

      expect(result).toBeNull();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should handle Redis errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await getCachedResponse('test-key');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'API cache get error',
        expect.objectContaining({ error: 'Redis error' })
      );
    });

    it('should log cache hit', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ data: 'test', cachedAt: Date.now() }));

      await getCachedResponse('test-key-name');

      expect(logger.debug).toHaveBeenCalledWith(
        'API cache hit',
        expect.objectContaining({ key: expect.stringContaining('test-key') })
      );
    });

    it('should log cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      await getCachedResponse('test-key-name');

      expect(logger.debug).toHaveBeenCalledWith(
        'API cache miss',
        expect.objectContaining({ key: expect.stringContaining('test-key') })
      );
    });

    it('should parse complex JSON correctly', async () => {
      const complexData = {
        data: { nested: { values: [1, 2, 3] } },
        cachedAt: 1234567890
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(complexData));

      const result = await getCachedResponse('test-key');

      expect(result).toEqual(complexData);
      expect(result.data.nested.values).toEqual([1, 2, 3]);
    });
  });

  describe('invalidateByPattern', () => {
    it('should invalidate matching keys', async () => {
      mockRedis.keys.mockResolvedValue(['api:key1', 'api:key2', 'api:key3']);

      const result = await invalidateByPattern('GET:/api/bots*');

      expect(result).toBe(true);
      expect(mockRedis.keys).toHaveBeenCalledWith('api:GET:/api/bots*');
      expect(mockRedis.del).toHaveBeenCalledWith('api:key1', 'api:key2', 'api:key3');
    });

    it('should return true when no keys match', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const result = await invalidateByPattern('nonexistent*');

      expect(result).toBe(true);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should return false when Redis not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const result = await invalidateByPattern('*');

      expect(result).toBe(false);
      expect(mockRedis.keys).not.toHaveBeenCalled();
    });

    it('should handle Redis errors', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const result = await invalidateByPattern('*');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'API cache invalidation error',
        expect.objectContaining({ error: 'Redis error', pattern: '*' })
      );
    });

    it('should log invalidation count', async () => {
      mockRedis.keys.mockResolvedValue(['key1', 'key2']);

      await invalidateByPattern('test*');

      expect(logger.debug).toHaveBeenCalledWith(
        'API cache invalidated by pattern',
        expect.objectContaining({ pattern: 'test*', count: 2 })
      );
    });

    it('should handle single key invalidation', async () => {
      mockRedis.keys.mockResolvedValue(['api:single-key']);

      await invalidateByPattern('GET:/api/bot/1');

      expect(mockRedis.del).toHaveBeenCalledWith('api:single-key');
    });

    it('should prefix pattern with cache prefix', async () => {
      await invalidateByPattern('user:*');

      expect(mockRedis.keys).toHaveBeenCalledWith('api:user:*');
    });
  });

  describe('apiCacheMiddleware', () => {
    it('should skip non-GET requests', async () => {
      mockReq.method = 'POST';
      const middleware = apiCacheMiddleware();

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should skip PUT requests', async () => {
      mockReq.method = 'PUT';
      const middleware = apiCacheMiddleware();

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should skip DELETE requests', async () => {
      mockReq.method = 'DELETE';
      const middleware = apiCacheMiddleware();

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip when no-cache header present', async () => {
      mockReq.headers['cache-control'] = 'no-cache';
      const middleware = apiCacheMiddleware();

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should return cached response on hit', async () => {
      const cachedData = { data: { items: [] }, cachedAt: Date.now() - 1000 };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));
      const middleware = apiCacheMiddleware();

      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes._isEndCalled()).toBe(true);
      expect(JSON.parse(mockRes._getData())).toEqual(cachedData.data);
      expect(mockRes._getHeaders()['x-cache']).toBe('HIT');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should set cache age header on hit', async () => {
      const cachedAt = Date.now() - 5000; // 5 seconds ago
      const cachedData = { data: { items: [] }, cachedAt };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));
      const middleware = apiCacheMiddleware();

      await middleware(mockReq, mockRes, mockNext);

      const cacheAge = mockRes._getHeaders()['x-cache-age'];
      expect(cacheAge).toBeGreaterThanOrEqual(4);
      expect(cacheAge).toBeLessThanOrEqual(6);
    });

    it('should set cache miss header on miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      const middleware = apiCacheMiddleware();

      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes._getHeaders()['x-cache']).toBe('MISS');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should intercept res.json after cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      const middleware = apiCacheMiddleware({ ttl: 300 });
      const originalJson = mockRes.json;

      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.json).not.toBe(originalJson);
      expect(typeof mockRes.json).toBe('function');
    });

    it('should cache successful responses', async () => {
      mockRedis.get.mockResolvedValue(null);
      const middleware = apiCacheMiddleware({ ttl: 600 });

      await middleware(mockReq, mockRes, mockNext);

      // Simulate successful response
      mockRes.statusCode = 200;
      mockRes.json({ success: true, items: [] });

      // Wait for async cache operation
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should skip caching for 400 responses', async () => {
      mockRedis.get.mockResolvedValue(null);
      const middleware = apiCacheMiddleware();

      await middleware(mockReq, mockRes, mockNext);

      mockRes.statusCode = 400;
      mockRes.json({ error: 'Bad request' });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should skip caching for 404 responses', async () => {
      mockRedis.get.mockResolvedValue(null);
      const middleware = apiCacheMiddleware();

      await middleware(mockReq, mockRes, mockNext);

      mockRes.statusCode = 404;
      mockRes.json({ error: 'Not found' });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should skip caching for 500 responses', async () => {
      mockRedis.get.mockResolvedValue(null);
      const middleware = apiCacheMiddleware();

      await middleware(mockReq, mockRes, mockNext);

      mockRes.statusCode = 500;
      mockRes.json({ error: 'Server error' });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should use custom key generator', async () => {
      const customKeyGen = jest.fn().mockReturnValue('custom-key');
      mockRedis.get.mockResolvedValue(null);
      const middleware = apiCacheMiddleware({ keyGenerator: customKeyGen });

      await middleware(mockReq, mockRes, mockNext);

      expect(customKeyGen).toHaveBeenCalledWith(mockReq);
      expect(mockRedis.get).toHaveBeenCalledWith('custom-key');
    });

    it('should respect condition function returning false', async () => {
      const condition = jest.fn().mockReturnValue(false);
      const middleware = apiCacheMiddleware({ condition });

      await middleware(mockReq, mockRes, mockNext);

      expect(condition).toHaveBeenCalledWith(mockReq);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should respect condition function returning true', async () => {
      const condition = jest.fn().mockReturnValue(true);
      mockRedis.get.mockResolvedValue(null);
      const middleware = apiCacheMiddleware({ condition });

      await middleware(mockReq, mockRes, mockNext);

      expect(condition).toHaveBeenCalledWith(mockReq);
      expect(mockRedis.get).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      const middleware = apiCacheMiddleware();

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should use default options when none provided', async () => {
      mockRedis.get.mockResolvedValue(null);
      const middleware = apiCacheMiddleware();

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('cacheRoutes', () => {
    it('should have predefined cache routes', () => {
      expect(cacheRoutes.bots).toBeDefined();
      expect(cacheRoutes.organizations).toBeDefined();
      expect(cacheRoutes.users).toBeDefined();
      expect(cacheRoutes.short).toBeDefined();
      expect(cacheRoutes.medium).toBeDefined();
      expect(cacheRoutes.long).toBeDefined();
    });

    it('should be callable middleware functions', () => {
      expect(typeof cacheRoutes.bots).toBe('function');
      expect(typeof cacheRoutes.organizations).toBe('function');
      expect(typeof cacheRoutes.users).toBe('function');
      expect(typeof cacheRoutes.short).toBe('function');
      expect(typeof cacheRoutes.medium).toBe('function');
      expect(typeof cacheRoutes.long).toBe('function');
    });

    it('should execute bots cache middleware', async () => {
      mockRedis.get.mockResolvedValue(null);
      await cacheRoutes.bots(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should execute organizations cache middleware', async () => {
      mockRedis.get.mockResolvedValue(null);
      await cacheRoutes.organizations(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should execute users cache middleware', async () => {
      mockRedis.get.mockResolvedValue(null);
      await cacheRoutes.users(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should execute short cache middleware', async () => {
      mockRedis.get.mockResolvedValue(null);
      await cacheRoutes.short(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should execute medium cache middleware', async () => {
      mockRedis.get.mockResolvedValue(null);
      await cacheRoutes.medium(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should execute long cache middleware', async () => {
      mockRedis.get.mockResolvedValue(null);
      await cacheRoutes.long(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
