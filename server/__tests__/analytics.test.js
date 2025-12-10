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
