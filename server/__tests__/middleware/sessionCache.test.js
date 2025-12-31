/**
 * Session Cache Middleware Tests
 * Tests for Redis-based session caching
 */

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

    mockReq = {
      user: { id: 'user-1' }
    };
    mockRes = {};
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

    it('should add cachedAt timestamp', async () => {
      await cacheSession('user-1', { sessionId: 'sess-1' });

      const cachedData = JSON.parse(mockRedis.setex.mock.calls[0][2]);
      expect(cachedData.cachedAt).toBeDefined();
    });

    it('should handle Redis errors', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      const result = await cacheSession('user-1', { sessionId: 'sess-1' });

      expect(result).toBe(false);
    });
  });

  describe('getCachedSession', () => {
    it('should return cached session', async () => {
      const sessionData = { sessionId: 'sess-1', cachedAt: Date.now() };
      mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));

      const result = await getCachedSession('user-1', 'sess-1');

      expect(result).toEqual(sessionData);
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
    });

    it('should handle Redis errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await getCachedSession('user-1');

      expect(result).toBeNull();
    });
  });

  describe('invalidateSession', () => {
    it('should invalidate specific session', async () => {
      const result = await invalidateSession('user-1', 'sess-1');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('session:user-1:sess-1');
    });

    it('should invalidate all sessions for user', async () => {
      mockRedis.keys.mockResolvedValue(['session:user-1:sess-1', 'session:user-1:sess-2']);

      const result = await invalidateSession('user-1');

      expect(result).toBe(true);
      expect(mockRedis.keys).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith(
        'session:user-1:sess-1',
        'session:user-1:sess-2'
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
    });

    it('should handle Redis errors', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      const result = await invalidateSession('user-1', 'sess-1');

      expect(result).toBe(false);
    });
  });

  describe('cacheUserData', () => {
    it('should cache user data', async () => {
      const userData = { id: 'user-1', name: 'Test User' };

      const result = await cacheUserData('user-1', userData);

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should remove sensitive fields', async () => {
      const userData = {
        id: 'user-1',
        password_hash: 'secret',
        two_factor_secret: 'secret-2fa'
      };

      await cacheUserData('user-1', userData);

      const cachedData = JSON.parse(mockRedis.setex.mock.calls[0][2]);
      expect(cachedData.password_hash).toBeUndefined();
      expect(cachedData.two_factor_secret).toBeUndefined();
      expect(cachedData.id).toBe('user-1');
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
    });
  });

  describe('getCachedUserData', () => {
    it('should return cached user data', async () => {
      const userData = { id: 'user-1', name: 'Test' };
      mockRedis.get.mockResolvedValue(JSON.stringify(userData));

      const result = await getCachedUserData('user-1');

      expect(result).toEqual(userData);
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
      const sessionData = { sessionId: 'sess-1', roles: ['admin'] };
      mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));

      sessionCacheMiddleware(mockReq, mockRes, mockNext);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockReq.cachedSession).toEqual(sessionData);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without cache on miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      sessionCacheMiddleware(mockReq, mockRes, mockNext);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockReq.cachedSession).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue on error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      sessionCacheMiddleware(mockReq, mockRes, mockNext);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
