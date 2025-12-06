const db = require('../db');

class ActivityLog {
  static async create(data) {
    const { tenantId, userId, action, entityType, entityId = null, changes = {}, ipAddress = null } = data;

    const result = await db.query(
      `INSERT INTO activity_logs (tenant_id, user_id, action, entity_type, entity_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, userId, action, entityType, entityId, JSON.stringify(changes), ipAddress]
    );
    return result.rows[0];
  }

  static async findByTenant(tenantId, options = {}) {
    const { limit = 50, offset = 0, action = null, entityType = null, startDate = null, endDate = null } = options;

    let query = `
      SELECT al.*, u.name as username, u.email
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.tenant_id = $1
    `;
    const params = [tenantId];

    if (action) {
      params.push(action);
      query += ` AND al.action = $${params.length}`;
    }

    if (entityType) {
      params.push(entityType);
      query += ` AND al.entity_type = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      query += ` AND al.created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND al.created_at <= $${params.length}`;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  static async findByEntity(tenantId, entityType, entityId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const result = await db.query(
      `SELECT al.*, u.name as username, u.email
       FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.tenant_id = $1 AND al.entity_type = $2 AND al.entity_id = $3
       ORDER BY al.created_at DESC
       LIMIT $4 OFFSET $5`,
      [tenantId, entityType, entityId, limit, offset]
    );
    return result.rows;
  }

  static async findByUser(tenantId, userId, options = {}) {
    const { limit = 50, offset = 0, action = null } = options;

    let query = `
      SELECT al.*, u.name as username, u.email
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.tenant_id = $1 AND al.user_id = $2
    `;
    const params = [tenantId, userId];

    if (action) {
      params.push(action);
      query += ` AND al.action = $${params.length}`;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  static async getRecent(tenantId, limit = 10) {
    const result = await db.query(
      `SELECT al.*, u.name as username, u.email
       FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.tenant_id = $1
       ORDER BY al.created_at DESC
       LIMIT $2`,
      [tenantId, limit]
    );
    return result.rows;
  }

  static async findById(id) {
    const result = await db.query(
      `SELECT al.*, u.name as username, u.email
       FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async countByTenant(tenantId, options = {}) {
    const { action = null, entityType = null, startDate = null, endDate = null } = options;

    let query = `SELECT COUNT(*) as count FROM activity_logs WHERE tenant_id = $1`;
    const params = [tenantId];

    if (action) {
      params.push(action);
      query += ` AND action = $${params.length}`;
    }

    if (entityType) {
      params.push(entityType);
      query += ` AND entity_type = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      query += ` AND created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND created_at <= $${params.length}`;
    }

    const result = await db.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  static async getStats(tenantId, days = 30) {
    const result = await db.query(
      `SELECT
         action,
         entity_type,
         COUNT(*) as count,
         DATE(created_at) as date
       FROM activity_logs
       WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY action, entity_type, DATE(created_at)
       ORDER BY date DESC, count DESC`,
      [tenantId]
    );
    return result.rows;
  }

  static async deleteOld(tenantId, days = 90) {
    const result = await db.query(
      `DELETE FROM activity_logs
       WHERE tenant_id = $1 AND created_at < NOW() - INTERVAL '${days} days'
       RETURNING id`,
      [tenantId]
    );
    return result.rowCount;
  }
}

module.exports = ActivityLog;
