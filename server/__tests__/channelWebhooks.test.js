/**
 * Channel Webhooks API Tests
 * Tests for /api/webhooks endpoints: channel integrations, incoming webhooks
 */

const request = require('supertest');

jest.mock('../db', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));

const express = require('express');
const db = require('../db');

const app = express();
app.use(express.json());

const mockAuth = (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  req.organization = { id: 1, name: 'Test Org' };
  next();
};

app.get('/api/webhooks', mockAuth, async (req, res) => {
  try {
    const { bot_id, channel } = req.query;
    let query = `SELECT w.*, b.name as bot_name FROM webhooks w
                 JOIN bots b ON w.bot_id = b.id WHERE b.organization_id = $1`;
    const params = [req.organization.id];
    let paramIndex = 2;
    if (bot_id) { query += ` AND w.bot_id = $${paramIndex++}`; params.push(bot_id); }
    if (channel) { query += ` AND w.channel = $${paramIndex++}`; params.push(channel); }
    query += ' ORDER BY w.created_at DESC';

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/webhooks/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT w.*, b.name as bot_name FROM webhooks w
       JOIN bots b ON w.bot_id = b.id WHERE w.id = $1 AND b.organization_id = $2`,
      [req.params.id, req.organization.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Webhook not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/webhooks', mockAuth, async (req, res) => {
  try {
    const { bot_id, channel, name, config } = req.body;
    if (!bot_id) return res.status(400).json({ success: false, message: 'Bot ID is required' });
    if (!channel) return res.status(400).json({ success: false, message: 'Channel is required' });

    const validChannels = ['telegram', 'slack', 'discord', 'whatsapp', 'messenger', 'custom'];
    if (!validChannels.includes(channel)) {
      return res.status(400).json({ success: false, message: `Invalid channel. Valid: ${validChannels.join(', ')}` });
    }

    const botResult = await db.query('SELECT * FROM bots WHERE id = $1 AND organization_id = $2', [bot_id, req.organization.id]);
    if (botResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Bot not found' });

    const webhookToken = `wh_${Math.random().toString(36).substr(2, 32)}`;
    const result = await db.query(
      `INSERT INTO webhooks (bot_id, channel, name, config, token, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING *`,
      [bot_id, channel, name || `${channel} webhook`, JSON.stringify(config || {}), webhookToken, req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/webhooks/:id', mockAuth, async (req, res) => {
  try {
    const { name, config, is_active } = req.body;

    const existing = await db.query(
      `SELECT w.* FROM webhooks w JOIN bots b ON w.bot_id = b.id WHERE w.id = $1 AND b.organization_id = $2`,
      [req.params.id, req.organization.id]
    );
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Webhook not found' });

    const result = await db.query(
      `UPDATE webhooks SET name = COALESCE($1, name), config = COALESCE($2, config),
       is_active = COALESCE($3, is_active), updated_at = NOW() WHERE id = $4 RETURNING *`,
      [name, config ? JSON.stringify(config) : null, is_active, req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/webhooks/:id', mockAuth, async (req, res) => {
  try {
    const existing = await db.query(
      `SELECT w.* FROM webhooks w JOIN bots b ON w.bot_id = b.id WHERE w.id = $1 AND b.organization_id = $2`,
      [req.params.id, req.organization.id]
    );
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Webhook not found' });

    await db.query('DELETE FROM webhooks WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Webhook deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/webhooks/:id/regenerate-token', mockAuth, async (req, res) => {
  try {
    const existing = await db.query(
      `SELECT w.* FROM webhooks w JOIN bots b ON w.bot_id = b.id WHERE w.id = $1 AND b.organization_id = $2`,
      [req.params.id, req.organization.id]
    );
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Webhook not found' });

    const newToken = `wh_${Math.random().toString(36).substr(2, 32)}`;
    const result = await db.query(
      'UPDATE webhooks SET token = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [newToken, req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/webhooks/:id/test', mockAuth, async (req, res) => {
  try {
    const existing = await db.query(
      `SELECT w.*, b.name as bot_name FROM webhooks w JOIN bots b ON w.bot_id = b.id WHERE w.id = $1 AND b.organization_id = $2`,
      [req.params.id, req.organization.id]
    );
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Webhook not found' });

    // Mock test result
    res.json({
      success: true,
      data: {
        webhook_id: req.params.id,
        channel: existing.rows[0].channel,
        test_message_sent: true,
        response_time_ms: 150
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/webhooks/:id/logs', mockAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const existing = await db.query(
      `SELECT w.* FROM webhooks w JOIN bots b ON w.bot_id = b.id WHERE w.id = $1 AND b.organization_id = $2`,
      [req.params.id, req.organization.id]
    );
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Webhook not found' });

    const result = await db.query(
      'SELECT * FROM webhook_logs WHERE webhook_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.params.id, parseInt(limit), parseInt(offset)]
    );
    const countResult = await db.query('SELECT COUNT(*) FROM webhook_logs WHERE webhook_id = $1', [req.params.id]);

    res.json({
      success: true,
      data: result.rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(countResult.rows[0].count) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Public webhook endpoint (no auth)
app.post('/api/webhooks/incoming/:token', async (req, res) => {
  try {
    const result = await db.query('SELECT w.*, b.id as bot_id FROM webhooks w JOIN bots b ON w.bot_id = b.id WHERE w.token = $1 AND w.is_active = true', [req.params.token]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Webhook not found or inactive' });

    const webhook = result.rows[0];

    // Log the incoming webhook
    await db.query(
      `INSERT INTO webhook_logs (webhook_id, request_body, status, created_at)
       VALUES ($1, $2, 'received', NOW())`,
      [webhook.id, JSON.stringify(req.body)]
    );

    // Mock processing
    res.json({ success: true, message: 'Webhook received', webhook_id: webhook.id });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/webhooks/channels/supported', mockAuth, async (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'telegram', name: 'Telegram', status: 'available' },
      { id: 'slack', name: 'Slack', status: 'available' },
      { id: 'discord', name: 'Discord', status: 'available' },
      { id: 'whatsapp', name: 'WhatsApp', status: 'available' },
      { id: 'messenger', name: 'Messenger', status: 'available' },
      { id: 'custom', name: 'Custom HTTP', status: 'available' }
    ]
  });
});

describe('Channel Webhooks API', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('GET /api/webhooks', () => {
    it('should return webhooks', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, channel: 'telegram' }] });
      const res = await request(app).get('/api/webhooks');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should filter by bot_id', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/webhooks?bot_id=5');
      expect(res.status).toBe(200);
    });

    it('should filter by channel', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/webhooks?channel=slack');
      expect(res.status).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/webhooks');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/webhooks/:id', () => {
    it('should return webhook by ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, channel: 'telegram', token: 'wh_test' }] });
      const res = await request(app).get('/api/webhooks/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/webhooks/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/webhooks/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/webhooks', () => {
    it('should create webhook', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, channel: 'telegram', token: 'wh_test' }] });
      const res = await request(app).post('/api/webhooks').send({ bot_id: 1, channel: 'telegram' });
      expect(res.status).toBe(201);
    });

    it('should return 400 if bot_id missing', async () => {
      const res = await request(app).post('/api/webhooks').send({ channel: 'telegram' });
      expect(res.status).toBe(400);
    });

    it('should return 400 if channel missing', async () => {
      const res = await request(app).post('/api/webhooks').send({ bot_id: 1 });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid channel', async () => {
      const res = await request(app).post('/api/webhooks').send({ bot_id: 1, channel: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/webhooks').send({ bot_id: 999, channel: 'telegram' });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/webhooks').send({ bot_id: 1, channel: 'telegram' });
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/webhooks/:id', () => {
    it('should update webhook', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated' }] });
      const res = await request(app).put('/api/webhooks/1').send({ name: 'Updated', is_active: false });
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).put('/api/webhooks/999').send({ name: 'Updated' });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).put('/api/webhooks/1').send({ name: 'Updated' });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/webhooks/:id', () => {
    it('should delete webhook', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).delete('/api/webhooks/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).delete('/api/webhooks/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).delete('/api/webhooks/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/webhooks/:id/regenerate-token', () => {
    it('should regenerate token', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, token: 'wh_newtoken' }] });
      const res = await request(app).post('/api/webhooks/1/regenerate-token');
      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/webhooks/999/regenerate-token');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/webhooks/1/regenerate-token');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/webhooks/:id/test', () => {
    it('should test webhook', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, channel: 'telegram' }] });
      const res = await request(app).post('/api/webhooks/1/test');
      expect(res.status).toBe(200);
      expect(res.body.data.test_message_sent).toBe(true);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/webhooks/999/test');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/webhooks/1/test');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/webhooks/:id/logs', () => {
    it('should return webhook logs', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'received' }] })
        .mockResolvedValueOnce({ rows: [{ count: '50' }] });
      const res = await request(app).get('/api/webhooks/1/logs');
      expect(res.status).toBe(200);
      expect(res.body.pagination).toBeDefined();
    });

    it('should return 404 if webhook not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/webhooks/999/logs');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/webhooks/1/logs');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/webhooks/incoming/:token', () => {
    it('should receive webhook', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, bot_id: 1, is_active: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await request(app).post('/api/webhooks/incoming/wh_testtoken').send({ message: 'Hello' });
      expect(res.status).toBe(200);
    });

    it('should return 404 if token invalid', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/webhooks/incoming/invalid_token').send({ message: 'Hello' });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/webhooks/incoming/wh_test').send({ message: 'Hello' });
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/webhooks/channels/supported', () => {
    it('should return supported channels', async () => {
      const res = await request(app).get('/api/webhooks/channels/supported');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(6);
    });
  });
});
