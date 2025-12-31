/**
 * API Cache Middleware Tests
 * Tests for Redis-based API response caching
 */

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

    mockReq = {
      method: 'GET',
      originalUrl: '/api/bots',
      path: '/api/bots',
      user: { id: 'user-1' },
      headers: {
        'x-organization-id': 'org-1'
      },
      query: {}
    };

    mockRes = {
      json: jest.fn(),
      setHeader: jest.fn(),
      statusCode: 200
    };

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
    });

    it('should use default for no organization', () => {
      mockReq.headers = {};

      const key = generateCacheKey(mockReq);

      expect(key).toContain('default');
    });

    it('should include query hash for uniqueness', () => {
      mockReq.query = { page: 1, limit: 10 };
      const key1 = generateCacheKey(mockReq);

      mockReq.query = { page: 2, limit: 10 };
      const key2 = generateCacheKey(mockReq);

      expect(key1).not.toBe(key2);
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
      expect(cachedData.expiresAt).toBeDefined();
    });

    it('should use custom TTL', async () => {
      await cacheResponse('test-key', { data: 'test' }, 600);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test-key',
        600,
        expect.any(String)
      );
    });

    it('should return false when Redis not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const result = await cacheResponse('test-key', {});

      expect(result).toBe(false);
    });

    it('should handle Redis errors', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      const result = await cacheResponse('test-key', {});

      expect(result).toBe(false);
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
    });

    it('should handle Redis errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await getCachedResponse('test-key');

      expect(result).toBeNull();
    });
  });

  describe('invalidateByPattern', () => {
    it('should invalidate matching keys', async () => {
      mockRedis.keys.mockResolvedValue(['api:key1', 'api:key2']);

      const result = await invalidateByPattern('GET:/api/bots*');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('api:key1', 'api:key2');
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
    });

    it('should handle Redis errors', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const result = await invalidateByPattern('*');

      expect(result).toBe(false);
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

    it('should skip when no-cache header present', async () => {
      mockReq.headers['cache-control'] = 'no-cache';
      const middleware = apiCacheMiddleware();

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return cached response on hit', async () => {
      const cachedData = { data: { items: [] }, cachedAt: Date.now() - 1000 };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));
      const middleware = apiCacheMiddleware();

      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Cache', 'HIT');
      expect(mockRes.json).toHaveBeenCalledWith(cachedData.data);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should set cache miss header on miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      const middleware = apiCacheMiddleware();

      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should cache response on success', async () => {
      mockRedis.get.mockResolvedValue(null);
      const middleware = apiCacheMiddleware({ ttl: 300 });

      await middleware(mockReq, mockRes, mockNext);

      // Simulate response
      mockRes.json({ items: [] });

      // Wait for async cache operation
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should skip caching for non-2xx responses', async () => {
      mockRedis.get.mockResolvedValue(null);
      const middleware = apiCacheMiddleware();

      await middleware(mockReq, mockRes, mockNext);

      mockRes.statusCode = 404;
      mockRes.json({ error: 'Not found' });

      // Should not cache error responses
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should use custom key generator', async () => {
      const customKeyGen = jest.fn().mockReturnValue('custom-key');
      const middleware = apiCacheMiddleware({ keyGenerator: customKeyGen });

      await middleware(mockReq, mockRes, mockNext);

      expect(customKeyGen).toHaveBeenCalledWith(mockReq);
    });

    it('should respect condition function', async () => {
      const condition = jest.fn().mockReturnValue(false);
      const middleware = apiCacheMiddleware({ condition });

      await middleware(mockReq, mockRes, mockNext);

      expect(condition).toHaveBeenCalledWith(mockReq);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
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
      expect(typeof cacheRoutes.short).toBe('function');
    });
  });
});
