/**
 * Two-Factor Authentication (2FA) Routes Tests
 * Tests for TOTP-based 2FA with backup codes
 */

const express = require('express');
const request = require('supertest');

// Mock dependencies
jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(() => ({
    base32: 'MOCKBASE32SECRET',
    otpauth_url: 'otpauth://totp/BotBuilder:test@example.com?secret=MOCKBASE32SECRET&issuer=BotBuilder'
  })),
  totp: {
    verify: jest.fn()
  }
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mockqrcode')
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn()
}));

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 'user-1', email: 'test@example.com' };
  next();
}));

jest.mock('../../services/ai/encryptionHelper', () => ({
  encrypt: jest.fn((val) => `encrypted_${val}`),
  decrypt: jest.fn((val) => val.replace('encrypted_', ''))
}));

jest.mock('../../middleware/audit', () => ({
  auditLog: jest.fn().mockResolvedValue(true),
  getIpAddress: jest.fn(() => '127.0.0.1'),
  getUserAgent: jest.fn(() => 'Test Browser')
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const speakeasy = require('speakeasy');
const bcrypt = require('bcryptjs');
const db = require('../../db');
const EncryptionHelper = require('../../services/ai/encryptionHelper');
const twoFactorRouter = require('../../routes/twoFactor');

describe('Two-Factor Authentication Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/auth/2fa', twoFactorRouter);
  });

  describe('GET /api/auth/2fa/status', () => {
    it('should return 2FA status as enabled', async () => {
      db.query.mockResolvedValue({ rows: [{ two_factor_enabled: true }] });

      const response = await request(app).get('/api/auth/2fa/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.enabled).toBe(true);
    });

    it('should return 2FA status as disabled', async () => {
      db.query.mockResolvedValue({ rows: [{ two_factor_enabled: false }] });

      const response = await request(app).get('/api/auth/2fa/status');

      expect(response.status).toBe(200);
      expect(response.body.enabled).toBe(false);
    });

    it('should return 2FA status as disabled when null', async () => {
      db.query.mockResolvedValue({ rows: [{ two_factor_enabled: null }] });

      const response = await request(app).get('/api/auth/2fa/status');

      expect(response.status).toBe(200);
      expect(response.body.enabled).toBe(false);
    });

    it('should return 404 for non-existent user', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get('/api/auth/2fa/status');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/auth/2fa/status');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
    });
  });

  describe('POST /api/auth/2fa/setup', () => {
    it('should setup 2FA and return QR code', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ email: 'test@example.com', two_factor_enabled: false }] })
        .mockResolvedValueOnce({ rows: [] }) // Update secret
        .mockResolvedValue({ rows: [] }); // Insert backup codes

      const response = await request(app).post('/api/auth/2fa/setup');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.secret).toBeDefined();
      expect(response.body.qrCode).toContain('data:image/png');
      expect(response.body.backupCodes).toHaveLength(10);
    });

    it('should return 404 for non-existent user', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app).post('/api/auth/2fa/setup');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });

    it('should return 400 if 2FA is already enabled', async () => {
      db.query.mockResolvedValue({ rows: [{ email: 'test@example.com', two_factor_enabled: true }] });

      const response = await request(app).post('/api/auth/2fa/setup');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already enabled');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app).post('/api/auth/2fa/setup');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/auth/2fa/verify', () => {
    it('should verify code and enable 2FA', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ two_factor_secret: 'encrypted_SECRET', two_factor_enabled: false }] })
        .mockResolvedValueOnce({ rows: [] }); // Enable 2FA
      speakeasy.totp.verify.mockReturnValue(true);

      const response = await request(app)
        .post('/api/auth/2fa/verify')
        .send({ code: '123456' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('enabled successfully');
    });

    it('should return 400 if code is missing', async () => {
      const response = await request(app).post('/api/auth/2fa/verify').send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Verification code required');
    });

    it('should return 404 for non-existent user', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/auth/2fa/verify')
        .send({ code: '123456' });

      expect(response.status).toBe(404);
    });

    it('should return 400 if no secret is set up', async () => {
      db.query.mockResolvedValue({ rows: [{ two_factor_secret: null }] });

      const response = await request(app)
        .post('/api/auth/2fa/verify')
        .send({ code: '123456' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('set up 2FA first');
    });

    it('should return 400 for invalid code', async () => {
      db.query.mockResolvedValue({ rows: [{ two_factor_secret: 'encrypted_SECRET', two_factor_enabled: false }] });
      speakeasy.totp.verify.mockReturnValue(false);

      const response = await request(app)
        .post('/api/auth/2fa/verify')
        .send({ code: '000000' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid verification code');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/2fa/verify')
        .send({ code: '123456' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/auth/2fa/validate', () => {
    it('should validate TOTP code during login', async () => {
      db.query.mockResolvedValue({ rows: [{ two_factor_secret: 'encrypted_SECRET', two_factor_enabled: true }] });
      speakeasy.totp.verify.mockReturnValue(true);

      const response = await request(app)
        .post('/api/auth/2fa/validate')
        .send({ userId: 'user-1', code: '123456' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('2FA validated successfully');
    });

    it('should return 400 if userId is missing', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/validate')
        .send({ code: '123456' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('User ID and code required');
    });

    it('should return 400 if code is missing', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/validate')
        .send({ userId: 'user-1' });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent user', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/auth/2fa/validate')
        .send({ userId: 'user-1', code: '123456' });

      expect(response.status).toBe(404);
    });

    it('should return 400 if 2FA is not enabled', async () => {
      db.query.mockResolvedValue({ rows: [{ two_factor_secret: 'encrypted_SECRET', two_factor_enabled: false }] });

      const response = await request(app)
        .post('/api/auth/2fa/validate')
        .send({ userId: 'user-1', code: '123456' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('2FA is not enabled');
    });

    it('should accept backup code when TOTP fails', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ two_factor_secret: 'encrypted_SECRET', two_factor_enabled: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 'backup-1' }] }) // Backup code found
        .mockResolvedValueOnce({ rows: [] }); // Mark as used

      speakeasy.totp.verify.mockReturnValue(false);

      const response = await request(app)
        .post('/api/auth/2fa/validate')
        .send({ userId: 'user-1', code: 'ABCD1234' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 for invalid code when no backup matches', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ two_factor_secret: 'encrypted_SECRET', two_factor_enabled: true }] })
        .mockResolvedValueOnce({ rows: [] }); // No backup code found

      speakeasy.totp.verify.mockReturnValue(false);

      const response = await request(app)
        .post('/api/auth/2fa/validate')
        .send({ userId: 'user-1', code: '000000' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid 2FA code');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/2fa/validate')
        .send({ userId: 'user-1', code: '123456' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/auth/2fa/disable', () => {
    it('should disable 2FA with valid password', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ password_hash: 'hashedpw', two_factor_secret: 'encrypted_SECRET', two_factor_enabled: true }] })
        .mockResolvedValueOnce({ rows: [] }) // Disable 2FA
        .mockResolvedValueOnce({ rows: [] }); // Delete backup codes
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/2fa/disable')
        .send({ password: 'correctpassword' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('disabled');
    });

    it('should return 400 if password is missing', async () => {
      const response = await request(app).post('/api/auth/2fa/disable').send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Password required');
    });

    it('should return 404 for non-existent user', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/auth/2fa/disable')
        .send({ password: 'test' });

      expect(response.status).toBe(404);
    });

    it('should return 401 for invalid password', async () => {
      db.query.mockResolvedValue({ rows: [{ password_hash: 'hashedpw', two_factor_enabled: true }] });
      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/2fa/disable')
        .send({ password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid password');
    });

    it('should return 400 if 2FA is not enabled', async () => {
      db.query.mockResolvedValue({ rows: [{ password_hash: 'hashedpw', two_factor_enabled: false }] });
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/2fa/disable')
        .send({ password: 'correctpassword' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('2FA is not enabled');
    });

    it('should verify 2FA code if provided', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ password_hash: 'hashedpw', two_factor_secret: 'encrypted_SECRET', two_factor_enabled: true }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      bcrypt.compare.mockResolvedValue(true);
      speakeasy.totp.verify.mockReturnValue(true);

      const response = await request(app)
        .post('/api/auth/2fa/disable')
        .send({ password: 'correctpassword', code: '123456' });

      expect(response.status).toBe(200);
      expect(speakeasy.totp.verify).toHaveBeenCalled();
    });

    it('should return 400 for invalid 2FA code', async () => {
      db.query.mockResolvedValue({ rows: [{ password_hash: 'hashedpw', two_factor_secret: 'encrypted_SECRET', two_factor_enabled: true }] });
      bcrypt.compare.mockResolvedValue(true);
      speakeasy.totp.verify.mockReturnValue(false);

      const response = await request(app)
        .post('/api/auth/2fa/disable')
        .send({ password: 'correctpassword', code: '000000' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid 2FA code');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/2fa/disable')
        .send({ password: 'test' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/auth/2fa/backup-codes/regenerate', () => {
    it('should regenerate backup codes', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ two_factor_secret: 'encrypted_SECRET', two_factor_enabled: true }] })
        .mockResolvedValueOnce({ rows: [] }) // Delete old codes
        .mockResolvedValue({ rows: [] }); // Insert new codes
      speakeasy.totp.verify.mockReturnValue(true);

      const response = await request(app)
        .post('/api/auth/2fa/backup-codes/regenerate')
        .send({ code: '123456' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.backupCodes).toHaveLength(10);
      expect(response.body.message).toContain('Store these safely');
    });

    it('should return 400 if code is missing', async () => {
      const response = await request(app).post('/api/auth/2fa/backup-codes/regenerate').send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('2FA code required');
    });

    it('should return 400 if 2FA is not enabled', async () => {
      db.query.mockResolvedValue({ rows: [{ two_factor_enabled: false }] });

      const response = await request(app)
        .post('/api/auth/2fa/backup-codes/regenerate')
        .send({ code: '123456' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('2FA is not enabled');
    });

    it('should return 400 for invalid code', async () => {
      db.query.mockResolvedValue({ rows: [{ two_factor_secret: 'encrypted_SECRET', two_factor_enabled: true }] });
      speakeasy.totp.verify.mockReturnValue(false);

      const response = await request(app)
        .post('/api/auth/2fa/backup-codes/regenerate')
        .send({ code: '000000' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid 2FA code');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/2fa/backup-codes/regenerate')
        .send({ code: '123456' });

      expect(response.status).toBe(500);
    });
  });
});
