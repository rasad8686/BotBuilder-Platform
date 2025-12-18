/**
 * SSO Routes Integration Tests
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../../db', () => {
  const mockKnex = jest.fn(() => mockKnex);
  mockKnex.where = jest.fn().mockReturnThis();
  mockKnex.first = jest.fn();
  mockKnex.insert = jest.fn().mockReturnThis();
  mockKnex.update = jest.fn().mockReturnThis();
  mockKnex.del = jest.fn().mockReturnThis();
  mockKnex.returning = jest.fn();
  mockKnex.select = jest.fn().mockReturnThis();
  mockKnex.orderBy = jest.fn().mockReturnThis();
  mockKnex.fn = { now: jest.fn(() => new Date()) };
  return mockKnex;
});

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 1, email: 'admin@example.com', role_id: 1 };
    next();
  }
}));

const db = require('../../db');
const ssoRouter = require('../../routes/sso');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/sso', ssoRouter);

describe('SSO Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

      db.first.mockResolvedValue({ id: 1 }); // org check
      db.returning.mockResolvedValue([mockConfig]);

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
      expect(response.body.config.provider_type).toBe('oidc');
    });

    it('should return 400 for invalid provider type', async () => {
      const response = await request(app)
        .post('/api/sso/config')
        .send({
          provider_type: 'invalid',
          name: 'Test'
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/sso/config')
        .send({
          provider_type: 'oidc'
          // Missing name
        });

      expect(response.status).toBe(400);
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

      db.first.mockResolvedValue(mockConfig);

      const response = await request(app)
        .get('/api/sso/config');

      expect(response.status).toBe(200);
      expect(response.body).toBeTruthy();
    });

    it('should return null if no config exists', async () => {
      db.first.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/sso/config');

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });
  });

  describe('PUT /api/sso/config/:id', () => {
    it('should update existing config', async () => {
      const mockConfig = {
        id: 1,
        name: 'Updated Name',
        is_enabled: true
      };

      db.first.mockResolvedValue({ id: 1, organization_id: 1 });
      db.returning.mockResolvedValue([mockConfig]);

      const response = await request(app)
        .put('/api/sso/config/1')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.config.name).toBe('Updated Name');
    });

    it('should return 404 for non-existing config', async () => {
      db.first.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/sso/config/999')
        .send({ name: 'Test' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/sso/config/:id', () => {
    it('should delete config', async () => {
      db.first.mockResolvedValue({ id: 1, organization_id: 1 });
      db.del.mockResolvedValue(1);

      const response = await request(app)
        .delete('/api/sso/config/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
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

      db.first.mockResolvedValue({ id: 1 }); // config check
      db.returning.mockResolvedValue([mockDomain]);

      const response = await request(app)
        .post('/api/sso/domains')
        .send({ domain: 'example.com' });

      expect(response.status).toBe(201);
      expect(response.body.domain).toBeTruthy();
      expect(response.body.domain.verification_token).toBeTruthy();
    });

    it('should return 400 for invalid domain', async () => {
      const response = await request(app)
        .post('/api/sso/domains')
        .send({ domain: '' });

      expect(response.status).toBe(400);
    });

    it('should return 409 for duplicate domain', async () => {
      db.first.mockResolvedValueOnce({ id: 1 }); // config check
      db.first.mockResolvedValueOnce({ id: 1, domain: 'example.com' }); // existing domain

      const response = await request(app)
        .post('/api/sso/domains')
        .send({ domain: 'example.com' });

      expect(response.status).toBe(409);
    });
  });

  describe('POST /api/sso/domains/:id/verify', () => {
    it('should verify domain with valid DNS', async () => {
      const mockDomain = {
        id: 1,
        domain: 'example.com',
        verification_token: 'token123',
        is_verified: false
      };

      db.first.mockResolvedValue(mockDomain);
      db.update.mockResolvedValue(1);

      // Mock successful DNS verification
      jest.spyOn(require('../../services/ssoService'), 'checkDNSVerification')
        .mockResolvedValue(true);

      const response = await request(app)
        .post('/api/sso/domains/1/verify');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should fail verification with invalid DNS', async () => {
      const mockDomain = {
        id: 1,
        domain: 'example.com',
        verification_token: 'token123',
        is_verified: false
      };

      db.first.mockResolvedValue(mockDomain);

      jest.spyOn(require('../../services/ssoService'), 'checkDNSVerification')
        .mockResolvedValue(false);

      const response = await request(app)
        .post('/api/sso/domains/1/verify');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
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

      db.first.mockResolvedValueOnce({ sso_configuration_id: 1, is_verified: true });
      db.first.mockResolvedValueOnce(mockConfig);

      const response = await request(app)
        .get('/api/sso/check-domain')
        .query({ email: 'user@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.ssoAvailable).toBe(true);
    });

    it('should return ssoAvailable false for unknown domain', async () => {
      db.first.mockResolvedValue(null);

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
      expect(response.header.location).toContain('error=sso_error');
    });

    it('should handle invalid state', async () => {
      const response = await request(app)
        .get('/api/sso/oidc/callback')
        .query({
          code: 'auth_code',
          state: 'invalid_state'
        });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('error=invalid_state');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 for database errors', async () => {
      db.first.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/sso/config');

      expect(response.status).toBe(500);
    });

    it('should include error message in response', async () => {
      db.first.mockRejectedValue(new Error('Specific error'));

      const response = await request(app)
        .get('/api/sso/config');

      expect(response.body.error).toBeTruthy();
    });
  });
});
