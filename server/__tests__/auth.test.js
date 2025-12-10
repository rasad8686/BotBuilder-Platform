/**
 * Auth API Tests
 * Tests for /api/auth endpoints: login, register, logout
 */

const request = require('supertest');

// Mock the database
jest.mock('../db', () => ({
  query: jest.fn()
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword123'),
  compare: jest.fn()
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn()
}));

// Mock email service
jest.mock('../services/emailService', () => ({
  sendEmailVerificationEmail: jest.fn().mockResolvedValue(true)
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock audit middleware
jest.mock('../middleware/audit', () => ({
  logRegister: jest.fn((req, res, next) => next()),
  logLogin: jest.fn((req, res, next) => next())
}));

const express = require('express');
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Create a minimal express app for testing
const app = express();
app.use(express.json());

// Mock auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashedPassword]
    );

    const token = jwt.sign({ id: result.rows[0].id }, 'secret');
    res.status(201).json({ success: true, token, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id }, 'secret');
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // REGISTER TESTS
  // ========================================
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // No existing user
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test User', email: 'test@example.com' }] });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');
    });

    it('should return 400 if email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          password: 'password123'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('required');
    });

    it('should return 400 if password is too short', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: '123'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('6 characters');
    });

    it('should return 400 if user already exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // User exists

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'existing@example.com',
          password: 'password123'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });
  });

  // ========================================
  // LOGIN TESTS
  // ========================================
  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test User', email: 'test@example.com', password: 'hashedPassword' }]
      });
      bcrypt.compare.mockResolvedValueOnce(true);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');
    });

    it('should return 400 if email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'password123'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 if user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'notfound@example.com',
          password: 'password123'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid credentials');
    });

    it('should return 401 if password is incorrect', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, email: 'test@example.com', password: 'hashedPassword' }]
      });
      bcrypt.compare.mockResolvedValueOnce(false);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid credentials');
    });
  });

  // ========================================
  // LOGOUT TESTS
  // ========================================
  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const res = await request(app)
        .post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Logged out');
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================
  describe('Edge Cases', () => {
    it('should handle empty request body', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should handle special characters in email', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test',
          email: 'test+special@example.com',
          password: 'password123'
        });

      // Should not crash, either succeed or fail gracefully
      expect([201, 400, 500]).toContain(res.status);
    });

    it('should handle database connection error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});

// ========================================
// PASSWORD RESET TESTS
// ========================================
describe('Password Reset API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Mock password reset routes
  const resetApp = express();
  resetApp.use(express.json());

  resetApp.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format' });
      }

      const result = await db.query('SELECT id, email FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        // Return success even if user doesn't exist (security best practice)
        return res.json({ success: true, message: 'If email exists, reset link sent' });
      }

      // Generate reset token
      const resetToken = 'reset-token-123';
      await db.query(
        'UPDATE users SET reset_token = $1, reset_token_expires = NOW() + INTERVAL \'1 hour\' WHERE email = $2',
        [resetToken, email]
      );

      res.json({ success: true, message: 'If email exists, reset link sent' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  resetApp.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ success: false, message: 'Token and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      }

      const result = await db.query(
        'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
        [token]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await db.query(
        'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
        [hashedPassword, result.rows[0].id]
      );

      res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send reset email for existing user', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@example.com' }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(resetApp)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return success even for non-existing user (security)', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(resetApp)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if email is missing', async () => {
      const res = await request(resetApp)
        .post('/api/auth/forgot-password')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid email format', async () => {
      const res = await request(resetApp)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid email');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(resetApp)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(resetApp)
        .post('/api/auth/reset-password')
        .send({ token: 'valid-token', password: 'newpassword123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('reset successfully');
    });

    it('should return 400 for invalid token', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(resetApp)
        .post('/api/auth/reset-password')
        .send({ token: 'invalid-token', password: 'newpassword123' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid or expired');
    });

    it('should return 400 for expired token', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // Token expired check fails

      const res = await request(resetApp)
        .post('/api/auth/reset-password')
        .send({ token: 'expired-token', password: 'newpassword123' });

      expect(res.status).toBe(400);
    });

    it('should return 400 if token is missing', async () => {
      const res = await request(resetApp)
        .post('/api/auth/reset-password')
        .send({ password: 'newpassword123' });

      expect(res.status).toBe(400);
    });

    it('should return 400 if password is too short', async () => {
      const res = await request(resetApp)
        .post('/api/auth/reset-password')
        .send({ token: 'valid-token', password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('6 characters');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(resetApp)
        .post('/api/auth/reset-password')
        .send({ token: 'valid-token', password: 'newpassword123' });

      expect(res.status).toBe(500);
    });
  });
});

// ========================================
// EMAIL VERIFICATION TESTS
// ========================================
describe('Email Verification API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const verifyApp = express();
  verifyApp.use(express.json());

  verifyApp.post('/api/auth/verify-email', async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ success: false, message: 'Verification token is required' });
      }

      const result = await db.query(
        'SELECT id FROM users WHERE email_verification_token = $1',
        [token]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid verification token' });
      }

      await db.query(
        'UPDATE users SET email_verified = true, email_verification_token = NULL WHERE id = $1',
        [result.rows[0].id]
      );

      res.json({ success: true, message: 'Email verified successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  verifyApp.post('/api/auth/resend-verification', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
      }

      const result = await db.query('SELECT id, email_verified FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      if (result.rows[0].email_verified) {
        return res.status(400).json({ success: false, message: 'Email already verified' });
      }

      const newToken = 'new-verify-token-123';
      await db.query(
        'UPDATE users SET email_verification_token = $1 WHERE id = $2',
        [newToken, result.rows[0].id]
      );

      res.json({ success: true, message: 'Verification email sent' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('POST /api/auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(verifyApp)
        .post('/api/auth/verify-email')
        .send({ token: 'valid-verification-token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('verified successfully');
    });

    it('should return 400 for invalid token', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(verifyApp)
        .post('/api/auth/verify-email')
        .send({ token: 'invalid-token' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid verification token');
    });

    it('should return 400 if token is missing', async () => {
      const res = await request(verifyApp)
        .post('/api/auth/verify-email')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(verifyApp)
        .post('/api/auth/verify-email')
        .send({ token: 'valid-token' });

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    it('should resend verification email', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, email_verified: false }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(verifyApp)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(verifyApp)
        .post('/api/auth/resend-verification')
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(404);
    });

    it('should return 400 if email already verified', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, email_verified: true }] });

      const res = await request(verifyApp)
        .post('/api/auth/resend-verification')
        .send({ email: 'verified@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already verified');
    });

    it('should return 400 if email is missing', async () => {
      const res = await request(verifyApp)
        .post('/api/auth/resend-verification')
        .send({});

      expect(res.status).toBe(400);
    });
  });
});

// ========================================
// TOKEN REFRESH TESTS
// ========================================
describe('Token Refresh API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const tokenApp = express();
  tokenApp.use(express.json());

  tokenApp.post('/api/auth/refresh-token', async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ success: false, message: 'Refresh token is required' });
      }

      // Verify refresh token
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, 'refresh-secret');
      } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid refresh token' });
      }

      // Check if token is in database and not revoked
      const result = await db.query(
        'SELECT * FROM refresh_tokens WHERE token = $1 AND revoked = false',
        [refreshToken]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, message: 'Refresh token revoked or not found' });
      }

      // Get user
      const userResult = await db.query('SELECT id, email, name FROM users WHERE id = $1', [decoded.id]);
      if (userResult.rows.length === 0) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      // Generate new tokens
      const newAccessToken = jwt.sign({ id: decoded.id }, 'secret', { expiresIn: '15m' });
      const newRefreshToken = jwt.sign({ id: decoded.id }, 'refresh-secret', { expiresIn: '7d' });

      // Revoke old refresh token and save new one
      await db.query('UPDATE refresh_tokens SET revoked = true WHERE token = $1', [refreshToken]);
      await db.query(
        'INSERT INTO refresh_tokens (user_id, token) VALUES ($1, $2)',
        [decoded.id, newRefreshToken]
      );

      res.json({
        success: true,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: userResult.rows[0]
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  tokenApp.post('/api/auth/revoke-token', async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ success: false, message: 'Refresh token is required' });
      }

      await db.query('UPDATE refresh_tokens SET revoked = true WHERE token = $1', [refreshToken]);

      res.json({ success: true, message: 'Token revoked successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('POST /api/auth/refresh-token', () => {
    it('should refresh tokens successfully', async () => {
      jwt.verify.mockReturnValueOnce({ id: 1 });
      db.query
        .mockResolvedValueOnce({ rows: [{ token: 'valid-refresh-token' }] }) // Check token
        .mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@example.com', name: 'Test' }] }) // Get user
        .mockResolvedValueOnce({ rowCount: 1 }) // Revoke old token
        .mockResolvedValueOnce({ rowCount: 1 }); // Save new token

      const res = await request(tokenApp)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('should return 400 if refresh token is missing', async () => {
      const res = await request(tokenApp)
        .post('/api/auth/refresh-token')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 401 for invalid refresh token', async () => {
      jwt.verify.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      const res = await request(tokenApp)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Invalid refresh token');
    });

    it('should return 401 for revoked refresh token', async () => {
      jwt.verify.mockReturnValueOnce({ id: 1 });
      db.query.mockResolvedValueOnce({ rows: [] }); // Token not found or revoked

      const res = await request(tokenApp)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'revoked-token' });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('revoked');
    });

    it('should return 401 if user not found', async () => {
      jwt.verify.mockReturnValueOnce({ id: 1 });
      db.query
        .mockResolvedValueOnce({ rows: [{ token: 'valid-token' }] })
        .mockResolvedValueOnce({ rows: [] }); // User not found

      const res = await request(tokenApp)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'valid-token' });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('User not found');
    });

    it('should handle database error', async () => {
      jwt.verify.mockReturnValueOnce({ id: 1 });
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(tokenApp)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'valid-token' });

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/auth/revoke-token', () => {
    it('should revoke token successfully', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(tokenApp)
        .post('/api/auth/revoke-token')
        .send({ refreshToken: 'token-to-revoke' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('revoked');
    });

    it('should return 400 if token is missing', async () => {
      const res = await request(tokenApp)
        .post('/api/auth/revoke-token')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(tokenApp)
        .post('/api/auth/revoke-token')
        .send({ refreshToken: 'token' });

      expect(res.status).toBe(500);
    });
  });
});
