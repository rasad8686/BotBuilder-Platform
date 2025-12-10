/**
 * Organizations API Tests
 * Tests for /api/organizations endpoints: settings, members, roles
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
  req.user = { id: 1, email: 'test@example.com', name: 'Test User' };
  req.organization = { id: 1, name: 'Test Org' };
  next();
};

// Mock organization routes
app.get('/api/organizations', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.* FROM organizations o
       JOIN organization_members om ON o.id = om.organization_id
       WHERE om.user_id = $1`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/organizations/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.* FROM organizations o
       JOIN organization_members om ON o.id = om.organization_id
       WHERE o.id = $1 AND om.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/organizations', mockAuth, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Organization name is required' });
    }

    if (name.length > 100) {
      return res.status(400).json({ success: false, message: 'Name cannot exceed 100 characters' });
    }

    const result = await db.query(
      'INSERT INTO organizations (name, owner_id) VALUES ($1, $2) RETURNING *',
      [name, req.user.id]
    );

    // Add owner as admin member
    await db.query(
      'INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)',
      [result.rows[0].id, req.user.id, 'admin']
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/organizations/:id', mockAuth, async (req, res) => {
  try {
    const { name, logo_url } = req.body;

    // Check if user is admin
    const memberResult = await db.query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (memberResult.rows.length === 0 || memberResult.rows[0].role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admins can update organization' });
    }

    const result = await db.query(
      'UPDATE organizations SET name = COALESCE($1, name), logo_url = COALESCE($2, logo_url), updated_at = NOW() WHERE id = $3 RETURNING *',
      [name, logo_url, req.params.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/organizations/:id', mockAuth, async (req, res) => {
  try {
    // Check if user is owner
    const orgResult = await db.query(
      'SELECT owner_id FROM organizations WHERE id = $1',
      [req.params.id]
    );

    if (orgResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    if (orgResult.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only owner can delete organization' });
    }

    await db.query('DELETE FROM organizations WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Organization deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Organizations API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // LIST ORGANIZATIONS
  // ========================================
  describe('GET /api/organizations', () => {
    it('should return all organizations for user', async () => {
      const mockOrgs = [
        { id: 1, name: 'Org 1' },
        { id: 2, name: 'Org 2' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockOrgs });

      const res = await request(app).get('/api/organizations');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array if no organizations', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/organizations');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/organizations');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // GET SINGLE ORGANIZATION
  // ========================================
  describe('GET /api/organizations/:id', () => {
    it('should return organization by ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Org' }] });

      const res = await request(app).get('/api/organizations/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if organization not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/organizations/999');

      expect(res.status).toBe(404);
    });
  });

  // ========================================
  // CREATE ORGANIZATION
  // ========================================
  describe('POST /api/organizations', () => {
    it('should create a new organization', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'New Org' }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app)
        .post('/api/organizations')
        .send({ name: 'New Org' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(app)
        .post('/api/organizations')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('required');
    });

    it('should return 400 if name is too long', async () => {
      const res = await request(app)
        .post('/api/organizations')
        .send({ name: 'A'.repeat(101) });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('100 characters');
    });
  });

  // ========================================
  // UPDATE ORGANIZATION
  // ========================================
  describe('PUT /api/organizations/:id', () => {
    it('should update organization', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated Org' }] });

      const res = await request(app)
        .put('/api/organizations/1')
        .send({ name: 'Updated Org' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 403 if not admin', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ role: 'member' }] });

      const res = await request(app)
        .put('/api/organizations/1')
        .send({ name: 'Updated Org' });

      expect(res.status).toBe(403);
    });

    it('should return 403 if not member', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/organizations/1')
        .send({ name: 'Updated Org' });

      expect(res.status).toBe(403);
    });
  });

  // ========================================
  // DELETE ORGANIZATION
  // ========================================
  describe('DELETE /api/organizations/:id', () => {
    it('should delete organization', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ owner_id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).delete('/api/organizations/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if organization not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/organizations/999');

      expect(res.status).toBe(404);
    });

    it('should return 403 if not owner', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ owner_id: 2 }] });

      const res = await request(app).delete('/api/organizations/1');

      expect(res.status).toBe(403);
    });
  });
});

// ========================================
// ORGANIZATION MEMBERS TESTS
// ========================================
describe('Organization Members API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const memberApp = express();
  memberApp.use(express.json());

  const mockAuth = (req, res, next) => {
    req.user = { id: 1 };
    req.organization = { id: 1 };
    next();
  };

  memberApp.get('/api/organizations/:id/members', mockAuth, async (req, res) => {
    try {
      const result = await db.query(
        `SELECT u.id, u.name, u.email, om.role, om.created_at
         FROM organization_members om
         JOIN users u ON om.user_id = u.id
         WHERE om.organization_id = $1`,
        [req.params.id]
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  memberApp.post('/api/organizations/:id/members', mockAuth, async (req, res) => {
    try {
      const { email, role = 'member' } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
      }

      const validRoles = ['admin', 'member', 'viewer'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }

      // Check if user is admin
      const adminCheck = await db.query(
        'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
      );

      if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only admins can invite members' });
      }

      // Find user by email
      const userResult = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Check if already member
      const existingMember = await db.query(
        'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
        [req.params.id, userResult.rows[0].id]
      );

      if (existingMember.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'User is already a member' });
      }

      await db.query(
        'INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)',
        [req.params.id, userResult.rows[0].id, role]
      );

      res.status(201).json({ success: true, message: 'Member added successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  memberApp.put('/api/organizations/:id/members/:userId', mockAuth, async (req, res) => {
    try {
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ success: false, message: 'Role is required' });
      }

      const validRoles = ['admin', 'member', 'viewer'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }

      // Check if user is admin
      const adminCheck = await db.query(
        'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
      );

      if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only admins can change roles' });
      }

      // Can't change own role
      if (parseInt(req.params.userId) === req.user.id) {
        return res.status(400).json({ success: false, message: 'Cannot change your own role' });
      }

      const result = await db.query(
        'UPDATE organization_members SET role = $1 WHERE organization_id = $2 AND user_id = $3 RETURNING *',
        [role, req.params.id, req.params.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }

      res.json({ success: true, message: 'Role updated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  memberApp.delete('/api/organizations/:id/members/:userId', mockAuth, async (req, res) => {
    try {
      // Check if user is admin
      const adminCheck = await db.query(
        'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
      );

      if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only admins can remove members' });
      }

      // Can't remove owner
      const orgResult = await db.query('SELECT owner_id FROM organizations WHERE id = $1', [req.params.id]);
      if (parseInt(req.params.userId) === orgResult.rows[0].owner_id) {
        return res.status(400).json({ success: false, message: 'Cannot remove organization owner' });
      }

      const result = await db.query(
        'DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2 RETURNING *',
        [req.params.id, req.params.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }

      res.json({ success: true, message: 'Member removed successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('GET /api/organizations/:id/members', () => {
    it('should return all members', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'User 1', email: 'user1@example.com', role: 'admin' },
          { id: 2, name: 'User 2', email: 'user2@example.com', role: 'member' }
        ]
      });

      const res = await request(memberApp).get('/api/organizations/1/members');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/organizations/:id/members', () => {
    it('should add a new member', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] })
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(memberApp)
        .post('/api/organizations/1/members')
        .send({ email: 'newuser@example.com', role: 'member' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if email is missing', async () => {
      const res = await request(memberApp)
        .post('/api/organizations/1/members')
        .send({ role: 'member' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid role', async () => {
      const res = await request(memberApp)
        .post('/api/organizations/1/members')
        .send({ email: 'user@example.com', role: 'superadmin' });

      expect(res.status).toBe(400);
    });

    it('should return 403 if not admin', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ role: 'member' }] });

      const res = await request(memberApp)
        .post('/api/organizations/1/members')
        .send({ email: 'user@example.com' });

      expect(res.status).toBe(403);
    });

    it('should return 404 if user not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(memberApp)
        .post('/api/organizations/1/members')
        .send({ email: 'notfound@example.com' });

      expect(res.status).toBe(404);
    });

    it('should return 400 if already member', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] })
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await request(memberApp)
        .post('/api/organizations/1/members')
        .send({ email: 'existing@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already a member');
    });
  });

  describe('PUT /api/organizations/:id/members/:userId', () => {
    it('should update member role', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] })
        .mockResolvedValueOnce({ rows: [{ id: 2, role: 'admin' }] });

      const res = await request(memberApp)
        .put('/api/organizations/1/members/2')
        .send({ role: 'admin' });

      expect(res.status).toBe(200);
    });

    it('should return 400 when changing own role', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ role: 'admin' }] });

      const res = await request(memberApp)
        .put('/api/organizations/1/members/1')
        .send({ role: 'member' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('own role');
    });

    it('should return 403 if not admin', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ role: 'member' }] });

      const res = await request(memberApp)
        .put('/api/organizations/1/members/2')
        .send({ role: 'admin' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/organizations/:id/members/:userId', () => {
    it('should remove member', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] })
        .mockResolvedValueOnce({ rows: [{ owner_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 2 }] });

      const res = await request(memberApp).delete('/api/organizations/1/members/2');

      expect(res.status).toBe(200);
    });

    it('should return 400 when removing owner', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] })
        .mockResolvedValueOnce({ rows: [{ owner_id: 2 }] });

      const res = await request(memberApp).delete('/api/organizations/1/members/2');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('owner');
    });

    it('should return 403 if not admin', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ role: 'member' }] });

      const res = await request(memberApp).delete('/api/organizations/1/members/2');

      expect(res.status).toBe(403);
    });
  });
});

// ========================================
// ORGANIZATION SETTINGS TESTS
// ========================================
describe('Organization Settings API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const settingsApp = express();
  settingsApp.use(express.json());

  const mockAuth = (req, res, next) => {
    req.user = { id: 1 };
    req.organization = { id: 1 };
    next();
  };

  settingsApp.get('/api/organizations/:id/settings', mockAuth, async (req, res) => {
    try {
      const result = await db.query(
        'SELECT * FROM organization_settings WHERE organization_id = $1',
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          data: {
            default_language: 'en',
            timezone: 'UTC',
            billing_email: null,
            allow_member_invites: false
          }
        });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  settingsApp.put('/api/organizations/:id/settings', mockAuth, async (req, res) => {
    try {
      const { default_language, timezone, billing_email, allow_member_invites } = req.body;

      // Check if user is admin
      const adminCheck = await db.query(
        'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
      );

      if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only admins can update settings' });
      }

      const result = await db.query(
        `INSERT INTO organization_settings (organization_id, default_language, timezone, billing_email, allow_member_invites)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (organization_id) DO UPDATE SET
         default_language = COALESCE($2, organization_settings.default_language),
         timezone = COALESCE($3, organization_settings.timezone),
         billing_email = COALESCE($4, organization_settings.billing_email),
         allow_member_invites = COALESCE($5, organization_settings.allow_member_invites)
         RETURNING *`,
        [req.params.id, default_language, timezone, billing_email, allow_member_invites]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('GET /api/organizations/:id/settings', () => {
    it('should return organization settings', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ default_language: 'az', timezone: 'Asia/Baku' }]
      });

      const res = await request(settingsApp).get('/api/organizations/1/settings');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return default settings if none exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(settingsApp).get('/api/organizations/1/settings');

      expect(res.status).toBe(200);
      expect(res.body.data.default_language).toBe('en');
    });
  });

  describe('PUT /api/organizations/:id/settings', () => {
    it('should update settings', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] })
        .mockResolvedValueOnce({ rows: [{ default_language: 'az' }] });

      const res = await request(settingsApp)
        .put('/api/organizations/1/settings')
        .send({ default_language: 'az' });

      expect(res.status).toBe(200);
    });

    it('should return 403 if not admin', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ role: 'member' }] });

      const res = await request(settingsApp)
        .put('/api/organizations/1/settings')
        .send({ default_language: 'az' });

      expect(res.status).toBe(403);
    });
  });
});

// ========================================
// ORGANIZATION ROLES TESTS
// ========================================
describe('Organization Roles API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const rolesApp = express();
  rolesApp.use(express.json());

  const mockAuth = (req, res, next) => {
    req.user = { id: 1 };
    req.organization = { id: 1 };
    next();
  };

  rolesApp.get('/api/organizations/:id/roles', mockAuth, async (req, res) => {
    try {
      const result = await db.query(
        'SELECT * FROM organization_roles WHERE organization_id = $1',
        [req.params.id]
      );

      // Return default roles if none exist
      if (result.rows.length === 0) {
        return res.json({
          success: true,
          data: [
            { name: 'admin', permissions: ['all'] },
            { name: 'member', permissions: ['read', 'write'] },
            { name: 'viewer', permissions: ['read'] }
          ]
        });
      }

      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  rolesApp.post('/api/organizations/:id/roles', mockAuth, async (req, res) => {
    try {
      const { name, permissions } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, message: 'Role name is required' });
      }

      if (!permissions || !Array.isArray(permissions)) {
        return res.status(400).json({ success: false, message: 'Permissions array is required' });
      }

      // Check if admin
      const adminCheck = await db.query(
        'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
      );

      if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only admins can create roles' });
      }

      // Check if role exists
      const existingRole = await db.query(
        'SELECT id FROM organization_roles WHERE organization_id = $1 AND name = $2',
        [req.params.id, name]
      );

      if (existingRole.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Role already exists' });
      }

      const result = await db.query(
        'INSERT INTO organization_roles (organization_id, name, permissions) VALUES ($1, $2, $3) RETURNING *',
        [req.params.id, name, JSON.stringify(permissions)]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('GET /api/organizations/:id/roles', () => {
    it('should return all roles', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { name: 'admin', permissions: ['all'] },
          { name: 'editor', permissions: ['read', 'write'] }
        ]
      });

      const res = await request(rolesApp).get('/api/organizations/1/roles');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return default roles if none exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(rolesApp).get('/api/organizations/1/roles');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
    });
  });

  describe('POST /api/organizations/:id/roles', () => {
    it('should create a new role', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ name: 'editor', permissions: ['read', 'write'] }] });

      const res = await request(rolesApp)
        .post('/api/organizations/1/roles')
        .send({ name: 'editor', permissions: ['read', 'write'] });

      expect(res.status).toBe(201);
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(rolesApp)
        .post('/api/organizations/1/roles')
        .send({ permissions: ['read'] });

      expect(res.status).toBe(400);
    });

    it('should return 400 if permissions is not array', async () => {
      const res = await request(rolesApp)
        .post('/api/organizations/1/roles')
        .send({ name: 'editor', permissions: 'read' });

      expect(res.status).toBe(400);
    });

    it('should return 400 if role already exists', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await request(rolesApp)
        .post('/api/organizations/1/roles')
        .send({ name: 'admin', permissions: ['all'] });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already exists');
    });

    it('should return 403 if not admin', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ role: 'member' }] });

      const res = await request(rolesApp)
        .post('/api/organizations/1/roles')
        .send({ name: 'editor', permissions: ['read'] });

      expect(res.status).toBe(403);
    });
  });
});
