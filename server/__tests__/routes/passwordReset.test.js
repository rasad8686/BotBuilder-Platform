/**
 * Password Reset Routes Tests
 * Tests for server/routes/passwordReset.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true)
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword123')
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const db = require('../../db');
const emailService = require('../../services/emailService');
const passwordResetRouter = require('../../routes/passwordReset');

const app = express();
app.use(express.json());
app.use('/api/auth', passwordResetRouter);

describe('Password Reset Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send reset email for existing user', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test User', email: 'test@example.com' }] })
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
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Email is required');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(500);
    });

    it('should continue even if email service fails', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test', email: 'test@example.com' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      emailService.sendPasswordResetEmail.mockRejectedValueOnce(new Error('Email failed'));

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/auth/verify-reset-token', () => {
    it('should verify valid token', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      db.query.mockResolvedValueOnce({ rows: [{
        id: 1,
        user_id: 1,
        expires_at: futureDate,
        used_at: null,
        email: 'test@example.com'
      }] });

      const response = await request(app).get('/api/auth/verify-reset-token?token=validtoken123');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.email).toBe('test@example.com');
    });

    it('should reject missing token', async () => {
      const response = await request(app).get('/api/auth/verify-reset-token');

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
    });

    it('should reject invalid token', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/auth/verify-reset-token?token=invalidtoken');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
    });

    it('should reject used token', async () => {
      db.query.mockResolvedValueOnce({ rows: [{
        id: 1,
        user_id: 1,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        used_at: new Date(),
        email: 'test@example.com'
      }] });

      const response = await request(app).get('/api/auth/verify-reset-token?token=usedtoken');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toContain('already been used');
    });

    it('should reject expired token', async () => {
      db.query.mockResolvedValueOnce({ rows: [{
        id: 1,
        user_id: 1,
        expires_at: new Date(Date.now() - 60 * 60 * 1000), // Past date
        used_at: null,
        email: 'test@example.com'
      }] });

      const response = await request(app).get('/api/auth/verify-reset-token?token=expiredtoken');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toContain('expired');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/auth/verify-reset-token?token=token');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      db.query
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          user_id: 1,
          expires_at: futureDate,
          used_at: null,
          email: 'test@example.com',
          name: 'Test User'
        }] })
        .mockResolvedValueOnce({ rows: [] }) // Update password
        .mockResolvedValueOnce({ rows: [] }); // Mark token as used

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'validtoken', password: 'newpassword123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject missing token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ password: 'newpassword123' });

      expect(response.status).toBe(400);
    });

    it('should reject missing password', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'validtoken' });

      expect(response.status).toBe(400);
    });

    it('should reject short password', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'validtoken', password: 'short' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('at least 8 characters');
    });

    it('should reject invalid token', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'invalidtoken', password: 'newpassword123' });

      expect(response.status).toBe(400);
    });

    it('should reject used token', async () => {
      db.query.mockResolvedValueOnce({ rows: [{
        id: 1,
        user_id: 1,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        used_at: new Date()
      }] });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'usedtoken', password: 'newpassword123' });

      expect(response.status).toBe(400);
    });

    it('should reject expired token', async () => {
      db.query.mockResolvedValueOnce({ rows: [{
        id: 1,
        user_id: 1,
        expires_at: new Date(Date.now() - 60 * 60 * 1000),
        used_at: null
      }] });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'expiredtoken', password: 'newpassword123' });

      expect(response.status).toBe(400);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'token', password: 'newpassword123' });

      expect(response.status).toBe(500);
    });
  });
});
