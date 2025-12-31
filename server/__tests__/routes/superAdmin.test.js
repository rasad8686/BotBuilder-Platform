/**
 * SuperAdmin Routes Tests
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = { id: 1, email: 'superadmin@example.com', is_superadmin: true };
  next();
});

jest.mock('../../middleware/requireSuperAdmin', () => ({
  requireSuperAdmin: (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  },
  logAdminAction: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const { logAdminAction } = require('../../middleware/requireSuperAdmin');
const superAdminRouter = require('../../routes/superAdmin');

describe('SuperAdmin Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/superadmin', superAdminRouter);
  });

  describe('GET /api/superadmin/dashboard', () => {
    it('should return dashboard statistics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: 100 }] }) // users
        .mockResolvedValueOnce({ rows: [{ count: 50 }] }) // organizations
        .mockResolvedValueOnce({ rows: [{ count: 200 }] }) // bots
        .mockResolvedValueOnce({ rows: [{ count: 3 }] }) // superadmins
        .mockResolvedValueOnce({ rows: [{ count: 25 }] }) // recent users
        .mockResolvedValueOnce({ rows: [{ count: 150 }] }) // recent activity
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'free', count: 30 }] }) // plan distribution
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Org 1', bot_count: 10 }] }); // top orgs

      const res = await request(app).get('/api/superadmin/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalUsers).toBe(100);
      expect(res.body.data.totalOrganizations).toBe(50);
      expect(res.body.data.totalBots).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/superadmin/dashboard');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/superadmin/users', () => {
    it('should return paginated users', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'User 1', email: 'user1@test.com', org_count: 1 }
          ]
        })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const res = await request(app).get('/api/superadmin/users');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users).toHaveLength(1);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('should support search', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await request(app).get('/api/superadmin/users?search=test');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%test%'])
      );
    });

    it('should handle pagination', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 100 }] });

      const res = await request(app).get('/api/superadmin/users?page=2&limit=10');

      expect(res.body.data.pagination.page).toBe(2);
      expect(res.body.data.pagination.limit).toBe(10);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/superadmin/users');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/superadmin/users/:id', () => {
    it('should return user details', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'User 1', email: 'user1@test.com' }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Org 1', role: 'owner' }]
        });

      const res = await request(app).get('/api/superadmin/users/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.organizations).toBeDefined();
    });

    it('should return 404 if user not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app).get('/api/superadmin/users/999');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/superadmin/users/1');

      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/superadmin/users/:id/superadmin', () => {
    it('should grant superadmin status', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 2, email: 'user@test.com', is_superadmin: true }]
      });

      const res = await request(app)
        .put('/api/superadmin/users/2/superadmin')
        .send({ is_superadmin: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('granted');
      expect(logAdminAction).toHaveBeenCalledWith(
        1, 'superadmin@example.com', 'GRANT_SUPERADMIN',
        'user', '2', expect.any(Object), expect.any(Object)
      );
    });

    it('should revoke superadmin status', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 2, email: 'user@test.com', is_superadmin: false }]
      });

      const res = await request(app)
        .put('/api/superadmin/users/2/superadmin')
        .send({ is_superadmin: false });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('revoked');
    });

    it('should prevent removing own superadmin status', async () => {
      const res = await request(app)
        .put('/api/superadmin/users/1/superadmin')
        .send({ is_superadmin: false });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot remove your own');
    });

    it('should return 404 if user not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .put('/api/superadmin/users/999/superadmin')
        .send({ is_superadmin: true });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/superadmin/organizations', () => {
    it('should return paginated organizations', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'Org 1', slug: 'org-1', member_count: 5, bot_count: 3 }
          ]
        })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const res = await request(app).get('/api/superadmin/organizations');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.organizations).toHaveLength(1);
    });

    it('should support search', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await request(app).get('/api/superadmin/organizations?search=test');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%test%'])
      );
    });
  });

  describe('PUT /api/superadmin/organizations/:id/plan', () => {
    it('should update organization plan', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Org 1', plan_tier: 'pro' }]
      });

      const res = await request(app)
        .put('/api/superadmin/organizations/1/plan')
        .send({ plan_tier: 'pro' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(logAdminAction).toHaveBeenCalled();
    });

    it('should reject invalid plan tier', async () => {
      const res = await request(app)
        .put('/api/superadmin/organizations/1/plan')
        .send({ plan_tier: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid plan tier');
    });

    it('should return 404 if organization not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .put('/api/superadmin/organizations/999/plan')
        .send({ plan_tier: 'free' });

      expect(res.status).toBe(404);
    });

    it('should accept valid plan tiers', async () => {
      const validTiers = ['free', 'starter', 'pro', 'enterprise'];

      for (const tier of validTiers) {
        db.query.mockResolvedValue({
          rows: [{ id: 1, name: 'Org', plan_tier: tier }]
        });

        const res = await request(app)
          .put('/api/superadmin/organizations/1/plan')
          .send({ plan_tier: tier });

        expect(res.status).toBe(200);
      }
    });
  });

  describe('GET /api/superadmin/audit-logs', () => {
    it('should return audit logs', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, action: 'GRANT_SUPERADMIN', user_name: 'Admin' }]
        })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const res = await request(app).get('/api/superadmin/audit-logs');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.logs).toHaveLength(1);
    });

    it('should filter by action', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await request(app).get('/api/superadmin/audit-logs?action=GRANT_SUPERADMIN');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('action'),
        expect.arrayContaining(['GRANT_SUPERADMIN'])
      );
    });

    it('should filter by userId', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await request(app).get('/api/superadmin/audit-logs?userId=1');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id'),
        expect.arrayContaining(['1'])
      );
    });
  });

  describe('GET /api/superadmin/ip-whitelist', () => {
    it('should return IP whitelist', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, ip_address: '192.168.1.1', description: 'Office', is_active: true }
        ]
      });

      const res = await request(app).get('/api/superadmin/ip-whitelist');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/superadmin/ip-whitelist');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/superadmin/ip-whitelist', () => {
    it('should add IP to whitelist', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, ip_address: '192.168.1.1', description: 'Office' }]
      });

      const res = await request(app)
        .post('/api/superadmin/ip-whitelist')
        .send({ ip_address: '192.168.1.1', description: 'Office' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(logAdminAction).toHaveBeenCalled();
    });

    it('should require IP address', async () => {
      const res = await request(app)
        .post('/api/superadmin/ip-whitelist')
        .send({ description: 'No IP' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('IP address is required');
    });

    it('should allow empty description', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, ip_address: '192.168.1.1', description: '' }]
      });

      const res = await request(app)
        .post('/api/superadmin/ip-whitelist')
        .send({ ip_address: '192.168.1.1' });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/superadmin/ip-whitelist/:id', () => {
    it('should remove IP from whitelist', async () => {
      db.query.mockResolvedValue({
        rows: [{ ip_address: '192.168.1.1' }]
      });

      const res = await request(app).delete('/api/superadmin/ip-whitelist/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(logAdminAction).toHaveBeenCalled();
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app).delete('/api/superadmin/ip-whitelist/999');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/superadmin/login-attempts', () => {
    it('should return login attempts', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { id: 1, email: 'user@test.com', ip_address: '192.168.1.1', success: false }
          ]
        })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const res = await request(app).get('/api/superadmin/login-attempts');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.attempts).toHaveLength(1);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('should support pagination', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 100 }] });

      const res = await request(app).get('/api/superadmin/login-attempts?page=2&limit=25');

      expect(res.body.data.pagination.page).toBe(2);
      expect(res.body.data.pagination.limit).toBe(25);
    });
  });

  describe('GET /api/superadmin/me', () => {
    it('should return current superadmin info', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Super Admin', email: 'superadmin@example.com', is_superadmin: true }]
      });

      const res = await request(app).get('/api/superadmin/me');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('superadmin@example.com');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/superadmin/me');

      expect(res.status).toBe(500);
    });
  });
});
