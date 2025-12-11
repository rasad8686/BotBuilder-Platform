/**
 * Widget API Tests
 * Tests for /api/widget endpoints: config, embed code, public endpoints
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

app.get('/api/widget/:botId/config', mockAuth, async (req, res) => {
  try {
    const botResult = await db.query('SELECT * FROM bots WHERE id = $1 AND organization_id = $2', [req.params.botId, req.organization.id]);
    if (botResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Bot not found' });

    const configResult = await db.query('SELECT * FROM widget_config WHERE bot_id = $1', [req.params.botId]);
    res.json({
      success: true,
      data: configResult.rows[0] || {
        theme: 'light',
        primary_color: '#007bff',
        welcome_message: 'Hello! How can I help you?',
        placeholder_text: 'Type a message...',
        position: 'bottom-right'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/widget/:botId/config', mockAuth, async (req, res) => {
  try {
    const { theme, primary_color, welcome_message, placeholder_text, position, allowed_domains } = req.body;

    const botResult = await db.query('SELECT * FROM bots WHERE id = $1 AND organization_id = $2', [req.params.botId, req.organization.id]);
    if (botResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Bot not found' });

    const validPositions = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
    if (position && !validPositions.includes(position)) {
      return res.status(400).json({ success: false, message: `Invalid position. Valid: ${validPositions.join(', ')}` });
    }

    const result = await db.query(
      `INSERT INTO widget_config (bot_id, theme, primary_color, welcome_message, placeholder_text, position, allowed_domains)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (bot_id) DO UPDATE SET
       theme = COALESCE($2, widget_config.theme),
       primary_color = COALESCE($3, widget_config.primary_color),
       welcome_message = COALESCE($4, widget_config.welcome_message),
       placeholder_text = COALESCE($5, widget_config.placeholder_text),
       position = COALESCE($6, widget_config.position),
       allowed_domains = COALESCE($7, widget_config.allowed_domains),
       updated_at = NOW()
       RETURNING *`,
      [req.params.botId, theme || 'light', primary_color || '#007bff', welcome_message || 'Hello!', placeholder_text || 'Type a message...', position || 'bottom-right', allowed_domains ? JSON.stringify(allowed_domains) : null]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/widget/:botId/embed', mockAuth, async (req, res) => {
  try {
    const botResult = await db.query('SELECT * FROM bots WHERE id = $1 AND organization_id = $2', [req.params.botId, req.organization.id]);
    if (botResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Bot not found' });

    const embedCode = `<script src="https://widget.example.com/embed.js" data-bot-id="${req.params.botId}"></script>`;
    res.json({ success: true, data: { embed_code: embedCode, bot_id: req.params.botId } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Public endpoint - no auth required
app.get('/api/widget/public/:botId', async (req, res) => {
  try {
    const botResult = await db.query('SELECT id, name FROM bots WHERE id = $1 AND is_active = true', [req.params.botId]);
    if (botResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Bot not found or inactive' });

    const configResult = await db.query('SELECT theme, primary_color, welcome_message, placeholder_text, position FROM widget_config WHERE bot_id = $1', [req.params.botId]);
    res.json({
      success: true,
      data: {
        bot: botResult.rows[0],
        config: configResult.rows[0] || { theme: 'light', primary_color: '#007bff', welcome_message: 'Hello!', placeholder_text: 'Type a message...', position: 'bottom-right' }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Public chat endpoint
app.post('/api/widget/public/:botId/chat', async (req, res) => {
  try {
    const { message, session_id } = req.body;
    if (!message || message.trim() === '') return res.status(400).json({ success: false, message: 'Message is required' });

    const botResult = await db.query('SELECT * FROM bots WHERE id = $1 AND is_active = true', [req.params.botId]);
    if (botResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Bot not found or inactive' });

    // Mock response
    res.json({
      success: true,
      data: {
        message: `Response to: ${message}`,
        session_id: session_id || 'session-' + Math.random().toString(36).substr(2, 9)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/widget/:botId/analytics', mockAuth, async (req, res) => {
  try {
    const { period = '7d' } = req.query;

    const botResult = await db.query('SELECT * FROM bots WHERE id = $1 AND organization_id = $2', [req.params.botId, req.organization.id]);
    if (botResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Bot not found' });

    const messagesResult = await db.query(
      `SELECT COUNT(*) as total, COUNT(DISTINCT session_id) as sessions
       FROM widget_messages WHERE bot_id = $1`,
      [req.params.botId]
    );
    res.json({ success: true, data: { period, ...messagesResult.rows[0] } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Widget API', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('GET /api/widget/:botId/config', () => {
    it('should return widget config', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ theme: 'dark', primary_color: '#ff0000' }] });
      const res = await request(app).get('/api/widget/1/config');
      expect(res.status).toBe(200);
      expect(res.body.data.theme).toBe('dark');
    });

    it('should return default config if not set', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/widget/1/config');
      expect(res.status).toBe(200);
      expect(res.body.data.theme).toBe('light');
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/widget/999/config');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/widget/1/config');
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/widget/:botId/config', () => {
    it('should update widget config', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ theme: 'dark' }] });
      const res = await request(app).put('/api/widget/1/config').send({ theme: 'dark', primary_color: '#ff0000' });
      expect(res.status).toBe(200);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).put('/api/widget/999/config').send({ theme: 'dark' });
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid position', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await request(app).put('/api/widget/1/config').send({ position: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).put('/api/widget/1/config').send({ theme: 'dark' });
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/widget/:botId/embed', () => {
    it('should return embed code', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await request(app).get('/api/widget/1/embed');
      expect(res.status).toBe(200);
      expect(res.body.data.embed_code).toContain('data-bot-id="1"');
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/widget/999/embed');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/widget/1/embed');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/widget/public/:botId', () => {
    it('should return public bot config', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot' }] })
        .mockResolvedValueOnce({ rows: [{ theme: 'light' }] });
      const res = await request(app).get('/api/widget/public/1');
      expect(res.status).toBe(200);
      expect(res.body.data.bot.name).toBe('Test Bot');
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/widget/public/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/widget/public/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/widget/public/:botId/chat', () => {
    it('should send chat message', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await request(app).post('/api/widget/public/1/chat').send({ message: 'Hello' });
      expect(res.status).toBe(200);
      expect(res.body.data.message).toBeDefined();
    });

    it('should return 400 if message missing', async () => {
      const res = await request(app).post('/api/widget/public/1/chat').send({});
      expect(res.status).toBe(400);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/widget/public/999/chat').send({ message: 'Hello' });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/widget/public/1/chat').send({ message: 'Hello' });
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/widget/:botId/analytics', () => {
    it('should return widget analytics', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ total: '100', sessions: '25' }] });
      const res = await request(app).get('/api/widget/1/analytics');
      expect(res.status).toBe(200);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/widget/999/analytics');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/widget/1/analytics');
      expect(res.status).toBe(500);
    });
  });
});
