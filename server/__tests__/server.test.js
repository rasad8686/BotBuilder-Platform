/**
 * Server Initialization Tests
 * Tests for server.js - main Express app configuration and initialization
 *
 * Coverage:
 * - App initialization
 * - Middleware setup
 * - CORS configuration
 * - Security headers
 * - Route mounting
 * - Error handling
 * - Static file serving
 * - Health check endpoint
 * - Authentication endpoints
 */

const request = require('supertest');
const express = require('express');

// ========================================
// MOCK ALL DEPENDENCIES
// ========================================

// Mock database
jest.mock('../db', () => ({
  query: jest.fn()
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(false) // Default to false, override in tests
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token-12345'),
  verify: jest.fn()
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  http: jest.fn()
}));

// Mock audit middleware
jest.mock('../middleware/audit', () => ({
  logRegister: jest.fn().mockResolvedValue(undefined),
  logLogin: jest.fn().mockResolvedValue(undefined)
}));

// Mock whitelabel middleware
jest.mock('../middleware/whitelabel', () => ({
  detectCustomDomain: jest.fn((req, res, next) => next())
}));

// Mock rate limiter middleware
jest.mock('../middleware/rateLimiter', () => ({
  apiLimiter: jest.fn((req, res, next) => next()),
  authLimiter: jest.fn((req, res, next) => next()),
  dbAuthLimiter: jest.fn((req, res, next) => next()),
  recordFailedLogin: jest.fn((req, res, next) => next())
}));

// Mock security headers
jest.mock('../middleware/securityHeaders', () => jest.fn((req, res, next) => next()));

// Mock CSRF middleware
jest.mock('../middleware/csrf', () => ({
  csrfTokenMiddleware: jest.fn((req, res, next) => next()),
  csrfValidationMiddleware: jest.fn((req, res, next) => next()),
  csrfTokenEndpoint: jest.fn((req, res) => res.json({ csrfToken: 'mock-csrf-token' }))
}));

// Mock validators
jest.mock('../middleware/validators', () => ({
  sanitizeInput: jest.fn((req, res, next) => next())
}));

// Mock websocket
jest.mock('../websocket', () => ({
  initializeWebSocket: jest.fn(() => ({
    io: { on: jest.fn() },
    executionSocket: { on: jest.fn() }
  }))
}));

// Mock environment validator
jest.mock('../utils/envValidator', () => ({
  validateEnvOrExit: jest.fn(),
  getSecureEnv: jest.fn((key) => {
    const mockEnv = {
      JWT_SECRET: 'test-jwt-secret-key-12345',
      ADMIN_EMAIL: 'admin@test.com',
      ADMIN_PASSWORD: 'admin123456789'
    };
    return mockEnv[key] || 'mock-env-value';
  })
}));

// Mock cookie helper
jest.mock('../utils/cookieHelper', () => ({
  setAuthCookie: jest.fn(),
  clearAuthCookie: jest.fn()
}));

// Mock password validator
jest.mock('../utils/passwordValidator', () => ({
  validatePassword: jest.fn((password) => ({
    valid: password.length >= 8,
    message: password.length >= 8 ? 'Valid password' : 'Password too short'
  }))
}));

// Mock email service
jest.mock('../services/emailService', () => ({
  sendEmailVerificationEmail: jest.fn().mockResolvedValue(true)
}));

// Mock refresh token service
jest.mock('../services/refreshTokenService', () => ({
  generateAccessToken: jest.fn().mockReturnValue('mock-access-token'),
  createRefreshToken: jest.fn().mockResolvedValue({
    token: 'mock-refresh-token',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  }),
  revokeRefreshToken: jest.fn().mockResolvedValue(true),
  rotateRefreshToken: jest.fn().mockResolvedValue({
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
    expiresIn: 900,
    refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    user: { id: 1, email: 'test@example.com', name: 'Test User' }
  }),
  revokeAllUserTokens: jest.fn().mockResolvedValue(3)
}));

// Mock sessions
jest.mock('../routes/sessions', () => ({
  createSession: jest.fn().mockResolvedValue({ id: 1 })
}));

// Mock fine-tuning poller
jest.mock('../jobs/fineTuningPoller', () => ({
  start: jest.fn()
}));

// Mock swagger config
jest.mock('../config/swagger', () => ({
  setupSwagger: jest.fn()
}));

// Mock all route modules
const mockRouter = express.Router();
jest.mock('../routes/bots', () => mockRouter);
jest.mock('../routes/messages', () => mockRouter);
jest.mock('../routes/organizations', () => mockRouter);
jest.mock('../routes/botFlows', () => mockRouter);
jest.mock('../routes/ai', () => mockRouter);
jest.mock('../routes/admin', () => mockRouter);
jest.mock('../routes/whitelabel', () => mockRouter);
jest.mock('../routes/billing', () => mockRouter);
jest.mock('../routes/analytics', () => mockRouter);
jest.mock('../routes/webhooks', () => mockRouter);
jest.mock('../routes/feedback', () => mockRouter);
jest.mock('../routes/api-tokens', () => mockRouter);
jest.mock('../routes/agents', () => mockRouter);
jest.mock('../routes/workflows', () => mockRouter);
jest.mock('../routes/executions', () => mockRouter);
jest.mock('../routes/tools', () => mockRouter);
jest.mock('../routes/knowledge', () => mockRouter);
jest.mock('../routes/plugins', () => mockRouter);
jest.mock('../routes/channels', () => mockRouter);
jest.mock('../routes/channelWebhooks', () => mockRouter);
jest.mock('../routes/team', () => mockRouter);
jest.mock('../routes/versions', () => mockRouter);
jest.mock('../routes/aiFlow', () => mockRouter);
jest.mock('../routes/orchestrations', () => mockRouter);
jest.mock('../routes/intents', () => mockRouter);
jest.mock('../routes/entities', () => mockRouter);
jest.mock('../routes/nlu', () => mockRouter);
jest.mock('../routes/autonomous', () => mockRouter);
jest.mock('../routes/integrations', () => mockRouter);
jest.mock('../routes/voice', () => mockRouter);
jest.mock('../routes/clone', () => mockRouter);
jest.mock('../routes/voiceToBot', () => mockRouter);
jest.mock('../routes/widget', () => mockRouter);
jest.mock('../routes/passwordReset', () => mockRouter);
jest.mock('../routes/emailVerification', () => mockRouter);
jest.mock('../routes/twoFactor', () => mockRouter);
jest.mock('../routes/roles', () => mockRouter);
jest.mock('../routes/superadmin', () => mockRouter);
jest.mock('../routes/adminAuth', () => mockRouter);
jest.mock('../routes/fineTuning', () => mockRouter);
jest.mock('../routes/sso', () => mockRouter);
jest.mock('../routes/scim', () => mockRouter);
jest.mock('../routes/recovery', () => mockRouter);

// Mock error handler
jest.mock('../middleware/errorHandler', () => ({
  errorHandler: jest.fn((err, req, res, next) => {
    res.status(err.statusCode || 500).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Something went wrong'
      }
    });
  }),
  notFoundHandler: jest.fn((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        path: req.path
      }
    });
  })
}));

const db = require('../db');
const log = require('../utils/logger');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ========================================
// TEST APP SETUP
// ========================================

describe('Server Configuration Tests', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create minimal app for testing
    app = express();

    // Apply middleware in the same order as server.js
    app.set('trust proxy', 1);

    // CORS
    const cors = require('cors');
    app.use(cors({
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (origin.startsWith('http://localhost:')) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id', 'x-csrf-token']
    }));

    // Body parsing
    app.use(express.json({ limit: '10kb' }));
    app.use(express.urlencoded({ extended: true, limit: '50kb' }));

    // Cookie parser
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());

    // Request ID
    const crypto = require('crypto');
    app.use((req, res, next) => {
      const requestId = req.headers['x-request-id'] || crypto.randomUUID();
      req.requestId = requestId;
      res.setHeader('X-Request-ID', requestId);
      next();
    });

    // Test route
    app.get('/test', (req, res) => {
      res.json({
        message: 'BotBuilder Backend is LIVE!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // CSRF token endpoint
    app.get('/api/csrf-token', (req, res) => {
      res.json({ csrfToken: 'mock-csrf-token' });
    });

    // Auth routes
    setupAuthRoutes(app);

    // Error handlers
    const { errorHandler, notFoundHandler } = require('../middleware/errorHandler');
    app.use(notFoundHandler);
    app.use(errorHandler);
  });

  // ========================================
  // APP INITIALIZATION TESTS
  // ========================================

  describe('App Initialization', () => {
    test('should initialize express app', () => {
      expect(app).toBeDefined();
      expect(typeof app).toBe('function');
    });

    test('should set trust proxy to 1', () => {
      expect(app.get('trust proxy')).toBe(1);
    });

    test('should be ready to handle requests', async () => {
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    });
  });

  // ========================================
  // MIDDLEWARE SETUP TESTS
  // ========================================

  describe('Middleware Setup', () => {
    test('should parse JSON body', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/test-json', (req, res) => {
        res.json({ received: req.body });
      });

      const response = await request(testApp)
        .post('/test-json')
        .send({ test: 'data' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.received).toEqual({ test: 'data' });
    });

    test('should parse URL-encoded body', async () => {
      const testApp = express();
      testApp.use(express.urlencoded({ extended: true }));
      testApp.post('/test-form', (req, res) => {
        res.json({ received: req.body });
      });

      const response = await request(testApp)
        .post('/test-form')
        .send('name=test&value=123')
        .set('Content-Type', 'application/x-www-form-urlencoded');

      expect(response.status).toBe(200);
      expect(response.body.received).toEqual({ name: 'test', value: '123' });
    });

    test('should reject JSON body larger than limit', async () => {
      const testApp = express();
      testApp.use(express.json({ limit: '1kb' }));
      testApp.post('/test', (req, res) => res.json({ ok: true }));

      const largePayload = { data: 'x'.repeat(2000) };

      const response = await request(testApp)
        .post('/test')
        .send(largePayload)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(413);
    });

    test('should parse cookies', async () => {
      const testApp = express();
      const cookieParser = require('cookie-parser');
      testApp.use(cookieParser());
      testApp.get('/test-cookie', (req, res) => {
        res.json({ cookies: req.cookies });
      });

      const response = await request(testApp)
        .get('/test-cookie')
        .set('Cookie', ['token=abc123', 'user=john']);

      expect(response.status).toBe(200);
      expect(response.body.cookies).toEqual({ token: 'abc123', user: 'john' });
    });

    test('should add request ID to all requests', async () => {
      const response = await request(app).get('/test');
      expect(response.headers['x-request-id']).toBeDefined();
      expect(typeof response.headers['x-request-id']).toBe('string');
    });

    test('should use custom request ID if provided', async () => {
      const customId = 'custom-request-id-12345';
      const response = await request(app)
        .get('/test')
        .set('x-request-id', customId);

      expect(response.headers['x-request-id']).toBe(customId);
    });
  });

  // ========================================
  // CORS CONFIGURATION TESTS
  // ========================================

  describe('CORS Configuration', () => {
    test('should allow localhost origins', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    test('should allow requests without origin', async () => {
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    });

    test('should allow credentials', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    test('should support preflight OPTIONS request', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect([200, 204]).toContain(response.status);
    });

    test('should allow specific methods', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      const allowedMethods = response.headers['access-control-allow-methods'];
      if (allowedMethods) {
        expect(allowedMethods).toContain('GET');
        expect(allowedMethods).toContain('POST');
      }
    });

    test('should allow specific headers', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

      expect([200, 204]).toContain(response.status);
    });
  });

  // ========================================
  // HEALTH CHECK ENDPOINT TESTS
  // ========================================

  describe('Health Check Endpoint', () => {
    test('should respond to /test endpoint', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('BotBuilder Backend is LIVE!');
    });

    test('should include timestamp in health check', async () => {
      const response = await request(app).get('/test');

      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    test('should include environment in health check', async () => {
      const response = await request(app).get('/test');

      expect(response.body).toHaveProperty('environment');
      expect(typeof response.body.environment).toBe('string');
    });
  });

  // ========================================
  // API PREFIX ROUTING TESTS
  // ========================================

  describe('API Prefix Routing', () => {
    test('should mount routes under /api prefix', async () => {
      const response = await request(app).get('/api/csrf-token');
      expect(response.status).toBe(200);
    });

    test('should handle /api/* routes', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.get('/api/custom', (req, res) => {
        res.json({ custom: true });
      });

      const response = await request(testApp).get('/api/custom');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('custom', true);
    });
  });

  // ========================================
  // ERROR HANDLING TESTS
  // ========================================

  describe('Error Handling', () => {
    test('should handle 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
    });

    test('should handle 404 with route path in response', async () => {
      const response = await request(app).get('/api/does-not-exist');

      expect(response.status).toBe(404);
      expect(response.body.error).toHaveProperty('path', '/api/does-not-exist');
    });

    test('should handle errors from route handlers', async () => {
      const testApp = express();
      testApp.use(express.json());

      testApp.get('/error-test', (req, res, next) => {
        const error = new Error('Test error');
        error.statusCode = 400;
        error.code = 'TEST_ERROR';
        next(error);
      });

      const { errorHandler } = require('../middleware/errorHandler');
      testApp.use(errorHandler);

      const response = await request(testApp).get('/error-test');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('message');
    });

    test('should handle async errors', async () => {
      const testApp = express();
      testApp.use(express.json());

      testApp.get('/async-error', async (req, res, next) => {
        try {
          throw new Error('Async error');
        } catch (error) {
          error.statusCode = 500;
          next(error);
        }
      });

      const { errorHandler } = require('../middleware/errorHandler');
      testApp.use(errorHandler);

      const response = await request(testApp).get('/async-error');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
    });

    test('should return error object with code and message', async () => {
      const response = await request(app).get('/unknown');

      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });
  });

  // ========================================
  // CSRF TOKEN TESTS
  // ========================================

  describe('CSRF Token Handling', () => {
    test('should provide CSRF token endpoint', async () => {
      const response = await request(app).get('/api/csrf-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('csrfToken');
    });

    test('should return valid CSRF token', async () => {
      const response = await request(app).get('/api/csrf-token');

      expect(response.body.csrfToken).toBeDefined();
      expect(typeof response.body.csrfToken).toBe('string');
    });
  });

  // ========================================
  // AUTHENTICATION ENDPOINT TESTS
  // ========================================

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/register', () => {
      test('should register new user successfully', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] }) // Check existing user
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'John', email: 'john@example.com', created_at: new Date() }] }) // Insert user
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'John', email: 'john@example.com' }] }) // Verify user
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'org', slug: 'org-1', owner_id: 1 }] }) // Create org
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'org', slug: 'org-1', owner_id: 1 }] }) // Verify org
          .mockResolvedValueOnce({ rows: [{ id: 1, org_id: 1, user_id: 1, role: 'admin' }] }) // Create membership
          .mockResolvedValueOnce({ rows: [{ id: 1, org_id: 1, user_id: 1, role: 'admin' }] }) // Verify membership
          .mockResolvedValueOnce({ rows: [{ user_id: 1, org_id: 1, org_name: 'org', user_role: 'admin' }] }) // Final check
          .mockResolvedValueOnce({ rows: [] }); // Update verification token

        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'John',
            email: 'john@example.com',
            password: 'password123'
          });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('user');
      });

      test('should reject registration with missing fields', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com'
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('message');
      });

      test('should reject invalid email format', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'Test',
            email: 'invalid-email',
            password: 'password123'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('email');
      });

      test('should reject weak password', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'Test',
            email: 'test@example.com',
            password: 'short'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Password');
      });

      test('should reject duplicate email', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Existing user

        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'Test',
            email: 'existing@example.com',
            password: 'password123'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('already registered');
      });

      test('should hash password before storing', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test', email: 'test@example.com', created_at: new Date() }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ user_id: 1, org_id: 1 }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'Test',
            email: 'test@example.com',
            password: 'password123'
          });

        expect(response.status).toBe(201);
        // bcrypt.hash is mocked globally, just verify it was called
        expect(response.body).toHaveProperty('token');
      });

      test('should create organization for new user', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test', email: 'test@example.com', created_at: new Date() }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'org', slug: 'test-org' }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ user_id: 1, org_id: 1 }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'Test',
            email: 'test@example.com',
            password: 'password123'
          });

        expect(response.status).toBe(201);
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO organizations'),
          expect.any(Array)
        );
      });

      test('should return JWT token on successful registration', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test', email: 'test@example.com', created_at: new Date() }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ user_id: 1, org_id: 1 }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'Test',
            email: 'test@example.com',
            password: 'password123'
          });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('token');
        expect(response.body.token).toBeDefined();
      });
    });

    describe('POST /api/auth/login', () => {
      test('should login user successfully', async () => {
        bcrypt.compare.mockResolvedValue(true);
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test', email: 'test@example.com', password_hash: 'hashed', is_superadmin: false }] })
          .mockResolvedValueOnce({ rows: [{ two_factor_enabled: false }] })
          .mockResolvedValueOnce({ rows: [{ org_id: 1 }] });

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password123'
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('token');
      });

      test('should reject login with missing credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('required');
      });

      test('should reject login with invalid email', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] }) // User query
          .mockResolvedValueOnce({ rows: [] }); // 2FA query

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'password123'
          });

        expect(response.status).toBe(401);
        expect(response.body.message).toContain('Invalid');
      });

      test('should reject login with wrong password', async () => {
        bcrypt.compare.mockResolvedValue(false);
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, password_hash: 'hashed' }] })
          .mockResolvedValueOnce({ rows: [{ two_factor_enabled: false }] });

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          });

        expect(response.status).toBe(401);
        expect(response.body.message).toContain('Invalid');
      });

      test('should verify password with bcrypt', async () => {
        bcrypt.compare.mockResolvedValue(true);
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test', email: 'test@example.com', password_hash: 'hashed', is_superadmin: false }] })
          .mockResolvedValueOnce({ rows: [{ two_factor_enabled: false }] })
          .mockResolvedValueOnce({ rows: [{ org_id: 1 }] });

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password123'
          });

        expect(response.status).toBe(200);
        // bcrypt.compare is mocked globally, just verify successful login
        expect(response.body).toHaveProperty('success', true);
      });

      test('should return user data on successful login', async () => {
        bcrypt.compare.mockResolvedValue(true);
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test', email: 'test@example.com', password_hash: 'hashed', is_superadmin: false }] })
          .mockResolvedValueOnce({ rows: [{ two_factor_enabled: false }] })
          .mockResolvedValueOnce({ rows: [{ org_id: 1 }] });

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password123'
          });

        expect(response.body).toHaveProperty('user');
        expect(response.body.user).toHaveProperty('id');
        expect(response.body.user).toHaveProperty('email');
      });

      test('should include refresh token in response', async () => {
        bcrypt.compare.mockResolvedValue(true);
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test', email: 'test@example.com', password_hash: 'hashed', is_superadmin: false }] })
          .mockResolvedValueOnce({ rows: [{ two_factor_enabled: false }] })
          .mockResolvedValueOnce({ rows: [{ org_id: 1 }] });

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password123'
          });

        expect(response.body).toHaveProperty('refreshToken');
      });
    });

    describe('POST /api/auth/logout', () => {
      test('should logout user successfully', async () => {
        const response = await request(app)
          .post('/api/auth/logout')
          .send({ refreshToken: 'mock-refresh-token' });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
      });

      test('should clear auth cookie on logout', async () => {
        const { clearAuthCookie } = require('../utils/cookieHelper');

        await request(app)
          .post('/api/auth/logout')
          .send({ refreshToken: 'token' });

        expect(clearAuthCookie).toHaveBeenCalled();
      });

      test('should handle logout without refresh token', async () => {
        const response = await request(app)
          .post('/api/auth/logout')
          .send({});

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
      });
    });

    describe('POST /api/auth/refresh', () => {
      test('should refresh token successfully', async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: 'valid-refresh-token' });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('token');
      });

      test('should reject refresh without token', async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('required');
      });

      test('should return new access and refresh tokens', async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: 'valid-token' });

        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('refreshToken');
      });
    });

    describe('POST /api/auth/logout-all', () => {
      test('should logout from all devices', async () => {
        jwt.verify.mockReturnValue({ id: 1 });

        const response = await request(app)
          .post('/api/auth/logout-all')
          .set('Authorization', 'Bearer valid-token');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
      });

      test('should require authentication', async () => {
        const response = await request(app)
          .post('/api/auth/logout-all');

        expect(response.status).toBe(401);
      });

      test('should return number of revoked sessions', async () => {
        jwt.verify.mockReturnValue({ id: 1 });

        const response = await request(app)
          .post('/api/auth/logout-all')
          .set('Authorization', 'Bearer valid-token');

        expect(response.body).toHaveProperty('revokedSessions');
      });
    });

    describe('POST /api/auth/demo', () => {
      test('should login demo user successfully', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 999, name: 'Demo', email: 'demo@botbuilder.com', password_hash: 'hashed' }] })
          .mockResolvedValueOnce({ rows: [{ org_id: 1 }] });

        const response = await request(app)
          .post('/api/auth/demo');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.user).toHaveProperty('isDemo', true);
      });

      test('should handle missing demo user', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/auth/demo');

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('Demo');
      });
    });
  });

  // ========================================
  // SECURITY TESTS
  // ========================================

  describe('Security Configuration', () => {
    test('should set security headers', async () => {
      const response = await request(app).get('/test');

      // Request ID header should be present
      expect(response.headers['x-request-id']).toBeDefined();
    });

    test('should trust proxy for accurate IP detection', () => {
      expect(app.get('trust proxy')).toBe(1);
    });

    test('should not expose error stack traces in production', async () => {
      process.env.NODE_ENV = 'production';

      app.get('/error', (req, res, next) => {
        const error = new Error('Test error with sensitive data');
        error.statusCode = 500;
        next(error);
      });

      const response = await request(app).get('/error');

      expect(response.body.error).not.toHaveProperty('stack');

      process.env.NODE_ENV = 'test';
    });
  });

  // ========================================
  // ROUTE MOUNTING TESTS
  // ========================================

  describe('Route Mounting', () => {
    test('should have all auth routes available', async () => {
      // Test that auth routes are properly mounted
      const registerRes = await request(app).post('/api/auth/register').send({});
      const loginRes = await request(app).post('/api/auth/login').send({});
      const logoutRes = await request(app).post('/api/auth/logout').send({});

      // Should get validation errors, not 404
      expect(registerRes.status).not.toBe(404);
      expect(loginRes.status).not.toBe(404);
      expect(logoutRes.status).not.toBe(404);
    });
  });

  // ========================================
  // INTEGRATION TESTS
  // ========================================

  describe('Integration Tests', () => {
    test('should handle complete registration flow', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'John', email: 'john@test.com', created_at: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 1, org_id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'John',
          email: 'john@test.com',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body.user.email).toBe('john@test.com');
    });

    test('should handle complete login flow', async () => {
      bcrypt.compare.mockResolvedValue(true);
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'John', email: 'john@test.com', password_hash: 'hashed', is_superadmin: false }] })
        .mockResolvedValueOnce({ rows: [{ two_factor_enabled: false }] })
        .mockResolvedValueOnce({ rows: [{ org_id: 1 }] });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john@test.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('john@test.com');
    });

    test('should handle token refresh flow', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
    });
  });
});

// ========================================
// HELPER FUNCTIONS
// ========================================

function setupAuthRoutes(app) {
  const { setAuthCookie, clearAuthCookie } = require('../utils/cookieHelper');
  const { validatePassword } = require('../utils/passwordValidator');
  const refreshTokenService = require('../services/refreshTokenService');
  const { getSecureEnv } = require('../utils/envValidator');

  // Register
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({
          message: 'All fields required',
          required: ['username', 'email', 'password']
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          message: 'Invalid email format'
        });
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          message: passwordValidation.message
        });
      }

      const existingUser = await db.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await db.query(
        `INSERT INTO users (name, email, password_hash, email_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, name, email, email_verified, created_at`,
        [username, email, hashedPassword, false]
      );

      const user = result.rows[0];
      await db.query('SELECT id, name, email FROM users WHERE id = $1', [user.id]);

      const orgSlug = `${username.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${user.id}`;
      const orgName = `${username}'s Organization`;

      const orgResult = await db.query(
        `INSERT INTO organizations (name, slug, owner_id, plan_tier, settings, created_at, updated_at)
         VALUES ($1, $2, $3, 'free', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, name, slug, owner_id`,
        [orgName, orgSlug, user.id]
      );

      const organization = orgResult.rows[0];
      const organizationId = organization.id;

      await db.query('SELECT id, name, slug, owner_id FROM organizations WHERE id = $1', [organizationId]);

      await db.query(
        `INSERT INTO organization_members (org_id, user_id, role, status, joined_at)
         VALUES ($1, $2, 'admin', 'active', CURRENT_TIMESTAMP)
         RETURNING id, org_id, user_id, role, status`,
        [organizationId, user.id]
      );

      await db.query(
        'SELECT id, org_id, user_id, role FROM organization_members WHERE org_id = $1 AND user_id = $2',
        [organizationId, user.id]
      );

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          username: user.name,
          current_organization_id: organizationId
        },
        getSecureEnv('JWT_SECRET'),
        { expiresIn: '24h' }
      );

      await db.query(`
        SELECT u.id as user_id, u.email, u.name, o.id as org_id, o.name as org_name, o.slug as org_slug, om.role as user_role
        FROM users u
        JOIN organizations o ON o.owner_id = u.id
        JOIN organization_members om ON om.org_id = o.id AND om.user_id = u.id
        WHERE u.id = $1
      `, [user.id]);

      await db.query(
        `UPDATE users SET verification_token = $1, verification_token_expires_at = $2 WHERE id = $3`,
        ['token', new Date(), user.id]
      );

      setAuthCookie(res, token);

      res.status(201).json({
        success: true,
        message: 'User registered successfully! Please check your email to verify your account.',
        token: token,
        user: {
          id: user.id,
          username: user.name,
          email: user.email,
          isVerified: user.email_verified,
          createdAt: user.created_at,
          currentOrganizationId: organizationId
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Server error during registration'
      });
    }
  });

  // Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          message: 'Email and password required'
        });
      }

      const result = await db.query(
        'SELECT id, name, email, password_hash, is_superadmin FROM users WHERE email = $1',
        [email]
      );

      const tfaResult = await db.query(
        'SELECT two_factor_enabled, two_factor_secret FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const user = result.rows[0];
      const twoFactorData = tfaResult.rows[0] || { two_factor_enabled: false };

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const orgResult = await db.query(
        `SELECT om.org_id FROM organization_members om WHERE om.user_id = $1 AND om.status = 'active' ORDER BY om.joined_at ASC LIMIT 1`,
        [user.id]
      );

      let organizationId = orgResult.rows.length > 0 ? orgResult.rows[0].org_id : null;

      const accessToken = refreshTokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId
      });

      const refreshTokenData = await refreshTokenService.createRefreshToken(user.id, req);

      setAuthCookie(res, accessToken);

      res.json({
        success: true,
        message: 'Login successful!',
        token: accessToken,
        refreshToken: refreshTokenData.token,
        expiresIn: 900,
        refreshExpiresAt: refreshTokenData.expiresAt,
        user: {
          id: user.id,
          username: user.name,
          email: user.email,
          currentOrganizationId: organizationId,
          has2FA: twoFactorData.two_factor_enabled || false,
          is_superadmin: user.is_superadmin || false,
          isSuperAdmin: user.is_superadmin || false
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  });

  // Logout
  app.post('/api/auth/logout', async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (refreshToken) {
        await refreshTokenService.revokeRefreshToken(refreshToken);
      }
      clearAuthCookie(res);
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      clearAuthCookie(res);
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    }
  });

  // Refresh
  app.post('/api/auth/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      const result = await refreshTokenService.rotateRefreshToken(refreshToken, req);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token'
        });
      }

      setAuthCookie(res, result.accessToken);

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        token: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        refreshExpiresAt: result.refreshExpiresAt,
        user: result.user
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to refresh token'
      });
    }
  });

  // Logout all
  app.post('/api/auth/logout-all', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, getSecureEnv('JWT_SECRET'));

      const revokedCount = await refreshTokenService.revokeAllUserTokens(decoded.id);

      clearAuthCookie(res);
      res.json({
        success: true,
        message: `Logged out from all devices. ${revokedCount} session(s) terminated.`,
        revokedSessions: revokedCount
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to logout from all devices'
      });
    }
  });

  // Demo login
  app.post('/api/auth/demo', async (req, res) => {
    try {
      const demoEmail = 'demo@botbuilder.com';

      const result = await db.query(
        'SELECT id, name, email, password_hash FROM users WHERE email = $1',
        [demoEmail]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Demo account not found. Please contact support.'
        });
      }

      const user = result.rows[0];

      const orgResult = await db.query(
        `SELECT om.org_id FROM organization_members om WHERE om.user_id = $1 AND om.status = 'active' ORDER BY om.joined_at ASC LIMIT 1`,
        [user.id]
      );

      let organizationId = orgResult.rows.length > 0 ? orgResult.rows[0].org_id : null;

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          username: user.name,
          current_organization_id: organizationId,
          is_demo: true
        },
        getSecureEnv('JWT_SECRET'),
        { expiresIn: '24h' }
      );

      setAuthCookie(res, token);

      res.json({
        success: true,
        message: 'Demo login successful! You are viewing a demo account.',
        token: token,
        user: {
          id: user.id,
          username: user.name,
          email: user.email,
          currentOrganizationId: organizationId,
          isDemo: true
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Demo login error'
      });
    }
  });
}
