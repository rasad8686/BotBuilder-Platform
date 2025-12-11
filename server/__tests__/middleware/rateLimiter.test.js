/**
 * Rate Limiter Middleware Tests
 * Tests for server/middleware/rateLimiter.js
 */

const { apiLimiter, authLimiter } = require('../../middleware/rateLimiter');

describe('Rate Limiter Middleware', () => {
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
});
