/**
 * Organizations Routes Tests
 * Tests for server/routes/organizations.js
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
    req.organization = { id: 1, name: 'Test Org', role: 'admin', owner_id: 1, is_owner: true };
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

const app = express();
app.use(express.json());
app.use('/api/organizations', organizationsRouter);

describe('Organizations Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/organizations', () => {
    it('should create organization successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Slug check
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          name: 'Test Org',
          slug: 'test-org',
          owner_id: 1,
          plan_tier: 'free'
        }] }) // Create org
        .mockResolvedValueOnce({ rows: [] }); // Add member

      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'Test Org', slug: 'test-org' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Org');
    });

    it('should reject missing name', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .send({ slug: 'test-org' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('name and slug');
    });

    it('should reject missing slug', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'Test Org' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('name and slug');
    });

    it('should reject duplicate slug', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Slug exists

      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'Test Org', slug: 'existing-slug' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already taken');
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'Test Org', slug: 'test-org' });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/organizations', () => {
    it('should return user organizations', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Org 1', role: 'admin', member_count: '5', bot_count: '3' },
          { id: 2, name: 'Org 2', role: 'member', member_count: '10', bot_count: '8' }
        ]
      });

      const response = await request(app).get('/api/organizations');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.organizations).toHaveLength(2);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/organizations');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/organizations/:id', () => {
    it('should return organization details', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Test Org',
          owner_name: 'Owner',
          owner_email: 'owner@test.com',
          member_count: '5',
          bot_count: '3'
        }]
      });

      const response = await request(app).get('/api/organizations/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Org');
    });

    it('should return 403 if different org', async () => {
      const response = await request(app).get('/api/organizations/999');

      expect(response.status).toBe(403);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/organizations/1');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/organizations/:id', () => {
    it('should update organization', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ name: 'Old Name', plan_tier: 'free', settings: {} }] })
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          name: 'New Name',
          plan_tier: 'free'
        }] });

      const response = await request(app)
        .put('/api/organizations/1')
        .send({ name: 'New Name' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject empty update', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ name: 'Old Name', plan_tier: 'free', settings: {} }] });

      const response = await request(app)
        .put('/api/organizations/1')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('No updates');
    });

    it('should return 403 if different org', async () => {
      const response = await request(app)
        .put('/api/organizations/999')
        .send({ name: 'New Name' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/organizations/:id', () => {
    it('should delete organization', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test Org', slug: 'test-org', plan_tier: 'free' }]
      });

      const response = await request(app).delete('/api/organizations/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).delete('/api/organizations/1');

      expect(response.status).toBe(404);
    });

    it('should return 403 if different org', async () => {
      const response = await request(app).delete('/api/organizations/999');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/organizations/:id/members', () => {
    it('should return organization members', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, user_id: 1, name: 'User 1', email: 'user1@test.com', role: 'admin' },
          { id: 2, user_id: 2, name: 'User 2', email: 'user2@test.com', role: 'member' }
        ]
      });

      const response = await request(app).get('/api/organizations/1/members');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.members).toHaveLength(2);
    });

    it('should return 403 if different org', async () => {
      const response = await request(app).get('/api/organizations/999/members');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/organizations/:id/members', () => {
    it('should invite member successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // User exists
        .mockResolvedValueOnce({ rows: [] }) // Not already member
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 2, role: 'member' }] }); // Insert

      const response = await request(app)
        .post('/api/organizations/1/members')
        .send({ email: 'newuser@test.com', role: 'member' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/api/organizations/1/members')
        .send({ role: 'member' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Email and role');
    });

    it('should reject invalid role', async () => {
      const response = await request(app)
        .post('/api/organizations/1/members')
        .send({ email: 'user@test.com', role: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid role');
    });

    it('should return 404 if user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/organizations/1/members')
        .send({ email: 'unknown@test.com', role: 'member' });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should reject if already member', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // User exists
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Already member

      const response = await request(app)
        .post('/api/organizations/1/members')
        .send({ email: 'existing@test.com', role: 'member' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already a member');
    });
  });

  describe('PUT /api/organizations/:id/members/:userId', () => {
    it('should update member role', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'member' }] }) // Get current
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 2, role: 'admin' }] }); // Update

      const response = await request(app)
        .put('/api/organizations/1/members/2')
        .send({ role: 'admin' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid role', async () => {
      const response = await request(app)
        .put('/api/organizations/1/members/2')
        .send({ role: 'invalid' });

      expect(response.status).toBe(400);
    });

    it('should prevent changing owner role', async () => {
      const response = await request(app)
        .put('/api/organizations/1/members/1') // Owner ID
        .send({ role: 'member' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('owner');
    });

    it('should return 404 if member not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // No current member
        .mockResolvedValueOnce({ rows: [] }); // Update returns nothing

      const response = await request(app)
        .put('/api/organizations/1/members/999')
        .send({ role: 'admin' });

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/organizations/:id/members/:userId/role', () => {
    it('should update member role via /role endpoint', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'member' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, role: 'admin' }] });

      const response = await request(app)
        .put('/api/organizations/1/members/2/role')
        .send({ role: 'admin' });

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/organizations/:id/members/:userId', () => {
    it('should remove member', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, user_id: 2, role: 'member', status: 'active' }]
      });

      const response = await request(app).delete('/api/organizations/1/members/2');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should prevent removing owner', async () => {
      const response = await request(app).delete('/api/organizations/1/members/1');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('owner');
    });

    it('should return 404 if member not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).delete('/api/organizations/1/members/999');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/organizations/:id/switch', () => {
    it('should switch organization', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ role: 'admin', name: 'Test Org', slug: 'test-org' }]
      });

      process.env.JWT_SECRET = 'test-secret';

      const response = await request(app)
        .post('/api/organizations/1/switch')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
    });

    it('should return 403 if not a member', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/organizations/999/switch')
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('not a member');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .post('/api/organizations/1/switch')
        .send({});

      expect(response.status).toBe(500);
    });
  });
});
