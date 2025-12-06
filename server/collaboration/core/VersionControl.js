const db = require('../../db');

class VersionControl {
  constructor(tenantId) {
    this.tenantId = tenantId;
  }

  async createVersion(entityType, entityId, data, createdBy, commitMessage = null) {
    const latestVersion = await this.getLatestVersionNumber(entityType, entityId);
    const newVersionNumber = latestVersion + 1;

    const result = await db.query(
      `INSERT INTO entity_versions (tenant_id, entity_type, entity_id, version_number, data, created_by, commit_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [this.tenantId, entityType, entityId, newVersionNumber, JSON.stringify(data), createdBy, commitMessage]
    );
    return result.rows[0];
  }

  async getVersions(entityType, entityId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const result = await db.query(
      `SELECT ev.*, u.username as created_by_name
       FROM entity_versions ev
       LEFT JOIN users u ON ev.created_by = u.id
       WHERE ev.tenant_id = $1 AND ev.entity_type = $2 AND ev.entity_id = $3
       ORDER BY ev.version_number DESC
       LIMIT $4 OFFSET $5`,
      [this.tenantId, entityType, entityId, limit, offset]
    );
    return result.rows;
  }

  async getVersion(entityType, entityId, versionNumber) {
    const result = await db.query(
      `SELECT ev.*, u.username as created_by_name
       FROM entity_versions ev
       LEFT JOIN users u ON ev.created_by = u.id
       WHERE ev.tenant_id = $1 AND ev.entity_type = $2 AND ev.entity_id = $3 AND ev.version_number = $4`,
      [this.tenantId, entityType, entityId, versionNumber]
    );
    return result.rows[0];
  }

  async getLatestVersionNumber(entityType, entityId) {
    const result = await db.query(
      `SELECT COALESCE(MAX(version_number), 0) as max_version
       FROM entity_versions
       WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3`,
      [this.tenantId, entityType, entityId]
    );
    return result.rows[0].max_version;
  }

  async compareVersions(entityType, entityId, versionA, versionB) {
    const [verA, verB] = await Promise.all([
      this.getVersion(entityType, entityId, versionA),
      this.getVersion(entityType, entityId, versionB)
    ]);

    if (!verA || !verB) {
      throw new Error('One or both versions not found');
    }

    return {
      versionA: verA,
      versionB: verB,
      diff: this.computeDiff(verA.data, verB.data)
    };
  }

  computeDiff(dataA, dataB) {
    const diff = {
      added: {},
      removed: {},
      modified: {}
    };

    const keysA = Object.keys(dataA);
    const keysB = Object.keys(dataB);
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

  async createBranch(entityType, entityId, branchName, baseVersionId, createdBy) {
    const result = await db.query(
      `INSERT INTO entity_branches (tenant_id, entity_type, entity_id, branch_name, base_version_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [this.tenantId, entityType, entityId, branchName, baseVersionId, createdBy]
    );
    return result.rows[0];
  }

  async getBranches(entityType, entityId) {
    const result = await db.query(
      `SELECT eb.*, u.username as created_by_name, ev.version_number as base_version_number
       FROM entity_branches eb
       LEFT JOIN users u ON eb.created_by = u.id
       LEFT JOIN entity_versions ev ON eb.base_version_id = ev.id
       WHERE eb.tenant_id = $1 AND eb.entity_type = $2 AND eb.entity_id = $3
       ORDER BY eb.created_at DESC`,
      [this.tenantId, entityType, entityId]
    );
    return result.rows;
  }

  async getBranch(entityType, entityId, branchName) {
    const result = await db.query(
      `SELECT eb.*, u.username as created_by_name, ev.version_number as base_version_number
       FROM entity_branches eb
       LEFT JOIN users u ON eb.created_by = u.id
       LEFT JOIN entity_versions ev ON eb.base_version_id = ev.id
       WHERE eb.tenant_id = $1 AND eb.entity_type = $2 AND eb.entity_id = $3 AND eb.branch_name = $4`,
      [this.tenantId, entityType, entityId, branchName]
    );
    return result.rows[0];
  }

  async mergeBranch(entityType, entityId, sourceBranch, targetBranch, mergedBy, commitMessage = null) {
    const source = await this.getBranch(entityType, entityId, sourceBranch);
    if (!source) {
      throw new Error(`Source branch '${sourceBranch}' not found`);
    }

    const sourceVersion = await db.query(
      `SELECT * FROM entity_versions WHERE id = $1`,
      [source.base_version_id]
    );

    if (!sourceVersion.rows[0]) {
      throw new Error('Source version not found');
    }

    const mergedVersion = await this.createVersion(
      entityType,
      entityId,
      sourceVersion.rows[0].data,
      mergedBy,
      commitMessage || `Merged branch '${sourceBranch}' into '${targetBranch}'`
    );

    return {
      mergedVersion,
      sourceBranch: source,
      message: `Successfully merged '${sourceBranch}' into '${targetBranch}'`
    };
  }

  async deleteBranch(entityType, entityId, branchName) {
    const branch = await this.getBranch(entityType, entityId, branchName);
    if (!branch) {
      throw new Error(`Branch '${branchName}' not found`);
    }

    if (branch.is_main) {
      throw new Error('Cannot delete main branch');
    }

    const result = await db.query(
      `DELETE FROM entity_branches
       WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 AND branch_name = $4
       RETURNING *`,
      [this.tenantId, entityType, entityId, branchName]
    );
    return result.rows[0];
  }

  async rollback(entityType, entityId, targetVersionNumber, rolledBackBy, commitMessage = null) {
    const targetVersion = await this.getVersion(entityType, entityId, targetVersionNumber);
    if (!targetVersion) {
      throw new Error(`Version ${targetVersionNumber} not found`);
    }

    const newVersion = await this.createVersion(
      entityType,
      entityId,
      targetVersion.data,
      rolledBackBy,
      commitMessage || `Rolled back to version ${targetVersionNumber}`
    );

    return {
      newVersion,
      rolledBackFrom: await this.getLatestVersionNumber(entityType, entityId) - 1,
      rolledBackTo: targetVersionNumber
    };
  }

  async getDiff(entityType, entityId, fromVersion = null, toVersion = null) {
    const latestVersionNumber = await this.getLatestVersionNumber(entityType, entityId);

    if (toVersion === null) {
      toVersion = latestVersionNumber;
    }
    if (fromVersion === null) {
      fromVersion = Math.max(1, toVersion - 1);
    }

    if (fromVersion === toVersion) {
      return { diff: { added: {}, removed: {}, modified: {} }, message: 'Same version' };
    }

    return this.compareVersions(entityType, entityId, fromVersion, toVersion);
  }

  async getVersionById(versionId) {
    const result = await db.query(
      `SELECT ev.*, u.username as created_by_name
       FROM entity_versions ev
       LEFT JOIN users u ON ev.created_by = u.id
       WHERE ev.id = $1 AND ev.tenant_id = $2`,
      [versionId, this.tenantId]
    );
    return result.rows[0];
  }
}

module.exports = VersionControl;
