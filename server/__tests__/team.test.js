/**
 * Team API Tests
 * Tests for /api/team endpoints: members, roles, invitations
 */

const request = require('supertest');

jest.mock('../db', () => ({
  query: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const db = require('../db');

const app = express();
app.use(express.json());

const mockAuth = (req, res, next) => {
  req.user = { id: 1, email: 'admin@example.com' };
  req.organization = { id: 1, name: 'Test Org' };
  next();
};

// GET team members
app.get('/api/team/members', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT om.*, u.name, u.email, tr.name as role_name
       FROM organization_members om
       JOIN users u ON om.user_id = u.id
       LEFT JOIN team_roles tr ON om.role_id = tr.id
       WHERE om.organization_id = $1
       ORDER BY om.created_at DESC`,
      [req.organization.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET single member
app.get('/api/team/members/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT om.*, u.name, u.email, tr.name as role_name
       FROM organization_members om
       JOIN users u ON om.user_id = u.id
       LEFT JOIN team_roles tr ON om.role_id = tr.id
       WHERE om.id = $1 AND om.organization_id = $2`,
      [req.params.id, req.organization.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// UPDATE member role
app.put('/api/team/members/:id', mockAuth, async (req, res) => {
  try {
    const { role_id } = req.body;

    const memberResult = await db.query(
      'SELECT * FROM organization_members WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    // Check if member is owner
    if (memberResult.rows[0].role === 'owner') {
      return res.status(400).json({ success: false, message: 'Cannot change owner role' });
    }

    const result = await db.query(
      'UPDATE organization_members SET role_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [role_id, req.params.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// REMOVE member
app.delete('/api/team/members/:id', mockAuth, async (req, res) => {
  try {
    const memberResult = await db.query(
      'SELECT * FROM organization_members WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    if (memberResult.rows[0].role === 'owner') {
      return res.status(400).json({ success: false, message: 'Cannot remove organization owner' });
    }

    // Check if user is removing themselves
    if (memberResult.rows[0].user_id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot remove yourself' });
    }

    await db.query('DELETE FROM organization_members WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Member removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET invitations
app.get('/api/team/invitations', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM team_invitations WHERE organization_id = $1 ORDER BY created_at DESC`,
      [req.organization.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// CREATE invitation
app.post('/api/team/invitations', mockAuth, async (req, res) => {
  try {
    const { email, role_id } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Check if email is valid
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    // Check if already a member
    const existingMember = await db.query(
      `SELECT om.id FROM organization_members om
       JOIN users u ON om.user_id = u.id
       WHERE om.organization_id = $1 AND u.email = $2`,
      [req.organization.id, email]
    );

    if (existingMember.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'User is already a member' });
    }

    // Check if pending invitation exists
    const existingInvite = await db.query(
      "SELECT id FROM team_invitations WHERE organization_id = $1 AND email = $2 AND status = 'pending'",
      [req.organization.id, email]
    );

    if (existingInvite.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Invitation already sent' });
    }

    const token = 'invite-' + Math.random().toString(36).substr(2, 16);
    const result = await db.query(
      `INSERT INTO team_invitations (organization_id, email, role_id, token, invited_by, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW() + INTERVAL '7 days') RETURNING *`,
      [req.organization.id, email, role_id || null, token, req.user.id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// RESEND invitation
app.post('/api/team/invitations/:id/resend', mockAuth, async (req, res) => {
  try {
    const inviteResult = await db.query(
      "SELECT * FROM team_invitations WHERE id = $1 AND organization_id = $2 AND status = 'pending'",
      [req.params.id, req.organization.id]
    );

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    await db.query(
      "UPDATE team_invitations SET expires_at = NOW() + INTERVAL '7 days', updated_at = NOW() WHERE id = $1",
      [req.params.id]
    );

    res.json({ success: true, message: 'Invitation resent' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// CANCEL invitation
app.delete('/api/team/invitations/:id', mockAuth, async (req, res) => {
  try {
    const inviteResult = await db.query(
      'SELECT * FROM team_invitations WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    await db.query('DELETE FROM team_invitations WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Invitation cancelled' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET roles
app.get('/api/team/roles', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM team_roles WHERE organization_id = $1 OR organization_id IS NULL ORDER BY name',
      [req.organization.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// CREATE custom role
app.post('/api/team/roles', mockAuth, async (req, res) => {
  try {
    const { name, permissions } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Role name is required' });
    }

    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({ success: false, message: 'Permissions array is required' });
    }

    const result = await db.query(
      'INSERT INTO team_roles (organization_id, name, permissions) VALUES ($1, $2, $3) RETURNING *',
      [req.organization.id, name, JSON.stringify(permissions)]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// UPDATE role
app.put('/api/team/roles/:id', mockAuth, async (req, res) => {
  try {
    const { name, permissions } = req.body;

    const roleResult = await db.query(
      'SELECT * FROM team_roles WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (roleResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    const result = await db.query(
      `UPDATE team_roles SET
       name = COALESCE($1, name),
       permissions = COALESCE($2, permissions),
       updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [name, permissions ? JSON.stringify(permissions) : null, req.params.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE role
app.delete('/api/team/roles/:id', mockAuth, async (req, res) => {
  try {
    const roleResult = await db.query(
      'SELECT * FROM team_roles WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (roleResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    // Check if role is in use
    const usageResult = await db.query(
      'SELECT COUNT(*) FROM organization_members WHERE role_id = $1',
      [req.params.id]
    );

    if (parseInt(usageResult.rows[0].count) > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete role that is in use' });
    }

    await db.query('DELETE FROM team_roles WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET team activity
app.get('/api/team/activity', mockAuth, async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const result = await db.query(
      `SELECT al.*, u.name as user_name, u.email as user_email
       FROM audit_logs al
       JOIN users u ON al.user_id = u.id
       WHERE al.organization_id = $1
       ORDER BY al.created_at DESC
       LIMIT $2`,
      [req.organization.id, limit]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Team API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // GET MEMBERS
  // ========================================
  describe('GET /api/team/members', () => {
    it('should return team members', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Admin', email: 'admin@test.com', role_name: 'owner' },
          { id: 2, name: 'Member', email: 'member@test.com', role_name: 'editor' }
        ]
      });

      const res = await request(app).get('/api/team/members');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/team/members');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // GET SINGLE MEMBER
  // ========================================
  describe('GET /api/team/members/:id', () => {
    it('should return member by ID', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Admin', role_name: 'owner' }]
      });

      const res = await request(app).get('/api/team/members/1');

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Admin');
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/team/members/999');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/team/members/1');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // UPDATE MEMBER
  // ========================================
  describe('PUT /api/team/members/:id', () => {
    it('should update member role', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2, role: 'member' }] })
        .mockResolvedValueOnce({ rows: [{ id: 2, role_id: 3 }] });

      const res = await request(app)
        .put('/api/team/members/2')
        .send({ role_id: 3 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if member not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/team/members/999')
        .send({ role_id: 3 });

      expect(res.status).toBe(404);
    });

    it('should reject changing owner role', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, role: 'owner' }] });

      const res = await request(app)
        .put('/api/team/members/1')
        .send({ role_id: 3 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('owner');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .put('/api/team/members/2')
        .send({ role_id: 3 });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // REMOVE MEMBER
  // ========================================
  describe('DELETE /api/team/members/:id', () => {
    it('should remove member', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2, role: 'member', user_id: 5 }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).delete('/api/team/members/2');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/team/members/999');

      expect(res.status).toBe(404);
    });

    it('should reject removing owner', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, role: 'owner' }] });

      const res = await request(app).delete('/api/team/members/1');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('owner');
    });

    it('should reject self-removal', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, role: 'admin', user_id: 1 }] });

      const res = await request(app).delete('/api/team/members/1');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('yourself');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).delete('/api/team/members/2');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // INVITATIONS
  // ========================================
  describe('GET /api/team/invitations', () => {
    it('should return invitations', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, email: 'invite1@test.com', status: 'pending' },
          { id: 2, email: 'invite2@test.com', status: 'accepted' }
        ]
      });

      const res = await request(app).get('/api/team/invitations');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/team/invitations');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/team/invitations', () => {
    it('should create invitation', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Not existing member
        .mockResolvedValueOnce({ rows: [] }) // No pending invite
        .mockResolvedValueOnce({ rows: [{ id: 1, email: 'new@test.com' }] });

      const res = await request(app)
        .post('/api/team/invitations')
        .send({ email: 'new@test.com' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if email is missing', async () => {
      const res = await request(app)
        .post('/api/team/invitations')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid email', async () => {
      const res = await request(app)
        .post('/api/team/invitations')
        .send({ email: 'invalid-email' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid email');
    });

    it('should return 400 if already a member', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await request(app)
        .post('/api/team/invitations')
        .send({ email: 'existing@test.com' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already a member');
    });

    it('should return 400 if invitation already sent', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await request(app)
        .post('/api/team/invitations')
        .send({ email: 'pending@test.com' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already sent');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/team/invitations')
        .send({ email: 'new@test.com' });

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/team/invitations/:id/resend', () => {
    it('should resend invitation', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending' }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).post('/api/team/invitations/1/resend');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).post('/api/team/invitations/999/resend');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).post('/api/team/invitations/1/resend');

      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/team/invitations/:id', () => {
    it('should cancel invitation', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).delete('/api/team/invitations/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/team/invitations/999');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).delete('/api/team/invitations/1');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // ROLES
  // ========================================
  describe('GET /api/team/roles', () => {
    it('should return roles', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Admin', permissions: ['all'] },
          { id: 2, name: 'Editor', permissions: ['read', 'write'] }
        ]
      });

      const res = await request(app).get('/api/team/roles');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/team/roles');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/team/roles', () => {
    it('should create role', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 3, name: 'Custom Role', permissions: ['read'] }]
      });

      const res = await request(app)
        .post('/api/team/roles')
        .send({ name: 'Custom Role', permissions: ['read'] });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(app)
        .post('/api/team/roles')
        .send({ permissions: ['read'] });

      expect(res.status).toBe(400);
    });

    it('should return 400 if permissions is not array', async () => {
      const res = await request(app)
        .post('/api/team/roles')
        .send({ name: 'Role', permissions: 'read' });

      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/team/roles')
        .send({ name: 'Role', permissions: ['read'] });

      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/team/roles/:id', () => {
    it('should update role', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Updated Role' }] });

      const res = await request(app)
        .put('/api/team/roles/2')
        .send({ name: 'Updated Role' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/team/roles/999')
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .put('/api/team/roles/2')
        .send({ name: 'Updated' });

      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/team/roles/:id', () => {
    it('should delete role', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).delete('/api/team/roles/2');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/team/roles/999');

      expect(res.status).toBe(404);
    });

    it('should reject deleting role in use', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const res = await request(app).delete('/api/team/roles/2');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('in use');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).delete('/api/team/roles/2');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // TEAM ACTIVITY
  // ========================================
  describe('GET /api/team/activity', () => {
    it('should return team activity', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, action: 'bot.created', user_name: 'Admin' },
          { id: 2, action: 'bot.updated', user_name: 'Editor' }
        ]
      });

      const res = await request(app).get('/api/team/activity');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should accept limit parameter', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/team/activity?limit=10');

      expect(res.status).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/team/activity');

      expect(res.status).toBe(500);
    });
  });
});
