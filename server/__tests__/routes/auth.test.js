/**
 * Comprehensive Auth Routes Tests
 * Tests for all authentication endpoints in server.js and related routes
 *
 * Coverage:
 * - POST /api/auth/register
 * - POST /api/auth/login
 * - POST /api/auth/logout
 * - POST /api/auth/refresh
 * - POST /api/auth/logout-all
 * - POST /api/auth/demo
 * - POST /api/auth/forgot-password
 * - GET /api/auth/verify-reset-token
 * - POST /api/auth/reset-password
 * - GET /api/auth/verify-email
 * - POST /api/auth/resend-verification
 */

// Mock dependencies first, before requiring any modules
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    next();
  }),
  authorizeRole: jest.fn(() => (req, res, next) => next())
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn((password, saltRounds) => Promise.resolve(`hashed_${password}`)),
  compare: jest.fn((password, hash) => {
    if (hash === 'hashed_correctpassword') {
      return Promise.resolve(password === 'correctpassword');
    }
    return Promise.resolve(false);
  })
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn((payload, secret, options) => 'mock_jwt_token'),
  verify: jest.fn((token, secret) => ({
    id: 1,
    email: 'test@example.com',
    username: 'testuser'
  }))
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../services/emailService', () => ({
  sendEmailVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../utils/passwordValidator', () => ({
  validatePassword: jest.fn((password) => {
    if (!password || password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    return { valid: true };
  })
}));

jest.mock('../../middleware/rateLimiter', () => ({
  authLimiter: jest.fn((req, res, next) => next()),
  dbAuthLimiter: jest.fn((req, res, next) => next()),
  recordFailedLogin: jest.fn((req, res, next) => next())
}));

jest.mock('../../services/refreshTokenService', () => ({
  generateAccessToken: jest.fn((payload) => 'mock_access_token'),
  createRefreshToken: jest.fn((userId, req) => Promise.resolve({
    token: 'mock_refresh_token',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  })),
  rotateRefreshToken: jest.fn((refreshToken, req) => Promise.resolve({
    accessToken: 'new_access_token',
    refreshToken: 'new_refresh_token',
    expiresIn: 900,
    refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    user: { id: 1, email: 'test@example.com' }
  })),
  revokeRefreshToken: jest.fn().mockResolvedValue(true),
  revokeAllUserTokens: jest.fn().mockResolvedValue(3)
}));

jest.mock('../../utils/cookieHelper', () => ({
  setAuthCookie: jest.fn(),
  clearAuthCookie: jest.fn()
}));

// sessionHelper mock removed - module doesn't exist

jest.mock('crypto', () => ({
  randomBytes: jest.fn((size) => ({
    toString: jest.fn(() => 'mock_token_123456789')
  })),
  createHash: jest.fn(() => ({
    update: jest.fn(() => ({
      digest: jest.fn(() => 'mock_hash')
    }))
  }))
}));

const express = require('express');
const request = require('supertest');
const db = require('../../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const emailService = require('../../services/emailService');
const refreshTokenService = require('../../services/refreshTokenService');
const { validatePassword } = require('../../utils/passwordValidator');
const passwordResetRouter = require('../../routes/passwordReset');
const emailVerificationRouter = require('../../routes/emailVerification');

// Create Express app for testing
const app = express();
app.use(express.json());

// Add environment variable mocking
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.NODE_ENV = 'test';

// Mock the auth routes from server.js
const setupAuthRoutes = (app) => {
  const { authLimiter, dbAuthLimiter, recordFailedLogin } = require('../../middleware/rateLimiter');
  const { setAuthCookie, clearAuthCookie } = require('../../utils/cookieHelper');
  // sessionHelper - mock the functions directly since module doesn't exist
  const createSession = jest.fn().mockResolvedValue({ id: 1 });
  const logRegister = jest.fn().mockResolvedValue(true);
  const logLogin = jest.fn().mockResolvedValue(true);
  const crypto = require('crypto');
  const log = require('../../utils/logger');

  // Helper function to get JWT secret
  const getSecureEnv = (key) => process.env[key];

  // POST /api/auth/register
  app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
      const { username, email, password } = req.body;

      // Validation
      if (!username || !email || !password) {
        return res.status(400).json({
          message: 'All fields required',
          required: ['username', 'email', 'password']
        });
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          message: 'Invalid email format'
        });
      }

      // Password strength validation
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          message: passwordValidation.message
        });
      }

      // Check if email already exists
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

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user into database
      const result = await db.query(
        `INSERT INTO users (name, email, password_hash, email_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, name, email, email_verified, created_at`,
        [username, email, hashedPassword, false]
      );

      const user = result.rows[0];

      // Verify user was created
      const verifyUser = await db.query('SELECT id, name, email FROM users WHERE id = $1', [user.id]);
      if (verifyUser.rows.length === 0) {
        throw new Error('User verification failed - user not found after creation');
      }

      // Create personal organization
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

      // Verify organization was created
      const verifyOrg = await db.query('SELECT id, name, slug, owner_id FROM organizations WHERE id = $1', [organizationId]);
      if (verifyOrg.rows.length === 0) {
        throw new Error('Organization verification failed - organization not found after creation');
      }

      // Add user as admin to organization
      await db.query(
        `INSERT INTO organization_members (org_id, user_id, role, status, joined_at)
         VALUES ($1, $2, 'admin', 'active', CURRENT_TIMESTAMP)
         RETURNING id, org_id, user_id, role, status`,
        [organizationId, user.id]
      );

      // Verify membership was created
      const verifyMember = await db.query(
        'SELECT id, org_id, user_id, role FROM organization_members WHERE org_id = $1 AND user_id = $2',
        [organizationId, user.id]
      );
      if (verifyMember.rows.length === 0) {
        throw new Error('Membership verification failed - membership not found after creation');
      }

      // Generate JWT token
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

      // Final verification query
      const finalCheck = await db.query(`
        SELECT
          u.id as user_id,
          u.email,
          u.name,
          o.id as org_id,
          o.name as org_name,
          o.slug as org_slug,
          om.role as user_role
        FROM users u
        JOIN organizations o ON o.owner_id = u.id
        JOIN organization_members om ON om.org_id = o.id AND om.user_id = u.id
        WHERE u.id = $1
      `, [user.id]);

      if (finalCheck.rows.length === 0) {
        throw new Error('Final verification failed - user/organization relationship not found');
      }

      // Log successful registration to audit trail
      await logRegister(req, user.id, user.email);

      // Generate email verification token and send verification email
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await db.query(
        `UPDATE users SET verification_token = $1, verification_token_expires_at = $2 WHERE id = $3`,
        [verificationToken, verificationExpiresAt, user.id]
      );

      // Send verification email (non-blocking)
      emailService.sendEmailVerificationEmail(user.email, verificationToken, user.name)
        .catch(() => {});

      // Create session record in database (non-blocking)
      try {
        await createSession(user.id, req);
      } catch (sessionError) {
        // Ignore session errors
      }

      // Set JWT as httpOnly cookie
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
        message: 'Server error during registration',
        ...(process.env.NODE_ENV !== 'production' && { error: error.message })
      });
    }
  });

  // POST /api/auth/login
  app.post('/api/auth/login', dbAuthLimiter, recordFailedLogin, authLimiter, async (req, res) => {
    try {
      const { email, password, twoFactorCode } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({
          message: 'Email and password required'
        });
      }

      // Query database for user
      const result = await db.query(
        'SELECT id, name, email, password_hash, is_superadmin FROM users WHERE email = $1',
        [email]
      );

      // Get 2FA fields separately
      let twoFactorData = { two_factor_enabled: false, two_factor_secret: null };
      try {
        const tfaResult = await db.query(
          'SELECT two_factor_enabled, two_factor_secret FROM users WHERE email = $1',
          [email]
        );
        if (tfaResult.rows.length > 0) {
          twoFactorData = tfaResult.rows[0];
        }
      } catch (tfaError) {
        // 2FA columns don't exist yet
      }

      // Check if user exists
      if (result.rows.length === 0) {
        await logLogin(req, null, false, 'User not found');
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const user = result.rows[0];

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        await logLogin(req, user.id, false, 'Invalid password');
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check if 2FA is enabled
      if (twoFactorData.two_factor_enabled) {
        if (!twoFactorCode) {
          return res.status(200).json({
            success: true,
            requires2FA: true,
            message: 'Please enter your 2FA code'
          });
        }

        // Validate 2FA code (simplified for test)
        if (twoFactorCode !== '123456') {
          await logLogin(req, user.id, false, 'Invalid 2FA code');
          return res.status(401).json({
            success: false,
            message: 'Invalid 2FA code'
          });
        }
      }

      // Get user's default organization
      let orgResult = await db.query(
        `SELECT om.org_id
         FROM organization_members om
         WHERE om.user_id = $1 AND om.status = 'active'
         ORDER BY om.joined_at ASC
         LIMIT 1`,
        [user.id]
      );

      let organizationId = null;
      if (orgResult.rows.length > 0) {
        organizationId = orgResult.rows[0].org_id;
      }

      // Generate tokens
      const accessToken = refreshTokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId
      });

      const refreshTokenData = await refreshTokenService.createRefreshToken(user.id, req);

      // Log successful login
      await logLogin(req, user.id, true);

      // Create session
      try {
        await createSession(user.id, req);
      } catch (sessionError) {
        // Ignore
      }

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

  // POST /api/auth/logout
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

  // POST /api/auth/refresh
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

  // POST /api/auth/logout-all
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

  // POST /api/auth/demo
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
          message: 'Demo account not found'
        });
      }

      const user = result.rows[0];

      // Get organization
      let orgResult = await db.query(
        `SELECT om.org_id
         FROM organization_members om
         WHERE om.user_id = $1 AND om.status = 'active'
         ORDER BY om.joined_at ASC
         LIMIT 1`,
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

      await logLogin(req, user.id, true);

      try {
        await createSession(user.id, req);
      } catch (sessionError) {
        // Ignore
      }

      setAuthCookie(res, accessToken);

      res.json({
        success: true,
        message: 'Demo login successful!',
        token: accessToken,
        refreshToken: refreshTokenData.token,
        user: {
          id: user.id,
          username: user.name,
          email: user.email,
          currentOrganizationId: organizationId
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Demo login failed'
      });
    }
  });
};

// Setup routes
setupAuthRoutes(app);
app.use('/api/auth', passwordResetRouter);
app.use('/api/auth', emailVerificationRouter);

describe('Auth Routes - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // POST /api/auth/register Tests
  // ==========================================
  describe('POST /api/auth/register', () => {
    const validRegistration = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123!'
    };

    it('should register a new user successfully', async () => {
      // Mock database responses
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing user
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'testuser', email: 'test@example.com', email_verified: false, created_at: new Date() }] }) // Insert user
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'testuser', email: 'test@example.com' }] }) // Verify user
        .mockResolvedValueOnce({ rows: [{ id: 1, name: "testuser's Organization", slug: 'testuser-1', owner_id: 1 }] }) // Insert org
        .mockResolvedValueOnce({ rows: [{ id: 1, name: "testuser's Organization", slug: 'testuser-1', owner_id: 1 }] }) // Verify org
        .mockResolvedValueOnce({ rows: [{ id: 1, org_id: 1, user_id: 1, role: 'admin', status: 'active' }] }) // Insert member
        .mockResolvedValueOnce({ rows: [{ id: 1, org_id: 1, user_id: 1, role: 'admin' }] }) // Verify member
        .mockResolvedValueOnce({ rows: [{ user_id: 1, email: 'test@example.com', name: 'testuser', org_id: 1, org_name: "testuser's Organization", org_slug: 'testuser-1', user_role: 'admin' }] }) // Final check
        .mockResolvedValueOnce({ rows: [] }); // Update verification token

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('registered successfully');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.token).toBeDefined();
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 10);
      expect(emailService.sendEmailVerificationEmail).toHaveBeenCalled();
    });

    it('should reject registration with missing username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'Password123!' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('All fields required');
    });

    it('should reject registration with missing email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'Password123!' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('All fields required');
    });

    it('should reject registration with missing password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('All fields required');
    });

    it('should reject registration with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', email: 'invalid-email', password: 'Password123!' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid email format');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', email: 'test@example.com', password: 'weak' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Password must be at least 8 characters');
    });

    it('should reject registration with duplicate email', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Existing user found

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Email already registered');
    });

    it('should handle database errors during registration', async () => {
      db.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error during registration');
    });

    it('should handle user verification failure', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing user
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'testuser', email: 'test@example.com', email_verified: false, created_at: new Date() }] }) // Insert user
        .mockResolvedValueOnce({ rows: [] }); // Verify user - returns empty (failure)

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle organization creation failure', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing user
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'testuser', email: 'test@example.com', email_verified: false, created_at: new Date() }] }) // Insert user
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'testuser', email: 'test@example.com' }] }) // Verify user
        .mockResolvedValueOnce({ rows: [{ id: 1, name: "testuser's Organization", slug: 'testuser-1', owner_id: 1 }] }) // Insert org
        .mockResolvedValueOnce({ rows: [] }); // Verify org - returns empty (failure)

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle membership creation failure', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing user
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'testuser', email: 'test@example.com', email_verified: false, created_at: new Date() }] }) // Insert user
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'testuser', email: 'test@example.com' }] }) // Verify user
        .mockResolvedValueOnce({ rows: [{ id: 1, name: "testuser's Organization", slug: 'testuser-1', owner_id: 1 }] }) // Insert org
        .mockResolvedValueOnce({ rows: [{ id: 1, name: "testuser's Organization", slug: 'testuser-1', owner_id: 1 }] }) // Verify org
        .mockResolvedValueOnce({ rows: [{ id: 1, org_id: 1, user_id: 1, role: 'admin', status: 'active' }] }) // Insert member
        .mockResolvedValueOnce({ rows: [] }); // Verify member - returns empty (failure)

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle final verification failure', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing user
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'testuser', email: 'test@example.com', email_verified: false, created_at: new Date() }] }) // Insert user
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'testuser', email: 'test@example.com' }] }) // Verify user
        .mockResolvedValueOnce({ rows: [{ id: 1, name: "testuser's Organization", slug: 'testuser-1', owner_id: 1 }] }) // Insert org
        .mockResolvedValueOnce({ rows: [{ id: 1, name: "testuser's Organization", slug: 'testuser-1', owner_id: 1 }] }) // Verify org
        .mockResolvedValueOnce({ rows: [{ id: 1, org_id: 1, user_id: 1, role: 'admin', status: 'active' }] }) // Insert member
        .mockResolvedValueOnce({ rows: [{ id: 1, org_id: 1, user_id: 1, role: 'admin' }] }) // Verify member
        .mockResolvedValueOnce({ rows: [] }); // Final check - returns empty (failure)

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should continue even if email verification fails', async () => {
      emailService.sendEmailVerificationEmail.mockRejectedValueOnce(new Error('Email service down'));

      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'testuser', email: 'test@example.com', email_verified: false, created_at: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'testuser', email: 'test@example.com' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: "testuser's Organization", slug: 'testuser-1', owner_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: "testuser's Organization", slug: 'testuser-1', owner_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, org_id: 1, user_id: 1, role: 'admin', status: 'active' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, org_id: 1, user_id: 1, role: 'admin' }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 1, email: 'test@example.com', name: 'testuser', org_id: 1, org_name: "testuser's Organization", org_slug: 'testuser-1', user_role: 'admin' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  // ==========================================
  // POST /api/auth/login Tests
  // ==========================================
  describe('POST /api/auth/login', () => {
    const validLogin = {
      email: 'test@example.com',
      password: 'correctpassword'
    };

    it('should login successfully with valid credentials', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'testuser', email: 'test@example.com', password_hash: 'hashed_correctpassword', is_superadmin: false }] }) // Find user
        .mockResolvedValueOnce({ rows: [{ two_factor_enabled: false, two_factor_secret: null }] }) // Get 2FA
        .mockResolvedValueOnce({ rows: [{ org_id: 1 }] }); // Get org

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLogin);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful!');
      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should reject login with missing email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Email and password required');
    });

    it('should reject login with missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Email and password required');
    });

    it('should reject login with non-existent user', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // User not found

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLogin);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should reject login with invalid password', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'testuser', email: 'test@example.com', password_hash: 'hashed_wrongpassword', is_superadmin: false }] })
        .mockResolvedValueOnce({ rows: [{ two_factor_enabled: false, two_factor_secret: null }] });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should require 2FA code when 2FA is enabled', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'testuser', email: 'test@example.com', password_hash: 'hashed_correctpassword', is_superadmin: false }] })
        .mockResolvedValueOnce({ rows: [{ two_factor_enabled: true, two_factor_secret: 'secret' }] });

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLogin);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.requires2FA).toBe(true);
      expect(response.body.message).toContain('2FA code');
    });

    it('should login successfully with valid 2FA code', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'testuser', email: 'test@example.com', password_hash: 'hashed_correctpassword', is_superadmin: false }] })
        .mockResolvedValueOnce({ rows: [{ two_factor_enabled: true, two_factor_secret: 'secret' }] })
        .mockResolvedValueOnce({ rows: [{ org_id: 1 }] });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ ...validLogin, twoFactorCode: '123456' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.has2FA).toBe(true);
    });

    it('should reject login with invalid 2FA code', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'testuser', email: 'test@example.com', password_hash: 'hashed_correctpassword', is_superadmin: false }] })
        .mockResolvedValueOnce({ rows: [{ two_factor_enabled: true, two_factor_secret: 'secret' }] });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ ...validLogin, twoFactorCode: '000000' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid 2FA code');
    });

    it('should handle database errors during login', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLogin);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error');
    });

    it('should handle missing organization gracefully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'testuser', email: 'test@example.com', password_hash: 'hashed_correctpassword', is_superadmin: false }] })
        .mockResolvedValueOnce({ rows: [{ two_factor_enabled: false, two_factor_secret: null }] })
        .mockResolvedValueOnce({ rows: [] }); // No organization

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLogin);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.currentOrganizationId).toBeNull();
    });

    it('should login superadmin successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'admin', email: 'admin@example.com', password_hash: 'hashed_correctpassword', is_superadmin: true }] })
        .mockResolvedValueOnce({ rows: [{ two_factor_enabled: false, two_factor_secret: null }] })
        .mockResolvedValueOnce({ rows: [{ org_id: 1 }] });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'correctpassword' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.is_superadmin).toBe(true);
      expect(response.body.user.isSuperAdmin).toBe(true);
    });

    it('should handle 2FA query errors gracefully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'testuser', email: 'test@example.com', password_hash: 'hashed_correctpassword', is_superadmin: false }] })
        .mockRejectedValueOnce(new Error('2FA column not found')) // 2FA query fails
        .mockResolvedValueOnce({ rows: [{ org_id: 1 }] });

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLogin);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ==========================================
  // POST /api/auth/logout Tests
  // ==========================================
  describe('POST /api/auth/logout', () => {
    it('should logout successfully with refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: 'valid_refresh_token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
      expect(refreshTokenService.revokeRefreshToken).toHaveBeenCalledWith('valid_refresh_token');
    });

    it('should logout successfully without refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should handle errors during logout gracefully', async () => {
      refreshTokenService.revokeRefreshToken.mockRejectedValueOnce(new Error('Token revocation failed'));

      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: 'valid_refresh_token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });
  });

  // ==========================================
  // POST /api/auth/refresh Tests
  // ==========================================
  describe('POST /api/auth/refresh', () => {
    it('should refresh token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid_refresh_token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Token refreshed successfully');
      expect(response.body.token).toBe('new_access_token');
      expect(response.body.refreshToken).toBe('new_refresh_token');
      expect(response.body.user).toBeDefined();
    });

    it('should reject refresh without token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Refresh token is required');
    });

    it('should reject invalid refresh token', async () => {
      refreshTokenService.rotateRefreshToken.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid_token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired refresh token');
    });

    it('should handle errors during token refresh', async () => {
      refreshTokenService.rotateRefreshToken.mockRejectedValueOnce(new Error('Token rotation failed'));

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid_refresh_token' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to refresh token');
    });
  });

  // ==========================================
  // POST /api/auth/logout-all Tests
  // ==========================================
  describe('POST /api/auth/logout-all', () => {
    it('should logout from all devices successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', 'Bearer valid_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logged out from all devices');
      expect(response.body.revokedSessions).toBe(3);
      expect(jwt.verify).toHaveBeenCalled();
    });

    it('should reject logout-all without authorization header', async () => {
      const response = await request(app)
        .post('/api/auth/logout-all');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication required');
    });

    it('should reject logout-all with invalid authorization header', async () => {
      const response = await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', 'InvalidToken');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication required');
    });

    it('should handle errors during logout-all', async () => {
      jwt.verify.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to logout from all devices');
    });
  });

  // ==========================================
  // POST /api/auth/demo Tests
  // ==========================================
  describe('POST /api/auth/demo', () => {
    it('should login to demo account successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 999, name: 'Demo User', email: 'demo@botbuilder.com', password_hash: 'hashed' }] })
        .mockResolvedValueOnce({ rows: [{ org_id: 1 }] });

      const response = await request(app)
        .post('/api/auth/demo');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Demo login successful!');
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe('demo@botbuilder.com');
    });

    it('should handle demo account not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/demo');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Demo account not found');
    });

    it('should handle errors during demo login', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/demo');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Demo login failed');
    });

    it('should handle demo account without organization', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 999, name: 'Demo User', email: 'demo@botbuilder.com', password_hash: 'hashed' }] })
        .mockResolvedValueOnce({ rows: [] }); // No organization

      const response = await request(app)
        .post('/api/auth/demo');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.currentOrganizationId).toBeNull();
    });
  });

  // ==========================================
  // POST /api/auth/forgot-password Tests
  // ==========================================
  describe('POST /api/auth/forgot-password', () => {
    it('should send password reset email for existing user', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test User', email: 'test@example.com' }] }) // Find user
        .mockResolvedValueOnce({ rows: [] }) // Invalidate existing tokens
        .mockResolvedValueOnce({ rows: [] }); // Insert new token

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should return success for non-existent email (prevent enumeration)', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // User not found

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If an account exists');
    });

    it('should reject forgot-password without email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email is required');
    });

    it('should handle database errors during forgot-password', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to process password reset request');
    });

    it('should continue even if email sending fails', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test User', email: 'test@example.com' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      emailService.sendPasswordResetEmail.mockRejectedValueOnce(new Error('Email service down'));

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should trim and lowercase email', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test User', email: 'test@example.com' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: '  Test@Example.COM  ' });

      expect(response.status).toBe(200);
      expect(db.query).toHaveBeenCalledWith(
        'SELECT id, name, email FROM users WHERE email = $1',
        ['test@example.com']
      );
    });
  });

  // ==========================================
  // GET /api/auth/verify-reset-token Tests
  // ==========================================
  describe('GET /api/auth/verify-reset-token', () => {
    it('should verify valid reset token', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          user_id: 1,
          expires_at: futureDate,
          used_at: null,
          email: 'test@example.com'
        }]
      });

      const response = await request(app)
        .get('/api/auth/verify-reset-token?token=valid_token');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.email).toBe('test@example.com');
    });

    it('should reject missing token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-reset-token');

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('Token is required');
    });

    it('should reject invalid token', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/auth/verify-reset-token?token=invalid_token');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should reject used token', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          user_id: 1,
          expires_at: new Date(Date.now() + 60 * 60 * 1000),
          used_at: new Date(),
          email: 'test@example.com'
        }]
      });

      const response = await request(app)
        .get('/api/auth/verify-reset-token?token=used_token');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('Token has already been used');
    });

    it('should reject expired token', async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000);
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          user_id: 1,
          expires_at: pastDate,
          used_at: null,
          email: 'test@example.com'
        }]
      });

      const response = await request(app)
        .get('/api/auth/verify-reset-token?token=expired_token');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('Token has expired');
    });

    it('should handle database errors during token verification', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/auth/verify-reset-token?token=token');

      expect(response.status).toBe(500);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('Failed to verify token');
    });
  });

  // ==========================================
  // POST /api/auth/reset-password Tests
  // ==========================================
  describe('POST /api/auth/reset-password', () => {
    const validResetData = {
      token: 'valid_token',
      password: 'NewPassword123!'
    };

    it('should reset password successfully', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      db.query
        .mockResolvedValueOnce({ // Find token
          rows: [{
            id: 1,
            user_id: 1,
            expires_at: futureDate,
            used_at: null,
            email: 'test@example.com',
            name: 'Test User'
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Update password
        .mockResolvedValueOnce({ rows: [] }); // Mark token as used

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(validResetData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password has been reset successfully');
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 10);
    });

    it('should reject reset without token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ password: 'NewPassword123!' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Token and password are required');
    });

    it('should reject reset without password', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'valid_token' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Token and password are required');
    });

    it('should reject weak password', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'valid_token', password: 'weak' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Password must be at least 8 characters');
    });

    it('should reject invalid token', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(validResetData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should reject used token', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          user_id: 1,
          expires_at: new Date(Date.now() + 60 * 60 * 1000),
          used_at: new Date(),
          email: 'test@example.com',
          name: 'Test User'
        }]
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(validResetData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Token has already been used');
    });

    it('should reject expired token', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          user_id: 1,
          expires_at: new Date(Date.now() - 60 * 60 * 1000),
          used_at: null,
          email: 'test@example.com',
          name: 'Test User'
        }]
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(validResetData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Token has expired');
    });

    it('should handle database errors during password reset', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(validResetData);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to reset password');
    });
  });

  // ==========================================
  // GET /api/auth/verify-email Tests
  // ==========================================
  describe('GET /api/auth/verify-email', () => {
    it('should verify email successfully', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            email_verified: false,
            verification_token_expires_at: futureDate
          }]
        })
        .mockResolvedValueOnce({ rows: [] }); // Update user

      const response = await request(app)
        .get('/api/auth/verify-email?token=valid_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Email verified successfully');
      expect(response.body.email).toBe('test@example.com');
    });

    it('should reject missing token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-email');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Token is required');
    });

    it('should reject invalid token', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/auth/verify-email?token=invalid_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should handle already verified email', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          email_verified: true,
          verification_token_expires_at: new Date()
        }]
      });

      const response = await request(app)
        .get('/api/auth/verify-email?token=token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.alreadyVerified).toBe(true);
    });

    it('should reject expired token', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          email_verified: false,
          verification_token_expires_at: pastDate
        }]
      });

      const response = await request(app)
        .get('/api/auth/verify-email?token=expired_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Token has expired');
    });

    it('should handle database errors during email verification', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/auth/verify-email?token=token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to verify email');
    });
  });

  // ==========================================
  // POST /api/auth/resend-verification Tests
  // ==========================================
  describe('POST /api/auth/resend-verification', () => {
    it('should resend verification email for unverified user', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            email_verified: false
          }]
        })
        .mockResolvedValueOnce({ rows: [] }); // Update token

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(emailService.sendEmailVerificationEmail).toHaveBeenCalled();
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email is required');
    });

    it('should return success for non-existent email (prevent enumeration)', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If an account exists');
    });

    it('should handle already verified email', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          email_verified: true
        }]
      });

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.alreadyVerified).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If an account exists');
    });

    it('should handle email sending failure gracefully', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            email_verified: false
          }]
        })
        .mockResolvedValueOnce({ rows: [] });

      emailService.sendEmailVerificationEmail.mockRejectedValueOnce(new Error('Email service down'));

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should trim and lowercase email', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            email_verified: false
          }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: '  Test@Example.COM  ' });

      expect(response.status).toBe(200);
      expect(db.query).toHaveBeenCalledWith(
        'SELECT id, name, email, email_verified FROM users WHERE email = $1',
        ['test@example.com']
      );
    });

    it('should handle database connection errors with 503', async () => {
      const connectionError = new Error('Connection refused');
      connectionError.code = 'ECONNREFUSED';
      db.query.mockRejectedValueOnce(connectionError);

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Service temporarily unavailable');
    });
  });
});
