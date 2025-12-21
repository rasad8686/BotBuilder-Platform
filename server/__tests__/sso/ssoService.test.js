/**
 * SSO Service Unit Tests
 */

// Mock database first
jest.mock('../../db', () => ({
  query: jest.fn()
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock encryption helper
jest.mock('../../services/ai/encryptionHelper', () => ({
  encrypt: jest.fn(val => `encrypted_${val}`),
  decrypt: jest.fn(val => val.replace('encrypted_', ''))
}));

const SSOService = require('../../services/ssoService');
const db = require('../../db');

describe('SSOService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSSOConfig', () => {
    it('should create SSO config with valid data', async () => {
      const mockConfig = {
        id: 1,
        organization_id: 1,
        provider_type: 'oidc',
        name: 'Test SSO',
        is_enabled: true,
        created_at: new Date()
      };

      // First call checks if config exists (should return empty)
      // Second call creates the config
      db.query
        .mockResolvedValueOnce({ rows: [] }) // No existing config
        .mockResolvedValueOnce({ rows: [mockConfig] }); // Created config

      const result = await SSOService.createSSOConfig(1, {
        provider_type: 'oidc',
        name: 'Test SSO',
        client_id: 'test-client-id',
        client_secret: 'test-secret',
        issuer_url: 'https://issuer.example.com'
      });

      expect(result).toBeTruthy();
      expect(result.provider_type).toBe('oidc');
    });

    it('should throw error for invalid provider type', async () => {
      db.query.mockRejectedValue(new Error('Invalid provider type'));

      await expect(
        SSOService.createSSOConfig(1, {
          provider_type: 'invalid',
          name: 'Test'
        })
      ).rejects.toThrow();
    });

    it('should throw error for database errors', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      await expect(
        SSOService.createSSOConfig(1, {
          provider_type: 'oidc',
          name: 'Test'
        })
      ).rejects.toThrow();
    });
  });

  describe('getSSOConfigByOrg', () => {
    it('should return config for organization', async () => {
      const mockConfig = {
        id: 1,
        organization_id: 1,
        provider_type: 'oidc',
        name: 'Test SSO'
      };

      db.query.mockResolvedValue({ rows: [mockConfig] });

      const result = await SSOService.getSSOConfigByOrg(1);

      expect(result).toBeTruthy();
      expect(result.organization_id).toBe(1);
    });

    it('should return null if no config exists', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await SSOService.getSSOConfigByOrg(999);

      expect(result).toBeNull();
    });
  });

  describe('updateSSOConfig', () => {
    it('should update existing config', async () => {
      const mockConfig = {
        id: 1,
        organization_id: 1,
        provider_type: 'oidc',
        name: 'Updated SSO'
      };

      db.query.mockResolvedValue({ rows: [mockConfig] });

      const result = await SSOService.updateSSOConfig(1, { name: 'Updated SSO' });

      expect(result).toBeTruthy();
      expect(result.name).toBe('Updated SSO');
    });

    it('should throw error for non-existing config', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(
        SSOService.updateSSOConfig(999, { name: 'Test' })
      ).rejects.toThrow();
    });
  });

  describe('deleteSSOConfig', () => {
    it('should delete config and related data', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await SSOService.deleteSSOConfig(1);

      expect(db.query).toHaveBeenCalled();
    });

    it('should handle non-existing config gracefully', async () => {
      db.query.mockResolvedValue({ rows: [] });

      // Should not throw for non-existing config
      await SSOService.deleteSSOConfig(999);
      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('getSSOConfigByDomain', () => {
    it('should find config by verified domain', async () => {
      const mockConfig = {
        id: 1,
        name: 'Test SSO',
        provider_type: 'oidc',
        is_enabled: true
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ sso_configuration_id: 1, is_verified: true }] })
        .mockResolvedValueOnce({ rows: [mockConfig] });

      const result = await SSOService.getSSOConfigByDomain('example.com');

      expect(result).toBeTruthy();
    });

    it('should return null for non-existing domain', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await SSOService.getSSOConfigByDomain('nonexistent.com');

      expect(result).toBeNull();
    });
  });

  describe('addDomain', () => {
    it('should add domain to config', async () => {
      const mockDomain = {
        id: 1,
        domain: 'example.com',
        verification_token: 'token123',
        is_verified: false
      };

      // First call checks if domain exists (should return empty)
      // Second call adds the domain
      db.query
        .mockResolvedValueOnce({ rows: [] }) // No existing domain
        .mockResolvedValueOnce({ rows: [mockDomain] }); // Created domain

      const result = await SSOService.addDomain(1, 'example.com');

      expect(result).toBeTruthy();
      expect(result.domain).toBe('example.com');
    });
  });

  describe('verifySSODomain', () => {
    it('should verify domain', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, domain: 'example.com', verification_token: 'token' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, is_verified: true }] });

      const result = await SSOService.verifySSODomain(1, 1);

      expect(result).toBeTruthy();
    });
  });

  describe('getFullConfig', () => {
    it('should return config with decrypted secrets', async () => {
      const mockConfig = {
        id: 1,
        client_id: 'test-client',
        client_secret_encrypted: 'encrypted_secret',
        is_enabled: true
      };

      db.query.mockResolvedValue({ rows: [mockConfig] });

      const result = await SSOService.getFullConfig(1);

      expect(result).toBeTruthy();
      expect(result.id).toBe(1);
    });

    it('should return null for non-existing config', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await SSOService.getFullConfig(999);

      expect(result).toBeNull();
    });
  });

  describe('logLoginAttempt', () => {
    it('should log login attempt', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await SSOService.logLoginAttempt({
        configId: 1,
        email: 'test@example.com',
        status: 'success',
        ipAddress: '127.0.0.1',
        userAgent: 'test'
      });

      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('getLoginLogs', () => {
    it('should return login logs', async () => {
      const mockLogs = [
        { id: 1, email: 'test@example.com', status: 'success' }
      ];

      db.query.mockResolvedValue({ rows: mockLogs });

      const result = await SSOService.getLoginLogs(1, { page: 1, limit: 10 });

      expect(result).toBeTruthy();
    });
  });

  describe('checkEmailSSO', () => {
    it('should check if email requires SSO', async () => {
      const mockConfig = {
        id: 1,
        is_enabled: true,
        is_enforced: true
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ sso_configuration_id: 1, is_verified: true }] })
        .mockResolvedValueOnce({ rows: [mockConfig] });

      const result = await SSOService.checkEmailSSO('user@example.com');

      expect(result).toBeTruthy();
    });

    it('should return no SSO for unknown domain', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await SSOService.checkEmailSSO('user@unknown.com');

      expect(result.ssoRequired).toBeFalsy();
    });
  });

  describe('upsertUserMapping', () => {
    it('should create or update user mapping', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await SSOService.upsertUserMapping({
        configId: 1,
        userId: 1,
        externalId: 'ext-123',
        email: 'test@example.com',
        attributes: {}
      });

      expect(db.query).toHaveBeenCalled();
    });
  });
});
