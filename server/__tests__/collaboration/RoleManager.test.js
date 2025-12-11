/**
 * RoleManager Tests
 * Tests for server/collaboration/core/RoleManager.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const RoleManager = require('../../collaboration/core/RoleManager');

describe('RoleManager', () => {
  let roleManager;

  beforeEach(() => {
    jest.clearAllMocks();
    roleManager = new RoleManager(1);
  });

  describe('constructor', () => {
    it('should set tenant id', () => {
      expect(roleManager.tenantId).toBe(1);
    });
  });

  describe('createRole', () => {
    it('should create a role', async () => {
      const permissions = { bots_view: true, bots_edit: false };
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Editor', permissions, is_default: false }]
      });

      const result = await roleManager.createRole('Editor', permissions);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO team_roles'),
        expect.arrayContaining([1, 'Editor', JSON.stringify(permissions), false])
      );
      expect(result.name).toBe('Editor');
    });

    it('should unset other defaults when creating default role', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Default', is_default: true }]
        });

      await roleManager.createRole('Default', {}, true);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE team_roles SET is_default = false'),
        [1]
      );
    });
  });

  describe('updateRole', () => {
    it('should update role name', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'New Name' }]
      });

      await roleManager.updateRole(1, { name: 'New Name' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE team_roles'),
        expect.arrayContaining(['New Name', 1, 1])
      );
    });

    it('should update role permissions', async () => {
      const permissions = { all: true };
      db.query.mockResolvedValue({
        rows: [{ id: 1, permissions }]
      });

      await roleManager.updateRole(1, { permissions });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('permissions'),
        expect.arrayContaining([JSON.stringify(permissions)])
      );
    });

    it('should unset other defaults when setting isDefault', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, is_default: true }] });

      await roleManager.updateRole(1, { isDefault: true });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_default = false'),
        [1]
      );
    });

    it('should return existing role if no updates', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test' }]
      });

      await roleManager.updateRole(1, {});

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1, 1]
      );
    });

    it('should update multiple fields', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Updated', permissions: {}, is_default: true }]
        });

      await roleManager.updateRole(1, {
        name: 'Updated',
        permissions: {},
        isDefault: true
      });

      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('deleteRole', () => {
    it('should delete role', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, is_default: false }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await roleManager.deleteRole(1);

      expect(result).toBeDefined();
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM team_roles'),
        [1, 1]
      );
    });

    it('should throw error if role not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(roleManager.deleteRole(999))
        .rejects.toThrow('Role not found');
    });

    it('should throw error if trying to delete default role', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, is_default: true }]
      });

      await expect(roleManager.deleteRole(1))
        .rejects.toThrow('Cannot delete default role');
    });

    it('should throw error if role has assigned members', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, is_default: false }] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });

      await expect(roleManager.deleteRole(1))
        .rejects.toThrow('Cannot delete role with assigned members');
    });
  });

  describe('getRoles', () => {
    it('should return all roles with member count', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, name: 'Admin', member_count: '5' },
          { id: 2, name: 'Editor', member_count: '10' }
        ]
      });

      const roles = await roleManager.getRoles();

      expect(roles).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT'),
        [1]
      );
    });
  });

  describe('getRoleById', () => {
    it('should return role by id', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Admin' }]
      });

      const role = await roleManager.getRoleById(1);

      expect(role.name).toBe('Admin');
    });

    it('should return undefined if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const role = await roleManager.getRoleById(999);

      expect(role).toBeUndefined();
    });
  });

  describe('getRoleByName', () => {
    it('should return role by name', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Admin' }]
      });

      const role = await roleManager.getRoleByName('Admin');

      expect(role.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('name = $1'),
        ['Admin', 1]
      );
    });
  });

  describe('getDefaultRole', () => {
    it('should return default role', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Default', is_default: true }]
      });

      const role = await roleManager.getDefaultRole();

      expect(role.is_default).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_default = true'),
        [1]
      );
    });

    it('should return undefined if no default role', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const role = await roleManager.getDefaultRole();

      expect(role).toBeUndefined();
    });
  });

  describe('assignRole', () => {
    it('should assign role to user', async () => {
      db.query.mockResolvedValue({
        rows: [{ user_id: 1, role_id: 2 }]
      });

      const result = await roleManager.assignRole(1, 2);

      expect(result.role_id).toBe(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE team_members SET role_id'),
        [2, 1, 1]
      );
    });
  });

  describe('getPermissions', () => {
    it('should return user permissions', async () => {
      const permissions = { bots_view: true, bots_edit: true };
      db.query.mockResolvedValue({
        rows: [{ permissions }]
      });

      const result = await roleManager.getPermissions(1);

      expect(result).toEqual(permissions);
    });

    it('should return empty object if user not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await roleManager.getPermissions(1);

      expect(result).toEqual({});
    });
  });

  describe('checkPermission', () => {
    it('should return true when user has permission', async () => {
      db.query.mockResolvedValue({
        rows: [{ permissions: { bots_view: true } }]
      });

      const result = await roleManager.checkPermission(1, 'bots_view');

      expect(result).toBe(true);
    });

    it('should return false when user lacks permission', async () => {
      db.query.mockResolvedValue({
        rows: [{ permissions: { bots_view: false } }]
      });

      const result = await roleManager.checkPermission(1, 'bots_edit');

      expect(result).toBe(false);
    });

    it('should return true for all permissions when user has all:true', async () => {
      db.query.mockResolvedValue({
        rows: [{ permissions: { all: true } }]
      });

      const result = await roleManager.checkPermission(1, 'any_permission');

      expect(result).toBe(true);
    });
  });

  describe('getUserRole', () => {
    it('should return user role', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Admin' }]
      });

      const role = await roleManager.getUserRole(1);

      expect(role.name).toBe('Admin');
    });

    it('should return undefined if user has no role', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const role = await roleManager.getUserRole(1);

      expect(role).toBeUndefined();
    });
  });

  describe('cloneRole', () => {
    it('should clone role with new name', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Source', permissions: { bots_view: true } }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 2, name: 'Cloned', permissions: { bots_view: true } }]
        });

      const result = await roleManager.cloneRole(1, 'Cloned');

      expect(result.name).toBe('Cloned');
    });

    it('should throw error if source role not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(roleManager.cloneRole(999, 'Clone'))
        .rejects.toThrow('Source role not found');
    });
  });
});
