const db = require('../db');

class TeamMember {
  static async findByTenant(tenantId, options = {}) {
    const { status = null, limit = 100, offset = 0 } = options;

    let query = `
      SELECT tm.*, u.email, u.name as username, tr.name as role_name, tr.permissions
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      JOIN team_roles tr ON tm.role_id = tr.id
      WHERE tm.tenant_id = $1
    `;
    const params = [tenantId];

    if (status) {
      params.push(status);
      query += ` AND tm.status = $${params.length}`;
    }

    query += ` ORDER BY tm.joined_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  static async findById(id) {
    const result = await db.query(
      `SELECT tm.*, u.email, u.name as username, tr.name as role_name, tr.permissions
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       JOIN team_roles tr ON tm.role_id = tr.id
       WHERE tm.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async findByUserId(userId, tenantId = null) {
    let query = `
      SELECT tm.*, u.email, u.name as username, tr.name as role_name, tr.permissions,
             o.name as organization_name
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      JOIN team_roles tr ON tm.role_id = tr.id
      JOIN organizations o ON tm.tenant_id = o.id
      WHERE tm.user_id = $1
    `;
    const params = [userId];

    if (tenantId) {
      params.push(tenantId);
      query += ` AND tm.tenant_id = $${params.length}`;
    }

    const result = await db.query(query, params);
    return tenantId ? result.rows[0] : result.rows;
  }

  static async create(data) {
    const { tenantId, userId, roleId, invitedBy = null, status = 'active' } = data;

    const result = await db.query(
      `INSERT INTO team_members (tenant_id, user_id, role_id, invited_by, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tenantId, userId, roleId, invitedBy, status]
    );
    return result.rows[0];
  }

  static async update(id, data) {
    const allowedFields = ['role_id', 'status'];
    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(data[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await db.query(
      `UPDATE team_members SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await db.query(
      `DELETE FROM team_members WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  static async deleteByUserAndTenant(userId, tenantId) {
    const result = await db.query(
      `DELETE FROM team_members WHERE user_id = $1 AND tenant_id = $2 RETURNING *`,
      [userId, tenantId]
    );
    return result.rows[0];
  }

  static async exists(userId, tenantId) {
    const result = await db.query(
      `SELECT EXISTS(SELECT 1 FROM team_members WHERE user_id = $1 AND tenant_id = $2) as exists`,
      [userId, tenantId]
    );
    return result.rows[0].exists;
  }

  static async countByTenant(tenantId) {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM team_members WHERE tenant_id = $1`,
      [tenantId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  static async hasPermission(userId, tenantId, permission) {
    const member = await this.findByUserId(userId, tenantId);
    if (!member) return false;

    const permissions = member.permissions;
    if (permissions.all === true) return true;
    return permissions[permission] === true;
  }
}

module.exports = TeamMember;
