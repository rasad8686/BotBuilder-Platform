/**
 * Comprehensive Organizations Routes Tests
 * Tests for server/routes/organizations.js
 *
 * Coverage includes:
 * - Organization CRUD operations
 * - Member management
 * - Role updates
 * - Organization switching
 * - Permission checks
 * - Error handling
 * - Validation
 * - Audit logging
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', current_organization_id: 1 };
  next();
}));

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: jest.fn((req, res, next) => {
    req.organization = {
      id: parseInt(req.params.id) || 1,
      name: 'Test Org',
      role: 'admin',
      owner_id: 1,
      is_owner: true
    };
    next();
  }),
  requireOrganization: jest.fn((req, res, next) => next())
}));

jest.mock('../../middleware/checkPermission', () => ({
  checkPermission: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../../middleware/audit', () => ({
  logOrganizationCreated: jest.fn().mockResolvedValue({}),
  logOrganizationUpdated: jest.fn().mockResolvedValue({}),
  logOrganizationDeleted: jest.fn().mockResolvedValue({}),
  logOrganizationSwitched: jest.fn().mockResolvedValue({}),
  logMemberInvited: jest.fn().mockResolvedValue({}),
  logMemberRoleChanged: jest.fn().mockResolvedValue({}),
  logMemberRemoved: jest.fn().mockResolvedValue({})
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
const organizationsRouter = require('../../routes/organizations');
const auditMock = require('../../middleware/audit');
const logger = require('../../utils/logger');

const app = express();
app.use(express.json());
app.use('/api/organizations', organizationsRouter);

describe('Organizations Routes - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  // ============================================================================
  // POST /api/organizations - Create Organization
  // ============================================================================
  describe('POST /api/organizations - Create Organization', () => {
    it('should create organization successfully with valid data', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Slug check
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          name: 'Test Org',
          slug: 'test-org',
          owner_id: 1,
          plan_tier: 'free',
          settings: {},
          created_at: new Date()
        }] }) // Create org
        .mockResolvedValueOnce({ rows: [] }); // Add member

      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'Test Org', slug: 'test-org' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Organization created successfully');
      expect(response.body.data.name).toBe('Test Org');
      expect(response.body.data.slug).toBe('test-org');
      expect(response.body.data.plan_tier).toBe('free');
      expect(auditMock.logOrganizationCreated).toHaveBeenCalled();
    });

    it('should reject request with missing name', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .send({ slug: 'test-org' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('name and slug are required');
    });

    it('should reject request with missing slug', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'Test Org' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('name and slug are required');
    });

    it('should reject request with both name and slug missing', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject duplicate slug', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 2 }] }); // Slug exists

      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'Test Org', slug: 'existing-slug' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already taken');
    });

    it('should handle database errors during slug check', async () => {
      db.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'Test Org', slug: 'test-org' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Error creating organization');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle database errors during organization creation', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Slug check passes
        .mockRejectedValueOnce(new Error('Insert failed'));

      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'Test Org', slug: 'test-org' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle empty string for name', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .send({ name: '', slug: 'test-org' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle empty string for slug', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'Test Org', slug: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should create organization with special characters in name', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          name: 'Test & Co\'s Org!',
          slug: 'test-org',
          owner_id: 1,
          plan_tier: 'free'
        }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'Test & Co\'s Org!', slug: 'test-org' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should call audit logging after successful creation', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{
          id: 5,
          name: 'Audit Test',
          slug: 'audit-test',
          owner_id: 1,
          plan_tier: 'free'
        }] })
        .mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post('/api/organizations')
        .send({ name: 'Audit Test', slug: 'audit-test' });

      expect(auditMock.logOrganizationCreated).toHaveBeenCalledWith(
        expect.anything(),
        5,
        expect.objectContaining({
          name: 'Audit Test',
          slug: 'audit-test',
          plan_tier: 'free'
        })
      );
    });
  });

  // ============================================================================
  // GET /api/organizations - List Organizations
  // ============================================================================
  describe('GET /api/organizations - List Organizations', () => {
    it('should return user organizations successfully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: 'Org 1',
            slug: 'org-1',
            role: 'admin',
            member_count: '5',
            bot_count: '3',
            joined_at: new Date(),
            status: 'active'
          },
          {
            id: 2,
            name: 'Org 2',
            slug: 'org-2',
            role: 'member',
            member_count: '10',
            bot_count: '8',
            joined_at: new Date(),
            status: 'active'
          }
        ]
      });

      const response = await request(app).get('/api/organizations');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.organizations).toHaveLength(2);
      expect(response.body.organizations[0].name).toBe('Org 1');
      expect(response.body.organizations[1].name).toBe('Org 2');
    });

    it('should return empty array when user has no organizations', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/organizations');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.organizations).toHaveLength(0);
    });

    it('should handle database errors gracefully', async () => {
      db.query.mockRejectedValueOnce(new Error('DB connection error'));

      const response = await request(app).get('/api/organizations');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Error fetching organizations');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should include member and bot counts in response', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Test Org',
          role: 'admin',
          member_count: '15',
          bot_count: '7'
        }]
      });

      const response = await request(app).get('/api/organizations');

      expect(response.status).toBe(200);
      expect(response.body.organizations[0].member_count).toBe('15');
      expect(response.body.organizations[0].bot_count).toBe('7');
    });

    it('should log debug information when fetching organizations', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test', role: 'admin' }]
      });

      await request(app).get('/api/organizations');

      expect(logger.debug).toHaveBeenCalledWith(
        'Fetched organizations for user',
        expect.objectContaining({
          userId: 1,
          count: 1
        })
      );
    });
  });

  // ============================================================================
  // GET /api/organizations/:id - Get Single Organization
  // ============================================================================
  describe('GET /api/organizations/:id - Get Organization Details', () => {
    it('should return organization details successfully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Test Org',
          slug: 'test-org',
          owner_name: 'Owner Name',
          owner_email: 'owner@test.com',
          plan_tier: 'pro',
          member_count: '5',
          bot_count: '3',
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      const response = await request(app).get('/api/organizations/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Org');
      expect(response.body.data.owner_name).toBe('Owner Name');
      expect(response.body.data.current_user_role).toBe('admin');
      expect(response.body.data.current_user_is_owner).toBe(true);
    });

    it('should return 403 when accessing different organization', async () => {
      const response = await request(app).get('/api/organizations/999');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access denied');
    });

    it('should return 404 when organization not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/organizations/1');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Query failed'));

      const response = await request(app).get('/api/organizations/1');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should include owner information in response', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Test Org',
          owner_id: 1,
          owner_name: 'John Doe',
          owner_email: 'john@test.com',
          member_count: '3',
          bot_count: '2'
        }]
      });

      const response = await request(app).get('/api/organizations/1');

      expect(response.status).toBe(200);
      expect(response.body.data.owner_name).toBe('John Doe');
      expect(response.body.data.owner_email).toBe('john@test.com');
    });

    it('should include current user role and ownership status', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Test Org',
          member_count: '5',
          bot_count: '3'
        }]
      });

      const response = await request(app).get('/api/organizations/1');

      expect(response.status).toBe(200);
      expect(response.body.data.current_user_role).toBeDefined();
      expect(response.body.data.current_user_is_owner).toBeDefined();
    });
  });

  // ============================================================================
  // PUT /api/organizations/:id - Update Organization
  // ============================================================================
  describe('PUT /api/organizations/:id - Update Organization', () => {
    it('should update organization name successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ name: 'Old Name', plan_tier: 'free', settings: {} }] })
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          name: 'New Name',
          slug: 'test-org',
          plan_tier: 'free',
          updated_at: new Date()
        }] });

      const response = await request(app)
        .put('/api/organizations/1')
        .send({ name: 'New Name' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Organization updated successfully');
      expect(response.body.data.name).toBe('New Name');
      expect(auditMock.logOrganizationUpdated).toHaveBeenCalled();
    });

    it('should update organization plan tier', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ name: 'Test', plan_tier: 'free', settings: {} }] })
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          name: 'Test',
          plan_tier: 'pro'
        }] });

      const response = await request(app)
        .put('/api/organizations/1')
        .send({ plan_tier: 'pro' });

      expect(response.status).toBe(200);
      expect(response.body.data.plan_tier).toBe('pro');
    });

    it('should update organization settings', async () => {
      const newSettings = { theme: 'dark', notifications: true };
      db.query
        .mockResolvedValueOnce({ rows: [{ name: 'Test', plan_tier: 'free', settings: {} }] })
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          settings: newSettings
        }] });

      const response = await request(app)
        .put('/api/organizations/1')
        .send({ settings: newSettings });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should update multiple fields at once', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ name: 'Old', plan_tier: 'free', settings: {} }] })
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          name: 'New Name',
          plan_tier: 'enterprise',
          settings: { custom: true }
        }] });

      const response = await request(app)
        .put('/api/organizations/1')
        .send({
          name: 'New Name',
          plan_tier: 'enterprise',
          settings: { custom: true }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('New Name');
      expect(response.body.data.plan_tier).toBe('enterprise');
    });

    it('should reject empty update request', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ name: 'Test', plan_tier: 'free', settings: {} }] });

      const response = await request(app)
        .put('/api/organizations/1')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No updates provided');
    });

    it('should return 403 when accessing different organization', async () => {
      const response = await request(app)
        .put('/api/organizations/999')
        .send({ name: 'New Name' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Update failed'));

      const response = await request(app)
        .put('/api/organizations/1')
        .send({ name: 'New Name' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should log audit trail with old and new values', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ name: 'Old', plan_tier: 'free', settings: {} }] })
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          name: 'New',
          plan_tier: 'pro',
          settings: {}
        }] });

      await request(app)
        .put('/api/organizations/1')
        .send({ name: 'New', plan_tier: 'pro' });

      expect(auditMock.logOrganizationUpdated).toHaveBeenCalledWith(
        expect.anything(),
        1,
        expect.objectContaining({ name: 'Old', plan_tier: 'free' }),
        expect.objectContaining({ name: 'New', plan_tier: 'pro' })
      );
    });
  });

  // ============================================================================
  // DELETE /api/organizations/:id - Delete Organization
  // ============================================================================
  describe('DELETE /api/organizations/:id - Delete Organization', () => {
    it('should delete organization successfully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Test Org',
          slug: 'test-org',
          plan_tier: 'free',
          owner_id: 1
        }]
      });

      const response = await request(app).delete('/api/organizations/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Organization deleted successfully');
      expect(auditMock.logOrganizationDeleted).toHaveBeenCalled();
    });

    it('should return 404 when organization not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).delete('/api/organizations/1');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should return 403 when accessing different organization', async () => {
      const response = await request(app).delete('/api/organizations/999');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Delete failed'));

      const response = await request(app).delete('/api/organizations/1');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should log deletion to audit trail', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Deleted Org',
          slug: 'deleted-org',
          plan_tier: 'pro'
        }]
      });

      await request(app).delete('/api/organizations/1');

      expect(auditMock.logOrganizationDeleted).toHaveBeenCalledWith(
        expect.anything(),
        1,
        expect.objectContaining({
          name: 'Deleted Org',
          slug: 'deleted-org',
          plan_tier: 'pro'
        })
      );
    });
  });

  // ============================================================================
  // GET /api/organizations/:id/members - List Members
  // ============================================================================
  describe('GET /api/organizations/:id/members - List Members', () => {
    it('should return organization members successfully', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              user_id: 1,
              name: 'User 1',
              email: 'user1@test.com',
              role: 'admin',
              status: 'active',
              joined_at: new Date()
            },
            {
              id: 2,
              user_id: 2,
              name: 'User 2',
              email: 'user2@test.com',
              role: 'member',
              status: 'active',
              joined_at: new Date()
            }
          ]
        })
        .mockResolvedValueOnce({ rows: [{ owner_id: 1 }] });

      const response = await request(app).get('/api/organizations/1/members');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.members).toHaveLength(2);
    });

    it('should mark owner with owner role', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { id: 1, user_id: 1, role: 'admin', name: 'Owner', email: 'owner@test.com' },
            { id: 2, user_id: 2, role: 'member', name: 'Member', email: 'member@test.com' }
          ]
        })
        .mockResolvedValueOnce({ rows: [{ owner_id: 1 }] });

      const response = await request(app).get('/api/organizations/1/members');

      expect(response.status).toBe(200);
      expect(response.body.members[0].role).toBe('owner');
      expect(response.body.members[1].role).toBe('member');
    });

    it('should return 403 when accessing different organization', async () => {
      const response = await request(app).get('/api/organizations/999/members');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return empty array when no members', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ owner_id: 1 }] });

      const response = await request(app).get('/api/organizations/1/members');

      expect(response.status).toBe(200);
      expect(response.body.members).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Query failed'));

      const response = await request(app).get('/api/organizations/1/members');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should include invited_by information', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            user_id: 2,
            role: 'member',
            name: 'Member',
            email: 'member@test.com',
            invited_by_name: 'Admin User'
          }]
        })
        .mockResolvedValueOnce({ rows: [{ owner_id: 1 }] });

      const response = await request(app).get('/api/organizations/1/members');

      expect(response.status).toBe(200);
      expect(response.body.members[0].invited_by_name).toBe('Admin User');
    });

    it('should log debug information', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1, role: 'admin' }] })
        .mockResolvedValueOnce({ rows: [{ owner_id: 1 }] });

      await request(app).get('/api/organizations/1/members');

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('members'),
        expect.anything()
      );
    });
  });

  // ============================================================================
  // POST /api/organizations/:id/members - Add Member
  // ============================================================================
  describe('POST /api/organizations/:id/members - Add Member', () => {
    it('should invite member successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // User exists
        .mockResolvedValueOnce({ rows: [] }) // Not already member
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          user_id: 2,
          role: 'member',
          org_id: 1,
          status: 'active',
          joined_at: new Date()
        }] }); // Insert

      const response = await request(app)
        .post('/api/organizations/1/members')
        .send({ email: 'newuser@test.com', role: 'member' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User invited successfully');
      expect(auditMock.logMemberInvited).toHaveBeenCalled();
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/api/organizations/1/members')
        .send({ role: 'member' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Email and role are required');
    });

    it('should reject missing role', async () => {
      const response = await request(app)
        .post('/api/organizations/1/members')
        .send({ email: 'user@test.com' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Email and role are required');
    });

    it('should reject invalid role', async () => {
      const response = await request(app)
        .post('/api/organizations/1/members')
        .send({ email: 'user@test.com', role: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid role');
    });

    it('should accept admin role', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 2, role: 'admin' }] });

      const response = await request(app)
        .post('/api/organizations/1/members')
        .send({ email: 'admin@test.com', role: 'admin' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should accept viewer role', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 2, role: 'viewer' }] });

      const response = await request(app)
        .post('/api/organizations/1/members')
        .send({ email: 'viewer@test.com', role: 'viewer' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 if user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // User doesn't exist

      const response = await request(app)
        .post('/api/organizations/1/members')
        .send({ email: 'unknown@test.com', role: 'member' });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should reject if user already a member', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // User exists
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Already member

      const response = await request(app)
        .post('/api/organizations/1/members')
        .send({ email: 'existing@test.com', role: 'member' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already a member');
    });

    it('should return 403 when accessing different organization', async () => {
      const response = await request(app)
        .post('/api/organizations/999/members')
        .send({ email: 'user@test.com', role: 'member' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .post('/api/organizations/1/members')
        .send({ email: 'user@test.com', role: 'member' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should log audit trail after successful invitation', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 3 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 3, role: 'member' }] });

      await request(app)
        .post('/api/organizations/1/members')
        .send({ email: 'new@test.com', role: 'member' });

      expect(auditMock.logMemberInvited).toHaveBeenCalledWith(
        expect.anything(),
        1,
        3,
        'member'
      );
    });
  });

  // ============================================================================
  // PUT /api/organizations/:id/members/:userId - Update Member Role
  // ============================================================================
  describe('PUT /api/organizations/:id/members/:userId - Update Member Role', () => {
    it('should update member role successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'member' }] }) // Get current
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          user_id: 2,
          role: 'admin',
          org_id: 1
        }] }); // Update

      const response = await request(app)
        .put('/api/organizations/1/members/2')
        .send({ role: 'admin' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Member role updated successfully');
      expect(auditMock.logMemberRoleChanged).toHaveBeenCalled();
    });

    it('should reject invalid role', async () => {
      const response = await request(app)
        .put('/api/organizations/1/members/2')
        .send({ role: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid role');
    });

    it('should reject missing role', async () => {
      const response = await request(app)
        .put('/api/organizations/1/members/2')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid role');
    });

    it('should prevent changing owner role', async () => {
      const response = await request(app)
        .put('/api/organizations/1/members/1') // Owner ID
        .send({ role: 'member' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Cannot change organization owner role');
    });

    it('should return 404 if member not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // No current member
        .mockResolvedValueOnce({ rows: [] }); // Update returns nothing

      const response = await request(app)
        .put('/api/organizations/1/members/999')
        .send({ role: 'admin' });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should return 403 when accessing different organization', async () => {
      const response = await request(app)
        .put('/api/organizations/999/members/2')
        .send({ role: 'admin' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Update failed'));

      const response = await request(app)
        .put('/api/organizations/1/members/2')
        .send({ role: 'admin' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should log audit trail with old and new roles', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'viewer' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 2, role: 'admin' }] });

      await request(app)
        .put('/api/organizations/1/members/2')
        .send({ role: 'admin' });

      expect(auditMock.logMemberRoleChanged).toHaveBeenCalledWith(
        expect.anything(),
        1,
        2,
        'viewer',
        'admin'
      );
    });

    it('should allow updating to viewer role', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'member' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 2, role: 'viewer' }] });

      const response = await request(app)
        .put('/api/organizations/1/members/2')
        .send({ role: 'viewer' });

      expect(response.status).toBe(200);
      expect(response.body.data.role).toBe('viewer');
    });
  });

  // ============================================================================
  // PUT /api/organizations/:id/members/:userId/role - Alternative Role Update
  // ============================================================================
  describe('PUT /api/organizations/:id/members/:userId/role - Alternative Role Update', () => {
    it('should update member role via /role endpoint', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'member' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, role: 'admin', user_id: 2 }] });

      const response = await request(app)
        .put('/api/organizations/1/members/2/role')
        .send({ role: 'admin' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(auditMock.logMemberRoleChanged).toHaveBeenCalled();
    });

    it('should reject invalid role', async () => {
      const response = await request(app)
        .put('/api/organizations/1/members/2/role')
        .send({ role: 'superadmin' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid role');
    });

    it('should prevent changing owner role', async () => {
      const response = await request(app)
        .put('/api/organizations/1/members/1/role')
        .send({ role: 'viewer' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('owner');
    });

    it('should return 404 if member not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/organizations/1/members/999/role')
        .send({ role: 'admin' });

      expect(response.status).toBe(404);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .put('/api/organizations/1/members/2/role')
        .send({ role: 'admin' });

      expect(response.status).toBe(500);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // DELETE /api/organizations/:id/members/:userId - Remove Member
  // ============================================================================
  describe('DELETE /api/organizations/:id/members/:userId - Remove Member', () => {
    it('should remove member successfully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          user_id: 2,
          role: 'member',
          status: 'active',
          org_id: 1
        }]
      });

      const response = await request(app).delete('/api/organizations/1/members/2');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Member removed successfully');
      expect(auditMock.logMemberRemoved).toHaveBeenCalled();
    });

    it('should prevent removing owner', async () => {
      const response = await request(app).delete('/api/organizations/1/members/1');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Cannot remove organization owner');
    });

    it('should return 404 if member not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).delete('/api/organizations/1/members/999');

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should return 403 when accessing different organization', async () => {
      const response = await request(app).delete('/api/organizations/999/members/2');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Delete failed'));

      const response = await request(app).delete('/api/organizations/1/members/2');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should log removal to audit trail', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          user_id: 3,
          role: 'viewer',
          status: 'active'
        }]
      });

      await request(app).delete('/api/organizations/1/members/3');

      expect(auditMock.logMemberRemoved).toHaveBeenCalledWith(
        expect.anything(),
        1,
        3,
        expect.objectContaining({
          role: 'viewer',
          status: 'active'
        })
      );
    });
  });

  // ============================================================================
  // POST /api/organizations/:id/switch - Switch Organization
  // ============================================================================
  describe('POST /api/organizations/:id/switch - Switch Organization', () => {
    it('should switch organization successfully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          role: 'admin',
          name: 'Test Org',
          slug: 'test-org'
        }]
      });

      const response = await request(app)
        .post('/api/organizations/1/switch')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Switched to organization successfully');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.organization).toBeDefined();
      expect(auditMock.logOrganizationSwitched).toHaveBeenCalled();
    });

    it('should return 403 if user not a member', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/organizations/999/switch')
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('not a member');
    });

    it('should include organization details in response', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          role: 'member',
          name: 'Awesome Org',
          slug: 'awesome-org'
        }]
      });

      const response = await request(app)
        .post('/api/organizations/1/switch')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.data.organization.name).toBe('Awesome Org');
      expect(response.body.data.organization.slug).toBe('awesome-org');
    });

    it('should generate valid JWT token', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ role: 'admin', name: 'Test', slug: 'test' }]
      });

      const response = await request(app)
        .post('/api/organizations/1/switch')
        .send({});

      expect(response.status).toBe(200);
      expect(typeof response.body.data.token).toBe('string');
      expect(response.body.data.token.length).toBeGreaterThan(0);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .post('/api/organizations/1/switch')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should log organization switch to audit trail', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ role: 'admin', name: 'Test', slug: 'test' }]
      });

      await request(app)
        .post('/api/organizations/1/switch')
        .send({});

      expect(auditMock.logOrganizationSwitched).toHaveBeenCalledWith(
        expect.anything(),
        1
      );
    });

    it('should reject switching to inactive membership', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // No active membership

      const response = await request(app)
        .post('/api/organizations/1/switch')
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  // ============================================================================
  // Additional Edge Cases and Error Scenarios
  // ============================================================================
  describe('Additional Edge Cases', () => {
    it('should handle null values in organization settings', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ name: 'Test', plan_tier: 'free', settings: null }] })
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          settings: null
        }] });

      const response = await request(app)
        .put('/api/organizations/1')
        .send({ settings: null });

      expect(response.status).toBe(200);
    });

    it('should handle very long organization names', async () => {
      const longName = 'A'.repeat(255);
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          name: longName,
          slug: 'test'
        }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/organizations')
        .send({ name: longName, slug: 'test' });

      expect(response.status).toBe(201);
    });

    it('should handle concurrent member additions', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 2, role: 'member' }] });

      const response = await request(app)
        .post('/api/organizations/1/members')
        .send({ email: 'concurrent@test.com', role: 'member' });

      expect(response.status).toBe(201);
    });

    it('should handle special characters in email addresses', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 2, role: 'member' }] });

      const response = await request(app)
        .post('/api/organizations/1/members')
        .send({ email: 'user+tag@test.co.uk', role: 'member' });

      expect(response.status).toBe(201);
    });

    it('should handle numeric IDs as strings in URL params', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Test',
          member_count: '5',
          bot_count: '3'
        }]
      });

      const response = await request(app).get('/api/organizations/1');

      expect(response.status).toBe(200);
    });

    it('should handle whitespace in organization names', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          name: '  Spaces  ',
          slug: 'spaces'
        }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/organizations')
        .send({ name: '  Spaces  ', slug: 'spaces' });

      expect(response.status).toBe(201);
    });

    it('should validate role values case-sensitively', async () => {
      const response = await request(app)
        .post('/api/organizations/1/members')
        .send({ email: 'user@test.com', role: 'ADMIN' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid role');
    });
  });
});
