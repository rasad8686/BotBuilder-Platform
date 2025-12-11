/**
 * Analytics API Tests - Real Route Coverage
 * Tests for /api/analytics endpoints
 * Uses actual route handlers for code coverage
 */

const request = require('supertest');
const express = require('express');

// ========================================
// MOCKS - Must be defined BEFORE imports
// ========================================

// Mock the database
jest.mock('../db', () => ({
  query: jest.fn(),
  pool: { query: jest.fn() }
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  http: jest.fn()
}));

// Mock authentication middleware
jest.mock('../middleware/auth', () => {
  return jest.fn((req, res, next) => {
    req.user = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      current_organization_id: 1,
      organization_id: 1
    };
    next();
  });
});

// Mock organization context middleware
jest.mock('../middleware/organizationContext', () => ({
  organizationContext: jest.fn((req, res, next) => {
    req.organization = {
      id: 1,
      org_id: 1,
      name: 'Test Organization',
      slug: 'test-org',
      role: 'admin',
      owner_id: 1,
      is_owner: true
    };
    next();
  }),
  requireOrganization: jest.fn((req, res, next) => {
    if (!req.organization || !req.organization.id) {
      return res.status(403).json({
        success: false,
        message: 'Organization context required'
      });
    }
    next();
  })
}));

// ========================================
// NOW import the actual routes
// ========================================
const db = require('../db');
const analyticsRouter = require('../routes/analytics');

// Create test app with REAL routes
const app = express();
app.use(express.json());
app.use('/api/analytics', analyticsRouter);

// ========================================
// TEST SUITES
// ========================================

describe('Analytics API - Real Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // GET /api/analytics/dashboard
  // ========================================
  describe('GET /api/analytics/dashboard', () => {
    it('should return dashboard statistics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] }) // org plan
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // bots count
        .mockResolvedValueOnce({ rows: [{ message_count: '150' }] }) // messages
        .mockResolvedValueOnce({ rows: [{ sent: '100', received: '50' }] }); // breakdown

      const res = await request(app).get('/api/analytics/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.subscription).toBeDefined();
      expect(res.body.bots).toBeDefined();
      expect(res.body.messages).toBeDefined();
    });

    it('should default to free plan when org not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // no org
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ sent: '0', received: '0' }] });

      const res = await request(app).get('/api/analytics/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.subscription.plan_name).toBe('free');
    });

    it('should handle enterprise plan with unlimited', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] })
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({ rows: [{ message_count: '100000' }] })
        .mockResolvedValueOnce({ rows: [{ sent: '50000', received: '50000' }] });

      const res = await request(app).get('/api/analytics/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.bots.limit).toBe(-1); // unlimited
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/analytics/dashboard');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // GET /api/analytics/overview
  // ========================================
  describe('GET /api/analytics/overview', () => {
    it('should return overview statistics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1000' }] }) // messages
        .mockResolvedValueOnce({ rows: [{ total: '5' }] }) // bots
        .mockResolvedValueOnce({ rows: [{ total: '200' }] }) // api calls
        .mockResolvedValueOnce({ rows: [{ total: '3' }] }); // active users

      const res = await request(app).get('/api/analytics/overview');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalMessages).toBe(1000);
      expect(res.body.data.totalBots).toBe(5);
      expect(res.body.data.apiCalls).toBe(200);
      expect(res.body.data.activeUsers).toBe(3);
    });

    it('should handle zero values', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] });

      const res = await request(app).get('/api/analytics/overview');

      expect(res.status).toBe(200);
      expect(res.body.data.totalMessages).toBe(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/analytics/overview');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // GET /api/analytics/messages-over-time
  // ========================================
  describe('GET /api/analytics/messages-over-time', () => {
    it('should return message counts by day', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { date: '2024-01-01', count: '10' },
          { date: '2024-01-02', count: '15' }
        ]
      });

      const res = await request(app).get('/api/analytics/messages-over-time');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('should accept custom days parameter', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/messages-over-time?days=30');

      expect(res.status).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/analytics/messages-over-time');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // GET /api/analytics/by-bot
  // ========================================
  describe('GET /api/analytics/by-bot', () => {
    it('should return message counts per bot', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Bot 1', message_count: '100' },
          { id: 2, name: 'Bot 2', message_count: '50' }
        ]
      });

      const res = await request(app).get('/api/analytics/by-bot');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].botName).toBe('Bot 1');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/analytics/by-bot');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // GET /api/analytics/recent-activity
  // ========================================
  describe('GET /api/analytics/recent-activity', () => {
    it('should return recent activity', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, bot_id: 1, bot_name: 'Bot 1', message_type: 'user_message', content: 'Hello', created_at: '2024-01-01' }
        ]
      });

      const res = await request(app).get('/api/analytics/recent-activity');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].botName).toBe('Bot 1');
    });

    it('should truncate long content', async () => {
      const longContent = 'A'.repeat(200);
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, bot_id: 1, bot_name: 'Bot 1', message_type: 'user_message', content: longContent, created_at: '2024-01-01' }]
      });

      const res = await request(app).get('/api/analytics/recent-activity');

      expect(res.status).toBe(200);
      expect(res.body.data[0].content.length).toBeLessThanOrEqual(100);
    });

    it('should handle null content', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, bot_id: 1, bot_name: 'Bot 1', message_type: 'user_message', content: null, created_at: '2024-01-01' }]
      });

      const res = await request(app).get('/api/analytics/recent-activity');

      expect(res.status).toBe(200);
      expect(res.body.data[0].content).toBe('');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/analytics/recent-activity');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // GET /api/analytics/hourly-activity
  // ========================================
  describe('GET /api/analytics/hourly-activity', () => {
    it('should return hourly activity', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { hour: 9, count: '10' },
          { hour: 10, count: '15' }
        ]
      });

      const res = await request(app).get('/api/analytics/hourly-activity');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(24); // All 24 hours
    });

    it('should fill missing hours with zero', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ hour: 12, count: '5' }] });

      const res = await request(app).get('/api/analytics/hourly-activity');

      expect(res.status).toBe(200);
      expect(res.body.data[0].count).toBe(0);
      expect(res.body.data[12].count).toBe(5);
    });

    it('should accept custom days parameter', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/hourly-activity?days=30');

      expect(res.status).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/analytics/hourly-activity');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // GET /api/analytics/top-questions
  // ========================================
  describe('GET /api/analytics/top-questions', () => {
    it('should return top questions', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { content: 'How to reset password?', count: '50', last_asked: '2024-01-01' },
          { content: 'What are your hours?', count: '30', last_asked: '2024-01-02' }
        ]
      });

      const res = await request(app).get('/api/analytics/top-questions');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('should accept custom limit', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/top-questions?limit=5');

      expect(res.status).toBe(200);
    });

    it('should handle null content', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ content: null, count: '5', last_asked: '2024-01-01' }]
      });

      const res = await request(app).get('/api/analytics/top-questions');

      expect(res.status).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/analytics/top-questions');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // GET /api/analytics/response-metrics
  // ========================================
  describe('GET /api/analytics/response-metrics', () => {
    it('should return response metrics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { message_type: 'response', count: '80' },
          { message_type: 'fallback', count: '20' },
          { message_type: 'user_message', count: '100' }
        ]
      });
      db.query.mockResolvedValueOnce({ rows: [{ sessions: '50' }] });

      const res = await request(app).get('/api/analytics/response-metrics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.successRate).toBeDefined();
      expect(res.body.data.fallbackRate).toBeDefined();
    });

    it('should handle no responses (100% success rate)', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [{ sessions: '0' }] });

      const res = await request(app).get('/api/analytics/response-metrics');

      expect(res.status).toBe(200);
      expect(res.body.data.successRate).toBe(100);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/analytics/response-metrics');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // GET /api/analytics/user-sessions
  // ========================================
  describe('GET /api/analytics/user-sessions', () => {
    it('should return user sessions', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { session_id: 'sess1', bot_name: 'Bot 1', message_count: '10', started_at: '2024-01-01T10:00:00', last_activity: '2024-01-01T10:30:00' }
        ]
      });

      const res = await request(app).get('/api/analytics/user-sessions');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].sessionId).toBe('sess1');
    });

    it('should accept custom limit', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/user-sessions?limit=10');

      expect(res.status).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/analytics/user-sessions');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // GET /api/analytics/export
  // ========================================
  describe('GET /api/analytics/export', () => {
    it('should export messages as CSV', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, bot_name: 'Bot 1', message_type: 'user_message', content: 'Hello', session_id: 'sess1', created_at: '2024-01-01' }
        ]
      });

      const res = await request(app).get('/api/analytics/export?type=messages');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });

    it('should export daily stats as CSV', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { date: '2024-01-01', total_messages: 100, unique_sessions: 20, user_messages: 50, bot_responses: 40, fallbacks: 10 }
        ]
      });

      const res = await request(app).get('/api/analytics/export?type=daily');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });

    it('should return 404 when no data', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/export?type=messages');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should escape quotes in CSV', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, content: 'Hello "World"' }]
      });

      const res = await request(app).get('/api/analytics/export?type=messages');

      expect(res.status).toBe(200);
      expect(res.text).toContain('""World""');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/analytics/export');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // GET /api/analytics/comprehensive
  // ========================================
  describe('GET /api/analytics/comprehensive', () => {
    it('should return comprehensive analytics', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total_messages: '100', total_sessions: '20', active_bots: '3' }] });
      db.query.mockResolvedValueOnce({ rows: [{ date: '2024-01-01', count: '10' }] });
      db.query.mockResolvedValueOnce({ rows: [{ hour: 12, count: '5' }] });
      db.query.mockResolvedValueOnce({ rows: [{ message_type: 'user_message', count: '50' }] });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot 1', message_count: '100', session_count: '20' }] });

      const res = await request(app).get('/api/analytics/comprehensive');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.overview).toBeDefined();
      expect(res.body.data.dailyTrend).toBeDefined();
      expect(res.body.data.hourlyDistribution).toBeDefined();
      expect(res.body.data.messageTypes).toBeDefined();
      expect(res.body.data.botStats).toBeDefined();
    });

    it('should filter by botId when provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total_messages: '50', total_sessions: '10', active_bots: '1' }] });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/comprehensive?botId=1');

      expect(res.status).toBe(200);
    });

    it('should fill missing dates in daily trend', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total_messages: '0', total_sessions: '0', active_bots: '0' }] });
      db.query.mockResolvedValueOnce({ rows: [] }); // no daily data
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/comprehensive?days=7');

      expect(res.status).toBe(200);
      expect(res.body.data.dailyTrend).toHaveLength(7);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/analytics/comprehensive');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
