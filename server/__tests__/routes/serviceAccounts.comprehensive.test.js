/**
 * Service Accounts Routes Comprehensive Tests
 * Tests for serviceAccounts.js routes
 */

const request = require('supertest');
const express = require('express');

// Mock db.query
const mockQuery = jest.fn();

jest.mock('../../db', () => ({
  query: (...args) => mockQuery(...args)
}));

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', role: 'admin' };
  next();
});

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: (req, res, next) => {
    req.organization = { id: 1, name: 'Test Org' };
    next();
  },
  requireOrganization: (req, res, next) => {
    if (!req.organization) {
      return res.status(403).json({ success: false, message: 'Organization required' });
    }
    next();
  }
}));

jest.mock('../../middleware/checkPermission', () => ({
  checkPermission: (permission) => (req, res, next) => {
    // Allow all for tests
    next();
  }
}));

const serviceAccountsRoutes = require('../../routes/serviceAccounts');

const app = express();
app.use(express.json());
app.use('/api/service-accounts', serviceAccountsRoutes);

describe('Service Accounts Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =====================
  // GET /api/service-accounts
  // =====================

  describe('GET /api/service-accounts', () => {
    it('should get all service accounts', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: 'CI/CD Pipeline',
            description: 'For automated deployments',
            is_active: true,
            created_by: 1,
            created_by_name: 'Admin',
            created_by_email: 'admin@test.com',
            token_count: '2',
            last_used_at: '2024-01-01',
            created_at: '2024-01-01',
            updated_at: '2024-01-01'
          }
        ]
      });

      const res = await request(app).get('/api/service-accounts');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('CI/CD Pipeline');
    });

    it('should return empty array when no service accounts', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/service-accounts');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/service-accounts');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =====================
  // POST /api/service-accounts
  // =====================

  describe('POST /api/service-accounts', () => {
    it('should create service account', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // duplicate check
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            name: 'New Service Account',
            description: 'Description',
            is_active: true,
            created_by: 1,
            created_at: '2024-01-01',
            updated_at: '2024-01-01'
          }]
        });

      const res = await request(app)
        .post('/api/service-accounts')
        .send({ name: 'New Service Account', description: 'Description' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Service Account');
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(app)
        .post('/api/service-accounts')
        .send({ description: 'No name' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('name is required');
    });

    it('should return 400 if name is empty', async () => {
      const res = await request(app)
        .post('/api/service-accounts')
        .send({ name: '   ' });

      expect(res.status).toBe(400);
    });

    it('should return 400 if name is too long', async () => {
      const res = await request(app)
        .post('/api/service-accounts')
        .send({ name: 'a'.repeat(256) });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('255 characters');
    });

    it('should return 409 if name already exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 2 }] }); // duplicate exists

      const res = await request(app)
        .post('/api/service-accounts')
        .send({ name: 'Existing Name' });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already exists');
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app)
        .post('/api/service-accounts')
        .send({ name: 'Test' });

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // GET /api/service-accounts/:id
  // =====================

  describe('GET /api/service-accounts/:id', () => {
    it('should get service account by id', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            name: 'CI/CD',
            description: 'Pipeline',
            is_active: true,
            created_by: 1,
            created_by_name: 'Admin',
            created_by_email: 'admin@test.com',
            created_at: '2024-01-01',
            updated_at: '2024-01-01'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            total_tokens: '2',
            active_tokens: '1',
            last_used_at: '2024-01-01',
            total_requests: '100'
          }]
        });

      const res = await request(app).get('/api/service-accounts/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('CI/CD');
      expect(res.body.data.stats.totalTokens).toBe(2);
    });

    it('should return 404 if not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/service-accounts/999');

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/service-accounts/1');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // PUT /api/service-accounts/:id
  // =====================

  describe('PUT /api/service-accounts/:id', () => {
    it('should update service account', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // ownership check
        .mockResolvedValueOnce({ rows: [] }) // duplicate check
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            name: 'Updated Name',
            description: 'Updated description',
            is_active: true,
            updated_at: '2024-01-01'
          }]
        });

      const res = await request(app)
        .put('/api/service-accounts/1')
        .send({ name: 'Updated Name', description: 'Updated description' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should update only description', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            name: 'Same Name',
            description: 'New Description',
            is_active: true,
            updated_at: '2024-01-01'
          }]
        });

      const res = await request(app)
        .put('/api/service-accounts/1')
        .send({ description: 'New Description' });

      expect(res.status).toBe(200);
    });

    it('should update isActive status', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            name: 'Test',
            description: null,
            is_active: false,
            updated_at: '2024-01-01'
          }]
        });

      const res = await request(app)
        .put('/api/service-accounts/1')
        .send({ isActive: false });

      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/service-accounts/999')
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('should return 400 if name is empty', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await request(app)
        .put('/api/service-accounts/1')
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('cannot be empty');
    });

    it('should return 409 if duplicate name', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }); // duplicate exists

      const res = await request(app)
        .put('/api/service-accounts/1')
        .send({ name: 'Duplicate Name' });

      expect(res.status).toBe(409);
    });

    it('should return 400 if no valid fields', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await request(app)
        .put('/api/service-accounts/1')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('No valid fields');
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app)
        .put('/api/service-accounts/1')
        .send({ name: 'Test' });

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // DELETE /api/service-accounts/:id
  // =====================

  describe('DELETE /api/service-accounts/:id', () => {
    it('should delete service account', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'To Delete' }] })
        .mockResolvedValueOnce({ rowCount: 2 }) // delete tokens
        .mockResolvedValueOnce({ rowCount: 1 }); // delete service account

      const res = await request(app).delete('/api/service-accounts/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted');
    });

    it('should return 404 if not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/service-accounts/999');

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).delete('/api/service-accounts/1');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // POST /api/service-accounts/:id/tokens
  // =====================

  describe('POST /api/service-accounts/:id/tokens', () => {
    it('should create token for service account', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'SA', is_active: true }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            token_name: 'New Token',
            token_preview: 'abc...xyz',
            expires_at: null,
            is_active: true,
            created_at: '2024-01-01'
          }]
        });

      const res = await request(app)
        .post('/api/service-accounts/1/tokens')
        .send({ tokenName: 'New Token' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.warning).toContain('Save this token');
    });

    it('should create token with expiration', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'SA', is_active: true }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            token_name: 'Expiring Token',
            token_preview: 'abc...xyz',
            expires_at: '2024-12-31',
            is_active: true,
            created_at: '2024-01-01'
          }]
        });

      const res = await request(app)
        .post('/api/service-accounts/1/tokens')
        .send({ tokenName: 'Expiring Token', expiresInDays: 30 });

      expect(res.status).toBe(201);
    });

    it('should return 404 if service account not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/service-accounts/999/tokens')
        .send({ tokenName: 'Token' });

      expect(res.status).toBe(404);
    });

    it('should return 400 if service account inactive', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: 'SA', is_active: false }] });

      const res = await request(app)
        .post('/api/service-accounts/1/tokens')
        .send({ tokenName: 'Token' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('inactive');
    });

    it('should return 400 if token name missing', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: 'SA', is_active: true }] });

      const res = await request(app)
        .post('/api/service-accounts/1/tokens')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('name is required');
    });

    it('should return 400 if token name empty', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: 'SA', is_active: true }] });

      const res = await request(app)
        .post('/api/service-accounts/1/tokens')
        .send({ tokenName: '   ' });

      expect(res.status).toBe(400);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app)
        .post('/api/service-accounts/1/tokens')
        .send({ tokenName: 'Token' });

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // GET /api/service-accounts/:id/tokens
  // =====================

  describe('GET /api/service-accounts/:id/tokens', () => {
    it('should get tokens for service account', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // SA check
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              token_name: 'Token 1',
              token_preview: 'abc...xyz',
              is_active: true,
              expires_at: null,
              last_used_at: '2024-01-01',
              created_at: '2024-01-01',
              updated_at: '2024-01-01',
              request_count: '100',
              total_tokens_used: '5000',
              total_cost: '0.50'
            }
          ]
        });

      const res = await request(app).get('/api/service-accounts/1/tokens');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].usage.requestCount).toBe(100);
    });

    it('should return 404 if service account not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/service-accounts/999/tokens');

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/service-accounts/1/tokens');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // PUT /api/service-accounts/:saId/tokens/:tokenId
  // =====================

  describe('PUT /api/service-accounts/:saId/tokens/:tokenId', () => {
    it('should update token', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // SA check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // token check
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            token_name: 'Updated Token',
            is_active: true,
            updated_at: '2024-01-01'
          }]
        });

      const res = await request(app)
        .put('/api/service-accounts/1/tokens/1')
        .send({ tokenName: 'Updated Token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should deactivate token', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            token_name: 'Token',
            is_active: false,
            updated_at: '2024-01-01'
          }]
        });

      const res = await request(app)
        .put('/api/service-accounts/1/tokens/1')
        .send({ isActive: false });

      expect(res.status).toBe(200);
    });

    it('should return 404 if service account not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/service-accounts/999/tokens/1')
        .send({ tokenName: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('should return 404 if token not found', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/service-accounts/1/tokens/999')
        .send({ tokenName: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('should return 400 if no valid fields', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await request(app)
        .put('/api/service-accounts/1/tokens/1')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app)
        .put('/api/service-accounts/1/tokens/1')
        .send({ tokenName: 'Updated' });

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // DELETE /api/service-accounts/:saId/tokens/:tokenId
  // =====================

  describe('DELETE /api/service-accounts/:saId/tokens/:tokenId', () => {
    it('should delete token', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).delete('/api/service-accounts/1/tokens/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if service account not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/service-accounts/999/tokens/1');

      expect(res.status).toBe(404);
    });

    it('should return 404 if token not found', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/service-accounts/1/tokens/999');

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).delete('/api/service-accounts/1/tokens/1');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // POST /api/service-accounts/:saId/tokens/:tokenId/regenerate
  // =====================

  describe('POST /api/service-accounts/:saId/tokens/:tokenId/regenerate', () => {
    it('should regenerate token', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            token_name: 'Regenerated',
            token_preview: 'new...xyz',
            expires_at: null,
            is_active: true,
            updated_at: '2024-01-01'
          }]
        });

      const res = await request(app).post('/api/service-accounts/1/tokens/1/regenerate');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it('should return 404 if service account not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).post('/api/service-accounts/999/tokens/1/regenerate');

      expect(res.status).toBe(404);
    });

    it('should return 404 if token not found', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).post('/api/service-accounts/1/tokens/999/regenerate');

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).post('/api/service-accounts/1/tokens/1/regenerate');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // GET /api/service-accounts/:id/usage
  // =====================

  describe('GET /api/service-accounts/:id/usage', () => {
    it('should get usage statistics', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({
          rows: [{
            total_requests: '500',
            total_tokens_used: '10000',
            total_cost: '1.50',
            last_used_at: '2024-01-01'
          }]
        })
        .mockResolvedValueOnce({
          rows: [
            { date: '2024-01-01', requests: '100', tokens_used: '2000', cost: '0.30' },
            { date: '2024-01-02', requests: '150', tokens_used: '3000', cost: '0.45' }
          ]
        });

      const res = await request(app).get('/api/service-accounts/1/usage');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/service-accounts/999/usage');

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/service-accounts/1/usage');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // GET /api/service-accounts/:saId/tokens/:tokenId/usage
  // =====================

  describe('GET /api/service-accounts/:saId/tokens/:tokenId/usage', () => {
    it('should get token usage statistics', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({
          rows: [{
            total_requests: '100',
            total_tokens_used: '2000',
            total_cost: '0.30'
          }]
        })
        .mockResolvedValueOnce({
          rows: [
            { date: '2024-01-01', requests: '50', tokens_used: '1000', cost: '0.15' }
          ]
        });

      const res = await request(app).get('/api/service-accounts/1/tokens/1/usage');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if service account not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/service-accounts/999/tokens/1/usage');

      expect(res.status).toBe(404);
    });

    it('should return 404 if token not found', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/service-accounts/1/tokens/999/usage');

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/service-accounts/1/tokens/1/usage');

      expect(res.status).toBe(500);
    });
  });
});
