/**
 * Email Service Tests
 * Tests for server/services/emailService.js
 */

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

// Store original fetch
const originalFetch = global.fetch;

describe('Email Service', () => {
  let emailService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    // Reset fetch mock
    global.fetch = jest.fn();
    // Clear env vars
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.FRONTEND_URL;
    // Re-require to get fresh instance
    emailService = require('../../services/emailService');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('isConfigured()', () => {
    it('should return false when RESEND_API_KEY not set', () => {
      expect(emailService.isConfigured()).toBe(false);
    });

    it('should return true when RESEND_API_KEY is set', () => {
      jest.resetModules();
      process.env.RESEND_API_KEY = 'test_api_key';
      const configuredService = require('../../services/emailService');

      expect(configuredService.isConfigured()).toBe(true);
    });
  });

  describe('sendEmail()', () => {
    it('should log email in development mode', async () => {
      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
        text: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.dev).toBe(true);
    });

    it('should send email via Resend API when configured', async () => {
      jest.resetModules();
      process.env.RESEND_API_KEY = 'test_api_key';
      const configuredService = require('../../services/emailService');

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email_123' })
      });

      const result = await configuredService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
        text: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('email_123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test_api_key'
          })
        })
      );
    });

    it('should throw error on API failure', async () => {
      jest.resetModules();
      process.env.RESEND_API_KEY = 'test_api_key';
      const configuredService = require('../../services/emailService');

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid email' })
      });

      await expect(configuredService.sendEmail({
        to: 'invalid',
        subject: 'Test',
        html: '<p>Test</p>'
      })).rejects.toThrow('Invalid email');
    });
  });

  describe('sendPasswordResetEmail()', () => {
    it('should send password reset email', async () => {
      const result = await emailService.sendPasswordResetEmail(
        'test@example.com',
        'reset_token_123',
        'John'
      );

      expect(result.success).toBe(true);
    });

    it('should include reset URL with token', async () => {
      jest.resetModules();
      process.env.RESEND_API_KEY = 'test_api_key';
      process.env.FRONTEND_URL = 'http://localhost:3000';
      const configuredService = require('../../services/emailService');

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email_123' })
      });

      await configuredService.sendPasswordResetEmail(
        'test@example.com',
        'reset_token_123',
        'John'
      );

      const callArgs = global.fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.html).toContain('reset_token_123');
      expect(body.html).toContain('Reset Password');
    });

    it('should work without username', async () => {
      const result = await emailService.sendPasswordResetEmail(
        'test@example.com',
        'reset_token_123'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('sendEmailVerificationEmail()', () => {
    it('should send email verification email', async () => {
      const result = await emailService.sendEmailVerificationEmail(
        'test@example.com',
        'verify_token_123',
        'John'
      );

      expect(result.success).toBe(true);
    });

    it('should include verification URL with token', async () => {
      jest.resetModules();
      process.env.RESEND_API_KEY = 'test_api_key';
      process.env.FRONTEND_URL = 'http://localhost:3000';
      const configuredService = require('../../services/emailService');

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email_123' })
      });

      await configuredService.sendEmailVerificationEmail(
        'test@example.com',
        'verify_token_123',
        'John'
      );

      const callArgs = global.fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.html).toContain('verify_token_123');
      expect(body.html).toContain('Verify Email');
    });

    it('should log verification link in dev mode', async () => {
      const log = require('../../utils/logger');

      await emailService.sendEmailVerificationEmail(
        'test@example.com',
        'verify_token_123',
        'John'
      );

      expect(log.info).toHaveBeenCalled();
    });

    it('should work without username', async () => {
      const result = await emailService.sendEmailVerificationEmail(
        'test@example.com',
        'verify_token_123'
      );

      expect(result.success).toBe(true);
    });
  });
});
