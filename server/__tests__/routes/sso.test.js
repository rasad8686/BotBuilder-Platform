/**
 * SSO Routes Tests
 * Tests for Enterprise Single Sign-On API endpoints
 */

const express = require('express');
const request = require('supertest');

// Mock dependencies
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 'user-1', email: 'admin@test.com', current_organization_id: 'org-1' };
  next();
}));

jest.mock('../../services/ssoService', () => ({
  getSSOConfigByOrg: jest.fn(),
  createSSOConfig: jest.fn(),
  updateSSOConfig: jest.fn(),
  deleteSSOConfig: jest.fn(),
  testSSOConnection: jest.fn(),
  generateSAMLMetadata: jest.fn(),
  getLoginLogs: jest.fn(),
  addDomain: jest.fn(),
  verifySSODomain: jest.fn(),
  deleteDomain: jest.fn(),
  checkEmailSSO: jest.fn(),
  getSSOConfigByDomain: jest.fn(),
  logLoginAttempt: jest.fn(),
  getFullConfig: jest.fn(),
  upsertUserMapping: jest.fn()
}));

jest.mock('../../services/samlService', () => ({
  generateAuthRequest: jest.fn(),
  parseAssertion: jest.fn(),
  generateLogoutRequest: jest.fn()
}));

jest.mock('../../services/oidcService', () => ({
  generateAuthorizationUrl: jest.fn(),
  generateCodeVerifier: jest.fn(),
  generateCodeChallenge: jest.fn(),
  buildAuthorizationUrl: jest.fn(),
  refreshTokens: jest.fn(),
  getUserInfo: jest.fn(),
  discoverConfiguration: jest.fn(),
  exchangeCodeForTokens: jest.fn(),
  validateIdToken: jest.fn(),
  extractUserAttributes: jest.fn(),
  getEndSessionUrl: jest.fn()
}));

jest.mock('../../services/scimService', () => ({
  generateToken: jest.fn()
}));

jest.mock('../../services/ssoGroupService', () => ({
  getMappings: jest.fn(),
  createMapping: jest.fn(),
  updateMapping: jest.fn(),
  deleteMapping: jest.fn(),
  getAttributeMappings: jest.fn(),
  createAttributeMapping: jest.fn(),
  updateAttributeMapping: jest.fn(),
  deleteAttributeMapping: jest.fn()
}));

jest.mock('../../services/ssoAnalyticsService', () => ({
  getAnalytics: jest.fn(),
  getRealTimeStats: jest.fn(),
  getTopUsers: jest.fn(),
  exportToCSV: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const SSOService = require('../../services/ssoService');
const SAMLService = require('../../services/samlService');
const OIDCService = require('../../services/oidcService');
const SCIMService = require('../../services/scimService');
const SSOGroupService = require('../../services/ssoGroupService');
const SSOAnalyticsService = require('../../services/ssoAnalyticsService');
const ssoRouter = require('../../routes/sso');

describe('SSO Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/sso', ssoRouter);

    // Default mock for config ownership check
    db.query.mockResolvedValue({ rows: [{ id: 'config-1', organization_id: 'org-1' }] });
  });

  afterAll(() => {
    if (ssoRouter.cleanup) {
      ssoRouter.cleanup();
    }
  });

  describe('Config Endpoints', () => {
    describe('GET /api/sso/config', () => {
      it('should return SSO configuration', async () => {
        const mockConfig = { id: 'config-1', provider_type: 'saml', is_enabled: true };
        SSOService.getSSOConfigByOrg.mockResolvedValue(mockConfig);

        const response = await request(app).get('/api/sso/config');

        expect(response.status).toBe(200);
        expect(response.body.config).toEqual(mockConfig);
      });

      it('should return null config when no org', async () => {
        const appNoOrg = express();
        appNoOrg.use(express.json());
        appNoOrg.use((req, res, next) => {
          req.user = { id: 'user-1' };
          next();
        });
        appNoOrg.use('/api/sso', ssoRouter);

        const response = await request(appNoOrg).get('/api/sso/config');

        expect(response.status).toBe(200);
        expect(response.body.config).toBeNull();
      });

      it('should handle table not found error gracefully', async () => {
        SSOService.getSSOConfigByOrg.mockRejectedValue(new Error('table does not exist'));

        const response = await request(app).get('/api/sso/config');

        expect(response.status).toBe(200);
        expect(response.body.config).toBeNull();
      });

      it('should handle other errors', async () => {
        SSOService.getSSOConfigByOrg.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get('/api/sso/config');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to get SSO configuration');
      });
    });

    describe('POST /api/sso/config', () => {
      it('should create SSO config for org admin', async () => {
        db.query.mockResolvedValue({ rows: [{ role_id: 1 }] });
        const mockConfig = { id: 'config-new', provider_type: 'oidc' };
        SSOService.createSSOConfig.mockResolvedValue(mockConfig);

        const response = await request(app)
          .post('/api/sso/config')
          .send({ provider_type: 'oidc' });

        expect(response.status).toBe(201);
        expect(response.body.config).toEqual(mockConfig);
      });

      it('should allow org owner to create config', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] }) // Not a team member with role 1
          .mockResolvedValueOnce({ rows: [{ owner_id: 'user-1' }] }); // Is org owner
        SSOService.createSSOConfig.mockResolvedValue({ id: 'config-new' });

        const response = await request(app)
          .post('/api/sso/config')
          .send({ provider_type: 'saml' });

        expect(response.status).toBe(201);
      });

      it('should reject non-admin users', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ owner_id: 'other-user' }] });

        const response = await request(app)
          .post('/api/sso/config')
          .send({ provider_type: 'saml' });

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('organization admins');
      });

      it('should handle creation errors', async () => {
        db.query.mockResolvedValue({ rows: [{ role_id: 1 }] });
        SSOService.createSSOConfig.mockRejectedValue(new Error('Creation failed'));

        const response = await request(app)
          .post('/api/sso/config')
          .send({});

        expect(response.status).toBe(500);
      });
    });

    describe('PUT /api/sso/config/:id', () => {
      it('should update SSO config', async () => {
        SSOService.updateSSOConfig.mockResolvedValue({ id: 'config-1', is_enabled: false });

        const response = await request(app)
          .put('/api/sso/config/config-1')
          .send({ is_enabled: false });

        expect(response.status).toBe(200);
        expect(response.body.config.is_enabled).toBe(false);
      });

      it('should return 404 for non-existent config', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const response = await request(app)
          .put('/api/sso/config/non-existent')
          .send({ is_enabled: true });

        expect(response.status).toBe(404);
      });

      it('should handle update errors', async () => {
        SSOService.updateSSOConfig.mockRejectedValue(new Error('Update failed'));

        const response = await request(app)
          .put('/api/sso/config/config-1')
          .send({});

        expect(response.status).toBe(500);
      });
    });

    describe('DELETE /api/sso/config/:id', () => {
      it('should delete SSO config', async () => {
        SSOService.deleteSSOConfig.mockResolvedValue(true);

        const response = await request(app).delete('/api/sso/config/config-1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return 404 for non-existent config', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const response = await request(app).delete('/api/sso/config/non-existent');

        expect(response.status).toBe(404);
      });

      it('should handle delete errors', async () => {
        SSOService.deleteSSOConfig.mockRejectedValue(new Error('Delete failed'));

        const response = await request(app).delete('/api/sso/config/config-1');

        expect(response.status).toBe(500);
      });
    });

    describe('POST /api/sso/config/:id/test', () => {
      it('should test SSO connection', async () => {
        const results = { success: true, checks: { metadata: true, endpoints: true } };
        SSOService.testSSOConnection.mockResolvedValue(results);

        const response = await request(app).post('/api/sso/config/config-1/test');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(results);
      });

      it('should return 404 for non-existent config', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const response = await request(app).post('/api/sso/config/non-existent/test');

        expect(response.status).toBe(404);
      });

      it('should handle test errors', async () => {
        SSOService.testSSOConnection.mockRejectedValue(new Error('Test failed'));

        const response = await request(app).post('/api/sso/config/config-1/test');

        expect(response.status).toBe(500);
      });
    });

    describe('GET /api/sso/config/:id/metadata', () => {
      it('should return SAML metadata', async () => {
        const metadata = '<?xml version="1.0"?><metadata></metadata>';
        SSOService.generateSAMLMetadata.mockResolvedValue(metadata);

        const response = await request(app).get('/api/sso/config/config-1/metadata');

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('application/xml');
        expect(response.text).toBe(metadata);
      });

      it('should handle metadata generation errors', async () => {
        SSOService.generateSAMLMetadata.mockRejectedValue(new Error('Metadata error'));

        const response = await request(app).get('/api/sso/config/config-1/metadata');

        expect(response.status).toBe(500);
      });
    });

    describe('GET /api/sso/config/:id/logs', () => {
      it('should return login logs', async () => {
        const logs = { logs: [], total: 0 };
        SSOService.getLoginLogs.mockResolvedValue(logs);

        const response = await request(app).get('/api/sso/config/config-1/logs');

        expect(response.status).toBe(200);
      });

      it('should apply pagination', async () => {
        SSOService.getLoginLogs.mockResolvedValue({ logs: [], total: 0 });

        await request(app).get('/api/sso/config/config-1/logs?page=2&limit=25');

        expect(SSOService.getLoginLogs).toHaveBeenCalledWith('config-1', { page: 2, limit: 25 });
      });

      it('should return 404 for non-existent config', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const response = await request(app).get('/api/sso/config/non-existent/logs');

        expect(response.status).toBe(404);
      });
    });
  });

  describe('Domain Endpoints', () => {
    describe('POST /api/sso/domains', () => {
      it('should add domain', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 'config-1' }] });
        SSOService.addDomain.mockResolvedValue({ domain: 'example.com', verification_token: 'abc123' });

        const response = await request(app)
          .post('/api/sso/domains')
          .send({ domain: 'example.com' });

        expect(response.status).toBe(201);
        expect(response.body.domain).toBeDefined();
        expect(response.body.verification).toBeDefined();
      });

      it('should return 400 without domain', async () => {
        const response = await request(app).post('/api/sso/domains').send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Domain is required');
      });

      it('should return 404 without SSO config', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const response = await request(app)
          .post('/api/sso/domains')
          .send({ domain: 'example.com' });

        expect(response.status).toBe(404);
      });
    });

    describe('POST /api/sso/domains/:id/verify', () => {
      it('should verify domain', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 'config-1' }] });
        SSOService.verifySSODomain.mockResolvedValue({ verified: true });

        const response = await request(app).post('/api/sso/domains/1/verify');

        expect(response.status).toBe(200);
        expect(response.body.verified).toBe(true);
      });

      it('should return 404 without SSO config', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const response = await request(app).post('/api/sso/domains/1/verify');

        expect(response.status).toBe(404);
      });
    });

    describe('DELETE /api/sso/domains/:id', () => {
      it('should delete domain', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 'config-1' }] });
        SSOService.deleteDomain.mockResolvedValue(true);

        const response = await request(app).delete('/api/sso/domains/1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return 404 without SSO config', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const response = await request(app).delete('/api/sso/domains/1');

        expect(response.status).toBe(404);
      });
    });
  });

  describe('SSO Auth Endpoints', () => {
    describe('GET /api/sso/check', () => {
      it('should check if email requires SSO', async () => {
        SSOService.checkEmailSSO.mockResolvedValue({ ssoRequired: true, configId: 'config-1' });

        const response = await request(app).get('/api/sso/check?email=user@example.com');

        expect(response.status).toBe(200);
        expect(response.body.ssoRequired).toBe(true);
      });

      it('should return 400 without email', async () => {
        const response = await request(app).get('/api/sso/check');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Email is required');
      });

      it('should handle check errors', async () => {
        SSOService.checkEmailSSO.mockRejectedValue(new Error('Check failed'));

        const response = await request(app).get('/api/sso/check?email=user@example.com');

        expect(response.status).toBe(500);
      });
    });

    describe('GET /api/sso/login/:domain', () => {
      it('should initiate SAML login', async () => {
        SSOService.getSSOConfigByDomain.mockResolvedValue({
          id: 'config-1',
          provider_type: 'saml',
          is_enabled: true
        });
        SAMLService.generateAuthRequest.mockResolvedValue({ url: 'https://idp.example.com/sso' });
        SSOService.logLoginAttempt.mockResolvedValue(true);

        const response = await request(app).get('/api/sso/login/example.com');

        expect(response.status).toBe(200);
        expect(response.body.authUrl).toBeDefined();
        expect(response.body.state).toBeDefined();
      });

      it('should initiate OIDC login', async () => {
        SSOService.getSSOConfigByDomain.mockResolvedValue({
          id: 'config-1',
          provider_type: 'oidc',
          is_enabled: true
        });
        OIDCService.generateAuthorizationUrl.mockResolvedValue({
          url: 'https://idp.example.com/authorize',
          nonce: 'nonce123',
          codeVerifier: 'verifier123'
        });
        SSOService.logLoginAttempt.mockResolvedValue(true);

        const response = await request(app).get('/api/sso/login/example.com');

        expect(response.status).toBe(200);
        expect(response.body.authUrl).toBeDefined();
      });

      it('should return 404 for unconfigured domain', async () => {
        SSOService.getSSOConfigByDomain.mockResolvedValue(null);

        const response = await request(app).get('/api/sso/login/unknown.com');

        expect(response.status).toBe(404);
        expect(response.body.error).toContain('not configured');
      });

      it('should return 400 for disabled SSO', async () => {
        SSOService.getSSOConfigByDomain.mockResolvedValue({ is_enabled: false });

        const response = await request(app).get('/api/sso/login/example.com');

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('not enabled');
      });
    });

    describe('GET /api/sso/check-domain', () => {
      it('should return SSO info for configured domain', async () => {
        SSOService.getSSOConfigByDomain.mockResolvedValue({
          id: 'config-1',
          provider_type: 'saml',
          name: 'Corp SSO',
          is_enabled: true,
          is_enforced: true
        });

        const response = await request(app).get('/api/sso/check-domain?email=user@example.com');

        expect(response.status).toBe(200);
        expect(response.body.ssoAvailable).toBe(true);
        expect(response.body.ssoRequired).toBe(true);
        expect(response.body.provider).toBe('saml');
      });

      it('should return ssoAvailable false for unconfigured domain', async () => {
        SSOService.getSSOConfigByDomain.mockResolvedValue(null);

        const response = await request(app).get('/api/sso/check-domain?email=user@example.com');

        expect(response.status).toBe(200);
        expect(response.body.ssoAvailable).toBe(false);
      });

      it('should return 400 without email', async () => {
        const response = await request(app).get('/api/sso/check-domain');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Email required');
      });

      it('should return 400 for invalid email format', async () => {
        const response = await request(app).get('/api/sso/check-domain?email=invalid');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid email format');
      });
    });
  });

  describe('OIDC Endpoints', () => {
    describe('POST /api/sso/oidc/refresh', () => {
      it('should refresh tokens', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ attributes: { refresh_token_encrypted: 'enc_token' } }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'test@example.com' }] });
        OIDCService.refreshTokens.mockResolvedValue({ access_token: 'new_token', expires_in: 3600 });

        const response = await request(app)
          .post('/api/sso/oidc/refresh')
          .send({ configId: 'config-1' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return 400 without configId', async () => {
        const response = await request(app).post('/api/sso/oidc/refresh').send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Configuration ID required');
      });

      it('should return 400 without SSO session', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const response = await request(app)
          .post('/api/sso/oidc/refresh')
          .send({ configId: 'config-1' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('No SSO session found');
      });
    });

    describe('GET /api/sso/oidc/userinfo', () => {
      it('should get user info', async () => {
        db.query.mockResolvedValue({
          rows: [{ attributes: { access_token_encrypted: 'enc_token' } }]
        });
        OIDCService.getUserInfo.mockResolvedValue({ email: 'user@example.com', name: 'User' });

        const response = await request(app).get('/api/sso/oidc/userinfo?configId=1');

        expect(response.status).toBe(200);
        expect(response.body.userInfo).toBeDefined();
      });

      it('should return 400 without configId', async () => {
        const response = await request(app).get('/api/sso/oidc/userinfo');

        expect(response.status).toBe(400);
      });
    });

    describe('POST /api/sso/oidc/discover', () => {
      it('should discover OIDC configuration', async () => {
        const discovery = { authorization_endpoint: 'https://idp.example.com/authorize' };
        OIDCService.discoverConfiguration.mockResolvedValue(discovery);

        const response = await request(app)
          .post('/api/sso/oidc/discover')
          .send({ issuerUrl: 'https://idp.example.com' });

        expect(response.status).toBe(200);
        expect(response.body.discovery).toEqual(discovery);
      });

      it('should return 400 without issuerUrl', async () => {
        const response = await request(app).post('/api/sso/oidc/discover').send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Issuer URL required');
      });
    });
  });

  describe('SCIM Token Endpoints', () => {
    describe('POST /api/sso/config/:id/scim/tokens', () => {
      it('should generate SCIM token', async () => {
        SCIMService.generateToken.mockResolvedValue({ token: 'scim_token_123' });

        const response = await request(app)
          .post('/api/sso/config/config-1/scim/tokens')
          .send({ name: 'API Token' });

        expect(response.status).toBe(201);
        expect(response.body.token).toBeDefined();
      });

      it('should return 404 for non-existent config', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const response = await request(app)
          .post('/api/sso/config/non-existent/scim/tokens')
          .send({});

        expect(response.status).toBe(404);
      });
    });

    describe('GET /api/sso/config/:id/scim/tokens', () => {
      it('should list SCIM tokens', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 'config-1' }] })
          .mockResolvedValueOnce({ rows: [{ id: 'token-1', name: 'Token 1' }] });

        const response = await request(app).get('/api/sso/config/config-1/scim/tokens');

        expect(response.status).toBe(200);
        expect(response.body.tokens).toBeDefined();
      });
    });

    describe('DELETE /api/sso/config/:id/scim/tokens/:tokenId', () => {
      it('should revoke SCIM token', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 'config-1' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).delete('/api/sso/config/config-1/scim/tokens/token-1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Group Mapping Endpoints', () => {
    describe('GET /api/sso/config/:id/groups', () => {
      it('should return group mappings', async () => {
        SSOGroupService.getMappings.mockResolvedValue([{ id: 'mapping-1' }]);

        const response = await request(app).get('/api/sso/config/config-1/groups');

        expect(response.status).toBe(200);
        expect(response.body.mappings).toBeDefined();
      });

      it('should return 404 for non-existent config', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const response = await request(app).get('/api/sso/config/non-existent/groups');

        expect(response.status).toBe(404);
      });
    });

    describe('POST /api/sso/config/:id/groups', () => {
      it('should create group mapping', async () => {
        SSOGroupService.createMapping.mockResolvedValue({ id: 'mapping-new' });

        const response = await request(app)
          .post('/api/sso/config/config-1/groups')
          .send({ idp_group: 'Admins', local_role: 'admin' });

        expect(response.status).toBe(201);
        expect(response.body.mapping).toBeDefined();
      });
    });

    describe('PUT /api/sso/config/:id/groups/:mappingId', () => {
      it('should update group mapping', async () => {
        SSOGroupService.updateMapping.mockResolvedValue({ id: 'mapping-1', local_role: 'editor' });

        const response = await request(app)
          .put('/api/sso/config/config-1/groups/mapping-1')
          .send({ local_role: 'editor' });

        expect(response.status).toBe(200);
      });
    });

    describe('DELETE /api/sso/config/:id/groups/:mappingId', () => {
      it('should delete group mapping', async () => {
        SSOGroupService.deleteMapping.mockResolvedValue(true);

        const response = await request(app).delete('/api/sso/config/config-1/groups/mapping-1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Attribute Mapping Endpoints', () => {
    describe('GET /api/sso/config/:id/attributes', () => {
      it('should return attribute mappings', async () => {
        SSOGroupService.getAttributeMappings.mockResolvedValue([{ id: 'attr-1' }]);

        const response = await request(app).get('/api/sso/config/config-1/attributes');

        expect(response.status).toBe(200);
        expect(response.body.mappings).toBeDefined();
      });
    });

    describe('POST /api/sso/config/:id/attributes', () => {
      it('should create attribute mapping', async () => {
        SSOGroupService.createAttributeMapping.mockResolvedValue({ id: 'attr-new' });

        const response = await request(app)
          .post('/api/sso/config/config-1/attributes')
          .send({ idp_attribute: 'email', local_field: 'email' });

        expect(response.status).toBe(201);
      });
    });

    describe('PUT /api/sso/config/:id/attributes/:mappingId', () => {
      it('should update attribute mapping', async () => {
        SSOGroupService.updateAttributeMapping.mockResolvedValue({ id: 'attr-1' });

        const response = await request(app)
          .put('/api/sso/config/config-1/attributes/attr-1')
          .send({ local_field: 'name' });

        expect(response.status).toBe(200);
      });
    });

    describe('DELETE /api/sso/config/:id/attributes/:mappingId', () => {
      it('should delete attribute mapping', async () => {
        SSOGroupService.deleteAttributeMapping.mockResolvedValue(true);

        const response = await request(app).delete('/api/sso/config/config-1/attributes/attr-1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Analytics Endpoints', () => {
    describe('GET /api/sso/config/:id/analytics', () => {
      it('should return analytics', async () => {
        SSOAnalyticsService.getAnalytics.mockResolvedValue({ logins: 100, unique_users: 50 });

        const response = await request(app).get('/api/sso/config/config-1/analytics');

        expect(response.status).toBe(200);
      });

      it('should pass date params', async () => {
        SSOAnalyticsService.getAnalytics.mockResolvedValue({});

        await request(app).get('/api/sso/config/config-1/analytics?startDate=2024-01-01&endDate=2024-12-31');

        expect(SSOAnalyticsService.getAnalytics).toHaveBeenCalledWith('config-1', {
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });
      });
    });

    describe('GET /api/sso/config/:id/analytics/realtime', () => {
      it('should return real-time stats', async () => {
        SSOAnalyticsService.getRealTimeStats.mockResolvedValue({ active_sessions: 10 });

        const response = await request(app).get('/api/sso/config/config-1/analytics/realtime');

        expect(response.status).toBe(200);
      });
    });

    describe('GET /api/sso/config/:id/analytics/top-users', () => {
      it('should return top users', async () => {
        SSOAnalyticsService.getTopUsers.mockResolvedValue([{ email: 'user@test.com', logins: 50 }]);

        const response = await request(app).get('/api/sso/config/config-1/analytics/top-users?limit=5');

        expect(response.status).toBe(200);
        expect(SSOAnalyticsService.getTopUsers).toHaveBeenCalledWith('config-1', 5);
      });
    });

    describe('GET /api/sso/config/:id/analytics/export', () => {
      it('should export analytics as CSV', async () => {
        SSOAnalyticsService.exportToCSV.mockResolvedValue('email,logins\nuser@test.com,50');

        const response = await request(app).get('/api/sso/config/config-1/analytics/export');

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/csv');
      });
    });
  });

  describe('SSO Logout', () => {
    describe('POST /api/sso/logout', () => {
      it('should return success without SSO session', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const response = await request(app).post('/api/sso/logout');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return logout URL for SAML', async () => {
        db.query.mockResolvedValue({ rows: [{ sso_configuration_id: 'config-1', external_id: 'ext-1' }] });
        SSOService.getFullConfig.mockResolvedValue({ provider_type: 'saml' });
        SAMLService.generateLogoutRequest.mockResolvedValue({ url: 'https://idp.example.com/logout' });

        const response = await request(app).post('/api/sso/logout');

        expect(response.status).toBe(200);
        expect(response.body.logoutUrl).toBeDefined();
      });

      it('should return logout URL for OIDC', async () => {
        db.query.mockResolvedValue({ rows: [{ sso_configuration_id: 'config-1', external_id: 'ext-1' }] });
        SSOService.getFullConfig.mockResolvedValue({ provider_type: 'oidc' });
        OIDCService.getEndSessionUrl.mockResolvedValue('https://idp.example.com/logout');

        const response = await request(app).post('/api/sso/logout');

        expect(response.status).toBe(200);
        expect(response.body.logoutUrl).toBe('https://idp.example.com/logout');
      });
    });
  });
});
