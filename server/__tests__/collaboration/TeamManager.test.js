/**
 * TeamManager Tests
 * Tests for server/collaboration/core/TeamManager.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const TeamManager = require('../../collaboration/core/TeamManager');

describe('TeamManager', () => {
  let teamManager;

  beforeEach(() => {
    jest.clearAllMocks();
    teamManager = new TeamManager(1);
  });

  describe('constructor', () => {
    it('should set tenant id', () => {
      expect(teamManager.tenantId).toBe(1);
    });
  });

  describe('addMember', () => {
    it('should add member to team', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, user_id: 100, role_id: 2, status: 'active' }]
      });

      const result = await teamManager.addMember(100, 2, 50);

      expect(result.status).toBe('active');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO team_members'),
        [1, 100, 2, 50]
      );
    });

    it('should add member without invitedBy', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, user_id: 100, invited_by: null }]
      });

      await teamManager.addMember(100, 2);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 100, 2, null]
      );
    });
  });

  describe('removeMember', () => {
    it('should remove member from team', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, user_id: 100 }]
      });

      const result = await teamManager.removeMember(100);

      expect(result.user_id).toBe(100);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM team_members'),
        [1, 100]
      );
    });

    it('should return undefined if member not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await teamManager.removeMember(999);

      expect(result).toBeUndefined();
    });
  });

  describe('updateRole', () => {
    it('should update member role', async () => {
      db.query.mockResolvedValue({
        rows: [{ user_id: 100, role_id: 5 }]
      });

      const result = await teamManager.updateRole(100, 5);

      expect(result.role_id).toBe(5);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE team_members'),
        [5, 1, 100]
      );
    });
  });

  describe('getMembers', () => {
    it('should return all members', async () => {
      db.query.mockResolvedValue({
        rows: [
          { user_id: 1, email: 'user1@test.com', role_name: 'Admin' },
          { user_id: 2, email: 'user2@test.com', role_name: 'Editor' }
        ]
      });

      const result = await teamManager.getMembers();

      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await teamManager.getMembers({ status: 'active' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $2'),
        expect.arrayContaining([1, 'active'])
      );
    });

    it('should apply pagination', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await teamManager.getMembers({ limit: 50, offset: 10 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([50, 10])
      );
    });
  });

  describe('getMember', () => {
    it('should return specific member', async () => {
      db.query.mockResolvedValue({
        rows: [{ user_id: 100, email: 'test@test.com', role_name: 'Admin' }]
      });

      const result = await teamManager.getMember(100);

      expect(result.user_id).toBe(100);
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 100]
      );
    });

    it('should return undefined if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await teamManager.getMember(999);

      expect(result).toBeUndefined();
    });
  });

  describe('getTeamStats', () => {
    it('should return team statistics', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ total_members: '10', active_members: '8', inactive_members: '2', suspended_members: '0' }]
        })
        .mockResolvedValueOnce({
          rows: [
            { name: 'Admin', id: 1, member_count: '3' },
            { name: 'Editor', id: 2, member_count: '7' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [{ pending_invitations: '5', accepted_invitations: '15', expired_invitations: '2' }]
        });

      const result = await teamManager.getTeamStats();

      expect(result.members.total_members).toBe('10');
      expect(result.roles).toHaveLength(2);
      expect(result.invitations.pending_invitations).toBe('5');
    });
  });

  describe('updateMemberStatus', () => {
    it('should update member status', async () => {
      db.query.mockResolvedValue({
        rows: [{ user_id: 100, status: 'suspended' }]
      });

      const result = await teamManager.updateMemberStatus(100, 'suspended');

      expect(result.status).toBe('suspended');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE team_members'),
        ['suspended', 1, 100]
      );
    });
  });

  describe('getRoles', () => {
    it('should return all roles', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, name: 'Admin' },
          { id: 2, name: 'Editor' }
        ]
      });

      const result = await teamManager.getRoles();

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM team_roles'),
        [1]
      );
    });
  });

  describe('createRole', () => {
    it('should create a role', async () => {
      const permissions = { bots_view: true };
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Custom', permissions }]
      });

      const result = await teamManager.createRole('Custom', permissions, false);

      expect(result.name).toBe('Custom');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO team_roles'),
        [1, 'Custom', JSON.stringify(permissions), false]
      );
    });
  });

  describe('updateRolePermissions', () => {
    it('should update role permissions', async () => {
      const permissions = { all: true };
      db.query.mockResolvedValue({
        rows: [{ id: 1, permissions }]
      });

      const result = await teamManager.updateRolePermissions(1, permissions);

      expect(result.permissions).toEqual(permissions);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE team_roles'),
        [JSON.stringify(permissions), 1, 1]
      );
    });
  });

  describe('deleteRole', () => {
    it('should delete non-default role', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 2, name: 'Custom' }]
      });

      const result = await teamManager.deleteRole(2);

      expect(result.id).toBe(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_default = false'),
        [2, 1]
      );
    });

    it('should return undefined for default role', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await teamManager.deleteRole(1);

      expect(result).toBeUndefined();
    });
  });

  describe('getDefaultRole', () => {
    it('should return default role', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Member', is_default: true }]
      });

      const result = await teamManager.getDefaultRole();

      expect(result.is_default).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_default = true'),
        [1]
      );
    });
  });
});
