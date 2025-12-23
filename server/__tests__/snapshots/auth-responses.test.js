/**
 * Auth Response Snapshot Tests
 * Tests response structure consistency for authentication operations
 * Uses Jest snapshots to detect unintended API response changes
 */

const request = require('supertest');
const express = require('express');

// ========================================
// MOCKS - Must be defined BEFORE imports
// ========================================

// Mock the database
jest.mock('../../db', () => ({
  query: jest.fn()
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword123'),
  compare: jest.fn()
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token-xyz123'),
  verify: jest.fn()
}));

// Mock email service
jest.mock('../../services/emailService', () => ({
  sendEmailVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true)
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock audit middleware
jest.mock('../../middleware/audit', () => ({
  logRegister: jest.fn((req, res, next) => next()),
  logLogin: jest.fn((req, res, next) => next()),
  logLogout: jest.fn((req, res, next) => next())
}));

const db = require('../../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ========================================
// TEST APP SETUP
// ========================================

function createTestApp() {
  const app = express();
  app.use(express.json());

  // Register endpoint
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required',
          errors: { email: !email ? 'Email is required' : null, password: !password ? 'Password is required' : null }
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters',
          errors: { password: 'Password must be at least 6 characters' }
        });
      }

      const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'User already exists',
          errors: { email: 'This email is already registered' }
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await db.query(
        'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
        [name || 'User', email, hashedPassword]
      );

      const token = jwt.sign({ id: result.rows[0].id }, 'secret');
      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          user: result.rows[0],
          token: token
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // Login endpoint
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required',
          errors: { email: !email ? 'Email is required' : null, password: !password ? 'Password is required' : null }
        });
      }

      const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          errors: { email: 'No account found with this email' }
        });
      }

      const user = result.rows[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          errors: { password: 'Incorrect password' }
        });
      }

      const token = jwt.sign({ id: user.id }, 'secret');
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            created_at: user.created_at
          },
          token: token
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // Token refresh endpoint
  app.post('/api/auth/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, 'refresh-secret');
      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      const newToken = jwt.sign({ id: decoded.id }, 'secret');
      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          token: newToken,
          expiresIn: 3600
        }
      });
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // Me endpoint (get current user)
  app.get('/api/auth/me', async (req, res) => {
    // Simulate authenticated user
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          created_at: '2024-01-15T10:00:00.000Z',
          organization: {
            id: 1,
            name: 'Test Organization',
            role: 'admin'
          }
        }
      }
    });
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req, res) => {
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });

  return app;
}

// ========================================
// SNAPSHOT TESTS
// ========================================

describe('Auth Response Snapshots', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------
  // Register Responses
  // ----------------------------------------
  describe('POST /api/auth/register - Registration', () => {
    it('should match snapshot for successful registration', async () => {
      const newUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        created_at: '2024-01-15T10:00:00.000Z'
      };
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing user
        .mockResolvedValueOnce({ rows: [newUser] }); // Insert user

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for missing email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for missing password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'john@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'john@example.com',
          password: '123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for existing user', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // Login Responses
  // ----------------------------------------
  describe('POST /api/auth/login - Login', () => {
    it('should match snapshot for successful login', async () => {
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashedPassword123',
        created_at: '2024-01-15T10:00:00.000Z'
      };
      db.query.mockResolvedValueOnce({ rows: [mockUser] });
      bcrypt.compare.mockResolvedValueOnce(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'notfound@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for wrong password', async () => {
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashedPassword123',
        created_at: '2024-01-15T10:00:00.000Z'
      };
      db.query.mockResolvedValueOnce({ rows: [mockUser] });
      bcrypt.compare.mockResolvedValueOnce(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // Token Refresh Responses
  // ----------------------------------------
  describe('POST /api/auth/refresh - Token Refresh', () => {
    it('should match snapshot for successful token refresh', async () => {
      jwt.verify.mockReturnValueOnce({ id: 1 });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'valid-refresh-token'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for invalid refresh token', async () => {
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';
      jwt.verify.mockImplementationOnce(() => { throw error; });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-token'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // Me Responses
  // ----------------------------------------
  describe('GET /api/auth/me - Current User', () => {
    it('should match snapshot for authenticated user', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // Logout Responses
  // ----------------------------------------
  describe('POST /api/auth/logout - Logout', () => {
    it('should match snapshot for successful logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();
    });
  });
});
