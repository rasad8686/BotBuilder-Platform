/**
 * Analytics Routes Tests
 * Tests for server/routes/analytics.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
}));

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: jest.fn((req, res, next) => {
    req.organization = { id: 1, name: 'Test Org' };
    next();
  }),
  requireOrganization: jest.fn((req, res, next) => next())
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const db = require('../../db');
const analyticsRouter = require('../../routes/analytics');

const app = express();
app.use(express.json());
app.use('/api/analytics', analyticsRouter);

describe('Analytics Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/analytics/dashboard', () => {
    it('should return dashboard stats', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] }) // Plan
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // Bots
        .mockResolvedValueOnce({ rows: [{ message_count: '1000' }] }) // Messages
        .mockResolvedValueOnce({ rows: [{ sent: '600', received: '400' }] }); // Breakdown

      const response = await request(app).get('/api/analytics/dashboard');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.subscription.plan_name).toBe('pro');
      expect(response.body.bots.total).toBe(5);
      expect(response.body.messages.total).toBe(1000);
    });

    it('should handle free plan', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ sent: '0', received: '0' }] });

      const response = await request(app).get('/api/analytics/dashboard');

      expect(response.status).toBe(200);
      expect(response.body.subscription.plan_name).toBe('free');
      expect(response.body.bots.limit).toBe(1);
    });

    it('should handle enterprise plan (unlimited)', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] })
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({ rows: [{ message_count: '100000' }] })
        .mockResolvedValueOnce({ rows: [{ sent: '50000', received: '50000' }] });

      const response = await request(app).get('/api/analytics/dashboard');

      expect(response.status).toBe(200);
      expect(response.body.bots.limit).toBe(-1);
      expect(response.body.messages.limit).toBe(-1);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/analytics/dashboard');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/analytics/overview', () => {
    it('should return overview stats', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1000' }] }) // Messages
        .mockResolvedValueOnce({ rows: [{ total: '10' }] }) // Bots
        .mockResolvedValueOnce({ rows: [{ total: '500' }] }) // API calls
        .mockResolvedValueOnce({ rows: [{ total: '5' }] }); // Active users

      const response = await request(app).get('/api/analytics/overview');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalMessages).toBe(1000);
      expect(response.body.data.totalBots).toBe(10);
      expect(response.body.data.apiCalls).toBe(500);
      expect(response.body.data.activeUsers).toBe(5);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/analytics/overview');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/analytics/messages-over-time', () => {
    it('should return daily message counts', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { date: '2024-01-01', count: '100' },
          { date: '2024-01-02', count: '150' }
        ]
      });

      const response = await request(app).get('/api/analytics/messages-over-time');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].count).toBe(100);
    });

    it('should support custom days parameter', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/analytics/messages-over-time?days=30');

      expect(db.query).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/analytics/messages-over-time');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/analytics/by-bot', () => {
    it('should return per-bot message counts', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Bot 1', message_count: '500' },
          { id: 2, name: 'Bot 2', message_count: '300' }
        ]
      });

      const response = await request(app).get('/api/analytics/by-bot');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].botName).toBe('Bot 1');
      expect(response.body.data[0].messageCount).toBe(500);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/analytics/by-bot');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/analytics/recent-activity', () => {
    it('should return recent activity', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            bot_id: 1,
            bot_name: 'Bot 1',
            message_type: 'response',
            content: 'Hello!',
            created_at: new Date()
          }
        ]
      });

      const response = await request(app).get('/api/analytics/recent-activity');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data[0].botName).toBe('Bot 1');
    });

    it('should truncate long content', async () => {
      const longContent = 'A'.repeat(200);
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          bot_id: 1,
          bot_name: 'Bot 1',
          message_type: 'response',
          content: longContent,
          created_at: new Date()
        }]
      });

      const response = await request(app).get('/api/analytics/recent-activity');

      expect(response.body.data[0].content.length).toBe(100);
    });

    it('should handle null content', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          bot_id: 1,
          bot_name: 'Bot 1',
          message_type: 'response',
          content: null,
          created_at: new Date()
        }]
      });

      const response = await request(app).get('/api/analytics/recent-activity');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/analytics/hourly-activity', () => {
    it('should return hourly activity', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { hour: '9', count: '100' },
          { hour: '10', count: '150' }
        ]
      });

      const response = await request(app).get('/api/analytics/hourly-activity');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(24);
      expect(response.body.data[9].count).toBe(100);
      expect(response.body.data[10].count).toBe(150);
    });

    it('should fill missing hours with 0', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/analytics/hourly-activity');

      expect(response.body.data).toHaveLength(24);
      expect(response.body.data.every(h => h.count === 0)).toBe(true);
    });
  });

  describe('GET /api/analytics/top-questions', () => {
    it('should return top questions', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { content: 'What is the price?', count: '50', last_asked: new Date() },
          { content: 'How to return?', count: '30', last_asked: new Date() }
        ]
      });

      const response = await request(app).get('/api/analytics/top-questions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].count).toBe(50);
    });

    it('should support custom limit', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/analytics/top-questions?limit=5');

      expect(db.query).toHaveBeenCalledWith(expect.any(String), [1, 5]);
    });

    it('should handle null content', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          content: null,
          count: '10',
          last_asked: new Date()
        }]
      });

      const response = await request(app).get('/api/analytics/top-questions');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/analytics/response-metrics', () => {
    it('should return response metrics', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { message_type: 'response', count: '800' },
            { message_type: 'fallback', count: '100' },
            { message_type: 'greeting', count: '100' },
            { message_type: 'user_message', count: '1000' }
          ]
        })
        .mockResolvedValueOnce({ rows: [{ sessions: '200' }] });

      const response = await request(app).get('/api/analytics/response-metrics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.successRate).toBeDefined();
      expect(response.body.data.totalResponses).toBe(1000);
      expect(response.body.data.uniqueSessions).toBe(200);
    });

    it('should handle empty data', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/analytics/response-metrics');

      expect(response.status).toBe(200);
      expect(response.body.data.successRate).toBe(100);
    });
  });

  describe('GET /api/analytics/user-sessions', () => {
    it('should return user sessions', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            session_id: 'sess123',
            bot_name: 'Bot 1',
            message_count: '10',
            started_at: new Date('2024-01-01T10:00:00'),
            last_activity: new Date('2024-01-01T10:30:00')
          }
        ]
      });

      const response = await request(app).get('/api/analytics/user-sessions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data[0].sessionId).toBe('sess123');
      expect(response.body.data[0].messageCount).toBe(10);
    });

    it('should support custom limit', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/analytics/user-sessions?limit=10');

      expect(db.query).toHaveBeenCalledWith(expect.any(String), [1, 10]);
    });
  });

  describe('GET /api/analytics/export', () => {
    it('should export messages as CSV', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            bot_name: 'Bot 1',
            message_type: 'response',
            content: 'Hello',
            session_id: 'sess123',
            created_at: new Date()
          }
        ]
      });

      const response = await request(app).get('/api/analytics/export?type=messages');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('should export daily stats as CSV', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            date: '2024-01-01',
            total_messages: '100',
            unique_sessions: '20',
            user_messages: '50',
            bot_responses: '40',
            fallbacks: '10'
          }
        ]
      });

      const response = await request(app).get('/api/analytics/export?type=daily');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should return 404 if no data', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/analytics/export');

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('No data');
    });

    it('should escape CSV values', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          bot_name: 'Bot "Test"',
          message_type: 'response',
          content: 'Hello, World',
          session_id: 'sess123',
          created_at: new Date()
        }]
      });

      const response = await request(app).get('/api/analytics/export');

      expect(response.status).toBe(200);
      expect(response.text).toContain('""');
    });
  });

  describe('GET /api/analytics/comprehensive', () => {
    it('should return comprehensive analytics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total_messages: '1000', total_sessions: '100', active_bots: '5' }] })
        .mockResolvedValueOnce({ rows: [{ date: '2024-01-01', count: '100' }] })
        .mockResolvedValueOnce({ rows: [{ hour: '9', count: '50' }] })
        .mockResolvedValueOnce({ rows: [{ message_type: 'response', count: '800' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot 1', message_count: '500', session_count: '50' }] });

      const response = await request(app).get('/api/analytics/comprehensive');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overview).toBeDefined();
      expect(response.body.data.dailyTrend).toBeDefined();
      expect(response.body.data.hourlyDistribution).toBeDefined();
      expect(response.body.data.messageTypes).toBeDefined();
      expect(response.body.data.botStats).toBeDefined();
    });

    it('should support botId filter', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total_messages: '100', total_sessions: '10', active_bots: '1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/analytics/comprehensive?botId=1');

      expect(db.query).toHaveBeenCalled();
    });

    it('should handle empty data', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total_messages: '0', total_sessions: '0', active_bots: '0' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/analytics/comprehensive');

      expect(response.status).toBe(200);
      expect(response.body.data.overview.totalMessages).toBe(0);
      expect(response.body.data.dailyTrend.length).toBeGreaterThan(0);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/analytics/comprehensive');

      expect(response.status).toBe(500);
    });
  });
});
