/**
 * TeamMember Model Tests
 * Tests for server/models/TeamMember.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const TeamMember = require('../../models/TeamMember');

describe('TeamMember Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findByTenant()', () => {
    it('should return all team members for tenant', async () => {
      const mockMembers = [
        { id: 1, user_id: 1, tenant_id: 1, email: 'user1@test.com' },
        { id: 2, user_id: 2, tenant_id: 1, email: 'user2@test.com' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockMembers });

      const result = await TeamMember.findByTenant(1);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        expect.arrayContaining([1])
      );
    });

    it('should filter by status when provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'active' }] });

      await TeamMember.findByTenant(1, { status: 'active' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $'),
        expect.arrayContaining([1, 'active'])
      );
    });

    it('should use custom limit and offset', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await TeamMember.findByTenant(1, { limit: 10, offset: 20 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([1, 10, 20])
      );
    });

    it('should return empty array if no members', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await TeamMember.findByTenant(999);

      expect(result).toEqual([]);
    });
  });

  describe('findById()', () => {
    it('should return team member if found', async () => {
      const mockMember = { id: 1, user_id: 1, email: 'test@test.com', role_name: 'Admin' };
      db.query.mockResolvedValueOnce({ rows: [mockMember] });

      const result = await TeamMember.findById(1);

      expect(result.id).toBe(1);
      expect(result.role_name).toBe('Admin');
    });

    it('should return undefined if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await TeamMember.findById(999);

      expect(result).toBeUndefined();
    });
  });

  describe('findByUserId()', () => {
    it('should return all memberships for user without tenant filter', async () => {
      const mockMembers = [
        { id: 1, user_id: 1, tenant_id: 1 },
        { id: 2, user_id: 1, tenant_id: 2 }
      ];
      db.query.mockResolvedValueOnce({ rows: mockMembers });

      const result = await TeamMember.findByUserId(1);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $1'),
        [1]
      );
    });

    it('should return single membership when tenant specified', async () => {
      const mockMember = { id: 1, user_id: 1, tenant_id: 1 };
      db.query.mockResolvedValueOnce({ rows: [mockMember] });

      const result = await TeamMember.findByUserId(1, 1);

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $'),
        [1, 1]
      );
    });

    it('should return undefined if not found with tenant', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await TeamMember.findByUserId(1, 999);

      expect(result).toBeUndefined();
    });
  });

  describe('create()', () => {
    it('should create team member with all fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await TeamMember.create({
        tenantId: 1,
        userId: 5,
        roleId: 2,
        invitedBy: 1,
        status: 'pending'
      });

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO team_members'),
        [1, 5, 2, 1, 'pending']
      );
    });

    it('should use default values for optional fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await TeamMember.create({
        tenantId: 1,
        userId: 5,
        roleId: 2
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 5, 2, null, 'active']
      );
    });
  });

  describe('update()', () => {
    it('should update role_id', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, role_id: 3 }] });

      const result = await TeamMember.update(1, { role_id: 3 });

      expect(result.role_id).toBe(3);
      expect(db.query.mock.calls[0][0]).toContain('role_id = $1');
    });

    it('should update status', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'inactive' }] });

      const result = await TeamMember.update(1, { status: 'inactive' });

      expect(result.status).toBe('inactive');
    });

    it('should update multiple fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await TeamMember.update(1, { role_id: 3, status: 'inactive' });

      const updateQuery = db.query.mock.calls[0][0];
      expect(updateQuery).toContain('role_id = $1');
      expect(updateQuery).toContain('status = $2');
    });

    it('should return current member if no updates', async () => {
      const mockMember = { id: 1, role_id: 2 };
      db.query.mockResolvedValueOnce({ rows: [mockMember] });

      const result = await TeamMember.update(1, {});

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.any(Array)
      );
    });
  });

  describe('delete()', () => {
    it('should delete team member', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await TeamMember.delete(1);

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        [1]
      );
    });

    it('should return undefined if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await TeamMember.delete(999);

      expect(result).toBeUndefined();
    });
  });

  describe('deleteByUserAndTenant()', () => {
    it('should delete membership by user and tenant', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await TeamMember.deleteByUserAndTenant(5, 1);

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $1 AND tenant_id = $2'),
        [5, 1]
      );
    });

    it('should return undefined if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await TeamMember.deleteByUserAndTenant(999, 999);

      expect(result).toBeUndefined();
    });
  });

  describe('exists()', () => {
    it('should return true if membership exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ exists: true }] });

      const result = await TeamMember.exists(1, 1);

      expect(result).toBe(true);
    });

    it('should return false if membership does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ exists: false }] });

      const result = await TeamMember.exists(999, 999);

      expect(result).toBe(false);
    });
  });

  describe('countByTenant()', () => {
    it('should return count of team members', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const result = await TeamMember.countByTenant(1);

      expect(result).toBe(5);
    });

    it('should return 0 if no members', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await TeamMember.countByTenant(999);

      expect(result).toBe(0);
    });
  });

  describe('hasPermission()', () => {
    it('should return true if user has specific permission', async () => {
      const mockMember = { id: 1, permissions: { read: true, write: true } };
      db.query.mockResolvedValueOnce({ rows: [mockMember] });

      const result = await TeamMember.hasPermission(1, 1, 'read');

      expect(result).toBe(true);
    });

    it('should return true if user has all permissions', async () => {
      const mockMember = { id: 1, permissions: { all: true } };
      db.query.mockResolvedValueOnce({ rows: [mockMember] });

      const result = await TeamMember.hasPermission(1, 1, 'anything');

      expect(result).toBe(true);
    });

    it('should return false if user lacks permission', async () => {
      const mockMember = { id: 1, permissions: { read: true } };
      db.query.mockResolvedValueOnce({ rows: [mockMember] });

      const result = await TeamMember.hasPermission(1, 1, 'delete');

      expect(result).toBe(false);
    });

    it('should return false if user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await TeamMember.hasPermission(999, 1, 'read');

      expect(result).toBe(false);
    });
  });
});
