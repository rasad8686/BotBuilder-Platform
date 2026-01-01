/**
 * Comprehensive User Routes Tests
 * Tests for server/routes/users.js
 *
 * Coverage includes:
 * - User listing with pagination, search, and filtering
 * - User retrieval by ID
 * - User updates with validation
 * - User deletion with self-deletion prevention
 * - Current user profile management
 * - User invitations
 * - Role management
 * - Error handling
 * - Input validation
 * - Organization context
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = {
    id: 1,
    email: 'test@example.com',
    current_organization_id: 1,
    organization_id: 1
  };
  next();
}));

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: jest.fn((req, res, next) => {
    req.organization = {
      id: 1,
      name: 'Test Org',
      role: 'admin'
    };
    next();
  })
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
const usersRouter = require('../../routes/users');
const logger = require('../../utils/logger');

const app = express();
app.use(express.json());
app.use('/api/users', usersRouter);

describe('User Routes - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // GET /api/users - List Users
  // ============================================================================
  describe('GET /api/users - List Users', () => {
    it('should list users with default pagination', async () => {
      const mockUsers = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          email_verified: true,
          role: 'admin',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
          joined_at: new Date()
        },
        {
          id: 2,
          name: 'Jane Smith',
          email: 'jane@example.com',
          email_verified: true,
          role: 'member',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
          joined_at: new Date()
        }
      ];

      db.query
        .mockResolvedValueOnce({ rows: mockUsers }) // Users query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }); // Count query

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(2);
      expect(response.body.data.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        pages: 1
      });
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should paginate users correctly', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '50' }] });

      const response = await request(app)
        .get('/api/users')
        .query({ page: 2, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.data.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 50,
        pages: 5
      });
    });

    it('should enforce maximum limit of 100', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const response = await request(app)
        .get('/api/users')
        .query({ limit: 500 });

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.limit).toBe(100);
    });

    it('should filter users by search term (email)', async () => {
      const mockUsers = [{
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'member',
        status: 'active'
      }];

      db.query
        .mockResolvedValueOnce({ rows: mockUsers })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const response = await request(app)
        .get('/api/users')
        .query({ search: 'john@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.data.users).toHaveLength(1);
      expect(db.query.mock.calls[0][1]).toContain('%john@example.com%');
    });

    it('should filter users by search term (name)', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const response = await request(app)
        .get('/api/users')
        .query({ search: 'John' });

      expect(response.status).toBe(200);
      expect(db.query.mock.calls[0][1]).toContain('%John%');
    });

    it('should filter users by role', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const response = await request(app)
        .get('/api/users')
        .query({ role: 'admin' });

      expect(response.status).toBe(200);
      expect(db.query.mock.calls[0][1]).toContain('admin');
    });

    it('should filter users by status', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const response = await request(app)
        .get('/api/users')
        .query({ status: 'inactive' });

      expect(response.status).toBe(200);
      expect(db.query.mock.calls[0][1]).toContain('inactive');
    });

    it('should combine multiple filters', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const response = await request(app)
        .get('/api/users')
        .query({ search: 'john', role: 'admin', status: 'active' });

      expect(response.status).toBe(200);
      const queryParams = db.query.mock.calls[0][1];
      expect(queryParams).toContain('%john%');
      expect(queryParams).toContain('admin');
      expect(queryParams).toContain('active');
    });

    it('should handle empty results', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(200);
      expect(response.body.data.users).toHaveLength(0);
      expect(response.body.data.pagination.total).toBe(0);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to list users');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // GET /api/users/me - Get Current User Profile
  // ============================================================================
  describe('GET /api/users/me - Get Current User Profile', () => {
    it('should return current user profile', async () => {
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        email_verified: true,
        avatar_url: 'https://example.com/avatar.jpg',
        timezone: 'UTC',
        language: 'en',
        two_factor_enabled: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      db.query.mockResolvedValueOnce({ rows: [mockUser] });

      const response = await request(app).get('/api/users/me');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: 1,
        name: 'Test User',
        email: 'test@example.com'
      });
    });

    it('should return 404 if user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/users/me');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/users/me');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch user profile');
    });
  });

  // ============================================================================
  // PUT /api/users/me - Update Current User Profile
  // ============================================================================
  describe('PUT /api/users/me - Update Current User Profile', () => {
    it('should update user name', async () => {
      const mockUpdatedUser = {
        id: 1,
        name: 'Updated Name',
        email: 'test@example.com',
        avatar_url: null,
        timezone: 'UTC',
        language: 'en',
        updated_at: new Date()
      };

      db.query.mockResolvedValueOnce({ rows: [mockUpdatedUser] });

      const response = await request(app)
        .put('/api/users/me')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
    });

    it('should update avatar URL', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ avatar_url: 'new-url.jpg' }] });

      const response = await request(app)
        .put('/api/users/me')
        .send({ avatar_url: 'new-url.jpg' });

      expect(response.status).toBe(200);
    });

    it('should update timezone', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ timezone: 'America/New_York' }] });

      const response = await request(app)
        .put('/api/users/me')
        .send({ timezone: 'America/New_York' });

      expect(response.status).toBe(200);
    });

    it('should update language', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ language: 'es' }] });

      const response = await request(app)
        .put('/api/users/me')
        .send({ language: 'es' });

      expect(response.status).toBe(200);
    });

    it('should update multiple fields', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          name: 'New Name',
          timezone: 'Europe/London',
          language: 'fr'
        }]
      });

      const response = await request(app)
        .put('/api/users/me')
        .send({
          name: 'New Name',
          timezone: 'Europe/London',
          language: 'fr'
        });

      expect(response.status).toBe(200);
    });

    it('should trim whitespace from name', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ name: 'Trimmed' }] });

      const response = await request(app)
        .put('/api/users/me')
        .send({ name: '  Trimmed  ' });

      expect(response.status).toBe(200);
      expect(db.query.mock.calls[0][1][0]).toBe('Trimmed');
    });

    it('should reject empty name', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .send({ name: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Name cannot be empty');
    });

    it('should reject whitespace-only name', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .send({ name: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Name cannot be empty');
    });

    it('should reject name that is too long', async () => {
      const longName = 'a'.repeat(256);

      const response = await request(app)
        .put('/api/users/me')
        .send({ name: longName });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Name is too long');
    });

    it('should reject request with no valid fields', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No valid fields to update');
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .put('/api/users/me')
        .send({ name: 'Test' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update user profile');
    });
  });

  // ============================================================================
  // GET /api/users/:id - Get User by ID
  // ============================================================================
  describe('GET /api/users/:id - Get User by ID', () => {
    it('should return user by ID', async () => {
      const mockUser = {
        id: 2,
        name: 'Jane Doe',
        email: 'jane@example.com',
        email_verified: true,
        avatar_url: null,
        role: 'member',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        joined_at: new Date()
      };

      db.query.mockResolvedValueOnce({ rows: [mockUser] });

      const response = await request(app).get('/api/users/2');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: 2,
        name: 'Jane Doe',
        email: 'jane@example.com'
      });
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        ['2', 1]
      );
    });

    it('should return 404 if user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/users/999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });

    it('should verify user belongs to organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/users/5');

      expect(response.status).toBe(404);
      expect(db.query.mock.calls[0][1]).toContain(1); // organization_id
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/users/2');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch user');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // PUT /api/users/:id - Update User
  // ============================================================================
  describe('PUT /api/users/:id - Update User', () => {
    it('should update user name', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Check user exists
        .mockResolvedValueOnce({ rows: [{
          id: 2,
          name: 'Updated Name',
          email: 'user@example.com',
          email_verified: true,
          updated_at: new Date()
        }] }); // Update

      const response = await request(app)
        .put('/api/users/2')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
    });

    it('should update user email', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Check user exists
        .mockResolvedValueOnce({ rows: [] }) // Email not in use
        .mockResolvedValueOnce({ rows: [{
          id: 2,
          name: 'User',
          email: 'newemail@example.com',
          email_verified: false,
          updated_at: new Date()
        }] }); // Update

      const response = await request(app)
        .put('/api/users/2')
        .send({ email: 'newemail@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.data.email).toBe('newemail@example.com');
      expect(response.body.data.email_verified).toBe(false);
    });

    it('should update both name and email', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{
          id: 2,
          name: 'New Name',
          email: 'new@example.com'
        }] });

      const response = await request(app)
        .put('/api/users/2')
        .send({ name: 'New Name', email: 'new@example.com' });

      expect(response.status).toBe(200);
    });

    it('should return 404 if user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/users/999')
        .send({ name: 'Test' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should reject empty name', async () => {
      const response = await request(app)
        .put('/api/users/2')
        .send({ name: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Name cannot be empty');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .put('/api/users/2')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid email address');
    });

    it('should reject email that is already in use', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [{ id: 3 }] }); // Email exists for another user

      const response = await request(app)
        .put('/api/users/2')
        .send({ email: 'existing@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email already in use');
    });

    it('should allow updating to same email', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [] }) // No other user has this email
        .mockResolvedValueOnce({ rows: [{ id: 2, email: 'same@example.com' }] });

      const response = await request(app)
        .put('/api/users/2')
        .send({ email: 'same@example.com' });

      expect(response.status).toBe(200);
    });

    it('should reject request with no valid fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 2 }] });

      const response = await request(app)
        .put('/api/users/2')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No valid fields to update');
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .put('/api/users/2')
        .send({ name: 'Test' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update user');
    });
  });

  // ============================================================================
  // DELETE /api/users/:id - Delete User
  // ============================================================================
  describe('DELETE /api/users/:id - Delete User', () => {
    it('should delete user successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2, role: 'member' }] }) // Check user
        .mockResolvedValueOnce({ rows: [] }); // Delete

      const response = await request(app).delete('/api/users/2');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User removed from organization');
    });

    it('should prevent self-deletion', async () => {
      const response = await request(app).delete('/api/users/1');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cannot delete yourself');
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should return 404 if user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).delete('/api/users/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should verify user belongs to organization before deletion', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).delete('/api/users/5');

      expect(response.status).toBe(404);
      expect(db.query.mock.calls[0][1]).toContain(1); // organization_id
    });

    it('should perform soft delete (update status)', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2, role: 'member' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).delete('/api/users/2');

      expect(response.status).toBe(200);
      expect(db.query.mock.calls[1][0]).toContain('UPDATE');
      expect(db.query.mock.calls[1][0]).toContain('status');
      expect(db.query.mock.calls[1][1]).toContain(2);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).delete('/api/users/2');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete user');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // POST /api/users/invite - Invite User
  // ============================================================================
  describe('POST /api/users/invite - Invite User', () => {
    it('should send invitation successfully', async () => {
      const mockInvitation = {
        id: 1,
        email: 'newuser@example.com',
        role: 'member',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      db.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing member
        .mockResolvedValueOnce({ rows: [] }) // Check pending invite
        .mockResolvedValueOnce({ rows: [mockInvitation] }); // Create invitation

      const response = await request(app)
        .post('/api/users/invite')
        .send({ email: 'newuser@example.com', role: 'member' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Invitation sent successfully');
      expect(response.body.data.email).toBe('newuser@example.com');
    });

    it('should use default role if not provided', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, role: 'member' }] });

      const response = await request(app)
        .post('/api/users/invite')
        .send({ email: 'user@example.com' });

      expect(response.status).toBe(201);
      expect(db.query.mock.calls[2][1]).toContain('member');
    });

    it('should accept admin role', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, role: 'admin' }] });

      const response = await request(app)
        .post('/api/users/invite')
        .send({ email: 'admin@example.com', role: 'admin' });

      expect(response.status).toBe(201);
    });

    it('should accept viewer role', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, role: 'viewer' }] });

      const response = await request(app)
        .post('/api/users/invite')
        .send({ email: 'viewer@example.com', role: 'viewer' });

      expect(response.status).toBe(201);
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/api/users/invite')
        .send({ role: 'member' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Valid email is required');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/users/invite')
        .send({ email: 'invalid-email', role: 'member' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Valid email is required');
    });

    it('should reject invalid role', async () => {
      const response = await request(app)
        .post('/api/users/invite')
        .send({ email: 'user@example.com', role: 'superuser' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid role');
    });

    it('should reject if user already a member', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // User exists

      const response = await request(app)
        .post('/api/users/invite')
        .send({ email: 'existing@example.com', role: 'member' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('User is already a member of this organization');
    });

    it('should reject if pending invitation exists', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // User not a member
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Pending invite exists

      const response = await request(app)
        .post('/api/users/invite')
        .send({ email: 'pending@example.com', role: 'member' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('A pending invitation already exists for this email');
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .post('/api/users/invite')
        .send({ email: 'user@example.com', role: 'member' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to send invitation');
    });
  });

  // ============================================================================
  // PUT /api/users/:id/role - Change User Role
  // ============================================================================
  describe('PUT /api/users/:id/role - Change User Role', () => {
    it('should change user role to admin', async () => {
      const mockResult = {
        user_id: 2,
        role: 'admin',
        updated_at: new Date()
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, role: 'member' }] }) // Check user
        .mockResolvedValueOnce({ rows: [mockResult] }); // Update role

      const response = await request(app)
        .put('/api/users/2/role')
        .send({ role: 'admin' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Role updated successfully');
      expect(response.body.data.role).toBe('admin');
    });

    it('should change user role to member', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, role: 'admin' }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 2, role: 'member' }] });

      const response = await request(app)
        .put('/api/users/2/role')
        .send({ role: 'member' });

      expect(response.status).toBe(200);
    });

    it('should change user role to viewer', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, role: 'member' }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 2, role: 'viewer' }] });

      const response = await request(app)
        .put('/api/users/2/role')
        .send({ role: 'viewer' });

      expect(response.status).toBe(200);
    });

    it('should prevent changing own role', async () => {
      const response = await request(app)
        .put('/api/users/1/role')
        .send({ role: 'viewer' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot change your own role');
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should return 404 if user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/users/999/role')
        .send({ role: 'admin' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should reject missing role', async () => {
      const response = await request(app)
        .put('/api/users/2/role')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid role');
    });

    it('should reject invalid role', async () => {
      const response = await request(app)
        .put('/api/users/2/role')
        .send({ role: 'superadmin' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid role');
    });

    it('should verify user belongs to organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/users/5/role')
        .send({ role: 'admin' });

      expect(response.status).toBe(404);
      expect(db.query.mock.calls[0][1]).toContain(1); // organization_id
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .put('/api/users/2/role')
        .send({ role: 'admin' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to change user role');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Edge Cases and Additional Tests
  // ============================================================================
  describe('Edge Cases and Additional Tests', () => {
    describe('Pagination edge cases', () => {
      it('should handle page 0 as page 1', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] });

        const response = await request(app)
          .get('/api/users')
          .query({ page: 0 });

        expect(response.status).toBe(200);
        // Page 0 is treated as 1 due to parseInt defaulting
        expect(response.body.data.pagination.page).toBe(1);
      });

      it('should handle negative page numbers', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] });

        const response = await request(app)
          .get('/api/users')
          .query({ page: -5 });

        expect(response.status).toBe(200);
      });

      it('should handle non-numeric page', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] });

        const response = await request(app)
          .get('/api/users')
          .query({ page: 'abc' });

        expect(response.status).toBe(200);
        expect(response.body.data.pagination.page).toBe(1);
      });

      it('should handle non-numeric limit', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] });

        const response = await request(app)
          .get('/api/users')
          .query({ limit: 'xyz' });

        expect(response.status).toBe(200);
        expect(response.body.data.pagination.limit).toBe(20);
      });
    });

    describe('SQL injection protection', () => {
      it('should handle malicious search input', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] });

        const response = await request(app)
          .get('/api/users')
          .query({ search: "'; DROP TABLE users; --" });

        expect(response.status).toBe(200);
        // Should use parameterized query - verify the malicious input is escaped
        const queryParams = db.query.mock.calls[0][1];
        expect(queryParams.some(param =>
          typeof param === 'string' && param.includes("'; DROP TABLE users; --")
        )).toBe(true);
      });

      it('should handle malicious role filter', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] });

        const response = await request(app)
          .get('/api/users')
          .query({ role: "admin' OR '1'='1" });

        expect(response.status).toBe(200);
      });
    });

    describe('Special characters in input', () => {
      it('should handle special characters in name', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ name: "O'Brien" }] });

        const response = await request(app)
          .put('/api/users/me')
          .send({ name: "O'Brien" });

        expect(response.status).toBe(200);
      });

      it('should handle unicode characters in name', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ name: '李明' }] });

        const response = await request(app)
          .put('/api/users/me')
          .send({ name: '李明' });

        expect(response.status).toBe(200);
      });

      it('should handle emoji in name', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ name: 'John 😀' }] });

        const response = await request(app)
          .put('/api/users/me')
          .send({ name: 'John 😀' });

        expect(response.status).toBe(200);
      });
    });

    describe('Concurrent request handling', () => {
      it('should handle multiple simultaneous list requests', async () => {
        db.query
          .mockResolvedValue({ rows: [] })
          .mockResolvedValue({ rows: [{ count: '0' }] });

        const requests = Array(5).fill(null).map(() =>
          request(app).get('/api/users')
        );

        const responses = await Promise.all(requests);

        responses.forEach(response => {
          expect(response.status).toBe(200);
        });
      });
    });

    describe('Large dataset handling', () => {
      it('should handle large number of users in count', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '999999' }] });

        const response = await request(app).get('/api/users');

        expect(response.status).toBe(200);
        expect(response.body.data.pagination.total).toBe(999999);
        expect(response.body.data.pagination.pages).toBe(50000);
      });
    });
  });
});
