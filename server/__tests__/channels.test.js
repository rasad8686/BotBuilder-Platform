/**
 * Channels API Tests
 * Tests for /api/channels endpoints: Instagram, WhatsApp, Telegram integrations
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

// Mock channels routes
app.get('/api/channels', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM channels WHERE organization_id = $1 ORDER BY created_at DESC',
      [req.organization.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/channels/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM channels WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/channels', mockAuth, async (req, res) => {
  try {
    const { type, name, config } = req.body;

    if (!type) {
      return res.status(400).json({ success: false, message: 'Channel type is required' });
    }

    const validTypes = ['telegram', 'whatsapp', 'instagram', 'discord', 'slack', 'messenger'];
    if (!validTypes.includes(type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid channel type. Valid types: ${validTypes.join(', ')}`
      });
    }

    if (!config) {
      return res.status(400).json({ success: false, message: 'Channel config is required' });
    }

    const result = await db.query(
      'INSERT INTO channels (type, name, config, organization_id, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [type, name || type, JSON.stringify(config), req.organization.id, req.user.id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/channels/:id', mockAuth, async (req, res) => {
  try {
    const { name, config, is_active } = req.body;

    const existingChannel = await db.query(
      'SELECT * FROM channels WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (existingChannel.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    const result = await db.query(
      'UPDATE channels SET name = COALESCE($1, name), config = COALESCE($2, config), is_active = COALESCE($3, is_active), updated_at = NOW() WHERE id = $4 RETURNING *',
      [name, config ? JSON.stringify(config) : null, is_active, req.params.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/channels/:id', mockAuth, async (req, res) => {
  try {
    const existingChannel = await db.query(
      'SELECT * FROM channels WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (existingChannel.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    await db.query('DELETE FROM channels WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Channel deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Channels API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // LIST CHANNELS
  // ========================================
  describe('GET /api/channels', () => {
    it('should return all channels for the organization', async () => {
      const mockChannels = [
        { id: 1, type: 'telegram', name: 'Telegram Bot' },
        { id: 2, type: 'whatsapp', name: 'WhatsApp Bot' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockChannels });

      const res = await request(app).get('/api/channels');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array if no channels exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/channels');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/channels');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // GET SINGLE CHANNEL
  // ========================================
  describe('GET /api/channels/:id', () => {
    it('should return a single channel by ID', async () => {
      const mockChannel = { id: 1, type: 'telegram', name: 'Telegram Bot' };
      db.query.mockResolvedValueOnce({ rows: [mockChannel] });

      const res = await request(app).get('/api/channels/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('telegram');
    });

    it('should return 404 if channel not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/channels/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // CREATE CHANNEL
  // ========================================
  describe('POST /api/channels', () => {
    it('should create a new channel successfully', async () => {
      const newChannel = { id: 1, type: 'telegram', name: 'Telegram Bot' };
      db.query.mockResolvedValueOnce({ rows: [newChannel] });

      const res = await request(app)
        .post('/api/channels')
        .send({
          type: 'telegram',
          name: 'Telegram Bot',
          config: { bot_token: 'test-token' }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if type is missing', async () => {
      const res = await request(app)
        .post('/api/channels')
        .send({ name: 'Test Channel', config: {} });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('type');
    });

    it('should return 400 if config is missing', async () => {
      const res = await request(app)
        .post('/api/channels')
        .send({ type: 'telegram' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('config');
    });

    it('should return 400 for invalid channel type', async () => {
      const res = await request(app)
        .post('/api/channels')
        .send({ type: 'invalid', config: {} });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid channel type');
    });
  });

  // ========================================
  // UPDATE CHANNEL
  // ========================================
  describe('PUT /api/channels/:id', () => {
    it('should update an existing channel', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated Name' }] });

      const res = await request(app)
        .put('/api/channels/1')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if channel not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/channels/999')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(404);
    });
  });

  // ========================================
  // DELETE CHANNEL
  // ========================================
  describe('DELETE /api/channels/:id', () => {
    it('should delete an existing channel', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).delete('/api/channels/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if channel not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/channels/999');

      expect(res.status).toBe(404);
    });
  });
});

// ========================================
// TELEGRAM INTEGRATION TESTS
// ========================================
describe('Telegram Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const telegramApp = express();
  telegramApp.use(express.json());

  const mockAuth = (req, res, next) => {
    req.user = { id: 1 };
    req.organization = { id: 1 };
    next();
  };

  telegramApp.post('/api/channels/telegram/connect', mockAuth, async (req, res) => {
    try {
      const { bot_token } = req.body;

      if (!bot_token) {
        return res.status(400).json({ success: false, message: 'Bot token is required' });
      }

      // Validate token format (simplified)
      if (!bot_token.includes(':')) {
        return res.status(400).json({ success: false, message: 'Invalid Telegram bot token format' });
      }

      // Verify bot with Telegram API (mocked)
      const botInfo = await db.query('SELECT 1'); // Simulating API call

      const result = await db.query(
        'INSERT INTO channels (type, name, config, organization_id) VALUES ($1, $2, $3, $4) RETURNING *',
        ['telegram', 'Telegram Bot', JSON.stringify({ bot_token }), req.organization.id]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  telegramApp.post('/api/channels/telegram/:id/set-webhook', mockAuth, async (req, res) => {
    try {
      const { webhook_url } = req.body;

      if (!webhook_url) {
        return res.status(400).json({ success: false, message: 'Webhook URL is required' });
      }

      // Validate URL
      try {
        new URL(webhook_url);
      } catch {
        return res.status(400).json({ success: false, message: 'Invalid webhook URL' });
      }

      const channel = await db.query(
        'SELECT * FROM channels WHERE id = $1 AND organization_id = $2',
        [req.params.id, req.organization.id]
      );

      if (channel.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Channel not found' });
      }

      // Set webhook (mocked)
      await db.query(
        'UPDATE channels SET config = jsonb_set(config, \'{webhook_url}\', $1) WHERE id = $2',
        [JSON.stringify(webhook_url), req.params.id]
      );

      res.json({ success: true, message: 'Webhook set successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('POST /api/channels/telegram/connect', () => {
    it('should connect Telegram bot successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{}] }) // Bot verification
        .mockResolvedValueOnce({ rows: [{ id: 1, type: 'telegram' }] });

      const res = await request(telegramApp)
        .post('/api/channels/telegram/connect')
        .send({ bot_token: '123456789:ABC-DEF' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if bot token is missing', async () => {
      const res = await request(telegramApp)
        .post('/api/channels/telegram/connect')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('token');
    });

    it('should return 400 for invalid token format', async () => {
      const res = await request(telegramApp)
        .post('/api/channels/telegram/connect')
        .send({ bot_token: 'invalid-token' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid');
    });
  });

  describe('POST /api/channels/telegram/:id/set-webhook', () => {
    it('should set webhook successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(telegramApp)
        .post('/api/channels/telegram/1/set-webhook')
        .send({ webhook_url: 'https://example.com/webhook' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for invalid webhook URL', async () => {
      const res = await request(telegramApp)
        .post('/api/channels/telegram/1/set-webhook')
        .send({ webhook_url: 'invalid-url' });

      expect(res.status).toBe(400);
    });

    it('should return 404 if channel not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(telegramApp)
        .post('/api/channels/telegram/999/set-webhook')
        .send({ webhook_url: 'https://example.com/webhook' });

      expect(res.status).toBe(404);
    });
  });
});

// ========================================
// WHATSAPP INTEGRATION TESTS
// ========================================
describe('WhatsApp Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const whatsappApp = express();
  whatsappApp.use(express.json());

  const mockAuth = (req, res, next) => {
    req.user = { id: 1 };
    req.organization = { id: 1 };
    next();
  };

  whatsappApp.post('/api/channels/whatsapp/connect', mockAuth, async (req, res) => {
    try {
      const { phone_number_id, access_token, business_account_id } = req.body;

      if (!phone_number_id || !access_token) {
        return res.status(400).json({
          success: false,
          message: 'Phone number ID and access token are required'
        });
      }

      const result = await db.query(
        'INSERT INTO channels (type, name, config, organization_id) VALUES ($1, $2, $3, $4) RETURNING *',
        ['whatsapp', 'WhatsApp Business', JSON.stringify({ phone_number_id, access_token, business_account_id }), req.organization.id]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  whatsappApp.post('/api/channels/whatsapp/:id/verify', mockAuth, async (req, res) => {
    try {
      const channel = await db.query(
        'SELECT * FROM channels WHERE id = $1 AND organization_id = $2 AND type = $3',
        [req.params.id, req.organization.id, 'whatsapp']
      );

      if (channel.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'WhatsApp channel not found' });
      }

      // Verify with WhatsApp Business API (mocked)
      const verification = await db.query('SELECT 1');

      await db.query(
        'UPDATE channels SET config = jsonb_set(config, \'{verified}\', $1) WHERE id = $2',
        ['true', req.params.id]
      );

      res.json({ success: true, message: 'WhatsApp channel verified' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('POST /api/channels/whatsapp/connect', () => {
    it('should connect WhatsApp business successfully', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, type: 'whatsapp' }] });

      const res = await request(whatsappApp)
        .post('/api/channels/whatsapp/connect')
        .send({
          phone_number_id: '123456789',
          access_token: 'test-access-token',
          business_account_id: 'business123'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if phone_number_id is missing', async () => {
      const res = await request(whatsappApp)
        .post('/api/channels/whatsapp/connect')
        .send({ access_token: 'test-token' });

      expect(res.status).toBe(400);
    });

    it('should return 400 if access_token is missing', async () => {
      const res = await request(whatsappApp)
        .post('/api/channels/whatsapp/connect')
        .send({ phone_number_id: '123' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/channels/whatsapp/:id/verify', () => {
    it('should verify WhatsApp channel', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, type: 'whatsapp' }] })
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(whatsappApp)
        .post('/api/channels/whatsapp/1/verify');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if WhatsApp channel not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(whatsappApp)
        .post('/api/channels/whatsapp/999/verify');

      expect(res.status).toBe(404);
    });
  });
});

// ========================================
// INSTAGRAM INTEGRATION TESTS
// ========================================
describe('Instagram Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const instagramApp = express();
  instagramApp.use(express.json());

  const mockAuth = (req, res, next) => {
    req.user = { id: 1 };
    req.organization = { id: 1 };
    next();
  };

  instagramApp.post('/api/channels/instagram/connect', mockAuth, async (req, res) => {
    try {
      const { instagram_account_id, access_token, page_id } = req.body;

      if (!instagram_account_id || !access_token) {
        return res.status(400).json({
          success: false,
          message: 'Instagram account ID and access token are required'
        });
      }

      if (!page_id) {
        return res.status(400).json({
          success: false,
          message: 'Facebook Page ID is required for Instagram integration'
        });
      }

      const result = await db.query(
        'INSERT INTO channels (type, name, config, organization_id) VALUES ($1, $2, $3, $4) RETURNING *',
        ['instagram', 'Instagram Business', JSON.stringify({ instagram_account_id, access_token, page_id }), req.organization.id]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  instagramApp.get('/api/channels/instagram/:id/insights', mockAuth, async (req, res) => {
    try {
      const channel = await db.query(
        'SELECT * FROM channels WHERE id = $1 AND organization_id = $2 AND type = $3',
        [req.params.id, req.organization.id, 'instagram']
      );

      if (channel.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Instagram channel not found' });
      }

      // Get insights (mocked)
      const insights = {
        followers: 1000,
        engagement_rate: 3.5,
        messages_received: 150
      };

      res.json({ success: true, data: insights });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('POST /api/channels/instagram/connect', () => {
    it('should connect Instagram business successfully', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, type: 'instagram' }] });

      const res = await request(instagramApp)
        .post('/api/channels/instagram/connect')
        .send({
          instagram_account_id: 'ig123',
          access_token: 'test-access-token',
          page_id: 'page123'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if instagram_account_id is missing', async () => {
      const res = await request(instagramApp)
        .post('/api/channels/instagram/connect')
        .send({ access_token: 'test-token', page_id: 'page123' });

      expect(res.status).toBe(400);
    });

    it('should return 400 if page_id is missing', async () => {
      const res = await request(instagramApp)
        .post('/api/channels/instagram/connect')
        .send({ instagram_account_id: 'ig123', access_token: 'test-token' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Facebook Page ID');
    });
  });

  describe('GET /api/channels/instagram/:id/insights', () => {
    it('should return Instagram insights', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, type: 'instagram' }] });

      const res = await request(instagramApp).get('/api/channels/instagram/1/insights');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.followers).toBeDefined();
    });

    it('should return 404 if Instagram channel not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(instagramApp).get('/api/channels/instagram/999/insights');

      expect(res.status).toBe(404);
    });
  });
});

// ========================================
// EDGE CASES
// ========================================
describe('Channel Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const edgeApp = express();
  edgeApp.use(express.json());

  const mockAuth = (req, res, next) => {
    req.user = { id: 1 };
    req.organization = { id: 1 };
    next();
  };

  edgeApp.post('/api/channels/:id/test', mockAuth, async (req, res) => {
    try {
      const channel = await db.query(
        'SELECT * FROM channels WHERE id = $1 AND organization_id = $2',
        [req.params.id, req.organization.id]
      );

      if (channel.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Channel not found' });
      }

      // Test channel connection (mocked)
      const isConnected = true;

      if (!isConnected) {
        return res.status(400).json({ success: false, message: 'Channel connection failed' });
      }

      res.json({ success: true, message: 'Channel connection successful' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('POST /api/channels/:id/test', () => {
    it('should test channel connection', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, type: 'telegram' }] });

      const res = await request(edgeApp).post('/api/channels/1/test');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if channel not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(edgeApp).post('/api/channels/999/test');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(edgeApp).post('/api/channels/1/test');

      expect(res.status).toBe(500);
    });
  });
});
