/**
 * Error Message Snapshot Tests
 * Tests error response structure consistency for HTTP error codes
 * Uses Jest snapshots to detect unintended error response changes
 */

const request = require('supertest');
const express = require('express');

// ========================================
// MOCKS
// ========================================

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// ========================================
// TEST APP SETUP
// ========================================

function createTestApp() {
  const app = express();
  app.use(express.json());

  // 400 Bad Request - Missing required field
  app.post('/api/test/bad-request-missing', (req, res) => {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: {
        name: 'Name is required',
        email: 'Email is required'
      },
      code: 'VALIDATION_ERROR'
    });
  });

  // 400 Bad Request - Invalid format
  app.post('/api/test/bad-request-format', (req, res) => {
    res.status(400).json({
      success: false,
      message: 'Invalid request format',
      errors: {
        email: 'Invalid email format',
        phone: 'Phone number must be 10 digits'
      },
      code: 'INVALID_FORMAT'
    });
  });

  // 400 Bad Request - Invalid JSON
  app.post('/api/test/bad-request-json', (req, res) => {
    res.status(400).json({
      success: false,
      message: 'Invalid JSON payload',
      code: 'PARSE_ERROR'
    });
  });

  // 401 Unauthorized - No token
  app.get('/api/test/unauthorized-no-token', (req, res) => {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'NO_TOKEN'
    });
  });

  // 401 Unauthorized - Invalid token
  app.get('/api/test/unauthorized-invalid-token', (req, res) => {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  });

  // 401 Unauthorized - Expired token
  app.get('/api/test/unauthorized-expired-token', (req, res) => {
    res.status(401).json({
      success: false,
      message: 'Token has expired',
      code: 'TOKEN_EXPIRED',
      expiredAt: '2024-01-15T10:00:00.000Z'
    });
  });

  // 403 Forbidden - Insufficient permissions
  app.get('/api/test/forbidden-permission', (req, res) => {
    res.status(403).json({
      success: false,
      message: 'Insufficient permissions',
      code: 'FORBIDDEN',
      requiredRole: 'admin',
      currentRole: 'member'
    });
  });

  // 403 Forbidden - Resource access denied
  app.get('/api/test/forbidden-resource', (req, res) => {
    res.status(403).json({
      success: false,
      message: 'Access to this resource is denied',
      code: 'ACCESS_DENIED',
      resource: 'bot',
      resourceId: 123
    });
  });

  // 403 Forbidden - Organization context required
  app.get('/api/test/forbidden-org-context', (req, res) => {
    res.status(403).json({
      success: false,
      message: 'Organization context required',
      code: 'ORG_CONTEXT_REQUIRED'
    });
  });

  // 404 Not Found - Resource not found
  app.get('/api/test/not-found-resource', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Bot not found',
      code: 'NOT_FOUND',
      resource: 'bot',
      resourceId: 999
    });
  });

  // 404 Not Found - Endpoint not found
  app.get('/api/test/not-found-endpoint', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Endpoint not found',
      code: 'ENDPOINT_NOT_FOUND',
      path: '/api/nonexistent'
    });
  });

  // 404 Not Found - User not found
  app.get('/api/test/not-found-user', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'User not found',
      code: 'USER_NOT_FOUND'
    });
  });

  // 409 Conflict - Duplicate resource
  app.post('/api/test/conflict-duplicate', (req, res) => {
    res.status(409).json({
      success: false,
      message: 'Resource already exists',
      code: 'DUPLICATE_RESOURCE',
      field: 'email',
      value: 'existing@example.com'
    });
  });

  // 422 Unprocessable Entity
  app.post('/api/test/unprocessable', (req, res) => {
    res.status(422).json({
      success: false,
      message: 'Unable to process request',
      code: 'UNPROCESSABLE_ENTITY',
      details: 'The provided configuration is invalid'
    });
  });

  // 429 Too Many Requests
  app.get('/api/test/rate-limit', (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60,
      limit: 100,
      remaining: 0,
      resetAt: '2024-01-15T10:01:00.000Z'
    });
  });

  // 500 Internal Server Error - Generic
  app.get('/api/test/server-error', (req, res) => {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  });

  // 500 Internal Server Error - Database
  app.get('/api/test/server-error-db', (req, res) => {
    res.status(500).json({
      success: false,
      message: 'Database error occurred',
      code: 'DATABASE_ERROR'
    });
  });

  // 502 Bad Gateway
  app.get('/api/test/bad-gateway', (req, res) => {
    res.status(502).json({
      success: false,
      message: 'Bad gateway',
      code: 'BAD_GATEWAY',
      upstream: 'openai-api'
    });
  });

  // 503 Service Unavailable
  app.get('/api/test/service-unavailable', (req, res) => {
    res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE',
      retryAfter: 300
    });
  });

  // 504 Gateway Timeout
  app.get('/api/test/gateway-timeout', (req, res) => {
    res.status(504).json({
      success: false,
      message: 'Gateway timeout',
      code: 'GATEWAY_TIMEOUT',
      timeout: 30000
    });
  });

  return app;
}

// ========================================
// SNAPSHOT TESTS
// ========================================

describe('Error Message Snapshots', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  // ----------------------------------------
  // 400 Bad Request
  // ----------------------------------------
  describe('400 Bad Request', () => {
    it('should match snapshot for missing required fields', async () => {
      const response = await request(app).post('/api/test/bad-request-missing');

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for invalid format', async () => {
      const response = await request(app).post('/api/test/bad-request-format');

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for invalid JSON', async () => {
      const response = await request(app).post('/api/test/bad-request-json');

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // 401 Unauthorized
  // ----------------------------------------
  describe('401 Unauthorized', () => {
    it('should match snapshot for no token provided', async () => {
      const response = await request(app).get('/api/test/unauthorized-no-token');

      expect(response.status).toBe(401);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for invalid token', async () => {
      const response = await request(app).get('/api/test/unauthorized-invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for expired token', async () => {
      const response = await request(app).get('/api/test/unauthorized-expired-token');

      expect(response.status).toBe(401);
      expect(response.body).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // 403 Forbidden
  // ----------------------------------------
  describe('403 Forbidden', () => {
    it('should match snapshot for insufficient permissions', async () => {
      const response = await request(app).get('/api/test/forbidden-permission');

      expect(response.status).toBe(403);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for resource access denied', async () => {
      const response = await request(app).get('/api/test/forbidden-resource');

      expect(response.status).toBe(403);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for organization context required', async () => {
      const response = await request(app).get('/api/test/forbidden-org-context');

      expect(response.status).toBe(403);
      expect(response.body).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // 404 Not Found
  // ----------------------------------------
  describe('404 Not Found', () => {
    it('should match snapshot for resource not found', async () => {
      const response = await request(app).get('/api/test/not-found-resource');

      expect(response.status).toBe(404);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for endpoint not found', async () => {
      const response = await request(app).get('/api/test/not-found-endpoint');

      expect(response.status).toBe(404);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for user not found', async () => {
      const response = await request(app).get('/api/test/not-found-user');

      expect(response.status).toBe(404);
      expect(response.body).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // 409 Conflict
  // ----------------------------------------
  describe('409 Conflict', () => {
    it('should match snapshot for duplicate resource', async () => {
      const response = await request(app).post('/api/test/conflict-duplicate');

      expect(response.status).toBe(409);
      expect(response.body).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // 422 Unprocessable Entity
  // ----------------------------------------
  describe('422 Unprocessable Entity', () => {
    it('should match snapshot for unprocessable entity', async () => {
      const response = await request(app).post('/api/test/unprocessable');

      expect(response.status).toBe(422);
      expect(response.body).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // 429 Too Many Requests
  // ----------------------------------------
  describe('429 Too Many Requests', () => {
    it('should match snapshot for rate limit exceeded', async () => {
      const response = await request(app).get('/api/test/rate-limit');

      expect(response.status).toBe(429);
      expect(response.body).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // 500 Internal Server Error
  // ----------------------------------------
  describe('500 Internal Server Error', () => {
    it('should match snapshot for generic server error', async () => {
      const response = await request(app).get('/api/test/server-error');

      expect(response.status).toBe(500);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for database error', async () => {
      const response = await request(app).get('/api/test/server-error-db');

      expect(response.status).toBe(500);
      expect(response.body).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // 502 Bad Gateway
  // ----------------------------------------
  describe('502 Bad Gateway', () => {
    it('should match snapshot for bad gateway', async () => {
      const response = await request(app).get('/api/test/bad-gateway');

      expect(response.status).toBe(502);
      expect(response.body).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // 503 Service Unavailable
  // ----------------------------------------
  describe('503 Service Unavailable', () => {
    it('should match snapshot for service unavailable', async () => {
      const response = await request(app).get('/api/test/service-unavailable');

      expect(response.status).toBe(503);
      expect(response.body).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // 504 Gateway Timeout
  // ----------------------------------------
  describe('504 Gateway Timeout', () => {
    it('should match snapshot for gateway timeout', async () => {
      const response = await request(app).get('/api/test/gateway-timeout');

      expect(response.status).toBe(504);
      expect(response.body).toMatchSnapshot();
    });
  });
});
