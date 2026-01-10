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

  // =====================================================
  // API KEY ROTATION TESTS
  // =====================================================

  describe('POST /api/api-tokens/:id/rotate', () => {
    it('should rotate token successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          token_name: 'Production API',
          bot_id: null,
          permissions: { read: true, write: true },
          expires_at: null
        }] }) // Get old token
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Update old token
        .mockResolvedValueOnce({ rows: [{
          id: 2,
          token_name: 'Production API (rotated)',
          token_preview: 'abc1...xyz4',
          expires_at: null,
          created_at: new Date()
        }] }) // Create new token
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const response = await request(app)
        .post('/api/api-tokens/1/rotate')
        .send({ overlapHours: 24 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.newToken).toBeDefined();
      expect(response.body.data.newToken.token).toBeDefined();
      expect(response.body.data.oldToken.validUntil).toBeDefined();
    });

    it('should use default overlap hours if not provided', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          token_name: 'Test Token',
          bot_id: null,
          permissions: {},
          expires_at: null
        }] })
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Update
        .mockResolvedValueOnce({ rows: [{
          id: 2,
          token_name: 'Test Token (rotated)',
          token_preview: 'abc1...xyz4',
          created_at: new Date()
        }] })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const response = await request(app)
        .post('/api/api-tokens/1/rotate')
        .send({});

      expect(response.status).toBe(201);
      expect(response.body.data.oldToken.overlapHours).toBe(24);
    });

    it('should clamp overlap hours to valid range', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          token_name: 'Test Token',
          bot_id: null,
          permissions: {},
          expires_at: null
        }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{
          id: 2,
          token_name: 'Test Token (rotated)',
          token_preview: 'abc1...xyz4',
          created_at: new Date()
        }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/api-tokens/1/rotate')
        .send({ overlapHours: 500 }); // Exceeds max of 168

      expect(response.status).toBe(201);
      expect(response.body.data.oldToken.overlapHours).toBe(168); // Clamped to max
    });

    it('should return 404 if token not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/api-tokens/999/rotate')
        .send({ overlapHours: 24 });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .post('/api/api-tokens/1/rotate')
        .send({ overlapHours: 24 });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/api-tokens/:id/schedule-rotation', () => {
    it('should schedule rotation successfully', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, token_name: 'Test Token' }] }) // Token check
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          token_name: 'Test Token',
          rotation_scheduled_at: futureDate
        }] }); // Update

      const response = await request(app)
        .post('/api/api-tokens/1/schedule-rotation')
        .send({ scheduledAt: futureDate.toISOString() });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rotationScheduledAt).toBeDefined();
    });

    it('should reject missing scheduledAt', async () => {
      const response = await request(app)
        .post('/api/api-tokens/1/schedule-rotation')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('scheduledAt');
    });

    it('should reject invalid date format', async () => {
      const response = await request(app)
        .post('/api/api-tokens/1/schedule-rotation')
        .send({ scheduledAt: 'not-a-date' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid date');
    });

    it('should reject past dates', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

      const response = await request(app)
        .post('/api/api-tokens/1/schedule-rotation')
        .send({ scheduledAt: pastDate.toISOString() });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('future');
    });

    it('should return 404 if token not found', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/api-tokens/999/schedule-rotation')
        .send({ scheduledAt: futureDate.toISOString() });

      expect(response.status).toBe(404);
    });

    it('should handle database errors', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .post('/api/api-tokens/1/schedule-rotation')
        .send({ scheduledAt: futureDate.toISOString() });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/api-tokens/:id/cancel-rotation', () => {
    it('should cancel scheduled rotation', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          token_name: 'Test Token',
          rotation_scheduled_at: new Date()
        }] }) // Token check
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          token_name: 'Test Token',
          rotation_scheduled_at: null
        }] }); // Update

      const response = await request(app)
        .delete('/api/api-tokens/1/cancel-rotation');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cancelled');
    });

    it('should return 400 if no rotation scheduled', async () => {
      db.query.mockResolvedValueOnce({ rows: [{
        id: 1,
        token_name: 'Test Token',
        rotation_scheduled_at: null
      }] });

      const response = await request(app)
        .delete('/api/api-tokens/1/cancel-rotation');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('No rotation is scheduled');
    });

    it('should return 404 if token not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .delete('/api/api-tokens/999/cancel-rotation');

      expect(response.status).toBe(404);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .delete('/api/api-tokens/1/cancel-rotation');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/api-tokens/:id/rotation-history', () => {
    it('should return rotation history', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Token check
        .mockResolvedValueOnce({ rows: [] }) // Child tokens
        .mockResolvedValueOnce({ rows: [{
          rotated_from_id: 1,
          parent_name: 'Original Token',
          parent_preview: 'old1...old4',
          parent_active: false,
          parent_created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }] }) // Parent result
        .mockResolvedValueOnce({ rows: [{
          id: 2,
          token_name: 'Current Token',
          token_preview: 'abc1...xyz4',
          is_active: true,
          rotation_scheduled_at: null,
          overlap_expires_at: null,
          created_at: new Date()
        }] }); // Current token

      const response = await request(app)
        .get('/api/api-tokens/2/rotation-history');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.current).toBeDefined();
      expect(response.body.data.rotatedFrom).toBeDefined();
      expect(response.body.data.rotatedTo).toEqual([]);
    });

    it('should return history with children', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Token check
        .mockResolvedValueOnce({ rows: [
          { id: 2, token_name: 'Rotated Token 1', token_preview: 'abc...', is_active: false, created_at: new Date() },
          { id: 3, token_name: 'Rotated Token 2', token_preview: 'def...', is_active: true, created_at: new Date() }
        ] }) // Child tokens
        .mockResolvedValueOnce({ rows: [{
          rotated_from_id: null,
          parent_name: null,
          parent_preview: null,
          parent_active: null,
          parent_created_at: null
        }] }) // No parent
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          token_name: 'Original Token',
          token_preview: 'abc1...xyz4',
          is_active: true,
          rotation_scheduled_at: null,
          overlap_expires_at: null,
          created_at: new Date()
        }] }); // Current token

      const response = await request(app)
        .get('/api/api-tokens/1/rotation-history');

      expect(response.status).toBe(200);
      expect(response.body.data.rotatedTo).toHaveLength(2);
    });

    it('should return 404 if token not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/api-tokens/999/rotation-history');

      expect(response.status).toBe(404);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .get('/api/api-tokens/1/rotation-history');

      expect(response.status).toBe(500);
    });
  });
});
