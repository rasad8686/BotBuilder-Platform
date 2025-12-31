/**
 * Roles API Routes Tests
 * Tests for enterprise RBAC - custom roles and permissions management
 */

const express = require('express');
const request = require('supertest');

// Mock dependencies
jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 'user-1', name: 'Test User' };
  next();
}));

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: jest.fn((req, res, next) => {
    req.organization = { id: 'org-1', name: 'Test Org' };
    next();
  }),
  requireOrganization: jest.fn((req, res, next) => next())
}));

jest.mock('../../middleware/checkPermission', () => ({
  checkPermission: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../../models/Role', () => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  findByName: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getAvailablePermissions: jest.fn(),
  getUsersByRole: jest.fn(),
  assignRoleToUser: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const Role = require('../../models/Role');
const rolesRouter = require('../../routes/roles');

describe('Roles API Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/roles', rolesRouter);
  });

  describe('GET /api/roles', () => {
    it('should return all roles', async () => {
      const mockRoles = [
        { id: 'role-1', name: 'Editor', permissions: { bots: { read: true, write: true } } },
        { id: 'role-2', name: 'Viewer', permissions: { bots: { read: true } } }
      ];
      Role.findAll.mockResolvedValue(mockRoles);

      const response = await request(app).get('/api/roles');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRoles);
    });

    it('should handle errors', async () => {
      Role.findAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/roles');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to fetch roles');
    });
  });

  describe('GET /api/roles/permissions', () => {
    it('should return available permissions', async () => {
      const mockPermissions = {
        bots: ['read', 'write', 'delete'],
        analytics: ['read'],
        team: ['read', 'write', 'manage']
      };
      Role.getAvailablePermissions.mockReturnValue(mockPermissions);

      const response = await request(app).get('/api/roles/permissions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPermissions);
    });

    it('should handle errors', async () => {
      Role.getAvailablePermissions.mockImplementation(() => {
        throw new Error('Failed to get permissions');
      });

      const response = await request(app).get('/api/roles/permissions');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/roles/:id', () => {
    it('should return role by ID', async () => {
      const mockRole = { id: 'role-1', name: 'Editor', permissions: {} };
      Role.findById.mockResolvedValue(mockRole);

      const response = await request(app).get('/api/roles/role-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRole);
    });

    it('should return 404 for non-existent role', async () => {
      Role.findById.mockResolvedValue(null);

      const response = await request(app).get('/api/roles/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Role not found');
    });

    it('should handle errors', async () => {
      Role.findById.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/roles/role-1');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/roles', () => {
    it('should create a new role', async () => {
      const newRole = {
        name: 'Custom Role',
        description: 'A custom role',
        permissions: { bots: { read: true } }
      };
      const createdRole = { id: 'role-new', ...newRole };

      Role.findByName.mockResolvedValue(null);
      Role.create.mockResolvedValue(createdRole);

      const response = await request(app)
        .post('/api/roles')
        .send(newRole);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(createdRole);
    });

    it('should return 400 if name is empty', async () => {
      const response = await request(app)
        .post('/api/roles')
        .send({ name: '', description: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Role name is required');
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post('/api/roles')
        .send({ description: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 if role name already exists', async () => {
      Role.findByName.mockResolvedValue({ id: 'existing', name: 'Editor' });

      const response = await request(app)
        .post('/api/roles')
        .send({ name: 'Editor', description: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('A role with this name already exists');
    });

    it('should reject reserved role names', async () => {
      Role.findByName.mockResolvedValue(null);

      const reservedNames = ['admin', 'member', 'viewer', 'owner', 'ADMIN', 'Member'];

      for (const name of reservedNames) {
        const response = await request(app)
          .post('/api/roles')
          .send({ name, description: 'Test' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Cannot create a role with a reserved name');
      }
    });

    it('should use default values for optional fields', async () => {
      Role.findByName.mockResolvedValue(null);
      Role.create.mockResolvedValue({ id: 'role-1', name: 'Test', description: '', permissions: {} });

      const response = await request(app)
        .post('/api/roles')
        .send({ name: 'Test' });

      expect(response.status).toBe(201);
      expect(Role.create).toHaveBeenCalledWith({
        name: 'Test',
        description: '',
        permissions: {}
      });
    });

    it('should handle creation errors', async () => {
      Role.findByName.mockResolvedValue(null);
      Role.create.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/roles')
        .send({ name: 'Test Role' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/roles/:id', () => {
    it('should update a role', async () => {
      const existingRole = { id: 'role-1', name: 'Editor', is_system: false };
      const updatedRole = { id: 'role-1', name: 'Senior Editor', permissions: {} };

      Role.findById.mockResolvedValue(existingRole);
      Role.findByName.mockResolvedValue(null);
      Role.update.mockResolvedValue(updatedRole);

      const response = await request(app)
        .put('/api/roles/role-1')
        .send({ name: 'Senior Editor' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(updatedRole);
    });

    it('should return 404 for non-existent role', async () => {
      Role.findById.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/roles/non-existent')
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Role not found');
    });

    it('should prevent renaming system roles', async () => {
      Role.findById.mockResolvedValue({ id: 'role-1', name: 'admin', is_system: true });

      const response = await request(app)
        .put('/api/roles/role-1')
        .send({ name: 'super-admin' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Cannot rename system roles');
    });

    it('should prevent duplicate role names', async () => {
      Role.findById.mockResolvedValue({ id: 'role-1', name: 'Editor', is_system: false });
      Role.findByName.mockResolvedValue({ id: 'role-2', name: 'Manager' });

      const response = await request(app)
        .put('/api/roles/role-1')
        .send({ name: 'Manager' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('A role with this name already exists');
    });

    it('should allow updating permissions without name change', async () => {
      const existingRole = { id: 'role-1', name: 'Editor', is_system: false };
      Role.findById.mockResolvedValue(existingRole);
      Role.update.mockResolvedValue({ ...existingRole, permissions: { bots: { read: true } } });

      const response = await request(app)
        .put('/api/roles/role-1')
        .send({ permissions: { bots: { read: true } } });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle update errors', async () => {
      Role.findById.mockResolvedValue({ id: 'role-1', name: 'Test', is_system: false });
      Role.update.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/roles/role-1')
        .send({ description: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/roles/:id', () => {
    it('should delete a custom role', async () => {
      Role.findById.mockResolvedValue({ id: 'role-1', name: 'Custom', is_system: false });
      Role.delete.mockResolvedValue(true);

      const response = await request(app).delete('/api/roles/role-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Role deleted successfully');
    });

    it('should return 404 for non-existent role', async () => {
      Role.findById.mockResolvedValue(null);

      const response = await request(app).delete('/api/roles/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should prevent deleting system roles', async () => {
      Role.findById.mockResolvedValue({ id: 'role-1', name: 'admin', is_system: true });

      const response = await request(app).delete('/api/roles/role-1');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Cannot delete system roles');
    });

    it('should handle delete errors', async () => {
      Role.findById.mockResolvedValue({ id: 'role-1', name: 'Test', is_system: false });
      Role.delete.mockRejectedValue(new Error('Database error'));

      const response = await request(app).delete('/api/roles/role-1');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/roles/:id/users', () => {
    it('should return users with a specific role', async () => {
      const mockUsers = [
        { id: 'user-1', name: 'User 1', email: 'user1@test.com' },
        { id: 'user-2', name: 'User 2', email: 'user2@test.com' }
      ];
      Role.findById.mockResolvedValue({ id: 'role-1', name: 'Editor' });
      Role.getUsersByRole.mockResolvedValue(mockUsers);

      const response = await request(app).get('/api/roles/role-1/users');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUsers);
    });

    it('should return 404 for non-existent role', async () => {
      Role.findById.mockResolvedValue(null);

      const response = await request(app).get('/api/roles/non-existent/users');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should handle errors', async () => {
      Role.findById.mockResolvedValue({ id: 'role-1', name: 'Editor' });
      Role.getUsersByRole.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/roles/role-1/users');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/roles/assign', () => {
    it('should assign role to user', async () => {
      const result = { user_id: 'user-1', role: 'editor', org_id: 'org-1' };
      Role.assignRoleToUser.mockResolvedValue(result);

      const response = await request(app)
        .post('/api/roles/assign')
        .send({ user_id: 'user-1', role_name: 'editor' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(result);
    });

    it('should return 400 if user_id is missing', async () => {
      const response = await request(app)
        .post('/api/roles/assign')
        .send({ role_name: 'editor' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('user_id and role_name are required');
    });

    it('should return 400 if role_name is missing', async () => {
      const response = await request(app)
        .post('/api/roles/assign')
        .send({ user_id: 'user-1' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('user_id and role_name are required');
    });

    it('should return 404 if user not found in organization', async () => {
      Role.assignRoleToUser.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/roles/assign')
        .send({ user_id: 'user-1', role_name: 'editor' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found in organization');
    });

    it('should handle assignment errors', async () => {
      Role.assignRoleToUser.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/roles/assign')
        .send({ user_id: 'user-1', role_name: 'editor' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});
