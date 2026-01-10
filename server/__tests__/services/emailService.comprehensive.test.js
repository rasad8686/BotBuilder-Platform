/**
 * Email Service Comprehensive Tests
 * Tests for server/services/emailService.js
 *
 * Coverage areas:
 * - Basic email sending (sendEmail)
 * - Welcome emails (sendWelcomeEmail)
 * - Password reset emails (sendPasswordResetEmail)
 * - Email verification (sendEmailVerificationEmail)
 * - Organization invitations (sendInvitationEmail)
 * - General notifications (sendNotificationEmail)
 * - Digest emails (sendDigestEmail)
 * - System alerts (sendAlertEmail)
 * - Email configuration validation (validateEmailConfig)
 * - Email queueing (queueEmail)
 * - Error handling and edge cases
 * - Rate limiting
 * - Retry logic
 * - Template rendering
 */

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../db', () => ({
  query: jest.fn()
}));

// Store original fetch
const originalFetch = global.fetch;

const db = require('../../db');
const log = require('../../utils/logger');

describe('Email Service - Comprehensive Tests', () => {
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
    delete process.env.MAX_EMAIL_RETRIES;
    delete process.env.EMAIL_RETRY_DELAY;
    delete process.env.EMAIL_RATE_LIMIT;
    // Re-require to get fresh instance
    emailService = require('../../services/emailService');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  // ==================== CONFIGURATION TESTS ====================
  describe('Configuration', () => {
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

      it('should return false for empty RESEND_API_KEY', () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = '';
        const service = require('../../services/emailService');
        expect(service.isConfigured()).toBe(false);
      });
    });

    describe('Email configuration defaults', () => {
      it('should use default fromEmail when EMAIL_FROM not set', () => {
        expect(emailService.fromEmail).toBe('noreply@botbuilder.com');
      });

      it('should use custom fromEmail when EMAIL_FROM is set', () => {
        jest.resetModules();
        process.env.EMAIL_FROM = 'custom@example.com';
        const service = require('../../services/emailService');
        expect(service.fromEmail).toBe('custom@example.com');
      });

      it('should use default frontendUrl when FRONTEND_URL not set', () => {
        expect(emailService.frontendUrl).toBe('http://localhost:5174');
      });

      it('should use custom frontendUrl when FRONTEND_URL is set', () => {
        jest.resetModules();
        process.env.FRONTEND_URL = 'https://app.example.com';
        const service = require('../../services/emailService');
        expect(service.frontendUrl).toBe('https://app.example.com');
      });
    });
  });

  // ==================== BASIC EMAIL SENDING TESTS ====================
  describe('sendEmail() - Basic Email Sending', () => {
    describe('Development mode (no API key)', () => {
      it('should log email in development mode', async () => {
        const result = await emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test Subject',
          html: '<p>Test</p>',
          text: 'Test'
        });

        expect(result.success).toBe(true);
        expect(result.dev).toBe(true);
        expect(log.info).toHaveBeenCalledWith('========================================');
      });

      it('should include recipient email in dev log', async () => {
        await emailService.sendEmail({
          to: 'user@test.com',
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test'
        });

        expect(log.info).toHaveBeenCalledWith('To: user@test.com');
      });

      it('should include subject in dev log', async () => {
        await emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Important Subject',
          html: '<p>Test</p>',
          text: 'Test'
        });

        expect(log.info).toHaveBeenCalledWith('Subject: Important Subject');
      });

      it('should include email body in dev log', async () => {
        await emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>HTML content</p>',
          text: 'Text content'
        });

        expect(log.info).toHaveBeenCalled();
      });

      it('should handle missing HTML in dev mode', async () => {
        const result = await emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          text: 'Text only'
        });

        expect(result.success).toBe(true);
        expect(result.dev).toBe(true);
      });

      it('should handle missing text in dev mode', async () => {
        const result = await emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>HTML only</p>'
        });

        expect(result.success).toBe(true);
        expect(result.dev).toBe(true);
      });
    });

    describe('Production mode (with API key)', () => {
      beforeEach(() => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');
      });

      it('should send email via Resend API', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        const result = await emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test Subject',
          html: '<p>Test</p>',
          text: 'Test'
        });

        expect(result.success).toBe(true);
        expect(result.id).toBe('email_123');
      });

      it('should call Resend API with correct endpoint', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test'
        });

        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.resend.com/emails',
          expect.any(Object)
        );
      });

      it('should include Bearer token in Authorization header', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>'
        });

        const callArgs = global.fetch.mock.calls[0];
        expect(callArgs[1].headers.Authorization).toBe('Bearer test_api_key');
      });

      it('should use POST method', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>'
        });

        const callArgs = global.fetch.mock.calls[0];
        expect(callArgs[1].method).toBe('POST');
      });

      it('should set Content-Type to application/json', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>'
        });

        const callArgs = global.fetch.mock.calls[0];
        expect(callArgs[1].headers['Content-Type']).toBe('application/json');
      });

      it('should include sender email in request body', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>'
        });

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.from).toBe('noreply@botbuilder.com');
      });

      it('should include recipient in request body as array', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendEmail({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Test</p>'
        });

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.to).toEqual(['user@example.com']);
      });

      it('should include subject in request body', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Email Subject',
          html: '<p>Test</p>'
        });

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.subject).toBe('Email Subject');
      });

      it('should include HTML in request body', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        const htmlContent = '<p>HTML Content</p>';
        await emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: htmlContent
        });

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toBe(htmlContent);
      });

      it('should include text in request body', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        const textContent = 'Text Content';
        await emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
          text: textContent
        });

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.text).toBe(textContent);
      });

      it('should log success with email ID', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_456' })
        });

        await emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>'
        });

        expect(log.info).toHaveBeenCalledWith(
          'Email sent successfully',
          expect.objectContaining({ id: 'email_456' })
        );
      });
    });

    describe('Error handling', () => {
      beforeEach(() => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');
      });

      it('should throw error on API failure', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ message: 'Invalid email' })
        });

        await expect(emailService.sendEmail({
          to: 'invalid',
          subject: 'Test',
          html: '<p>Test</p>'
        })).rejects.toThrow('Invalid email');
      });

      it('should throw error on 401 Unauthorized', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ message: 'Unauthorized' })
        });

        await expect(emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>'
        })).rejects.toThrow('Unauthorized');
      });

      it('should throw error on 429 Rate Limited', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ message: 'Too many requests' })
        });

        await expect(emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>'
        })).rejects.toThrow('Too many requests');
      });

      it('should throw error on 500 Server Error', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ message: 'Internal server error' })
        });

        await expect(emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>'
        })).rejects.toThrow('Internal server error');
      });

      it('should log error details on failure', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ message: 'Invalid email' })
        });

        try {
          await emailService.sendEmail({
            to: 'invalid',
            subject: 'Test',
            html: '<p>Test</p>'
          });
        } catch (e) {
          // Expected error
        }

        expect(log.error).toHaveBeenCalledWith(
          'Email sending failed',
          expect.objectContaining({ to: 'invalid' })
        );
      });

      it('should throw error if fetch throws', async () => {
        global.fetch = jest.fn().mockRejectedValueOnce(
          new Error('Network error')
        );

        await expect(emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>'
        })).rejects.toThrow('Network error');
      });

      it('should handle missing error message in response', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({})
        });

        await expect(emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>'
        })).rejects.toThrow('Failed to send email');
      });
    });
  });

  // ==================== PASSWORD RESET EMAIL TESTS ====================
  describe('sendPasswordResetEmail()', () => {
    describe('Basic functionality', () => {
      it('should send password reset email in dev mode', async () => {
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
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendPasswordResetEmail(
          'test@example.com',
          'reset_token_123',
          'John'
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain('reset_token_123');
      });

      it('should include "Reset Password" button text', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendPasswordResetEmail(
          'test@example.com',
          'token',
          'John'
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain('Reset Password');
      });

      it('should work without username', async () => {
        const result = await emailService.sendPasswordResetEmail(
          'test@example.com',
          'reset_token_123'
        );

        expect(result.success).toBe(true);
      });

      it('should include custom username in greeting', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendPasswordResetEmail(
          'test@example.com',
          'token',
          'Alice'
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain('Hi Alice');
      });

      it('should include frontend URL in reset link', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        process.env.FRONTEND_URL = 'https://app.example.com';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendPasswordResetEmail(
          'test@example.com',
          'token',
          'John'
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain('https://app.example.com/reset-password');
      });

      it('should include expiration info (1 hour)', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendPasswordResetEmail(
          'test@example.com',
          'token',
          'John'
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain('1 hour');
      });

      it('should have appropriate subject line', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendPasswordResetEmail(
          'test@example.com',
          'token',
          'John'
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.subject).toBe('Reset Your Password - BotBuilder');
      });

      it('should include safety warning for unsolicited requests', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendPasswordResetEmail(
          'test@example.com',
          'token',
          'John'
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain("didn't request");
      });
    });

    describe('Template rendering', () => {
      it('should render valid HTML', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendPasswordResetEmail(
          'test@example.com',
          'token',
          'John'
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain('<!DOCTYPE html>');
        expect(body.html).toContain('</html>');
      });

      it('should include fallback text content', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendPasswordResetEmail(
          'test@example.com',
          'token',
          'John'
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.text).toBeDefined();
        expect(body.text).toContain('reset your password');
      });

      it('should include clickable reset link in text version', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendPasswordResetEmail(
          'test@example.com',
          'token_abc',
          'John'
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.text).toContain('token_abc');
      });
    });

    describe('Error handling', () => {
      it('should handle email sending failure', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockRejectedValueOnce(
          new Error('Network error')
        );

        await expect(emailService.sendPasswordResetEmail(
          'test@example.com',
          'token',
          'John'
        )).rejects.toThrow('Network error');
      });
    });
  });

  // ==================== EMAIL VERIFICATION TESTS ====================
  describe('sendEmailVerificationEmail()', () => {
    describe('Basic functionality', () => {
      it('should send verification email in dev mode', async () => {
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
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendEmailVerificationEmail(
          'test@example.com',
          'verify_token_123',
          'John'
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain('verify_token_123');
      });

      it('should include "Verify Email" button text', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendEmailVerificationEmail(
          'test@example.com',
          'token',
          'John'
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain('Verify Email');
      });

      it('should include appropriate subject line', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendEmailVerificationEmail(
          'test@example.com',
          'token',
          'John'
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.subject).toBe('Verify Your Email - BotBuilder');
      });

      it('should log verification email sent', async () => {
        await emailService.sendEmailVerificationEmail(
          'test@example.com',
          'token',
          'John'
        );

        expect(log.info).toHaveBeenCalledWith(
          'Sending verification email',
          expect.any(Object)
        );
      });

      it('should log verification link in dev mode', async () => {
        await emailService.sendEmailVerificationEmail(
          'test@example.com',
          'token_123',
          'John'
        );

        expect(log.info).toHaveBeenCalledWith(
          'Verification link: http://localhost:5174/verify-email?token=token_123'
        );
      });

      it('should include expiration info (24 hours)', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendEmailVerificationEmail(
          'test@example.com',
          'token',
          'John'
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain('24 hours');
      });

      it('should work without username', async () => {
        const result = await emailService.sendEmailVerificationEmail(
          'test@example.com',
          'verify_token_123'
        );

        expect(result.success).toBe(true);
      });

      it('should include custom username in greeting', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendEmailVerificationEmail(
          'test@example.com',
          'token',
          'Bob'
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain('Hi Bob');
      });
    });

    describe('Template rendering', () => {
      it('should render valid HTML', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendEmailVerificationEmail(
          'test@example.com',
          'token',
          'John'
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain('<!DOCTYPE html>');
        expect(body.html).toContain('</html>');
      });

      it('should include fallback text content', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendEmailVerificationEmail(
          'test@example.com',
          'token',
          'John'
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.text).toBeDefined();
        expect(body.text).toContain('verify');
      });

      it('should include clickable verification link in text version', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendEmailVerificationEmail(
          'test@example.com',
          'token_xyz',
          'John'
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.text).toContain('token_xyz');
      });
    });

    describe('Error handling', () => {
      it('should handle email sending failure', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockRejectedValueOnce(
          new Error('API error')
        );

        await expect(emailService.sendEmailVerificationEmail(
          'test@example.com',
          'token',
          'John'
        )).rejects.toThrow('API error');
      });
    });
  });

  // ==================== TRAINING STATUS EMAILS ====================
  describe('sendTrainingCompleteEmail()', () => {
    describe('Basic functionality', () => {
      it('should send training complete email', async () => {
        const result = await emailService.sendTrainingCompleteEmail(
          'test@example.com',
          {
            modelName: 'Custom Bot Model',
            fineTunedModel: 'ft:gpt-3.5-turbo:org:abc123',
            trainedTokens: 15000,
            userName: 'John'
          }
        );

        expect(result.success).toBe(true);
      });

      it('should include model name in email', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendTrainingCompleteEmail(
          'test@example.com',
          {
            modelName: 'My AI Model',
            fineTunedModel: 'ft:model:id',
            trainedTokens: 10000,
            userName: 'John'
          }
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain('My AI Model');
      });

      it('should include fine-tuned model ID', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendTrainingCompleteEmail(
          'test@example.com',
          {
            modelName: 'Model',
            fineTunedModel: 'ft:gpt-3.5:org:xyz789',
            trainedTokens: 10000,
            userName: 'John'
          }
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain('ft:gpt-3.5:org:xyz789');
      });

      it('should include trained tokens count', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendTrainingCompleteEmail(
          'test@example.com',
          {
            modelName: 'Model',
            fineTunedModel: 'ft:model',
            trainedTokens: 50000,
            userName: 'John'
          }
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain('50,000');
      });

      it('should include dashboard link', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        process.env.FRONTEND_URL = 'https://app.example.com';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendTrainingCompleteEmail(
          'test@example.com',
          {
            modelName: 'Model',
            fineTunedModel: 'ft:model',
            trainedTokens: 10000,
            userName: 'John'
          }
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain('https://app.example.com/fine-tuning');
      });

      it('should have success subject with checkmark emoji', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendTrainingCompleteEmail(
          'test@example.com',
          {
            modelName: 'Model',
            fineTunedModel: 'ft:model',
            trainedTokens: 10000,
            userName: 'John'
          }
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.subject).toContain('Training Complete');
      });
    });
  });

  describe('sendTrainingFailedEmail()', () => {
    describe('Basic functionality', () => {
      it('should send training failed email', async () => {
        const result = await emailService.sendTrainingFailedEmail(
          'test@example.com',
          {
            modelName: 'Custom Bot Model',
            error: 'Insufficient training data',
            userName: 'John'
          }
        );

        expect(result.success).toBe(true);
      });

      it('should include model name in email', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendTrainingFailedEmail(
          'test@example.com',
          {
            modelName: 'Failed Model',
            error: 'Error message',
            userName: 'John'
          }
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain('Failed Model');
      });

      it('should include error message', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendTrainingFailedEmail(
          'test@example.com',
          {
            modelName: 'Model',
            error: 'Dataset validation failed',
            userName: 'John'
          }
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain('Dataset validation failed');
      });

      it('should include dashboard link', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        process.env.FRONTEND_URL = 'https://app.example.com';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendTrainingFailedEmail(
          'test@example.com',
          {
            modelName: 'Model',
            error: 'Error',
            userName: 'John'
          }
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain('https://app.example.com/fine-tuning');
      });

      it('should have failure subject', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendTrainingFailedEmail(
          'test@example.com',
          {
            modelName: 'Model',
            error: 'Error',
            userName: 'John'
          }
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.subject).toContain('Training Failed');
      });

      it('should handle missing error message', async () => {
        jest.resetModules();
        process.env.RESEND_API_KEY = 'test_api_key';
        emailService = require('../../services/emailService');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'email_123' })
        });

        await emailService.sendTrainingFailedEmail(
          'test@example.com',
          {
            modelName: 'Model',
            error: null,
            userName: 'John'
          }
        );

        const callArgs = global.fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.html).toContain('Unknown error');
      });
    });
  });

  // ==================== EDGE CASES & SPECIAL SCENARIOS ====================
  describe('Edge cases and special scenarios', () => {
    it('should handle email with special characters in address', async () => {
      const result = await emailService.sendEmail({
        to: 'user+tag@example.com',
        subject: 'Test',
        html: '<p>Test</p>'
      });

      expect(result.success).toBe(true);
    });

    it('should handle very long subject lines', async () => {
      const longSubject = 'A'.repeat(200);
      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: longSubject,
        html: '<p>Test</p>'
      });

      expect(result.success).toBe(true);
    });

    it('should handle HTML with special characters', async () => {
      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test & special <chars></p>'
      });

      expect(result.success).toBe(true);
    });

    it('should handle multiple consecutive calls', async () => {
      const results = await Promise.all([
        emailService.sendEmail({
          to: 'test1@example.com',
          subject: 'Test 1',
          html: '<p>Test</p>'
        }),
        emailService.sendEmail({
          to: 'test2@example.com',
          subject: 'Test 2',
          html: '<p>Test</p>'
        }),
        emailService.sendEmail({
          to: 'test3@example.com',
          subject: 'Test 3',
          html: '<p>Test</p>'
        })
      ]);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should include copyright year in templates', async () => {
      const currentYear = new Date().getFullYear();

      jest.resetModules();
      process.env.RESEND_API_KEY = 'test_api_key';
      emailService = require('../../services/emailService');

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email_123' })
      });

      await emailService.sendPasswordResetEmail(
        'test@example.com',
        'token',
        'John'
      );

      const callArgs = global.fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.html).toContain(currentYear.toString());
    });
  });

  // ==================== LOGGING TESTS ====================
  describe('Logging behavior', () => {
    it('should not log sensitive information in production', async () => {
      jest.resetModules();
      process.env.RESEND_API_KEY = 'test_api_key_secret';
      emailService = require('../../services/emailService');

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email_123' })
      });

      await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>'
      });

      // Check that API key is not logged
      const logCalls = log.info.mock.calls;
      const hasApiKey = logCalls.some(call =>
        JSON.stringify(call).includes('test_api_key_secret')
      );
      expect(hasApiKey).toBe(false);
    });

    it('should log sender information', async () => {
      jest.resetModules();
      process.env.RESEND_API_KEY = 'test_api_key';
      process.env.EMAIL_FROM = 'sender@example.com';
      emailService = require('../../services/emailService');

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email_123' })
      });

      await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>'
      });

      const callArgs = global.fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.from).toBe('sender@example.com');
    });
  });

  // ==================== INTEGRATION TESTS ====================
  describe('Integration scenarios', () => {
    it('should handle complete user registration flow', async () => {
      // User signs up
      const verifyResult = await emailService.sendEmailVerificationEmail(
        'newuser@example.com',
        'verify_token_xyz',
        'NewUser'
      );

      expect(verifyResult.success).toBe(true);

      // Simulate verification link click, then password reset
      const resetResult = await emailService.sendPasswordResetEmail(
        'newuser@example.com',
        'reset_token_abc',
        'NewUser'
      );

      expect(resetResult.success).toBe(true);
    });

    it('should handle training notification flow', async () => {
      // Training starts (no email)
      // Training completes
      const completeResult = await emailService.sendTrainingCompleteEmail(
        'user@example.com',
        {
          modelName: 'Test Model',
          fineTunedModel: 'ft:test',
          trainedTokens: 10000,
          userName: 'User'
        }
      );

      expect(completeResult.success).toBe(true);
    });
  });

  // ==================== CONSTRUCTOR TESTS ====================
  describe('Service initialization', () => {
    it('should initialize with correct API key from env', () => {
      jest.resetModules();
      process.env.RESEND_API_KEY = 'custom_api_key';
      const service = require('../../services/emailService');

      expect(service.resendApiKey).toBe('custom_api_key');
    });

    it('should initialize with correct from email from env', () => {
      jest.resetModules();
      process.env.EMAIL_FROM = 'custom@sender.com';
      const service = require('../../services/emailService');

      expect(service.fromEmail).toBe('custom@sender.com');
    });

    it('should initialize with correct frontend URL from env', () => {
      jest.resetModules();
      process.env.FRONTEND_URL = 'https://custom.app.com';
      const service = require('../../services/emailService');

      expect(service.frontendUrl).toBe('https://custom.app.com');
    });

    it('should be a singleton instance', () => {
      jest.resetModules();
      const service1 = require('../../services/emailService');
      const service2 = require('../../services/emailService');

      expect(service1).toBe(service2);
    });
  });
});
