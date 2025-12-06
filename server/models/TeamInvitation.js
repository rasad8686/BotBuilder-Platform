const db = require('../db');
const crypto = require('crypto');

class TeamInvitation {
  static generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  static async create(data) {
    const {
      tenantId,
      email,
      roleId,
      invitedBy,
      expiresInHours = 72
    } = data;

    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const result = await db.query(
      `INSERT INTO team_invitations (tenant_id, email, role_id, token, expires_at, invited_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenantId, email.toLowerCase(), roleId, token, expiresAt, invitedBy]
    );
    return result.rows[0];
  }

  static async findByToken(token) {
    const result = await db.query(
      `SELECT ti.*, tr.name as role_name, tr.permissions, o.name as organization_name
       FROM team_invitations ti
       JOIN team_roles tr ON ti.role_id = tr.id
       JOIN organizations o ON ti.tenant_id = o.id
       WHERE ti.token = $1`,
      [token]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await db.query(
      `SELECT ti.*, tr.name as role_name, o.name as organization_name
       FROM team_invitations ti
       JOIN team_roles tr ON ti.role_id = tr.id
       JOIN organizations o ON ti.tenant_id = o.id
       WHERE ti.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async findPendingByTenant(tenantId) {
    const result = await db.query(
      `SELECT ti.*, tr.name as role_name, u.username as invited_by_name
       FROM team_invitations ti
       JOIN team_roles tr ON ti.role_id = tr.id
       LEFT JOIN users u ON ti.invited_by = u.id
       WHERE ti.tenant_id = $1 AND ti.status = 'pending' AND ti.expires_at > NOW()
       ORDER BY ti.created_at DESC`,
      [tenantId]
    );
    return result.rows;
  }

  static async findByEmail(email, tenantId = null) {
    let query = `
      SELECT ti.*, tr.name as role_name, o.name as organization_name
      FROM team_invitations ti
      JOIN team_roles tr ON ti.role_id = tr.id
      JOIN organizations o ON ti.tenant_id = o.id
      WHERE ti.email = $1
    `;
    const params = [email.toLowerCase()];

    if (tenantId) {
      params.push(tenantId);
      query += ` AND ti.tenant_id = $${params.length}`;
    }

    query += ` ORDER BY ti.created_at DESC`;

    const result = await db.query(query, params);
    return tenantId ? result.rows[0] : result.rows;
  }

  static async accept(token) {
    const invitation = await this.findByToken(token);
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error(`Invitation already ${invitation.status}`);
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await this.expire(invitation.id);
      throw new Error('Invitation has expired');
    }

    const result = await db.query(
      `UPDATE team_invitations SET status = 'accepted' WHERE id = $1 RETURNING *`,
      [invitation.id]
    );

    return {
      invitation: result.rows[0],
      tenantId: invitation.tenant_id,
      roleId: invitation.role_id,
      email: invitation.email
    };
  }

  static async reject(tokenOrId) {
    const isToken = typeof tokenOrId === 'string' && tokenOrId.length > 10;
    const column = isToken ? 'token' : 'id';

    const result = await db.query(
      `UPDATE team_invitations SET status = 'rejected' WHERE ${column} = $1 RETURNING *`,
      [tokenOrId]
    );
    return result.rows[0];
  }

  static async expire(id) {
    const result = await db.query(
      `UPDATE team_invitations SET status = 'expired' WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  static async expireOld() {
    const result = await db.query(
      `UPDATE team_invitations
       SET status = 'expired'
       WHERE status = 'pending' AND expires_at < NOW()
       RETURNING *`
    );
    return result.rows;
  }

  static async delete(id) {
    const result = await db.query(
      `DELETE FROM team_invitations WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  static async hasPendingInvitation(email, tenantId) {
    const result = await db.query(
      `SELECT EXISTS(
        SELECT 1 FROM team_invitations
        WHERE email = $1 AND tenant_id = $2 AND status = 'pending' AND expires_at > NOW()
      ) as exists`,
      [email.toLowerCase(), tenantId]
    );
    return result.rows[0].exists;
  }

  static async resend(id, expiresInHours = 72) {
    const newToken = this.generateToken();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const result = await db.query(
      `UPDATE team_invitations
       SET token = $1, expires_at = $2, status = 'pending', created_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [newToken, expiresAt, id]
    );
    return result.rows[0];
  }
}

module.exports = TeamInvitation;
