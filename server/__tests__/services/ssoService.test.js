/**
 * SSO Service Tests
 * Tests for server/services/ssoService.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../services/ai/encryptionHelper', () => ({
  encrypt: jest.fn().mockImplementation(val => `encrypted:${val}`),
  decrypt: jest.fn().mockImplementation(val => val.replace('encrypted:', ''))
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const SSOService = require('../../services/ssoService');

describe('SSO Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSSOConfig', () => {
    it('should create new SSO configuration', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // No existing config
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            organization_id: 1,
            provider_type: 'saml',
            name: 'SAML SSO',
            is_enabled: true
          }]
        });

      const result = await SSOService.createSSOConfig(1, {
        provider_type: 'saml',
        name: 'SAML SSO',
        is_enabled: true
      });

      expect(result.id).toBe(1);
      expect(result.provider_type).toBe('saml');
    });

    it('should throw if organization already has SSO config', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await expect(SSOService.createSSOConfig(1, { provider_type: 'saml' }))
        .rejects.toThrow('Organization already has an SSO configuration');
    });

    it('should encrypt sensitive fields', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await SSOService.createSSOConfig(1, {
        provider_type: 'oidc',
        private_key: 'secret-key',
        client_secret: 'client-secret'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['encrypted:secret-key', 'encrypted:client-secret'])
      );
    });
  });

  describe('updateSSOConfig', () => {
    it('should update configuration fields', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Updated SSO', is_enabled: true }]
      });

      const result = await SSOService.updateSSOConfig(1, {
        name: 'Updated SSO',
        is_enabled: true
      });

      expect(result.name).toBe('Updated SSO');
    });

    it('should throw if config not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(SSOService.updateSSOConfig(999, { name: 'Test' }))
        .rejects.toThrow('SSO configuration not found');
    });

    it('should encrypt sensitive fields on update', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await SSOService.updateSSOConfig(1, {
        private_key: 'new-key',
        client_secret: 'new-secret'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('private_key_encrypted'),
        expect.arrayContaining(['encrypted:new-key', 'encrypted:new-secret'])
      );
    });
  });

  describe('deleteSSOConfig', () => {
    it('should delete configuration', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      const result = await SSOService.deleteSSOConfig(1);

      expect(result.success).toBe(true);
    });

    it('should throw if config not found', async () => {
      db.query.mockResolvedValue({ rowCount: 0 });

      await expect(SSOService.deleteSSOConfig(999))
        .rejects.toThrow('SSO configuration not found');
    });
  });

  describe('getSSOConfigByOrg', () => {
    it('should return config with domains', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            organization_id: 1,
            provider_type: 'saml',
            settings: '{"key":"value"}'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1, domain: 'example.com', is_verified: true }]
        });

      const result = await SSOService.getSSOConfigByOrg(1);

      expect(result.id).toBe(1);
      expect(result.domains).toHaveLength(1);
    });

    it('should return null if no config', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await SSOService.getSSOConfigByOrg(999);

      expect(result).toBeNull();
    });
  });

  describe('getSSOConfigByDomain', () => {
    it('should return config for verified domain', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ sso_configuration_id: 1, domain: 'example.com', is_verified: true }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1, provider_type: 'saml', is_enabled: true }]
        });

      const result = await SSOService.getSSOConfigByDomain('example.com');

      expect(result.id).toBe(1);
    });

    it('should return null for unverified domain', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await SSOService.getSSOConfigByDomain('unknown.com');

      expect(result).toBeNull();
    });

    it('should normalize domain', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await SSOService.getSSOConfigByDomain('  EXAMPLE.COM  ');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        ['example.com']
      );
    });
  });

  describe('checkEmailSSO', () => {
    it('should detect SSO required for domain', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ sso_configuration_id: 1, is_verified: true }]
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            provider_type: 'saml',
            name: 'Company SSO',
            is_enabled: true,
            is_enforced: true
          }]
        });

      const result = await SSOService.checkEmailSSO('user@company.com');

      expect(result.requiresSSO).toBe(true);
      expect(result.ssoAvailable).toBe(true);
    });

    it('should return not required for unknown domain', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await SSOService.checkEmailSSO('user@unknown.com');

      expect(result.requiresSSO).toBe(false);
    });

    it('should handle invalid email', async () => {
      const result = await SSOService.checkEmailSSO('invalid-email');

      expect(result.requiresSSO).toBe(false);
    });
  });

  describe('addDomain', () => {
    it('should add domain with verification token', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // No existing domain
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            domain: 'newdomain.com',
            verification_token: expect.any(String),
            is_verified: false
          }]
        });

      const result = await SSOService.addDomain(1, 'newdomain.com');

      expect(result.domain).toBe('newdomain.com');
      expect(result.is_verified).toBe(false);
    });

    it('should throw if domain already registered', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await expect(SSOService.addDomain(1, 'existing.com'))
        .rejects.toThrow('Domain is already registered');
    });
  });

  describe('verifySSODomain', () => {
    it('should return success if already verified', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, domain: 'example.com', is_verified: true }]
      });

      const result = await SSOService.verifySSODomain(1, 1);

      expect(result.success).toBe(true);
      expect(result.message).toContain('already verified');
    });

    it('should auto-verify in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, domain: 'example.com', is_verified: false, verification_token: 'token123' }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await SSOService.verifySSODomain(1, 1);

      expect(result.success).toBe(true);
      expect(result.message).toContain('development mode');

      process.env.NODE_ENV = originalEnv;
    });

    it('should throw if domain not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(SSOService.verifySSODomain(1, 999))
        .rejects.toThrow('Domain not found');
    });
  });

  describe('deleteDomain', () => {
    it('should delete domain', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      const result = await SSOService.deleteDomain(1, 1);

      expect(result.success).toBe(true);
    });

    it('should throw if domain not found', async () => {
      db.query.mockResolvedValue({ rowCount: 0 });

      await expect(SSOService.deleteDomain(1, 999))
        .rejects.toThrow('Domain not found');
    });
  });

  describe('generateSAMLMetadata', () => {
    it('should generate SAML metadata XML', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          entity_id: 'https://app.example.com/sso',
          acs_url: 'https://app.example.com/sso/acs'
        }]
      });

      const result = await SSOService.generateSAMLMetadata(1);

      expect(result).toContain('EntityDescriptor');
      expect(result).toContain('SPSSODescriptor');
      expect(result).toContain('AssertionConsumerService');
    });

    it('should throw if config not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(SSOService.generateSAMLMetadata(999))
        .rejects.toThrow('SSO configuration not found');
    });
  });

  describe('logLoginAttempt', () => {
    it('should log login attempt', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, status: 'success' }]
      });

      const result = await SSOService.logLoginAttempt({
        configId: 1,
        userId: 1,
        email: 'test@test.com',
        status: 'success'
      });

      expect(result.status).toBe('success');
    });

    it('should not throw on logging error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const result = await SSOService.logLoginAttempt({
        configId: 1,
        status: 'success'
      });

      expect(result).toBeNull();
    });
  });

  describe('getLoginLogs', () => {
    it('should return paginated logs', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, status: 'success' }]
      });

      const result = await SSOService.getLoginLogs(1, { page: 1, limit: 10 });

      expect(result.logs).toHaveLength(1);
      expect(result.page).toBe(1);
    });
  });

  describe('upsertUserMapping', () => {
    it('should create new mapping', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // No existing mapping
        .mockResolvedValueOnce({
          rows: [{ id: 1, external_id: 'ext-123', user_id: 1 }]
        });

      const result = await SSOService.upsertUserMapping({
        configId: 1,
        userId: 1,
        externalId: 'ext-123',
        email: 'test@test.com'
      });

      expect(result.external_id).toBe('ext-123');
    });

    it('should update existing mapping', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Existing mapping
        .mockResolvedValueOnce({
          rows: [{ id: 1, external_id: 'ext-123' }]
        });

      await SSOService.upsertUserMapping({
        configId: 1,
        userId: 1,
        externalId: 'ext-123'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.any(Array)
      );
    });
  });

  describe('getUserMappingByExternalId', () => {
    it('should return mapping', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, external_id: 'ext-123', user_id: 1 }]
      });

      const result = await SSOService.getUserMappingByExternalId(1, 'ext-123');

      expect(result.external_id).toBe('ext-123');
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await SSOService.getUserMappingByExternalId(1, 'unknown');

      expect(result).toBeNull();
    });
  });

  describe('sanitizeConfig', () => {
    it('should remove sensitive fields', () => {
      const config = {
        id: 1,
        private_key_encrypted: 'encrypted-key',
        client_secret_encrypted: 'encrypted-secret',
        settings: '{"key":"value"}'
      };

      const result = SSOService.sanitizeConfig(config);

      expect(result.private_key_encrypted).toBeUndefined();
      expect(result.client_secret_encrypted).toBeUndefined();
      expect(result.has_private_key).toBe(true);
      expect(result.has_client_secret).toBe(true);
    });

    it('should parse JSON settings', () => {
      const config = {
        id: 1,
        settings: '{"key":"value"}'
      };

      const result = SSOService.sanitizeConfig(config);

      expect(result.settings).toEqual({ key: 'value' });
    });

    it('should handle null config', () => {
      const result = SSOService.sanitizeConfig(null);
      expect(result).toBeNull();
    });
  });

  describe('getFullConfig', () => {
    it('should return config with decrypted secrets', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          private_key_encrypted: 'encrypted:secret-key',
          client_secret_encrypted: 'encrypted:secret',
          settings: '{"key":"value"}'
        }]
      });

      const result = await SSOService.getFullConfig(1);

      expect(result.private_key).toBe('secret-key');
      expect(result.client_secret).toBe('secret');
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await SSOService.getFullConfig(999);

      expect(result).toBeNull();
    });
  });

  describe('testSSOConnection', () => {
    it('should return test results for OIDC config', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            provider_type: 'oidc',
            client_id: 'client-id',
            client_secret_encrypted: 'encrypted-secret',
            issuer_url: 'https://issuer.example.com'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1, is_verified: true }]
        });

      const result = await SSOService.testSSOConnection(1);

      expect(result.checks).toBeDefined();
      expect(result.checks.some(c => c.name === 'Client ID')).toBe(true);
    });

    it('should throw if config not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(SSOService.testSSOConnection(999))
        .rejects.toThrow('SSO configuration not found');
    });
  });
});
