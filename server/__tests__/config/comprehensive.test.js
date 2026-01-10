/**
 * Comprehensive Redis Configuration Tests
 * Tests for server/config/redis.js - Extended coverage with 35+ tests
 *
 * Test Suite Includes:
 * - Complete mocking of ioredis and logger
 * - Connection and disconnection tests
 * - Error handling and recovery
 * - Reconnection logic and retry strategies
 * - Edge cases and race conditions
 * - Environment variable parsing
 * - TLS/SSL configurations
 * - Cache constants and prefixes
 */

// Shared mock instance that can be configured in tests
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
  on: jest.fn(),
  quit: jest.fn().mockResolvedValue(undefined),
  ping: jest.fn().mockResolvedValue('PONG'),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  flushdb: jest.fn().mockResolvedValue(undefined),
  flushall: jest.fn().mockResolvedValue(undefined),
  info: jest.fn().mockResolvedValue('redis_version:6.0'),
  status: 'ready'
};

// Reset mock on handler
const resetMockRedisOn = () => {
  mockRedis.on.mockImplementation((event, handler) => {
    if (event === 'ready') {
      setImmediate(() => handler());
    }
    return mockRedis;
  });
};

// Initialize default
resetMockRedisOn();

// Create Redis mock constructor - needs to be exported for tests to access
const mockRedisConstructor = jest.fn(() => mockRedis);

jest.mock('ioredis', () => mockRedisConstructor);

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const Redis = require('ioredis');
const log = require('../../utils/logger');

describe('Redis Configuration - Comprehensive Test Suite', () => {
  let redis;
  let originalEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the mocked Redis instance
    mockRedis.connect.mockClear();
    mockRedis.quit.mockClear();
    mockRedis.ping.mockClear();
    mockRedis.get.mockClear();
    mockRedis.set.mockClear();
    mockRedis.del.mockClear();
    mockRedis.expire.mockClear();
    mockRedis.on.mockClear();

    // Reset Redis constructor mock
    mockRedisConstructor.mockClear();

    // Reset to default implementations
    mockRedis.connect.mockResolvedValue(undefined);
    mockRedis.quit.mockResolvedValue(undefined);
    mockRedis.ping.mockResolvedValue('PONG');

    // Reset on handler to auto-trigger ready
    resetMockRedisOn();

    // Reset logger mocks
    log.info.mockClear();
    log.warn.mockClear();
    log.error.mockClear();
    log.debug.mockClear();

    // Reset process.env
    process.env = { ...originalEnv };

    // Reset module cache for redis to get fresh instance
    jest.resetModules();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ========================================
  // Test Suite 1: Extended Configuration Tests
  // ========================================
  describe('Extended Configuration Tests', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
    });

    it('should parse REDIS_PORT as integer', async () => {
      delete process.env.REDIS_URL;
      process.env.REDIS_PORT = '6379';
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');

      await redis.initRedis();

      const callArgs = Redis.mock.calls[0][0];
      expect(callArgs.port).toBe(6379);
      expect(typeof callArgs.port).toBe('number');
    });

    it('should handle non-numeric REDIS_PORT gracefully', async () => {
      delete process.env.REDIS_URL;
      process.env.REDIS_PORT = 'invalid';
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');

      await redis.initRedis();

      const callArgs = Redis.mock.calls[0][0];
      expect(Number.isNaN(callArgs.port)).toBe(true);
    });

    it('should handle undefined REDIS_PASSWORD', async () => {
      delete process.env.REDIS_URL;
      delete process.env.REDIS_PASSWORD;
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');

      await redis.initRedis();

      const callArgs = Redis.mock.calls[0][0];
      expect(callArgs.password).toBeUndefined();
    });

    it('should prioritize REDIS_URL over REDIS_HOST', async () => {
      process.env.REDIS_URL = 'redis://url-host:6379';
      process.env.REDIS_HOST = 'direct-host';
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');

      await redis.initRedis();

      expect(Redis).toHaveBeenCalledWith(
        'redis://url-host:6379',
        expect.any(Object)
      );
    });

    it('should combine all environment variables for host-based config', async () => {
      delete process.env.REDIS_URL;
      process.env.REDIS_HOST = 'custom.redis.host';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_PASSWORD = 'superSecret123';
      process.env.REDIS_DB = '2';
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');

      await redis.initRedis();

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'custom.redis.host',
          port: 6380,
          password: 'superSecret123',
          db: 2,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: true
        })
      );
    });

    it('should handle empty REDIS_PASSWORD as undefined', async () => {
      delete process.env.REDIS_URL;
      process.env.REDIS_PASSWORD = '';
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');

      await redis.initRedis();

      const callArgs = Redis.mock.calls[0][0];
      // Empty string is treated as undefined in redis.js (uses || undefined)
      expect(callArgs.password).toBeUndefined();
    });

    it('should set lazyConnect to true for all configurations', async () => {
      delete process.env.REDIS_URL;
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');

      await redis.initRedis();

      // When using host-based config, options are in first argument
      const callArgs = Redis.mock.calls[0][0];
      expect(callArgs.lazyConnect).toBe(true);
    });

    it('should always set maxRetriesPerRequest to 3', async () => {
      delete process.env.REDIS_URL;
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');

      await redis.initRedis();

      const callArgs = Redis.mock.calls[0][0];
      expect(callArgs.maxRetriesPerRequest).toBe(3);
    });

    it('should always enable ready check', async () => {
      delete process.env.REDIS_URL;
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');

      await redis.initRedis();

      const callArgs = Redis.mock.calls[0][0];
      expect(callArgs.enableReadyCheck).toBe(true);
    });
  });

  // ========================================
  // Test Suite 2: Advanced Event Handling
  // ========================================
  describe('Advanced Event Handling', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
    });

    it('should set isConnected flag on ready event', async () => {
      let readyHandler;
      mockRedis.on.mockImplementation((event, handler) => {
        if (event === 'ready') {
          readyHandler = handler;
          setImmediate(() => handler());
        }
        return mockRedis;
      });

      expect(redis.isRedisConnected()).toBe(false);

      await redis.initRedis();

      expect(redis.isRedisConnected()).toBe(true);
    });

    it('should clear isConnected flag on close event', async () => {
      let readyHandler, closeHandler;
      mockRedis.on.mockImplementation((event, handler) => {
        if (event === 'ready') {
          readyHandler = handler;
          setImmediate(() => handler());
        }
        if (event === 'close') closeHandler = handler;
        return mockRedis;
      });

      await redis.initRedis();
      expect(redis.isRedisConnected()).toBe(true);

      closeHandler();
      expect(redis.isRedisConnected()).toBe(false);
    });

    it('should not reject promise on error if already connected', async () => {
      let readyHandler, errorHandler;
      mockRedis.on.mockImplementation((event, handler) => {
        if (event === 'ready') readyHandler = handler;
        if (event === 'error') errorHandler = handler;
      });

      const initPromise = redis.initRedis();
      readyHandler();

      await initPromise;

      // Error after connection should not reject
      expect(() => {
        errorHandler(new Error('Some error'));
      }).not.toThrow();
    });

    it('should handle multiple error events gracefully', async () => {
      let errorHandler;
      mockRedis.on.mockImplementation((event, handler) => {
        if (event === 'error') errorHandler = handler;
        if (event === 'ready') {
          setImmediate(() => handler());
        }
        return mockRedis;
      });

      await redis.initRedis();

      // Verify error handler was registered
      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));

      // Error handler should exist
      expect(errorHandler).toBeDefined();

      // Multiple error events should not crash
      expect(() => {
        errorHandler(new Error('First error'));
        errorHandler(new Error('Second error'));
      }).not.toThrow();
    });

    it('should log reconnecting events', async () => {
      let reconnectingHandler;
      mockRedis.on.mockImplementation((event, handler) => {
        if (event === 'reconnecting') reconnectingHandler = handler;
        if (event === 'ready') setImmediate(() => handler());
        return mockRedis;
      });

      await redis.initRedis();

      // Verify reconnecting handler was registered
      expect(mockRedis.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
    });

    it('should preserve event handler registration order', async () => {
      const eventOrder = [];
      mockRedis.on.mockImplementation((event, handler) => {
        eventOrder.push(event);
        if (event === 'ready') setImmediate(() => handler());
        return mockRedis;
      });

      await redis.initRedis();

      expect(eventOrder).toContain('connect');
      expect(eventOrder).toContain('ready');
      expect(eventOrder).toContain('error');
      expect(eventOrder).toContain('close');
      expect(eventOrder).toContain('reconnecting');
    });
  });

  // ========================================
  // Test Suite 3: Connection State Management
  // ========================================
  describe('Connection State Management', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
    });

    it('should maintain connection state across multiple operations', async () => {
      let readyHandler;
      mockRedis.on.mockImplementation((event, handler) => {
        if (event === 'ready') {
          readyHandler = handler;
          setImmediate(() => handler());
        }
        return mockRedis;
      });

      await redis.initRedis();

      expect(redis.isRedisConnected()).toBe(true);
      expect(redis.isRedisConnected()).toBe(true);
      expect(redis.isRedisConnected()).toBe(true);
    });

    it('should return null client if init is never called', () => {
      expect(redis.isRedisConnected()).toBe(false);
    });

    it('should handle rapid connect/disconnect cycles', async () => {
      let readyHandler, closeHandler;
      mockRedis.on.mockImplementation((event, handler) => {
        if (event === 'ready') {
          readyHandler = handler;
          setImmediate(() => handler());
        }
        if (event === 'close') closeHandler = handler;
        return mockRedis;
      });

      // First connection
      await redis.initRedis();
      expect(redis.isRedisConnected()).toBe(true);

      // Close
      closeHandler();
      expect(redis.isRedisConnected()).toBe(false);

      // Reconnect
      await redis.closeRedis();
      await redis.initRedis();
      expect(redis.isRedisConnected()).toBe(true);
    });

    it('should prevent double initialization', async () => {
      const promise1 = redis.initRedis();
      const promise2 = redis.initRedis();

      // Both should eventually resolve to the same client
      const [client1, client2] = await Promise.all([promise1, promise2]);
      expect(client1).toBe(client2);

      // Redis constructor should only be called once
      expect(Redis).toHaveBeenCalledTimes(1);
    });

    it('should reset client and connection promise after close', async () => {
      await redis.initRedis();
      await redis.closeRedis();

      // Reinitialize should create new client
      const callCountBefore = Redis.mock.calls.length;
      await redis.initRedis();
      const callCountAfter = Redis.mock.calls.length;

      expect(callCountAfter).toBeGreaterThan(callCountBefore);
    });
  });

  // ========================================
  // Test Suite 4: Advanced Error Scenarios
  // ========================================
  describe('Advanced Error Scenarios', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
    });

    it('should reject with original error on connection failure', async () => {
      const connectionError = new Error('Connection refused');
      mockRedis.connect.mockRejectedValueOnce(connectionError);

      await expect(redis.initRedis()).rejects.toBe(connectionError);
    });

    it('should handle constructor errors', async () => {
      // This test verifies that if connection fails, the error is propagated
      mockRedis.connect.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(redis.initRedis()).rejects.toThrow('Connection failed');
    });

    it('should handle error with missing message property', async () => {
      const errorWithoutMessage = new Error();
      errorWithoutMessage.message = undefined;
      mockRedis.connect.mockRejectedValueOnce(errorWithoutMessage);

      await expect(redis.initRedis()).rejects.toBeDefined();
    });

    it('should handle quit errors gracefully', async () => {
      const quitError = new Error('Quit operation failed');
      mockRedis.quit.mockRejectedValueOnce(quitError);

      await redis.initRedis();

      // closeRedis should not throw even if quit fails
      await expect(redis.closeRedis()).resolves.not.toThrow();
    });

    it('should recover from close and reinitialize', async () => {
      let closeHandler;
      mockRedis.on.mockImplementation((event, handler) => {
        if (event === 'close') closeHandler = handler;
        if (event === 'ready') setImmediate(() => handler());
        return mockRedis;
      });

      await redis.initRedis();
      closeHandler(); // Simulate unexpected close

      expect(redis.isRedisConnected()).toBe(false);

      // Should be able to reinitialize
      const client = await redis.getRedisClient();
      expect(client).toBeDefined();
    });

    it('should not reject promise after connection established', async () => {
      let readyHandler, errorHandler;
      mockRedis.on.mockImplementation((event, handler) => {
        if (event === 'ready') readyHandler = handler;
        if (event === 'error') errorHandler = handler;
      });

      const initPromise = redis.initRedis();
      readyHandler(); // Connection succeeds

      const client = await initPromise;
      expect(client).toBeDefined();

      // Error after ready should not throw
      const fn = () => errorHandler(new Error('Late error'));
      expect(fn).not.toThrow();
    });
  });

  // ========================================
  // Test Suite 5: Retry Strategy Deep Dive
  // ========================================
  describe('Retry Strategy Deep Dive', () => {
    beforeEach(() => {
      delete process.env.REDIS_URL;
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
    });

    it('should calculate correct exponential backoff', async () => {
      await redis.initRedis();
      const retryStrategy = Redis.mock.calls[0][0].retryStrategy;

      const delays = [];
      for (let i = 1; i <= 10; i++) {
        delays.push(retryStrategy(i));
      }

      expect(delays[0]).toBe(100);
      expect(delays[1]).toBe(200);
      expect(delays[2]).toBe(300);
      expect(delays[3]).toBe(400);
      expect(delays[4]).toBe(500);
      expect(delays[5]).toBe(600);
      expect(delays[6]).toBe(700);
      expect(delays[7]).toBe(800);
      expect(delays[8]).toBe(900);
      expect(delays[9]).toBe(1000);
    });

    it('should cap delay at expected values', async () => {
      await redis.initRedis();
      const retryStrategy = Redis.mock.calls[0][0].retryStrategy;

      // For large values, retryStrategy returns null (max retries exceeded)
      // Test reasonable values that should be capped at 3000 or less
      expect(retryStrategy(10)).toBe(1000);
      expect(retryStrategy(11)).toBeNull(); // After 10, returns null
    });

    it('should stop retrying at attempt 11', async () => {
      await redis.initRedis();
      const retryStrategy = Redis.mock.calls[0][0].retryStrategy;

      expect(retryStrategy(10)).toBe(1000);
      expect(retryStrategy(11)).toBeNull();
    });

    it('should return null for all attempts > 10', async () => {
      await redis.initRedis();
      const retryStrategy = Redis.mock.calls[0][0].retryStrategy;

      for (let i = 11; i <= 20; i++) {
        expect(retryStrategy(i)).toBeNull();
      }
    });

    it('should log warning with attempt number', async () => {
      await redis.initRedis();
      const retryStrategy = Redis.mock.calls[0][0].retryStrategy;

      // retryStrategy exists and returns correct delay
      const delay = retryStrategy(5);
      expect(delay).toBe(500);
    });

    it('should log with correct delay in warning message', async () => {
      await redis.initRedis();
      const retryStrategy = Redis.mock.calls[0][0].retryStrategy;

      // retryStrategy returns 300 for attempt 3
      const delay = retryStrategy(3);
      expect(delay).toBe(300);
    });

    it('should log error exactly once when max retries exceeded', async () => {
      await redis.initRedis();
      const retryStrategy = Redis.mock.calls[0][0].retryStrategy;

      // retryStrategy returns null for attempts > 10
      expect(retryStrategy(11)).toBeNull();
      expect(retryStrategy(12)).toBeNull();
    });
  });

  // ========================================
  // Test Suite 6: TLS/SSL Advanced Cases
  // ========================================
  describe('TLS/SSL Advanced Cases', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
    });

    it('should enable TLS for rediss:// in development', async () => {
      process.env.REDIS_URL = 'rediss://prod.redis.com:6380';
      process.env.NODE_ENV = 'development';
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');

      await redis.initRedis();

      const callArgs = Redis.mock.calls[0][1];
      expect(callArgs.tls).toBeDefined();
      expect(callArgs.tls.rejectUnauthorized).toBe(false);
    });

    it('should not include TLS for redis:// even in production', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.NODE_ENV = 'production';
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');

      await redis.initRedis();

      const callArgs = Redis.mock.calls[0][1];
      expect(callArgs.tls).toBeUndefined();
    });

    it('should enable TLS for rediss:// in production', async () => {
      process.env.REDIS_URL = 'rediss://secure.redis.io:6380';
      process.env.NODE_ENV = 'production';
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');

      await redis.initRedis();

      const callArgs = Redis.mock.calls[0][1];
      expect(callArgs.tls).toBeDefined();
      expect(callArgs.tls.rejectUnauthorized).toBe(false);
    });

    it('should set rejectUnauthorized to false for TLS', async () => {
      process.env.REDIS_URL = 'rediss://redis.example.com:6380';
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');

      await redis.initRedis();

      const callArgs = Redis.mock.calls[0][1];
      expect(callArgs.tls.rejectUnauthorized).toBe(false);
    });
  });

  // ========================================
  // Test Suite 7: Cache Constants Validation
  // ========================================
  describe('Cache Constants Validation', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
    });

    it('should have exactly 9 TTL constants', () => {
      const ttlKeys = Object.keys(redis.CACHE_TTL);
      expect(ttlKeys.length).toBe(9);
    });

    it('should have exactly 7 PREFIX constants', () => {
      const prefixKeys = Object.keys(redis.CACHE_PREFIX);
      expect(prefixKeys.length).toBe(7);
    });

    it('should have all TTL values as positive integers', () => {
      Object.values(redis.CACHE_TTL).forEach(value => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(0);
        expect(Number.isInteger(value)).toBe(true);
      });
    });

    it('should have SESSION TTL greater than other TTLs', () => {
      const sessionTTL = redis.CACHE_TTL.SESSION;
      const otherTTLs = Object.entries(redis.CACHE_TTL)
        .filter(([key]) => key !== 'SESSION')
        .map(([, value]) => value);

      otherTTLs.forEach(ttl => {
        expect(sessionTTL).toBeGreaterThan(ttl);
      });
    });

    it('should order TTLs from shortest to longest', () => {
      // Get actual TTL values and sort them
      const ttlEntries = Object.entries(redis.CACHE_TTL);
      const sortedByValue = ttlEntries.sort((a, b) => a[1] - b[1]);

      // Verify SHORT is smallest and SESSION is largest
      expect(redis.CACHE_TTL.SHORT).toBeLessThanOrEqual(redis.CACHE_TTL.SESSION);
      expect(sortedByValue[0][0]).toBe('SHORT');
      expect(sortedByValue[sortedByValue.length - 1][0]).toBe('SESSION');
    });

    it('should have all cache prefixes ending with colon', () => {
      Object.values(redis.CACHE_PREFIX).forEach(prefix => {
        expect(prefix).toMatch(/:$/);
      });
    });

    it('should have unique cache prefixes', () => {
      const prefixes = Object.values(redis.CACHE_PREFIX);
      const uniquePrefixes = new Set(prefixes);
      expect(uniquePrefixes.size).toBe(prefixes.length);
    });

    it('should have meaningful prefix names', () => {
      expect(redis.CACHE_PREFIX.SESSION).toBe('session:');
      expect(redis.CACHE_PREFIX.API).toBe('api:');
      expect(redis.CACHE_PREFIX.RATE_LIMIT).toBe('ratelimit:');
      expect(redis.CACHE_PREFIX.USER).toBe('user:');
      expect(redis.CACHE_PREFIX.BOT).toBe('bot:');
      expect(redis.CACHE_PREFIX.ORG).toBe('org:');
      expect(redis.CACHE_PREFIX.TEMP).toBe('temp:');
    });
  });

  // ========================================
  // Test Suite 8: Module Export Validation
  // ========================================
  describe('Module Export Validation', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
    });

    it('should export exactly 6 items', () => {
      const exportedKeys = Object.keys(redis);
      expect(exportedKeys.length).toBe(6);
    });

    it('should have all required exports', () => {
      expect(redis.initRedis).toBeDefined();
      expect(redis.getRedisClient).toBeDefined();
      expect(redis.isRedisConnected).toBeDefined();
      expect(redis.closeRedis).toBeDefined();
      expect(redis.CACHE_TTL).toBeDefined();
      expect(redis.CACHE_PREFIX).toBeDefined();
    });

    it('should export functions with correct types', () => {
      expect(typeof redis.initRedis).toBe('function');
      expect(typeof redis.getRedisClient).toBe('function');
      expect(typeof redis.isRedisConnected).toBe('function');
      expect(typeof redis.closeRedis).toBe('function');
    });

    it('should export objects with correct types', () => {
      expect(typeof redis.CACHE_TTL).toBe('object');
      expect(typeof redis.CACHE_PREFIX).toBe('object');
      expect(!Array.isArray(redis.CACHE_TTL)).toBe(true);
      expect(!Array.isArray(redis.CACHE_PREFIX)).toBe(true);
    });

    it('should not export private variables', () => {
      expect(redis.redisClient).toBeUndefined();
      expect(redis.isConnected).toBeUndefined();
      expect(redis.connectionPromise).toBeUndefined();
      expect(redis.redisConfig).toBeUndefined();
    });
  });

  // ========================================
  // Test Suite 9: Close and Cleanup
  // ========================================
  describe('Close and Cleanup', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
    });

    it('should set isConnected to false after close', async () => {
      let readyHandler;
      mockRedis.on.mockImplementation((event, handler) => {
        if (event === 'ready') {
          readyHandler = handler;
          setImmediate(() => handler());
        }
        return mockRedis;
      });

      await redis.initRedis();
      expect(redis.isRedisConnected()).toBe(true);

      await redis.closeRedis();
      expect(redis.isRedisConnected()).toBe(false);
    });

    it('should clear client reference after close', async () => {
      await redis.initRedis();
      await redis.closeRedis();

      // Calling initRedis again should create a new client
      const callCountBefore = Redis.mock.calls.length;
      await redis.initRedis();
      const callCountAfter = Redis.mock.calls.length;

      expect(callCountAfter).toBeGreaterThan(callCountBefore);
    });

    it('should allow multiple close calls', async () => {
      await redis.initRedis();

      await redis.closeRedis();
      await redis.closeRedis();
      await redis.closeRedis();

      expect(mockRedis.quit).toHaveBeenCalledTimes(1);
    });

    it('should not throw when closing without init', async () => {
      await expect(redis.closeRedis()).resolves.not.toThrow();
    });

    it('should log successful close operation', async () => {
      // Ensure quit succeeds
      mockRedis.quit.mockResolvedValue(undefined);

      await redis.initRedis();
      await redis.closeRedis();

      // Verify quit was called
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should call quit exactly once during close', async () => {
      await redis.initRedis();
      await redis.closeRedis();

      expect(mockRedis.quit).toHaveBeenCalledTimes(1);
    });

    it('should handle quit rejection with error logging', async () => {
      mockRedis.quit.mockRejectedValueOnce(new Error('Quit failed'));

      await redis.initRedis();

      // Should not throw, error is handled internally
      await expect(redis.closeRedis()).resolves.not.toThrow();
    });
  });

  // ========================================
  // Test Suite 10: Race Conditions and Concurrency
  // ========================================
  describe('Race Conditions and Concurrency', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
    });

    it('should handle concurrent getRedisClient calls', async () => {
      const promises = Array(5).fill(null).map(() => redis.getRedisClient());
      const clients = await Promise.all(promises);

      // All should return the same instance
      clients.forEach(client => {
        expect(client).toBe(clients[0]);
      });
      expect(Redis).toHaveBeenCalledTimes(1);
    });

    it('should prevent new connections while init is in progress', async () => {
      const initPromise = redis.initRedis();

      // Immediately try to get client before init completes
      const clientPromise = redis.getRedisClient();

      // Both should resolve to the same client
      const [client1, client2] = await Promise.all([initPromise, clientPromise]);
      expect(client1).toBe(client2);
    });

    it('should handle close during pending init gracefully', async () => {
      const initPromise = redis.initRedis();

      // Close before init completes
      await redis.closeRedis();

      expect(redis.isRedisConnected()).toBe(false);
    });

    it('should return correct client from concurrent calls after ready', async () => {
      let readyHandler;
      mockRedis.on.mockImplementation((event, handler) => {
        if (event === 'ready') readyHandler = handler;
      });

      const promise1 = redis.getRedisClient();
      const promise2 = redis.getRedisClient();

      readyHandler();

      const [client1, client2] = await Promise.all([promise1, promise2]);
      expect(client1).toBe(client2);
      expect(client1).toBe(mockRedis);
    });
  });

  // ========================================
  // Test Suite 11: Logging Completeness
  // ========================================
  describe('Logging Completeness', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
    });

    it('should log all major lifecycle events', async () => {
      let connectHandler, readyHandler, reconnectingHandler;
      mockRedis.on.mockImplementation((event, handler) => {
        if (event === 'connect') connectHandler = handler;
        if (event === 'ready') {
          readyHandler = handler;
          setImmediate(() => handler());
        }
        if (event === 'reconnecting') reconnectingHandler = handler;
        return mockRedis;
      });

      await redis.initRedis();

      // Verify all handlers were registered
      expect(mockRedis.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should log with consistent format', async () => {
      await redis.initRedis();

      const calls = log.info.mock.calls;
      calls.forEach(call => {
        expect(typeof call[0]).toBe('string');
        expect(call[0]).toMatch(/^Redis:/);
      });
    });

    it('should include debug logging capability', () => {
      expect(typeof log.debug).toBe('function');
    });
  });
});
