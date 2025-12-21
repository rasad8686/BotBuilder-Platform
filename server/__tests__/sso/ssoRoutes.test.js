/**
 * SSO Routes Integration Tests
 */

const request = require('supertest');
const express = require('express');

// Mock database - using db.query() pattern (PostgreSQL)
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

// Mock SSO services
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
  generateCodeVerifier: jest.fn().mockReturnValue('test-verifier'),
  generateCodeChallenge: jest.fn().mockReturnValue('test-challenge'),
  buildAuthorizationUrl: jest.fn().mockReturnValue('https://idp.example.com/auth'),
  exchangeCodeForTokens: jest.fn(),
  validateIdToken: jest.fn(),
  getUserInfo: jest.fn(),
  extractUserAttributes: jest.fn(),
  getEndSessionUrl: jest.fn(),
  discoverConfiguration: jest.fn(),
  refreshTokens: jest.fn()
}));

jest.mock('../../services/scimService', () => ({
  generateToken: jest.fn(),
  validateToken: jest.fn()
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

// Auth middleware - export the function directly
jest.mock('../../middleware/auth', () => {
  return (req, res, next) => {
    req.user = { id: 1, email: 'admin@example.com', role_id: 1, current_organization_id: 1, organization_id: 1 };
    next();
  };
});

const db = require('../../db');
const SSOService = require('../../services/ssoService');
const ssoRouter = require('../../routes/sso');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/sso', ssoRouter);

describe('SSO Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (ssoRouter.cleanup) {
      ssoRouter.cleanup();
    }
  });

  describe('POST /api/sso/config', () => {
    it('should create SSO config with valid data', async () => {
      const mockConfig = {
        id: 1,
        organization_id: 1,
        provider_type: 'oidc',
        name: 'Test OIDC',
        is_enabled: true
      };

      db.query.mockResolvedValueOnce({ rows: [{ role_id: 1 }] });
      SSOService.createSSOConfig.mockResolvedValue(mockConfig);

      const response = await request(app)
        .post('/api/sso/config')
        .send({
          provider_type: 'oidc',
          name: 'Test OIDC',
          client_id: 'test-client',
          client_secret: 'test-secret',
          issuer_url: 'https://issuer.example.com'
        });

      expect(response.status).toBe(201);
      expect(response.body.config).toBeTruthy();
    });

    it('should return 403 for non-admin users', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role_id: 3 }] })
        .mockResolvedValueOnce({ rows: [{ owner_id: 999 }] });

      const response = await request(app)
        .post('/api/sso/config')
        .send({
          provider_type: 'oidc',
          name: 'Test'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/sso/config', () => {
    it('should get SSO config for organization', async () => {
      const mockConfig = {
        id: 1,
        provider_type: 'oidc',
        name: 'Test OIDC',
        is_enabled: true
      };

      SSOService.getSSOConfigByOrg.mockResolvedValue(mockConfig);

      const response = await request(app)
        .get('/api/sso/config');

      expect(response.status).toBe(200);
      expect(response.body.config).toBeTruthy();
    });

    it('should return null if no config exists', async () => {
      SSOService.getSSOConfigByOrg.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/sso/config');

      expect(response.status).toBe(200);
      expect(response.body.config).toBeNull();
    });
  });

  describe('PUT /api/sso/config/:id', () => {
    it('should update existing config', async () => {
      const mockConfig = {
        id: 1,
        name: 'Updated Name',
        is_enabled: true
      };

      db.query.mockResolvedValue({ rows: [{ id: 1, organization_id: 1 }] });
      SSOService.updateSSOConfig.mockResolvedValue(mockConfig);

      const response = await request(app)
        .put('/api/sso/config/1')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.config.name).toBe('Updated Name');
    });

    it('should return 404 for non-existing config', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .put('/api/sso/config/999')
        .send({ name: 'Test' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/sso/config/:id', () => {
    it('should delete config', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, organization_id: 1 }] });
      SSOService.deleteSSOConfig.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/sso/config/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existing config', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .delete('/api/sso/config/999');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/sso/domains', () => {
    it('should add domain for SSO', async () => {
      const mockDomain = {
        id: 1,
        domain: 'example.com',
        verification_token: 'token123',
        is_verified: false
      };

      db.query.mockResolvedValue({ rows: [{ id: 1 }] });
      SSOService.addDomain.mockResolvedValue(mockDomain);

      const response = await request(app)
        .post('/api/sso/domains')
        .send({ domain: 'example.com' });

      expect(response.status).toBe(201);
      expect(response.body.domain).toBeTruthy();
    });

    it('should return 400 for missing domain', async () => {
      const response = await request(app)
        .post('/api/sso/domains')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 404 when no SSO config exists', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/sso/domains')
        .send({ domain: 'example.com' });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/sso/domains/:id/verify', () => {
    it('should verify domain', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });
      SSOService.verifySSODomain.mockResolvedValue({ verified: true, domain: 'example.com' });

      const response = await request(app)
        .post('/api/sso/domains/1/verify');

      expect(response.status).toBe(200);
    });

    it('should return 404 when no SSO config exists', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/sso/domains/1/verify');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/sso/check-domain', () => {
    it('should check if domain has SSO configured', async () => {
      const mockConfig = {
        id: 1,
        provider_type: 'oidc',
        name: 'Test SSO',
        is_enabled: true
      };

      SSOService.getSSOConfigByDomain.mockResolvedValue(mockConfig);

      const response = await request(app)
        .get('/api/sso/check-domain')
        .query({ email: 'user@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.ssoAvailable).toBe(true);
    });

    it('should return ssoAvailable false for unknown domain', async () => {
      SSOService.getSSOConfigByDomain.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/sso/check-domain')
        .query({ email: 'user@unknown.com' });

      expect(response.status).toBe(200);
      expect(response.body.ssoAvailable).toBe(false);
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .get('/api/sso/check-domain');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/sso/oidc/callback', () => {
    it('should handle callback error from IdP', async () => {
      const response = await request(app)
        .get('/api/sso/oidc/callback')
        .query({
          error: 'access_denied',
          error_description: 'User denied access'
        });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('error=sso_failed');
    });

    it('should return 400 for missing code or state', async () => {
      const response = await request(app)
        .get('/api/sso/oidc/callback')
        .query({});

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid state', async () => {
      const response = await request(app)
        .get('/api/sso/oidc/callback')
        .query({
          code: 'auth_code',
          state: 'invalid_state'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 for service errors', async () => {
      SSOService.getSSOConfigByOrg.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/sso/config');

      expect(response.status).toBe(500);
    });

    it('should include error message in response', async () => {
      SSOService.getSSOConfigByOrg.mockRejectedValue(new Error('Specific error'));

      const response = await request(app)
        .get('/api/sso/config');

      expect(response.body.error).toBeTruthy();
    });
  });
});
