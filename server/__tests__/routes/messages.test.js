/**
 * Messages Routes Tests
 * Tests for server/routes/messages.js
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

jest.mock('../../middleware/checkMessageLimit', () => ({
  checkMessageLimit: jest.fn((req, res, next) => {
    req.messageUsage = { used: 100, limit: 1000 };
    next();
  })
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
const messagesRouter = require('../../routes/messages');

const app = express();
app.use(express.json());
app.use('/api/messages', messagesRouter);

describe('Messages Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/messages', () => {
    it('should create message successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Bot verification
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          bot_id: 1,
          message_type: 'greeting',
          content: 'Hello!',
          trigger_keywords: 'hi,hello',
          organization_id: 1,
          created_at: new Date()
        }] }) // Insert
        .mockResolvedValueOnce({ rows: [] }); // Usage tracking

      const response = await request(app)
        .post('/api/messages')
        .send({
          bot_id: 1,
          message_type: 'greeting',
          content: 'Hello!',
          trigger_keywords: 'hi,hello'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message_type).toBe('greeting');
    });

    it('should reject missing bot_id', async () => {
      const response = await request(app)
        .post('/api/messages')
        .send({
          message_type: 'greeting',
          content: 'Hello!'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Bot ID');
    });

    it('should reject missing message_type', async () => {
      const response = await request(app)
        .post('/api/messages')
        .send({
          bot_id: 1,
          content: 'Hello!'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Message type');
    });

    it('should reject missing content', async () => {
      const response = await request(app)
        .post('/api/messages')
        .send({
          bot_id: 1,
          message_type: 'greeting'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('content');
    });

    it('should reject invalid message_type', async () => {
      const response = await request(app)
        .post('/api/messages')
        .send({
          bot_id: 1,
          message_type: 'invalid_type',
          content: 'Hello!'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid message type');
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // Bot not found

      const response = await request(app)
        .post('/api/messages')
        .send({
          bot_id: 999,
          message_type: 'greeting',
          content: 'Hello!'
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should handle foreign key error', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Bot exists
        .mockRejectedValueOnce({ code: '23503' }); // FK error

      const response = await request(app)
        .post('/api/messages')
        .send({
          bot_id: 1,
          message_type: 'greeting',
          content: 'Hello!'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid bot_id');
    });
  });

  describe('GET /api/messages/bot/:botId', () => {
    it('should return messages for bot', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Bot verification
        .mockResolvedValueOnce({ rows: [
          { id: 1, message_type: 'greeting', content: 'Hello!' },
          { id: 2, message_type: 'response', content: 'OK' }
        ] });

      const response = await request(app).get('/api/messages/bot/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should support pagination', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Bot verification
        .mockResolvedValueOnce({ rows: [{ count: '50' }] }) // Count
        .mockResolvedValueOnce({ rows: [{ id: 1, content: 'Test' }] }); // Messages

      const response = await request(app).get('/api/messages/bot/1?page=1&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should enforce max limit', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/messages/bot/1?page=1&limit=200');

      const calls = db.query.mock.calls;
      expect(calls[2][1]).toContain(100); // Max limit enforced
    });

    it('should reject invalid botId', async () => {
      const response = await request(app).get('/api/messages/bot/abc');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid');
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/messages/bot/999');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/messages/:id', () => {
    it('should return single message', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          message_type: 'greeting',
          content: 'Hello!',
          bot_id: 1
        }]
      });

      const response = await request(app).get('/api/messages/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe('Hello!');
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/messages/999');

      expect(response.status).toBe(404);
    });

    it('should reject invalid ID', async () => {
      const response = await request(app).get('/api/messages/abc');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid');
    });
  });

  describe('PUT /api/messages/:id', () => {
    it('should update message', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Check exists
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          message_type: 'response',
          content: 'Updated!'
        }] }); // Update

      const response = await request(app)
        .put('/api/messages/1')
        .send({ content: 'Updated!' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/messages/999')
        .send({ content: 'Updated!' });

      expect(response.status).toBe(404);
    });

    it('should reject empty update', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .put('/api/messages/1')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('At least one field');
    });

    it('should reject invalid message_type', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .put('/api/messages/1')
        .send({ message_type: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid message type');
    });

    it('should reject empty content', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .put('/api/messages/1')
        .send({ content: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('cannot be empty');
    });

    it('should reject invalid ID', async () => {
      const response = await request(app)
        .put('/api/messages/abc')
        .send({ content: 'Updated!' });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/messages/:id', () => {
    it('should delete message', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ message_type: 'greeting' }] }) // Check exists
        .mockResolvedValueOnce({ rows: [] }); // Delete

      const response = await request(app).delete('/api/messages/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.deletedId).toBe(1);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).delete('/api/messages/999');

      expect(response.status).toBe(404);
    });

    it('should reject invalid ID', async () => {
      const response = await request(app).delete('/api/messages/abc');

      expect(response.status).toBe(400);
    });
  });
});
