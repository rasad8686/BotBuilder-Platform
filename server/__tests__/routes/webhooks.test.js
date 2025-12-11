/**
 * Webhooks Routes Tests
 * Tests for server/routes/webhooks.js
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
    req.organization = { id: 1, name: 'Test Org', role: 'admin' };
    next();
  }),
  requireOrganization: jest.fn((req, res, next) => next())
}));

jest.mock('../../services/webhookService', () => ({
  getAvailableEvents: jest.fn(),
  testWebhook: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const db = require('../../db');
const webhookService = require('../../services/webhookService');
const webhooksRouter = require('../../routes/webhooks');

const app = express();
app.use(express.json());
app.use('/api/webhooks', webhooksRouter);

describe('Webhooks Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/webhooks/events/list', () => {
    it('should return available webhook events', async () => {
      const mockEvents = [
        { name: 'bot.created', description: 'Bot created' },
        { name: 'bot.updated', description: 'Bot updated' }
      ];
      webhookService.getAvailableEvents.mockResolvedValueOnce(mockEvents);

      const response = await request(app).get('/api/webhooks/events/list');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should handle errors', async () => {
      webhookService.getAvailableEvents.mockRejectedValueOnce(new Error('Service error'));

      const response = await request(app).get('/api/webhooks/events/list');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/webhooks', () => {
    it('should return webhooks for organization', async () => {
      const mockWebhooks = [
        { id: 1, name: 'Test Webhook', url: 'http://example.com', events: ['bot.created'], total_attempts: '10', successful: '8', failed: '2' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockWebhooks });

      const response = await request(app).get('/api/webhooks');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].stats.success_rate).toBe(80);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/webhooks');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/webhooks', () => {
    it('should create webhook', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test', url: 'http://example.com', events: ['bot.created'] }] });

      const response = await request(app)
        .post('/api/webhooks')
        .send({
          name: 'Test',
          url: 'http://example.com',
          events: ['bot.created']
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should reject missing fields', async () => {
      const response = await request(app)
        .post('/api/webhooks')
        .send({ name: 'Test' });

      expect(response.status).toBe(400);
    });

    it('should reject invalid URL', async () => {
      const response = await request(app)
        .post('/api/webhooks')
        .send({
          name: 'Test',
          url: 'invalid-url',
          events: ['bot.created']
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid URL');
    });

    it('should reject empty events array', async () => {
      const response = await request(app)
        .post('/api/webhooks')
        .send({
          name: 'Test',
          url: 'http://example.com',
          events: []
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/webhooks/:id', () => {
    it('should update webhook', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: '123' }] }) // Check ownership
        .mockResolvedValueOnce({ rows: [{ id: '123', name: 'Updated' }] }); // Update

      const response = await request(app)
        .put('/api/webhooks/123')
        .send({ name: 'Updated' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/webhooks/999')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });

    it('should reject invalid URL', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: '123' }] });

      const response = await request(app)
        .put('/api/webhooks/123')
        .send({ url: 'invalid-url' });

      expect(response.status).toBe(400);
    });

    it('should reject empty events array', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: '123' }] });

      const response = await request(app)
        .put('/api/webhooks/123')
        .send({ events: [] });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/webhooks/:id', () => {
    it('should delete webhook', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: '123' }] });

      const response = await request(app).delete('/api/webhooks/123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).delete('/api/webhooks/999');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/webhooks/:id/test', () => {
    it('should test webhook', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: '123' }] });
      webhookService.testWebhook.mockResolvedValueOnce({ success: true, statusCode: 200 });

      const response = await request(app).post('/api/webhooks/123/test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).post('/api/webhooks/999/test');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/webhooks/:id/logs', () => {
    it('should return webhook logs', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: '123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, event_type: 'bot.created', delivery_status: 'success' }] });

      const response = await request(app).get('/api/webhooks/123/logs');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    it('should return 404 if webhook not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/webhooks/999/logs');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/webhooks/:id/regenerate-secret', () => {
    it('should regenerate webhook secret', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: '123' }] })
        .mockResolvedValueOnce({ rows: [{ id: '123', secret: 'new_secret' }] });

      const response = await request(app).post('/api/webhooks/123/regenerate-secret');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 if webhook not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).post('/api/webhooks/999/regenerate-secret');

      expect(response.status).toBe(404);
    });
  });
});
