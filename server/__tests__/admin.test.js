/**
 * Admin API Tests - Real Route Coverage
 * Tests for /api/admin endpoints: audit logs, stats, health check
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
      email: 'admin@example.com',
      username: 'admin',
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
    req.hasRole = function(requiredRole) {
      const roleHierarchy = { viewer: 1, member: 2, admin: 3 };
      const userRoleLevel = roleHierarchy[req.organization.role] || 0;
      const requiredRoleLevel = roleHierarchy[requiredRole] || 999;
      return userRoleLevel >= requiredRoleLevel;
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

// Mock checkPermission middleware
jest.mock('../middleware/checkPermission', () => ({
  checkPermission: jest.fn((requiredRole) => {
    return (req, res, next) => {
      if (!req.organization || !req.organization.role) {
        return res.status(403).json({
          success: false,
          message: 'Organization context required'
        });
      }
      const roleHierarchy = { viewer: 1, member: 2, admin: 3 };
      const userRoleLevel = roleHierarchy[req.organization.role] || 0;
      const requiredRoleLevel = roleHierarchy[requiredRole] || 999;
      if (userRoleLevel < requiredRoleLevel) {
        return res.status(403).json({
          success: false,
          message: `Insufficient permissions. Required role: ${requiredRole}`
        });
      }
      next();
    };
  })
}));

// ========================================
// NOW import the actual routes
// ========================================
const db = require('../db');
const adminRouter = require('../routes/admin');

// Create test app with REAL routes
const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);

// ========================================
// TEST SUITES
// ========================================

describe('Admin API - Real Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // GET /api/admin/audit-logs
  // ========================================
  describe('GET /api/admin/audit-logs', () => {
    it('should return audit logs with pagination', async () => {
      const mockLogs = [
        { id: 1, action: 'login', resource_type: 'user', user_name: 'Test User' },
        { id: 2, action: 'create_bot', resource_type: 'bot', user_name: 'Test User' }
      ];
      db.query.mockResolvedValueOnce({ rows: [{ count: '2' }] }); // count query
      db.query.mockResolvedValueOnce({ rows: mockLogs }); // data query

      const res = await request(app).get('/api/admin/audit-logs');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
    });

    it('should filter by user_id', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, action: 'login' }] });

      const res = await request(app).get('/api/admin/audit-logs?user_id=1');

      expect(res.status).toBe(200);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id'),
        expect.arrayContaining(['1'])
      );
    });

    it('should filter by action', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/audit-logs?action=login');

      expect(res.status).toBe(200);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('action'),
        expect.arrayContaining(['login'])
      );
    });

    it('should filter by resource_type', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '3' }] });
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/audit-logs?resource_type=bot');

      expect(res.status).toBe(200);
    });

    it('should filter by date range', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '10' }] });
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/audit-logs?start_date=2024-01-01&end_date=2024-12-31');

      expect(res.status).toBe(200);
    });

    it('should paginate results', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '100' }] });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await request(app).get('/api/admin/audit-logs?page=2&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(2);
      expect(res.body.pagination.limit).toBe(10);
    });

    it('should enforce maximum limit of 100', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '200' }] });
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/audit-logs?limit=500');

      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBeLessThanOrEqual(100);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/admin/audit-logs');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('should filter by organization_id query param', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/audit-logs?organization_id=2');

      expect(res.status).toBe(200);
    });

    it('should return empty array when no logs', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/audit-logs');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.pagination.total).toBe(0);
    });

    it('should handle invalid page numbers (defaults to 1)', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '10' }] });
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/audit-logs?page=-1');

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(1);
    });

    it('should handle invalid limit values (defaults to 1)', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '10' }] });
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/audit-logs?limit=-1');

      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBeGreaterThan(0);
    });

    it('should handle multiple filters combined', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await request(app).get(
        '/api/admin/audit-logs?user_id=1&action=login&resource_type=user&start_date=2024-01-01&end_date=2024-12-31'
      );

      expect(res.status).toBe(200);
    });
  });

  // ========================================
  // GET /api/admin/audit-logs/actions
  // ========================================
  describe('GET /api/admin/audit-logs/actions', () => {
    it('should return unique actions', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ action: 'login' }, { action: 'create_bot' }, { action: 'delete_bot' }]
      });

      const res = await request(app).get('/api/admin/audit-logs/actions');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.actions).toContain('login');
      expect(res.body.actions).toContain('create_bot');
    });

    it('should filter by organization_id', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ action: 'login' }] });

      const res = await request(app).get('/api/admin/audit-logs/actions?organization_id=2');

      expect(res.status).toBe(200);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/admin/audit-logs/actions');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('should return empty array when no actions', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/audit-logs/actions');

      expect(res.status).toBe(200);
      expect(res.body.actions).toHaveLength(0);
    });
  });

  // ========================================
  // GET /api/admin/stats
  // ========================================
  describe('GET /api/admin/stats', () => {
    it('should return organization statistics', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '5' }] }); // members
      db.query.mockResolvedValueOnce({ rows: [{ count: '10' }] }); // total bots
      db.query.mockResolvedValueOnce({ rows: [{ count: '8' }] }); // active bots
      db.query.mockResolvedValueOnce({ rows: [{ count: '1000' }] }); // messages
      db.query.mockResolvedValueOnce({ rows: [{ count: '50' }] }); // audit events
      db.query.mockResolvedValueOnce({ rows: [{ action: 'login', count: '20' }] }); // recent activity
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'User', action_count: '10' }] }); // top users
      db.query.mockResolvedValueOnce({ rows: [{ plan_tier: 'pro', created_at: '2024-01-01' }] }); // org info

      const res = await request(app).get('/api/admin/stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toBeDefined();
      expect(res.body.stats.totalMembers).toBe(5);
      expect(res.body.stats.totalBots).toBe(10);
      expect(res.body.stats.activeBots).toBe(8);
    });

    it('should handle missing organization info', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '10' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '8' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '1000' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '50' }] });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [] }); // no org info

      const res = await request(app).get('/api/admin/stats');

      expect(res.status).toBe(200);
      expect(res.body.stats.planTier).toBe('unknown');
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/admin/stats');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('should handle zero stats', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [{ plan_tier: 'free', created_at: '2024-01-01' }] });

      const res = await request(app).get('/api/admin/stats');

      expect(res.status).toBe(200);
      expect(res.body.stats.totalMembers).toBe(0);
    });

    it('should handle large numbers', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '1000000' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '500000' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '400000' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '10000000' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '5000000' }] });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise', created_at: '2024-01-01' }] });

      const res = await request(app).get('/api/admin/stats');

      expect(res.status).toBe(200);
      expect(res.body.stats.totalMembers).toBe(1000000);
    });
  });

  // ========================================
  // GET /api/admin/health
  // ========================================
  describe('GET /api/admin/health', () => {
    it('should return healthy status', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      const res = await request(app).get('/api/admin/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.health.status).toBe('healthy');
      expect(res.body.health.database).toBe('connected');
    });

    it('should return unhealthy status when database fails', async () => {
      db.query.mockRejectedValueOnce(new Error('Connection refused'));

      const res = await request(app).get('/api/admin/health');

      expect(res.status).toBe(503);
      expect(res.body.health.status).toBe('unhealthy');
      expect(res.body.health.database).toBe('disconnected');
    });

    it('should include uptime and memory info', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      const res = await request(app).get('/api/admin/health');

      expect(res.status).toBe(200);
      expect(res.body.health.uptime).toBeDefined();
      expect(res.body.health.memory).toBeDefined();
    });

    it('should include timestamp', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      const res = await request(app).get('/api/admin/health');

      expect(res.status).toBe(200);
      expect(res.body.health.timestamp).toBeDefined();
    });
  });

  // ========================================
  // GET /api/admin/activity-timeline
  // ========================================
  describe('GET /api/admin/activity-timeline', () => {
    it('should return activity timeline', async () => {
      const mockTimeline = [
        { id: 1, action: 'login', user_name: 'User 1', created_at: '2024-01-01' },
        { id: 2, action: 'create_bot', user_name: 'User 2', created_at: '2024-01-02' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockTimeline });

      const res = await request(app).get('/api/admin/activity-timeline');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.timeline).toHaveLength(2);
      expect(res.body.period).toBeDefined();
    });

    it('should respect days parameter', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/activity-timeline?days=14');

      expect(res.status).toBe(200);
      expect(res.body.period.days).toBe(14);
    });

    it('should enforce maximum days of 30', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/activity-timeline?days=100');

      expect(res.status).toBe(200);
      expect(res.body.period.days).toBeLessThanOrEqual(30);
    });

    it('should respect limit parameter', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/activity-timeline?limit=50');

      expect(res.status).toBe(200);
    });

    it('should enforce maximum limit of 500', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/activity-timeline?limit=1000');

      expect(res.status).toBe(200);
    });

    it('should filter by organization_id', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/activity-timeline?organization_id=2');

      expect(res.status).toBe(200);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/admin/activity-timeline');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('should return empty timeline when no activity', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/activity-timeline');

      expect(res.status).toBe(200);
      expect(res.body.timeline).toHaveLength(0);
    });

    it('should handle invalid days parameter (defaults to minimum)', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/activity-timeline?days=-5');

      expect(res.status).toBe(200);
      expect(res.body.period.days).toBeGreaterThanOrEqual(1);
    });
  });

  // ========================================
  // GET /api/admin/billing-stats
  // ========================================
  describe('GET /api/admin/billing-stats', () => {
    it('should return billing statistics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { plan_tier: 'free', count: 10 },
          { plan_tier: 'pro', count: 5 },
          { plan_tier: 'enterprise', count: 2 }
        ]
      });
      db.query.mockResolvedValueOnce({ rows: [{ count: 17 }] }); // total users
      db.query.mockResolvedValueOnce({
        rows: [
          { date: '2024-01-01', count: 2 },
          { date: '2024-01-02', count: 3 }
        ]
      }); // recent subs

      const res = await request(app).get('/api/admin/billing-stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.mrr).toBeDefined();
      expect(res.body.totalUsers).toBe(17);
      expect(res.body.planBreakdown).toBeDefined();
    });

    it('should calculate MRR correctly', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { plan_tier: 'free', count: 10 },
          { plan_tier: 'pro', count: 5 },
          { plan_tier: 'enterprise', count: 2 }
        ]
      });
      db.query.mockResolvedValueOnce({ rows: [{ count: 17 }] });
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/billing-stats');

      // MRR = 0*10 + 29*5 + 99*2 = 145 + 198 = 343
      expect(res.status).toBe(200);
      expect(res.body.mrr).toBe(343);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/admin/billing-stats');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('should handle no subscriptions', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [{ count: 0 }] });
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/billing-stats');

      expect(res.status).toBe(200);
      expect(res.body.mrr).toBe(0);
    });

    it('should return recent activity data', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ plan_tier: 'pro', count: 5 }]
      });
      db.query.mockResolvedValueOnce({ rows: [{ count: 5 }] });
      db.query.mockResolvedValueOnce({
        rows: [
          { date: '2024-01-01', count: 2 },
          { date: '2024-01-02', count: 3 }
        ]
      });

      const res = await request(app).get('/api/admin/billing-stats');

      expect(res.status).toBe(200);
      expect(res.body.recentActivity).toBeDefined();
      expect(res.body.recentActivity).toHaveLength(2);
    });
  });
});
