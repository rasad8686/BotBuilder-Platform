/**
 * Redis Rate Limiter Tests
 * Tests for Redis-based rate limiting middleware
 */

jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn(),
  isRedisConnected: jest.fn(),
  CACHE_TTL: { SESSION: 86400 },
  CACHE_PREFIX: {
    RATE_LIMIT: 'ratelimit:'
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
  getRateLimitKey,
  checkRateLimit,
  blockIdentifier,
  isBlocked,
  unblockIdentifier,
  redisRateLimiter,
  rateLimiters,
  RATE_LIMIT_DEFAULTS
} = require('../../middleware/redisRateLimiter');

describe('Redis Rate Limiter', () => {
  let mockRedis;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedis = {
      multi: jest.fn().mockReturnValue({
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0],
          [null, 5],
          [null, 1],
          [null, 1]
        ])
      }),
      zrange: jest.fn().mockResolvedValue([]),
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1)
    };

    getRedisClient.mockResolvedValue(mockRedis);
    isRedisConnected.mockReturnValue(true);

    mockReq = {
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };

    mockNext = jest.fn();
  });

  describe('RATE_LIMIT_DEFAULTS', () => {
    it('should have API defaults', () => {
      expect(RATE_LIMIT_DEFAULTS.API).toBeDefined();
      expect(RATE_LIMIT_DEFAULTS.API.windowMs).toBeDefined();
      expect(RATE_LIMIT_DEFAULTS.API.max).toBeDefined();
    });

    it('should have AUTH defaults', () => {
      expect(RATE_LIMIT_DEFAULTS.AUTH).toBeDefined();
      expect(RATE_LIMIT_DEFAULTS.AUTH.max).toBeLessThan(RATE_LIMIT_DEFAULTS.API.max);
    });

    it('should have SENSITIVE defaults', () => {
      expect(RATE_LIMIT_DEFAULTS.SENSITIVE).toBeDefined();
    });
  });

  describe('getRateLimitKey', () => {
    it('should generate key with identifier and type', () => {
      const key = getRateLimitKey('127.0.0.1', 'api');

      expect(key).toBe('ratelimit:api:127.0.0.1');
    });

    it('should default to api type', () => {
      const key = getRateLimitKey('127.0.0.1');

      expect(key).toContain('api');
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', async () => {
      const result = await checkRateLimit('127.0.0.1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeDefined();
    });

    it('should return fallback when Redis not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const result = await checkRateLimit('127.0.0.1');

      expect(result.allowed).toBe(true);
      expect(result.usingFallback).toBe(true);
    });

    it('should reject when limit exceeded', async () => {
      mockRedis.multi().exec.mockResolvedValue([
        [null, 0],
        [null, 600], // High count
        [null, 1],
        [null, 1]
      ]);

      const result = await checkRateLimit('127.0.0.1', { max: 500 });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.multi().exec.mockRejectedValue(new Error('Redis error'));

      const result = await checkRateLimit('127.0.0.1');

      expect(result.allowed).toBe(true);
      expect(result.error).toBe(true);
    });

    it('should respect custom options', async () => {
      await checkRateLimit('127.0.0.1', {
        windowMs: 60000,
        max: 100,
        type: 'custom'
      });

      expect(mockRedis.multi).toHaveBeenCalled();
    });
  });

  describe('blockIdentifier', () => {
    it('should block identifier', async () => {
      const result = await blockIdentifier('127.0.0.1', 60000, 'Test block');

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should return false when Redis not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const result = await blockIdentifier('127.0.0.1', 60000);

      expect(result).toBe(false);
    });

    it('should handle errors', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      const result = await blockIdentifier('127.0.0.1', 60000);

      expect(result).toBe(false);
    });
  });

  describe('isBlocked', () => {
    it('should return null when not blocked', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await isBlocked('127.0.0.1');

      expect(result).toBeNull();
    });

    it('should return block info when blocked', async () => {
      const blockInfo = { reason: 'Test', blockedAt: Date.now() };
      mockRedis.get.mockResolvedValue(JSON.stringify(blockInfo));

      const result = await isBlocked('127.0.0.1');

      expect(result).toEqual(blockInfo);
    });

    it('should return null when Redis not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const result = await isBlocked('127.0.0.1');

      expect(result).toBeNull();
    });

    it('should handle errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await isBlocked('127.0.0.1');

      expect(result).toBeNull();
    });
  });

  describe('unblockIdentifier', () => {
    it('should unblock identifier', async () => {
      const result = await unblockIdentifier('127.0.0.1');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should return false when Redis not connected', async () => {
      isRedisConnected.mockReturnValue(false);

      const result = await unblockIdentifier('127.0.0.1');

      expect(result).toBe(false);
    });

    it('should handle errors', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      const result = await unblockIdentifier('127.0.0.1');

      expect(result).toBe(false);
    });
  });

  describe('redisRateLimiter middleware', () => {
    it('should allow requests within limit', async () => {
      const middleware = redisRateLimiter();

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(Number));
    });

    it('should set rate limit headers', async () => {
      const middleware = redisRateLimiter({ max: 100 });

      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
    });

    it('should reject blocked identifiers', async () => {
      const blockInfo = {
        reason: 'Test',
        blockedAt: Date.now(),
        expiresAt: Date.now() + 60000
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(blockInfo));

      const middleware = redisRateLimiter();

      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          blocked: true
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject when rate limit exceeded', async () => {
      mockRedis.multi().exec.mockResolvedValue([
        [null, 0],
        [null, 600],
        [null, 1],
        [null, 1]
      ]);

      const middleware = redisRateLimiter({ max: 500 });

      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should skip when condition returns false', async () => {
      const middleware = redisRateLimiter({
        skip: () => true
      });

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should use custom key generator', async () => {
      const keyGenerator = jest.fn().mockReturnValue('custom-id');
      const middleware = redisRateLimiter({ keyGenerator });

      await middleware(mockReq, mockRes, mockNext);

      expect(keyGenerator).toHaveBeenCalledWith(mockReq);
    });

    it('should call onLimitReached callback', async () => {
      mockRedis.multi().exec.mockResolvedValue([
        [null, 0],
        [null, 600],
        [null, 1],
        [null, 1]
      ]);

      const onLimitReached = jest.fn();
      const middleware = redisRateLimiter({ max: 500, onLimitReached });

      await middleware(mockReq, mockRes, mockNext);

      expect(onLimitReached).toHaveBeenCalled();
    });
  });

  describe('rateLimiters presets', () => {
    it('should have api limiter', () => {
      expect(rateLimiters.api).toBeDefined();
      expect(typeof rateLimiters.api).toBe('function');
    });

    it('should have auth limiter', () => {
      expect(rateLimiters.auth).toBeDefined();
    });

    it('should have sensitive limiter', () => {
      expect(rateLimiters.sensitive).toBeDefined();
    });
  });
});
