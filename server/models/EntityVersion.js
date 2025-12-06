const db = require('../db');

class EntityVersion {
  static async create(data) {
    const { tenantId, entityType, entityId, versionNumber, versionData, createdBy, commitMessage = null } = data;

    const result = await db.query(
      `INSERT INTO entity_versions (tenant_id, entity_type, entity_id, version_number, data, created_by, commit_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, entityType, entityId, versionNumber, JSON.stringify(versionData), createdBy, commitMessage]
    );
    return result.rows[0];
  }

  static async findByEntity(tenantId, entityType, entityId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const result = await db.query(
      `SELECT ev.*, u.username as created_by_name
       FROM entity_versions ev
       LEFT JOIN users u ON ev.created_by = u.id
       WHERE ev.tenant_id = $1 AND ev.entity_type = $2 AND ev.entity_id = $3
       ORDER BY ev.version_number DESC
       LIMIT $4 OFFSET $5`,
      [tenantId, entityType, entityId, limit, offset]
    );
    return result.rows;
  }

  static async findById(id) {
    const result = await db.query(
      `SELECT ev.*, u.username as created_by_name
       FROM entity_versions ev
       LEFT JOIN users u ON ev.created_by = u.id
       WHERE ev.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async getLatest(tenantId, entityType, entityId) {
    const result = await db.query(
      `SELECT ev.*, u.username as created_by_name
       FROM entity_versions ev
       LEFT JOIN users u ON ev.created_by = u.id
       WHERE ev.tenant_id = $1 AND ev.entity_type = $2 AND ev.entity_id = $3
       ORDER BY ev.version_number DESC
       LIMIT 1`,
      [tenantId, entityType, entityId]
    );
    return result.rows[0];
  }

  static async getByVersionNumber(tenantId, entityType, entityId, versionNumber) {
    const result = await db.query(
      `SELECT ev.*, u.username as created_by_name
       FROM entity_versions ev
       LEFT JOIN users u ON ev.created_by = u.id
       WHERE ev.tenant_id = $1 AND ev.entity_type = $2 AND ev.entity_id = $3 AND ev.version_number = $4`,
      [tenantId, entityType, entityId, versionNumber]
    );
    return result.rows[0];
  }

  static async compare(tenantId, entityType, entityId, versionA, versionB) {
    const [verA, verB] = await Promise.all([
      this.getByVersionNumber(tenantId, entityType, entityId, versionA),
      this.getByVersionNumber(tenantId, entityType, entityId, versionB)
    ]);

    if (!verA || !verB) {
      throw new Error('One or both versions not found');
    }

    const diff = this.computeDiff(verA.data, verB.data);

    return {
      versionA: {
        number: verA.version_number,
        createdBy: verA.created_by_name,
        createdAt: verA.created_at,
        commitMessage: verA.commit_message
      },
      versionB: {
        number: verB.version_number,
        createdBy: verB.created_by_name,
        createdAt: verB.created_at,
        commitMessage: verB.commit_message
      },
      diff
    };
  }

  static computeDiff(dataA, dataB) {
    const diff = {
      added: {},
      removed: {},
      modified: {}
    };

    const keysA = Object.keys(dataA || {});
    const keysB = Object.keys(dataB || {});
    const allKeys = new Set([...keysA, ...keysB]);

    for (const key of allKeys) {
      if (!(key in dataA)) {
        diff.added[key] = dataB[key];
      } else if (!(key in dataB)) {
        diff.removed[key] = dataA[key];
      } else if (JSON.stringify(dataA[key]) !== JSON.stringify(dataB[key])) {
        diff.modified[key] = {
          old: dataA[key],
          new: dataB[key]
        };
      }
    }

    return diff;
  }

  static async countByEntity(tenantId, entityType, entityId) {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM entity_versions
       WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3`,
      [tenantId, entityType, entityId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  static async delete(id) {
    const result = await db.query(
      `DELETE FROM entity_versions WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  static async deleteByEntity(tenantId, entityType, entityId) {
    const result = await db.query(
      `DELETE FROM entity_versions
       WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3
       RETURNING *`,
      [tenantId, entityType, entityId]
    );
    return result.rows;
  }
}

module.exports = EntityVersion;
