/**
 * Session Cache Middleware Tests
 * Comprehensive tests for Redis-based session caching
 */

const httpMocks = require('node-mocks-http');

jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn(),
  isRedisConnected: jest.fn(),
  CACHE_TTL: {
    SESSION: 86400,
    USER_DATA: 600
  },
  CACHE_PREFIX: {
    SESSION: 'session:',
    USER: 'user:'
  }
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const { getRedisClient, isRedisConnected, CACHE_PREFIX } = require('../../config/redis');
const logger = require('../../utils/logger');
const {
  getSessionKey,
  cacheSession,
  getCachedSession,
  invalidateSession,
  cacheUserData,
  getCachedUserData,
  invalidateUserData,
  sessionCacheMiddleware
} = require('../../middleware/sessionCache');

describe('Session Cache Middleware', () => {
  let mockRedis;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedis = {
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([])
    };

    getRedisClient.mockResolvedValue(mockRedis);
    isRedisConnected.mockReturnValue(true);

    mockReq = httpMocks.createRequest({
      user: { id: 'user-1' }
    });
    mockRes = httpMocks.createResponse();
    mockNext = jest.fn();
  });

  describe('getSessionKey', () => {
    it('should generate key with userId only', () => {
      const key = getSessionKey('user-1');

      expect(key).toBe('session:user-1');
    });

    it('should generate key with userId and sessionId', () => {
      const key = getSessionKey('user-1', 'session-123');

      expect(key).toBe('session:user-1:session-123');
    });

    it('should use CACHE_PREFIX.SESSION', () => {
      const key = getSessionKey('test-user');

      expect(key).toContain(CACHE_PREFIX.SESSION);
    });

    it('should handle numeric userId', () => {
      const key = getSessionKey(123);

      expect(key).toBe('session:123');
    });

    it('should handle null sessionId', () => {
      const key = getSessionKey('user-1', null);

      expect(key).toBe('session:user-1');
    });

    it('should handle undefined sessionId', () => {
      const key = getSessionKey('user-1', undefined);

      expect(key).toBe('session:user-1');
    });
  });

  describe('cacheSession', () => {
    it('should cache session data', async () => {
      const sessionData = { sessionId: 'sess-1', roles: ['admin'] };

      const result = await cacheSession('user-1', sessionData);

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'session:user-1:sess-1',
        86400,
        expect.any(String)
      );
    });

    it('should add cachedAt timestamp', async () => {
      const sessionData = { sessionId: 'sess-1', roles: ['admin'] };

      await cacheSession('user-1', sessionData);

      const cachedData = JSON.parse(mockRedis.setex.mock.calls[0][2]);
      expect(cachedData.cachedAt).toBeDefined();
      expect(typeof cachedData.cachedAt).toBe('number');
    });

    it('should preserve original session data', async () => {
      const sessionData = {
        sessionId: 'sess-1',
        roles: ['admin', 'user'],
        permissions: { read: true, write: true }
      };

      await cacheSession('user-1', sessionData);

      const cachedData = JSON.parse(mockRedis.setex.mock.calls[0][2]);
      expect(cachedData.roles).toEqual(['admin', 'user']);
      expect(cachedData.permissions).toEqual({ read: true, write: true });
    });

    it('should return false when Redis not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const result = await cacheSession('user-1', { sessionId: 'sess-1' });

      expect(result).toBe(false);
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should use custom TTL', async () => {
      await cacheSession('user-1', { sessionId: 'sess-1' }, 3600);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        3600,
        expect.any(String)
      );
    });

    it('should use default SESSION TTL when not specified', async () => {
      await cacheSession('user-1', { sessionId: 'sess-1' });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        86400, // CACHE_TTL.SESSION
        expect.any(String)
      );
    });

    it('should handle Redis errors', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      const result = await cacheSession('user-1', { sessionId: 'sess-1' });

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Session cache error',
        expect.objectContaining({ error: 'Redis error', userId: 'user-1' })
      );
    });

    it('should log debug info on successful cache', async () => {
      await cacheSession('user-1', { sessionId: 'sess-1' }, 3600);

      expect(logger.debug).toHaveBeenCalledWith(
        'Session cached',
        expect.objectContaining({ userId: 'user-1', ttl: 3600 })
      );
    });

    it('should handle complex session data', async () => {
      const complexSession = {
        sessionId: 'sess-1',
        user: { id: 1, name: 'Test' },
        metadata: { loginTime: Date.now(), ip: '127.0.0.1' }
      };

      await cacheSession('user-1', complexSession);

      const cached = JSON.parse(mockRedis.setex.mock.calls[0][2]);
      expect(cached.user).toEqual({ id: 1, name: 'Test' });
      expect(cached.metadata.ip).toBe('127.0.0.1');
    });
  });

  describe('getCachedSession', () => {
    it('should return cached session', async () => {
      const sessionData = { sessionId: 'sess-1', roles: ['admin'], cachedAt: Date.now() };
      mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));

      const result = await getCachedSession('user-1', 'sess-1');

      expect(result).toEqual(sessionData);
      expect(mockRedis.get).toHaveBeenCalledWith('session:user-1:sess-1');
    });

    it('should return cached session without sessionId', async () => {
      const sessionData = { sessionId: 'sess-1', cachedAt: Date.now() };
      mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));

      const result = await getCachedSession('user-1');

      expect(result).toEqual(sessionData);
      expect(mockRedis.get).toHaveBeenCalledWith('session:user-1');
    });

    it('should return null on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await getCachedSession('user-1');

      expect(result).toBeNull();
    });

    it('should return null when Redis not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const result = await getCachedSession('user-1');

      expect(result).toBeNull();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should handle Redis errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await getCachedSession('user-1');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Session cache get error',
        expect.objectContaining({ error: 'Redis error', userId: 'user-1' })
      );
    });

    it('should log cache hit', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ sessionId: 'sess-1' }));

      await getCachedSession('user-1');

      expect(logger.debug).toHaveBeenCalledWith(
        'Session cache hit',
        expect.objectContaining({ userId: 'user-1' })
      );
    });

    it('should log cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      await getCachedSession('user-1');

      expect(logger.debug).toHaveBeenCalledWith(
        'Session cache miss',
        expect.objectContaining({ userId: 'user-1' })
      );
    });

    it('should parse complex JSON correctly', async () => {
      const complexData = {
        sessionId: 'sess-1',
        nested: { values: [1, 2, 3] },
        metadata: { active: true }
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(complexData));

      const result = await getCachedSession('user-1');

      expect(result.nested.values).toEqual([1, 2, 3]);
      expect(result.metadata.active).toBe(true);
    });
  });

  describe('invalidateSession', () => {
    it('should invalidate specific session', async () => {
      const result = await invalidateSession('user-1', 'sess-1');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('session:user-1:sess-1');
    });

    it('should invalidate all sessions for user', async () => {
      mockRedis.keys.mockResolvedValue([
        'session:user-1:sess-1',
        'session:user-1:sess-2',
        'session:user-1:sess-3'
      ]);

      const result = await invalidateSession('user-1');

      expect(result).toBe(true);
      expect(mockRedis.keys).toHaveBeenCalledWith('session:user-1:*');
      expect(mockRedis.del).toHaveBeenCalledWith(
        'session:user-1:sess-1',
        'session:user-1:sess-2',
        'session:user-1:sess-3'
      );
    });

    it('should log invalidation count', async () => {
      mockRedis.keys.mockResolvedValue(['session:user-1:sess-1', 'session:user-1:sess-2']);

      await invalidateSession('user-1');

      expect(logger.debug).toHaveBeenCalledWith(
        'All sessions invalidated',
        expect.objectContaining({ userId: 'user-1', count: 2 })
      );
    });

    it('should log specific session invalidation', async () => {
      await invalidateSession('user-1', 'sess-1');

      expect(logger.debug).toHaveBeenCalledWith(
        'Session invalidated',
        expect.objectContaining({ userId: 'user-1', sessionId: 'sess-1' })
      );
    });

    it('should return false when Redis not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const result = await invalidateSession('user-1');

      expect(result).toBe(false);
    });

    it('should handle no sessions to invalidate', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const result = await invalidateSession('user-1');

      expect(result).toBe(true);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should handle Redis errors', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      const result = await invalidateSession('user-1', 'sess-1');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Session invalidation error',
        expect.objectContaining({ error: 'Redis error', userId: 'user-1' })
      );
    });

    it('should handle wildcard invalidation errors', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const result = await invalidateSession('user-1');

      expect(result).toBe(false);
    });
  });

  describe('cacheUserData', () => {
    it('should cache user data', async () => {
      const userData = { id: 'user-1', name: 'Test User', email: 'test@example.com' };

      const result = await cacheUserData('user-1', userData);

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should remove password_hash field', async () => {
      const userData = {
        id: 'user-1',
        name: 'Test',
        password_hash: 'secret-hash-123'
      };

      await cacheUserData('user-1', userData);

      const cachedData = JSON.parse(mockRedis.setex.mock.calls[0][2]);
      expect(cachedData.password_hash).toBeUndefined();
      expect(cachedData.id).toBe('user-1');
    });

    it('should remove two_factor_secret field', async () => {
      const userData = {
        id: 'user-1',
        name: 'Test',
        two_factor_secret: 'secret-2fa-code'
      };

      await cacheUserData('user-1', userData);

      const cachedData = JSON.parse(mockRedis.setex.mock.calls[0][2]);
      expect(cachedData.two_factor_secret).toBeUndefined();
      expect(cachedData.id).toBe('user-1');
    });

    it('should remove both sensitive fields', async () => {
      const userData = {
        id: 'user-1',
        password_hash: 'secret',
        two_factor_secret: '2fa',
        name: 'Test'
      };

      await cacheUserData('user-1', userData);

      const cached = JSON.parse(mockRedis.setex.mock.calls[0][2]);
      expect(cached.password_hash).toBeUndefined();
      expect(cached.two_factor_secret).toBeUndefined();
      expect(cached.name).toBe('Test');
    });

    it('should add cachedAt timestamp', async () => {
      await cacheUserData('user-1', { id: 'user-1', name: 'Test' });

      const cached = JSON.parse(mockRedis.setex.mock.calls[0][2]);
      expect(cached.cachedAt).toBeDefined();
      expect(typeof cached.cachedAt).toBe('number');
    });

    it('should use correct cache key prefix', async () => {
      await cacheUserData('user-1', { id: 'user-1' });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'user:user-1',
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should use USER_DATA TTL', async () => {
      await cacheUserData('user-1', { id: 'user-1' });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        600, // CACHE_TTL.USER_DATA
        expect.any(String)
      );
    });

    it('should use custom TTL', async () => {
      await cacheUserData('user-1', { id: 'user-1' }, 1200);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        1200,
        expect.any(String)
      );
    });

    it('should return false when Redis not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const result = await cacheUserData('user-1', {});

      expect(result).toBe(false);
    });

    it('should handle Redis errors', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      const result = await cacheUserData('user-1', {});

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'User data cache error',
        expect.objectContaining({ error: 'Redis error', userId: 'user-1' })
      );
    });

    it('should not mutate original userData object', async () => {
      const userData = {
        id: 'user-1',
        password_hash: 'secret',
        name: 'Test'
      };

      await cacheUserData('user-1', userData);

      expect(userData.password_hash).toBe('secret'); // Should still exist in original
    });
  });

  describe('getCachedUserData', () => {
    it('should return cached user data', async () => {
      const userData = { id: 'user-1', name: 'Test', email: 'test@example.com' };
      mockRedis.get.mockResolvedValue(JSON.stringify(userData));

      const result = await getCachedUserData('user-1');

      expect(result).toEqual(userData);
      expect(mockRedis.get).toHaveBeenCalledWith('user:user-1');
    });

    it('should return null on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await getCachedUserData('user-1');

      expect(result).toBeNull();
    });

    it('should return null when Redis not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const result = await getCachedUserData('user-1');

      expect(result).toBeNull();
    });

    it('should handle Redis errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await getCachedUserData('user-1');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'User data cache get error',
        expect.objectContaining({ error: 'Redis error', userId: 'user-1' })
      );
    });

    it('should parse complex user data', async () => {
      const userData = {
        id: 'user-1',
        profile: { avatar: 'url', bio: 'text' },
        preferences: { theme: 'dark' }
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(userData));

      const result = await getCachedUserData('user-1');

      expect(result.profile.avatar).toBe('url');
      expect(result.preferences.theme).toBe('dark');
    });
  });

  describe('invalidateUserData', () => {
    it('should invalidate user data cache', async () => {
      const result = await invalidateUserData('user-1');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('user:user-1');
    });

    it('should return false when Redis not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const result = await invalidateUserData('user-1');

      expect(result).toBe(false);
    });

    it('should handle Redis errors', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      const result = await invalidateUserData('user-1');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'User data cache invalidation error',
        expect.objectContaining({ error: 'Redis error', userId: 'user-1' })
      );
    });

    it('should use correct cache key', async () => {
      await invalidateUserData('user-123');

      expect(mockRedis.del).toHaveBeenCalledWith('user:user-123');
    });
  });

  describe('sessionCacheMiddleware', () => {
    it('should skip if no user in request', () => {
      mockReq.user = null;

      sessionCacheMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip if no user id', () => {
      mockReq.user = { email: 'test@example.com' };

      sessionCacheMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should attach cached session to request', async () => {
      const sessionData = { sessionId: 'sess-1', roles: ['admin'], cachedAt: Date.now() };
      mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));

      sessionCacheMiddleware(mockReq, mockRes, mockNext);

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockReq.cachedSession).toEqual(sessionData);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without cache on miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      sessionCacheMiddleware(mockReq, mockRes, mockNext);

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockReq.cachedSession).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue on error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      sessionCacheMiddleware(mockReq, mockRes, mockNext);

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next immediately without waiting', () => {
      sessionCacheMiddleware(mockReq, mockRes, mockNext);

      // Next should be called before async operations complete
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use user id from request', async () => {
      mockReq.user.id = 'test-user-123';
      mockRedis.get.mockResolvedValue(JSON.stringify({ sessionId: 'sess' }));

      sessionCacheMiddleware(mockReq, mockRes, mockNext);

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockRedis.get).toHaveBeenCalledWith('session:test-user-123');
    });

    it('should handle numeric user id', async () => {
      mockReq.user.id = 42;
      mockRedis.get.mockResolvedValue(JSON.stringify({ sessionId: 'sess' }));

      sessionCacheMiddleware(mockReq, mockRes, mockNext);

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockRedis.get).toHaveBeenCalledWith('session:42');
    });
  });

  describe('Integration scenarios', () => {
    it('should support full session lifecycle', async () => {
      const sessionData = { sessionId: 'sess-1', roles: ['admin'] };

      // Cache session
      await cacheSession('user-1', sessionData);

      // Retrieve session
      const cached = await getCachedSession('user-1', 'sess-1');
      expect(cached.sessionId).toBe('sess-1');
      expect(cached.roles).toEqual(['admin']);

      // Invalidate session
      await invalidateSession('user-1', 'sess-1');

      // Verify invalidation
      mockRedis.get.mockResolvedValue(null);
      const afterInvalidation = await getCachedSession('user-1', 'sess-1');
      expect(afterInvalidation).toBeNull();
    });

    it('should support user data caching with sensitive field removal', async () => {
      const userData = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        password_hash: 'secret123',
        two_factor_secret: 'totp-secret'
      };

      // Cache user data
      await cacheUserData('user-1', userData);

      // Retrieve and verify sensitive fields removed
      const cachedString = mockRedis.setex.mock.calls[0][2];
      const cached = JSON.parse(cachedString);
      expect(cached.password_hash).toBeUndefined();
      expect(cached.two_factor_secret).toBeUndefined();
      expect(cached.name).toBe('Test User');
    });
  });
});
