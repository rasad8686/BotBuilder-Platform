/**
 * Email Verification Routes Tests
 * Tests for server/routes/emailVerification.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../services/emailService', () => ({
  sendEmailVerificationEmail: jest.fn().mockResolvedValue(true)
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
const emailVerificationRouter = require('../../routes/emailVerification');

const app = express();
app.use(express.json());
app.use('/api/auth', emailVerificationRouter);

describe('Email Verification Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/send-verification', () => {
    it('should send verification email', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/send-verification')
        .send({ userId: 1, email: 'test@example.com', userName: 'Test User' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(emailService.sendEmailVerificationEmail).toHaveBeenCalled();
    });

    it('should reject missing userId', async () => {
      const response = await request(app)
        .post('/api/auth/send-verification')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/api/auth/send-verification')
        .send({ userId: 1 });

      expect(response.status).toBe(400);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .post('/api/auth/send-verification')
        .send({ userId: 1, email: 'test@example.com' });

      expect(response.status).toBe(500);
    });

    it('should continue even if email service fails', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      emailService.sendEmailVerificationEmail.mockRejectedValueOnce(new Error('Email failed'));

      const response = await request(app)
        .post('/api/auth/send-verification')
        .send({ userId: 1, email: 'test@example.com' });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      db.query
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          email_verified: false,
          verification_token_expires_at: futureDate
        }] })
        .mockResolvedValueOnce({ rows: [] }); // Update

      const response = await request(app).get('/api/auth/verify-email?token=validtoken');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.email).toBe('test@example.com');
    });

    it('should reject missing token', async () => {
      const response = await request(app).get('/api/auth/verify-email');

      expect(response.status).toBe(400);
    });

    it('should reject invalid token', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/auth/verify-email?token=invalidtoken');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
    });

    it('should handle already verified email', async () => {
      db.query.mockResolvedValueOnce({ rows: [{
        id: 1,
        email: 'test@example.com',
        email_verified: true
      }] });

      const response = await request(app).get('/api/auth/verify-email?token=token');

      expect(response.status).toBe(200);
      expect(response.body.alreadyVerified).toBe(true);
    });

    it('should reject expired token', async () => {
      db.query.mockResolvedValueOnce({ rows: [{
        id: 1,
        email: 'test@example.com',
        email_verified: false,
        verification_token_expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }] });

      const response = await request(app).get('/api/auth/verify-email?token=expiredtoken');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('expired');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/auth/verify-email?token=token');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    it('should resend verification email', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          email_verified: false
        }] })
        .mockResolvedValueOnce({ rows: [] }); // Update

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
    });

    it('should return success for non-existent email (prevent enumeration)', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(emailService.sendEmailVerificationEmail).not.toHaveBeenCalled();
    });

    it('should handle already verified email', async () => {
      db.query.mockResolvedValueOnce({ rows: [{
        id: 1,
        email: 'test@example.com',
        email_verified: true
      }] });

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.alreadyVerified).toBe(true);
    });

    it('should handle database connection error', async () => {
      const dbError = new Error('Connection refused');
      dbError.code = 'ECONNREFUSED';
      db.query.mockRejectedValueOnce(dbError);

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(503);
    });

    it('should handle other errors gracefully', async () => {
      db.query.mockRejectedValueOnce(new Error('Unknown error'));

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
