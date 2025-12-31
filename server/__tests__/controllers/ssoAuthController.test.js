/**
 * SSO Authentication Controller Tests
 * Tests for server/controllers/ssoAuthController.js
 */

// Use fake timers to prevent setInterval from running
jest.useFakeTimers();

jest.mock('../../db', () => {
  const mockDb = jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    raw: jest.fn()
  }));
  mockDb.raw = jest.fn();
  return mockDb;
});

jest.mock('../../services/oidcService', () => ({
  generateCodeVerifier: jest.fn(),
  generateCodeChallenge: jest.fn(),
  buildAuthorizationUrl: jest.fn(),
  exchangeCodeForTokens: jest.fn(),
  validateIdToken: jest.fn(),
  validateAtHash: jest.fn(),
  getUserInfo: jest.fn(),
  extractUserAttributes: jest.fn(),
  handleLogout: jest.fn(),
  refreshTokens: jest.fn(),
  discoverConfiguration: jest.fn()
}));

jest.mock('../../services/jwtValidationService', () => ({
  decodeToken: jest.fn()
}));

jest.mock('../../services/ssoService', () => ({
  getFullConfig: jest.fn(),
  getConfigByDomain: jest.fn()
}));

jest.mock('../../services/ssoAnalyticsService', () => ({
  recordLogin: jest.fn()
}));

jest.mock('../../services/ai/encryptionHelper', () => ({
  encrypt: jest.fn(),
  decrypt: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../utils/envValidator', () => ({
  getSecureEnv: jest.fn(() => 'test-jwt-secret')
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'mock-random-string-12345678')
  }))
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-jwt-token')
}));

const db = require('../../db');
const OIDCService = require('../../services/oidcService');
const SSOService = require('../../services/ssoService');
const SSOAnalyticsService = require('../../services/ssoAnalyticsService');
const EncryptionHelper = require('../../services/ai/encryptionHelper');
const SSOAuthController = require('../../controllers/ssoAuthController');

describe('SSO Auth Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      query: {},
      body: {},
      user: { id: 1 },
      ip: '127.0.0.1',
      get: jest.fn(() => 'Mozilla/5.0')
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      redirect: jest.fn(),
      cookie: jest.fn(),
      clearCookie: jest.fn()
    };
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('initiateOIDCLogin', () => {
    it('should return 400 if no configId or domain', async () => {
      mockReq.query = {};

      await SSOAuthController.initiateOIDCLogin(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Configuration ID or domain required'
      });
    });

    it('should return 404 if config not found', async () => {
      mockReq.query = { configId: '1' };
      SSOService.getFullConfig.mockResolvedValue(null);

      await SSOAuthController.initiateOIDCLogin(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'SSO configuration not found or disabled'
      });
    });

    it('should return 404 if config is disabled', async () => {
      mockReq.query = { configId: '1' };
      SSOService.getFullConfig.mockResolvedValue({ id: 1, is_enabled: false });

      await SSOAuthController.initiateOIDCLogin(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should redirect to IdP with auth URL', async () => {
      mockReq.query = { configId: '1' };
      SSOService.getFullConfig.mockResolvedValue({
        id: 1,
        is_enabled: true,
        settings: {}
      });
      OIDCService.generateCodeVerifier.mockReturnValue('code-verifier');
      OIDCService.generateCodeChallenge.mockReturnValue('code-challenge');
      OIDCService.buildAuthorizationUrl.mockReturnValue('https://idp.example.com/authorize');

      await SSOAuthController.initiateOIDCLogin(mockReq, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith('https://idp.example.com/authorize');
    });

    it('should use domain to get config', async () => {
      mockReq.query = { domain: 'example.com' };
      SSOService.getConfigByDomain.mockResolvedValue({
        id: 1,
        is_enabled: true,
        settings: {}
      });
      OIDCService.generateCodeVerifier.mockReturnValue('code-verifier');
      OIDCService.generateCodeChallenge.mockReturnValue('code-challenge');
      OIDCService.buildAuthorizationUrl.mockReturnValue('https://idp.example.com/authorize');

      await SSOAuthController.initiateOIDCLogin(mockReq, mockRes);

      expect(SSOService.getConfigByDomain).toHaveBeenCalledWith('example.com');
      expect(mockRes.redirect).toHaveBeenCalled();
    });

    it('should redirect to login on error', async () => {
      mockReq.query = { configId: '1' };
      SSOService.getFullConfig.mockRejectedValue(new Error('DB error'));
      SSOAnalyticsService.recordLogin.mockResolvedValue();

      await SSOAuthController.initiateOIDCLogin(mockReq, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith(expect.stringContaining('/login?error=sso_init_failed'));
    });
  });

  describe('handleOIDCCallback', () => {
    it('should redirect on IdP error', async () => {
      mockReq.query = { error: 'access_denied', error_description: 'User denied access' };

      await SSOAuthController.handleOIDCCallback(mockReq, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith(expect.stringContaining('error=sso_error'));
    });

    it('should redirect on invalid state', async () => {
      mockReq.query = { code: 'auth-code', state: 'invalid-state' };

      await SSOAuthController.handleOIDCCallback(mockReq, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith('/login?error=invalid_state');
    });

    it('should redirect on missing code or state', async () => {
      mockReq.query = { code: 'auth-code' }; // missing state

      await SSOAuthController.handleOIDCCallback(mockReq, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith('/login?error=invalid_state');
    });
  });

  describe('handleOIDCLogout', () => {
    it('should clear cookie and redirect to login without configId', async () => {
      mockReq.body = {};
      mockReq.query = {};

      await SSOAuthController.handleOIDCLogout(mockReq, mockRes);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('sso_session');
      expect(mockRes.redirect).toHaveBeenCalledWith('/login');
    });

    it('should redirect to login if config not found', async () => {
      mockReq.body = { configId: '1' };
      SSOService.getFullConfig.mockResolvedValue(null);

      await SSOAuthController.handleOIDCLogout(mockReq, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith('/login');
    });

    it('should redirect to IdP logout URL', async () => {
      mockReq.body = { configId: '1' };
      mockReq.user = { id: 1 };

      SSOService.getFullConfig.mockResolvedValue({
        id: 1,
        provider_type: 'oidc'
      });

      const mockDbChain = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({})
      };
      db.mockReturnValue(mockDbChain);

      OIDCService.handleLogout.mockResolvedValue({
        url: 'https://idp.example.com/logout'
      });

      await SSOAuthController.handleOIDCLogout(mockReq, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith('https://idp.example.com/logout');
    });

    it('should handle errors gracefully', async () => {
      mockReq.body = { configId: '1' };
      SSOService.getFullConfig.mockRejectedValue(new Error('DB error'));

      await SSOAuthController.handleOIDCLogout(mockReq, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith('/login');
    });
  });

  describe('refreshTokens', () => {
    it('should return 400 if missing parameters', async () => {
      mockReq.body = {};
      mockReq.user = null;

      await SSOAuthController.refreshTokens(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing required parameters'
      });
    });

    it('should return 400 if no refresh token available', async () => {
      mockReq.body = { configId: 1 };
      mockReq.user = { id: 1 };

      const mockDbChain = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ attributes: {} })
      };
      db.mockReturnValue(mockDbChain);

      await SSOAuthController.refreshTokens(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'No refresh token available'
      });
    });

    it('should handle errors', async () => {
      mockReq.body = { configId: 1 };
      mockReq.user = { id: 1 };

      db.mockImplementation(() => {
        throw new Error('DB error');
      });

      await SSOAuthController.refreshTokens(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getUserInfo', () => {
    it('should return 400 if missing parameters', async () => {
      mockReq.query = {};
      mockReq.user = null;

      await SSOAuthController.getUserInfo(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if no access token available', async () => {
      mockReq.query = { configId: '1' };
      mockReq.user = { id: 1 };

      const mockDbChain = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ attributes: {} })
      };
      db.mockReturnValue(mockDbChain);

      await SSOAuthController.getUserInfo(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'No access token available'
      });
    });

    it('should return user info', async () => {
      mockReq.query = { configId: '1' };
      mockReq.user = { id: 1 };

      const mockDbChain = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          attributes: { access_token_encrypted: 'encrypted-token' }
        })
      };
      db.mockReturnValue(mockDbChain);

      EncryptionHelper.decrypt.mockReturnValue('access-token');
      OIDCService.getUserInfo.mockResolvedValue({
        email: 'user@example.com',
        name: 'Test User'
      });

      await SSOAuthController.getUserInfo(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        userInfo: { email: 'user@example.com', name: 'Test User' }
      });
    });

    it('should handle errors', async () => {
      mockReq.query = { configId: '1' };
      mockReq.user = { id: 1 };

      db.mockImplementation(() => {
        throw new Error('DB error');
      });

      await SSOAuthController.getUserInfo(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('discoverConfiguration', () => {
    it('should return 400 if no issuer URL', async () => {
      mockReq.body = {};

      await SSOAuthController.discoverConfiguration(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Issuer URL required'
      });
    });

    it('should return discovery data', async () => {
      mockReq.body = { issuerUrl: 'https://idp.example.com' };
      OIDCService.discoverConfiguration.mockResolvedValue({
        authorization_endpoint: 'https://idp.example.com/authorize',
        token_endpoint: 'https://idp.example.com/token'
      });

      await SSOAuthController.discoverConfiguration(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        discovery: expect.objectContaining({
          authorization_endpoint: expect.any(String)
        })
      });
    });

    it('should handle errors', async () => {
      mockReq.body = { issuerUrl: 'https://invalid.example.com' };
      OIDCService.discoverConfiguration.mockRejectedValue(new Error('Network error'));

      await SSOAuthController.discoverConfiguration(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('checkDomain', () => {
    it('should return 400 if no email', async () => {
      mockReq.query = {};

      await SSOAuthController.checkDomain(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Email required'
      });
    });

    it('should return 400 for invalid email', async () => {
      mockReq.query = { email: 'invalid' };

      await SSOAuthController.checkDomain(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid email'
      });
    });

    it('should return SSO available when config found', async () => {
      mockReq.query = { email: 'user@example.com' };
      SSOService.getConfigByDomain.mockResolvedValue({
        id: 1,
        is_enabled: true,
        is_enforced: true,
        provider_type: 'oidc',
        name: 'Example SSO'
      });

      await SSOAuthController.checkDomain(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        ssoRequired: true,
        ssoAvailable: true,
        provider: 'oidc',
        providerName: 'Example SSO',
        configId: 1
      });
    });

    it('should return SSO not available when no config', async () => {
      mockReq.query = { email: 'user@example.com' };
      SSOService.getConfigByDomain.mockResolvedValue(null);

      await SSOAuthController.checkDomain(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        ssoRequired: false,
        ssoAvailable: false
      });
    });

    it('should return SSO not available when config disabled', async () => {
      mockReq.query = { email: 'user@example.com' };
      SSOService.getConfigByDomain.mockResolvedValue({
        id: 1,
        is_enabled: false
      });

      await SSOAuthController.checkDomain(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        ssoRequired: false,
        ssoAvailable: false
      });
    });

    it('should handle errors', async () => {
      mockReq.query = { email: 'user@example.com' };
      SSOService.getConfigByDomain.mockRejectedValue(new Error('DB error'));

      await SSOAuthController.checkDomain(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Helper Methods', () => {
    describe('findOrCreateUser', () => {
      it('should find existing user', async () => {
        const mockDbChain = {
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({ id: 1, email: 'user@example.com' })
        };
        db.mockReturnValue(mockDbChain);

        const result = await SSOAuthController.findOrCreateUser(
          { email: 'user@example.com' },
          { settings: {} }
        );

        expect(result.id).toBe(1);
      });

      it('should create new user when not found', async () => {
        const mockDbChain = {
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(null),
          insert: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([{ id: 2, email: 'new@example.com' }])
        };
        db.mockReturnValue(mockDbChain);

        const result = await SSOAuthController.findOrCreateUser(
          { email: 'new@example.com', displayName: 'New User' },
          { organization_id: 1, settings: {} }
        );

        expect(result.id).toBe(2);
      });

      it('should throw error when auto-provisioning disabled', async () => {
        const mockDbChain = {
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(null)
        };
        db.mockReturnValue(mockDbChain);

        await expect(
          SSOAuthController.findOrCreateUser(
            { email: 'new@example.com' },
            { settings: { auto_provision: false } }
          )
        ).rejects.toThrow('User not found and auto-provisioning is disabled');
      });
    });

    describe('createSessionToken', () => {
      it('should create JWT token', () => {
        const jwt = require('jsonwebtoken');

        const token = SSOAuthController.createSessionToken(
          { id: 1, email: 'user@example.com', name: 'Test', organization_id: 1, role_id: 2 },
          { provider_type: 'oidc', id: 1 }
        );

        expect(jwt.sign).toHaveBeenCalled();
        expect(token).toBe('mock-jwt-token');
      });
    });
  });
});
