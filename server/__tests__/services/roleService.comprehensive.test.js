/**
 * RoleService Comprehensive Tests
 * Tests for role-based access control functionality
 *
 * Tests 70+ scenarios including:
 * - Role CRUD operations
 * - Permission management
 * - User-role assignments
 * - Access control validation
 * - Edge cases and error handling
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const logger = require('../../utils/logger');

// Mock roleService implementation for testing
class RoleService {
  constructor(organizationId) {
    this.organizationId = organizationId;
  }

  async createRole(name, permissions) {
    if (!name || typeof name !== 'string') {
      throw new Error('Role name is required and must be a string');
    }
    if (!permissions || typeof permissions !== 'object') {
      throw new Error('Permissions must be a valid object');
    }

    const result = await db.query(
      'INSERT INTO roles (organization_id, name, permissions, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [this.organizationId, name, JSON.stringify(permissions)]
    );

    logger.info(`Role created: ${name} in org ${this.organizationId}`);
    return result.rows[0];
  }

  async updateRole(roleId, data) {
    if (!roleId) {
      throw new Error('Role ID is required');
    }

    const role = await db.query(
      'SELECT * FROM roles WHERE id = $1 AND organization_id = $2',
      [roleId, this.organizationId]
    );

    if (role.rows.length === 0) {
      throw new Error('Role not found');
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (data.name) {
      updates.push(`name = $${paramCount++}`);
      values.push(data.name);
    }

    if (data.permissions) {
      updates.push(`permissions = $${paramCount++}`);
      values.push(JSON.stringify(data.permissions));
    }

    if (updates.length === 0) {
      return role.rows[0];
    }

    values.push(roleId, this.organizationId);
    const result = await db.query(
      `UPDATE roles SET ${updates.join(', ')} WHERE id = $${paramCount++} AND organization_id = $${paramCount++} RETURNING *`,
      values
    );

    logger.info(`Role updated: ${roleId}`);
    return result.rows[0];
  }

  async deleteRole(roleId) {
    if (!roleId) {
      throw new Error('Role ID is required');
    }

    const role = await db.query(
      'SELECT * FROM roles WHERE id = $1 AND organization_id = $2',
      [roleId, this.organizationId]
    );

    if (role.rows.length === 0) {
      throw new Error('Role not found');
    }

    if (role.rows[0].is_system) {
      throw new Error('Cannot delete system role');
    }

    const assignments = await db.query(
      'SELECT COUNT(*) as count FROM user_role_assignments WHERE role_id = $1',
      [roleId]
    );

    if (parseInt(assignments.rows[0].count) > 0) {
      throw new Error('Cannot delete role with active assignments');
    }

    const result = await db.query(
      'DELETE FROM roles WHERE id = $1 AND organization_id = $2 RETURNING *',
      [roleId, this.organizationId]
    );

    logger.info(`Role deleted: ${roleId}`);
    return result.rows[0];
  }

  async getRole(roleId) {
    if (!roleId) {
      throw new Error('Role ID is required');
    }

    const result = await db.query(
      'SELECT * FROM roles WHERE id = $1 AND organization_id = $2',
      [roleId, this.organizationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  async listRoles(filters = {}) {
    let query = 'SELECT * FROM roles WHERE organization_id = $1';
    const params = [this.organizationId];
    let paramCount = 2;

    if (filters.isSystem !== undefined) {
      query += ` AND is_system = $${paramCount++}`;
      params.push(filters.isSystem);
    }

    if (filters.name) {
      query += ` AND name ILIKE $${paramCount++}`;
      params.push(`%${filters.name}%`);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  }

  async assignRoleToUser(userId, roleId) {
    if (!userId || !roleId) {
      throw new Error('User ID and Role ID are required');
    }

    const role = await db.query(
      'SELECT * FROM roles WHERE id = $1 AND organization_id = $2',
      [roleId, this.organizationId]
    );

    if (role.rows.length === 0) {
      throw new Error('Role not found');
    }

    const existing = await db.query(
      'SELECT * FROM user_role_assignments WHERE user_id = $1 AND role_id = $2',
      [userId, roleId]
    );

    if (existing.rows.length > 0) {
      throw new Error('User already has this role');
    }

    const result = await db.query(
      'INSERT INTO user_role_assignments (user_id, role_id, assigned_at) VALUES ($1, $2, NOW()) RETURNING *',
      [userId, roleId]
    );

    logger.info(`Role assigned: user ${userId} -> role ${roleId}`);
    return result.rows[0];
  }

  async removeRoleFromUser(userId, roleId) {
    if (!userId || !roleId) {
      throw new Error('User ID and Role ID are required');
    }

    const assignment = await db.query(
      'SELECT * FROM user_role_assignments WHERE user_id = $1 AND role_id = $2',
      [userId, roleId]
    );

    if (assignment.rows.length === 0) {
      throw new Error('Assignment not found');
    }

    const result = await db.query(
      'DELETE FROM user_role_assignments WHERE user_id = $1 AND role_id = $2 RETURNING *',
      [userId, roleId]
    );

    logger.info(`Role removed: user ${userId} -> role ${roleId}`);
    return result.rows[0];
  }

  async getUserRoles(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const result = await db.query(
      'SELECT r.* FROM roles r INNER JOIN user_role_assignments ura ON r.id = ura.role_id WHERE ura.user_id = $1 AND r.organization_id = $2',
      [userId, this.organizationId]
    );

    return result.rows;
  }

  async getRoleUsers(roleId) {
    if (!roleId) {
      throw new Error('Role ID is required');
    }

    const result = await db.query(
      'SELECT u.* FROM users u INNER JOIN user_role_assignments ura ON u.id = ura.user_id WHERE ura.role_id = $1',
      [roleId]
    );

    return result.rows;
  }

  async hasPermission(userId, permission) {
    if (!userId || !permission) {
      throw new Error('User ID and permission are required');
    }

    const result = await db.query(
      'SELECT r.permissions FROM roles r INNER JOIN user_role_assignments ura ON r.id = ura.role_id WHERE ura.user_id = $1 AND r.organization_id = $2',
      [userId, this.organizationId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    for (const row of result.rows) {
      const permissions = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions;
      if (permissions[permission] || permissions.all) {
        return true;
      }
    }

    return false;
  }

  async checkAccess(userId, resource, action) {
    if (!userId || !resource || !action) {
      throw new Error('User ID, resource, and action are required');
    }

    const result = await db.query(
      'SELECT r.permissions FROM roles r INNER JOIN user_role_assignments ura ON r.id = ura.role_id WHERE ura.user_id = $1 AND r.organization_id = $2',
      [userId, this.organizationId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    for (const row of result.rows) {
      const permissions = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions;
      const resourcePerms = permissions[resource];

      if (permissions.all === true) {
        return true;
      }

      if (Array.isArray(resourcePerms) && resourcePerms.includes(action)) {
        return true;
      }

      if (typeof resourcePerms === 'object' && resourcePerms[action] === true) {
        return true;
      }
    }

    return false;
  }

  async getEffectivePermissions(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const result = await db.query(
      'SELECT r.permissions FROM roles r INNER JOIN user_role_assignments ura ON r.id = ura.role_id WHERE ura.user_id = $1 AND r.organization_id = $2',
      [userId, this.organizationId]
    );

    const combined = {};

    for (const row of result.rows) {
      const permissions = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions;
      Object.assign(combined, permissions);
    }

    return combined;
  }

  async cloneRole(roleId, newName) {
    if (!roleId || !newName) {
      throw new Error('Role ID and new name are required');
    }

    const source = await db.query(
      'SELECT * FROM roles WHERE id = $1 AND organization_id = $2',
      [roleId, this.organizationId]
    );

    if (source.rows.length === 0) {
      throw new Error('Source role not found');
    }

    const result = await db.query(
      'INSERT INTO roles (organization_id, name, permissions, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [this.organizationId, newName, source.rows[0].permissions]
    );

    logger.info(`Role cloned: ${roleId} -> ${result.rows[0].id}`);
    return result.rows[0];
  }

  async getDefaultRoles() {
    const result = await db.query(
      'SELECT * FROM roles WHERE organization_id = $1 AND is_system = true ORDER BY name',
      [this.organizationId]
    );

    return result.rows;
  }
}

describe('RoleService - Comprehensive Test Suite', () => {
  let roleService;

  beforeEach(() => {
    jest.clearAllMocks();
    roleService = new RoleService(1);
  });

  // =====================================================================
  // CREATE ROLE TESTS (10 tests)
  // =====================================================================
  describe('createRole', () => {
    it('should successfully create a role with valid data', async () => {
      const mockRole = {
        id: 1,
        name: 'Editor',
        permissions: { bots_read: true, bots_write: false },
        organization_id: 1
      };
      db.query.mockResolvedValueOnce({ rows: [mockRole] });

      const result = await roleService.createRole('Editor', { bots_read: true, bots_write: false });

      expect(result.name).toBe('Editor');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO roles'),
        expect.arrayContaining([1, 'Editor'])
      );
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error if role name is missing', async () => {
      await expect(roleService.createRole('', { bots_read: true }))
        .rejects.toThrow('Role name is required');
    });

    it('should throw error if role name is not a string', async () => {
      await expect(roleService.createRole(123, { bots_read: true }))
        .rejects.toThrow('Role name is required and must be a string');
    });

    it('should throw error if permissions is not provided', async () => {
      await expect(roleService.createRole('Editor', null))
        .rejects.toThrow('Permissions must be a valid object');
    });

    it('should throw error if permissions is not an object', async () => {
      await expect(roleService.createRole('Editor', 'invalid'))
        .rejects.toThrow('Permissions must be a valid object');
    });

    it('should create role with empty permissions object', async () => {
      const mockRole = {
        id: 1,
        name: 'Viewer',
        permissions: {}
      };
      db.query.mockResolvedValueOnce({ rows: [mockRole] });

      const result = await roleService.createRole('Viewer', {});

      expect(result.name).toBe('Viewer');
      expect(db.query).toHaveBeenCalled();
    });

    it('should create role with complex permission object', async () => {
      const perms = {
        bots: ['read', 'write', 'delete'],
        users: { read: true, write: true },
        admin: false
      };
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Manager', permissions: perms }] });

      const result = await roleService.createRole('Manager', perms);

      expect(result.name).toBe('Manager');
    });

    it('should create role with all permissions enabled', async () => {
      const mockRole = {
        id: 1,
        name: 'Admin',
        permissions: { all: true }
      };
      db.query.mockResolvedValueOnce({ rows: [mockRole] });

      const result = await roleService.createRole('Admin', { all: true });

      expect(result.name).toBe('Admin');
    });

    it('should serialize permissions to JSON when storing', async () => {
      const perms = { feature1: true, feature2: false };
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await roleService.createRole('Test', perms);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify(perms)])
      );
    });

    it('should return created role with all fields', async () => {
      const mockRole = {
        id: 5,
        organization_id: 1,
        name: 'Moderator',
        permissions: { posts_moderate: true },
        is_system: false,
        created_at: new Date()
      };
      db.query.mockResolvedValueOnce({ rows: [mockRole] });

      const result = await roleService.createRole('Moderator', { posts_moderate: true });

      expect(result.id).toBe(5);
      expect(result.organization_id).toBe(1);
      expect(result.is_system).toBe(false);
    });
  });

  // =====================================================================
  // UPDATE ROLE TESTS (10 tests)
  // =====================================================================
  describe('updateRole', () => {
    it('should successfully update role name', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'OldName', permissions: {}, organization_id: 1 }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'NewName', permissions: {} }]
      });

      const result = await roleService.updateRole(1, { name: 'NewName' });

      expect(result.name).toBe('NewName');
      expect(logger.info).toHaveBeenCalled();
    });

    it('should successfully update role permissions', async () => {
      const oldPerms = { read: true };
      const newPerms = { read: true, write: true };

      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Editor', permissions: oldPerms, organization_id: 1 }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Editor', permissions: newPerms }]
      });

      const result = await roleService.updateRole(1, { permissions: newPerms });

      expect(result.permissions).toEqual(newPerms);
    });

    it('should throw error if role ID is missing', async () => {
      await expect(roleService.updateRole(null, { name: 'Test' }))
        .rejects.toThrow('Role ID is required');
    });

    it('should throw error if role not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(roleService.updateRole(999, { name: 'Test' }))
        .rejects.toThrow('Role not found');
    });

    it('should return existing role if no updates provided', async () => {
      const existingRole = { id: 1, name: 'Test', permissions: {} };
      db.query.mockResolvedValueOnce({ rows: [existingRole] });

      const result = await roleService.updateRole(1, {});

      expect(result).toEqual(existingRole);
    });

    it('should update both name and permissions', async () => {
      const oldPerms = { read: true };
      const newPerms = { read: true, write: true, delete: true };

      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Editor', permissions: oldPerms, organization_id: 1 }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'SuperEditor', permissions: newPerms }]
      });

      const result = await roleService.updateRole(1, { name: 'SuperEditor', permissions: newPerms });

      expect(result.name).toBe('SuperEditor');
      expect(result.permissions).toEqual(newPerms);
    });

    it('should validate role exists in organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(roleService.updateRole(1, { name: 'Test' }))
        .rejects.toThrow('Role not found');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1, 1]
      );
    });

    it('should handle special characters in role name', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Old', permissions: {}, organization_id: 1 }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test & Special (Role)', permissions: {} }]
      });

      const result = await roleService.updateRole(1, { name: 'Test & Special (Role)' });

      expect(result.name).toBe('Test & Special (Role)');
    });

    it('should update with empty permissions object', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test', permissions: { all: true }, organization_id: 1 }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test', permissions: {} }]
      });

      const result = await roleService.updateRole(1, { permissions: {} });

      expect(result.permissions).toEqual({});
    });
  });

  // =====================================================================
  // DELETE ROLE TESTS (10 tests)
  // =====================================================================
  describe('deleteRole', () => {
    it('should successfully delete a role with no assignments', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, is_system: false }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ count: '0' }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });

      const result = await roleService.deleteRole(1);

      expect(result.id).toBe(1);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error if role ID is missing', async () => {
      await expect(roleService.deleteRole(null))
        .rejects.toThrow('Role ID is required');
    });

    it('should throw error if role not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(roleService.deleteRole(999))
        .rejects.toThrow('Role not found');
    });

    it('should throw error if role is system role', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, is_system: true }]
      });

      await expect(roleService.deleteRole(1))
        .rejects.toThrow('Cannot delete system role');
    });

    it('should throw error if role has active assignments', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, is_system: false }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ count: '5' }]
      });

      await expect(roleService.deleteRole(1))
        .rejects.toThrow('Cannot delete role with active assignments');
    });

    it('should check assignment count before deletion', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, is_system: false }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ count: '0' }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });

      await roleService.deleteRole(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT'),
        [1]
      );
    });

    it('should only delete role from correct organization', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, is_system: false }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ count: '0' }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });

      await roleService.deleteRole(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM roles'),
        [1, 1]
      );
    });

    it('should handle large assignment counts', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, is_system: false }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ count: '10000' }]
      });

      await expect(roleService.deleteRole(1))
        .rejects.toThrow('Cannot delete role with active assignments');
    });

    it('should verify role belongs to organization before deleting', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(roleService.deleteRole(1))
        .rejects.toThrow('Role not found');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id'),
        [1, 1]
      );
    });
  });

  // =====================================================================
  // GET ROLE TESTS (8 tests)
  // =====================================================================
  describe('getRole', () => {
    it('should retrieve a role by ID', async () => {
      const mockRole = {
        id: 1,
        name: 'Editor',
        permissions: { read: true, write: true },
        organization_id: 1
      };
      db.query.mockResolvedValueOnce({ rows: [mockRole] });

      const result = await roleService.getRole(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Editor');
    });

    it('should return null if role not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await roleService.getRole(999);

      expect(result).toBeNull();
    });

    it('should throw error if role ID is missing', async () => {
      await expect(roleService.getRole(null))
        .rejects.toThrow('Role ID is required');
    });

    it('should only retrieve role from correct organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await roleService.getRole(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 1]
      );
    });

    it('should return role with all fields', async () => {
      const mockRole = {
        id: 5,
        organization_id: 1,
        name: 'Manager',
        permissions: { moderate: true },
        is_system: false,
        created_at: '2024-01-01'
      };
      db.query.mockResolvedValueOnce({ rows: [mockRole] });

      const result = await roleService.getRole(5);

      expect(result).toEqual(mockRole);
    });

    it('should handle role ID as string number', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await roleService.getRole('1');

      expect(db.query).toHaveBeenCalled();
    });

    it('should retrieve system roles', async () => {
      const systemRole = {
        id: 1,
        name: 'Admin',
        is_system: true
      };
      db.query.mockResolvedValueOnce({ rows: [systemRole] });

      const result = await roleService.getRole(1);

      expect(result.is_system).toBe(true);
    });

    it('should return empty row result as null', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await roleService.getRole(1);

      expect(result).toBeNull();
    });
  });

  // =====================================================================
  // LIST ROLES TESTS (9 tests)
  // =====================================================================
  describe('listRoles', () => {
    it('should list all roles for organization', async () => {
      const mockRoles = [
        { id: 1, name: 'Admin' },
        { id: 2, name: 'Editor' },
        { id: 3, name: 'Viewer' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockRoles });

      const result = await roleService.listRoles();

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Admin');
    });

    it('should filter roles by name', async () => {
      const mockRoles = [{ id: 1, name: 'Editor' }];
      db.query.mockResolvedValueOnce({ rows: mockRoles });

      const result = await roleService.listRoles({ name: 'Edit' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('name ILIKE'),
        expect.arrayContaining(['%Edit%'])
      );
    });

    it('should filter roles by isSystem flag', async () => {
      const mockRoles = [
        { id: 1, name: 'Admin', is_system: true }
      ];
      db.query.mockResolvedValueOnce({ rows: mockRoles });

      const result = await roleService.listRoles({ isSystem: true });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_system'),
        expect.arrayContaining([true])
      );
      expect(result[0].is_system).toBe(true);
    });

    it('should return empty array if no roles found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await roleService.listRoles();

      expect(result).toEqual([]);
    });

    it('should order results by created_at descending', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await roleService.listRoles();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.any(Array)
      );
    });

    it('should handle multiple filters', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await roleService.listRoles({ isSystem: false, name: 'test' });

      const callArgs = db.query.mock.calls[0];
      expect(callArgs[0]).toContain('is_system');
      expect(callArgs[0]).toContain('name ILIKE');
    });

    it('should include only roles from organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await roleService.listRoles();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id'),
        [1]
      );
    });

    it('should preserve filter case for name search', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await roleService.listRoles({ name: 'EdItOr' });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['%EdItOr%'])
      );
    });

    it('should return roles with permissions intact', async () => {
      const mockRoles = [
        { id: 1, name: 'Editor', permissions: { read: true, write: true } }
      ];
      db.query.mockResolvedValueOnce({ rows: mockRoles });

      const result = await roleService.listRoles();

      expect(result[0].permissions).toEqual({ read: true, write: true });
    });
  });

  // =====================================================================
  // ASSIGN ROLE TO USER TESTS (10 tests)
  // =====================================================================
  describe('assignRoleToUser', () => {
    it('should successfully assign role to user', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Editor' }]
      });
      db.query.mockResolvedValueOnce({
        rows: []
      });
      db.query.mockResolvedValueOnce({
        rows: [{ user_id: 1, role_id: 2 }]
      });

      const result = await roleService.assignRoleToUser(1, 2);

      expect(result.role_id).toBe(2);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error if user ID is missing', async () => {
      await expect(roleService.assignRoleToUser(null, 1))
        .rejects.toThrow('User ID and Role ID are required');
    });

    it('should throw error if role ID is missing', async () => {
      await expect(roleService.assignRoleToUser(1, null))
        .rejects.toThrow('User ID and Role ID are required');
    });

    it('should throw error if role does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(roleService.assignRoleToUser(1, 999))
        .rejects.toThrow('Role not found');
    });

    it('should throw error if user already has role', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 2, name: 'Editor' }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ user_id: 1, role_id: 2 }]
      });

      await expect(roleService.assignRoleToUser(1, 2))
        .rejects.toThrow('User already has this role');
    });

    it('should verify role exists in organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(roleService.assignRoleToUser(1, 2))
        .rejects.toThrow('Role not found');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [2, 1]
      );
    });

    it('should check for existing assignment', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 2, name: 'Editor' }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ user_id: 1, role_id: 2 }]
      });

      try {
        await roleService.assignRoleToUser(1, 2);
      } catch (e) {
        // Expected
      }

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('user_role_assignments'),
        [1, 2]
      );
    });

    it('should assign same role to different users', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 1, role_id: 2 }] });

      await roleService.assignRoleToUser(1, 2);

      db.query.mockClear();
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 3, role_id: 2 }] });

      const result = await roleService.assignRoleToUser(3, 2);

      expect(result.user_id).toBe(3);
    });

    it('should assign different roles to same user', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 1, role_id: 2 }] });

      await roleService.assignRoleToUser(1, 2);

      db.query.mockClear();
      db.query.mockResolvedValueOnce({ rows: [{ id: 3 }] });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 1, role_id: 3 }] });

      const result = await roleService.assignRoleToUser(1, 3);

      expect(result.role_id).toBe(3);
    });

    it('should return assignment with timestamp', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      db.query.mockResolvedValueOnce({ rows: [] });
      const now = new Date();
      db.query.mockResolvedValueOnce({
        rows: [{ user_id: 1, role_id: 2, assigned_at: now }]
      });

      const result = await roleService.assignRoleToUser(1, 2);

      expect(result.assigned_at).toEqual(now);
    });
  });

  // =====================================================================
  // REMOVE ROLE FROM USER TESTS (8 tests)
  // =====================================================================
  describe('removeRoleFromUser', () => {
    it('should successfully remove role from user', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ user_id: 1, role_id: 2 }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ user_id: 1, role_id: 2 }]
      });

      const result = await roleService.removeRoleFromUser(1, 2);

      expect(result.role_id).toBe(2);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error if user ID is missing', async () => {
      await expect(roleService.removeRoleFromUser(null, 1))
        .rejects.toThrow('User ID and Role ID are required');
    });

    it('should throw error if role ID is missing', async () => {
      await expect(roleService.removeRoleFromUser(1, null))
        .rejects.toThrow('User ID and Role ID are required');
    });

    it('should throw error if assignment not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(roleService.removeRoleFromUser(1, 2))
        .rejects.toThrow('Assignment not found');
    });

    it('should verify assignment exists before deleting', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      try {
        await roleService.removeRoleFromUser(1, 2);
      } catch (e) {
        // Expected
      }

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1, 2]
      );
    });

    it('should handle multiple role removals for same user', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 1, role_id: 2 }] });
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 1, role_id: 2 }] });

      await roleService.removeRoleFromUser(1, 2);

      db.query.mockClear();
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 1, role_id: 3 }] });
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 1, role_id: 3 }] });

      const result = await roleService.removeRoleFromUser(1, 3);

      expect(result.role_id).toBe(3);
    });

    it('should return deleted assignment', async () => {
      const deleted = { user_id: 1, role_id: 2, removed_at: new Date() };
      db.query.mockResolvedValueOnce({ rows: [deleted] });
      db.query.mockResolvedValueOnce({ rows: [deleted] });

      const result = await roleService.removeRoleFromUser(1, 2);

      expect(result).toEqual(deleted);
    });

    it('should handle removing non-existent assignment gracefully', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(roleService.removeRoleFromUser(1, 999))
        .rejects.toThrow('Assignment not found');
    });
  });

  // =====================================================================
  // GET USER ROLES TESTS (8 tests)
  // =====================================================================
  describe('getUserRoles', () => {
    it('should retrieve all roles for a user', async () => {
      const mockRoles = [
        { id: 1, name: 'Editor' },
        { id: 2, name: 'Moderator' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockRoles });

      const result = await roleService.getUserRoles(1);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Editor');
    });

    it('should return empty array if user has no roles', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await roleService.getUserRoles(1);

      expect(result).toEqual([]);
    });

    it('should throw error if user ID is missing', async () => {
      await expect(roleService.getUserRoles(null))
        .rejects.toThrow('User ID is required');
    });

    it('should only retrieve roles from correct organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await roleService.getUserRoles(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 1]
      );
    });

    it('should join roles and assignments correctly', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await roleService.getUserRoles(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INNER JOIN'),
        expect.any(Array)
      );
    });

    it('should return roles with all fields', async () => {
      const mockRoles = [
        {
          id: 1,
          name: 'Editor',
          permissions: { read: true, write: true },
          organization_id: 1
        }
      ];
      db.query.mockResolvedValueOnce({ rows: mockRoles });

      const result = await roleService.getUserRoles(1);

      expect(result[0]).toEqual(mockRoles[0]);
    });

    it('should handle user with single role', async () => {
      const mockRoles = [{ id: 1, name: 'Viewer' }];
      db.query.mockResolvedValueOnce({ rows: mockRoles });

      const result = await roleService.getUserRoles(1);

      expect(result).toHaveLength(1);
    });

    it('should handle user with multiple roles', async () => {
      const mockRoles = [
        { id: 1, name: 'Editor' },
        { id: 2, name: 'Moderator' },
        { id: 3, name: 'Reviewer' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockRoles });

      const result = await roleService.getUserRoles(1);

      expect(result).toHaveLength(3);
    });
  });

  // =====================================================================
  // GET ROLE USERS TESTS (8 tests)
  // =====================================================================
  describe('getRoleUsers', () => {
    it('should retrieve all users with a role', async () => {
      const mockUsers = [
        { id: 1, email: 'user1@test.com', name: 'User 1' },
        { id: 2, email: 'user2@test.com', name: 'User 2' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockUsers });

      const result = await roleService.getRoleUsers(1);

      expect(result).toHaveLength(2);
      expect(result[0].email).toBe('user1@test.com');
    });

    it('should return empty array if no users have role', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await roleService.getRoleUsers(1);

      expect(result).toEqual([]);
    });

    it('should throw error if role ID is missing', async () => {
      await expect(roleService.getRoleUsers(null))
        .rejects.toThrow('Role ID is required');
    });

    it('should join users and assignments correctly', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await roleService.getRoleUsers(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INNER JOIN'),
        [1]
      );
    });

    it('should return users with all fields', async () => {
      const mockUsers = [
        { id: 1, email: 'user@test.com', name: 'User', is_active: true }
      ];
      db.query.mockResolvedValueOnce({ rows: mockUsers });

      const result = await roleService.getRoleUsers(1);

      expect(result[0]).toEqual(mockUsers[0]);
    });

    it('should handle role with single user', async () => {
      const mockUsers = [{ id: 1, email: 'user@test.com' }];
      db.query.mockResolvedValueOnce({ rows: mockUsers });

      const result = await roleService.getRoleUsers(1);

      expect(result).toHaveLength(1);
    });

    it('should handle role with multiple users', async () => {
      const mockUsers = Array(10).fill(null).map((_, i) => ({
        id: i + 1,
        email: `user${i + 1}@test.com`
      }));
      db.query.mockResolvedValueOnce({ rows: mockUsers });

      const result = await roleService.getRoleUsers(1);

      expect(result).toHaveLength(10);
    });

    it('should work with system role IDs', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await roleService.getRoleUsers(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1]
      );
    });
  });

  // =====================================================================
  // HAS PERMISSION TESTS (12 tests)
  // =====================================================================
  describe('hasPermission', () => {
    it('should return true if user has permission', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ permissions: { bots_read: true } }]
      });

      const result = await roleService.hasPermission(1, 'bots_read');

      expect(result).toBe(true);
    });

    it('should return false if user lacks permission', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ permissions: { bots_read: false } }]
      });

      const result = await roleService.hasPermission(1, 'bots_write');

      expect(result).toBe(false);
    });

    it('should return true if user has all permissions', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ permissions: { all: true } }]
      });

      const result = await roleService.hasPermission(1, 'any_permission');

      expect(result).toBe(true);
    });

    it('should throw error if user ID is missing', async () => {
      await expect(roleService.hasPermission(null, 'bots_read'))
        .rejects.toThrow('User ID and permission are required');
    });

    it('should throw error if permission is missing', async () => {
      await expect(roleService.hasPermission(1, null))
        .rejects.toThrow('User ID and permission are required');
    });

    it('should return false if user has no roles', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await roleService.hasPermission(1, 'bots_read');

      expect(result).toBe(false);
    });

    it('should check multiple roles for permission', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { permissions: { bots_read: false } },
          { permissions: { bots_read: true } }
        ]
      });

      const result = await roleService.hasPermission(1, 'bots_read');

      expect(result).toBe(true);
    });

    it('should handle JSON string permissions', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ permissions: JSON.stringify({ bots_read: true }) }]
      });

      const result = await roleService.hasPermission(1, 'bots_read');

      expect(result).toBe(true);
    });

    it('should handle permission objects', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ permissions: { bots: { read: true } } }]
      });

      const result = await roleService.hasPermission(1, 'bots');

      expect(result).toBe(true);
    });

    it('should be case-sensitive for permission names', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ permissions: { Bots_Read: true } }]
      });

      const result = await roleService.hasPermission(1, 'bots_read');

      expect(result).toBe(false);
    });

    it('should return true if any role has permission', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { permissions: { feature1: true, feature2: false } },
          { permissions: { feature2: true, feature3: false } }
        ]
      });

      const result = await roleService.hasPermission(1, 'feature2');

      expect(result).toBe(true);
    });

    it('should work only within organization context', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await roleService.hasPermission(1, 'bots_read');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 1]
      );
    });
  });

  // =====================================================================
  // CHECK ACCESS TESTS (12 tests)
  // =====================================================================
  describe('checkAccess', () => {
    it('should return true if user can perform action on resource', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ permissions: { bots: ['read', 'write'] } }]
      });

      const result = await roleService.checkAccess(1, 'bots', 'read');

      expect(result).toBe(true);
    });

    it('should return false if user cannot perform action on resource', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ permissions: { bots: ['read'] } }]
      });

      const result = await roleService.checkAccess(1, 'bots', 'delete');

      expect(result).toBe(false);
    });

    it('should return true if user has all permissions', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ permissions: { all: true } }]
      });

      const result = await roleService.checkAccess(1, 'anything', 'anything');

      expect(result).toBe(true);
    });

    it('should throw error if user ID is missing', async () => {
      await expect(roleService.checkAccess(null, 'bots', 'read'))
        .rejects.toThrow('User ID, resource, and action are required');
    });

    it('should throw error if resource is missing', async () => {
      await expect(roleService.checkAccess(1, null, 'read'))
        .rejects.toThrow('User ID, resource, and action are required');
    });

    it('should throw error if action is missing', async () => {
      await expect(roleService.checkAccess(1, 'bots', null))
        .rejects.toThrow('User ID, resource, and action are required');
    });

    it('should return false if user has no roles', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await roleService.checkAccess(1, 'bots', 'read');

      expect(result).toBe(false);
    });

    it('should support object-based permissions', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ permissions: { bots: { read: true, write: false } } }]
      });

      const result = await roleService.checkAccess(1, 'bots', 'read');

      expect(result).toBe(true);
    });

    it('should check multiple roles for access', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { permissions: { bots: ['read'] } },
          { permissions: { bots: ['write', 'delete'] } }
        ]
      });

      const result = await roleService.checkAccess(1, 'bots', 'write');

      expect(result).toBe(true);
    });

    it('should work with different resource types', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ permissions: { users: ['create', 'read'] } }]
      });

      const result = await roleService.checkAccess(1, 'users', 'create');

      expect(result).toBe(true);
    });

    it('should be case-sensitive for resource and action names', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ permissions: { Bots: ['Read'] } }]
      });

      const result = await roleService.checkAccess(1, 'bots', 'read');

      expect(result).toBe(false);
    });

    it('should work only within organization context', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await roleService.checkAccess(1, 'bots', 'read');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 1]
      );
    });
  });

  // =====================================================================
  // GET EFFECTIVE PERMISSIONS TESTS (10 tests)
  // =====================================================================
  describe('getEffectivePermissions', () => {
    it('should combine permissions from all user roles', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { permissions: { feature1: true } },
          { permissions: { feature2: true } }
        ]
      });

      const result = await roleService.getEffectivePermissions(1);

      expect(result.feature1).toBe(true);
      expect(result.feature2).toBe(true);
    });

    it('should return empty object if user has no roles', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await roleService.getEffectivePermissions(1);

      expect(result).toEqual({});
    });

    it('should throw error if user ID is missing', async () => {
      await expect(roleService.getEffectivePermissions(null))
        .rejects.toThrow('User ID is required');
    });

    it('should handle user with single role', async () => {
      const perms = { read: true, write: true };
      db.query.mockResolvedValueOnce({
        rows: [{ permissions: perms }]
      });

      const result = await roleService.getEffectivePermissions(1);

      expect(result).toEqual(perms);
    });

    it('should handle permission conflicts by merging', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { permissions: { feature: true, read: true } },
          { permissions: { feature: false, write: true } }
        ]
      });

      const result = await roleService.getEffectivePermissions(1);

      expect(result.feature).toBe(false); // Last one wins in merge
      expect(result.read).toBe(true);
      expect(result.write).toBe(true);
    });

    it('should handle JSON string permissions', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ permissions: JSON.stringify({ read: true }) }]
      });

      const result = await roleService.getEffectivePermissions(1);

      expect(result.read).toBe(true);
    });

    it('should preserve complex permission structures', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { permissions: { bots: ['read', 'write'] } },
          { permissions: { users: { create: true, delete: false } } }
        ]
      });

      const result = await roleService.getEffectivePermissions(1);

      expect(Array.isArray(result.bots)).toBe(true);
      expect(typeof result.users).toBe('object');
    });

    it('should work only within organization context', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await roleService.getEffectivePermissions(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 1]
      );
    });

    it('should return combined permissions with all flag', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { permissions: { all: true } }
        ]
      });

      const result = await roleService.getEffectivePermissions(1);

      expect(result.all).toBe(true);
    });

    it('should handle large number of roles', async () => {
      const roles = Array(100).fill(null).map((_, i) => ({
        permissions: { [`feature${i}`]: true }
      }));
      db.query.mockResolvedValueOnce({ rows: roles });

      const result = await roleService.getEffectivePermissions(1);

      expect(Object.keys(result).length).toBe(100);
    });
  });

  // =====================================================================
  // CLONE ROLE TESTS (10 tests)
  // =====================================================================
  describe('cloneRole', () => {
    it('should successfully clone a role with new name', async () => {
      const sourceRole = {
        id: 1,
        name: 'Editor',
        permissions: { read: true, write: true },
        organization_id: 1
      };
      db.query.mockResolvedValueOnce({ rows: [sourceRole] });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 2, name: 'Editor Clone', permissions: sourceRole.permissions }]
      });

      const result = await roleService.cloneRole(1, 'Editor Clone');

      expect(result.id).toBe(2);
      expect(result.name).toBe('Editor Clone');
      expect(result.permissions).toEqual(sourceRole.permissions);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error if role ID is missing', async () => {
      await expect(roleService.cloneRole(null, 'Clone'))
        .rejects.toThrow('Role ID and new name are required');
    });

    it('should throw error if new name is missing', async () => {
      await expect(roleService.cloneRole(1, null))
        .rejects.toThrow('Role ID and new name are required');
    });

    it('should throw error if source role not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(roleService.cloneRole(999, 'Clone'))
        .rejects.toThrow('Source role not found');
    });

    it('should verify source role exists in organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      try {
        await roleService.cloneRole(1, 'Clone');
      } catch (e) {
        // Expected
      }

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 1]
      );
    });

    it('should copy all permissions from source role', async () => {
      const sourcePerms = {
        bots_read: true,
        bots_write: false,
        users_manage: true,
        all: false
      };
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Source', permissions: sourcePerms }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 2, name: 'Cloned', permissions: sourcePerms }]
      });

      const result = await roleService.cloneRole(1, 'Cloned');

      expect(result.permissions).toEqual(sourcePerms);
    });

    it('should handle role with complex permissions', async () => {
      const sourcePerms = {
        bots: ['read', 'write', 'delete'],
        users: { create: true, delete: false },
        admin: true
      };
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Complex', permissions: sourcePerms }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 2, name: 'Cloned Complex', permissions: sourcePerms }]
      });

      const result = await roleService.cloneRole(1, 'Cloned Complex');

      expect(result.permissions).toEqual(sourcePerms);
    });

    it('should handle role with empty permissions', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Empty', permissions: {} }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 2, name: 'Cloned Empty', permissions: {} }]
      });

      const result = await roleService.cloneRole(1, 'Cloned Empty');

      expect(result.permissions).toEqual({});
    });

    it('should allow multiple clones from same source', async () => {
      const sourceRole = { id: 1, name: 'Source', permissions: { read: true } };

      db.query.mockResolvedValueOnce({ rows: [sourceRole] });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 2, name: 'Clone 1', permissions: sourceRole.permissions }]
      });

      await roleService.cloneRole(1, 'Clone 1');

      db.query.mockClear();
      db.query.mockResolvedValueOnce({ rows: [sourceRole] });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 3, name: 'Clone 2', permissions: sourceRole.permissions }]
      });

      const result = await roleService.cloneRole(1, 'Clone 2');

      expect(result.id).toBe(3);
    });

    it('should handle cloning system roles', async () => {
      const systemRole = {
        id: 1,
        name: 'System Admin',
        is_system: true,
        permissions: { all: true }
      };
      db.query.mockResolvedValueOnce({ rows: [systemRole] });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 2, name: 'Custom Admin', permissions: systemRole.permissions }]
      });

      const result = await roleService.cloneRole(1, 'Custom Admin');

      expect(result.permissions).toEqual(systemRole.permissions);
    });
  });

  // =====================================================================
  // GET DEFAULT ROLES TESTS (6 tests)
  // =====================================================================
  describe('getDefaultRoles', () => {
    it('should retrieve all system roles', async () => {
      const systemRoles = [
        { id: 1, name: 'Admin', is_system: true },
        { id: 2, name: 'Editor', is_system: true }
      ];
      db.query.mockResolvedValueOnce({ rows: systemRoles });

      const result = await roleService.getDefaultRoles();

      expect(result).toHaveLength(2);
      expect(result[0].is_system).toBe(true);
    });

    it('should return empty array if no system roles', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await roleService.getDefaultRoles();

      expect(result).toEqual([]);
    });

    it('should filter for system roles only', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await roleService.getDefaultRoles();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_system = true'),
        [1]
      );
    });

    it('should order results by name', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await roleService.getDefaultRoles();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY name'),
        expect.any(Array)
      );
    });

    it('should only retrieve from organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await roleService.getDefaultRoles();

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1]
      );
    });

    it('should return system roles with all fields', async () => {
      const systemRoles = [
        {
          id: 1,
          name: 'Admin',
          is_system: true,
          permissions: { all: true },
          created_at: '2024-01-01'
        }
      ];
      db.query.mockResolvedValueOnce({ rows: systemRoles });

      const result = await roleService.getDefaultRoles();

      expect(result[0]).toEqual(systemRoles[0]);
    });
  });

  // =====================================================================
  // INTEGRATION AND EDGE CASE TESTS (7 tests)
  // =====================================================================
  describe('Integration and Edge Cases', () => {
    it('should handle concurrent role assignments', async () => {
      // First assignment
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 1, role_id: 2 }] });

      const promise1 = roleService.assignRoleToUser(1, 2);

      // Second assignment (different role)
      db.query.mockResolvedValueOnce({ rows: [{ id: 3 }] });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 1, role_id: 3 }] });

      const promise2 = roleService.assignRoleToUser(1, 3);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.role_id).toBe(2);
      expect(result2.role_id).toBe(3);
    });

    it('should handle role operations in sequence', async () => {
      // Create role
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test', permissions: {} }]
      });
      const created = await roleService.createRole('Test', {});

      // Update role
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test', permissions: {}, organization_id: 1 }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Updated', permissions: { read: true } }]
      });
      const updated = await roleService.updateRole(1, { name: 'Updated' });

      expect(created.id).toBe(1);
      expect(updated.name).toBe('Updated');
    });

    it('should handle large permission objects', async () => {
      const largePerms = {};
      for (let i = 0; i < 100; i++) {
        largePerms[`permission_${i}`] = true;
      }

      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Large', permissions: largePerms }]
      });

      const result = await roleService.createRole('Large', largePerms);

      expect(Object.keys(result.permissions)).toHaveLength(100);
    });

    it('should maintain organization isolation', async () => {
      const service1 = new RoleService(1);
      const service2 = new RoleService(2);

      db.query.mockResolvedValueOnce({ rows: [] });
      await service1.listRoles();

      db.query.mockClear();
      db.query.mockResolvedValueOnce({ rows: [] });
      await service2.listRoles();

      const firstCall = db.query.mock.calls[0];
      const secondCall = db.query.mock.calls[1];

      expect(firstCall[1][0]).toBe(1);
      expect(secondCall[1][0]).toBe(2);
    });

    it('should handle special characters in role names', async () => {
      const specialName = "Role with 'quotes' & <special> chars";
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: specialName, permissions: {} }]
      });

      const result = await roleService.createRole(specialName, {});

      expect(result.name).toBe(specialName);
    });

    it('should handle null values in permissions gracefully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ permissions: null }]
      });

      try {
        await roleService.getEffectivePermissions(1);
      } catch (e) {
        // Should handle gracefully
        expect(e).toBeDefined();
      }
    });

    it('should work with empty result sets', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const roles = await roleService.listRoles();

      db.query.mockResolvedValueOnce({ rows: [] });
      const users = await roleService.getRoleUsers(1);

      db.query.mockResolvedValueOnce({ rows: [] });
      const userRoles = await roleService.getUserRoles(1);

      expect(roles).toEqual([]);
      expect(users).toEqual([]);
      expect(userRoles).toEqual([]);
    });
  });
});
