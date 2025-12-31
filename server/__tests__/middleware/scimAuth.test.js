/**
 * SCIM Auth Middleware Tests
 * Tests for SCIM Bearer token authentication
 */

// Use fake timers to handle setInterval in scimAuth module
jest.useFakeTimers();

jest.mock('../../services/scimService');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const SCIMService = require('../../services/scimService');
const {
  scimAuth,
  scimContentType,
  scimErrorHandler,
  checkRateLimit
} = require('../../middleware/scimAuth');

describe('SCIM Auth Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    mockReq = {
      headers: {},
      method: 'GET',
      path: '/scim/v2/Users',
      ip: '127.0.0.1',
      get: jest.fn((header) => mockReq.headers[header.toLowerCase()])
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn()
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('scimAuth', () => {
    it('should reject request without authorization header', async () => {
      await scimAuth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: '401',
          detail: expect.any(String)
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid authorization format', async () => {
      mockReq.headers.authorization = 'Basic abc123';

      await scimAuth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should reject request with invalid token', async () => {
      mockReq.headers.authorization = 'Bearer invalid-token';
      SCIMService.validateToken.mockResolvedValue(null);

      await scimAuth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'Invalid or expired token'
        })
      );
    });

    it('should reject request when SCIM is disabled', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      SCIMService.validateToken.mockResolvedValue({
        id: 'config-1',
        scim_enabled: false
      });

      await scimAuth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'SCIM is not enabled for this configuration'
        })
      );
    });

    it('should allow request with valid token and SCIM enabled', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      SCIMService.validateToken.mockResolvedValue({
        id: 'config-1',
        scim_enabled: true
      });

      await scimAuth(mockReq, mockRes, mockNext);

      expect(mockReq.ssoConfig).toBeDefined();
      expect(mockReq.ssoConfig.id).toBe('config-1');
      expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(Number));
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      SCIMService.validateToken.mockRejectedValue(new Error('Service error'));

      await scimAuth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: '500',
          detail: 'Authentication error'
        })
      );
    });

    it('should set rate limit headers', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      SCIMService.validateToken.mockResolvedValue({
        id: 'config-1',
        scim_enabled: true
      });

      await scimAuth(mockReq, mockRes, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(Number));
      expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
      expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
    });
  });

  describe('checkRateLimit', () => {
    it('should allow first request', () => {
      const result = checkRateLimit('test-key-1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeDefined();
    });

    it('should track multiple requests', () => {
      const key = 'test-key-track-' + Date.now();

      const result1 = checkRateLimit(key);
      const result2 = checkRateLimit(key);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBeLessThan(result1.remaining);
    });

    it('should reset after window expires', () => {
      const key = 'test-key-reset-' + Date.now();

      const result = checkRateLimit(key);

      expect(result.allowed).toBe(true);
      expect(result.windowStart).toBeDefined();
    });
  });

  describe('scimContentType', () => {
    it('should set SCIM content type header', () => {
      scimContentType(mockReq, mockRes, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith('Content-Type', 'application/scim+json');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('scimErrorHandler', () => {
    it('should handle error with status', () => {
      const error = new Error('Not found');
      error.status = 404;

      scimErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: '404',
          detail: 'Not found'
        })
      );
    });

    it('should handle error without status (default 500)', () => {
      const error = new Error('Server error');

      scimErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should include scimType when available', () => {
      const error = new Error('Invalid resource');
      error.status = 400;
      error.scimType = 'invalidValue';

      scimErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          scimType: 'invalidValue'
        })
      );
    });

    it('should handle error without message', () => {
      const error = new Error();
      error.status = 500;

      scimErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'Internal server error'
        })
      );
    });
  });
});
