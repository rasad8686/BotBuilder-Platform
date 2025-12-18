/**
 * SSO Service Unit Tests
 */

const SSOService = require('../../services/ssoService');

// Mock database
jest.mock('../../db', () => {
  const mockKnex = jest.fn(() => mockKnex);
  mockKnex.where = jest.fn().mockReturnThis();
  mockKnex.first = jest.fn();
  mockKnex.insert = jest.fn().mockReturnThis();
  mockKnex.update = jest.fn().mockReturnThis();
  mockKnex.del = jest.fn().mockReturnThis();
  mockKnex.returning = jest.fn();
  mockKnex.select = jest.fn().mockReturnThis();
  mockKnex.orderBy = jest.fn();
  mockKnex.fn = { now: jest.fn(() => new Date()) };
  return mockKnex;
});

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

      db.returning.mockResolvedValue([mockConfig]);

      const result = await SSOService.createConfig(1, {
        provider_type: 'oidc',
        name: 'Test SSO',
        client_id: 'test-client-id',
        client_secret: 'test-secret',
        issuer_url: 'https://issuer.example.com'
      });

      expect(result).toEqual(mockConfig);
      expect(db).toHaveBeenCalledWith('sso_configurations');
    });

    it('should throw error for invalid provider type', async () => {
      await expect(
        SSOService.createConfig(1, {
          provider_type: 'invalid',
          name: 'Test'
        })
      ).rejects.toThrow();
    });

    it('should throw error for missing required fields', async () => {
      await expect(
        SSOService.createConfig(1, {
          provider_type: 'oidc'
          // Missing name
        })
      ).rejects.toThrow();
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

      db.first.mockResolvedValue({ id: 1, organization_id: 1 });
      db.returning.mockResolvedValue([mockConfig]);

      const result = await SSOService.updateConfig(1, { name: 'Updated SSO' });

      expect(result.name).toBe('Updated SSO');
    });

    it('should throw error for non-existing config', async () => {
      db.first.mockResolvedValue(null);

      await expect(
        SSOService.updateConfig(999, { name: 'Test' })
      ).rejects.toThrow('Configuration not found');
    });
  });

  describe('deleteSSOConfig', () => {
    it('should delete config and related data', async () => {
      db.first.mockResolvedValue({ id: 1, organization_id: 1 });
      db.del.mockResolvedValue(1);

      const result = await SSOService.deleteConfig(1);

      expect(result.success).toBe(true);
      expect(db.del).toHaveBeenCalled();
    });

    it('should throw error for non-existing config', async () => {
      db.first.mockResolvedValue(null);

      await expect(SSOService.deleteConfig(999)).rejects.toThrow();
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

      db.first.mockResolvedValue({ sso_configuration_id: 1, is_verified: true });
      db.first.mockResolvedValueOnce({ sso_configuration_id: 1, is_verified: true });
      db.first.mockResolvedValueOnce(mockConfig);

      const result = await SSOService.getSSOConfigByDomain('example.com');

      expect(result).toBeTruthy();
    });

    it('should return null for unverified domain', async () => {
      db.first.mockResolvedValue({ sso_configuration_id: 1, is_verified: false });

      const result = await SSOService.getSSOConfigByDomain('unverified.com');

      expect(result).toBeNull();
    });

    it('should return null for non-existing domain', async () => {
      db.first.mockResolvedValue(null);

      const result = await SSOService.getSSOConfigByDomain('nonexistent.com');

      expect(result).toBeNull();
    });
  });

  describe('verifySSODomain', () => {
    it('should verify domain with valid token', async () => {
      const mockDomain = {
        id: 1,
        domain: 'example.com',
        verification_token: 'valid-token',
        is_verified: false
      };

      db.first.mockResolvedValue(mockDomain);
      db.update.mockResolvedValue(1);

      // Mock DNS lookup
      jest.spyOn(SSOService, 'checkDNSVerification').mockResolvedValue(true);

      const result = await SSOService.verifyDomain(1);

      expect(result.success).toBe(true);
    });

    it('should fail verification with invalid token', async () => {
      const mockDomain = {
        id: 1,
        domain: 'example.com',
        verification_token: 'valid-token',
        is_verified: false
      };

      db.first.mockResolvedValue(mockDomain);
      jest.spyOn(SSOService, 'checkDNSVerification').mockResolvedValue(false);

      const result = await SSOService.verifyDomain(1);

      expect(result.success).toBe(false);
    });
  });

  describe('getFullConfig', () => {
    it('should return config with decrypted secrets', async () => {
      const mockConfig = {
        id: 1,
        client_id: 'test-client',
        client_secret_encrypted: 'encrypted-secret',
        is_enabled: true
      };

      db.first.mockResolvedValue(mockConfig);

      const result = await SSOService.getFullConfig(1);

      expect(result).toBeTruthy();
      expect(result.id).toBe(1);
    });

    it('should return null for non-existing config', async () => {
      db.first.mockResolvedValue(null);

      const result = await SSOService.getFullConfig(999);

      expect(result).toBeNull();
    });
  });
});
