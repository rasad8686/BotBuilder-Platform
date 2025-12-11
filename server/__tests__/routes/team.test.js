/**
 * Team Routes Tests
 * Tests for server/routes/team.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', current_organization_id: 1 };
  next();
}));

jest.mock('../../models/TeamMember', () => ({
  findByTenant: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn()
}));

jest.mock('../../models/TeamInvitation', () => ({
  create: jest.fn(),
  findPendingByTenant: jest.fn(),
  accept: jest.fn(),
  hasPendingInvitation: jest.fn()
}));

jest.mock('../../models/ActivityLog', () => ({
  create: jest.fn(),
  findByTenant: jest.fn()
}));

jest.mock('../../collaboration/core/TeamManager', () => {
  return jest.fn().mockImplementation(() => ({
    getTeamStats: jest.fn()
  }));
});

jest.mock('../../collaboration/core/RoleManager', () => {
  return jest.fn().mockImplementation(() => ({
    getRoles: jest.fn(),
    createRole: jest.fn(),
    updateRole: jest.fn(),
    deleteRole: jest.fn()
  }));
});

jest.mock('../../collaboration/core/PermissionChecker', () => ({
  PermissionChecker: {
    getAllUserPermissions: jest.fn()
  },
  PERMISSIONS: {
    TEAM_MANAGE: 'team.manage',
    TEAM_INVITE: 'team.invite',
    TEAM_VIEW: 'team.view'
  },
  requirePermission: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const TeamMember = require('../../models/TeamMember');
const TeamInvitation = require('../../models/TeamInvitation');
const ActivityLog = require('../../models/ActivityLog');
const TeamManager = require('../../collaboration/core/TeamManager');
const RoleManager = require('../../collaboration/core/RoleManager');
const { PermissionChecker } = require('../../collaboration/core/PermissionChecker');
const teamRouter = require('../../routes/team');

const app = express();
app.use(express.json());
app.use('/api/team', teamRouter);

describe('Team Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/team/members', () => {
    it('should return team members', async () => {
      const mockMembers = [
        { id: 1, user_id: 1, role_id: 1, status: 'active' },
        { id: 2, user_id: 2, role_id: 2, status: 'active' }
      ];
      TeamMember.findByTenant.mockResolvedValueOnce(mockMembers);

      const response = await request(app).get('/api/team/members');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(TeamMember.findByTenant).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      TeamMember.findByTenant.mockResolvedValueOnce([]);

      const response = await request(app).get('/api/team/members?status=active');

      expect(response.status).toBe(200);
      expect(TeamMember.findByTenant).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'active' })
      );
    });

    it('should handle errors', async () => {
      TeamMember.findByTenant.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/team/members');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed');
    });
  });

  describe('POST /api/team/members', () => {
    it('should add team member', async () => {
      TeamMember.exists.mockResolvedValueOnce(false);
      TeamMember.create.mockResolvedValueOnce({
        id: 1,
        user_id: 2,
        role_id: 1
      });
      ActivityLog.create.mockResolvedValueOnce({});

      const response = await request(app)
        .post('/api/team/members')
        .send({ userId: 2, roleId: 1 });

      expect(response.status).toBe(201);
      expect(TeamMember.create).toHaveBeenCalled();
      expect(ActivityLog.create).toHaveBeenCalled();
    });

    it('should reject missing fields', async () => {
      const response = await request(app)
        .post('/api/team/members')
        .send({ userId: 2 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject if user already member', async () => {
      TeamMember.exists.mockResolvedValueOnce(true);

      const response = await request(app)
        .post('/api/team/members')
        .send({ userId: 2, roleId: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already');
    });
  });

  describe('PUT /api/team/members/:id', () => {
    it('should update team member', async () => {
      TeamMember.findById.mockResolvedValueOnce({
        id: 1,
        tenant_id: 1,
        user_id: 2
      });
      TeamMember.update.mockResolvedValueOnce({
        id: 1,
        role_id: 2
      });
      ActivityLog.create.mockResolvedValueOnce({});

      const response = await request(app)
        .put('/api/team/members/1')
        .send({ roleId: 2, status: 'active' });

      expect(response.status).toBe(200);
      expect(TeamMember.update).toHaveBeenCalled();
    });

    it('should return 404 if not found', async () => {
      TeamMember.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .put('/api/team/members/999')
        .send({ roleId: 2 });

      expect(response.status).toBe(404);
    });

    it('should return 404 if different tenant', async () => {
      TeamMember.findById.mockResolvedValueOnce({
        id: 1,
        tenant_id: 999 // Different tenant
      });

      const response = await request(app)
        .put('/api/team/members/1')
        .send({ roleId: 2 });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/team/members/:id', () => {
    it('should remove team member', async () => {
      TeamMember.findById.mockResolvedValueOnce({
        id: 1,
        tenant_id: 1,
        user_id: 2
      });
      TeamMember.delete.mockResolvedValueOnce({ id: 1 });
      ActivityLog.create.mockResolvedValueOnce({});

      const response = await request(app).delete('/api/team/members/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('removed');
    });

    it('should prevent self-removal', async () => {
      TeamMember.findById.mockResolvedValueOnce({
        id: 1,
        tenant_id: 1,
        user_id: 1 // Same as logged in user
      });

      const response = await request(app).delete('/api/team/members/1');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('yourself');
    });
  });

  describe('POST /api/team/invite', () => {
    it('should send invitation', async () => {
      TeamInvitation.hasPendingInvitation.mockResolvedValueOnce(false);
      TeamInvitation.create.mockResolvedValueOnce({
        id: 1,
        email: 'new@example.com',
        expires_at: new Date()
      });
      ActivityLog.create.mockResolvedValueOnce({});

      const response = await request(app)
        .post('/api/team/invite')
        .send({ email: 'new@example.com', roleId: 1 });

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('sent');
    });

    it('should reject missing fields', async () => {
      const response = await request(app)
        .post('/api/team/invite')
        .send({ email: 'new@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject if pending invitation exists', async () => {
      TeamInvitation.hasPendingInvitation.mockResolvedValueOnce(true);

      const response = await request(app)
        .post('/api/team/invite')
        .send({ email: 'new@example.com', roleId: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('POST /api/team/invite/:token/accept', () => {
    it('should accept invitation', async () => {
      TeamInvitation.accept.mockResolvedValueOnce({
        tenantId: 1,
        roleId: 1,
        invitation: { id: 1, invited_by: 2 }
      });
      TeamMember.create.mockResolvedValueOnce({ id: 1 });
      ActivityLog.create.mockResolvedValueOnce({});

      const response = await request(app)
        .post('/api/team/invite/valid-token/accept');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('accepted');
    });

    it('should handle invalid token', async () => {
      TeamInvitation.accept.mockRejectedValueOnce(new Error('Invalid or expired token'));

      const response = await request(app)
        .post('/api/team/invite/invalid-token/accept');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/team/invitations', () => {
    it('should return pending invitations', async () => {
      TeamInvitation.findPendingByTenant.mockResolvedValueOnce([
        { id: 1, email: 'pending@example.com' }
      ]);

      const response = await request(app).get('/api/team/invitations');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });
  });

  describe('GET /api/team/roles', () => {
    it('should return roles', async () => {
      const mockRoleManager = RoleManager.mock.results[0]?.value || { getRoles: jest.fn() };
      if (mockRoleManager.getRoles) {
        mockRoleManager.getRoles.mockResolvedValueOnce([
          { id: 1, name: 'Admin' },
          { id: 2, name: 'Member' }
        ]);
      }

      const response = await request(app).get('/api/team/roles');

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/team/roles', () => {
    it('should create role', async () => {
      const mockRoleManager = { createRole: jest.fn().mockResolvedValue({ id: 1, name: 'Custom' }) };
      RoleManager.mockImplementation(() => mockRoleManager);

      const response = await request(app)
        .post('/api/team/roles')
        .send({ name: 'Custom', permissions: ['read', 'write'] });

      expect(response.status).toBe(201);
    });

    it('should reject missing fields', async () => {
      const response = await request(app)
        .post('/api/team/roles')
        .send({ name: 'Custom' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });
  });

  describe('PUT /api/team/roles/:id', () => {
    it('should update role', async () => {
      const mockRoleManager = { updateRole: jest.fn().mockResolvedValue({ id: 1, name: 'Updated' }) };
      RoleManager.mockImplementation(() => mockRoleManager);
      ActivityLog.create.mockResolvedValueOnce({});

      const response = await request(app)
        .put('/api/team/roles/1')
        .send({ name: 'Updated' });

      expect(response.status).toBe(200);
    });

    it('should return 404 if role not found', async () => {
      const mockRoleManager = { updateRole: jest.fn().mockResolvedValue(null) };
      RoleManager.mockImplementation(() => mockRoleManager);

      const response = await request(app)
        .put('/api/team/roles/999')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/team/roles/:id', () => {
    it('should delete role', async () => {
      const mockRoleManager = { deleteRole: jest.fn().mockResolvedValue({ id: 1 }) };
      RoleManager.mockImplementation(() => mockRoleManager);
      ActivityLog.create.mockResolvedValueOnce({});

      const response = await request(app).delete('/api/team/roles/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');
    });
  });

  describe('GET /api/team/activity', () => {
    it('should return activity log', async () => {
      ActivityLog.findByTenant.mockResolvedValueOnce([
        { id: 1, action: 'team_member_added' }
      ]);

      const response = await request(app).get('/api/team/activity');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });

    it('should pass filter parameters', async () => {
      ActivityLog.findByTenant.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/team/activity?action=team_member_added&limit=10');

      expect(response.status).toBe(200);
      expect(ActivityLog.findByTenant).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'team_member_added',
          limit: 10
        })
      );
    });
  });

  describe('GET /api/team/stats', () => {
    it('should return team stats', async () => {
      const mockTeamManager = { getTeamStats: jest.fn().mockResolvedValue({ total: 5, active: 4 }) };
      TeamManager.mockImplementation(() => mockTeamManager);

      const response = await request(app).get('/api/team/stats');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/team/permissions', () => {
    it('should return user permissions', async () => {
      PermissionChecker.getAllUserPermissions.mockResolvedValueOnce(['read', 'write', 'manage']);

      const response = await request(app).get('/api/team/permissions');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(['read', 'write', 'manage']);
    });
  });
});
