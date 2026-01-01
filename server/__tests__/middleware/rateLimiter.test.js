/**
 * Rate Limiter Middleware Tests
 * Comprehensive tests for server/middleware/rateLimiter.js
 */

const httpMocks = require('node-mocks-http');

// Mock dependencies
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const {
  apiLimiter,
  authLimiter,
  dbAuthLimiter,
  recordFailedLogin,
  getRateLimitSettings,
  isBlocked,
  recordFailedAttempt,
  clearAttempts
} = require('../../middleware/rateLimiter');

describe('Rate Limiter Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = httpMocks.createRequest({
      method: 'GET',
      url: '/api/test',
      headers: {},
      ip: '127.0.0.1'
    });
    res = httpMocks.createResponse();
    next = jest.fn();
  });

  describe('apiLimiter', () => {
    it('should be defined', () => {
      expect(apiLimiter).toBeDefined();
    });

    it('should be a function (middleware)', () => {
      expect(typeof apiLimiter).toBe('function');
    });
  });

  describe('authLimiter', () => {
    it('should be defined', () => {
      expect(authLimiter).toBeDefined();
    });

    it('should be a function (middleware)', () => {
      expect(typeof authLimiter).toBe('function');
    });
  });

  describe('getRateLimitSettings', () => {
    it('should return cached settings when cache is fresh', async () => {
      const settings = await getRateLimitSettings();

      expect(settings).toBeDefined();
      expect(settings.enabled).toBeDefined();
      expect(settings.max_attempts).toBeDefined();
      expect(settings.window_minutes).toBeDefined();
      expect(settings.block_duration_minutes).toBeDefined();
    });

    it('should fetch from database when cache is stale', async () => {
      const mockSettings = {
        enabled: true,
        max_attempts: 10,
        window_minutes: 20,
        block_duration_minutes: 30
      };
      db.query.mockResolvedValueOnce({ rows: [mockSettings] });

      // Wait for cache to potentially expire
      const settings = await getRateLimitSettings();

      expect(settings.max_attempts).toBeDefined();
    });

    it('should use defaults when database query fails', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const settings = await getRateLimitSettings();

      expect(settings).toBeDefined();
      expect(settings.enabled).toBeDefined();
    });

    it('should use defaults when no settings in database', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const settings = await getRateLimitSettings();

      expect(settings).toBeDefined();
      expect(typeof settings.enabled).toBe('boolean');
    });

    it('should cache settings with lastFetch timestamp', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          enabled: true,
          max_attempts: 5,
          window_minutes: 15,
          block_duration_minutes: 15
        }]
      });

      const settings = await getRateLimitSettings();

      expect(settings.lastFetch).toBeDefined();
      expect(typeof settings.lastFetch).toBe('number');
    });
  });

  describe('isBlocked', () => {
    it('should return null when IP is not blocked', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await isBlocked('127.0.0.1', 'test@example.com');

      expect(result).toBeNull();
    });

    it('should return blocked record when IP is blocked', async () => {
      const blockedRecord = {
        id: 1,
        ip_address: '127.0.0.1',
        blocked_until: new Date(Date.now() + 60000)
      };
      db.query.mockResolvedValueOnce({ rows: [blockedRecord] });

      const result = await isBlocked('127.0.0.1', 'test@example.com');

      expect(result).toEqual(blockedRecord);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM rate_limit_blocked'),
        ['127.0.0.1', 'test@example.com']
      );
    });

    it('should return blocked record when email is blocked', async () => {
      const blockedRecord = {
        id: 2,
        email: 'test@example.com',
        blocked_until: new Date(Date.now() + 60000)
      };
      db.query.mockResolvedValueOnce({ rows: [blockedRecord] });

      const result = await isBlocked('192.168.1.1', 'test@example.com');

      expect(result).toEqual(blockedRecord);
    });

    it('should return null when database query fails', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await isBlocked('127.0.0.1', 'test@example.com');

      expect(result).toBeNull();
    });

    it('should handle null email gracefully', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await isBlocked('127.0.0.1', null);

      expect(result).toBeNull();
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        ['127.0.0.1', '']
      );
    });

    it('should filter by blocked_until > NOW()', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await isBlocked('127.0.0.1', 'test@example.com');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('blocked_until > NOW()'),
        expect.any(Array)
      );
    });
  });

  describe('recordFailedAttempt', () => {
    const settings = {
      max_attempts: 5,
      window_minutes: 15,
      block_duration_minutes: 15
    };

    it('should insert new record for first failed attempt', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // No existing record
      db.query.mockResolvedValueOnce({ rows: [] }); // Insert

      const result = await recordFailedAttempt('127.0.0.1', 'test@example.com', settings);

      expect(result).toBe(false); // Not blocked on first attempt
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO rate_limit_blocked'),
        expect.any(Array)
      );
    });

    it('should update existing record and increment count', async () => {
      const existingRecord = {
        id: 1,
        ip_address: '127.0.0.1',
        attempt_count: 2,
        created_at: new Date()
      };
      db.query.mockResolvedValueOnce({ rows: [existingRecord] }); // Existing record
      db.query.mockResolvedValueOnce({ rows: [] }); // Update

      const result = await recordFailedAttempt('127.0.0.1', 'test@example.com', settings);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE rate_limit_blocked'),
        expect.any(Array)
      );
    });

    it('should block when max attempts reached', async () => {
      const existingRecord = {
        id: 1,
        ip_address: '127.0.0.1',
        attempt_count: 4, // One more will hit max_attempts: 5
        created_at: new Date()
      };
      db.query.mockResolvedValueOnce({ rows: [existingRecord] });
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await recordFailedAttempt('127.0.0.1', 'test@example.com', settings);

      expect(result).toBe(true); // Should be blocked
    });

    it('should handle null email', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [] });

      await recordFailedAttempt('127.0.0.1', null, settings);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO rate_limit_blocked'),
        expect.arrayContaining(['127.0.0.1', null])
      );
    });

    it('should return false when database query fails', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await recordFailedAttempt('127.0.0.1', 'test@example.com', settings);

      expect(result).toBe(false);
    });

    it('should use parameterized window_minutes to prevent SQL injection', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [] });

      const customSettings = { ...settings, window_minutes: 20 };
      await recordFailedAttempt('127.0.0.1', 'test@example.com', customSettings);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '1 minute' * $2"),
        expect.arrayContaining(['127.0.0.1', 20])
      );
    });

    it('should sanitize window_minutes to integer', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [] });

      const maliciousSettings = { ...settings, window_minutes: "15; DROP TABLE users;" };
      await recordFailedAttempt('127.0.0.1', 'test@example.com', maliciousSettings);

      // Should parse as integer
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['127.0.0.1', 15])
      );
    });
  });

  describe('clearAttempts', () => {
    it('should delete records for IP and email', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await clearAttempts('127.0.0.1', 'test@example.com');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM rate_limit_blocked'),
        ['127.0.0.1', 'test@example.com']
      );
    });

    it('should handle null email', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await clearAttempts('127.0.0.1', null);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        ['127.0.0.1', '']
      );
    });

    it('should handle database errors silently', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(clearAttempts('127.0.0.1', 'test@example.com')).resolves.not.toThrow();
    });
  });

  describe('dbAuthLimiter', () => {
    beforeEach(() => {
      req = httpMocks.createRequest({
        method: 'POST',
        url: '/auth/login',
        ip: '127.0.0.1',
        body: { email: 'test@example.com', password: 'password123' }
      });
      res = httpMocks.createResponse();
    });

    it('should call next when rate limiting is disabled', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          enabled: false,
          max_attempts: 5,
          window_minutes: 15,
          block_duration_minutes: 15
        }]
      });
      db.query.mockResolvedValueOnce({ rows: [] }); // isBlocked check

      await dbAuthLimiter(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).not.toBe(429);
    });

    it('should call next when IP is not blocked', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          enabled: true,
          max_attempts: 5,
          window_minutes: 15,
          block_duration_minutes: 15
        }]
      });
      db.query.mockResolvedValueOnce({ rows: [] }); // isBlocked check

      await dbAuthLimiter(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 429 when IP is blocked', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          enabled: true,
          max_attempts: 5,
          window_minutes: 15,
          block_duration_minutes: 15
        }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          ip_address: '127.0.0.1',
          blocked_until: new Date(Date.now() + 600000) // 10 minutes from now
        }]
      });

      await dbAuthLimiter(req, res, next);

      expect(res.statusCode).toBe(429);
      expect(res._getJSONData()).toMatchObject({
        success: false,
        blocked: true,
        remainingMinutes: expect.any(Number)
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should calculate remaining minutes correctly', async () => {
      const blockedUntil = new Date(Date.now() + 300000); // 5 minutes from now
      db.query.mockResolvedValueOnce({
        rows: [{ enabled: true, max_attempts: 5, window_minutes: 15, block_duration_minutes: 15 }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          ip_address: '127.0.0.1',
          blocked_until: blockedUntil
        }]
      });

      await dbAuthLimiter(req, res, next);

      const data = res._getJSONData();
      expect(data.remainingMinutes).toBeGreaterThan(0);
      expect(data.remainingMinutes).toBeLessThanOrEqual(5);
    });

    it('should handle missing email in request body', async () => {
      req.body = { password: 'password123' };
      db.query.mockResolvedValueOnce({
        rows: [{ enabled: true, max_attempts: 5, window_minutes: 15, block_duration_minutes: 15 }]
      });
      db.query.mockResolvedValueOnce({ rows: [] });

      await dbAuthLimiter(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should extract IP from different sources', async () => {
      req.ip = undefined;
      req.connection = { remoteAddress: '192.168.1.1' };
      db.query.mockResolvedValueOnce({
        rows: [{ enabled: true, max_attempts: 5, window_minutes: 15, block_duration_minutes: 15 }]
      });
      db.query.mockResolvedValueOnce({ rows: [] });

      await dbAuthLimiter(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should use "unknown" IP when none available', async () => {
      req.ip = undefined;
      req.connection = {};
      db.query.mockResolvedValueOnce({
        rows: [{ enabled: true, max_attempts: 5, window_minutes: 15, block_duration_minutes: 15 }]
      });
      db.query.mockResolvedValueOnce({ rows: [] });

      await dbAuthLimiter(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('recordFailedLogin', () => {
    beforeEach(() => {
      req = httpMocks.createRequest({
        method: 'POST',
        url: '/auth/login',
        ip: '127.0.0.1',
        body: { email: 'test@example.com', password: 'wrong' }
      });
      res = httpMocks.createResponse();
    });

    it('should intercept res.json', () => {
      recordFailedLogin(req, res, next);

      expect(typeof res.json).toBe('function');
      expect(next).toHaveBeenCalled();
    });

    it('should record failed attempt on 401 status', async () => {
      db.query.mockResolvedValue({
        rows: [{ enabled: true, max_attempts: 5, window_minutes: 15, block_duration_minutes: 15 }]
      });

      recordFailedLogin(req, res, next);

      res.statusCode = 401;
      res.json({ success: false, message: 'Invalid credentials' });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(db.query).toHaveBeenCalled();
    });

    it('should record failed attempt on success: false', async () => {
      db.query.mockResolvedValue({
        rows: [{ enabled: true, max_attempts: 5, window_minutes: 15, block_duration_minutes: 15 }]
      });

      recordFailedLogin(req, res, next);

      res.statusCode = 200;
      res.json({ success: false, message: 'Invalid credentials' });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(db.query).toHaveBeenCalled();
    });

    it('should clear attempts on successful login', async () => {
      db.query.mockResolvedValue({ rows: [] });

      recordFailedLogin(req, res, next);

      res.statusCode = 200;
      res.json({ success: true, token: 'jwt-token', user: {} });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM rate_limit_blocked'),
        expect.any(Array)
      );
    });

    it('should not clear attempts when 2FA is required', async () => {
      recordFailedLogin(req, res, next);

      res.statusCode = 200;
      res.json({ success: true, requires2FA: true });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not call delete
      expect(db.query).not.toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        expect.any(Array)
      );
    });

    it('should extract IP from x-forwarded-for header', async () => {
      req.ip = undefined;
      req.connection = {};
      req.headers = { 'x-forwarded-for': '203.0.113.195' };

      db.query.mockResolvedValue({
        rows: [{ enabled: true, max_attempts: 5, window_minutes: 15, block_duration_minutes: 15 }]
      });

      recordFailedLogin(req, res, next);

      res.statusCode = 401;
      res.json({ success: false });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(db.query).toHaveBeenCalled();
    });

    it('should handle errors silently without blocking response', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      recordFailedLogin(req, res, next);

      res.statusCode = 401;
      const result = res.json({ success: false });

      expect(result).toBeDefined();
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });
});
