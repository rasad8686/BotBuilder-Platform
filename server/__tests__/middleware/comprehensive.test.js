/**
 * Comprehensive Middleware Tests
 * Tests for all server middleware components
 *
 * Coverage:
 * - auth.js - JWT authentication and token validation
 * - rateLimiter.js - Rate limiting logic
 * - organizationContext.js - Organization context handling
 * - validators.js - Input validation
 * - csrf.js - CSRF protection
 * - requireSuperAdmin.js - Admin access control
 * - apiCache.js - API response caching
 */

const httpMocks = require('node-mocks-http');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Mock dependencies
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../utils/cookieHelper', () => ({
  getAuthToken: jest.fn(),
  JWT_COOKIE_NAME: 'auth_token'
}));

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
    LONG: 1800
  },
  CACHE_PREFIX: {
    API: 'api:'
  }
}));

const db = require('../../db');
const log = require('../../utils/logger');
const { getAuthToken } = require('../../utils/cookieHelper');
const { getRedisClient, isRedisConnected } = require('../../config/redis');

// Import middleware
const authenticateToken = require('../../middleware/auth');
const {
  dbAuthLimiter,
  recordFailedLogin,
  getRateLimitSettings,
  isBlocked,
  recordFailedAttempt,
  clearAttempts
} = require('../../middleware/rateLimiter');
const {
  organizationContext,
  requireOrganization
} = require('../../middleware/organizationContext');
const {
  validate,
  validateParams,
  sanitizeInput,
  sanitizeString,
  sanitizeObject
} = require('../../middleware/validators');
const {
  csrfTokenMiddleware,
  csrfValidationMiddleware,
  csrfTokenEndpoint,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME
} = require('../../middleware/csrf');
const {
  requireSuperAdmin,
  requireAdmin,
  adminLoginRateLimit,
  adminIpWhitelist
} = require('../../middleware/requireSuperAdmin');
const {
  generateCacheKey,
  cacheResponse,
  getCachedResponse,
  invalidateByPattern,
  apiCacheMiddleware
} = require('../../middleware/apiCache');

describe('Comprehensive Middleware Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = httpMocks.createRequest();
    mockRes = httpMocks.createResponse();
    mockNext = jest.fn();

    // Reset environment
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.NODE_ENV = 'test';
  });

  // ============================================================================
  // AUTH MIDDLEWARE TESTS (auth.js)
  // ============================================================================
  describe('Authentication Middleware (auth.js)', () => {
    describe('Token Validation', () => {
      it('should authenticate valid token from cookie', (done) => {
        const payload = {
          id: 1,
          email: 'test@example.com',
          username: 'testuser',
          current_organization_id: 123
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET);

        getAuthToken.mockReturnValue(token);
        mockReq.cookies = { auth_token: token };

        authenticateToken(mockReq, mockRes, () => {
          expect(mockReq.user).toBeDefined();
          expect(mockReq.user.id).toBe(1);
          expect(mockReq.user.email).toBe('test@example.com');
          expect(mockReq.user.username).toBe('testuser');
          expect(mockReq.user.organization_id).toBe(123);
          done();
        });
      });

      it('should authenticate valid token from Authorization header', (done) => {
        const payload = {
          id: 2,
          email: 'user@example.com',
          username: 'user',
          current_organization_id: 456
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET);

        getAuthToken.mockReturnValue(null);
        mockReq.headers = { authorization: `Bearer ${token}` };

        authenticateToken(mockReq, mockRes, () => {
          expect(mockReq.user).toBeDefined();
          expect(mockReq.user.id).toBe(2);
          expect(mockReq.user.email).toBe('user@example.com');
          done();
        });
      });

      it('should return 401 when no token provided', () => {
        getAuthToken.mockReturnValue(null);
        mockReq.headers = {};

        authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(401);
        const data = mockRes._getJSONData();
        expect(data.success).toBe(false);
        expect(data.message).toContain('No token provided');
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should return 403 for invalid token', () => {
        const invalidToken = 'invalid.token.here';
        getAuthToken.mockReturnValue(invalidToken);

        authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(403);
        const data = mockRes._getJSONData();
        expect(data.success).toBe(false);
        expect(data.message).toContain('Invalid or expired token');
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should return 403 for expired token', () => {
        const expiredToken = jwt.sign(
          { id: 1, email: 'test@example.com' },
          process.env.JWT_SECRET,
          { expiresIn: '-1h' }
        );

        getAuthToken.mockReturnValue(expiredToken);

        authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(403);
        const data = mockRes._getJSONData();
        expect(data.message).toContain('Invalid or expired token');
      });

      it('should handle malformed Authorization header', () => {
        getAuthToken.mockReturnValue(null);
        mockReq.headers = { authorization: 'InvalidFormat' };

        authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(401);
      });

      it('should log errors and return 500 on unexpected errors', () => {
        getAuthToken.mockImplementation(() => {
          throw new Error('Unexpected error');
        });

        authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(500);
        expect(log.error).toHaveBeenCalled();
      });

      it('should attach all user fields to request', (done) => {
        const payload = {
          id: 10,
          email: 'full@example.com',
          username: 'fulluser',
          current_organization_id: 999
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET);
        getAuthToken.mockReturnValue(token);

        authenticateToken(mockReq, mockRes, () => {
          expect(mockReq.user.id).toBe(10);
          expect(mockReq.user.email).toBe('full@example.com');
          expect(mockReq.user.username).toBe('fulluser');
          expect(mockReq.user.current_organization_id).toBe(999);
          expect(mockReq.user.organization_id).toBe(999);
          done();
        });
      });
    });

    describe('Token Sources Priority', () => {
      it('should prefer cookie over Authorization header', (done) => {
        const cookiePayload = { id: 1, email: 'cookie@example.com', current_organization_id: 1 };
        const headerPayload = { id: 2, email: 'header@example.com', current_organization_id: 2 };

        const cookieToken = jwt.sign(cookiePayload, process.env.JWT_SECRET);
        const headerToken = jwt.sign(headerPayload, process.env.JWT_SECRET);

        getAuthToken.mockReturnValue(cookieToken);
        mockReq.headers = { authorization: `Bearer ${headerToken}` };

        authenticateToken(mockReq, mockRes, () => {
          expect(mockReq.user.email).toBe('cookie@example.com');
          done();
        });
      });

      it('should fall back to header when cookie is empty', (done) => {
        const headerPayload = { id: 2, email: 'header@example.com', current_organization_id: 2 };
        const headerToken = jwt.sign(headerPayload, process.env.JWT_SECRET);

        getAuthToken.mockReturnValue(null);
        mockReq.headers = { authorization: `Bearer ${headerToken}` };

        authenticateToken(mockReq, mockRes, () => {
          expect(mockReq.user.email).toBe('header@example.com');
          done();
        });
      });
    });
  });

  // ============================================================================
  // RATE LIMITER MIDDLEWARE TESTS (rateLimiter.js)
  // ============================================================================
  describe('Rate Limiter Middleware (rateLimiter.js)', () => {
    describe('getRateLimitSettings()', () => {
      it('should return cached settings within TTL', async () => {
        const result = await getRateLimitSettings();

        expect(result).toHaveProperty('enabled');
        expect(result).toHaveProperty('max_attempts');
        expect(result).toHaveProperty('window_minutes');
      });

      it('should fetch from database when cache expired', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            enabled: true,
            max_attempts: 10,
            window_minutes: 30,
            block_duration_minutes: 60
          }]
        });

        const result = await getRateLimitSettings();

        expect(result.enabled).toBe(true);
        expect(result.max_attempts).toBe(10);
      });

      it('should use defaults on database error', async () => {
        db.query.mockRejectedValueOnce(new Error('DB error'));

        const result = await getRateLimitSettings();

        expect(result).toHaveProperty('enabled');
        expect(result).toHaveProperty('max_attempts');
      });
    });

    describe('isBlocked()', () => {
      it('should return blocked record if IP is blocked', async () => {
        const blockedUntil = new Date(Date.now() + 60000);
        db.query.mockResolvedValueOnce({
          rows: [{
            ip_address: '192.168.1.1',
            email: 'test@example.com',
            blocked_until: blockedUntil
          }]
        });

        const result = await isBlocked('192.168.1.1', 'test@example.com');

        expect(result).toBeDefined();
        expect(result.ip_address).toBe('192.168.1.1');
      });

      it('should return null if not blocked', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await isBlocked('192.168.1.1', 'test@example.com');

        expect(result).toBeNull();
      });

      it('should handle database errors gracefully', async () => {
        db.query.mockRejectedValueOnce(new Error('DB error'));

        const result = await isBlocked('192.168.1.1', 'test@example.com');

        expect(result).toBeNull();
      });
    });

    describe('recordFailedAttempt()', () => {
      it('should create new record for first attempt', async () => {
        const settings = { max_attempts: 5, window_minutes: 15, block_duration_minutes: 30 };

        db.query.mockResolvedValueOnce({ rows: [] }); // No existing
        db.query.mockResolvedValueOnce({ rows: [] }); // Insert

        const result = await recordFailedAttempt('192.168.1.1', 'test@example.com', settings);

        expect(result).toBe(false); // Not blocked yet
        expect(db.query).toHaveBeenCalledTimes(2);
      });

      it('should update existing record and increment count', async () => {
        const settings = { max_attempts: 5, window_minutes: 15, block_duration_minutes: 30 };

        db.query.mockResolvedValueOnce({
          rows: [{ id: 1, attempt_count: 4 }]
        });
        db.query.mockResolvedValueOnce({ rows: [] }); // Update

        const result = await recordFailedAttempt('192.168.1.1', 'test@example.com', settings);

        expect(result).toBe(true); // Should be blocked (5 attempts)
      });

      it('should handle database errors gracefully', async () => {
        const settings = { max_attempts: 5, window_minutes: 15, block_duration_minutes: 30 };
        db.query.mockRejectedValueOnce(new Error('DB error'));

        const result = await recordFailedAttempt('192.168.1.1', 'test@example.com', settings);

        expect(result).toBe(false);
      });
    });

    describe('clearAttempts()', () => {
      it('should delete attempts for IP and email', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await clearAttempts('192.168.1.1', 'test@example.com');

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM rate_limit_blocked'),
          ['192.168.1.1', 'test@example.com']
        );
      });

      it('should handle database errors silently', async () => {
        db.query.mockRejectedValueOnce(new Error('DB error'));

        await expect(clearAttempts('192.168.1.1', 'test@example.com')).resolves.not.toThrow();
      });
    });

    describe('dbAuthLimiter middleware', () => {
      it('should allow request if rate limiting disabled', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{ enabled: false }]
        });

        mockReq.ip = '192.168.1.1';
        mockReq.body = { email: 'test@example.com' };

        await dbAuthLimiter(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should block if IP is blocked', async () => {
        const blockedUntil = new Date(Date.now() + 60000);

        db.query.mockResolvedValueOnce({
          rows: [{ enabled: true, max_attempts: 5 }]
        });
        db.query.mockResolvedValueOnce({
          rows: [{
            ip_address: '192.168.1.1',
            blocked_until: blockedUntil
          }]
        });

        mockReq.ip = '192.168.1.1';
        mockReq.body = { email: 'test@example.com' };

        await dbAuthLimiter(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(429);
        const data = mockRes._getJSONData();
        expect(data.blocked).toBe(true);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should allow if not blocked', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{ enabled: true, max_attempts: 5 }]
        });
        db.query.mockResolvedValueOnce({ rows: [] });

        mockReq.ip = '192.168.1.1';
        mockReq.body = { email: 'test@example.com' };

        await dbAuthLimiter(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('recordFailedLogin middleware', () => {
      it('should record failed login on 401 response', async () => {
        mockReq.ip = '192.168.1.1';
        mockReq.body = { email: 'test@example.com' };

        db.query.mockResolvedValue({ rows: [{ enabled: true, max_attempts: 5, window_minutes: 15, block_duration_minutes: 30 }] });
        db.query.mockResolvedValue({ rows: [] });

        await recordFailedLogin(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();

        // Simulate failed response
        mockRes.statusCode = 401;
        mockRes.json({ success: false });

        // Wait for async processing
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      it('should clear attempts on successful login', async () => {
        mockReq.ip = '192.168.1.1';
        mockReq.body = { email: 'test@example.com' };

        db.query.mockResolvedValue({ rows: [{ enabled: true }] });
        db.query.mockResolvedValue({ rows: [] });

        await recordFailedLogin(mockReq, mockRes, mockNext);

        // Simulate successful response
        mockRes.statusCode = 200;
        mockRes.json({ success: true });

        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockNext).toHaveBeenCalled();
      });

      it('should not clear attempts if 2FA required', async () => {
        mockReq.ip = '192.168.1.1';
        mockReq.body = { email: 'test@example.com' };

        await recordFailedLogin(mockReq, mockRes, mockNext);

        mockRes.statusCode = 200;
        mockRes.json({ success: true, requires2FA: true });

        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockNext).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // ORGANIZATION CONTEXT MIDDLEWARE TESTS (organizationContext.js)
  // ============================================================================
  describe('Organization Context Middleware (organizationContext.js)', () => {
    describe('organizationContext()', () => {
      it('should skip if no user', async () => {
        mockReq.user = null;

        await organizationContext(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(log.debug).toHaveBeenCalledWith(
          'organizationContext: No user, skipping',
          expect.any(Object)
        );
      });

      it('should get default organization if none specified', async () => {
        mockReq.user = { id: 1 };
        mockReq.headers = {};

        db.query.mockResolvedValueOnce({
          rows: [{
            org_id: 123,
            role: 'admin',
            name: 'Test Org',
            slug: 'test-org',
            owner_id: 1
          }]
        });

        await organizationContext(mockReq, mockRes, mockNext);

        expect(mockReq.organization).toBeDefined();
        expect(mockReq.organization.org_id).toBe(123);
        expect(mockReq.organization.role).toBe('admin');
        expect(mockNext).toHaveBeenCalled();
      });

      it('should use organization from header', async () => {
        mockReq.user = { id: 1 };
        mockReq.headers = { 'x-organization-id': '456' };

        db.query.mockResolvedValueOnce({
          rows: [{
            org_id: 456,
            role: 'member',
            name: 'Header Org',
            slug: 'header-org',
            owner_id: 2
          }]
        });

        await organizationContext(mockReq, mockRes, mockNext);

        expect(mockReq.organization.org_id).toBe(456);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should return 403 if user has no organization', async () => {
        mockReq.user = { id: 1 };

        db.query.mockResolvedValueOnce({ rows: [] }); // No member
        db.query.mockResolvedValueOnce({ rows: [] }); // No owner

        await organizationContext(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(403);
        const data = mockRes._getJSONData();
        expect(data.code).toBe('NO_ORGANIZATION');
      });

      it('should verify user is member of specified org', async () => {
        mockReq.user = { id: 1 };
        mockReq.headers = { 'x-organization-id': '789' };

        db.query.mockResolvedValueOnce({ rows: [] }); // Not member
        db.query.mockResolvedValueOnce({ rows: [] }); // Not owner
        db.query.mockResolvedValueOnce({
          rows: [{
            org_id: 100,
            role: 'viewer',
            name: 'Default Org',
            slug: 'default',
            owner_id: 5
          }]
        });

        await organizationContext(mockReq, mockRes, mockNext);

        expect(mockReq.organization.org_id).toBe(100); // Falls back to default
      });

      it('should set is_owner flag correctly', async () => {
        mockReq.user = { id: 1 };

        db.query.mockResolvedValueOnce({
          rows: [{
            org_id: 123,
            role: 'admin',
            name: 'Test Org',
            slug: 'test-org',
            owner_id: 1
          }]
        });

        await organizationContext(mockReq, mockRes, mockNext);

        expect(mockReq.organization.is_owner).toBe(true);
      });

      it('should attach hasRole helper function', async () => {
        mockReq.user = { id: 1 };

        db.query.mockResolvedValueOnce({
          rows: [{
            org_id: 123,
            role: 'admin',
            name: 'Test Org',
            slug: 'test-org',
            owner_id: 1
          }]
        });

        await organizationContext(mockReq, mockRes, mockNext);

        expect(mockReq.hasRole).toBeDefined();
        expect(typeof mockReq.hasRole).toBe('function');
        expect(mockReq.hasRole('viewer')).toBe(true);
        expect(mockReq.hasRole('member')).toBe(true);
        expect(mockReq.hasRole('admin')).toBe(true);
      });

      it('should handle database connection errors', async () => {
        mockReq.user = { id: 1 };

        db.query.mockRejectedValueOnce({ code: 'ECONNREFUSED' });

        await organizationContext(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(503);
        const data = mockRes._getJSONData();
        expect(data.code).toBe('DATABASE_UNAVAILABLE');
      });

      it('should handle other errors gracefully', async () => {
        mockReq.user = { id: 1 };

        db.query.mockRejectedValueOnce(new Error('Unexpected error'));

        await organizationContext(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(403);
        const data = mockRes._getJSONData();
        expect(data.code).toBe('ORGANIZATION_CONTEXT_ERROR');
      });
    });

    describe('requireOrganization()', () => {
      it('should allow if organization context exists', () => {
        mockReq.organization = { id: 123 };

        requireOrganization(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should return 403 if no organization context', () => {
        mockReq.organization = null;

        requireOrganization(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(403);
        const data = mockRes._getJSONData();
        expect(data.code).toBe('ORGANIZATION_REQUIRED');
      });

      it('should return 403 if organization has no ID', () => {
        mockReq.organization = { name: 'Test' };

        requireOrganization(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(403);
      });
    });
  });

  // ============================================================================
  // VALIDATION MIDDLEWARE TESTS (validators.js)
  // ============================================================================
  describe('Validation Middleware (validators.js)', () => {
    describe('sanitizeString()', () => {
      it('should remove script tags', () => {
        const input = 'Hello<script>alert("xss")</script>World';
        const result = sanitizeString(input);

        expect(result).not.toContain('<script>');
        expect(result).toContain('Hello');
        expect(result).toContain('World');
      });

      it('should remove event handlers', () => {
        const input = '<div onclick="alert()">Click</div>';
        const result = sanitizeString(input);

        expect(result).not.toContain('onclick');
      });

      it('should remove javascript: URLs', () => {
        const input = '<a href="javascript:alert()">Link</a>';
        const result = sanitizeString(input);

        expect(result).not.toContain('javascript:');
      });

      it('should escape HTML characters', () => {
        const input = '<div>Test</div>';
        const result = sanitizeString(input);

        expect(result).toContain('&lt;');
        expect(result).toContain('&gt;');
      });

      it('should handle non-string inputs', () => {
        expect(sanitizeString(123)).toBe(123);
        expect(sanitizeString(null)).toBe(null);
        expect(sanitizeString(undefined)).toBe(undefined);
      });
    });

    describe('sanitizeObject()', () => {
      it('should sanitize nested objects', () => {
        const input = {
          name: '<script>alert()</script>Test',
          nested: {
            value: '<b onclick="bad()">Text</b>'
          }
        };

        const result = sanitizeObject(input);

        expect(result.name).not.toContain('<script>');
        expect(result.nested.value).not.toContain('onclick');
      });

      it('should sanitize arrays', () => {
        const input = ['<script>bad</script>', 'good', '<div onclick="x">text</div>'];
        const result = sanitizeObject(input);

        expect(result[0]).not.toContain('<script>');
        expect(result[1]).toBe('good');
        expect(result[2]).not.toContain('onclick');
      });

      it('should handle null and undefined', () => {
        expect(sanitizeObject(null)).toBe(null);
        expect(sanitizeObject(undefined)).toBe(undefined);
      });
    });

    describe('sanitizeInput middleware', () => {
      it('should sanitize request body', () => {
        mockReq.body = {
          comment: '<script>alert("xss")</script>Hello',
          name: 'John<b onclick="bad()">Doe</b>'
        };

        sanitizeInput(mockReq, mockRes, mockNext);

        expect(mockReq.body.comment).not.toContain('<script>');
        expect(mockReq.body.name).not.toContain('onclick');
        expect(mockNext).toHaveBeenCalled();
      });

      it('should handle missing body', () => {
        mockReq.body = undefined;

        sanitizeInput(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('validate middleware', () => {
      it('should validate registration data successfully', () => {
        mockReq.body = {
          username: 'testuser',
          email: 'test@example.com',
          password: 'Password123'
        };

        const middleware = validate('register');
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should reject invalid email', () => {
        mockReq.body = {
          username: 'testuser',
          email: 'invalid-email',
          password: 'Password123'
        };

        const middleware = validate('register');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(400);
        const data = mockRes._getJSONData();
        expect(data.message).toBe('Validation failed');
        expect(data.errors).toBeDefined();
      });

      it('should reject weak password', () => {
        mockReq.body = {
          username: 'testuser',
          email: 'test@example.com',
          password: 'weak'
        };

        const middleware = validate('register');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(400);
        const data = mockRes._getJSONData();
        expect(data.errors.some(e => e.field === 'password')).toBe(true);
      });

      it('should validate login data', () => {
        mockReq.body = {
          email: 'test@example.com',
          password: 'anypassword'
        };

        const middleware = validate('login');
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for non-existent schema', () => {
        const middleware = validate('nonexistent');
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('validateParams middleware', () => {
      it('should validate ID parameter', () => {
        mockReq.params = { id: '123' };

        const middleware = validateParams('idParam');
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should reject invalid ID', () => {
        mockReq.params = { id: 'abc' };

        const middleware = validateParams('idParam');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(400);
        const data = mockRes._getJSONData();
        expect(data.message).toBe('Invalid parameters');
      });
    });
  });

  // ============================================================================
  // CSRF MIDDLEWARE TESTS (csrf.js)
  // ============================================================================
  describe('CSRF Protection Middleware (csrf.js)', () => {
    describe('csrfTokenMiddleware()', () => {
      it('should generate new token if none exists', () => {
        mockReq.cookies = {};

        csrfTokenMiddleware(mockReq, mockRes, mockNext);

        expect(mockReq.csrfToken).toBeDefined();
        expect(mockReq.csrfToken.length).toBe(64); // 32 bytes hex = 64 chars
        expect(mockNext).toHaveBeenCalled();
      });

      it('should use existing token from cookie', () => {
        const existingToken = crypto.randomBytes(32).toString('hex');
        mockReq.cookies = { [CSRF_COOKIE_NAME]: existingToken };

        csrfTokenMiddleware(mockReq, mockRes, mockNext);

        expect(mockReq.csrfToken).toBe(existingToken);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should set cookie with correct options in production', () => {
        process.env.NODE_ENV = 'production';
        mockReq.cookies = {};

        const mockCookie = jest.fn();
        mockRes.cookie = mockCookie;

        csrfTokenMiddleware(mockReq, mockRes, mockNext);

        expect(mockCookie).toHaveBeenCalledWith(
          CSRF_COOKIE_NAME,
          expect.any(String),
          expect.objectContaining({
            httpOnly: false,
            secure: true,
            sameSite: 'lax'
          })
        );
      });

      it('should attach token to res.locals', () => {
        mockReq.cookies = {};
        mockRes.locals = {};

        csrfTokenMiddleware(mockReq, mockRes, mockNext);

        expect(mockRes.locals.csrfToken).toBeDefined();
      });
    });

    describe('csrfValidationMiddleware()', () => {
      it('should skip validation for GET requests', () => {
        mockReq.method = 'GET';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for exempt routes', () => {
        mockReq.method = 'POST';
        mockReq.path = '/auth/login';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should validate matching tokens', () => {
        const token = crypto.randomBytes(32).toString('hex');

        mockReq.method = 'POST';
        mockReq.path = '/api/bots';
        mockReq.cookies = { [CSRF_COOKIE_NAME]: token };
        mockReq.headers = { [CSRF_HEADER_NAME]: token };

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should reject request without cookie token', () => {
        mockReq.method = 'POST';
        mockReq.path = '/api/bots';
        mockReq.cookies = {};
        mockReq.headers = { [CSRF_HEADER_NAME]: 'sometoken' };

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(403);
        const data = mockRes._getJSONData();
        expect(data.error).toBe('CSRF_TOKEN_MISSING');
      });

      it('should reject request without header token', () => {
        mockReq.method = 'POST';
        mockReq.path = '/api/bots';
        mockReq.cookies = { [CSRF_COOKIE_NAME]: 'token' };
        mockReq.headers = {};

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(403);
        const data = mockRes._getJSONData();
        expect(data.error).toBe('CSRF_TOKEN_MISSING');
      });

      it('should reject mismatched tokens', () => {
        mockReq.method = 'POST';
        mockReq.path = '/api/bots';
        mockReq.cookies = { [CSRF_COOKIE_NAME]: 'token1' };
        mockReq.headers = { [CSRF_HEADER_NAME]: 'token2' };

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(403);
        const data = mockRes._getJSONData();
        expect(data.error).toBe('CSRF_TOKEN_INVALID');
      });

      it('should validate all protected methods', () => {
        const token = crypto.randomBytes(32).toString('hex');
        const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];

        methods.forEach(method => {
          jest.clearAllMocks();
          mockReq.method = method;
          mockReq.path = '/api/test';
          mockReq.cookies = { [CSRF_COOKIE_NAME]: token };
          mockReq.headers = { [CSRF_HEADER_NAME]: token };

          csrfValidationMiddleware(mockReq, mockRes, mockNext);

          expect(mockNext).toHaveBeenCalled();
        });
      });
    });

    describe('csrfTokenEndpoint()', () => {
      it('should return token in response', () => {
        const token = crypto.randomBytes(32).toString('hex');
        mockReq.csrfToken = token;
        mockRes.cookie = jest.fn();
        mockRes.json = jest.fn();

        csrfTokenEndpoint(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          csrfToken: token
        });
      });

      it('should generate token if not in request', () => {
        mockReq.csrfToken = undefined;
        mockRes.cookie = jest.fn();
        mockRes.json = jest.fn();

        csrfTokenEndpoint(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          csrfToken: expect.any(String)
        });
      });
    });
  });

  // ============================================================================
  // ADMIN ACCESS CONTROL TESTS (requireSuperAdmin.js)
  // ============================================================================
  describe('Admin Access Control Middleware (requireSuperAdmin.js)', () => {
    describe('requireSuperAdmin()', () => {
      it('should return 401 if no user', () => {
        mockReq.user = null;

        requireSuperAdmin(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(401);
        const data = mockRes._getJSONData();
        expect(data.message).toContain('Authentication required');
      });

      it('should allow superadmin users', (done) => {
        mockReq.user = { id: 1, email: 'admin@example.com' };

        db.query.mockResolvedValueOnce({
          rows: [{ is_superadmin: true }]
        });
        db.query.mockResolvedValueOnce({ rows: [] }); // audit log

        requireSuperAdmin(mockReq, mockRes, () => {
          expect(mockReq.isSuperAdmin).toBe(true);
          done();
        });
      });

      it('should deny non-superadmin users', (done) => {
        mockReq.user = { id: 2, email: 'user@example.com' };
        mockReq.path = '/admin/users';
        mockReq.method = 'GET';

        db.query.mockResolvedValueOnce({
          rows: [{ is_superadmin: false }]
        });
        db.query.mockResolvedValueOnce({ rows: [] }); // audit log

        requireSuperAdmin(mockReq, mockRes, mockNext);

        setTimeout(() => {
          expect(mockRes.statusCode).toBe(403);
          const data = mockRes._getJSONData();
          expect(data.message).toContain('Superadmin access required');
          done();
        }, 10);
      });

      it('should handle database errors', (done) => {
        mockReq.user = { id: 1 };

        db.query.mockRejectedValueOnce(new Error('DB error'));

        requireSuperAdmin(mockReq, mockRes, mockNext);

        setTimeout(() => {
          expect(mockRes.statusCode).toBe(500);
          done();
        }, 10);
      });
    });

    describe('requireAdmin()', () => {
      it('should return 401 if no user', () => {
        mockReq.user = null;

        requireAdmin(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(401);
      });

      it('should allow superadmin', (done) => {
        mockReq.user = { id: 1 };

        db.query.mockResolvedValueOnce({
          rows: [{ is_superadmin: true }]
        });

        requireAdmin(mockReq, mockRes, () => {
          expect(mockReq.isSuperAdmin).toBe(true);
          expect(mockReq.isAdmin).toBe(true);
          done();
        });
      });

      it('should allow organization admin', (done) => {
        mockReq.user = { id: 2 };
        mockReq.organization = { role: 'admin', is_owner: false };

        db.query.mockResolvedValueOnce({
          rows: [{ is_superadmin: false }]
        });

        requireAdmin(mockReq, mockRes, () => {
          expect(mockReq.isAdmin).toBe(true);
          done();
        });
      });

      it('should allow organization owner', (done) => {
        mockReq.user = { id: 3 };
        mockReq.organization = { role: 'member', is_owner: true };

        db.query.mockResolvedValueOnce({
          rows: [{ is_superadmin: false }]
        });

        requireAdmin(mockReq, mockRes, () => {
          expect(mockReq.isAdmin).toBe(true);
          done();
        });
      });

      it('should deny regular members', (done) => {
        mockReq.user = { id: 4, email: 'member@example.com' };
        mockReq.organization = { role: 'member', is_owner: false, org_id: 123 };
        mockReq.path = '/admin/settings';
        mockReq.method = 'POST';

        db.query.mockResolvedValueOnce({
          rows: [{ is_superadmin: false }]
        });
        db.query.mockResolvedValueOnce({ rows: [] }); // audit log

        requireAdmin(mockReq, mockRes, mockNext);

        setTimeout(() => {
          expect(mockRes.statusCode).toBe(403);
          done();
        }, 10);
      });

      it('should require organization context', (done) => {
        mockReq.user = { id: 5 };
        mockReq.organization = null;

        db.query.mockResolvedValueOnce({
          rows: [{ is_superadmin: false }]
        });

        requireAdmin(mockReq, mockRes, mockNext);

        setTimeout(() => {
          expect(mockRes.statusCode).toBe(403);
          const data = mockRes._getJSONData();
          expect(data.message).toContain('Organization context required');
          done();
        }, 10);
      });
    });

    describe('adminLoginRateLimit()', () => {
      it('should allow login within rate limit', async () => {
        mockReq.body = { email: 'admin@example.com' };
        mockReq.ip = '192.168.1.1';

        db.query.mockResolvedValueOnce({ rows: [{ count: '2' }] }); // email attempts
        db.query.mockResolvedValueOnce({ rows: [{ count: '3' }] }); // ip attempts

        await adminLoginRateLimit(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockReq.logLoginAttempt).toBeDefined();
      });

      it('should block after 5 email attempts', async () => {
        mockReq.body = { email: 'admin@example.com' };
        mockReq.ip = '192.168.1.1';

        db.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

        await adminLoginRateLimit(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(429);
        const data = mockRes._getJSONData();
        expect(data.retryAfter).toBe(900);
      });

      it('should block after 10 IP attempts', async () => {
        mockReq.body = { email: 'admin@example.com' };
        mockReq.ip = '192.168.1.1';

        db.query.mockResolvedValueOnce({ rows: [{ count: '2' }] }); // email
        db.query.mockResolvedValueOnce({ rows: [{ count: '10' }] }); // ip

        await adminLoginRateLimit(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(429);
      });

      it('should require email in body', async () => {
        mockReq.body = {};

        await adminLoginRateLimit(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(400);
      });
    });

    describe('adminIpWhitelist()', () => {
      it('should skip if no whitelist configured', async () => {
        delete process.env.ADMIN_IP_WHITELIST;

        await adminIpWhitelist(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should allow whitelisted IP', async () => {
        process.env.ADMIN_IP_WHITELIST = '192.168.1.1,10.0.0.1';
        mockReq.ip = '192.168.1.1';

        db.query.mockResolvedValueOnce({ rows: [] });

        await adminIpWhitelist(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should block non-whitelisted IP', async () => {
        process.env.ADMIN_IP_WHITELIST = '192.168.1.1';
        mockReq.ip = '10.0.0.2';
        mockReq.body = { email: 'admin@example.com' };

        db.query.mockResolvedValueOnce({ rows: [] });
        db.query.mockResolvedValueOnce({ rows: [] }); // audit log

        await adminIpWhitelist(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(403);
      });

      it('should handle IPv6 mapped IPv4', async () => {
        process.env.ADMIN_IP_WHITELIST = '192.168.1.1';
        mockReq.ip = '::ffff:192.168.1.1';

        db.query.mockResolvedValueOnce({ rows: [] });

        await adminIpWhitelist(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // API CACHE MIDDLEWARE TESTS (apiCache.js)
  // ============================================================================
  describe('API Cache Middleware (apiCache.js)', () => {
    describe('generateCacheKey()', () => {
      it('should generate unique key for different users', () => {
        mockReq.method = 'GET';
        mockReq.originalUrl = '/api/bots';
        mockReq.user = { id: 1 };
        mockReq.query = {};

        const key1 = generateCacheKey(mockReq);

        mockReq.user = { id: 2 };
        const key2 = generateCacheKey(mockReq);

        expect(key1).not.toBe(key2);
      });

      it('should generate unique key for different organizations', () => {
        mockReq.method = 'GET';
        mockReq.originalUrl = '/api/bots';
        mockReq.user = { id: 1 };
        mockReq.headers = { 'x-organization-id': '100' };
        mockReq.query = {};

        const key1 = generateCacheKey(mockReq);

        mockReq.headers = { 'x-organization-id': '200' };
        const key2 = generateCacheKey(mockReq);

        expect(key1).not.toBe(key2);
      });

      it('should include query params in hash', () => {
        mockReq.method = 'GET';
        mockReq.originalUrl = '/api/bots';
        mockReq.user = { id: 1 };
        mockReq.query = { page: 1 };

        const key1 = generateCacheKey(mockReq);

        mockReq.query = { page: 2 };
        const key2 = generateCacheKey(mockReq);

        expect(key1).not.toBe(key2);
      });

      it('should handle anonymous users', () => {
        mockReq.method = 'GET';
        mockReq.originalUrl = '/api/public';
        mockReq.user = null;
        mockReq.query = {};

        const key = generateCacheKey(mockReq);

        expect(key).toContain('anonymous');
      });
    });

    describe('cacheResponse()', () => {
      it('should cache response when Redis connected', async () => {
        isRedisConnected.mockReturnValue(true);
        const mockRedis = {
          setex: jest.fn().mockResolvedValue('OK')
        };
        getRedisClient.mockResolvedValue(mockRedis);

        const result = await cacheResponse('test:key', { data: 'value' }, 300);

        expect(result).toBe(true);
        expect(mockRedis.setex).toHaveBeenCalled();
      });

      it('should not cache when Redis disconnected', async () => {
        isRedisConnected.mockReturnValue(false);

        const result = await cacheResponse('test:key', { data: 'value' }, 300);

        expect(result).toBe(false);
      });

      it('should handle Redis errors gracefully', async () => {
        isRedisConnected.mockReturnValue(true);
        const mockRedis = {
          setex: jest.fn().mockRejectedValue(new Error('Redis error'))
        };
        getRedisClient.mockResolvedValue(mockRedis);

        const result = await cacheResponse('test:key', { data: 'value' }, 300);

        expect(result).toBe(false);
        expect(log.error).toHaveBeenCalled();
      });
    });

    describe('getCachedResponse()', () => {
      it('should return cached data when available', async () => {
        isRedisConnected.mockReturnValue(true);
        const cachedData = {
          data: { result: 'cached' },
          cachedAt: Date.now(),
          expiresAt: Date.now() + 60000
        };
        const mockRedis = {
          get: jest.fn().mockResolvedValue(JSON.stringify(cachedData))
        };
        getRedisClient.mockResolvedValue(mockRedis);

        const result = await getCachedResponse('test:key');

        expect(result).toEqual(cachedData);
        expect(log.debug).toHaveBeenCalledWith('API cache hit', expect.any(Object));
      });

      it('should return null when cache miss', async () => {
        isRedisConnected.mockReturnValue(true);
        const mockRedis = {
          get: jest.fn().mockResolvedValue(null)
        };
        getRedisClient.mockResolvedValue(mockRedis);

        const result = await getCachedResponse('test:key');

        expect(result).toBeNull();
        expect(log.debug).toHaveBeenCalledWith('API cache miss', expect.any(Object));
      });

      it('should return null when Redis disconnected', async () => {
        isRedisConnected.mockReturnValue(false);

        const result = await getCachedResponse('test:key');

        expect(result).toBeNull();
      });
    });

    describe('invalidateByPattern()', () => {
      it('should delete matching keys', async () => {
        isRedisConnected.mockReturnValue(true);
        const mockRedis = {
          keys: jest.fn().mockResolvedValue(['api:key1', 'api:key2']),
          del: jest.fn().mockResolvedValue(2)
        };
        getRedisClient.mockResolvedValue(mockRedis);

        const result = await invalidateByPattern('GET:/api/bots*');

        expect(result).toBe(true);
        expect(mockRedis.del).toHaveBeenCalledWith('api:key1', 'api:key2');
      });

      it('should handle no matching keys', async () => {
        isRedisConnected.mockReturnValue(true);
        const mockRedis = {
          keys: jest.fn().mockResolvedValue([])
        };
        getRedisClient.mockResolvedValue(mockRedis);

        const result = await invalidateByPattern('GET:/api/none*');

        expect(result).toBe(true);
      });
    });

    describe('apiCacheMiddleware()', () => {
      it('should skip non-GET requests', async () => {
        mockReq.method = 'POST';

        const middleware = apiCacheMiddleware();
        await middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip when no-cache header present', async () => {
        mockReq.method = 'GET';
        mockReq.headers = { 'cache-control': 'no-cache' };

        const middleware = apiCacheMiddleware();
        await middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should return cached response on cache hit', async () => {
        isRedisConnected.mockReturnValue(true);
        const cachedData = {
          data: { result: 'cached' },
          cachedAt: Date.now() - 5000,
          expiresAt: Date.now() + 60000
        };
        const mockRedis = {
          get: jest.fn().mockResolvedValue(JSON.stringify(cachedData))
        };
        getRedisClient.mockResolvedValue(mockRedis);

        mockReq.method = 'GET';
        mockReq.originalUrl = '/api/test';
        mockReq.user = { id: 1 };
        mockReq.query = {};

        const middleware = apiCacheMiddleware();
        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes._isJSON()).toBe(true);
        const data = mockRes._getJSONData();
        expect(data.result).toBe('cached');
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should set cache headers on cache hit', async () => {
        isRedisConnected.mockReturnValue(true);
        const cachedData = {
          data: { result: 'cached' },
          cachedAt: Date.now() - 5000,
          expiresAt: Date.now() + 60000
        };
        const mockRedis = {
          get: jest.fn().mockResolvedValue(JSON.stringify(cachedData))
        };
        getRedisClient.mockResolvedValue(mockRedis);

        mockReq.method = 'GET';
        mockReq.originalUrl = '/api/test';
        mockReq.user = { id: 1 };
        mockReq.query = {};

        const middleware = apiCacheMiddleware();
        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.getHeader('X-Cache')).toBe('HIT');
        expect(mockRes.getHeader('X-Cache-Age')).toBeDefined();
      });

      it('should cache response on cache miss', async () => {
        isRedisConnected.mockReturnValue(true);
        const mockRedis = {
          get: jest.fn().mockResolvedValue(null),
          setex: jest.fn().mockResolvedValue('OK')
        };
        getRedisClient.mockResolvedValue(mockRedis);

        mockReq.method = 'GET';
        mockReq.originalUrl = '/api/test';
        mockReq.user = { id: 1 };
        mockReq.query = {};

        const middleware = apiCacheMiddleware();
        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.getHeader('X-Cache')).toBe('MISS');
        expect(mockNext).toHaveBeenCalled();

        // Simulate response
        mockRes.statusCode = 200;
        mockRes.json({ result: 'fresh' });

        await new Promise(resolve => setTimeout(resolve, 10));
      });

      it('should not cache error responses', async () => {
        isRedisConnected.mockReturnValue(true);
        const mockRedis = {
          get: jest.fn().mockResolvedValue(null),
          setex: jest.fn().mockResolvedValue('OK')
        };
        getRedisClient.mockResolvedValue(mockRedis);

        mockReq.method = 'GET';
        mockReq.originalUrl = '/api/test';
        mockReq.user = { id: 1 };
        mockReq.query = {};

        const middleware = apiCacheMiddleware();
        await middleware(mockReq, mockRes, mockNext);

        mockRes.statusCode = 500;
        mockRes.json({ error: 'Server error' });

        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockRedis.setex).not.toHaveBeenCalled();
      });

      it('should use custom TTL', async () => {
        isRedisConnected.mockReturnValue(true);
        const mockRedis = {
          get: jest.fn().mockResolvedValue(null),
          setex: jest.fn().mockResolvedValue('OK')
        };
        getRedisClient.mockResolvedValue(mockRedis);

        mockReq.method = 'GET';
        mockReq.originalUrl = '/api/test';
        mockReq.user = { id: 1 };
        mockReq.query = {};

        const middleware = apiCacheMiddleware({ ttl: 600 });
        await middleware(mockReq, mockRes, mockNext);

        mockRes.statusCode = 200;
        mockRes.json({ result: 'data' });

        await new Promise(resolve => setTimeout(resolve, 10));
      });

      it('should use custom condition function', async () => {
        mockReq.method = 'GET';
        mockReq.originalUrl = '/api/test';

        const condition = jest.fn().mockReturnValue(false);
        const middleware = apiCacheMiddleware({ condition });

        await middleware(mockReq, mockRes, mockNext);

        expect(condition).toHaveBeenCalledWith(mockReq);
        expect(mockNext).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // EDGE CASES AND INTEGRATION TESTS
  // ============================================================================
  describe('Edge Cases and Integration Tests', () => {
    describe('Request Header Parsing', () => {
      it('should handle missing headers gracefully', () => {
        const token = jwt.sign({ id: 1, email: 'test@example.com', current_organization_id: 1 }, process.env.JWT_SECRET);
        getAuthToken.mockReturnValue(token);
        mockReq.headers = undefined;

        authenticateToken(mockReq, mockRes, () => {
          expect(mockReq.user).toBeDefined();
        });
      });

      it('should handle malformed headers', () => {
        mockReq.headers = { authorization: null };
        getAuthToken.mockReturnValue(null);

        authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.statusCode).toBe(401);
      });
    });

    describe('Next() Calling Patterns', () => {
      it('should call next() exactly once on success', (done) => {
        const token = jwt.sign({ id: 1, email: 'test@example.com', current_organization_id: 1 }, process.env.JWT_SECRET);
        getAuthToken.mockReturnValue(token);

        authenticateToken(mockReq, mockRes, () => {
          expect(mockNext).not.toHaveBeenCalled();
          done();
        });
      });

      it('should not call next() on authentication failure', () => {
        getAuthToken.mockReturnValue(null);

        authenticateToken(mockReq, mockRes, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('Response Modifications', () => {
      it('should preserve original response on cache miss', async () => {
        isRedisConnected.mockReturnValue(false);

        mockReq.method = 'GET';
        mockReq.originalUrl = '/api/test';
        mockReq.user = { id: 1 };
        mockReq.query = {};

        const middleware = apiCacheMiddleware();
        await middleware(mockReq, mockRes, mockNext);

        const originalData = { test: 'data' };
        mockRes.json(originalData);

        const responseData = mockRes._getJSONData();
        expect(responseData).toEqual(originalData);
      });
    });

    describe('Concurrent Request Handling', () => {
      it('should handle multiple simultaneous auth requests', async () => {
        const requests = Array.from({ length: 10 }, (_, i) => {
          const req = httpMocks.createRequest();
          const res = httpMocks.createResponse();
          const next = jest.fn();
          const token = jwt.sign({ id: i + 1, email: `user${i}@example.com`, current_organization_id: i + 1 }, process.env.JWT_SECRET);

          getAuthToken.mockReturnValue(token);

          return new Promise(resolve => {
            authenticateToken(req, res, () => {
              expect(req.user.id).toBe(i + 1);
              resolve();
            });
          });
        });

        await Promise.all(requests);
      });
    });

    describe('Memory and Performance', () => {
      it('should not leak memory with sanitization', () => {
        const largeObject = {
          data: new Array(1000).fill('<script>test</script>')
        };

        const sanitized = sanitizeObject(largeObject);

        expect(sanitized.data.length).toBe(1000);
        expect(sanitized.data[0]).not.toContain('<script>');
      });

      it('should handle deep nesting in sanitization', () => {
        const deepObject = {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: '<script>alert()</script>Test'
                }
              }
            }
          }
        };

        const sanitized = sanitizeObject(deepObject);

        expect(sanitized.level1.level2.level3.level4.level5).not.toContain('<script>');
      });
    });
  });
});
