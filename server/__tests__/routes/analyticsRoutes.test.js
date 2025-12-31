/**
 * Analytics Routes Tests
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
});

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: (req, res, next) => {
    req.organization = { id: 1, name: 'Test Org' };
    next();
  },
  requireOrganization: (req, res, next) => next()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const analyticsRouter = require('../../routes/analytics');

describe('Analytics Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/analytics', analyticsRouter);
  });

  describe('GET /api/analytics/dashboard', () => {
    it('should return dashboard stats', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] }) // org plan
        .mockResolvedValueOnce({ rows: [{ count: 5 }] }) // bots count
        .mockResolvedValueOnce({ rows: [{ message_count: 1000 }] }) // messages
        .mockResolvedValueOnce({ rows: [{ sent: 600, received: 400 }] }); // breakdown

      const res = await request(app).get('/api/analytics/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.subscription).toBeDefined();
      expect(res.body.bots).toBeDefined();
      expect(res.body.messages).toBeDefined();
    });

    it('should handle free plan', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ sent: 0, received: 0 }] });

      const res = await request(app).get('/api/analytics/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.subscription.plan_name).toBe('free');
    });

    it('should handle enterprise plan (unlimited)', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] })
        .mockResolvedValueOnce({ rows: [{ count: 100 }] })
        .mockResolvedValueOnce({ rows: [{ message_count: 100000 }] })
        .mockResolvedValueOnce({ rows: [{ sent: 50000, received: 50000 }] });

      const res = await request(app).get('/api/analytics/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.bots.limit).toBe(-1); // unlimited
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/analytics/dashboard');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/analytics/overview', () => {
    it('should return overview stats', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: 5000 }] }) // messages
        .mockResolvedValueOnce({ rows: [{ total: 10 }] }) // bots
        .mockResolvedValueOnce({ rows: [{ total: 1000 }] }) // api calls
        .mockResolvedValueOnce({ rows: [{ total: 5 }] }); // active users

      const res = await request(app).get('/api/analytics/overview');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalMessages).toBe(5000);
      expect(res.body.data.totalBots).toBe(10);
      expect(res.body.data.apiCalls).toBe(1000);
      expect(res.body.data.activeUsers).toBe(5);
    });

    it('should handle empty results', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [{ total: 0 }] });

      const res = await request(app).get('/api/analytics/overview');

      expect(res.status).toBe(200);
      expect(res.body.data.totalMessages).toBe(0);
    });

    it('should handle error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/analytics/overview');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/analytics/messages-over-time', () => {
    it('should return message counts for default 7 days', async () => {
      db.query.mockResolvedValue({
        rows: [
          { date: '2024-01-01', count: 100 },
          { date: '2024-01-02', count: 150 }
        ]
      });

      const res = await request(app).get('/api/analytics/messages-over-time');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('should handle custom days parameter', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await request(app).get('/api/analytics/messages-over-time?days=30');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, 30])
      );
    });
  });

  describe('GET /api/analytics/bot/:botId', () => {
    it('should return bot-specific analytics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, organization_id: 1 }] }) // bot check
        .mockResolvedValueOnce({ rows: [{ total: 500 }] }) // total messages
        .mockResolvedValueOnce({ rows: [{ avg_response_time: 200 }] }) // avg response
        .mockResolvedValueOnce({ rows: [{ date: '2024-01-01', count: 50 }] }); // daily

      const res = await request(app).get('/api/analytics/bot/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent bot', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/bot/999');

      expect(res.status).toBe(404);
    });

    it('should return 403 for bot not in organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, organization_id: 999 }] });

      const res = await request(app).get('/api/analytics/bot/1');

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/analytics/usage', () => {
    it('should return usage statistics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ tokens_used: 50000, cost: 1.5 }] })
        .mockResolvedValueOnce({ rows: [{ date: '2024-01-01', usage: 5000 }] });

      const res = await request(app).get('/api/analytics/usage');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/analytics/conversations', () => {
    it('should return conversation analytics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: 100, avg_length: 8 }] })
        .mockResolvedValueOnce({ rows: [{ date: '2024-01-01', count: 10 }] });

      const res = await request(app).get('/api/analytics/conversations');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/analytics/intents', () => {
    it('should return intent analytics', async () => {
      db.query.mockResolvedValue({
        rows: [
          { intent: 'greeting', count: 500 },
          { intent: 'goodbye', count: 200 }
        ]
      });

      const res = await request(app).get('/api/analytics/intents');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/analytics/response-times', () => {
    it('should return response time analytics', async () => {
      db.query.mockResolvedValue({
        rows: [
          { date: '2024-01-01', avg_time: 150 },
          { date: '2024-01-02', avg_time: 180 }
        ]
      });

      const res = await request(app).get('/api/analytics/response-times');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/analytics/user-engagement', () => {
    it('should return user engagement analytics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total_users: 1000, returning_users: 300 }] })
        .mockResolvedValueOnce({ rows: [{ hour: 14, count: 500 }] });

      const res = await request(app).get('/api/analytics/user-engagement');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/analytics/channel-distribution', () => {
    it('should return channel distribution', async () => {
      db.query.mockResolvedValue({
        rows: [
          { channel: 'web', count: 500 },
          { channel: 'telegram', count: 300 },
          { channel: 'slack', count: 200 }
        ]
      });

      const res = await request(app).get('/api/analytics/channel-distribution');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/analytics/export', () => {
    it('should export analytics as JSON', async () => {
      db.query.mockResolvedValue({
        rows: [{ date: '2024-01-01', messages: 100, users: 50 }]
      });

      const res = await request(app).get('/api/analytics/export?format=json');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
    });

    it('should export analytics as CSV', async () => {
      db.query.mockResolvedValue({
        rows: [{ date: '2024-01-01', messages: 100, users: 50 }]
      });

      const res = await request(app).get('/api/analytics/export?format=csv');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });
  });

  describe('GET /api/analytics/realtime', () => {
    it('should return realtime analytics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ active_users: 50 }] })
        .mockResolvedValueOnce({ rows: [{ messages_last_hour: 200 }] });

      const res = await request(app).get('/api/analytics/realtime');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
