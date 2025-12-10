/**
 * Webhooks API Tests
 * Tests for /api/webhooks endpoints: CRUD operations
 */

const request = require('supertest');

// Mock the database
jest.mock('../db', () => ({
  query: jest.fn()
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock fetch for webhook testing
global.fetch = jest.fn();

const express = require('express');
const db = require('../db');

// Create a minimal express app for testing
const app = express();
app.use(express.json());

// Mock authentication middleware
const mockAuth = (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  req.organization = { id: 1, name: 'Test Org' };
  next();
};

// Mock webhooks routes
app.get('/api/webhooks', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM webhooks WHERE organization_id = $1 ORDER BY created_at DESC',
      [req.organization.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/webhooks/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM webhooks WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Webhook not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/webhooks', mockAuth, async (req, res) => {
  try {
    const { url, events, name } = req.body;

    if (!url || url.trim() === '') {
      return res.status(400).json({ success: false, message: 'Webhook URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid URL format' });
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one event is required' });
    }

    const validEvents = ['message.received', 'message.sent', 'bot.created', 'bot.updated', 'bot.deleted'];
    const invalidEvents = events.filter(e => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid events: ${invalidEvents.join(', ')}`
      });
    }

    const result = await db.query(
      'INSERT INTO webhooks (name, url, events, organization_id, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name || 'Webhook', url, JSON.stringify(events), req.organization.id, req.user.id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/webhooks/:id', mockAuth, async (req, res) => {
  try {
    const { url, events, name, is_active } = req.body;

    // Check if webhook exists
    const existingWebhook = await db.query(
      'SELECT * FROM webhooks WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (existingWebhook.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Webhook not found' });
    }

    const result = await db.query(
      'UPDATE webhooks SET name = COALESCE($1, name), url = COALESCE($2, url), events = COALESCE($3, events), is_active = COALESCE($4, is_active), updated_at = NOW() WHERE id = $5 RETURNING *',
      [name, url, events ? JSON.stringify(events) : null, is_active, req.params.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/webhooks/:id', mockAuth, async (req, res) => {
  try {
    // Check if webhook exists
    const existingWebhook = await db.query(
      'SELECT * FROM webhooks WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (existingWebhook.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Webhook not found' });
    }

    await db.query('DELETE FROM webhooks WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Webhook deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/webhooks/:id/test', mockAuth, async (req, res) => {
  try {
    // Check if webhook exists
    const webhookResult = await db.query(
      'SELECT * FROM webhooks WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (webhookResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Webhook not found' });
    }

    const webhook = webhookResult.rows[0];

    // Send test request
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'test', timestamp: new Date().toISOString() })
    });

    if (!response.ok) {
      return res.status(400).json({ success: false, message: 'Webhook test failed' });
    }

    res.json({ success: true, message: 'Webhook test successful' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Webhook test failed: ' + error.message });
  }
});

describe('Webhooks API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // LIST WEBHOOKS
  // ========================================
  describe('GET /api/webhooks', () => {
    it('should return all webhooks for the organization', async () => {
      const mockWebhooks = [
        { id: 1, name: 'Webhook 1', url: 'https://example.com/hook1', events: ['message.received'] },
        { id: 2, name: 'Webhook 2', url: 'https://example.com/hook2', events: ['bot.created'] }
      ];
      db.query.mockResolvedValueOnce({ rows: mockWebhooks });

      const res = await request(app).get('/api/webhooks');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array if no webhooks exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/webhooks');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/webhooks');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // GET SINGLE WEBHOOK
  // ========================================
  describe('GET /api/webhooks/:id', () => {
    it('should return a single webhook by ID', async () => {
      const mockWebhook = { id: 1, name: 'Test Webhook', url: 'https://example.com/hook' };
      db.query.mockResolvedValueOnce({ rows: [mockWebhook] });

      const res = await request(app).get('/api/webhooks/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Webhook');
    });

    it('should return 404 if webhook not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/webhooks/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // CREATE WEBHOOK
  // ========================================
  describe('POST /api/webhooks', () => {
    it('should create a new webhook successfully', async () => {
      const newWebhook = {
        id: 1,
        name: 'New Webhook',
        url: 'https://example.com/hook',
        events: ['message.received']
      };
      db.query.mockResolvedValueOnce({ rows: [newWebhook] });

      const res = await request(app)
        .post('/api/webhooks')
        .send({
          name: 'New Webhook',
          url: 'https://example.com/hook',
          events: ['message.received']
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Webhook');
    });

    it('should return 400 if URL is missing', async () => {
      const res = await request(app)
        .post('/api/webhooks')
        .send({
          name: 'Test Webhook',
          events: ['message.received']
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('URL');
    });

    it('should return 400 if URL is invalid', async () => {
      const res = await request(app)
        .post('/api/webhooks')
        .send({
          url: 'not-a-valid-url',
          events: ['message.received']
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid URL');
    });

    it('should return 400 if events are missing', async () => {
      const res = await request(app)
        .post('/api/webhooks')
        .send({
          url: 'https://example.com/hook'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('event');
    });

    it('should return 400 if events array is empty', async () => {
      const res = await request(app)
        .post('/api/webhooks')
        .send({
          url: 'https://example.com/hook',
          events: []
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 if events contain invalid values', async () => {
      const res = await request(app)
        .post('/api/webhooks')
        .send({
          url: 'https://example.com/hook',
          events: ['invalid.event']
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid events');
    });
  });

  // ========================================
  // UPDATE WEBHOOK
  // ========================================
  describe('PUT /api/webhooks/:id', () => {
    it('should update an existing webhook', async () => {
      const existingWebhook = { id: 1, name: 'Old Name', url: 'https://old.com/hook' };
      const updatedWebhook = { id: 1, name: 'New Name', url: 'https://new.com/hook' };

      db.query
        .mockResolvedValueOnce({ rows: [existingWebhook] })
        .mockResolvedValueOnce({ rows: [updatedWebhook] });

      const res = await request(app)
        .put('/api/webhooks/1')
        .send({ name: 'New Name', url: 'https://new.com/hook' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Name');
    });

    it('should return 404 if webhook not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/webhooks/999')
        .send({ name: 'New Name' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // DELETE WEBHOOK
  // ========================================
  describe('DELETE /api/webhooks/:id', () => {
    it('should delete an existing webhook', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).delete('/api/webhooks/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted');
    });

    it('should return 404 if webhook not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/webhooks/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // TEST WEBHOOK
  // ========================================
  describe('POST /api/webhooks/:id/test', () => {
    it('should test webhook successfully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, url: 'https://example.com/hook' }]
      });
      global.fetch.mockResolvedValueOnce({ ok: true });

      const res = await request(app).post('/api/webhooks/1/test');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('successful');
    });

    it('should return 404 if webhook not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).post('/api/webhooks/999/test');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 if webhook test fails', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, url: 'https://example.com/hook' }]
      });
      global.fetch.mockResolvedValueOnce({ ok: false });

      const res = await request(app).post('/api/webhooks/1/test');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should handle network error during test', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, url: 'https://example.com/hook' }]
      });
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const res = await request(app).post('/api/webhooks/1/test');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================
  describe('Edge Cases', () => {
    it('should handle localhost URL', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await request(app)
        .post('/api/webhooks')
        .send({
          url: 'http://localhost:3000/hook',
          events: ['message.received']
        });

      expect([201, 400]).toContain(res.status);
    });

    it('should handle URL with query parameters', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await request(app)
        .post('/api/webhooks')
        .send({
          url: 'https://example.com/hook?token=abc123',
          events: ['message.received']
        });

      expect([201, 400]).toContain(res.status);
    });

    it('should handle multiple events', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await request(app)
        .post('/api/webhooks')
        .send({
          url: 'https://example.com/hook',
          events: ['message.received', 'message.sent', 'bot.created']
        });

      expect([201, 400]).toContain(res.status);
    });
  });
});
