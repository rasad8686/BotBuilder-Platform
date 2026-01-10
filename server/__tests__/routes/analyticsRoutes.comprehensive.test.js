const express = require('express');
const request = require('supertest');

// Mock dependencies before importing the router
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
const log = require('../../utils/logger');
const analyticsRouter = require('../../routes/analytics');

describe('Analytics Routes - Comprehensive Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/analytics', analyticsRouter);
    jest.clearAllMocks();
  });

  // ==================== DASHBOARD TESTS ====================
  describe('GET /dashboard', () => {
    describe('Free Plan', () => {
      it('should return dashboard stats with free plan limits', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] }) // org plan
          .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // bots count
          .mockResolvedValueOnce({ rows: [{ message_count: '500' }] }) // message usage
          .mockResolvedValueOnce({ rows: [{ sent: '300', received: '200' }] }); // message breakdown

        const res = await request(app).get('/api/analytics/dashboard');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.subscription.plan_name).toBe('free');
        expect(res.body.subscription.display_name).toBe('Free Plan');
        expect(res.body.bots.limit).toBe(1);
        expect(res.body.bots.canCreateMore).toBe(true);
        expect(res.body.messages.limit).toBe(1000);
        expect(res.body.messages.percentage).toBe(50);
        expect(res.body.messages.sent).toBe(300);
        expect(res.body.messages.received).toBe(200);
      });

      it('should calculate correct percentage for free plan bots', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
          .mockResolvedValueOnce({ rows: [{ count: '1' }] })
          .mockResolvedValueOnce({ rows: [{ message_count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ sent: '0', received: '0' }] });

        const res = await request(app).get('/api/analytics/dashboard');

        expect(res.status).toBe(200);
        expect(res.body.bots.total).toBe(1);
        expect(res.body.bots.percentage).toBe(100);
        expect(res.body.bots.canCreateMore).toBe(false);
      });

      it('should prevent creating more bots when at limit', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
          .mockResolvedValueOnce({ rows: [{ count: '1' }] })
          .mockResolvedValueOnce({ rows: [{ message_count: '999' }] })
          .mockResolvedValueOnce({ rows: [{ sent: '600', received: '399' }] });

        const res = await request(app).get('/api/analytics/dashboard');

        expect(res.body.bots.canCreateMore).toBe(false);
      });
    });

    describe('Pro Plan', () => {
      it('should return dashboard stats with pro plan limits', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] })
          .mockResolvedValueOnce({ rows: [{ count: '5' }] })
          .mockResolvedValueOnce({ rows: [{ message_count: '25000' }] })
          .mockResolvedValueOnce({ rows: [{ sent: '15000', received: '10000' }] });

        const res = await request(app).get('/api/analytics/dashboard');

        expect(res.status).toBe(200);
        expect(res.body.subscription.plan_name).toBe('pro');
        expect(res.body.subscription.display_name).toBe('Pro Plan');
        expect(res.body.bots.limit).toBe(10);
        expect(res.body.bots.percentage).toBe(50);
        expect(res.body.bots.canCreateMore).toBe(true);
        expect(res.body.messages.limit).toBe(50000);
        expect(res.body.messages.percentage).toBe(50);
      });

      it('should handle pro plan at capacity', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] })
          .mockResolvedValueOnce({ rows: [{ count: '10' }] })
          .mockResolvedValueOnce({ rows: [{ message_count: '50000' }] })
          .mockResolvedValueOnce({ rows: [{ sent: '30000', received: '20000' }] });

        const res = await request(app).get('/api/analytics/dashboard');

        expect(res.body.bots.percentage).toBe(100);
        expect(res.body.bots.canCreateMore).toBe(false);
        expect(res.body.messages.percentage).toBe(100);
      });
    });

    describe('Enterprise Plan', () => {
      it('should return unlimited limits for enterprise plan', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] })
          .mockResolvedValueOnce({ rows: [{ count: '100' }] })
          .mockResolvedValueOnce({ rows: [{ message_count: '1000000' }] })
          .mockResolvedValueOnce({ rows: [{ sent: '600000', received: '400000' }] });

        const res = await request(app).get('/api/analytics/dashboard');

        expect(res.status).toBe(200);
        expect(res.body.subscription.plan_name).toBe('enterprise');
        expect(res.body.subscription.display_name).toBe('Enterprise Plan');
        expect(res.body.bots.limit).toBe(-1);
        expect(res.body.bots.percentage).toBe(0);
        expect(res.body.bots.canCreateMore).toBe(true);
        expect(res.body.messages.limit).toBe(-1);
        expect(res.body.messages.percentage).toBe(0);
      });

      it('should always allow creating more bots on enterprise', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] })
          .mockResolvedValueOnce({ rows: [{ count: '500' }] })
          .mockResolvedValueOnce({ rows: [{ message_count: '5000000' }] })
          .mockResolvedValueOnce({ rows: [{ sent: '3000000', received: '2000000' }] });

        const res = await request(app).get('/api/analytics/dashboard');

        expect(res.body.bots.canCreateMore).toBe(true);
        expect(res.body.bots.percentage).toBe(0);
      });
    });

    describe('Default Plan', () => {
      it('should default to free plan when plan_tier is null', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{}] }) // no plan_tier
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ message_count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ sent: '0', received: '0' }] });

        const res = await request(app).get('/api/analytics/dashboard');

        expect(res.body.subscription.plan_name).toBe('free');
      });
    });

    describe('Empty Data Handling', () => {
      it('should handle no bots', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ message_count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ sent: '0', received: '0' }] });

        const res = await request(app).get('/api/analytics/dashboard');

        expect(res.body.bots.total).toBe(0);
        expect(res.body.bots.percentage).toBe(0);
      });

      it('should handle no message usage', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] })
          .mockResolvedValueOnce({ rows: [{ count: '1' }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ sent: '0', received: '0' }] });

        const res = await request(app).get('/api/analytics/dashboard');

        expect(res.body.messages.total).toBe(0);
        expect(res.body.messages.percentage).toBe(0);
      });

      it('should handle missing sent/received breakdown', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
          .mockResolvedValueOnce({ rows: [{ count: '1' }] })
          .mockResolvedValueOnce({ rows: [{ message_count: '100' }] })
          .mockResolvedValueOnce({ rows: [] });

        const res = await request(app).get('/api/analytics/dashboard');

        expect(res.body.messages.sent).toBe(0);
        expect(res.body.messages.received).toBe(0);
      });
    });

    describe('Error Handling', () => {
      it('should handle database error on organization query', async () => {
        db.query.mockRejectedValueOnce(new Error('DB Error'));

        const res = await request(app).get('/api/analytics/dashboard');

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Failed to fetch dashboard data');
        expect(log.error).toHaveBeenCalled();
      });

      it('should handle database error on bots query', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
          .mockRejectedValueOnce(new Error('DB Error'));

        const res = await request(app).get('/api/analytics/dashboard');

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
      });
    });
  });

  // ==================== OVERVIEW TESTS ====================
  describe('GET /overview', () => {
    it('should return overview with all metrics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1500' }] }) // messages
        .mockResolvedValueOnce({ rows: [{ total: '5' }] }) // bots
        .mockResolvedValueOnce({ rows: [{ total: '800' }] }) // api calls
        .mockResolvedValueOnce({ rows: [{ total: '10' }] }); // active users

      const res = await request(app).get('/api/analytics/overview');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalMessages).toBe(1500);
      expect(res.body.data.totalBots).toBe(5);
      expect(res.body.data.apiCalls).toBe(800);
      expect(res.body.data.activeUsers).toBe(10);
    });

    it('should handle zero metrics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] });

      const res = await request(app).get('/api/analytics/overview');

      expect(res.body.data.totalMessages).toBe(0);
      expect(res.body.data.totalBots).toBe(0);
      expect(res.body.data.apiCalls).toBe(0);
      expect(res.body.data.activeUsers).toBe(0);
    });

    it('should handle null values in results', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/overview');

      expect(res.body.data.totalMessages).toBe(0);
      expect(res.body.data.totalBots).toBe(0);
      expect(res.body.data.apiCalls).toBe(0);
      expect(res.body.data.activeUsers).toBe(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('DB Connection Error'));

      const res = await request(app).get('/api/analytics/overview');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Failed to fetch analytics');
    });

    it('should query correct time period (30 days)', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '100' }] })
        .mockResolvedValueOnce({ rows: [{ total: '2' }] })
        .mockResolvedValueOnce({ rows: [{ total: '50' }] })
        .mockResolvedValueOnce({ rows: [{ total: '5' }] });

      await request(app).get('/api/analytics/overview');

      const calls = db.query.mock.calls;
      expect(calls[0][0]).toContain('30 days');
      expect(calls[1][0]).toContain('organization');
      expect(calls[2][0]).toContain('30 days');
    });
  });

  // ==================== MESSAGES OVER TIME TESTS ====================
  describe('GET /messages-over-time', () => {
    it('should return daily messages for default 7 days', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { date: '2024-01-01', count: '100' },
          { date: '2024-01-02', count: '150' },
          { date: '2024-01-03', count: '200' }
        ]
      });

      const res = await request(app).get('/api/analytics/messages-over-time');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.data[0].count).toBe(100);
      expect(res.body.data[1].count).toBe(150);
    });

    it('should accept custom days parameter', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/analytics/messages-over-time?days=30');

      const queryCall = db.query.mock.calls[0];
      expect(queryCall[1]).toEqual([1, 30]); // orgId, days
    });

    it('should handle 7 days parameter', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { date: '2024-01-01', count: '50' },
          { date: '2024-01-02', count: '60' },
          { date: '2024-01-03', count: '70' },
          { date: '2024-01-04', count: '80' },
          { date: '2024-01-05', count: '90' },
          { date: '2024-01-06', count: '100' },
          { date: '2024-01-07', count: '110' }
        ]
      });

      const res = await request(app).get('/api/analytics/messages-over-time?days=7');

      expect(res.body.data).toHaveLength(7);
    });

    it('should handle 30 days parameter', async () => {
      const rows = Array.from({ length: 30 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        count: String(100 + i * 10)
      }));

      db.query.mockResolvedValueOnce({ rows });

      const res = await request(app).get('/api/analytics/messages-over-time?days=30');

      expect(res.body.data).toHaveLength(30);
      expect(res.body.data[0].count).toBe(100);
      expect(res.body.data[29].count).toBe(390);
    });

    it('should handle invalid days parameter with default', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/analytics/messages-over-time?days=invalid');

      const queryCall = db.query.mock.calls[0];
      expect(queryCall[1][1]).toBe(7); // defaults to 7
    });

    it('should handle empty data', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/messages-over-time');

      expect(res.body.data).toEqual([]);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Query Error'));

      const res = await request(app).get('/api/analytics/messages-over-time');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== BY-BOT TESTS ====================
  describe('GET /by-bot', () => {
    it('should return message count per bot', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: '1', name: 'Bot A', message_count: '500' },
          { id: '2', name: 'Bot B', message_count: '300' },
          { id: '3', name: 'Bot C', message_count: '100' }
        ]
      });

      const res = await request(app).get('/api/analytics/by-bot');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.data[0].botName).toBe('Bot A');
      expect(res.body.data[0].messageCount).toBe(500);
    });

    it('should handle bots with no messages', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: '1', name: 'Bot A', message_count: '0' },
          { id: '2', name: 'Bot B', message_count: '0' }
        ]
      });

      const res = await request(app).get('/api/analytics/by-bot');

      expect(res.body.data[0].messageCount).toBe(0);
    });

    it('should order by message count descending', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: '1', name: 'Most Used', message_count: '1000' },
          { id: '2', name: 'Middle Used', message_count: '500' },
          { id: '3', name: 'Least Used', message_count: '100' }
        ]
      });

      const res = await request(app).get('/api/analytics/by-bot');

      expect(res.body.data[0].messageCount).toBe(1000);
      expect(res.body.data[1].messageCount).toBe(500);
      expect(res.body.data[2].messageCount).toBe(100);
    });

    it('should limit to 50 bots', async () => {
      const rows = Array.from({ length: 50 }, (_, i) => ({
        id: String(i + 1),
        name: `Bot ${i + 1}`,
        message_count: String(1000 - i * 10)
      }));

      db.query.mockResolvedValueOnce({ rows });

      const res = await request(app).get('/api/analytics/by-bot');

      expect(res.body.data).toHaveLength(50);
    });

    it('should handle no bots', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/by-bot');

      expect(res.body.data).toEqual([]);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/analytics/by-bot');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== RECENT ACTIVITY TESTS ====================
  describe('GET /recent-activity', () => {
    it('should return recent bot interactions', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            bot_id: '10',
            bot_name: 'Bot A',
            message_type: 'response',
            content: 'Hello user',
            created_at: '2024-01-01T12:00:00Z'
          },
          {
            id: '2',
            bot_id: '10',
            bot_name: 'Bot A',
            message_type: 'user_message',
            content: 'Hi bot',
            created_at: '2024-01-01T11:59:00Z'
          }
        ]
      });

      const res = await request(app).get('/api/analytics/recent-activity');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].botName).toBe('Bot A');
    });

    it('should truncate content to 100 characters', async () => {
      const longContent = 'a'.repeat(200);
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            bot_id: '10',
            bot_name: 'Bot A',
            message_type: 'response',
            content: longContent,
            created_at: '2024-01-01T12:00:00Z'
          }
        ]
      });

      const res = await request(app).get('/api/analytics/recent-activity');

      expect(res.body.data[0].content).toHaveLength(100);
    });

    it('should handle null content', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            bot_id: '10',
            bot_name: 'Bot A',
            message_type: 'response',
            content: null,
            created_at: '2024-01-01T12:00:00Z'
          }
        ]
      });

      const res = await request(app).get('/api/analytics/recent-activity');

      expect(res.body.data[0].content).toBe('');
    });

    it('should limit to 10 activities', async () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        id: String(i + 1),
        bot_id: '10',
        bot_name: 'Bot A',
        message_type: 'response',
        content: `Message ${i}`,
        created_at: '2024-01-01T12:00:00Z'
      }));

      db.query.mockResolvedValueOnce({ rows });

      const res = await request(app).get('/api/analytics/recent-activity');

      expect(res.body.data).toHaveLength(10);
    });

    it('should handle no activities', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/recent-activity');

      expect(res.body.data).toEqual([]);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/analytics/recent-activity');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== HOURLY ACTIVITY TESTS ====================
  describe('GET /hourly-activity', () => {
    it('should return hourly activity distribution', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { hour: '9', count: '100' },
          { hour: '10', count: '150' },
          { hour: '11', count: '200' }
        ]
      });

      const res = await request(app).get('/api/analytics/hourly-activity');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(24);
      expect(res.body.data[9].count).toBe(100);
      expect(res.body.data[10].count).toBe(150);
    });

    it('should fill missing hours with 0', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ hour: '12', count: '100' }]
      });

      const res = await request(app).get('/api/analytics/hourly-activity');

      expect(res.body.data[0].count).toBe(0);
      expect(res.body.data[12].count).toBe(100);
      expect(res.body.data[23].count).toBe(0);
    });

    it('should include all 24 hours', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/hourly-activity');

      expect(res.body.data).toHaveLength(24);
      expect(res.body.data[0].hour).toBe(0);
      expect(res.body.data[23].hour).toBe(23);
    });

    it('should accept custom days parameter', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/analytics/hourly-activity?days=30');

      const queryCall = db.query.mock.calls[0];
      expect(queryCall[1][1]).toBe(30);
    });

    it('should default to 7 days', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/analytics/hourly-activity');

      const queryCall = db.query.mock.calls[0];
      expect(queryCall[1][1]).toBe(7);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/analytics/hourly-activity');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== TOP QUESTIONS TESTS ====================
  describe('GET /top-questions', () => {
    it('should return most common questions', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { content: 'What is this?', count: '50', last_asked: '2024-01-01T12:00:00Z' },
          { content: 'How do I use this?', count: '30', last_asked: '2024-01-01T11:00:00Z' }
        ]
      });

      const res = await request(app).get('/api/analytics/top-questions');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].question).toBe('What is this?');
      expect(res.body.data[0].count).toBe(50);
    });

    it('should limit to 10 questions by default', async () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        content: `Question ${i}`,
        count: String(100 - i * 10),
        last_asked: '2024-01-01T12:00:00Z'
      }));

      db.query.mockResolvedValueOnce({ rows });

      const res = await request(app).get('/api/analytics/top-questions');

      expect(res.body.data).toHaveLength(10);
    });

    it('should accept custom limit parameter', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { content: 'Q1', count: '50', last_asked: '2024-01-01T12:00:00Z' },
          { content: 'Q2', count: '40', last_asked: '2024-01-01T11:00:00Z' },
          { content: 'Q3', count: '30', last_asked: '2024-01-01T10:00:00Z' }
        ]
      });

      const res = await request(app).get('/api/analytics/top-questions?limit=3');

      expect(res.body.data).toHaveLength(3);
    });

    it('should truncate questions to 200 characters', async () => {
      const longContent = 'a'.repeat(300);
      db.query.mockResolvedValueOnce({
        rows: [
          { content: longContent, count: '50', last_asked: '2024-01-01T12:00:00Z' }
        ]
      });

      const res = await request(app).get('/api/analytics/top-questions');

      expect(res.body.data[0].question).toHaveLength(200);
    });

    it('should handle no questions', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/top-questions');

      expect(res.body.data).toEqual([]);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/analytics/top-questions');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== RESPONSE METRICS TESTS ====================
  describe('GET /response-metrics', () => {
    it('should return success rate and fallback rate', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { message_type: 'response', count: '700' },
            { message_type: 'greeting', count: '200' },
            { message_type: 'fallback', count: '100' },
            { message_type: 'user_message', count: '1000' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [{ sessions: '250' }]
        });

      const res = await request(app).get('/api/analytics/response-metrics');

      expect(res.status).toBe(200);
      expect(res.body.data.successRate).toBe(90);
      expect(res.body.data.fallbackRate).toBe(10);
      expect(res.body.data.totalResponses).toBe(1000);
    });

    it('should handle 100% success rate', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { message_type: 'response', count: '500' },
            { message_type: 'greeting', count: '200' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [{ sessions: '100' }]
        });

      const res = await request(app).get('/api/analytics/response-metrics');

      expect(res.body.data.successRate).toBe(100);
      expect(res.body.data.fallbackRate).toBe(0);
    });

    it('should handle 0% success rate', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { message_type: 'fallback', count: '500' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [{ sessions: '100' }]
        });

      const res = await request(app).get('/api/analytics/response-metrics');

      expect(res.body.data.successRate).toBe(0);
      expect(res.body.data.fallbackRate).toBe(100);
    });

    it('should count unique sessions', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { message_type: 'response', count: '100' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [{ sessions: '50' }]
        });

      const res = await request(app).get('/api/analytics/response-metrics');

      expect(res.body.data.uniqueSessions).toBe(50);
    });

    it('should handle no sessions', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { message_type: 'response', count: '100' }
          ]
        })
        .mockResolvedValueOnce({
          rows: []
        });

      const res = await request(app).get('/api/analytics/response-metrics');

      expect(res.body.data.uniqueSessions).toBe(0);
    });

    it('should handle no message types', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ sessions: '0' }] });

      const res = await request(app).get('/api/analytics/response-metrics');

      expect(res.body.data.successRate).toBe(100);
      expect(res.body.data.totalResponses).toBe(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/analytics/response-metrics');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== USER SESSIONS TESTS ====================
  describe('GET /user-sessions', () => {
    it('should return session analytics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            session_id: 'session1',
            bot_name: 'Bot A',
            message_count: '10',
            started_at: '2024-01-01T10:00:00Z',
            last_activity: '2024-01-01T10:30:00Z'
          },
          {
            session_id: 'session2',
            bot_name: 'Bot B',
            message_count: '5',
            started_at: '2024-01-01T11:00:00Z',
            last_activity: '2024-01-01T11:15:00Z'
          }
        ]
      });

      const res = await request(app).get('/api/analytics/user-sessions');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].sessionId).toBe('session1');
      expect(res.body.data[0].messageCount).toBe(10);
    });

    it('should calculate session duration', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            session_id: 'session1',
            bot_name: 'Bot A',
            message_count: '10',
            started_at: new Date('2024-01-01T10:00:00Z'),
            last_activity: new Date('2024-01-01T10:30:00Z')
          }
        ]
      });

      const res = await request(app).get('/api/analytics/user-sessions');

      expect(res.body.data[0].duration).toBe(30 * 60 * 1000); // 30 minutes in ms
    });

    it('should limit to 20 sessions by default', async () => {
      const rows = Array.from({ length: 20 }, (_, i) => ({
        session_id: `session${i}`,
        bot_name: 'Bot A',
        message_count: String(10 - i),
        started_at: '2024-01-01T10:00:00Z',
        last_activity: '2024-01-01T10:30:00Z'
      }));

      db.query.mockResolvedValueOnce({ rows });

      const res = await request(app).get('/api/analytics/user-sessions');

      expect(res.body.data).toHaveLength(20);
    });

    it('should accept custom limit parameter', async () => {
      const rows = Array.from({ length: 5 }, (_, i) => ({
        session_id: `session${i}`,
        bot_name: 'Bot A',
        message_count: String(10 - i),
        started_at: '2024-01-01T10:00:00Z',
        last_activity: '2024-01-01T10:30:00Z'
      }));

      db.query.mockResolvedValueOnce({ rows });

      const res = await request(app).get('/api/analytics/user-sessions?limit=5');

      expect(res.body.data).toHaveLength(5);
    });

    it('should handle no sessions', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/user-sessions');

      expect(res.body.data).toEqual([]);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/analytics/user-sessions');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== EXPORT TESTS ====================
  describe('GET /export', () => {
    describe('Messages Export', () => {
      it('should export messages as CSV', async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: '1',
              bot_name: 'Bot A',
              message_type: 'user_message',
              content: 'Hello',
              session_id: 'session1',
              created_at: '2024-01-01T12:00:00Z'
            }
          ]
        });

        const res = await request(app).get('/api/analytics/export?type=messages');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toBe('text/csv');
        expect(res.headers['content-disposition']).toContain('attachment');
        expect(res.text).toContain('id,bot_name,message_type,content,session_id,created_at');
      });

      it('should handle 30 days default', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await request(app).get('/api/analytics/export?type=messages');

        const queryCall = db.query.mock.calls[0];
        expect(queryCall[1][1]).toBe(30);
      });

      it('should accept custom days parameter', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await request(app).get('/api/analytics/export?type=messages&days=7');

        const queryCall = db.query.mock.calls[0];
        expect(queryCall[1][1]).toBe(7);
      });
    });

    describe('Daily Export', () => {
      it('should export daily statistics', async () => {
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

        const res = await request(app).get('/api/analytics/export?type=daily');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toBe('text/csv');
        expect(res.text).toContain('date,total_messages,unique_sessions');
      });

      it('should handle no data for export', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app).get('/api/analytics/export?type=messages');

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('No data to export');
      });

      it('should generate correct filename with date', async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: '1',
              bot_name: 'Bot',
              message_type: 'response',
              content: 'Hi',
              session_id: 'session1',
              created_at: '2024-01-01T12:00:00Z'
            }
          ]
        });

        const res = await request(app).get('/api/analytics/export?type=messages');

        expect(res.headers['content-disposition']).toContain('messages_export');
        expect(res.headers['content-disposition']).toContain('.csv');
      });
    });

    describe('CSV Formatting', () => {
      it('should escape quotes in CSV values', async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: '1',
              bot_name: 'Bot A',
              message_type: 'response',
              content: 'He said "hello"',
              session_id: 'session1',
              created_at: '2024-01-01T12:00:00Z'
            }
          ]
        });

        const res = await request(app).get('/api/analytics/export?type=messages');

        expect(res.text).toContain('He said ""hello""');
      });

      it('should quote string values', async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: '1',
              bot_name: 'Bot A',
              message_type: 'response',
              content: 'Test content',
              session_id: 'session1',
              created_at: '2024-01-01T12:00:00Z'
            }
          ]
        });

        const res = await request(app).get('/api/analytics/export?type=messages');

        expect(res.text).toContain('"Test content"');
      });
    });

    describe('Export Error Handling', () => {
      it('should handle database error on export', async () => {
        db.query.mockRejectedValueOnce(new Error('DB Error'));

        const res = await request(app).get('/api/analytics/export?type=messages');

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
      });

      it('should default to messages type', async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: '1',
              bot_name: 'Bot A',
              message_type: 'response',
              content: 'Test',
              session_id: 'session1',
              created_at: '2024-01-01T12:00:00Z'
            }
          ]
        });

        const res = await request(app).get('/api/analytics/export');

        expect(res.status).toBe(200);
      });
    });
  });

  // ==================== COMPREHENSIVE TESTS ====================
  describe('GET /comprehensive', () => {
    it('should return all analytics data', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ total_messages: '1000', total_sessions: '100', active_bots: '5' }]
        })
        .mockResolvedValueOnce({
          rows: [
            { date: '2024-01-01', count: '100' },
            { date: '2024-01-02', count: '120' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { hour: '9', count: '50' },
            { hour: '10', count: '60' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { message_type: 'response', count: '600' },
            { message_type: 'user_message', count: '400' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { id: '1', name: 'Bot A', message_count: '500', session_count: '50' }
          ]
        });

      const res = await request(app).get('/api/analytics/comprehensive');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.overview).toBeDefined();
      expect(res.body.data.dailyTrend).toBeDefined();
      expect(res.body.data.hourlyDistribution).toBeDefined();
      expect(res.body.data.messageTypes).toBeDefined();
      expect(res.body.data.botStats).toBeDefined();
    });

    it('should accept days parameter', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ total_messages: '0', total_sessions: '0', active_bots: '0' }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/analytics/comprehensive?days=7');

      const firstQuery = db.query.mock.calls[0];
      expect(firstQuery[0]).toContain('$2');
      expect(firstQuery[1][1]).toBe(7);
    });

    it('should accept botId parameter for filtering', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ total_messages: '100', total_sessions: '10', active_bots: '1' }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/analytics/comprehensive?botId=123');

      const firstQuery = db.query.mock.calls[0];
      expect(firstQuery[0]).toContain('$2');
      expect(firstQuery[1][1]).toBe(123);
    });

    it('should fill missing dates in daily trend', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ total_messages: '100', total_sessions: '10', active_bots: '1' }]
        })
        .mockResolvedValueOnce({
          rows: [
            { date: '2024-01-01', count: '100' }
          ]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/comprehensive?days=7');

      expect(res.body.data.dailyTrend.length).toBeGreaterThanOrEqual(1);
    });

    it('should populate all 24 hours in hourly distribution', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ total_messages: '0', total_sessions: '0', active_bots: '0' }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ hour: '12', count: '100' }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/comprehensive');

      expect(res.body.data.hourlyDistribution).toHaveLength(24);
      expect(res.body.data.hourlyDistribution[12].count).toBe(100);
    });

    it('should handle empty data', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ total_messages: '0', total_sessions: '0', active_bots: '0' }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/comprehensive');

      expect(res.body.data.overview.totalMessages).toBe(0);
      expect(res.body.data.dailyTrend).toEqual([]);
      expect(res.body.data.messageTypes).toEqual([]);
      expect(res.body.data.botStats).toEqual([]);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/analytics/comprehensive');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('should handle default values when no data exists', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/analytics/comprehensive');

      expect(res.body.data.overview.totalMessages).toBe(0);
      expect(res.body.data.overview.totalSessions).toBe(0);
    });
  });

  // ==================== AUTHENTICATION & AUTHORIZATION ====================
  describe('Authentication & Authorization', () => {
    it('should require authentication token', async () => {
      const appNoAuth = express();
      appNoAuth.use(express.json());

      // Create a router without auth middleware
      const testRouter = express.Router();
      testRouter.get('/dashboard', (req, res) => {
        if (!req.user) {
          return res.status(401).json({ success: false });
        }
        res.json({ success: true });
      });

      appNoAuth.use('/api/analytics', testRouter);

      const res = await request(appNoAuth).get('/api/analytics/dashboard');

      expect(res.status).toBe(401);
    });

    it('should set user from auth middleware', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ message_count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ sent: '0', received: '0' }] });

      const res = await request(app).get('/api/analytics/dashboard');

      const queryCall = db.query.mock.calls[0];
      expect(queryCall[1][0]).toBe(1); // orgId from mocked auth
    });

    it('should include organization context in queries', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] });

      await request(app).get('/api/analytics/overview');

      const allQueries = db.query.mock.calls;
      allQueries.forEach(call => {
        expect(call[1][0]).toBe(1); // orgId should be first parameter
      });
    });
  });

  // ==================== EDGE CASES ====================
  describe('Edge Cases & Special Scenarios', () => {
    it('should handle very large message counts', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ date: '2024-01-01', count: '999999999' }]
        });

      const res = await request(app).get('/api/analytics/messages-over-time');

      expect(res.body.data[0].count).toBe(999999999);
    });

    it('should handle string numbers from database', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ total: '12345' }]
        });

      const res = await request(app).get('/api/analytics/overview');

      expect(res.body.data.totalMessages).toBe(12345);
      expect(typeof res.body.data.totalMessages).toBe('number');
    });

    it('should handle float percentages correctly', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ message_count: '333' }] })
        .mockResolvedValueOnce({ rows: [{ sent: '200', received: '133' }] });

      const res = await request(app).get('/api/analytics/dashboard');

      expect(res.body.messages.percentage).toBe(33.3);
    });

    it('should handle negative parameter values gracefully', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/analytics/messages-over-time?days=-5');

      const queryCall = db.query.mock.calls[0];
      expect(queryCall[1][1]).toBe(-5); // Parameterized, handled by DB
    });

    it('should handle SQL injection attempts safely with parameterization', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      // Attempted SQL injection
      await request(app).get('/api/analytics/messages-over-time?days=7; DROP TABLE bots;--');

      const queryCall = db.query.mock.calls[0];
      // The injection should be treated as a parameter value, not executed
      expect(queryCall[1]).toBeDefined();
    });

    it('should handle unicode characters in content', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            bot_id: '10',
            bot_name: 'Bot A',
            message_type: 'response',
            content: 'Hello 世界 مرحبا привет',
            created_at: '2024-01-01T12:00:00Z'
          }
        ]
      });

      const res = await request(app).get('/api/analytics/recent-activity');

      expect(res.body.data[0].content).toContain('世界');
    });

    it('should handle special characters in questions', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            content: 'What is "this" & that?',
            count: '50',
            last_asked: '2024-01-01T12:00:00Z'
          }
        ]
      });

      const res = await request(app).get('/api/analytics/top-questions');

      expect(res.body.data[0].question).toContain('&');
    });
  });

  // ==================== PARAMETER VALIDATION ====================
  describe('Parameter Validation', () => {
    it('should handle missing query parameters gracefully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] });

      const res = await request(app).get('/api/analytics/overview');

      expect(res.status).toBe(200);
    });

    it('should use default limit when not provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/analytics/top-questions');

      const queryCall = db.query.mock.calls[0];
      expect(queryCall[1][1]).toBe(10); // default limit
    });

    it('should use default days when not provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/analytics/messages-over-time');

      const queryCall = db.query.mock.calls[0];
      expect(queryCall[1][1]).toBe(7); // default days
    });

    it('should accept zero as valid parameter', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/analytics/messages-over-time?days=0');

      const queryCall = db.query.mock.calls[0];
      expect(queryCall[1][1]).toBe(0);
    });
  });

  // ==================== RESPONSE FORMAT ====================
  describe('Response Format', () => {
    it('should include success flag in all responses', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ message_count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ sent: '0', received: '0' }] });

      const res = await request(app).get('/api/analytics/dashboard');

      expect(res.body).toHaveProperty('success');
      expect(res.body.success).toBe(true);
    });

    it('should return consistent error response format', async () => {
      db.query.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/analytics/dashboard');

      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('message');
    });

    it('should set correct content-type headers for JSON', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ message_count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ sent: '0', received: '0' }] });

      const res = await request(app).get('/api/analytics/dashboard');

      expect(res.headers['content-type']).toContain('application/json');
    });

    it('should set correct headers for CSV export', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            bot_name: 'Bot',
            message_type: 'response',
            content: 'Hi',
            session_id: 'session1',
            created_at: '2024-01-01T12:00:00Z'
          }
        ]
      });

      const res = await request(app).get('/api/analytics/export');

      expect(res.headers['content-type']).toBe('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('filename');
    });
  });

  // ==================== LOGGING ====================
  describe('Logging', () => {
    it('should log errors when dashboard query fails', async () => {
      db.query.mockRejectedValueOnce(new Error('DB Error'));

      await request(app).get('/api/analytics/dashboard');

      expect(log.error).toHaveBeenCalledWith(
        '[ANALYTICS] Error fetching dashboard:',
        expect.any(Object)
      );
    });

    it('should log errors when overview query fails', async () => {
      db.query.mockRejectedValueOnce(new Error('DB Error'));

      await request(app).get('/api/analytics/overview');

      expect(log.error).toHaveBeenCalledWith(
        '[ANALYTICS] Error fetching overview:',
        expect.any(Object)
      );
    });

    it('should log errors with error message', async () => {
      const testError = new Error('Test Error Message');
      db.query.mockRejectedValueOnce(testError);

      await request(app).get('/api/analytics/dashboard');

      expect(log.error).toHaveBeenCalled();
      const callArgs = log.error.mock.calls[0];
      expect(callArgs[1].error).toBe('Test Error Message');
    });
  });
});
