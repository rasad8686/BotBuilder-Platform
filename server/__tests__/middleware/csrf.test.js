/**
 * CSRF Middleware Tests
 * Comprehensive tests for CSRF protection middleware
 */

const httpMocks = require('node-mocks-http');
const crypto = require('crypto');

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const logger = require('../../utils/logger');
const {
  csrfTokenMiddleware,
  csrfValidationMiddleware,
  csrfTokenEndpoint,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME
} = require('../../middleware/csrf');

describe('CSRF Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = httpMocks.createRequest({
      cookies: {},
      headers: {},
      method: 'GET',
      path: '/test',
      ip: '127.0.0.1'
    });
    mockRes = httpMocks.createResponse();
    mockNext = jest.fn();
  });

  describe('Constants', () => {
    it('should have correct cookie name', () => {
      expect(CSRF_COOKIE_NAME).toBe('csrf_token');
    });

    it('should have correct header name', () => {
      expect(CSRF_HEADER_NAME).toBe('x-csrf-token');
    });
  });

  describe('csrfTokenMiddleware', () => {
    it('should generate token if not exists', () => {
      csrfTokenMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'csrf_token',
        expect.any(String),
        expect.any(Object)
      );
      expect(mockReq.csrfToken).toBeDefined();
      expect(mockRes.locals.csrfToken).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should generate cryptographically secure token', () => {
      csrfTokenMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should reuse existing token from cookie', () => {
      const existingToken = 'a'.repeat(64);
      mockReq.cookies.csrf_token = existingToken;

      csrfTokenMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.csrfToken).toBe(existingToken);
      expect(mockRes.locals.csrfToken).toBe(existingToken);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set cookie with correct options', () => {
      csrfTokenMiddleware(mockReq, mockRes, mockNext);

      const cookieOptions = mockRes.cookie.mock.calls[0][2];
      expect(cookieOptions.httpOnly).toBe(false);
      expect(cookieOptions.sameSite).toBe('lax');
      expect(cookieOptions.path).toBe('/');
      expect(cookieOptions.maxAge).toBe(24 * 60 * 60 * 1000);
    });

    it('should set secure flag in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      csrfTokenMiddleware(mockReq, mockRes, mockNext);

      const cookieOptions = mockRes.cookie.mock.calls[0][2];
      expect(cookieOptions.secure).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it('should not set secure flag in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      csrfTokenMiddleware(mockReq, mockRes, mockNext);

      const cookieOptions = mockRes.cookie.mock.calls[0][2];
      expect(cookieOptions.secure).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });

    it('should make token available in res.locals', () => {
      csrfTokenMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.locals.csrfToken).toBeDefined();
      expect(mockRes.locals.csrfToken).toBe(mockReq.csrfToken);
    });

    it('should generate different tokens for different calls', () => {
      const req1 = httpMocks.createRequest();
      const res1 = httpMocks.createResponse();

      const req2 = httpMocks.createRequest();
      const res2 = httpMocks.createResponse();

      csrfTokenMiddleware(req1, res1, mockNext);
      csrfTokenMiddleware(req2, res2, mockNext);

      expect(req1.csrfToken).not.toBe(req2.csrfToken);
    });
  });

  describe('csrfValidationMiddleware', () => {
    describe('Safe methods', () => {
      it('should skip validation for GET', () => {
        mockReq.method = 'GET';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.statusCode).toBe(200);
      });

      it('should skip validation for HEAD', () => {
        mockReq.method = 'HEAD';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for OPTIONS', () => {
        mockReq.method = 'OPTIONS';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('Exempt routes', () => {
      it('should skip validation for auth/login', () => {
        mockReq.method = 'POST';
        mockReq.path = '/auth/login';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for auth/register', () => {
        mockReq.method = 'POST';
        mockReq.path = '/auth/register';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for auth/demo', () => {
        mockReq.method = 'POST';
        mockReq.path = '/auth/demo';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for auth/logout', () => {
        mockReq.method = 'POST';
        mockReq.path = '/auth/logout';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for webhooks', () => {
        mockReq.method = 'POST';
        mockReq.path = '/webhooks/stripe';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for widget', () => {
        mockReq.method = 'POST';
        mockReq.path = '/widget/chat';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for forgot password', () => {
        mockReq.method = 'POST';
        mockReq.path = '/auth/forgot-password';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for reset password', () => {
        mockReq.method = 'POST';
        mockReq.path = '/auth/reset-password';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for email verification', () => {
        mockReq.method = 'POST';
        mockReq.path = '/auth/verify-email';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for 2FA validation', () => {
        mockReq.method = 'POST';
        mockReq.path = '/auth/2fa/validate';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for admin auth login', () => {
        mockReq.method = 'POST';
        mockReq.path = '/admin-auth/login';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for billing webhook', () => {
        mockReq.method = 'POST';
        mockReq.path = '/billing/webhook';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for voice upload', () => {
        mockReq.method = 'POST';
        mockReq.path = '/voice-to-bot/upload';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for fine-tuning', () => {
        mockReq.method = 'POST';
        mockReq.path = '/fine-tuning/start';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('Protected routes', () => {
      beforeEach(() => {
        mockReq.method = 'POST';
        mockReq.path = '/api/bots';
      });

      it('should reject request without cookie token', () => {
        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(403);
        expect(mockRes._getJSONData()).toMatchObject({
          success: false,
          error: 'CSRF_TOKEN_MISSING'
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should reject request without header token', () => {
        const token = 'a'.repeat(64);
        mockReq.cookies.csrf_token = token;

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(403);
        expect(mockRes._getJSONData()).toMatchObject({
          success: false,
          error: 'CSRF_TOKEN_MISSING'
        });
      });

      it('should reject request with mismatched tokens', () => {
        const token1 = 'a'.repeat(64);
        const token2 = 'b'.repeat(64);
        mockReq.cookies.csrf_token = token1;
        mockReq.headers['x-csrf-token'] = token2;

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(403);
        expect(mockRes._getJSONData()).toMatchObject({
          success: false,
          error: 'CSRF_TOKEN_INVALID'
        });
      });

      it('should accept request with matching tokens', () => {
        const token = 'a'.repeat(64);
        mockReq.cookies.csrf_token = token;
        mockReq.headers['x-csrf-token'] = token;

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.statusCode).toBe(200);
      });

      it('should use timing-safe comparison', () => {
        const timingSafeEqualSpy = jest.spyOn(crypto, 'timingSafeEqual');
        const token = 'c'.repeat(64);
        mockReq.cookies.csrf_token = token;
        mockReq.headers['x-csrf-token'] = token;

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(timingSafeEqualSpy).toHaveBeenCalled();
        timingSafeEqualSpy.mockRestore();
      });

      it('should log warning when cookie token is missing', () => {
        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('No cookie token'),
          expect.objectContaining({
            path: '/api/bots',
            method: 'POST',
            ip: '127.0.0.1'
          })
        );
      });

      it('should log warning when header token is missing', () => {
        mockReq.cookies.csrf_token = 'a'.repeat(64);

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('No header token'),
          expect.any(Object)
        );
      });

      it('should log warning when tokens mismatch', () => {
        mockReq.cookies.csrf_token = 'a'.repeat(64);
        mockReq.headers['x-csrf-token'] = 'b'.repeat(64);

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Token mismatch'),
          expect.any(Object)
        );
      });
    });

    describe('All protected methods', () => {
      const token = 'c'.repeat(64);

      beforeEach(() => {
        mockReq.path = '/api/protected';
        mockReq.cookies.csrf_token = token;
        mockReq.headers['x-csrf-token'] = token;
      });

      it('should validate POST requests', () => {
        mockReq.method = 'POST';
        csrfValidationMiddleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should validate PUT requests', () => {
        mockReq.method = 'PUT';
        csrfValidationMiddleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should validate DELETE requests', () => {
        mockReq.method = 'DELETE';
        csrfValidationMiddleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should validate PATCH requests', () => {
        mockReq.method = 'PATCH';
        csrfValidationMiddleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('Edge cases', () => {
      it('should handle case-insensitive header names', () => {
        const token = 'a'.repeat(64);
        mockReq.method = 'POST';
        mockReq.path = '/api/test';
        mockReq.cookies.csrf_token = token;
        mockReq.headers['X-CSRF-Token'] = token; // Capital letters

        // Express normalizes headers to lowercase, but we test the concept
        mockReq.headers['x-csrf-token'] = token;

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should handle empty token strings', () => {
        mockReq.method = 'POST';
        mockReq.path = '/api/test';
        mockReq.cookies.csrf_token = '';
        mockReq.headers['x-csrf-token'] = '';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(403);
      });

      it('should reject tokens of different lengths', () => {
        mockReq.method = 'POST';
        mockReq.path = '/api/test';
        mockReq.cookies.csrf_token = 'a'.repeat(64);
        mockReq.headers['x-csrf-token'] = 'a'.repeat(32);

        expect(() => {
          csrfValidationMiddleware(mockReq, mockRes, mockNext);
        }).toThrow(); // timingSafeEqual throws on different lengths
      });
    });
  });

  describe('csrfTokenEndpoint', () => {
    it('should return CSRF token', () => {
      mockReq.csrfToken = 'existing-token';

      csrfTokenEndpoint(mockReq, mockRes);

      const data = mockRes._getJSONData();
      expect(data).toMatchObject({
        success: true,
        csrfToken: 'existing-token'
      });
    });

    it('should generate new token if not available', () => {
      csrfTokenEndpoint(mockReq, mockRes);

      const data = mockRes._getJSONData();
      expect(data.success).toBe(true);
      expect(data.csrfToken).toBeDefined();
      expect(data.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should set cookie with token', () => {
      mockReq.csrfToken = 'token123';

      csrfTokenEndpoint(mockReq, mockRes);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'csrf_token',
        'token123',
        expect.any(Object)
      );
    });

    it('should set cookie with correct options', () => {
      mockReq.csrfToken = 'test-token';

      csrfTokenEndpoint(mockReq, mockRes);

      const cookieOptions = mockRes.cookie.mock.calls[0][2];
      expect(cookieOptions.httpOnly).toBe(false);
      expect(cookieOptions.sameSite).toBe('lax');
      expect(cookieOptions.maxAge).toBe(24 * 60 * 60 * 1000);
    });

    it('should set secure cookie in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      mockReq.csrfToken = 'test-token';

      csrfTokenEndpoint(mockReq, mockRes);

      const cookieOptions = mockRes.cookie.mock.calls[0][2];
      expect(cookieOptions.secure).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it('should refresh existing cookie', () => {
      mockReq.csrfToken = 'existing-token';
      mockReq.cookies.csrf_token = 'existing-token';

      csrfTokenEndpoint(mockReq, mockRes);

      expect(mockRes.cookie).toHaveBeenCalled();
      const data = mockRes._getJSONData();
      expect(data.csrfToken).toBe('existing-token');
    });
  });

  describe('Integration scenarios', () => {
    it('should support full token lifecycle', () => {
      // Step 1: Generate token
      const req1 = httpMocks.createRequest();
      const res1 = httpMocks.createResponse();
      csrfTokenMiddleware(req1, res1, mockNext);
      const token = req1.csrfToken;

      // Step 2: Client receives token and sends it back
      const req2 = httpMocks.createRequest({
        method: 'POST',
        path: '/api/bots',
        cookies: { csrf_token: token },
        headers: { 'x-csrf-token': token }
      });
      const res2 = httpMocks.createResponse();
      csrfValidationMiddleware(req2, res2, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(2);
    });

    it('should allow multiple valid requests with same token', () => {
      const token = 'a'.repeat(64);

      for (let i = 0; i < 5; i++) {
        const req = httpMocks.createRequest({
          method: 'POST',
          path: '/api/test',
          cookies: { csrf_token: token },
          headers: { 'x-csrf-token': token }
        });
        const res = httpMocks.createResponse();
        csrfValidationMiddleware(req, res, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(5);
    });
  });
});
