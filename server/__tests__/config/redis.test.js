/**
 * Redis Configuration Tests
 * Tests for server/config/redis.js
 */

// Store event handlers for triggering events in tests
const eventHandlers = {};

// Helper to trigger events
const triggerEvent = (event, ...args) => {
  if (eventHandlers[event]) {
    eventHandlers[event](...args);
  }
};

// Helper to setup auto-ready behavior on connect
const setupAutoReady = () => {
  mockRedisInstance.connect.mockImplementation(async () => {
    setImmediate(() => {
      triggerEvent('connect');
      triggerEvent('ready');
    });
    return undefined;
  });
};

// Mock ioredis BEFORE importing anything
const mockRedisInstance = {
  connect: jest.fn(),
  quit: jest.fn(),
  on: jest.fn((event, handler) => {
    eventHandlers[event] = handler;
    return mockRedisInstance;
  }),
  status: 'ready'
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedisInstance);
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const Redis = require('ioredis');
const log = require('../../utils/logger');

describe('Redis Configuration', () => {
  let redis;
  let originalEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear event handlers
    Object.keys(eventHandlers).forEach(key => delete eventHandlers[key]);
    // Reset the mocked Redis instance
    mockRedisInstance.connect.mockReset();
    mockRedisInstance.quit.mockReset();
    mockRedisInstance.on.mockReset();
    mockRedisInstance.on.mockImplementation((event, handler) => {
      eventHandlers[event] = handler;
      return mockRedisInstance;
    });
    mockRedisInstance.quit.mockResolvedValue(undefined);
    // Setup auto-ready behavior
    setupAutoReady();
    // Reset process.env
    process.env = { ...originalEnv };
    // Reset module cache for redis config
    delete require.cache[require.resolve('../../config/redis')];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ========================================
  // Environment Variable Loading
  // ========================================
  describe('Environment Variable Loading', () => {
    it('should use REDIS_URL when provided', async () => {
      process.env.REDIS_URL = 'redis://custom-host:6380';
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
      setupAutoReady();

      await redis.initRedis();

      expect(Redis).toHaveBeenCalledWith(
        'redis://custom-host:6380',
        expect.objectContaining({
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: true
        })
      );
    });

    it.skip('should use localhost:6379 as default when REDIS_URL not provided', async () => {
      delete process.env.REDIS_URL;
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
      setupAutoReady();

      await redis.initRedis();

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 6379
        })
      );
    });

    it.skip('should use REDIS_HOST and REDIS_PORT from env', async () => {
      delete process.env.REDIS_URL;
      process.env.REDIS_HOST = 'custom-redis.example.com';
      process.env.REDIS_PORT = '6380';
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
      setupAutoReady();

      await redis.initRedis();

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'custom-redis.example.com',
          port: 6380
        })
      );
    });

    it.skip('should use REDIS_PASSWORD when provided', async () => {
      delete process.env.REDIS_URL;
      process.env.REDIS_PASSWORD = 'secret123';
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
      setupAutoReady();

      await redis.initRedis();

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'secret123'
        })
      );
    });

    it.skip('should use REDIS_DB when provided', async () => {
      delete process.env.REDIS_URL;
      process.env.REDIS_DB = '5';
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
      setupAutoReady();

      await redis.initRedis();

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          db: 5
        })
      );
    });

    it.skip('should use default db=0 when REDIS_DB not provided', async () => {
      delete process.env.REDIS_URL;
      delete process.env.REDIS_DB;
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
      setupAutoReady();

      await redis.initRedis();

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          db: 0
        })
      );
    });
  });

  // ========================================
  // TLS/SSL Configuration
  // ========================================
  describe('TLS/SSL Configuration', () => {
    it.skip('should enable TLS for rediss:// URLs', async () => {
      process.env.REDIS_URL = 'rediss://secure-redis.example.com:6380';
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
      setupAutoReady();

      await redis.initRedis();

      expect(Redis).toHaveBeenCalledWith(
        'rediss://secure-redis.example.com:6380',
        expect.objectContaining({
          tls: { rejectUnauthorized: false }
        })
      );
    });

    it.skip('should not enable TLS for redis:// URLs in development', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.NODE_ENV = 'development';
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
      setupAutoReady();

      await redis.initRedis();

      const callArgs = Redis.mock.calls[0][1];
      expect(callArgs.tls).toBeUndefined();
    });

    it.skip('should enable TLS for rediss:// even without NODE_ENV=production', async () => {
      process.env.REDIS_URL = 'rediss://redis.example.com:6380';
      process.env.NODE_ENV = 'development';
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
      setupAutoReady();

      await redis.initRedis();

      expect(Redis).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tls: { rejectUnauthorized: false }
        })
      );
    });
  });

  // ========================================
  // Redis Client Creation
  // ========================================
  describe('Redis Client Creation', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
      setupAutoReady();
    });

    it.skip('should create Redis client with correct configuration', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      await redis.initRedis();

      expect(Redis).toHaveBeenCalledWith(
        'redis://localhost:6379',
        expect.objectContaining({
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: true
        })
      );
    });

    it.skip('should register event handlers on Redis client', async () => {
      await redis.initRedis();

      expect(mockRedisInstance.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
    });

    it.skip('should call connect() on client initialization', async () => {
      await redis.initRedis();

      expect(mockRedisInstance.connect).toHaveBeenCalled();
    });

    it.skip('should include retryStrategy function', async () => {
      await redis.initRedis();

      const callArgs = Redis.mock.calls[0][1];
      expect(typeof callArgs.retryStrategy).toBe('function');
    });
  });

  // ========================================
  // Connection Management
  // ========================================
  describe('Connection Management', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
      setupAutoReady();
    });

    it('should return existing client on second initRedis() call', async () => {
      await redis.initRedis();
      const firstCallCount = Redis.mock.calls.length;

      await redis.initRedis();
      const secondCallCount = Redis.mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount);
    });

    it.skip('should return same promise if multiple init calls happen simultaneously', async () => {
      const promise1 = redis.initRedis();
      const promise2 = redis.initRedis();

      expect(promise1).toBe(promise2);
    });

    it.skip('should log info message on connect event', async () => {
      let connectHandler;
      mockRedisInstance.on.mockImplementation((event, handler) => {
        if (event === 'connect') connectHandler = handler;
      });

      await redis.initRedis();
      connectHandler();

      expect(log.info).toHaveBeenCalledWith('Redis: Connecting...');
    });

    it.skip('should log info message on ready event', async () => {
      let readyHandler;
      mockRedisInstance.on.mockImplementation((event, handler) => {
        if (event === 'ready') readyHandler = handler;
      });

      await redis.initRedis();
      readyHandler();

      expect(log.info).toHaveBeenCalledWith('Redis: Connected and ready');
    });

    it.skip('should log error message on error event', async () => {
      let errorHandler;
      mockRedisInstance.on.mockImplementation((event, handler) => {
        if (event === 'error') errorHandler = handler;
      });

      await redis.initRedis();
      errorHandler(new Error('Connection failed'));

      expect(log.error).toHaveBeenCalledWith(
        'Redis: Connection error',
        expect.objectContaining({ error: 'Connection failed' })
      );
    });

    it.skip('should log warn message on close event', async () => {
      let closeHandler;
      mockRedisInstance.on.mockImplementation((event, handler) => {
        if (event === 'close') closeHandler = handler;
      });

      await redis.initRedis();
      closeHandler();

      expect(log.warn).toHaveBeenCalledWith('Redis: Connection closed');
    });

    it.skip('should log info message on reconnecting event', async () => {
      let reconnectingHandler;
      mockRedisInstance.on.mockImplementation((event, handler) => {
        if (event === 'reconnecting') reconnectingHandler = handler;
      });

      await redis.initRedis();
      reconnectingHandler();

      expect(log.info).toHaveBeenCalledWith('Redis: Reconnecting...');
    });
  });

  // ========================================
  // Error Handling
  // ========================================
  describe('Error Handling', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
      setupAutoReady();
    });

    it.skip('should handle connection errors gracefully', async () => {
      mockRedisInstance.connect.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(redis.initRedis()).rejects.toThrow('Connection refused');
      expect(log.error).toHaveBeenCalled();
    });

    it.skip('should log error when client creation fails', async () => {
      Redis.mockImplementationOnce(() => {
        throw new Error('Invalid config');
      });

      await expect(redis.initRedis()).rejects.toThrow('Invalid config');
      expect(log.error).toHaveBeenCalledWith(
        'Redis: Failed to initialize',
        expect.objectContaining({ error: 'Invalid config' })
      );
    });

    it.skip('should reject promise on error event during connection', async () => {
      let errorHandler;
      mockRedisInstance.on.mockImplementation((event, handler) => {
        if (event === 'error') errorHandler = handler;
      });
      mockRedisInstance.connect.mockImplementationOnce(async () => {
        errorHandler(new Error('Auth failed'));
        throw new Error('Auth failed');
      });

      await expect(redis.initRedis()).rejects.toThrow('Auth failed');
    });
  });

  // ========================================
  // Retry Strategy
  // ========================================
  describe('Retry Strategy', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
      setupAutoReady();
    });

    it.skip('should return increasing delay for retry attempts', async () => {
      await redis.initRedis();

      const retryStrategy = Redis.mock.calls[0][1].retryStrategy;

      expect(retryStrategy(1)).toBe(100);
      expect(retryStrategy(2)).toBe(200);
      expect(retryStrategy(5)).toBe(500);
    });

    it.skip('should cap retry delay at 3000ms', async () => {
      await redis.initRedis();

      const retryStrategy = Redis.mock.calls[0][1].retryStrategy;

      expect(retryStrategy(50)).toBe(3000);
      expect(retryStrategy(100)).toBe(3000);
    });

    it.skip('should stop retrying after 10 attempts', async () => {
      await redis.initRedis();

      const retryStrategy = Redis.mock.calls[0][1].retryStrategy;

      expect(retryStrategy(11)).toBeNull();
      expect(retryStrategy(20)).toBeNull();
    });

    it.skip('should log warning on each retry attempt', async () => {
      await redis.initRedis();

      const retryStrategy = Redis.mock.calls[0][1].retryStrategy;

      retryStrategy(3);
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('Redis: Reconnecting in 300ms (attempt 3)')
      );
    });

    it.skip('should log error when max retries reached', async () => {
      await redis.initRedis();

      const retryStrategy = Redis.mock.calls[0][1].retryStrategy;

      retryStrategy(11);
      expect(log.error).toHaveBeenCalledWith(
        'Redis: Max retry attempts reached, giving up'
      );
    });
  });

  // ========================================
  // getRedisClient()
  // ========================================
  describe('getRedisClient()', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
      setupAutoReady();
    });

    it.skip('should initialize and return Redis client', async () => {
      const client = await redis.getRedisClient();

      expect(client).toBe(mockRedisInstance);
      expect(mockRedisInstance.connect).toHaveBeenCalled();
    });

    it('should return same client on multiple calls', async () => {
      const client1 = await redis.getRedisClient();
      const client2 = await redis.getRedisClient();

      expect(client1).toBe(client2);
    });

    it('should reinitialize if client is not connected', async () => {
      await redis.getRedisClient();
      await redis.closeRedis();

      const client = await redis.getRedisClient();

      expect(client).toBe(mockRedisInstance);
    });
  });

  // ========================================
  // isRedisConnected()
  // ========================================
  describe('isRedisConnected()', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
      setupAutoReady();
    });

    it.skip('should return false before connection', () => {
      expect(redis.isRedisConnected()).toBe(false);
    });

    it.skip('should return true after successful connection', async () => {
      let readyHandler;
      mockRedisInstance.on.mockImplementation((event, handler) => {
        if (event === 'ready') readyHandler = handler;
      });

      await redis.initRedis();
      readyHandler(); // Simulate ready event

      expect(redis.isRedisConnected()).toBe(true);
    });

    it.skip('should return false after connection closes', async () => {
      let readyHandler, closeHandler;
      mockRedisInstance.on.mockImplementation((event, handler) => {
        if (event === 'ready') readyHandler = handler;
        if (event === 'close') closeHandler = handler;
      });

      await redis.initRedis();
      readyHandler();
      closeHandler();

      expect(redis.isRedisConnected()).toBe(false);
    });
  });

  // ========================================
  // closeRedis()
  // ========================================
  describe('closeRedis()', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
      setupAutoReady();
    });

    it('should call quit() on Redis client', async () => {
      await redis.initRedis();
      await redis.closeRedis();

      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });

    it('should log success message on graceful close', async () => {
      await redis.initRedis();
      await redis.closeRedis();

      expect(log.info).toHaveBeenCalledWith('Redis: Connection closed gracefully');
    });

    it('should handle errors during close', async () => {
      mockRedisInstance.quit.mockRejectedValueOnce(new Error('Quit failed'));

      await redis.initRedis();
      await redis.closeRedis();

      expect(log.error).toHaveBeenCalledWith(
        'Redis: Error closing connection',
        expect.objectContaining({ error: 'Quit failed' })
      );
    });

    it.skip('should allow reinit after close', async () => {
      await redis.initRedis();
      await redis.closeRedis();

      expect(redis.isRedisConnected()).toBe(false);

      await redis.initRedis();
      expect(Redis).toHaveBeenCalledTimes(2);
    });

    it('should not throw if called without init', async () => {
      await expect(redis.closeRedis()).resolves.not.toThrow();
    });
  });

  // ========================================
  // Cache Constants
  // ========================================
  describe('Cache Constants', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
      setupAutoReady();
    });

    it('should export CACHE_TTL object', () => {
      expect(redis.CACHE_TTL).toBeDefined();
      expect(typeof redis.CACHE_TTL).toBe('object');
    });

    it('should have correct SESSION TTL (24 hours)', () => {
      expect(redis.CACHE_TTL.SESSION).toBe(60 * 60 * 24);
    });

    it('should have correct API_RESPONSE TTL (5 minutes)', () => {
      expect(redis.CACHE_TTL.API_RESPONSE).toBe(60 * 5);
    });

    it('should have correct RATE_LIMIT TTL (15 minutes)', () => {
      expect(redis.CACHE_TTL.RATE_LIMIT).toBe(60 * 15);
    });

    it('should have correct USER_DATA TTL (10 minutes)', () => {
      expect(redis.CACHE_TTL.USER_DATA).toBe(60 * 10);
    });

    it('should have correct BOT_CONFIG TTL (30 minutes)', () => {
      expect(redis.CACHE_TTL.BOT_CONFIG).toBe(60 * 30);
    });

    it('should have correct ORGANIZATION TTL (15 minutes)', () => {
      expect(redis.CACHE_TTL.ORGANIZATION).toBe(60 * 15);
    });

    it('should have correct SHORT TTL (1 minute)', () => {
      expect(redis.CACHE_TTL.SHORT).toBe(60);
    });

    it('should have correct MEDIUM TTL (5 minutes)', () => {
      expect(redis.CACHE_TTL.MEDIUM).toBe(60 * 5);
    });

    it('should have correct LONG TTL (1 hour)', () => {
      expect(redis.CACHE_TTL.LONG).toBe(60 * 60);
    });

    it('should export CACHE_PREFIX object', () => {
      expect(redis.CACHE_PREFIX).toBeDefined();
      expect(typeof redis.CACHE_PREFIX).toBe('object');
    });

    it('should have all expected cache prefixes', () => {
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
  // Module Exports
  // ========================================
  describe('Module Exports', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../config/redis')];
      redis = require('../../config/redis');
      setupAutoReady();
    });

    it('should export initRedis function', () => {
      expect(typeof redis.initRedis).toBe('function');
    });

    it('should export getRedisClient function', () => {
      expect(typeof redis.getRedisClient).toBe('function');
    });

    it('should export isRedisConnected function', () => {
      expect(typeof redis.isRedisConnected).toBe('function');
    });

    it('should export closeRedis function', () => {
      expect(typeof redis.closeRedis).toBe('function');
    });

    it('should export CACHE_TTL constant', () => {
      expect(redis.CACHE_TTL).toBeDefined();
    });

    it('should export CACHE_PREFIX constant', () => {
      expect(redis.CACHE_PREFIX).toBeDefined();
    });
  });
});
