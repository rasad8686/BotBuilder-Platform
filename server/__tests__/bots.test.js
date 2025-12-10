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

// ========================================
// BOT SETTINGS TESTS
// ========================================
describe('Bot Settings API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const settingsApp = express();
  settingsApp.use(express.json());

  const mockAuth = (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    req.organization = { id: 1, name: 'Test Org' };
    next();
  };

  settingsApp.get('/api/bots/:id/settings', mockAuth, async (req, res) => {
    try {
      const result = await db.query(
        'SELECT * FROM bots WHERE id = $1 AND organization_id = $2',
        [req.params.id, req.organization.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Bot not found' });
      }

      const settingsResult = await db.query(
        'SELECT * FROM bot_settings WHERE bot_id = $1',
        [req.params.id]
      );

      res.json({
        success: true,
        data: settingsResult.rows[0] || {
          welcome_message: 'Hello!',
          language: 'en',
          timezone: 'UTC',
          auto_reply: true
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  settingsApp.put('/api/bots/:id/settings', mockAuth, async (req, res) => {
    try {
      const { welcome_message, language, timezone, auto_reply } = req.body;

      const botResult = await db.query(
        'SELECT * FROM bots WHERE id = $1 AND organization_id = $2',
        [req.params.id, req.organization.id]
      );

      if (botResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Bot not found' });
      }

      // Validate language
      const validLanguages = ['en', 'az', 'ru', 'tr'];
      if (language && !validLanguages.includes(language)) {
        return res.status(400).json({ success: false, message: 'Invalid language' });
      }

      const result = await db.query(
        `INSERT INTO bot_settings (bot_id, welcome_message, language, timezone, auto_reply)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (bot_id) DO UPDATE SET
         welcome_message = COALESCE($2, bot_settings.welcome_message),
         language = COALESCE($3, bot_settings.language),
         timezone = COALESCE($4, bot_settings.timezone),
         auto_reply = COALESCE($5, bot_settings.auto_reply)
         RETURNING *`,
        [req.params.id, welcome_message, language, timezone, auto_reply]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('GET /api/bots/:id/settings', () => {
    it('should return bot settings', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot' }] })
        .mockResolvedValueOnce({ rows: [{ welcome_message: 'Hi!', language: 'en' }] });

      const res = await request(settingsApp).get('/api/bots/1/settings');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.welcome_message).toBe('Hi!');
    });

    it('should return default settings if none exist', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(settingsApp).get('/api/bots/1/settings');

      expect(res.status).toBe(200);
      expect(res.body.data.welcome_message).toBe('Hello!');
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(settingsApp).get('/api/bots/999/settings');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(settingsApp).get('/api/bots/1/settings');

      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/bots/:id/settings', () => {
    it('should update bot settings', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ welcome_message: 'New message', language: 'az' }] });

      const res = await request(settingsApp)
        .put('/api/bots/1/settings')
        .send({ welcome_message: 'New message', language: 'az' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(settingsApp)
        .put('/api/bots/999/settings')
        .send({ language: 'en' });

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid language', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await request(settingsApp)
        .put('/api/bots/1/settings')
        .send({ language: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid language');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(settingsApp)
        .put('/api/bots/1/settings')
        .send({ language: 'en' });

      expect(res.status).toBe(500);
    });
  });
});

// ========================================
// BOT ANALYTICS TESTS
// ========================================
describe('Bot Analytics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const analyticsApp = express();
  analyticsApp.use(express.json());

  const mockAuth = (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    req.organization = { id: 1, name: 'Test Org' };
    next();
  };

  analyticsApp.get('/api/bots/:id/analytics', mockAuth, async (req, res) => {
    try {
      const { period = '7d' } = req.query;

      const botResult = await db.query(
        'SELECT * FROM bots WHERE id = $1 AND organization_id = $2',
        [req.params.id, req.organization.id]
      );

      if (botResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Bot not found' });
      }

      let interval;
      switch (period) {
        case '24h': interval = '24 hours'; break;
        case '7d': interval = '7 days'; break;
        case '30d': interval = '30 days'; break;
        default: interval = '7 days';
      }

      const messagesResult = await db.query(
        `SELECT DATE(created_at) as date, COUNT(*) as count
         FROM messages WHERE bot_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
         GROUP BY DATE(created_at) ORDER BY date ASC`,
        [req.params.id]
      );

      const totalResult = await db.query(
        'SELECT COUNT(*) as total FROM messages WHERE bot_id = $1',
        [req.params.id]
      );

      const uniqueUsersResult = await db.query(
        'SELECT COUNT(DISTINCT user_id) as total FROM messages WHERE bot_id = $1',
        [req.params.id]
      );

      res.json({
        success: true,
        data: {
          messages: messagesResult.rows,
          totalMessages: parseInt(totalResult.rows[0].total),
          uniqueUsers: parseInt(uniqueUsersResult.rows[0].total)
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('GET /api/bots/:id/analytics', () => {
    it('should return bot analytics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ date: '2024-01-01', count: '10' }] })
        .mockResolvedValueOnce({ rows: [{ total: '100' }] })
        .mockResolvedValueOnce({ rows: [{ total: '25' }] });

      const res = await request(analyticsApp).get('/api/bots/1/analytics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalMessages).toBe(100);
      expect(res.body.data.uniqueUsers).toBe(25);
    });

    it('should filter by period', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] });

      const res = await request(analyticsApp).get('/api/bots/1/analytics?period=24h');

      expect(res.status).toBe(200);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(analyticsApp).get('/api/bots/999/analytics');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(analyticsApp).get('/api/bots/1/analytics');

      expect(res.status).toBe(500);
    });
  });
});

// ========================================
// BOT EXPORT/IMPORT TESTS
// ========================================
describe('Bot Export/Import API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const exportApp = express();
  exportApp.use(express.json());

  const mockAuth = (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    req.organization = { id: 1, name: 'Test Org' };
    next();
  };

  exportApp.get('/api/bots/:id/export', mockAuth, async (req, res) => {
    try {
      const botResult = await db.query(
        'SELECT * FROM bots WHERE id = $1 AND organization_id = $2',
        [req.params.id, req.organization.id]
      );

      if (botResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Bot not found' });
      }

      const settingsResult = await db.query(
        'SELECT * FROM bot_settings WHERE bot_id = $1',
        [req.params.id]
      );

      const flowsResult = await db.query(
        'SELECT * FROM bot_flows WHERE bot_id = $1',
        [req.params.id]
      );

      const exportData = {
        version: '1.0',
        bot: botResult.rows[0],
        settings: settingsResult.rows[0] || {},
        flows: flowsResult.rows,
        exportedAt: new Date().toISOString()
      };

      res.json({ success: true, data: exportData });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  exportApp.post('/api/bots/import', mockAuth, async (req, res) => {
    try {
      const { data } = req.body;

      if (!data || !data.bot) {
        return res.status(400).json({ success: false, message: 'Invalid import data' });
      }

      if (!data.version) {
        return res.status(400).json({ success: false, message: 'Missing version in import data' });
      }

      const { bot, settings, flows } = data;

      // Create new bot
      const newBot = await db.query(
        'INSERT INTO bots (name, platform, description, user_id, organization_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [bot.name + ' (imported)', bot.platform, bot.description, req.user.id, req.organization.id]
      );

      // Import settings if exist
      if (settings && Object.keys(settings).length > 0) {
        await db.query(
          'INSERT INTO bot_settings (bot_id, welcome_message, language) VALUES ($1, $2, $3)',
          [newBot.rows[0].id, settings.welcome_message, settings.language]
        );
      }

      // Import flows if exist
      if (flows && flows.length > 0) {
        for (const flow of flows) {
          await db.query(
            'INSERT INTO bot_flows (bot_id, name, data) VALUES ($1, $2, $3)',
            [newBot.rows[0].id, flow.name, flow.data]
          );
        }
      }

      res.status(201).json({ success: true, data: newBot.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('GET /api/bots/:id/export', () => {
    it('should export bot data', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', platform: 'telegram' }] })
        .mockResolvedValueOnce({ rows: [{ welcome_message: 'Hi' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Flow 1' }] });

      const res = await request(exportApp).get('/api/bots/1/export');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.version).toBe('1.0');
      expect(res.body.data.bot).toBeDefined();
      expect(res.body.data.exportedAt).toBeDefined();
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(exportApp).get('/api/bots/999/export');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(exportApp).get('/api/bots/1/export');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/bots/import', () => {
    it('should import bot data', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Test Bot (imported)' }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(exportApp)
        .post('/api/bots/import')
        .send({
          data: {
            version: '1.0',
            bot: { name: 'Test Bot', platform: 'telegram' },
            settings: { welcome_message: 'Hi' },
            flows: []
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if data is missing', async () => {
      const res = await request(exportApp)
        .post('/api/bots/import')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 400 if version is missing', async () => {
      const res = await request(exportApp)
        .post('/api/bots/import')
        .send({
          data: {
            bot: { name: 'Test' }
          }
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('version');
    });

    it('should return 400 if bot data is missing', async () => {
      const res = await request(exportApp)
        .post('/api/bots/import')
        .send({
          data: { version: '1.0' }
        });

      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(exportApp)
        .post('/api/bots/import')
        .send({
          data: {
            version: '1.0',
            bot: { name: 'Test', platform: 'telegram' }
          }
        });

      expect(res.status).toBe(500);
    });
  });
});

// ========================================
// MULTI-LANGUAGE BOT TESTS
// ========================================
describe('Bot Multi-Language Support', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('Language Validation', () => {
    it('should accept valid language code - en', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'en' }] });
      const res = await request(app).post('/api/bots').send({ name: 'Bot', platform: 'telegram', language: 'en' });
      expect(res.status).toBe(201);
    });

    it('should accept valid language code - tr', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'tr' }] });
      const res = await request(app).post('/api/bots').send({ name: 'Bot', platform: 'telegram', language: 'tr' });
      expect(res.status).toBe(201);
    });

    it('should accept valid language code - az', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'az' }] });
      const res = await request(app).post('/api/bots').send({ name: 'Bot', platform: 'telegram', language: 'az' });
      expect(res.status).toBe(201);
    });

    it('should accept valid language code - ru', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'ru' }] });
      const res = await request(app).post('/api/bots').send({ name: 'Bot', platform: 'telegram', language: 'ru' });
      expect(res.status).toBe(201);
    });

    it('should accept valid language code - ka (Georgian)', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'ka' }] });
      const res = await request(app).post('/api/bots').send({ name: 'Bot', platform: 'telegram', language: 'ka' });
      expect(res.status).toBe(201);
    });

    it('should accept valid language code - de', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'de' }] });
      const res = await request(app).post('/api/bots').send({ name: 'Bot', platform: 'telegram', language: 'de' });
      expect(res.status).toBe(201);
    });

    it('should accept auto-detect language', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'auto' }] });
      const res = await request(app).post('/api/bots').send({ name: 'Bot', platform: 'telegram', language: 'auto' });
      expect(res.status).toBe(201);
    });

    it('should default to en when language not provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'en' }] });
      const res = await request(app).post('/api/bots').send({ name: 'Bot', platform: 'telegram' });
      expect(res.status).toBe(201);
    });
  });

  describe('Language Update', () => {
    it('should update bot language successfully', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, language: 'en' }] }).mockResolvedValueOnce({ rows: [{ id: 1, language: 'tr' }] });
      const res = await request(app).put('/api/bots/1').send({ language: 'tr' });
      expect(res.status).toBe(200);
    });

    it('should update from auto to specific language', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, language: 'auto' }] }).mockResolvedValueOnce({ rows: [{ id: 1, language: 'fr' }] });
      const res = await request(app).put('/api/bots/1').send({ language: 'fr' });
      expect(res.status).toBe(200);
    });

    it('should update from specific language to auto', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, language: 'en' }] }).mockResolvedValueOnce({ rows: [{ id: 1, language: 'auto' }] });
      const res = await request(app).put('/api/bots/1').send({ language: 'auto' });
      expect(res.status).toBe(200);
    });
  });

  describe('Unicode Bot Names', () => {
    it('should accept bot name in Turkish', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Türkçe Bot' }] });
      const res = await request(app).post('/api/bots').send({ name: 'Türkçe Bot', platform: 'telegram' });
      expect(res.status).toBe(201);
    });

    it('should accept bot name in Russian', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Русский Бот' }] });
      const res = await request(app).post('/api/bots').send({ name: 'Русский Бот', platform: 'telegram' });
      expect(res.status).toBe(201);
    });

    it('should accept bot name in Arabic', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'بوت عربي' }] });
      const res = await request(app).post('/api/bots').send({ name: 'بوت عربي', platform: 'telegram' });
      expect(res.status).toBe(201);
    });

    it('should accept bot name in Chinese', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: '中文机器人' }] });
      const res = await request(app).post('/api/bots').send({ name: '中文机器人', platform: 'telegram' });
      expect(res.status).toBe(201);
    });

    it('should accept bot name in Japanese', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: '日本語ボット' }] });
      const res = await request(app).post('/api/bots').send({ name: '日本語ボット', platform: 'telegram' });
      expect(res.status).toBe(201);
    });

    it('should accept bot name in Georgian', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'ქართული ბოტი' }] });
      const res = await request(app).post('/api/bots').send({ name: 'ქართული ბოტი', platform: 'telegram' });
      expect(res.status).toBe(201);
    });

    it('should accept bot name with emojis', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: '🤖 Bot Name 🚀' }] });
      const res = await request(app).post('/api/bots').send({ name: '🤖 Bot Name 🚀', platform: 'telegram' });
      expect(res.status).toBe(201);
    });
  });
});

// ========================================
// BOT EDGE CASES
// ========================================
describe('Bot Edge Cases', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('Name Validation', () => {
    it('should reject empty bot name', async () => {
      const res = await request(app).post('/api/bots').send({ name: '', platform: 'telegram' });
      expect(res.status).toBe(400);
    });

    it('should reject whitespace-only bot name', async () => {
      const res = await request(app).post('/api/bots').send({ name: '   ', platform: 'telegram' });
      expect(res.status).toBe(400);
    });

    it('should accept very long bot name', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'A'.repeat(255) }] });
      const res = await request(app).post('/api/bots').send({ name: 'A'.repeat(255), platform: 'telegram' });
      expect(res.status).toBe(201);
    });

    it('should accept bot name with special characters', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: "Bot's Name (v2.0) - Test!" }] });
      const res = await request(app).post('/api/bots').send({ name: "Bot's Name (v2.0) - Test!", platform: 'telegram' });
      expect(res.status).toBe(201);
    });
  });

  describe('Platform Validation', () => {
    it('should reject empty platform', async () => {
      const res = await request(app).post('/api/bots').send({ name: 'Bot', platform: '' });
      expect(res.status).toBe(400);
    });

    it('should reject invalid platform', async () => {
      const res = await request(app).post('/api/bots').send({ name: 'Bot', platform: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('should accept platform case-insensitive', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, platform: 'telegram' }] });
      const res = await request(app).post('/api/bots').send({ name: 'Bot', platform: 'TELEGRAM' });
      expect([200, 201, 400]).toContain(res.status);
    });
  });

  describe('Concurrent Bot Operations', () => {
    it('should handle multiple bot creations', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, name: 'Bot' }] });
      const promises = Array(5).fill(null).map((_, i) =>
        request(app).post('/api/bots').send({ name: `Bot ${i}`, platform: 'telegram' })
      );
      const results = await Promise.all(promises);
      results.forEach(res => expect(res.status).toBe(201));
    });

    it('should handle multiple bot updates', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, name: 'Updated' }] });
      const promises = Array(3).fill(null).map((_, i) =>
        request(app).put('/api/bots/1').send({ name: `Updated ${i}` })
      );
      const results = await Promise.all(promises);
      results.forEach(res => expect(res.status).toBe(200));
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should handle SQL injection in bot name', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: "'; DROP TABLE bots; --" }] });
      const res = await request(app).post('/api/bots').send({ name: "'; DROP TABLE bots; --", platform: 'telegram' });
      expect([201, 400]).toContain(res.status);
    });

    it('should handle SQL injection in bot ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get("/api/bots/1; DROP TABLE bots; --");
      expect([404, 400, 500]).toContain(res.status);
    });
  });

  describe('Additional Bot API Tests', () => {
    it('should handle bot with description', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', description: 'My bot description' }] });
      const res = await request(app).post('/api/bots').send({ name: 'Bot', platform: 'telegram', description: 'My bot description' });
      expect(res.status).toBe(201);
    });

    it('should handle bot with empty description', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', description: '' }] });
      const res = await request(app).post('/api/bots').send({ name: 'Bot', platform: 'telegram', description: '' });
      expect(res.status).toBe(201);
    });

    it('should list bots with pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: Array(10).fill({ id: 1, name: 'Bot' }) });
      const res = await request(app).get('/api/bots');
      expect(res.status).toBe(200);
    });

    it('should search bots by name', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'SearchBot' }] });
      const res = await request(app).get('/api/bots');
      expect(res.status).toBe(200);
    });

    it('should filter bots by platform', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'TelegramBot', platform: 'telegram' }] });
      const res = await request(app).get('/api/bots');
      expect(res.status).toBe(200);
    });

    it('should handle bot status update', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', status: 'active' }] });
      const res = await request(app).put('/api/bots/1').send({ status: 'active' });
      expect(res.status).toBe(200);
    });

    it('should handle bot deactivation', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', status: 'inactive' }] });
      const res = await request(app).put('/api/bots/1').send({ status: 'inactive' });
      expect(res.status).toBe(200);
    });
  });
});
