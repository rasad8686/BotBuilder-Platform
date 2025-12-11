/**
 * Admin Routes Tests
 * Tests for server/routes/admin.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'admin@example.com', current_organization_id: 1 };
  next();
}));

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: jest.fn((req, res, next) => {
    req.organization = { id: 1, name: 'Test Org' };
    next();
  }),
  requireOrganization: jest.fn((req, res, next) => next())
}));

jest.mock('../../middleware/checkPermission', () => ({
  checkPermission: jest.fn(() => (req, res, next) => next())
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
const adminRouter = require('../../routes/admin');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);

describe('Admin Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/audit-logs', () => {
    it('should return audit logs with pagination', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '50' }] }) // Count query
        .mockResolvedValueOnce({ rows: [
          { id: 1, action: 'user_login', user_name: 'Test User' },
          { id: 2, action: 'bot_created', user_name: 'Test User' }
        ] });

      const response = await request(app).get('/api/admin/audit-logs');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter by user_id', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/admin/audit-logs?user_id=1');

      expect(response.status).toBe(200);
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should filter by action', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/admin/audit-logs?action=user_login');

      expect(response.status).toBe(200);
    });

    it('should filter by date range', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/admin/audit-logs?start_date=2024-01-01&end_date=2024-12-31');

      expect(response.status).toBe(200);
    });

    it('should handle pagination parameters', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/admin/audit-logs?page=2&limit=25');

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(25);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/admin/audit-logs');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/audit-logs/actions', () => {
    it('should return unique actions', async () => {
      db.query.mockResolvedValueOnce({ rows: [
        { action: 'user_login' },
        { action: 'bot_created' },
        { action: 'flow_updated' }
      ] });

      const response = await request(app).get('/api/admin/audit-logs/actions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.actions).toHaveLength(3);
      expect(response.body.actions).toContain('user_login');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/admin/audit-logs/actions');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/admin/stats', () => {
    it('should return organization statistics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // Members
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // Bots
        .mockResolvedValueOnce({ rows: [{ count: '8' }] }) // Active bots
        .mockResolvedValueOnce({ rows: [{ count: '1000' }] }) // Messages
        .mockResolvedValueOnce({ rows: [{ count: '50' }] }) // Audit events
        .mockResolvedValueOnce({ rows: [
          { action: 'user_login', count: 20 },
          { action: 'bot_created', count: 5 }
        ] }) // Recent activity
        .mockResolvedValueOnce({ rows: [
          { id: 1, name: 'User 1', email: 'user1@example.com', action_count: 100 }
        ] }) // Top users
        .mockResolvedValueOnce({ rows: [
          { plan_tier: 'pro', created_at: '2024-01-01' }
        ] }); // Organization info

      const response = await request(app).get('/api/admin/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats.totalMembers).toBe(5);
      expect(response.body.stats.totalBots).toBe(10);
      expect(response.body.stats.activeBots).toBe(8);
      expect(response.body.stats.planTier).toBe('pro');
    });

    it('should handle missing organization data', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/admin/stats');

      expect(response.status).toBe(200);
      expect(response.body.stats.planTier).toBe('unknown');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/admin/stats');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/admin/health', () => {
    it('should return healthy status', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/admin/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.health.status).toBe('healthy');
      expect(response.body.health.database).toBe('connected');
    });

    it('should return unhealthy status when database fails', async () => {
      db.query.mockRejectedValueOnce(new Error('Connection failed'));

      const response = await request(app).get('/api/admin/health');

      expect(response.status).toBe(503);
      expect(response.body.health.status).toBe('unhealthy');
      expect(response.body.health.database).toBe('disconnected');
    });
  });

  describe('GET /api/admin/activity-timeline', () => {
    it('should return activity timeline', async () => {
      db.query.mockResolvedValueOnce({ rows: [
        { id: 1, action: 'user_login', user_name: 'User 1', created_at: '2024-01-01' },
        { id: 2, action: 'bot_created', user_name: 'User 2', created_at: '2024-01-02' }
      ] });

      const response = await request(app).get('/api/admin/activity-timeline');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.timeline).toHaveLength(2);
      expect(response.body.period).toBeDefined();
    });

    it('should accept days parameter', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/admin/activity-timeline?days=14');

      expect(response.status).toBe(200);
      expect(response.body.period.days).toBe(14);
    });

    it('should limit days to 30 max', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/admin/activity-timeline?days=100');

      expect(response.status).toBe(200);
      expect(response.body.period.days).toBe(30);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/admin/activity-timeline');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/admin/billing-stats', () => {
    it('should return billing statistics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [
          { plan_tier: 'free', count: 100 },
          { plan_tier: 'pro', count: 50 },
          { plan_tier: 'enterprise', count: 10 }
        ] }) // Plan counts
        .mockResolvedValueOnce({ rows: [{ count: 160 }] }) // Total users
        .mockResolvedValueOnce({ rows: [
          { date: '2024-01-01', count: 5 },
          { date: '2024-01-02', count: 3 }
        ] }); // Recent subscriptions

      const response = await request(app).get('/api/admin/billing-stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.mrr).toBe(50 * 29 + 10 * 99); // pro + enterprise
      expect(response.body.totalUsers).toBe(160);
      expect(response.body.planBreakdown).toHaveLength(3);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/admin/billing-stats');

      expect(response.status).toBe(500);
    });
  });
});
