/**
 * Role Model - Database operations for roles
 * Enterprise RBAC support with custom permissions
 */

const db = require('../db');

// Available permissions for the system
const AVAILABLE_PERMISSIONS = {
  bots: ['create', 'read', 'update', 'delete'],
  flows: ['create', 'read', 'update', 'delete'],
  messages: ['create', 'read', 'update', 'delete'],
  analytics: ['read', 'export'],
  organization: ['read', 'update', 'invite', 'remove_members'],
  api_tokens: ['create', 'read', 'delete'],
  webhooks: ['create', 'read', 'update', 'delete'],
  knowledge_base: ['create', 'read', 'update', 'delete'],
  agents: ['create', 'read', 'update', 'delete'],
  workflows: ['create', 'read', 'update', 'delete'],
  channels: ['create', 'read', 'update', 'delete'],
  voice_bots: ['create', 'read', 'update', 'delete'],
  integrations: ['create', 'read', 'update', 'delete'],
  roles: ['create', 'read', 'update', 'delete'],
  users: ['read', 'update', 'delete', 'assign_role']
};

const Role = {
  /**
   * Get available permissions
   */
  getAvailablePermissions() {
    return AVAILABLE_PERMISSIONS;
  },

  /**
   * Create a new role
   */
  async create(roleData) {
    const { name, description, permissions } = roleData;

    const result = await db.query(
      `INSERT INTO roles (name, description, permissions, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [name, description || '', JSON.stringify(permissions || {})]
    );

    return this.parseRole(result.rows[0]);
  },

  /**
   * Find role by ID
   */
  async findById(id) {
    const result = await db.query('SELECT * FROM roles WHERE id = $1', [id]);
    return result.rows[0] ? this.parseRole(result.rows[0]) : null;
  },

  /**
   * Find role by name
   */
  async findByName(name) {
    const result = await db.query('SELECT * FROM roles WHERE name = $1', [name]);
    return result.rows[0] ? this.parseRole(result.rows[0]) : null;
  },

  /**
   * Get all roles
   */
  async findAll() {
    const result = await db.query(
      'SELECT * FROM roles ORDER BY created_at ASC'
    );
    return result.rows.map(this.parseRole);
  },

  /**
   * Update a role
   */
  async update(id, roleData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (roleData.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(roleData.name);
    }
    if (roleData.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(roleData.description);
    }
    if (roleData.permissions !== undefined) {
      fields.push(`permissions = $${paramIndex++}`);
      values.push(JSON.stringify(roleData.permissions));
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await db.query(
      `UPDATE roles SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] ? this.parseRole(result.rows[0]) : null;
  },

  /**
   * Delete a role
   */
  async delete(id) {
    // Prevent deleting system roles
    const role = await this.findById(id);
    if (role && ['admin', 'member', 'viewer'].includes(role.name)) {
      throw new Error('Cannot delete system roles');
    }

    const result = await db.query(
      'DELETE FROM roles WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] ? this.parseRole(result.rows[0]) : null;
  },

  /**
   * Check if role has specific permission
   */
  async hasPermission(roleName, resource, action) {
    const role = await this.findByName(roleName);
    if (!role) return false;

    const permissions = role.permissions;
    return permissions[resource] && permissions[resource].includes(action);
  },

  /**
   * Get users with a specific role
   */
  async getUsersByRole(roleName, orgId) {
    const result = await db.query(
      `SELECT u.id, u.email, u.name, om.role, om.joined_at
       FROM users u
       JOIN organization_members om ON u.id = om.user_id
       WHERE om.org_id = $1 AND om.role = $2
       ORDER BY om.joined_at DESC`,
      [orgId, roleName]
    );
    return result.rows;
  },

  /**
   * Assign role to user in organization
   */
  async assignRoleToUser(userId, orgId, roleName) {
    // Verify role exists
    const role = await this.findByName(roleName);
    if (!role) {
      throw new Error('Role not found');
    }

    const result = await db.query(
      `UPDATE organization_members
       SET role = $1
       WHERE user_id = $2 AND org_id = $3
       RETURNING *`,
      [roleName, userId, orgId]
    );
    return result.rows[0];
  },

  /**
   * Parse role from database row
   */
  parseRole(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      permissions: typeof row.permissions === 'string'
        ? JSON.parse(row.permissions)
        : row.permissions,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_system: ['admin', 'member', 'viewer'].includes(row.name)
    };
  }
};

module.exports = Role;
