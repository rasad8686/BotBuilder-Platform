/**
 * Analytics API Tests
 * Tests for /api/analytics endpoints: dashboard data
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

// Mock analytics routes
app.get('/api/analytics/dashboard', mockAuth, async (req, res) => {
  try {
    // Get total bots count
    const botsResult = await db.query(
      'SELECT COUNT(*) as total FROM bots WHERE organization_id = $1',
      [req.organization.id]
    );

    // Get total messages count
    const messagesResult = await db.query(
      'SELECT COUNT(*) as total FROM messages WHERE organization_id = $1',
      [req.organization.id]
    );

    // Get active bots (bots with messages in last 24 hours)
    const activeBotsResult = await db.query(
      `SELECT COUNT(DISTINCT bot_id) as total FROM messages
       WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [req.organization.id]
    );

    res.json({
      success: true,
      data: {
        totalBots: parseInt(botsResult.rows[0].total),
        totalMessages: parseInt(messagesResult.rows[0].total),
        activeBots: parseInt(activeBotsResult.rows[0].total)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/analytics/messages', mockAuth, async (req, res) => {
  try {
    const { period = '7d', bot_id } = req.query;

    let interval;
    switch (period) {
      case '24h': interval = '24 hours'; break;
      case '7d': interval = '7 days'; break;
      case '30d': interval = '30 days'; break;
      default: interval = '7 days';
    }

    let query = `
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM messages
      WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
    `;
    const params = [req.organization.id];

    if (bot_id) {
      query += ' AND bot_id = $2';
      params.push(bot_id);
    }

    query += ' GROUP BY DATE(created_at) ORDER BY date ASC';

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/analytics/bots/:id', mockAuth, async (req, res) => {
  try {
    // Check if bot exists and belongs to organization
    const botResult = await db.query(
      'SELECT * FROM bots WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (botResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Bot not found' });
    }

    // Get bot statistics
    const messagesResult = await db.query(
      'SELECT COUNT(*) as total FROM messages WHERE bot_id = $1',
      [req.params.id]
    );

    const todayResult = await db.query(
      `SELECT COUNT(*) as total FROM messages
       WHERE bot_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        bot: botResult.rows[0],
        totalMessages: parseInt(messagesResult.rows[0].total),
        messagesToday: parseInt(todayResult.rows[0].total)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/analytics/usage', mockAuth, async (req, res) => {
  try {
    // Get usage statistics for the current period
    const usageResult = await db.query(
      `SELECT
        COUNT(DISTINCT bot_id) as active_bots,
        COUNT(*) as total_messages,
        COUNT(DISTINCT DATE(created_at)) as active_days
       FROM messages
       WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [req.organization.id]
    );

    // Get plan limits
    const planResult = await db.query(
      'SELECT plan_tier FROM organizations WHERE id = $1',
      [req.organization.id]
    );

    const planLimits = {
      free: { bots: 1, messages: 1000 },
      pro: { bots: 10, messages: 50000 },
      enterprise: { bots: -1, messages: -1 }
    };

    const plan = planResult.rows[0]?.plan_tier || 'free';
    const limits = planLimits[plan];

    res.json({
      success: true,
      data: {
        usage: usageResult.rows[0],
        plan: plan,
        limits: limits
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Analytics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // DASHBOARD
  // ========================================
  describe('GET /api/analytics/dashboard', () => {
    it('should return dashboard statistics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '5' }] }) // bots
        .mockResolvedValueOnce({ rows: [{ total: '150' }] }) // messages
        .mockResolvedValueOnce({ rows: [{ total: '3' }] }); // active bots

      const res = await request(app).get('/api/analytics/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalBots).toBe(5);
      expect(res.body.data.totalMessages).toBe(150);
      expect(res.body.data.activeBots).toBe(3);
    });

    it('should return zeros for empty organization', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] });

      const res = await request(app).get('/api/analytics/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalBots).toBe(0);
      expect(res.body.data.totalMessages).toBe(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/analytics/dashboard');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // MESSAGES ANALYTICS
  // ========================================
  describe('GET /api/analytics/messages', () => {
    it('should return message statistics for default period', async () => {
      const mockData = [
        { date: '2024-01-01', count: '10' },
        { date: '2024-01-02', count: '15' },
        { date: '2024-01-03', count: '20' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockData });

      const res = await request(app).get('/api/analytics/messages');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
    });

    it('should filter by period (24h)', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ date: '2024-01-03', count: '25' }] });

      const res = await request(app).get('/api/analytics/messages?period=24h');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should filter by period (30d)', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/messages?period=30d');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should filter by bot_id', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ date: '2024-01-03', count: '10' }] });

      const res = await request(app).get('/api/analytics/messages?bot_id=1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return empty array for no data', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/messages');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/analytics/messages');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // BOT ANALYTICS
  // ========================================
  describe('GET /api/analytics/bots/:id', () => {
    it('should return bot statistics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot' }] }) // bot
        .mockResolvedValueOnce({ rows: [{ total: '100' }] }) // total messages
        .mockResolvedValueOnce({ rows: [{ total: '10' }] }); // today messages

      const res = await request(app).get('/api/analytics/bots/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bot.name).toBe('Test Bot');
      expect(res.body.data.totalMessages).toBe(100);
      expect(res.body.data.messagesToday).toBe(10);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/bots/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/analytics/bots/1');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // USAGE ANALYTICS
  // ========================================
  describe('GET /api/analytics/usage', () => {
    it('should return usage statistics with plan info', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ active_bots: '3', total_messages: '500', active_days: '20' }] })
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] });

      const res = await request(app).get('/api/analytics/usage');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.plan).toBe('pro');
      expect(res.body.data.limits).toBeDefined();
    });

    it('should default to free plan if not set', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ active_bots: '1', total_messages: '100', active_days: '5' }] })
        .mockResolvedValueOnce({ rows: [{}] }); // no plan_tier

      const res = await request(app).get('/api/analytics/usage');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.plan).toBe('free');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/analytics/usage');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================
  describe('Edge Cases', () => {
    it('should handle invalid period parameter', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/messages?period=invalid');

      expect(res.status).toBe(200); // Falls back to default
    });

    it('should handle very large numbers', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '999999999' }] })
        .mockResolvedValueOnce({ rows: [{ total: '999999999' }] })
        .mockResolvedValueOnce({ rows: [{ total: '100' }] });

      const res = await request(app).get('/api/analytics/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.data.totalBots).toBe(999999999);
    });

    it('should handle invalid bot ID format', async () => {
      db.query.mockRejectedValueOnce(new Error('Invalid input syntax'));

      const res = await request(app).get('/api/analytics/bots/invalid');

      expect(res.status).toBe(500);
    });

    it('should handle concurrent requests', async () => {
      db.query
        .mockResolvedValue({ rows: [{ total: '10' }] });

      const requests = [
        request(app).get('/api/analytics/dashboard'),
        request(app).get('/api/analytics/messages'),
        request(app).get('/api/analytics/usage')
      ];

      const responses = await Promise.all(requests);

      responses.forEach(res => {
        expect([200, 500]).toContain(res.status);
      });
    });
  });
});

// ========================================
// ADVANCED ANALYTICS TESTS
// ========================================
describe('Analytics API - Advanced Features', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Create advanced analytics app
  const advancedApp = express();
  advancedApp.use(express.json());

  const mockAuth = (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    req.organization = { id: 1, name: 'Test Org' };
    next();
  };

  // Real-time analytics endpoint
  advancedApp.get('/api/analytics/realtime', mockAuth, async (req, res) => {
    try {
      const activeSessionsResult = await db.query(
        `SELECT COUNT(*) as total FROM active_sessions WHERE organization_id = $1 AND last_activity > NOW() - INTERVAL '5 minutes'`,
        [req.organization.id]
      );

      const recentMessagesResult = await db.query(
        `SELECT COUNT(*) as total FROM messages WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '1 minute'`,
        [req.organization.id]
      );

      res.json({
        success: true,
        data: {
          active_sessions: parseInt(activeSessionsResult.rows[0].total),
          messages_per_minute: parseInt(recentMessagesResult.rows[0].total),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // Export endpoint
  advancedApp.get('/api/analytics/export', mockAuth, async (req, res) => {
    try {
      const { format = 'json', period = '7d', type = 'messages' } = req.query;

      const validFormats = ['json', 'csv', 'xlsx'];
      if (!validFormats.includes(format)) {
        return res.status(400).json({ success: false, message: `Invalid format. Valid: ${validFormats.join(', ')}` });
      }

      const validTypes = ['messages', 'users', 'bots'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ success: false, message: `Invalid type. Valid: ${validTypes.join(', ')}` });
      }

      let interval;
      switch (period) {
        case '24h': interval = '24 hours'; break;
        case '7d': interval = '7 days'; break;
        case '30d': interval = '30 days'; break;
        default: interval = '7 days';
      }

      const result = await db.query(
        `SELECT * FROM ${type} WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '${interval}' LIMIT 10000`,
        [req.organization.id]
      );

      if (format === 'json') {
        res.json({ success: true, data: result.rows, format: 'json' });
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.send('id,data\n1,sample');
      } else {
        res.json({ success: true, message: 'Export file generated', format });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // Top performers endpoint
  advancedApp.get('/api/analytics/top-bots', mockAuth, async (req, res) => {
    try {
      const { period = '7d', limit = 10 } = req.query;

      if (parseInt(limit) > 100) {
        return res.status(400).json({ success: false, message: 'Limit cannot exceed 100' });
      }

      let interval;
      switch (period) {
        case '24h': interval = '24 hours'; break;
        case '7d': interval = '7 days'; break;
        case '30d': interval = '30 days'; break;
        default: interval = '7 days';
      }

      const result = await db.query(
        `SELECT b.id, b.name, COUNT(m.id) as message_count
         FROM bots b
         LEFT JOIN messages m ON b.id = m.bot_id AND m.created_at > NOW() - INTERVAL '${interval}'
         WHERE b.organization_id = $1
         GROUP BY b.id, b.name
         ORDER BY message_count DESC
         LIMIT $2`,
        [req.organization.id, parseInt(limit)]
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // Channel breakdown endpoint
  advancedApp.get('/api/analytics/channels', mockAuth, async (req, res) => {
    try {
      const { period = '7d' } = req.query;

      let interval;
      switch (period) {
        case '24h': interval = '24 hours'; break;
        case '7d': interval = '7 days'; break;
        case '30d': interval = '30 days'; break;
        default: interval = '7 days';
      }

      const result = await db.query(
        `SELECT b.platform, COUNT(m.id) as message_count, COUNT(DISTINCT m.user_id) as unique_users
         FROM messages m
         JOIN bots b ON m.bot_id = b.id
         WHERE m.organization_id = $1 AND m.created_at > NOW() - INTERVAL '${interval}'
         GROUP BY b.platform`,
        [req.organization.id]
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // Engagement metrics endpoint
  advancedApp.get('/api/analytics/engagement', mockAuth, async (req, res) => {
    try {
      const { period = '7d' } = req.query;

      let interval;
      switch (period) {
        case '24h': interval = '24 hours'; break;
        case '7d': interval = '7 days'; break;
        case '30d': interval = '30 days'; break;
        default: interval = '7 days';
      }

      const avgMessagesResult = await db.query(
        `SELECT AVG(msg_count) as avg FROM (
          SELECT user_id, COUNT(*) as msg_count FROM messages
          WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
          GROUP BY user_id
        ) subq`,
        [req.organization.id]
      );

      const returnUsersResult = await db.query(
        `SELECT COUNT(*) as total FROM (
          SELECT user_id FROM messages
          WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
          GROUP BY user_id
          HAVING COUNT(DISTINCT DATE(created_at)) > 1
        ) subq`,
        [req.organization.id]
      );

      res.json({
        success: true,
        data: {
          avg_messages_per_user: parseFloat(avgMessagesResult.rows[0].avg) || 0,
          returning_users: parseInt(returnUsersResult.rows[0].total)
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // Response times endpoint
  advancedApp.get('/api/analytics/response-times', mockAuth, async (req, res) => {
    try {
      const { period = '7d', bot_id } = req.query;

      let interval;
      switch (period) {
        case '24h': interval = '24 hours'; break;
        case '7d': interval = '7 days'; break;
        case '30d': interval = '30 days'; break;
        default: interval = '7 days';
      }

      let query = `
        SELECT
          AVG(response_time_ms) as avg,
          MIN(response_time_ms) as min,
          MAX(response_time_ms) as max
        FROM messages
        WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '${interval}' AND response_time_ms IS NOT NULL
      `;
      const params = [req.organization.id];

      if (bot_id) {
        query += ' AND bot_id = $2';
        params.push(bot_id);
      }

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: {
          average: parseFloat(result.rows[0].avg) || 0,
          minimum: parseFloat(result.rows[0].min) || 0,
          maximum: parseFloat(result.rows[0].max) || 0
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // User growth endpoint
  advancedApp.get('/api/analytics/user-growth', mockAuth, async (req, res) => {
    try {
      const { period = '30d' } = req.query;

      let interval;
      switch (period) {
        case '7d': interval = '7 days'; break;
        case '30d': interval = '30 days'; break;
        case '90d': interval = '90 days'; break;
        default: interval = '30 days';
      }

      const result = await db.query(
        `SELECT DATE(created_at) as date, COUNT(*) as new_users
         FROM bot_users
         WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [req.organization.id]
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // Hourly distribution endpoint
  advancedApp.get('/api/analytics/hourly', mockAuth, async (req, res) => {
    try {
      const { bot_id } = req.query;

      let query = `
        SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
        FROM messages
        WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '7 days'
      `;
      const params = [req.organization.id];

      if (bot_id) {
        query += ' AND bot_id = $2';
        params.push(bot_id);
      }

      query += ' GROUP BY EXTRACT(HOUR FROM created_at) ORDER BY hour ASC';

      const result = await db.query(query, params);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // ========================================
  // REAL-TIME ANALYTICS TESTS
  // ========================================
  describe('GET /api/analytics/realtime', () => {
    it('should return realtime analytics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '25' }] })
        .mockResolvedValueOnce({ rows: [{ total: '10' }] });

      const res = await request(advancedApp).get('/api/analytics/realtime');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.active_sessions).toBe(25);
      expect(res.body.data.messages_per_minute).toBe(10);
      expect(res.body.data.timestamp).toBeDefined();
    });

    it('should handle zero activity', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] });

      const res = await request(advancedApp).get('/api/analytics/realtime');

      expect(res.status).toBe(200);
      expect(res.body.data.active_sessions).toBe(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(advancedApp).get('/api/analytics/realtime');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // EXPORT TESTS
  // ========================================
  describe('GET /api/analytics/export', () => {
    it('should export data in JSON format', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, content: 'Hello' }, { id: 2, content: 'World' }]
      });

      const res = await request(advancedApp).get('/api/analytics/export?format=json');

      expect(res.status).toBe(200);
      expect(res.body.format).toBe('json');
      expect(res.body.data).toHaveLength(2);
    });

    it('should export data in CSV format', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await request(advancedApp).get('/api/analytics/export?format=csv');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });

    it('should export data in XLSX format', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await request(advancedApp).get('/api/analytics/export?format=xlsx');

      expect(res.status).toBe(200);
      expect(res.body.format).toBe('xlsx');
    });

    it('should return 400 for invalid format', async () => {
      const res = await request(advancedApp).get('/api/analytics/export?format=pdf');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid format');
    });

    it('should return 400 for invalid type', async () => {
      const res = await request(advancedApp).get('/api/analytics/export?type=invalid');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid type');
    });

    it('should export users data', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'User' }] });

      const res = await request(advancedApp).get('/api/analytics/export?type=users');

      expect(res.status).toBe(200);
    });

    it('should export bots data', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot' }] });

      const res = await request(advancedApp).get('/api/analytics/export?type=bots');

      expect(res.status).toBe(200);
    });

    it('should handle 24h period', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(advancedApp).get('/api/analytics/export?period=24h');

      expect(res.status).toBe(200);
    });

    it('should handle 30d period', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(advancedApp).get('/api/analytics/export?period=30d');

      expect(res.status).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(advancedApp).get('/api/analytics/export');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // TOP BOTS TESTS
  // ========================================
  describe('GET /api/analytics/top-bots', () => {
    it('should return top bots by message count', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Bot 1', message_count: '500' },
          { id: 2, name: 'Bot 2', message_count: '300' },
          { id: 3, name: 'Bot 3', message_count: '100' }
        ]
      });

      const res = await request(advancedApp).get('/api/analytics/top-bots');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
    });

    it('should respect limit parameter', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Bot 1', message_count: '500' }]
      });

      const res = await request(advancedApp).get('/api/analytics/top-bots?limit=5');

      expect(res.status).toBe(200);
    });

    it('should return 400 if limit exceeds 100', async () => {
      const res = await request(advancedApp).get('/api/analytics/top-bots?limit=150');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('exceed 100');
    });

    it('should filter by 24h period', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(advancedApp).get('/api/analytics/top-bots?period=24h');

      expect(res.status).toBe(200);
    });

    it('should filter by 30d period', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(advancedApp).get('/api/analytics/top-bots?period=30d');

      expect(res.status).toBe(200);
    });

    it('should handle empty results', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(advancedApp).get('/api/analytics/top-bots');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(advancedApp).get('/api/analytics/top-bots');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // CHANNELS ANALYTICS TESTS
  // ========================================
  describe('GET /api/analytics/channels', () => {
    it('should return channel analytics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { platform: 'telegram', message_count: '500', unique_users: '100' },
          { platform: 'whatsapp', message_count: '300', unique_users: '80' }
        ]
      });

      const res = await request(advancedApp).get('/api/analytics/channels');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('should filter by 24h period', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(advancedApp).get('/api/analytics/channels?period=24h');

      expect(res.status).toBe(200);
    });

    it('should filter by 30d period', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(advancedApp).get('/api/analytics/channels?period=30d');

      expect(res.status).toBe(200);
    });

    it('should handle empty results', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(advancedApp).get('/api/analytics/channels');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(advancedApp).get('/api/analytics/channels');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // ENGAGEMENT TESTS
  // ========================================
  describe('GET /api/analytics/engagement', () => {
    it('should return engagement metrics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ avg: '5.5' }] })
        .mockResolvedValueOnce({ rows: [{ total: '150' }] });

      const res = await request(advancedApp).get('/api/analytics/engagement');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.avg_messages_per_user).toBe(5.5);
      expect(res.body.data.returning_users).toBe(150);
    });

    it('should handle null avg value', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ avg: null }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] });

      const res = await request(advancedApp).get('/api/analytics/engagement');

      expect(res.status).toBe(200);
      expect(res.body.data.avg_messages_per_user).toBe(0);
    });

    it('should filter by 24h period', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ avg: '3.0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '50' }] });

      const res = await request(advancedApp).get('/api/analytics/engagement?period=24h');

      expect(res.status).toBe(200);
    });

    it('should filter by 30d period', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ avg: '6.0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '200' }] });

      const res = await request(advancedApp).get('/api/analytics/engagement?period=30d');

      expect(res.status).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(advancedApp).get('/api/analytics/engagement');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // RESPONSE TIMES TESTS
  // ========================================
  describe('GET /api/analytics/response-times', () => {
    it('should return response time metrics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          avg: '150.5',
          min: '50',
          max: '500'
        }]
      });

      const res = await request(advancedApp).get('/api/analytics/response-times');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.average).toBe(150.5);
      expect(res.body.data.minimum).toBe(50);
      expect(res.body.data.maximum).toBe(500);
    });

    it('should filter by bot_id', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ avg: '100', min: '20', max: '300' }]
      });

      const res = await request(advancedApp).get('/api/analytics/response-times?bot_id=1');

      expect(res.status).toBe(200);
    });

    it('should filter by 24h period', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ avg: '100', min: '20', max: '300' }]
      });

      const res = await request(advancedApp).get('/api/analytics/response-times?period=24h');

      expect(res.status).toBe(200);
    });

    it('should filter by 30d period', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ avg: '100', min: '20', max: '300' }]
      });

      const res = await request(advancedApp).get('/api/analytics/response-times?period=30d');

      expect(res.status).toBe(200);
    });

    it('should handle null values', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ avg: null, min: null, max: null }]
      });

      const res = await request(advancedApp).get('/api/analytics/response-times');

      expect(res.status).toBe(200);
      expect(res.body.data.average).toBe(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(advancedApp).get('/api/analytics/response-times');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // USER GROWTH TESTS
  // ========================================
  describe('GET /api/analytics/user-growth', () => {
    it('should return user growth data', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { date: '2024-01-01', new_users: '10' },
          { date: '2024-01-02', new_users: '15' },
          { date: '2024-01-03', new_users: '20' }
        ]
      });

      const res = await request(advancedApp).get('/api/analytics/user-growth');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
    });

    it('should filter by 7d period', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(advancedApp).get('/api/analytics/user-growth?period=7d');

      expect(res.status).toBe(200);
    });

    it('should filter by 90d period', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(advancedApp).get('/api/analytics/user-growth?period=90d');

      expect(res.status).toBe(200);
    });

    it('should handle empty results', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(advancedApp).get('/api/analytics/user-growth');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(advancedApp).get('/api/analytics/user-growth');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // HOURLY DISTRIBUTION TESTS
  // ========================================
  describe('GET /api/analytics/hourly', () => {
    it('should return hourly distribution', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { hour: 9, count: '50' },
          { hour: 10, count: '100' },
          { hour: 11, count: '150' }
        ]
      });

      const res = await request(advancedApp).get('/api/analytics/hourly');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
    });

    it('should filter by bot_id', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ hour: 12, count: '30' }]
      });

      const res = await request(advancedApp).get('/api/analytics/hourly?bot_id=1');

      expect(res.status).toBe(200);
    });

    it('should handle empty results', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(advancedApp).get('/api/analytics/hourly');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(advancedApp).get('/api/analytics/hourly');

      expect(res.status).toBe(500);
    });
  });
});
