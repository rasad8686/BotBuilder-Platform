/**
 * Comprehensive tests for workspaces routes
 * Tests workspace CRUD, member management, and resource management
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
const mockQuery = jest.fn();

jest.mock('../../db', () => ({
  query: (...args) => mockQuery(...args)
}));

jest.mock('../../middleware/auth', () => {
  return (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    next();
  };
});

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const workspacesRouter = require('../../routes/workspaces');

describe('Workspaces Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/workspaces', workspacesRouter);
  });

  describe('GET /api/workspaces', () => {
    it('should return empty array when user has no organization', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // org query

      const res = await request(app).get('/api/workspaces');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.workspaces).toEqual([]);
    });

    it('should return workspaces for user organization', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // org query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            name: 'Test Workspace',
            slug: 'test-workspace',
            description: 'Test description',
            settings: {},
            is_default: true,
            user_role: 'owner',
            created_by_name: 'Test User',
            member_count: '3',
            resource_count: '5',
            created_at: new Date().toISOString()
          }]
        });

      const res = await request(app).get('/api/workspaces');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.workspaces).toHaveLength(1);
      expect(res.body.workspaces[0].name).toBe('Test Workspace');
      expect(res.body.workspaces[0].memberCount).toBe(3);
      expect(res.body.workspaces[0].resourceCount).toBe(5);
    });

    it('should handle database errors gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/workspaces');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Failed to get workspaces');
    });
  });

  describe('POST /api/workspaces', () => {
    it('should require workspace name', async () => {
      const res = await request(app)
        .post('/api/workspaces')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Workspace name is required');
    });

    it('should return 400 if organization not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // org query

      const res = await request(app)
        .post('/api/workspaces')
        .send({ name: 'New Workspace' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Organization not found');
    });

    it('should create workspace successfully', async () => {
      const workspaceData = {
        id: 1,
        name: 'New Workspace',
        slug: 'new-workspace',
        description: '',
        settings: {},
        is_default: true
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // org query
        .mockResolvedValueOnce({ rows: [] }) // slug check
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // existing check
        .mockResolvedValueOnce({ rows: [workspaceData] }) // insert workspace
        .mockResolvedValueOnce({ rows: [] }); // insert member

      const res = await request(app)
        .post('/api/workspaces')
        .send({ name: 'New Workspace' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.workspace.name).toBe('New Workspace');
    });

    it('should generate unique slug when slug exists', async () => {
      const workspaceData = {
        id: 1,
        name: 'Test Workspace',
        slug: 'test-workspace-1',
        description: 'Description',
        settings: { theme: 'dark' },
        is_default: false
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // org query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // first slug exists
        .mockResolvedValueOnce({ rows: [] }) // second slug check
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // existing check (not first)
        .mockResolvedValueOnce({ rows: [workspaceData] }) // insert workspace
        .mockResolvedValueOnce({ rows: [] }); // insert member

      const res = await request(app)
        .post('/api/workspaces')
        .send({
          name: 'Test Workspace',
          description: 'Description',
          settings: { theme: 'dark' }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should handle database errors during creation', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // org query
        .mockRejectedValueOnce(new Error('Database error')); // slug check fails

      const res = await request(app)
        .post('/api/workspaces')
        .send({ name: 'New Workspace' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Failed to create workspace');
    });
  });

  describe('GET /api/workspaces/:id', () => {
    it('should return 403 if user has no access', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // access check

      const res = await request(app).get('/api/workspaces/1');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Access denied');
    });

    it('should return 404 if workspace not found', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'member' }] }) // access check
        .mockResolvedValueOnce({ rows: [] }); // workspace query

      const res = await request(app).get('/api/workspaces/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Workspace not found');
    });

    it('should return workspace with members and resources', async () => {
      const workspace = {
        id: 1,
        name: 'Test Workspace',
        slug: 'test-workspace',
        description: 'Test',
        settings: { theme: 'light' },
        is_default: true,
        created_by_name: 'Admin',
        created_at: new Date().toISOString()
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] }) // access check
        .mockResolvedValueOnce({ rows: [workspace] }) // workspace query
        .mockResolvedValueOnce({
          rows: [
            { user_id: 1, name: 'User 1', email: 'user1@test.com', role: 'owner', joined_at: new Date() },
            { user_id: 2, name: 'User 2', email: 'user2@test.com', role: 'editor', joined_at: new Date() }
          ]
        }) // members
        .mockResolvedValueOnce({
          rows: [
            { id: 1, resource_type: 'bot', resource_id: 100, created_at: new Date() }
          ]
        }); // resources

      const res = await request(app).get('/api/workspaces/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.workspace.name).toBe('Test Workspace');
      expect(res.body.workspace.members).toHaveLength(2);
      expect(res.body.workspace.resources).toHaveLength(1);
      expect(res.body.workspace.userRole).toBe('owner');
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/workspaces/1');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Failed to get workspace');
    });
  });

  describe('PUT /api/workspaces/:id', () => {
    it('should return 403 if user is not admin or owner', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'viewer' }] }); // access check

      const res = await request(app)
        .put('/api/workspaces/1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Admin access required');
    });

    it('should return 403 if user has no access', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // access check

      const res = await request(app)
        .put('/api/workspaces/1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 if no updates provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'owner' }] }); // access check

      const res = await request(app)
        .put('/api/workspaces/1')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('No updates provided');
    });

    it('should update workspace name', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] }) // access check
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated Name' }] }); // update

      const res = await request(app)
        .put('/api/workspaces/1')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.workspace.name).toBe('Updated Name');
    });

    it('should update workspace description and settings', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] }) // access check
        .mockResolvedValueOnce({ rows: [{ id: 1, description: 'New desc', settings: { theme: 'dark' } }] }); // update

      const res = await request(app)
        .put('/api/workspaces/1')
        .send({ description: 'New desc', settings: { theme: 'dark' } });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should handle database errors during update', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] }) // access check
        .mockRejectedValueOnce(new Error('Database error')); // update fails

      const res = await request(app)
        .put('/api/workspaces/1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Failed to update workspace');
    });
  });

  describe('DELETE /api/workspaces/:id', () => {
    it('should return 403 if user is not owner', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] }); // access check

      const res = await request(app).delete('/api/workspaces/1');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Only workspace owner can delete');
    });

    it('should return 400 if trying to delete default workspace', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] }) // access check
        .mockResolvedValueOnce({ rows: [{ is_default: true }] }); // workspace check

      const res = await request(app).delete('/api/workspaces/1');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Cannot delete default workspace');
    });

    it('should delete workspace successfully', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] }) // access check
        .mockResolvedValueOnce({ rows: [{ is_default: false }] }) // workspace check
        .mockResolvedValueOnce({ rows: [] }); // delete

      const res = await request(app).delete('/api/workspaces/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Workspace deleted');
    });

    it('should handle database errors during deletion', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] }) // access check
        .mockRejectedValueOnce(new Error('Database error')); // workspace check fails

      const res = await request(app).delete('/api/workspaces/1');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Failed to delete workspace');
    });
  });

  describe('POST /api/workspaces/:id/members', () => {
    it('should return 403 if user lacks admin access', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'viewer' }] }); // access check

      const res = await request(app)
        .post('/api/workspaces/1/members')
        .send({ email: 'new@test.com', role: 'editor' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Admin access required');
    });

    it('should return 404 if user not found', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] }) // access check
        .mockResolvedValueOnce({ rows: [] }); // user lookup

      const res = await request(app)
        .post('/api/workspaces/1/members')
        .send({ email: 'notfound@test.com', role: 'editor' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('User not found');
    });

    it('should return 400 if user is already a member', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] }) // access check
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'User', email: 'user@test.com' }] }) // user lookup
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // member check

      const res = await request(app)
        .post('/api/workspaces/1/members')
        .send({ email: 'user@test.com', role: 'editor' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('User is already a member');
    });

    it('should return 400 for invalid role', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] }) // access check
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'User', email: 'user@test.com' }] }) // user lookup
        .mockResolvedValueOnce({ rows: [] }); // member check

      const res = await request(app)
        .post('/api/workspaces/1/members')
        .send({ email: 'user@test.com', role: 'superadmin' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid role');
    });

    it('should add member successfully', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] }) // access check
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'New User', email: 'new@test.com' }] }) // user lookup
        .mockResolvedValueOnce({ rows: [] }) // member check
        .mockResolvedValueOnce({ rows: [] }); // insert member

      const res = await request(app)
        .post('/api/workspaces/1/members')
        .send({ email: 'new@test.com', role: 'editor' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.member.name).toBe('New User');
      expect(res.body.member.role).toBe('editor');
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/workspaces/1/members')
        .send({ email: 'test@test.com', role: 'editor' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Failed to add member');
    });
  });

  describe('PUT /api/workspaces/:id/members/:memberId', () => {
    it('should return 403 if user is not owner', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] }); // access check

      const res = await request(app)
        .put('/api/workspaces/1/members/2')
        .send({ role: 'editor' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Owner access required');
    });

    it('should return 400 when trying to change owner role', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] }) // access check
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] }); // target check

      const res = await request(app)
        .put('/api/workspaces/1/members/2')
        .send({ role: 'editor' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Cannot change owner role');
    });

    it('should return 400 for invalid role', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] }) // access check
        .mockResolvedValueOnce({ rows: [{ role: 'editor' }] }); // target check

      const res = await request(app)
        .put('/api/workspaces/1/members/2')
        .send({ role: 'superadmin' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid role');
    });

    it('should update member role successfully', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] }) // access check
        .mockResolvedValueOnce({ rows: [{ role: 'editor' }] }) // target check
        .mockResolvedValueOnce({ rows: [] }); // update

      const res = await request(app)
        .put('/api/workspaces/1/members/2')
        .send({ role: 'admin' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Member role updated');
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .put('/api/workspaces/1/members/2')
        .send({ role: 'editor' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Failed to update member role');
    });
  });

  describe('DELETE /api/workspaces/:id/members/:memberId', () => {
    it('should return 403 if user lacks permission', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'viewer' }] }); // access check

      const res = await request(app).delete('/api/workspaces/1/members/2');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Access denied');
    });

    it('should return 400 when trying to remove owner', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] }) // access check
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] }); // target check

      const res = await request(app).delete('/api/workspaces/1/members/2');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Cannot remove workspace owner');
    });

    it('should allow user to remove themselves', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'editor' }] }) // access check (self)
        .mockResolvedValueOnce({ rows: [{ role: 'editor' }] }) // target check
        .mockResolvedValueOnce({ rows: [] }); // delete

      const res = await request(app).delete('/api/workspaces/1/members/1'); // self

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Member removed');
    });

    it('should allow owner to remove members', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] }) // access check
        .mockResolvedValueOnce({ rows: [{ role: 'editor' }] }) // target check
        .mockResolvedValueOnce({ rows: [] }); // delete

      const res = await request(app).delete('/api/workspaces/1/members/2');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Member removed');
    });

    it('should allow admin to remove non-admin members', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] }) // access check
        .mockResolvedValueOnce({ rows: [{ role: 'viewer' }] }) // target check
        .mockResolvedValueOnce({ rows: [] }); // delete

      const res = await request(app).delete('/api/workspaces/1/members/3');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).delete('/api/workspaces/1/members/2');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Failed to remove member');
    });
  });

  describe('POST /api/workspaces/:id/resources', () => {
    it('should return 403 if user lacks editor access', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'viewer' }] }); // access check

      const res = await request(app)
        .post('/api/workspaces/1/resources')
        .send({ resourceType: 'bot', resourceId: 1 });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Editor access required');
    });

    it('should return 400 for invalid resource type', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'editor' }] }); // access check

      const res = await request(app)
        .post('/api/workspaces/1/resources')
        .send({ resourceType: 'invalid', resourceId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid resource type');
    });

    it('should return 400 if resource already in workspace', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'editor' }] }) // access check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // existing check

      const res = await request(app)
        .post('/api/workspaces/1/resources')
        .send({ resourceType: 'bot', resourceId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Resource already in workspace');
    });

    it('should add bot resource and update workspace_id', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] }) // access check
        .mockResolvedValueOnce({ rows: [] }) // existing check
        .mockResolvedValueOnce({ rows: [{ id: 1, workspace_id: 1, resource_type: 'bot', resource_id: 100 }] }) // insert
        .mockResolvedValueOnce({ rows: [] }); // update bot

      const res = await request(app)
        .post('/api/workspaces/1/resources')
        .send({ resourceType: 'bot', resourceId: 100 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.resource.resource_type).toBe('bot');
    });

    it('should add api_token resource and update workspace_id', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] }) // access check
        .mockResolvedValueOnce({ rows: [] }) // existing check
        .mockResolvedValueOnce({ rows: [{ id: 2, workspace_id: 1, resource_type: 'api_token', resource_id: 50 }] }) // insert
        .mockResolvedValueOnce({ rows: [] }); // update token

      const res = await request(app)
        .post('/api/workspaces/1/resources')
        .send({ resourceType: 'api_token', resourceId: 50 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should add webhook resource without update', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'editor' }] }) // access check
        .mockResolvedValueOnce({ rows: [] }) // existing check
        .mockResolvedValueOnce({ rows: [{ id: 3, workspace_id: 1, resource_type: 'webhook', resource_id: 25 }] }); // insert

      const res = await request(app)
        .post('/api/workspaces/1/resources')
        .send({ resourceType: 'webhook', resourceId: 25 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should add integration resource', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'editor' }] }) // access check
        .mockResolvedValueOnce({ rows: [] }) // existing check
        .mockResolvedValueOnce({ rows: [{ id: 4, workspace_id: 1, resource_type: 'integration', resource_id: 10 }] }); // insert

      const res = await request(app)
        .post('/api/workspaces/1/resources')
        .send({ resourceType: 'integration', resourceId: 10 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/workspaces/1/resources')
        .send({ resourceType: 'bot', resourceId: 1 });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Failed to add resource');
    });
  });

  describe('DELETE /api/workspaces/:id/resources/:resourceId', () => {
    it('should return 403 if user lacks editor access', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'viewer' }] }); // access check

      const res = await request(app).delete('/api/workspaces/1/resources/1');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Editor access required');
    });

    it('should remove bot resource and clear workspace_id', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'editor' }] }) // access check
        .mockResolvedValueOnce({ rows: [{ resource_type: 'bot', resource_id: 100 }] }) // resource info
        .mockResolvedValueOnce({ rows: [] }) // clear bot workspace_id
        .mockResolvedValueOnce({ rows: [] }); // delete resource

      const res = await request(app).delete('/api/workspaces/1/resources/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Resource removed');
    });

    it('should remove api_token resource and clear workspace_id', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] }) // access check
        .mockResolvedValueOnce({ rows: [{ resource_type: 'api_token', resource_id: 50 }] }) // resource info
        .mockResolvedValueOnce({ rows: [] }) // clear token workspace_id
        .mockResolvedValueOnce({ rows: [] }); // delete resource

      const res = await request(app).delete('/api/workspaces/1/resources/2');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should remove webhook resource without clearing workspace_id', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] }) // access check
        .mockResolvedValueOnce({ rows: [{ resource_type: 'webhook', resource_id: 25 }] }) // resource info
        .mockResolvedValueOnce({ rows: [] }); // delete resource

      const res = await request(app).delete('/api/workspaces/1/resources/3');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should handle non-existent resource gracefully', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: 'editor' }] }) // access check
        .mockResolvedValueOnce({ rows: [] }) // resource not found
        .mockResolvedValueOnce({ rows: [] }); // delete (no-op)

      const res = await request(app).delete('/api/workspaces/1/resources/999');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).delete('/api/workspaces/1/resources/1');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Failed to remove resource');
    });
  });
});
