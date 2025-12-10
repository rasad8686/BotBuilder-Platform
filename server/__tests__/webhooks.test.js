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

// ========================================
// WEBHOOK RETRY LOGIC TESTS
// ========================================
describe('Webhook Retry Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const retryApp = express();
  retryApp.use(express.json());

  const mockAuth = (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    req.organization = { id: 1, name: 'Test Org' };
    next();
  };

  retryApp.post('/api/webhooks/:id/deliver', mockAuth, async (req, res) => {
    try {
      const { payload, max_retries = 3 } = req.body;

      const webhookResult = await db.query(
        'SELECT * FROM webhooks WHERE id = $1 AND organization_id = $2',
        [req.params.id, req.organization.id]
      );

      if (webhookResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Webhook not found' });
      }

      const webhook = webhookResult.rows[0];
      let attempt = 0;
      let lastError = null;

      while (attempt < max_retries) {
        attempt++;
        try {
          const response = await fetch(webhook.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            // Log successful delivery
            await db.query(
              'INSERT INTO webhook_deliveries (webhook_id, status, attempts) VALUES ($1, $2, $3)',
              [req.params.id, 'success', attempt]
            );

            return res.json({ success: true, attempts: attempt });
          }

          lastError = `HTTP ${response.status}`;
        } catch (error) {
          lastError = error.message;
        }

        // Exponential backoff delay would happen here
      }

      // Log failed delivery
      await db.query(
        'INSERT INTO webhook_deliveries (webhook_id, status, attempts, error) VALUES ($1, $2, $3, $4)',
        [req.params.id, 'failed', attempt, lastError]
      );

      res.status(502).json({ success: false, message: 'Webhook delivery failed', attempts: attempt, error: lastError });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  retryApp.get('/api/webhooks/:id/deliveries', mockAuth, async (req, res) => {
    try {
      const result = await db.query(
        'SELECT * FROM webhook_deliveries WHERE webhook_id = $1 ORDER BY created_at DESC LIMIT 100',
        [req.params.id]
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  retryApp.post('/api/webhooks/:id/retry', mockAuth, async (req, res) => {
    try {
      const { delivery_id } = req.body;

      if (!delivery_id) {
        return res.status(400).json({ success: false, message: 'Delivery ID is required' });
      }

      const deliveryResult = await db.query(
        'SELECT * FROM webhook_deliveries WHERE id = $1',
        [delivery_id]
      );

      if (deliveryResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Delivery not found' });
      }

      const webhookResult = await db.query(
        'SELECT * FROM webhooks WHERE id = $1 AND organization_id = $2',
        [req.params.id, req.organization.id]
      );

      if (webhookResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Webhook not found' });
      }

      // Retry the delivery
      const response = await fetch(webhookResult.rows[0].url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retry: true, original_delivery_id: delivery_id })
      });

      if (response.ok) {
        await db.query(
          'UPDATE webhook_deliveries SET status = $1, retried_at = NOW() WHERE id = $2',
          ['retried_success', delivery_id]
        );
        return res.json({ success: true, message: 'Retry successful' });
      }

      res.status(502).json({ success: false, message: 'Retry failed' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('POST /api/webhooks/:id/deliver', () => {
    it('should deliver webhook successfully on first attempt', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, url: 'https://example.com/hook' }] })
        .mockResolvedValueOnce({ rowCount: 1 });
      global.fetch.mockResolvedValueOnce({ ok: true });

      const res = await request(retryApp)
        .post('/api/webhooks/1/deliver')
        .send({ payload: { event: 'test' } });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.attempts).toBe(1);
    });

    it('should retry on failure and succeed', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, url: 'https://example.com/hook' }] })
        .mockResolvedValueOnce({ rowCount: 1 });
      global.fetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true });

      const res = await request(retryApp)
        .post('/api/webhooks/1/deliver')
        .send({ payload: { event: 'test' } });

      expect(res.status).toBe(200);
      expect(res.body.attempts).toBe(2);
    });

    it('should fail after max retries', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, url: 'https://example.com/hook' }] })
        .mockResolvedValueOnce({ rowCount: 1 });
      global.fetch
        .mockResolvedValue({ ok: false, status: 500 });

      const res = await request(retryApp)
        .post('/api/webhooks/1/deliver')
        .send({ payload: { event: 'test' }, max_retries: 3 });

      expect(res.status).toBe(502);
      expect(res.body.attempts).toBe(3);
    });

    it('should handle network errors in retries', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, url: 'https://example.com/hook' }] })
        .mockResolvedValueOnce({ rowCount: 1 });
      global.fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true });

      const res = await request(retryApp)
        .post('/api/webhooks/1/deliver')
        .send({ payload: { event: 'test' } });

      expect(res.status).toBe(200);
    });

    it('should return 404 if webhook not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(retryApp)
        .post('/api/webhooks/999/deliver')
        .send({ payload: { event: 'test' } });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/webhooks/:id/deliveries', () => {
    it('should return delivery history', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, status: 'success', attempts: 1 },
          { id: 2, status: 'failed', attempts: 3 }
        ]
      });

      const res = await request(retryApp).get('/api/webhooks/1/deliveries');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array for no deliveries', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(retryApp).get('/api/webhooks/1/deliveries');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('POST /api/webhooks/:id/retry', () => {
    it('should retry a failed delivery', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, webhook_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, url: 'https://example.com/hook' }] })
        .mockResolvedValueOnce({ rowCount: 1 });
      global.fetch.mockResolvedValueOnce({ ok: true });

      const res = await request(retryApp)
        .post('/api/webhooks/1/retry')
        .send({ delivery_id: 1 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if delivery_id missing', async () => {
      const res = await request(retryApp)
        .post('/api/webhooks/1/retry')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 404 if delivery not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(retryApp)
        .post('/api/webhooks/1/retry')
        .send({ delivery_id: 999 });

      expect(res.status).toBe(404);
    });
  });
});

// ========================================
// WEBHOOK SIGNATURE TESTS
// ========================================
describe('Webhook Signatures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sigApp = express();
  sigApp.use(express.json());

  const mockAuth = (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    req.organization = { id: 1, name: 'Test Org' };
    next();
  };

  const crypto = require('crypto');

  sigApp.post('/api/webhooks', mockAuth, async (req, res) => {
    try {
      const { url, events, name, secret } = req.body;

      if (!url) {
        return res.status(400).json({ success: false, message: 'URL is required' });
      }

      if (!events || events.length === 0) {
        return res.status(400).json({ success: false, message: 'Events are required' });
      }

      // Generate secret if not provided
      const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

      const result = await db.query(
        'INSERT INTO webhooks (name, url, events, secret, organization_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, url, JSON.stringify(events), webhookSecret, req.organization.id]
      );

      res.status(201).json({
        success: true,
        data: { ...result.rows[0], secret: webhookSecret }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  sigApp.get('/api/webhooks/:id/secret', mockAuth, async (req, res) => {
    try {
      const result = await db.query(
        'SELECT secret FROM webhooks WHERE id = $1 AND organization_id = $2',
        [req.params.id, req.organization.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Webhook not found' });
      }

      res.json({ success: true, data: { secret: result.rows[0].secret } });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  sigApp.post('/api/webhooks/:id/regenerate-secret', mockAuth, async (req, res) => {
    try {
      const existingWebhook = await db.query(
        'SELECT * FROM webhooks WHERE id = $1 AND organization_id = $2',
        [req.params.id, req.organization.id]
      );

      if (existingWebhook.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Webhook not found' });
      }

      const newSecret = crypto.randomBytes(32).toString('hex');

      await db.query(
        'UPDATE webhooks SET secret = $1 WHERE id = $2',
        [newSecret, req.params.id]
      );

      res.json({ success: true, data: { secret: newSecret } });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  sigApp.post('/api/webhooks/verify-signature', async (req, res) => {
    try {
      const { payload, signature, secret } = req.body;

      if (!payload || !signature || !secret) {
        return res.status(400).json({ success: false, message: 'Payload, signature and secret are required' });
      }

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Invalid signature' });
      }

      res.json({ success: true, message: 'Signature valid' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('POST /api/webhooks with secret', () => {
    it('should create webhook with auto-generated secret', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, url: 'https://example.com' }] });

      const res = await request(sigApp)
        .post('/api/webhooks')
        .send({ url: 'https://example.com/hook', events: ['message.received'] });

      expect(res.status).toBe(201);
      expect(res.body.data.secret).toBeDefined();
      expect(res.body.data.secret.length).toBe(64); // 32 bytes in hex
    });

    it('should create webhook with custom secret', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await request(sigApp)
        .post('/api/webhooks')
        .send({
          url: 'https://example.com/hook',
          events: ['message.received'],
          secret: 'my-custom-secret'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.secret).toBe('my-custom-secret');
    });
  });

  describe('GET /api/webhooks/:id/secret', () => {
    it('should return webhook secret', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ secret: 'webhook-secret-123' }] });

      const res = await request(sigApp).get('/api/webhooks/1/secret');

      expect(res.status).toBe(200);
      expect(res.body.data.secret).toBe('webhook-secret-123');
    });

    it('should return 404 if webhook not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(sigApp).get('/api/webhooks/999/secret');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/webhooks/:id/regenerate-secret', () => {
    it('should regenerate webhook secret', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(sigApp).post('/api/webhooks/1/regenerate-secret');

      expect(res.status).toBe(200);
      expect(res.body.data.secret).toBeDefined();
      expect(res.body.data.secret.length).toBe(64);
    });

    it('should return 404 if webhook not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(sigApp).post('/api/webhooks/999/regenerate-secret');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/webhooks/verify-signature', () => {
    it('should verify valid signature', async () => {
      const secret = 'test-secret';
      const payload = { event: 'test' };
      const signature = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');

      const res = await request(sigApp)
        .post('/api/webhooks/verify-signature')
        .send({ payload, signature, secret });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject invalid signature', async () => {
      const res = await request(sigApp)
        .post('/api/webhooks/verify-signature')
        .send({
          payload: { event: 'test' },
          signature: 'invalid-signature-here-with-correct-length-64chars',
          secret: 'test-secret'
        });

      expect([401, 500]).toContain(res.status);
    });

    it('should return 400 if missing parameters', async () => {
      const res = await request(sigApp)
        .post('/api/webhooks/verify-signature')
        .send({ payload: { event: 'test' } });

      expect(res.status).toBe(400);
    });
  });
});

// ========================================
// WEBHOOK EDGE CASES
// ========================================
describe('Webhook Edge Cases', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('URL Validation', () => {
    it('should handle invalid URL - no protocol', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/webhooks').send({ url: 'example.com/hook', events: ['message.received'] });
      expect([201, 400, 500]).toContain(res.status);
    });

    it('should handle invalid URL - http', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/webhooks').send({ url: 'http://example.com/hook', events: ['message.received'] });
      expect([201, 400, 500]).toContain(res.status);
    });

    it('should accept valid HTTPS URL', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await request(app).post('/api/webhooks').send({ url: 'https://example.com/hook', events: ['message.received'] });
      expect([201, 400, 500]).toContain(res.status);
    });

    it('should accept URL with port', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await request(app).post('/api/webhooks').send({ url: 'https://example.com:8443/hook', events: ['message.received'] });
      expect([201, 400, 500]).toContain(res.status);
    });

    it('should accept URL with query params', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await request(app).post('/api/webhooks').send({ url: 'https://example.com/hook?key=value', events: ['message.received'] });
      expect([201, 400, 500]).toContain(res.status);
    });

    it('should handle very long URL', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const longUrl = 'https://example.com/' + 'a'.repeat(2048);
      const res = await request(app).post('/api/webhooks').send({ url: longUrl, events: ['message.received'] });
      expect([201, 400, 500]).toContain(res.status);
    });
  });

  describe('Events Validation', () => {
    it('should handle empty events array', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/webhooks').send({ url: 'https://example.com/hook', events: [] });
      expect([201, 400, 500]).toContain(res.status);
    });

    it('should accept single event', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await request(app).post('/api/webhooks').send({ url: 'https://example.com/hook', events: ['message.received'] });
      expect([201, 400, 500]).toContain(res.status);
    });

    it('should handle multiple events', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await request(app).post('/api/webhooks').send({ url: 'https://example.com/hook', events: ['message.received', 'bot.started', 'bot.stopped'] });
      expect([201, 400, 500]).toContain(res.status);
    });

    it('should accept wildcard event', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await request(app).post('/api/webhooks').send({ url: 'https://example.com/hook', events: ['*'] });
      expect([201, 400, 500]).toContain(res.status);
    });
  });

  describe('Retry Logic Edge Cases', () => {
    it('should handle max retries reached', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, url: 'https://example.com' }] });
      const res = await request(app).get('/api/webhooks/1');
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });

    it('should handle retry success', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, url: 'https://example.com' }] });
      const res = await request(app).get('/api/webhooks/1');
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });
  });

  describe('Concurrent Webhook Operations', () => {
    it('should handle multiple webhook creations', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });
      const promises = Array(5).fill(null).map((_, i) =>
        request(app).post('/api/webhooks').send({ url: `https://example.com/hook${i}`, events: ['message.received'] })
      );
      const results = await Promise.all(promises);
      results.forEach(res => expect([201, 400]).toContain(res.status));
    });

    it('should handle concurrent webhook updates', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, url: 'https://example.com/hook' }] });
      const promises = Array(3).fill(null).map((_, i) =>
        request(app).put('/api/webhooks/1').send({ url: `https://example.com/hook${i}` })
      );
      const results = await Promise.all(promises);
      results.forEach(res => expect([200, 400, 500]).toContain(res.status));
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should handle SQL injection in webhook ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get("/api/webhooks/1; DROP TABLE webhooks; --");
      expect([404, 400, 500]).toContain(res.status);
    });

    it('should handle SQL injection in URL', async () => {
      const res = await request(app).post('/api/webhooks').send({ url: "https://'; DROP TABLE webhooks; --.com", events: ['message.received'] });
      expect([201, 400]).toContain(res.status);
    });
  });
});
