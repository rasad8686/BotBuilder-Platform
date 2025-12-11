/**
 * API Tokens Routes Tests
 * Tests for server/routes/api-tokens.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'admin@example.com', current_organization_id: 1 };
  next();
}));

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: jest.fn((req, res, next) => {
    req.organization = { id: 1, name: 'Test Org' };
    next();
  }),
  requireOrganization: jest.fn((req, res, next) => next())
}));

jest.mock('../../middleware/checkPermission', () => ({
  checkPermission: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const db = require('../../db');
const apiTokensRouter = require('../../routes/api-tokens');

const app = express();
app.use(express.json());
app.use('/api/api-tokens', apiTokensRouter);

describe('API Tokens Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/api-tokens', () => {
    it('should return all tokens for organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [
        { id: 1, token_name: 'Production API', token_preview: 'abc1...xyz4', is_active: true },
        { id: 2, token_name: 'Development API', token_preview: 'def2...uvw5', is_active: true }
      ] });

      const response = await request(app).get('/api/api-tokens');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/api-tokens');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/api-tokens', () => {
    it('should create new token', async () => {
      db.query.mockResolvedValueOnce({ rows: [{
        id: 1,
        user_id: 1,
        bot_id: null,
        token_name: 'New Token',
        token_preview: 'abc1...xyz4',
        expires_at: null,
        is_active: true
      }] });

      const response = await request(app)
        .post('/api/api-tokens')
        .send({ tokenName: 'New Token' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined(); // Should return actual token on creation
    });

    it('should create token with expiration', async () => {
      db.query.mockResolvedValueOnce({ rows: [{
        id: 1,
        token_name: 'Expiring Token',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }] });

      const response = await request(app)
        .post('/api/api-tokens')
        .send({ tokenName: 'Expiring Token', expiresInDays: 30 });

      expect(response.status).toBe(201);
    });

    it('should validate bot ownership', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // Bot not found

      const response = await request(app)
        .post('/api/api-tokens')
        .send({ tokenName: 'Token', botId: 999 });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Bot not found');
    });

    it('should reject empty token name', async () => {
      const response = await request(app)
        .post('/api/api-tokens')
        .send({ tokenName: '' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Token name is required');
    });

    it('should reject missing token name', async () => {
      const response = await request(app)
        .post('/api/api-tokens')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .post('/api/api-tokens')
        .send({ tokenName: 'Test' });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/api-tokens/:id', () => {
    it('should delete token', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Token check
        .mockResolvedValueOnce({ rows: [] }); // Delete

      const response = await request(app).delete('/api/api-tokens/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 if token not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).delete('/api/api-tokens/999');

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).delete('/api/api-tokens/1');

      expect(response.status).toBe(500);
    });
  });

  describe('PATCH /api/api-tokens/:id/toggle', () => {
    it('should toggle token status to inactive', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, is_active: true }] }) // Token check
        .mockResolvedValueOnce({ rows: [{ id: 1, is_active: false }] }); // Update

      const response = await request(app).patch('/api/api-tokens/1/toggle');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deactivated');
    });

    it('should toggle token status to active', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, is_active: false }] }) // Token check
        .mockResolvedValueOnce({ rows: [{ id: 1, is_active: true }] }); // Update

      const response = await request(app).patch('/api/api-tokens/1/toggle');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('activated');
    });

    it('should return 404 if token not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).patch('/api/api-tokens/999/toggle');

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).patch('/api/api-tokens/1/toggle');

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/api-tokens/:id/deactivate', () => {
    it('should deactivate token', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Token check
        .mockResolvedValueOnce({ rows: [{ id: 1, is_active: false }] }); // Update

      const response = await request(app).put('/api/api-tokens/1/deactivate');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deactivated');
    });

    it('should return 404 if token not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).put('/api/api-tokens/999/deactivate');

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).put('/api/api-tokens/1/deactivate');

      expect(response.status).toBe(500);
    });
  });
});
