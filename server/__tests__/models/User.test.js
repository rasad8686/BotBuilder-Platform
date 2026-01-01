/**
 * User Model Tests
 * Tests for server/models/User.js
 */

// Mock the database BEFORE importing the model
jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const User = require('../../models/User');

describe('User Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // create()
  // ========================================
  describe('create()', () => {
    it('should create a new user with all required fields', async () => {
      const mockUserRow = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        password_hash: 'hashed_password',
        avatar_url: null,
        is_active: true,
        email_verified: false
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT
        .mockResolvedValueOnce({ rows: [mockUserRow] }); // SELECT for findById

      const result = await User.create({
        name: 'John Doe',
        email: 'john@example.com',
        password_hash: 'hashed_password'
      });

      expect(result.id).toBe(1);
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should set is_active to true by default', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, is_active: true }] });

      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password_hash: 'hash'
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][4]).toBe(true); // is_active should be true
    });

    it('should allow is_active to be set to false', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, is_active: false }] });

      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password_hash: 'hash',
        is_active: false
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][4]).toBe(false);
    });

    it('should set email_verified to false by default', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, email_verified: false }] });

      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password_hash: 'hash'
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][5]).toBe(false); // email_verified should be false
    });

    it('should allow email_verified to be set to true', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, email_verified: true }] });

      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password_hash: 'hash',
        email_verified: true
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][5]).toBe(true);
    });

    it('should set avatar_url to null if not provided', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, avatar_url: null }] });

      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password_hash: 'hash'
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][3]).toBeNull(); // avatar_url should be null
    });

    it('should accept custom avatar_url', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, avatar_url: 'https://example.com/avatar.jpg' }] });

      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password_hash: 'hash',
        avatar_url: 'https://example.com/avatar.jpg'
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][3]).toBe('https://example.com/avatar.jpg');
    });
  });

  // ========================================
  // findById()
  // ========================================
  describe('findById()', () => {
    it('should return user if found', async () => {
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com'
      };
      db.query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await User.findById(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('John Doe');
      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL',
        [1]
      );
    });

    it('should return null if user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await User.findById(999);

      expect(result).toBeNull();
    });

    it('should exclude deleted users', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await User.findById(1);

      expect(db.query.mock.calls[0][0]).toContain('deleted_at IS NULL');
    });
  });

  // ========================================
  // findByEmail()
  // ========================================
  describe('findByEmail()', () => {
    it('should return user if found by email', async () => {
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com'
      };
      db.query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await User.findByEmail('john@example.com');

      expect(result.id).toBe(1);
      expect(result.email).toBe('john@example.com');
      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL',
        ['john@example.com']
      );
    });

    it('should return null if email not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await User.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should exclude deleted users', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await User.findByEmail('test@example.com');

      expect(db.query.mock.calls[0][0]).toContain('deleted_at IS NULL');
    });
  });

  // ========================================
  // findAll()
  // ========================================
  describe('findAll()', () => {
    it('should return all users with default pagination', async () => {
      const mockUsers = [
        { id: 1, name: 'User 1', email: 'user1@example.com' },
        { id: 2, name: 'User 2', email: 'user2@example.com' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockUsers });

      const result = await User.findAll();

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at IS NULL'),
        [10, 0] // default limit and offset
      );
    });

    it('should support custom pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await User.findAll({ limit: 20, offset: 10 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [20, 10]
      );
    });

    it('should return empty array if no users', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await User.findAll();

      expect(result).toEqual([]);
    });

    it('should order by created_at DESC', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await User.findAll();

      expect(db.query.mock.calls[0][0]).toContain('ORDER BY created_at DESC');
    });
  });

  // ========================================
  // findByOrganization()
  // ========================================
  describe('findByOrganization()', () => {
    it('should return users for a specific organization', async () => {
      const mockUsers = [
        { id: 1, name: 'User 1', email: 'user1@example.com' },
        { id: 2, name: 'User 2', email: 'user2@example.com' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockUsers });

      const result = await User.findByOrganization(5);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('om.org_id = $1'),
        [5, 10, 0]
      );
    });

    it('should join with organization_members table', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await User.findByOrganization(5);

      expect(db.query.mock.calls[0][0]).toContain('JOIN organization_members');
    });

    it('should support pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await User.findByOrganization(5, { limit: 15, offset: 5 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [5, 15, 5]
      );
    });

    it('should return empty array if organization has no users', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await User.findByOrganization(999);

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // search()
  // ========================================
  describe('search()', () => {
    it('should search users by name', async () => {
      const mockUsers = [
        { id: 1, name: 'John Doe', email: 'john@example.com' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockUsers });

      const result = await User.search('john');

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('name ILIKE $1 OR email ILIKE $1'),
        ['%john%', 10, 0]
      );
    });

    it('should search users by email', async () => {
      const mockUsers = [
        { id: 1, name: 'John Doe', email: 'john@example.com' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockUsers });

      const result = await User.search('example.com');

      expect(result).toHaveLength(1);
      expect(db.query.mock.calls[0][1][0]).toBe('%example.com%');
    });

    it('should be case-insensitive', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await User.search('JOHN');

      expect(db.query.mock.calls[0][1][0]).toBe('%JOHN%');
    });

    it('should support pagination for search results', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await User.search('test', { limit: 5, offset: 2 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        ['%test%', 5, 2]
      );
    });

    it('should return empty array if no matches', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await User.search('nonexistent');

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // update()
  // ========================================
  describe('update()', () => {
    it('should update user name', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated Name' }] }); // SELECT

      const result = await User.update(1, { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(db.query.mock.calls[0][0]).toContain('name = $1');
    });

    it('should update user email', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, email: 'new@example.com' }] });

      await User.update(1, { email: 'new@example.com' });

      expect(db.query.mock.calls[0][0]).toContain('email = $1');
    });

    it('should update password_hash', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, password_hash: 'new_hash' }] });

      await User.update(1, { password_hash: 'new_hash' });

      expect(db.query.mock.calls[0][0]).toContain('password_hash = $1');
    });

    it('should update avatar_url', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, avatar_url: 'new_url.jpg' }] });

      await User.update(1, { avatar_url: 'new_url.jpg' });

      expect(db.query.mock.calls[0][0]).toContain('avatar_url = $1');
    });

    it('should update is_active status', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, is_active: false }] });

      await User.update(1, { is_active: false });

      const updateValues = db.query.mock.calls[0][1];
      expect(updateValues).toContain(false);
    });

    it('should update email_verified status', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, email_verified: true }] });

      await User.update(1, { email_verified: true });

      const updateValues = db.query.mock.calls[0][1];
      expect(updateValues).toContain(true);
    });

    it('should update multiple fields', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await User.update(1, {
        name: 'Updated',
        email: 'updated@example.com',
        is_active: true
      });

      const updateQuery = db.query.mock.calls[0][0];
      expect(updateQuery).toContain('name = $1');
      expect(updateQuery).toContain('email = $2');
      expect(updateQuery).toContain('is_active = $3');
    });

    it('should not update if no fields provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await User.update(1, {});

      expect(db.query).toHaveBeenCalledTimes(1); // Only SELECT, no UPDATE
    });

    it('should always update updated_at timestamp', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await User.update(1, { name: 'Test' });

      expect(db.query.mock.calls[0][0]).toContain('updated_at = NOW()');
    });
  });

  // ========================================
  // delete()
  // ========================================
  describe('delete()', () => {
    it('should soft delete user by id', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      await User.delete(1);

      expect(db.query).toHaveBeenCalledWith(
        'UPDATE users SET deleted_at = NOW() WHERE id = $1',
        [1]
      );
    });

    it('should handle deletion of non-existent user', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 0 });

      await User.delete(999);

      expect(db.query).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // count()
  // ========================================
  describe('count()', () => {
    it('should return total count of users', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '42' }] });

      const result = await User.count();

      expect(result).toBe(42);
      expect(db.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL'
      );
    });

    it('should return 0 if no users exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await User.count();

      expect(result).toBe(0);
    });

    it('should exclude deleted users from count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '10' }] });

      await User.count();

      expect(db.query.mock.calls[0][0]).toContain('deleted_at IS NULL');
    });
  });

  // ========================================
  // Error Handling
  // ========================================
  describe('Error Handling', () => {
    it('should propagate database errors on create', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(User.create({
        name: 'Test User',
        email: 'test@example.com',
        password_hash: 'hash'
      })).rejects.toThrow('Database error');
    });

    it('should propagate database errors on findById', async () => {
      db.query.mockRejectedValueOnce(new Error('Connection error'));

      await expect(User.findById(1)).rejects.toThrow('Connection error');
    });

    it('should propagate database errors on findByEmail', async () => {
      db.query.mockRejectedValueOnce(new Error('Query error'));

      await expect(User.findByEmail('test@example.com')).rejects.toThrow('Query error');
    });

    it('should propagate database errors on update', async () => {
      db.query.mockRejectedValueOnce(new Error('Update failed'));

      await expect(User.update(1, { name: 'Test' })).rejects.toThrow('Update failed');
    });

    it('should propagate database errors on delete', async () => {
      db.query.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(User.delete(1)).rejects.toThrow('Delete failed');
    });
  });

  // ========================================
  // Validation Tests
  // ========================================
  describe('Validation', () => {
    it('should handle empty name gracefully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: '' }] });

      const result = await User.create({
        name: '',
        email: 'test@example.com',
        password_hash: 'hash'
      });

      expect(result.name).toBe('');
    });

    it('should handle special characters in name', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: "O'Brien <>&\"" }] });

      const result = await User.create({
        name: "O'Brien <>&\"",
        email: 'test@example.com',
        password_hash: 'hash'
      });

      expect(result.name).toBe("O'Brien <>&\"");
    });

    it('should handle long email addresses', async () => {
      const longEmail = 'verylongemailaddress' + '@'.repeat(1) + 'example.com';
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, email: longEmail }] });

      const result = await User.create({
        name: 'Test User',
        email: longEmail,
        password_hash: 'hash'
      });

      expect(result.email).toBe(longEmail);
    });

    it('should handle unicode characters in name', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: '测试用户 🚀' }] });

      const result = await User.create({
        name: '测试用户 🚀',
        email: 'test@example.com',
        password_hash: 'hash'
      });

      expect(result.name).toBe('测试用户 🚀');
    });
  });
});
