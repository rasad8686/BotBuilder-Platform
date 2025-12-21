/**
 * Bots Routes Tests
 * Tests for server/routes/bots.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
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

jest.mock('../../middleware/audit', () => ({
  logBotCreated: jest.fn().mockResolvedValue({}),
  logBotUpdated: jest.fn().mockResolvedValue({}),
  logBotDeleted: jest.fn().mockResolvedValue({})
}));

jest.mock('../../services/webhookService', () => ({
  trigger: jest.fn().mockResolvedValue({})
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
const botsRouter = require('../../routes/bots');

const app = express();
app.use(express.json());
app.use('/api/bots', botsRouter);

describe('Bots Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/bots', () => {
    it('should create bot successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] }) // Plan check
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // Bot count
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          name: 'Test Bot',
          platform: 'telegram',
          created_at: new Date()
        }] }); // Insert

      const response = await request(app)
        .post('/api/bots')
        .send({
          name: 'Test Bot',
          platform: 'telegram',
          description: 'A test bot'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.bot.name).toBe('Test Bot');
    });

    it('should reject missing name', async () => {
      const response = await request(app)
        .post('/api/bots')
        .send({ platform: 'telegram' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('name');
    });

    it('should reject missing platform', async () => {
      const response = await request(app)
        .post('/api/bots')
        .send({ name: 'Test Bot' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Platform');
    });

    it('should reject invalid platform', async () => {
      const response = await request(app)
        .post('/api/bots')
        .send({
          name: 'Test Bot',
          platform: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid platform');
    });

    it('should enforce plan limits', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Already at limit

      const response = await request(app)
        .post('/api/bots')
        .send({
          name: 'Test Bot',
          platform: 'telegram'
        });

      expect(response.status).toBe(403);
      expect(response.body.limitReached).toBe(true);
    });

    it('should handle duplicate bot names', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockRejectedValueOnce({ code: '23505' }); // Duplicate

      const response = await request(app)
        .post('/api/bots')
        .send({
          name: 'Test Bot',
          platform: 'telegram'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already have');
    });
  });

  describe('GET /api/bots', () => {
    it('should return all bots', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Bot 1', platform: 'telegram' },
          { id: 2, name: 'Bot 2', platform: 'discord' }
        ]
      });

      const response = await request(app).get('/api/bots');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.bots).toHaveLength(2);
    });

    it('should support pagination', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Bot 1' }]
        });

      const response = await request(app).get('/api/bots?page=1&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should enforce max limit', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/bots?page=1&limit=200');

      // Check that query was called with limit 100 (max)
      const calls = db.query.mock.calls;
      expect(calls[1][1]).toContain(100);
    });
  });

  describe('GET /api/bots/:id', () => {
    it('should return single bot', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test Bot', platform: 'telegram' }]
      });

      const response = await request(app).get('/api/bots/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.bot.name).toBe('Test Bot');
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/bots/999');

      expect(response.status).toBe(404);
    });

    it('should reject invalid ID', async () => {
      const response = await request(app).get('/api/bots/abc');

      // Route returns 404 for non-numeric IDs (bot not found)
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/bots/:id', () => {
    it('should update bot', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Old Name' }] }) // Check exists
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'New Name' }] }); // Update

      const response = await request(app)
        .put('/api/bots/1')
        .send({ name: 'New Name' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/bots/999')
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
    });

    it('should reject empty name', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .put('/api/bots/1')
        .send({ name: '   ' });

      expect(response.status).toBe(400);
    });

    it('should reject invalid platform', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .put('/api/bots/1')
        .send({ platform: 'invalid' });

      expect(response.status).toBe(400);
    });

    it('should reject invalid is_active type', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .put('/api/bots/1')
        .send({ is_active: 'yes' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('boolean');
    });

    it('should require at least one field', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .put('/api/bots/1')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/bots/:id', () => {
    it('should delete bot', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ name: 'Test Bot', platform: 'telegram' }] }) // Check exists
        .mockResolvedValueOnce({ rows: [] }); // Delete

      const response = await request(app).delete('/api/bots/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.deletedId).toBe(1);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).delete('/api/bots/999');

      expect(response.status).toBe(404);
    });
  });
});
