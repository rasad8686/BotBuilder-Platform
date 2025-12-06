const db = require('../../db');

class RoleManager {
  constructor(tenantId) {
    this.tenantId = tenantId;
  }

  async createRole(name, permissions, isDefault = false) {
    if (isDefault) {
      await db.query(
        `UPDATE team_roles SET is_default = false WHERE tenant_id = $1`,
        [this.tenantId]
      );
    }

    const result = await db.query(
      `INSERT INTO team_roles (tenant_id, name, permissions, is_default)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [this.tenantId, name, JSON.stringify(permissions), isDefault]
    );
    return result.rows[0];
  }

  async updateRole(roleId, data) {
    const { name, permissions, isDefault } = data;
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (permissions !== undefined) {
      updates.push(`permissions = $${paramIndex}`);
      values.push(JSON.stringify(permissions));
      paramIndex++;
    }

    if (isDefault !== undefined) {
      if (isDefault) {
        await db.query(
          `UPDATE team_roles SET is_default = false WHERE tenant_id = $1`,
          [this.tenantId]
        );
      }
      updates.push(`is_default = $${paramIndex}`);
      values.push(isDefault);
      paramIndex++;
    }

    if (updates.length === 0) {
      return this.getRoleById(roleId);
    }

    values.push(roleId, this.tenantId);
    const result = await db.query(
      `UPDATE team_roles SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async deleteRole(roleId) {
    const role = await this.getRoleById(roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    if (role.is_default) {
      throw new Error('Cannot delete default role');
    }

    const membersCount = await db.query(
      `SELECT COUNT(*) as count FROM team_members WHERE role_id = $1`,
      [roleId]
    );

    if (parseInt(membersCount.rows[0].count, 10) > 0) {
      throw new Error('Cannot delete role with assigned members');
    }

    const result = await db.query(
      `DELETE FROM team_roles WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [roleId, this.tenantId]
    );
    return result.rows[0];
  }

  async getRoles() {
    const result = await db.query(
      `SELECT tr.*, COUNT(tm.id) as member_count
       FROM team_roles tr
       LEFT JOIN team_members tm ON tr.id = tm.role_id
       WHERE tr.tenant_id = $1
       GROUP BY tr.id
       ORDER BY tr.name`,
      [this.tenantId]
    );
    return result.rows;
  }

  async getRoleById(roleId) {
    const result = await db.query(
      `SELECT * FROM team_roles WHERE id = $1 AND tenant_id = $2`,
      [roleId, this.tenantId]
    );
    return result.rows[0];
  }

  async getRoleByName(name) {
    const result = await db.query(
      `SELECT * FROM team_roles WHERE name = $1 AND tenant_id = $2`,
      [name, this.tenantId]
    );
    return result.rows[0];
  }

  async getDefaultRole() {
    const result = await db.query(
      `SELECT * FROM team_roles WHERE tenant_id = $1 AND is_default = true LIMIT 1`,
      [this.tenantId]
    );
    return result.rows[0];
  }

  async assignRole(userId, roleId) {
    const result = await db.query(
      `UPDATE team_members SET role_id = $1
       WHERE user_id = $2 AND tenant_id = $3
       RETURNING *`,
      [roleId, userId, this.tenantId]
    );
    return result.rows[0];
  }

  async getPermissions(userId) {
    const result = await db.query(
      `SELECT tr.permissions
       FROM team_members tm
       JOIN team_roles tr ON tm.role_id = tr.id
       WHERE tm.user_id = $1 AND tm.tenant_id = $2`,
      [userId, this.tenantId]
    );

    if (!result.rows[0]) {
      return {};
    }

    return result.rows[0].permissions;
  }

  async checkPermission(userId, permission) {
    const permissions = await this.getPermissions(userId);

    if (permissions.all === true) {
      return true;
    }

    return permissions[permission] === true;
  }

  async getUserRole(userId) {
    const result = await db.query(
      `SELECT tr.*
       FROM team_members tm
       JOIN team_roles tr ON tm.role_id = tr.id
       WHERE tm.user_id = $1 AND tm.tenant_id = $2`,
      [userId, this.tenantId]
    );
    return result.rows[0];
  }

  async cloneRole(roleId, newName) {
    const sourceRole = await this.getRoleById(roleId);
    if (!sourceRole) {
      throw new Error('Source role not found');
    }

    return this.createRole(newName, sourceRole.permissions, false);
  }
}

module.exports = RoleManager;
