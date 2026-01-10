/**
 * API Key Rotation Job Tests
 * Tests for server/jobs/keyRotation.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../services/emailService', () => ({
  sendKeyRotationEmail: jest.fn().mockResolvedValue({ success: true })
}));

const db = require('../../db');
const emailService = require('../../services/emailService');
const keyRotation = require('../../jobs/keyRotation');

describe('Key Rotation Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Job lifecycle', () => {
    afterEach(() => {
      keyRotation.stop();
    });

    it('should start and stop job', () => {
      // Start
      keyRotation.start();
      expect(keyRotation.isRunning()).toBe(true);

      // Stop
      keyRotation.stop();
      expect(keyRotation.isRunning()).toBe(false);
    });

    it('should return correct status', () => {
      const status = keyRotation.getStatus();
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('currentlyProcessing');
      expect(status).toHaveProperty('interval');
      expect(status.interval).toBe(60 * 60 * 1000); // 1 hour
    });

    it('should not start twice', () => {
      keyRotation.start();
      keyRotation.start(); // Should warn but not create duplicate
      expect(keyRotation.isRunning()).toBe(true);
    });
  });

  describe('runNow', () => {
    beforeEach(() => {
      // Mock empty results by default
      db.query.mockResolvedValue({ rows: [] });
    });

    it('should process scheduled tokens', async () => {
      const scheduledToken = {
        id: 1,
        token_name: 'Test Token',
        bot_id: null,
        permissions: { read: true },
        expires_at: null,
        organization_id: 1,
        user_id: 1,
        email: 'test@example.com',
        user_name: 'Test User'
      };

      // Mock scheduled tokens query
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Expired overlap tokens
        .mockResolvedValueOnce({ rows: [scheduledToken] }) // Scheduled tokens
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Update old token
        .mockResolvedValueOnce({ rows: [{
          id: 2,
          token_name: 'Test Token (auto-rotated)',
          token_preview: 'abc1...xyz4',
          created_at: new Date()
        }] }) // Create new token
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await keyRotation.runNow();

      // Should have sent rotation notification
      expect(emailService.sendKeyRotationEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          userName: 'Test User',
          tokenName: 'Test Token',
          isAutoRotation: true
        })
      );
    });

    it('should deactivate expired overlap tokens', async () => {
      const expiredToken = {
        id: 1,
        token_name: 'Old Token',
        organization_id: 1,
        user_id: 1
      };

      db.query
        .mockResolvedValueOnce({ rows: [expiredToken] }) // Expired overlap tokens
        .mockResolvedValueOnce({ rows: [] }) // Deactivate update
        .mockResolvedValueOnce({ rows: [] }); // No scheduled tokens

      await keyRotation.runNow();

      // Should have deactivated the token
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE api_tokens'),
        expect.arrayContaining([1])
      );
    });

    it('should handle no tokens to process', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Expired overlap tokens
        .mockResolvedValueOnce({ rows: [] }); // Scheduled tokens

      await keyRotation.runNow();

      // Should complete without errors
      expect(emailService.sendKeyRotationEmail).not.toHaveBeenCalled();
    });

    it('should handle rotation errors gracefully', async () => {
      const scheduledToken = {
        id: 1,
        token_name: 'Test Token',
        bot_id: null,
        permissions: {},
        expires_at: null,
        organization_id: 1,
        user_id: 1,
        email: 'test@example.com',
        user_name: 'Test User'
      };

      db.query
        .mockResolvedValueOnce({ rows: [] }) // Expired overlap tokens
        .mockResolvedValueOnce({ rows: [scheduledToken] }) // Scheduled tokens
        .mockRejectedValueOnce(new Error('Rotation failed')); // Error on BEGIN

      // Should not throw
      await expect(keyRotation.runNow()).resolves.not.toThrow();
    });

    it('should handle email notification errors gracefully', async () => {
      const scheduledToken = {
        id: 1,
        token_name: 'Test Token',
        bot_id: null,
        permissions: {},
        expires_at: null,
        organization_id: 1,
        user_id: 1,
        email: 'test@example.com',
        user_name: 'Test User'
      };

      db.query
        .mockResolvedValueOnce({ rows: [] }) // Expired overlap tokens
        .mockResolvedValueOnce({ rows: [scheduledToken] }) // Scheduled tokens
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Update old token
        .mockResolvedValueOnce({ rows: [{
          id: 2,
          token_name: 'Test Token (auto-rotated)',
          token_preview: 'abc1...xyz4',
          created_at: new Date()
        }] }) // Create new token
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      emailService.sendKeyRotationEmail.mockRejectedValueOnce(new Error('Email failed'));

      // Should not throw
      await expect(keyRotation.runNow()).resolves.not.toThrow();
    });

    it('should handle token without email', async () => {
      const scheduledToken = {
        id: 1,
        token_name: 'Test Token',
        bot_id: null,
        permissions: {},
        expires_at: null,
        organization_id: 1,
        user_id: 1,
        email: null, // No email
        user_name: null
      };

      db.query
        .mockResolvedValueOnce({ rows: [] }) // Expired overlap tokens
        .mockResolvedValueOnce({ rows: [scheduledToken] }) // Scheduled tokens
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Update old token
        .mockResolvedValueOnce({ rows: [{
          id: 2,
          token_name: 'Test Token (auto-rotated)',
          token_preview: 'abc1...xyz4',
          created_at: new Date()
        }] }) // Create new token
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await keyRotation.runNow();

      // Should not try to send email
      expect(emailService.sendKeyRotationEmail).not.toHaveBeenCalled();
    });
  });

  describe('POLL_INTERVAL', () => {
    it('should be 1 hour', () => {
      expect(keyRotation.POLL_INTERVAL).toBe(60 * 60 * 1000);
    });
  });
});
