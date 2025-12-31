/**
 * Admin Authentication Routes Tests
 * Tests for admin login with enhanced security
 */

const express = require('express');
const request = require('supertest');

// Mock dependencies
jest.mock('bcrypt', () => ({
  compare: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-jwt-token'),
  verify: jest.fn()
}));

jest.mock('speakeasy', () => ({
  totp: {
    verify: jest.fn()
  }
}));

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/requireSuperAdmin', () => ({
  adminLoginRateLimit: jest.fn((req, res, next) => {
    req.logLoginAttempt = jest.fn();
    next();
  }),
  adminIpWhitelist: jest.fn((req, res, next) => next()),
  logAdminAction: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const db = require('../../db');
const { logAdminAction, adminLoginRateLimit } = require('../../middleware/requireSuperAdmin');
const adminAuthRouter = require('../../routes/adminAuth');

describe('Admin Authentication Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/admin-auth', adminAuthRouter);

    // Default mock setup
    db.query.mockResolvedValue({ rows: [] });
  });

  describe('POST /api/admin-auth/login', () => {
    const mockUser = {
      id: 'user-1',
      name: 'Admin User',
      email: 'admin@example.com',
      password_hash: 'hashed_password',
      is_superadmin: true,
      two_factor_enabled: true,
      two_factor_secret: 'secret123',
      email_verified: true
    };

    it('should return 400 if email is missing', async () => {
      const response = await request(app)
        .post('/api/admin-auth/login')
        .send({ password: 'test' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Email and password are required');
    });

    it('should return 400 if password is missing', async () => {
      const response = await request(app)
        .post('/api/admin-auth/login')
        .send({ email: 'admin@example.com' });

      expect(response.status).toBe(400);
    });

    it('should return 401 for non-existent user', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/admin-auth/login')
        .send({ email: 'unknown@example.com', password: 'test' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return 401 for invalid password', async () => {
      db.query.mockResolvedValue({ rows: [mockUser] });
      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/admin-auth/login')
        .send({ email: 'admin@example.com', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return 403 for non-admin user', async () => {
      const regularUser = { ...mockUser, is_superadmin: false };
      db.query
        .mockResolvedValueOnce({ rows: [regularUser] }) // User query
        .mockResolvedValueOnce({ rows: [] }); // Org member query - not admin

      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/admin-auth/login')
        .send({ email: 'user@example.com', password: 'password' });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Admin access required');
    });

    it('should allow org admin to login', async () => {
      const orgAdmin = { ...mockUser, is_superadmin: false };
      db.query
        .mockResolvedValueOnce({ rows: [orgAdmin] }) // User query
        .mockResolvedValueOnce({ rows: [{ role: 'admin', org_id: 'org-1', org_name: 'Test Org' }] }) // Org member query
        .mockResolvedValueOnce({ rows: [] }); // Insert session

      bcrypt.compare.mockResolvedValue(true);
      speakeasy.totp.verify.mockReturnValue(true);

      const response = await request(app)
        .post('/api/admin-auth/login')
        .send({ email: 'admin@example.com', password: 'password', twoFactorCode: '123456' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 403 if 2FA is not enabled', async () => {
      const userWithout2FA = { ...mockUser, two_factor_enabled: false };
      db.query
        .mockResolvedValueOnce({ rows: [userWithout2FA] })
        .mockResolvedValueOnce({ rows: [] });

      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/admin-auth/login')
        .send({ email: 'admin@example.com', password: 'password' });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Two-factor authentication is required');
      expect(response.body.require2FASetup).toBe(true);
    });

    it('should require 2FA code when not provided', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockUser] })
        .mockResolvedValueOnce({ rows: [] });

      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/admin-auth/login')
        .send({ email: 'admin@example.com', password: 'password' });

      expect(response.status).toBe(200);
      expect(response.body.require2FA).toBe(true);
      expect(response.body.message).toContain('2FA code');
    });

    it('should return 401 for invalid 2FA code', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockUser] })
        .mockResolvedValueOnce({ rows: [] });

      bcrypt.compare.mockResolvedValue(true);
      speakeasy.totp.verify.mockReturnValue(false);

      const response = await request(app)
        .post('/api/admin-auth/login')
        .send({ email: 'admin@example.com', password: 'password', twoFactorCode: '000000' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid 2FA code');
    });

    it('should login successfully with valid credentials and 2FA', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockUser] })
        .mockResolvedValueOnce({ rows: [] }) // Org member check
        .mockResolvedValueOnce({ rows: [] }); // Insert session

      bcrypt.compare.mockResolvedValue(true);
      speakeasy.totp.verify.mockReturnValue(true);

      const response = await request(app)
        .post('/api/admin-auth/login')
        .send({ email: 'admin@example.com', password: 'password', twoFactorCode: '123456' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBe('mock-jwt-token');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.isSuperAdmin).toBe(true);
      expect(response.body.expiresAt).toBeDefined();
    });

    it('should log successful admin action', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockUser] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      bcrypt.compare.mockResolvedValue(true);
      speakeasy.totp.verify.mockReturnValue(true);

      await request(app)
        .post('/api/admin-auth/login')
        .send({ email: 'admin@example.com', password: 'password', twoFactorCode: '123456' });

      expect(logAdminAction).toHaveBeenCalledWith(
        'user-1',
        'admin@example.com',
        'ADMIN_LOGIN_SUCCESS',
        'auth',
        null,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle database errors gracefully', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/admin-auth/login')
        .send({ email: 'admin@example.com', password: 'password' });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Login failed. Please try again.');
    });
  });

  describe('POST /api/admin-auth/logout', () => {
    it('should logout without token', async () => {
      const response = await request(app).post('/api/admin-auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should logout with invalid token format', async () => {
      const response = await request(app)
        .post('/api/admin-auth/logout')
        .set('Authorization', 'Bearer');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should logout and invalidate session', async () => {
      jwt.verify.mockReturnValue({ id: 'user-1', email: 'admin@example.com', adminSession: 'session-123' });
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/admin-auth/logout')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Admin session ended');
      expect(logAdminAction).toHaveBeenCalledWith(
        'user-1',
        'admin@example.com',
        'ADMIN_LOGOUT',
        'auth',
        null,
        {},
        expect.any(Object)
      );
    });

    it('should handle expired token gracefully', async () => {
      jwt.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      const response = await request(app)
        .post('/api/admin-auth/logout')
        .set('Authorization', 'Bearer expired-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/admin-auth/session', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/admin-auth/session');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('No token provided');
    });

    it('should return 401 with empty Bearer token', async () => {
      const response = await request(app)
        .get('/api/admin-auth/session')
        .set('Authorization', 'Bearer');

      expect(response.status).toBe(401);
    });

    it('should return 401 for non-admin session token', async () => {
      jwt.verify.mockReturnValue({ id: 'user-1' }); // No adminSession

      const response = await request(app)
        .get('/api/admin-auth/session')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Not an admin session');
    });

    it('should return 401 for expired session', async () => {
      jwt.verify.mockReturnValue({ id: 'user-1', adminSession: 'session-123' });
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/admin-auth/session')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Session expired or invalid');
    });

    it('should return session data for valid session', async () => {
      jwt.verify.mockReturnValue({ id: 'user-1', adminSession: 'session-123' });
      db.query.mockResolvedValue({
        rows: [{
          user_id: 'user-1',
          name: 'Admin User',
          email: 'admin@example.com',
          is_superadmin: true,
          expires_at: new Date(),
          created_at: new Date()
        }]
      });

      const response = await request(app)
        .get('/api/admin-auth/session')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.isAdmin).toBe(true);
      expect(response.body.data.session).toBeDefined();
    });

    it('should return 401 for invalid JWT', async () => {
      jwt.verify.mockImplementation(() => {
        const error = new Error('Invalid token');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      const response = await request(app)
        .get('/api/admin-auth/session')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('should return 401 for expired JWT', async () => {
      jwt.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      const response = await request(app)
        .get('/api/admin-auth/session')
        .set('Authorization', 'Bearer expired-token');

      expect(response.status).toBe(401);
    });

    it('should handle database errors', async () => {
      jwt.verify.mockReturnValue({ id: 'user-1', adminSession: 'session-123' });
      db.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/admin-auth/session')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Session verification failed');
    });
  });

  describe('GET /api/admin-auth/check-2fa/:email', () => {
    it('should return has2FA true when enabled', async () => {
      db.query.mockResolvedValue({ rows: [{ two_factor_enabled: true }] });

      const response = await request(app).get('/api/admin-auth/check-2fa/admin@example.com');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.has2FA).toBe(true);
    });

    it('should return has2FA false when disabled', async () => {
      db.query.mockResolvedValue({ rows: [{ two_factor_enabled: false }] });

      const response = await request(app).get('/api/admin-auth/check-2fa/admin@example.com');

      expect(response.status).toBe(200);
      expect(response.body.has2FA).toBe(false);
    });

    it('should return has2FA false for non-existent user (security)', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get('/api/admin-auth/check-2fa/unknown@example.com');

      expect(response.status).toBe(200);
      expect(response.body.has2FA).toBe(false);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/admin-auth/check-2fa/admin@example.com');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to check 2FA status');
    });
  });
});
