const db = require('../../db');

class TeamManager {
  constructor(tenantId) {
    this.tenantId = tenantId;
  }

  async addMember(userId, roleId, invitedBy = null) {
    const result = await db.query(
      `INSERT INTO team_members (tenant_id, user_id, role_id, invited_by, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING *`,
      [this.tenantId, userId, roleId, invitedBy]
    );
    return result.rows[0];
  }

  async removeMember(userId) {
    const result = await db.query(
      `DELETE FROM team_members
       WHERE tenant_id = $1 AND user_id = $2
       RETURNING *`,
      [this.tenantId, userId]
    );
    return result.rows[0];
  }

  async updateRole(userId, newRoleId) {
    const result = await db.query(
      `UPDATE team_members
       SET role_id = $1
       WHERE tenant_id = $2 AND user_id = $3
       RETURNING *`,
      [newRoleId, this.tenantId, userId]
    );
    return result.rows[0];
  }

  async getMembers(options = {}) {
    const { status = null, limit = 100, offset = 0 } = options;

    let query = `
      SELECT tm.*, u.email, u.username, tr.name as role_name, tr.permissions
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      JOIN team_roles tr ON tm.role_id = tr.id
      WHERE tm.tenant_id = $1
    `;
    const params = [this.tenantId];

    if (status) {
      params.push(status);
      query += ` AND tm.status = $${params.length}`;
    }

    query += ` ORDER BY tm.joined_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  async getMember(userId) {
    const result = await db.query(
      `SELECT tm.*, u.email, u.username, tr.name as role_name, tr.permissions
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       JOIN team_roles tr ON tm.role_id = tr.id
       WHERE tm.tenant_id = $1 AND tm.user_id = $2`,
      [this.tenantId, userId]
    );
    return result.rows[0];
  }

  async getTeamStats() {
    const membersResult = await db.query(
      `SELECT
         COUNT(*) as total_members,
         COUNT(*) FILTER (WHERE status = 'active') as active_members,
         COUNT(*) FILTER (WHERE status = 'inactive') as inactive_members,
         COUNT(*) FILTER (WHERE status = 'suspended') as suspended_members
       FROM team_members
       WHERE tenant_id = $1`,
      [this.tenantId]
    );

    const rolesResult = await db.query(
      `SELECT tr.name, tr.id, COUNT(tm.id) as member_count
       FROM team_roles tr
       LEFT JOIN team_members tm ON tr.id = tm.role_id AND tm.tenant_id = $1
       WHERE tr.tenant_id = $1
       GROUP BY tr.id, tr.name`,
      [this.tenantId]
    );

    const invitationsResult = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending') as pending_invitations,
         COUNT(*) FILTER (WHERE status = 'accepted') as accepted_invitations,
         COUNT(*) FILTER (WHERE status = 'expired') as expired_invitations
       FROM team_invitations
       WHERE tenant_id = $1`,
      [this.tenantId]
    );

    return {
      members: membersResult.rows[0],
      roles: rolesResult.rows,
      invitations: invitationsResult.rows[0]
    };
  }

  async updateMemberStatus(userId, status) {
    const result = await db.query(
      `UPDATE team_members
       SET status = $1
       WHERE tenant_id = $2 AND user_id = $3
       RETURNING *`,
      [status, this.tenantId, userId]
    );
    return result.rows[0];
  }

  async getRoles() {
    const result = await db.query(
      `SELECT * FROM team_roles WHERE tenant_id = $1 ORDER BY name`,
      [this.tenantId]
    );
    return result.rows;
  }

  async createRole(name, permissions, isDefault = false) {
    const result = await db.query(
      `INSERT INTO team_roles (tenant_id, name, permissions, is_default)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [this.tenantId, name, JSON.stringify(permissions), isDefault]
    );
    return result.rows[0];
  }

  async updateRolePermissions(roleId, permissions) {
    const result = await db.query(
      `UPDATE team_roles
       SET permissions = $1
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [JSON.stringify(permissions), roleId, this.tenantId]
    );
    return result.rows[0];
  }

  async deleteRole(roleId) {
    const result = await db.query(
      `DELETE FROM team_roles
       WHERE id = $1 AND tenant_id = $2 AND is_default = false
       RETURNING *`,
      [roleId, this.tenantId]
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
}

module.exports = TeamManager;
