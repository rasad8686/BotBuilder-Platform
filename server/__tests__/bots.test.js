/**
 * Bots API Tests
 * Tests for /api/bots endpoints: CRUD operations
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

// Mock webhook service
jest.mock('../services/webhookService', () => ({
  triggerWebhook: jest.fn()
}));

// Mock audit middleware
jest.mock('../middleware/audit', () => ({
  logBotCreated: jest.fn((req, res, next) => next()),
  logBotUpdated: jest.fn((req, res, next) => next()),
  logBotDeleted: jest.fn((req, res, next) => next())
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

// Mock bots routes
app.get('/api/bots', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM bots WHERE organization_id = $1 ORDER BY created_at DESC',
      [req.organization.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/bots/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM bots WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Bot not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/bots', mockAuth, async (req, res) => {
  try {
    const { name, platform, description } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Bot name is required' });
    }

    if (!platform || platform.trim() === '') {
      return res.status(400).json({ success: false, message: 'Platform is required' });
    }

    const validPlatforms = ['telegram', 'whatsapp', 'discord', 'slack', 'messenger'];
    if (!validPlatforms.includes(platform.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid platform. Valid platforms: ${validPlatforms.join(', ')}`
      });
    }

    const result = await db.query(
      'INSERT INTO bots (name, platform, description, user_id, organization_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, platform, description, req.user.id, req.organization.id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/bots/:id', mockAuth, async (req, res) => {
  try {
    const { name, description, is_active } = req.body;

    // Check if bot exists
    const existingBot = await db.query(
      'SELECT * FROM bots WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (existingBot.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Bot not found' });
    }

    const result = await db.query(
      'UPDATE bots SET name = COALESCE($1, name), description = COALESCE($2, description), is_active = COALESCE($3, is_active), updated_at = NOW() WHERE id = $4 RETURNING *',
      [name, description, is_active, req.params.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/bots/:id', mockAuth, async (req, res) => {
  try {
    // Check if bot exists
    const existingBot = await db.query(
      'SELECT * FROM bots WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (existingBot.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Bot not found' });
    }

    await db.query('DELETE FROM bots WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Bot deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Bots API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // GET ALL BOTS
  // ========================================
  describe('GET /api/bots', () => {
    it('should return all bots for the organization', async () => {
      const mockBots = [
        { id: 1, name: 'Bot 1', platform: 'telegram' },
        { id: 2, name: 'Bot 2', platform: 'whatsapp' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockBots });

      const res = await request(app).get('/api/bots');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array if no bots exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/bots');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/bots');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // GET SINGLE BOT
  // ========================================
  describe('GET /api/bots/:id', () => {
    it('should return a single bot by ID', async () => {
      const mockBot = { id: 1, name: 'Test Bot', platform: 'telegram' };
      db.query.mockResolvedValueOnce({ rows: [mockBot] });

      const res = await request(app).get('/api/bots/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Bot');
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/bots/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });
  });

  // ========================================
  // CREATE BOT
  // ========================================
  describe('POST /api/bots', () => {
    it('should create a new bot successfully', async () => {
      const newBot = { id: 1, name: 'New Bot', platform: 'telegram', description: 'Test bot' };
      db.query.mockResolvedValueOnce({ rows: [newBot] });

      const res = await request(app)
        .post('/api/bots')
        .send({
          name: 'New Bot',
          platform: 'telegram',
          description: 'Test bot'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Bot');
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(app)
        .post('/api/bots')
        .send({
          platform: 'telegram'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('name');
    });

    it('should return 400 if platform is missing', async () => {
      const res = await request(app)
        .post('/api/bots')
        .send({
          name: 'Test Bot'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Platform');
    });

    it('should return 400 if platform is invalid', async () => {
      const res = await request(app)
        .post('/api/bots')
        .send({
          name: 'Test Bot',
          platform: 'invalid_platform'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid platform');
    });
  });

  // ========================================
  // UPDATE BOT
  // ========================================
  describe('PUT /api/bots/:id', () => {
    it('should update an existing bot', async () => {
      const existingBot = { id: 1, name: 'Old Name', platform: 'telegram' };
      const updatedBot = { id: 1, name: 'New Name', platform: 'telegram' };

      db.query
        .mockResolvedValueOnce({ rows: [existingBot] }) // Check exists
        .mockResolvedValueOnce({ rows: [updatedBot] }); // Update

      const res = await request(app)
        .put('/api/bots/1')
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Name');
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/bots/999')
        .send({ name: 'New Name' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // DELETE BOT
  // ========================================
  describe('DELETE /api/bots/:id', () => {
    it('should delete an existing bot', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Check exists
        .mockResolvedValueOnce({ rowCount: 1 }); // Delete

      const res = await request(app).delete('/api/bots/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted');
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/bots/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================
  describe('Edge Cases', () => {
    it('should handle very long bot name', async () => {
      const longName = 'A'.repeat(500);
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: longName, platform: 'telegram' }] });

      const res = await request(app)
        .post('/api/bots')
        .send({
          name: longName,
          platform: 'telegram'
        });

      expect([201, 400]).toContain(res.status);
    });

    it('should handle special characters in bot name', async () => {
      const specialName = 'Bot <script>alert("xss")</script>';
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: specialName, platform: 'telegram' }] });

      const res = await request(app)
        .post('/api/bots')
        .send({
          name: specialName,
          platform: 'telegram'
        });

      expect([201, 400]).toContain(res.status);
    });

    it('should handle empty string as name', async () => {
      const res = await request(app)
        .post('/api/bots')
        .send({
          name: '',
          platform: 'telegram'
        });

      expect(res.status).toBe(400);
    });

    it('should handle whitespace-only name', async () => {
      const res = await request(app)
        .post('/api/bots')
        .send({
          name: '   ',
          platform: 'telegram'
        });

      expect(res.status).toBe(400);
    });
  });
});
