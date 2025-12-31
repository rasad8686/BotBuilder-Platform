/**
 * SCIM 2.0 API Routes Tests
 * Tests for RFC 7643 (SCIM Core Schema) and RFC 7644 (SCIM Protocol)
 */

const express = require('express');
const request = require('supertest');

// Mock dependencies
jest.mock('../../services/scimService', () => ({
  validateToken: jest.fn(),
  getServiceProviderConfig: jest.fn(),
  getResourceTypes: jest.fn(),
  getSchemas: jest.fn(),
  listUsers: jest.fn(),
  getUser: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  listGroups: jest.fn(),
  getGroup: jest.fn(),
  createGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const SCIMService = require('../../services/scimService');
const scimRouter = require('../../routes/scim');

describe('SCIM 2.0 API Routes', () => {
  let app;
  const validToken = 'valid-scim-token';
  const mockSsoConfig = { id: 'sso-1', scim_enabled: true, organization_id: 'org-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/scim/v2', scimRouter);

    // Default: valid token
    SCIMService.validateToken.mockImplementation((token) => {
      if (token === validToken) {
        return mockSsoConfig;
      }
      return null;
    });
  });

  describe('SCIM Authentication', () => {
    it('should reject requests without authorization header', async () => {
      const response = await request(app).get('/scim/v2/Users');

      expect(response.status).toBe(401);
      expect(response.body.schemas).toContain('urn:ietf:params:scim:api:messages:2.0:Error');
      expect(response.body.detail).toContain('Missing or invalid authorization header');
    });

    it('should reject requests with invalid bearer token format', async () => {
      const response = await request(app)
        .get('/scim/v2/Users')
        .set('Authorization', 'Basic invalid');

      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/scim/v2/Users')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.detail).toBe('Invalid or expired token');
    });

    it('should reject requests when SCIM is disabled', async () => {
      SCIMService.validateToken.mockResolvedValue({ id: 'sso-1', scim_enabled: false });

      const response = await request(app)
        .get('/scim/v2/Users')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(403);
      expect(response.body.detail).toBe('SCIM is not enabled for this configuration');
    });

    it('should handle auth errors', async () => {
      SCIMService.validateToken.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/scim/v2/Users')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(500);
      expect(response.body.detail).toBe('Authentication error');
    });
  });

  describe('Service Provider Configuration', () => {
    it('should return service provider config (no auth required)', async () => {
      const config = {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
        patch: { supported: true },
        bulk: { supported: false },
        filter: { supported: true }
      };
      SCIMService.getServiceProviderConfig.mockReturnValue(config);

      const response = await request(app).get('/scim/v2/ServiceProviderConfig');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(config);
      expect(response.headers['content-type']).toContain('application/scim+json');
    });

    it('should return resource types', async () => {
      const resourceTypes = {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        Resources: [
          { name: 'User', endpoint: '/Users' },
          { name: 'Group', endpoint: '/Groups' }
        ]
      };
      SCIMService.getResourceTypes.mockReturnValue(resourceTypes);

      const response = await request(app).get('/scim/v2/ResourceTypes');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(resourceTypes);
    });

    it('should return schemas', async () => {
      const schemas = {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        Resources: []
      };
      SCIMService.getSchemas.mockReturnValue(schemas);

      const response = await request(app).get('/scim/v2/Schemas');

      expect(response.status).toBe(200);
    });
  });

  describe('Users Endpoints', () => {
    describe('GET /Users', () => {
      it('should list users', async () => {
        const users = {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
          totalResults: 2,
          Resources: [
            { id: 'user-1', userName: 'john@example.com' },
            { id: 'user-2', userName: 'jane@example.com' }
          ]
        };
        SCIMService.listUsers.mockResolvedValue(users);

        const response = await request(app)
          .get('/scim/v2/Users')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(200);
        expect(response.body.totalResults).toBe(2);
      });

      it('should support pagination parameters', async () => {
        SCIMService.listUsers.mockResolvedValue({ Resources: [], totalResults: 0 });

        await request(app)
          .get('/scim/v2/Users?startIndex=10&count=25')
          .set('Authorization', `Bearer ${validToken}`);

        expect(SCIMService.listUsers).toHaveBeenCalledWith('sso-1', {
          filter: undefined,
          startIndex: 10,
          count: 25
        });
      });

      it('should support filter parameter', async () => {
        SCIMService.listUsers.mockResolvedValue({ Resources: [], totalResults: 0 });

        await request(app)
          .get('/scim/v2/Users?filter=userName%20eq%20%22john%22')
          .set('Authorization', `Bearer ${validToken}`);

        expect(SCIMService.listUsers).toHaveBeenCalledWith('sso-1', expect.objectContaining({
          filter: 'userName eq "john"'
        }));
      });

      it('should handle list errors', async () => {
        SCIMService.listUsers.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/scim/v2/Users')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(500);
      });
    });

    describe('GET /Users/:id', () => {
      it('should return user by ID', async () => {
        const user = { id: 'user-1', userName: 'john@example.com' };
        SCIMService.getUser.mockResolvedValue(user);

        const response = await request(app)
          .get('/scim/v2/Users/user-1')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(user);
      });

      it('should return 404 for non-existent user', async () => {
        SCIMService.getUser.mockResolvedValue(null);

        const response = await request(app)
          .get('/scim/v2/Users/non-existent')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(404);
        expect(response.body.detail).toBe('User not found');
      });

      it('should handle get errors', async () => {
        SCIMService.getUser.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/scim/v2/Users/user-1')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(500);
      });
    });

    describe('POST /Users', () => {
      it('should create user', async () => {
        const newUser = { userName: 'john@example.com', name: { givenName: 'John' } };
        const createdUser = { id: 'user-new', ...newUser };
        SCIMService.createUser.mockResolvedValue(createdUser);

        const response = await request(app)
          .post('/scim/v2/Users')
          .set('Authorization', `Bearer ${validToken}`)
          .send(newUser);

        expect(response.status).toBe(201);
        expect(response.body).toEqual(createdUser);
      });

      it('should return 409 for duplicate user', async () => {
        SCIMService.createUser.mockRejectedValue(new Error('User already exists'));

        const response = await request(app)
          .post('/scim/v2/Users')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ userName: 'existing@example.com' });

        expect(response.status).toBe(409);
        expect(response.body.scimType).toBe('uniqueness');
      });

      it('should return 400 for invalid user data', async () => {
        SCIMService.createUser.mockRejectedValue(new Error('Invalid data'));

        const response = await request(app)
          .post('/scim/v2/Users')
          .set('Authorization', `Bearer ${validToken}`)
          .send({});

        expect(response.status).toBe(400);
      });
    });

    describe('PUT /Users/:id', () => {
      it('should replace user', async () => {
        const userData = { userName: 'john@example.com', active: true };
        const updatedUser = { id: 'user-1', ...userData };
        SCIMService.updateUser.mockResolvedValue(updatedUser);

        const response = await request(app)
          .put('/scim/v2/Users/user-1')
          .set('Authorization', `Bearer ${validToken}`)
          .send(userData);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(updatedUser);
      });

      it('should return 404 for non-existent user', async () => {
        SCIMService.updateUser.mockRejectedValue(new Error('User not found'));

        const response = await request(app)
          .put('/scim/v2/Users/non-existent')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ userName: 'test' });

        expect(response.status).toBe(404);
      });

      it('should return 400 for invalid data', async () => {
        SCIMService.updateUser.mockRejectedValue(new Error('Invalid data'));

        const response = await request(app)
          .put('/scim/v2/Users/user-1')
          .set('Authorization', `Bearer ${validToken}`)
          .send({});

        expect(response.status).toBe(400);
      });
    });

    describe('PATCH /Users/:id', () => {
      it('should patch user with replace operation', async () => {
        SCIMService.getUser.mockResolvedValue({ id: 'user-1', userName: 'john@example.com', active: true });
        SCIMService.updateUser.mockResolvedValue({ id: 'user-1', userName: 'john@example.com', active: false });

        const response = await request(app)
          .patch('/scim/v2/Users/user-1')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
            Operations: [{ op: 'replace', path: 'active', value: false }]
          });

        expect(response.status).toBe(200);
      });

      it('should patch user with name attributes', async () => {
        SCIMService.getUser.mockResolvedValue({ id: 'user-1', userName: 'john@example.com' });
        SCIMService.updateUser.mockResolvedValue({ id: 'user-1', userName: 'john@example.com', name: { givenName: 'John' } });

        const response = await request(app)
          .patch('/scim/v2/Users/user-1')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            Operations: [
              { op: 'replace', path: 'name.givenName', value: 'John' },
              { op: 'replace', path: 'name.familyName', value: 'Doe' },
              { op: 'replace', path: 'displayName', value: 'John Doe' }
            ]
          });

        expect(response.status).toBe(200);
      });

      it('should patch user with bulk replace', async () => {
        SCIMService.getUser.mockResolvedValue({ id: 'user-1', userName: 'john@example.com' });
        SCIMService.updateUser.mockResolvedValue({ id: 'user-1', userName: 'john@example.com', active: false });

        const response = await request(app)
          .patch('/scim/v2/Users/user-1')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            Operations: [{ op: 'replace', value: { active: false } }]
          });

        expect(response.status).toBe(200);
      });

      it('should patch user with add operation', async () => {
        SCIMService.getUser.mockResolvedValue({ id: 'user-1', userName: 'john@example.com' });
        SCIMService.updateUser.mockResolvedValue({ id: 'user-1', userName: 'john@example.com' });

        const response = await request(app)
          .patch('/scim/v2/Users/user-1')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            Operations: [{ op: 'add', value: { displayName: 'John' } }]
          });

        expect(response.status).toBe(200);
      });

      it('should return 400 for missing Operations array', async () => {
        const response = await request(app)
          .patch('/scim/v2/Users/user-1')
          .set('Authorization', `Bearer ${validToken}`)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.detail).toContain('Operations array required');
      });

      it('should return 404 for non-existent user', async () => {
        SCIMService.getUser.mockResolvedValue(null);

        const response = await request(app)
          .patch('/scim/v2/Users/non-existent')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ Operations: [{ op: 'replace', path: 'active', value: false }] });

        expect(response.status).toBe(404);
      });

      it('should handle patch errors', async () => {
        SCIMService.getUser.mockResolvedValue({ id: 'user-1' });
        SCIMService.updateUser.mockRejectedValue(new Error('Update failed'));

        const response = await request(app)
          .patch('/scim/v2/Users/user-1')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ Operations: [{ op: 'replace', path: 'active', value: false }] });

        expect(response.status).toBe(400);
      });
    });

    describe('DELETE /Users/:id', () => {
      it('should delete user', async () => {
        SCIMService.deleteUser.mockResolvedValue(true);

        const response = await request(app)
          .delete('/scim/v2/Users/user-1')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(204);
      });

      it('should return 404 for non-existent user', async () => {
        SCIMService.deleteUser.mockRejectedValue(new Error('User not found'));

        const response = await request(app)
          .delete('/scim/v2/Users/non-existent')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(404);
      });

      it('should handle delete errors', async () => {
        SCIMService.deleteUser.mockRejectedValue(new Error('Delete failed'));

        const response = await request(app)
          .delete('/scim/v2/Users/user-1')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(400);
      });
    });
  });

  describe('Groups Endpoints', () => {
    describe('GET /Groups', () => {
      it('should list groups', async () => {
        const groups = {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
          totalResults: 1,
          Resources: [{ id: 'group-1', displayName: 'Admins' }]
        };
        SCIMService.listGroups.mockResolvedValue(groups);

        const response = await request(app)
          .get('/scim/v2/Groups')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(200);
        expect(response.body.totalResults).toBe(1);
      });

      it('should support pagination', async () => {
        SCIMService.listGroups.mockResolvedValue({ Resources: [], totalResults: 0 });

        await request(app)
          .get('/scim/v2/Groups?startIndex=5&count=10')
          .set('Authorization', `Bearer ${validToken}`);

        expect(SCIMService.listGroups).toHaveBeenCalledWith('sso-1', {
          filter: undefined,
          startIndex: 5,
          count: 10
        });
      });

      it('should handle list errors', async () => {
        SCIMService.listGroups.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/scim/v2/Groups')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(500);
      });
    });

    describe('GET /Groups/:id', () => {
      it('should return group by ID', async () => {
        const group = { id: 'group-1', displayName: 'Admins', members: [] };
        SCIMService.getGroup.mockResolvedValue(group);

        const response = await request(app)
          .get('/scim/v2/Groups/group-1')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(group);
      });

      it('should return 404 for non-existent group', async () => {
        SCIMService.getGroup.mockResolvedValue(null);

        const response = await request(app)
          .get('/scim/v2/Groups/non-existent')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(404);
        expect(response.body.detail).toBe('Group not found');
      });

      it('should handle get errors', async () => {
        SCIMService.getGroup.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/scim/v2/Groups/group-1')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(500);
      });
    });

    describe('POST /Groups', () => {
      it('should create group', async () => {
        const newGroup = { displayName: 'New Group' };
        const createdGroup = { id: 'group-new', ...newGroup };
        SCIMService.createGroup.mockResolvedValue(createdGroup);

        const response = await request(app)
          .post('/scim/v2/Groups')
          .set('Authorization', `Bearer ${validToken}`)
          .send(newGroup);

        expect(response.status).toBe(201);
        expect(response.body).toEqual(createdGroup);
      });

      it('should return 409 for duplicate group', async () => {
        SCIMService.createGroup.mockRejectedValue(new Error('Group already exists'));

        const response = await request(app)
          .post('/scim/v2/Groups')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ displayName: 'Existing' });

        expect(response.status).toBe(409);
        expect(response.body.scimType).toBe('uniqueness');
      });

      it('should return 400 for invalid data', async () => {
        SCIMService.createGroup.mockRejectedValue(new Error('Invalid data'));

        const response = await request(app)
          .post('/scim/v2/Groups')
          .set('Authorization', `Bearer ${validToken}`)
          .send({});

        expect(response.status).toBe(400);
      });
    });

    describe('PUT /Groups/:id', () => {
      it('should replace group', async () => {
        const groupData = { displayName: 'Updated Group', members: [] };
        const updatedGroup = { id: 'group-1', ...groupData };
        SCIMService.updateGroup.mockResolvedValue(updatedGroup);

        const response = await request(app)
          .put('/scim/v2/Groups/group-1')
          .set('Authorization', `Bearer ${validToken}`)
          .send(groupData);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(updatedGroup);
      });

      it('should return 404 for non-existent group', async () => {
        SCIMService.updateGroup.mockRejectedValue(new Error('Group not found'));

        const response = await request(app)
          .put('/scim/v2/Groups/non-existent')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ displayName: 'Test' });

        expect(response.status).toBe(404);
      });

      it('should return 400 for invalid data', async () => {
        SCIMService.updateGroup.mockRejectedValue(new Error('Invalid data'));

        const response = await request(app)
          .put('/scim/v2/Groups/group-1')
          .set('Authorization', `Bearer ${validToken}`)
          .send({});

        expect(response.status).toBe(400);
      });
    });

    describe('PATCH /Groups/:id', () => {
      it('should add members to group', async () => {
        SCIMService.getGroup.mockResolvedValue({ id: 'group-1', displayName: 'Admins', members: [] });
        SCIMService.updateGroup.mockResolvedValue({ id: 'group-1', displayName: 'Admins', members: [{ value: 'user-1' }] });

        const response = await request(app)
          .patch('/scim/v2/Groups/group-1')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            Operations: [{
              op: 'add',
              path: 'members',
              value: [{ value: 'user-1' }]
            }]
          });

        expect(response.status).toBe(200);
      });

      it('should remove member from group', async () => {
        SCIMService.getGroup.mockResolvedValue({
          id: 'group-1',
          displayName: 'Admins',
          members: [{ value: 'user-1' }, { value: 'user-2' }]
        });
        SCIMService.updateGroup.mockResolvedValue({
          id: 'group-1',
          displayName: 'Admins',
          members: [{ value: 'user-2' }]
        });

        const response = await request(app)
          .patch('/scim/v2/Groups/group-1')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            Operations: [{
              op: 'remove',
              path: 'members[value eq "user-1"]'
            }]
          });

        expect(response.status).toBe(200);
      });

      it('should replace group displayName', async () => {
        SCIMService.getGroup.mockResolvedValue({ id: 'group-1', displayName: 'Admins' });
        SCIMService.updateGroup.mockResolvedValue({ id: 'group-1', displayName: 'Super Admins' });

        const response = await request(app)
          .patch('/scim/v2/Groups/group-1')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            Operations: [{ op: 'replace', path: 'displayName', value: 'Super Admins' }]
          });

        expect(response.status).toBe(200);
      });

      it('should replace members', async () => {
        SCIMService.getGroup.mockResolvedValue({ id: 'group-1', displayName: 'Admins', members: [] });
        SCIMService.updateGroup.mockResolvedValue({ id: 'group-1', displayName: 'Admins', members: [{ value: 'user-1' }] });

        const response = await request(app)
          .patch('/scim/v2/Groups/group-1')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            Operations: [{ op: 'replace', path: 'members', value: [{ value: 'user-1' }] }]
          });

        expect(response.status).toBe(200);
      });

      it('should bulk replace group', async () => {
        SCIMService.getGroup.mockResolvedValue({ id: 'group-1', displayName: 'Admins' });
        SCIMService.updateGroup.mockResolvedValue({ id: 'group-1', displayName: 'New Name' });

        const response = await request(app)
          .patch('/scim/v2/Groups/group-1')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            Operations: [{ op: 'replace', value: { displayName: 'New Name' } }]
          });

        expect(response.status).toBe(200);
      });

      it('should not add duplicate members', async () => {
        SCIMService.getGroup.mockResolvedValue({
          id: 'group-1',
          displayName: 'Admins',
          members: [{ value: 'user-1' }]
        });
        SCIMService.updateGroup.mockResolvedValue({
          id: 'group-1',
          displayName: 'Admins',
          members: [{ value: 'user-1' }]
        });

        const response = await request(app)
          .patch('/scim/v2/Groups/group-1')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            Operations: [{ op: 'add', path: 'members', value: { value: 'user-1' } }]
          });

        expect(response.status).toBe(200);
      });

      it('should return 400 for missing Operations', async () => {
        const response = await request(app)
          .patch('/scim/v2/Groups/group-1')
          .set('Authorization', `Bearer ${validToken}`)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.detail).toContain('Operations array required');
      });

      it('should return 404 for non-existent group', async () => {
        SCIMService.getGroup.mockResolvedValue(null);

        const response = await request(app)
          .patch('/scim/v2/Groups/non-existent')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ Operations: [{ op: 'replace', path: 'displayName', value: 'Test' }] });

        expect(response.status).toBe(404);
      });

      it('should handle patch errors', async () => {
        SCIMService.getGroup.mockResolvedValue({ id: 'group-1', displayName: 'Admins' });
        SCIMService.updateGroup.mockRejectedValue(new Error('Update failed'));

        const response = await request(app)
          .patch('/scim/v2/Groups/group-1')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ Operations: [{ op: 'replace', path: 'displayName', value: 'Test' }] });

        expect(response.status).toBe(400);
      });
    });

    describe('DELETE /Groups/:id', () => {
      it('should delete group', async () => {
        SCIMService.deleteGroup.mockResolvedValue(true);

        const response = await request(app)
          .delete('/scim/v2/Groups/group-1')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(204);
      });

      it('should return 404 for non-existent group', async () => {
        SCIMService.deleteGroup.mockRejectedValue(new Error('Group not found'));

        const response = await request(app)
          .delete('/scim/v2/Groups/non-existent')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(404);
      });

      it('should handle delete errors', async () => {
        SCIMService.deleteGroup.mockRejectedValue(new Error('Delete failed'));

        const response = await request(app)
          .delete('/scim/v2/Groups/group-1')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(400);
      });
    });
  });

  describe('Bulk Operations', () => {
    it('should return 501 for bulk operations (not supported)', async () => {
      const response = await request(app)
        .post('/scim/v2/Bulk')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ Operations: [] });

      expect(response.status).toBe(501);
      expect(response.body.detail).toBe('Bulk operations not supported');
    });
  });
});
