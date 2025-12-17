/**
 * Version Service
 *
 * Handles model version management:
 * - Create and manage model versions
 * - Set active and production versions
 * - Version comparison and rollback
 */

const db = require('../db');
const log = require('../utils/logger');

/**
 * Create a new version for a model
 * @param {number} modelId - Fine-tune model ID
 * @param {Object} data - Version data
 * @returns {Promise<Object>} - Created version
 */
async function createVersion(modelId, data) {
  try {
    // Get the next version number
    const lastVersion = await db.query(
      `SELECT version_number FROM model_versions
       WHERE fine_tune_model_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [modelId]
    );

    let versionNumber = data.version_number;
    if (!versionNumber) {
      if (lastVersion.rows.length === 0) {
        versionNumber = 'v1.0';
      } else {
        // Parse and increment version
        const last = lastVersion.rows[0].version_number;
        const match = last.match(/v(\d+)\.(\d+)/);
        if (match) {
          const major = parseInt(match[1]);
          const minor = parseInt(match[2]) + 1;
          versionNumber = `v${major}.${minor}`;
        } else {
          versionNumber = 'v1.0';
        }
      }
    }

    // Get openai_model_id from the fine_tune_model if not provided
    let openaiModelId = data.openai_model_id;
    if (!openaiModelId) {
      const modelResult = await db.query(
        'SELECT model_id FROM fine_tune_models WHERE id = $1',
        [modelId]
      );
      if (modelResult.rows.length > 0) {
        openaiModelId = modelResult.rows[0].model_id;
      }
    }

    const result = await db.query(
      `INSERT INTO model_versions (
        fine_tune_model_id, version_number, openai_model_id,
        description, is_active, is_production, performance_score, metrics
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        modelId,
        versionNumber,
        openaiModelId || null,
        data.description || null,
        data.is_active || false,
        data.is_production || false,
        data.performance_score || null,
        JSON.stringify(data.metrics || {})
      ]
    );

    // If this is the first version, make it active
    if (lastVersion.rows.length === 0) {
      await db.query(
        'UPDATE model_versions SET is_active = true WHERE id = $1',
        [result.rows[0].id]
      );
      result.rows[0].is_active = true;
    }

    log.info('Model version created', {
      modelId,
      versionId: result.rows[0].id,
      versionNumber
    });

    return result.rows[0];
  } catch (err) {
    log.error('Failed to create version', { error: err.message, modelId });
    throw err;
  }
}

/**
 * Get all versions for a model
 * @param {number} modelId - Fine-tune model ID
 * @returns {Promise<Array>} - List of versions
 */
async function getVersions(modelId) {
  const result = await db.query(
    `SELECT v.*, m.name as model_name
     FROM model_versions v
     JOIN fine_tune_models m ON v.fine_tune_model_id = m.id
     WHERE v.fine_tune_model_id = $1
     ORDER BY v.created_at DESC`,
    [modelId]
  );

  return result.rows;
}

/**
 * Get a single version by ID
 * @param {number} versionId - Version ID
 * @returns {Promise<Object|null>} - Version or null
 */
async function getVersion(versionId) {
  const result = await db.query(
    `SELECT v.*, m.name as model_name, m.base_model
     FROM model_versions v
     JOIN fine_tune_models m ON v.fine_tune_model_id = m.id
     WHERE v.id = $1`,
    [versionId]
  );

  return result.rows[0] || null;
}

/**
 * Update a version
 * @param {number} versionId - Version ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} - Updated version
 */
async function updateVersion(versionId, data) {
  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.performance_score !== undefined) {
    updates.push(`performance_score = $${paramIndex++}`);
    values.push(data.performance_score);
  }
  if (data.metrics !== undefined) {
    updates.push(`metrics = $${paramIndex++}`);
    values.push(JSON.stringify(data.metrics));
  }

  if (updates.length === 0) {
    return getVersion(versionId);
  }

  values.push(versionId);

  const result = await db.query(
    `UPDATE model_versions SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0];
}

/**
 * Set a version as active (for the model)
 * @param {number} versionId - Version ID
 * @returns {Promise<Object>} - Updated version
 */
async function setActiveVersion(versionId) {
  // Get the model ID first
  const version = await getVersion(versionId);
  if (!version) {
    throw new Error('Version not found');
  }

  // Deactivate all versions for this model
  await db.query(
    `UPDATE model_versions SET is_active = false
     WHERE fine_tune_model_id = $1`,
    [version.fine_tune_model_id]
  );

  // Activate the selected version
  const result = await db.query(
    `UPDATE model_versions SET is_active = true
     WHERE id = $1
     RETURNING *`,
    [versionId]
  );

  log.info('Active version changed', {
    modelId: version.fine_tune_model_id,
    versionId
  });

  return result.rows[0];
}

/**
 * Set a version as production
 * @param {number} versionId - Version ID
 * @returns {Promise<Object>} - Updated version
 */
async function setProductionVersion(versionId) {
  // Get the model ID first
  const version = await getVersion(versionId);
  if (!version) {
    throw new Error('Version not found');
  }

  // Remove production flag from all versions for this model
  await db.query(
    `UPDATE model_versions SET is_production = false
     WHERE fine_tune_model_id = $1`,
    [version.fine_tune_model_id]
  );

  // Set production flag on selected version
  const result = await db.query(
    `UPDATE model_versions SET is_production = true
     WHERE id = $1
     RETURNING *`,
    [versionId]
  );

  log.info('Production version changed', {
    modelId: version.fine_tune_model_id,
    versionId
  });

  return result.rows[0];
}

/**
 * Compare multiple versions
 * @param {Array<number>} versionIds - Array of version IDs
 * @returns {Promise<Array>} - Comparison data
 */
async function compareVersions(versionIds) {
  if (!versionIds || versionIds.length === 0) return [];

  const placeholders = versionIds.map((_, i) => `$${i + 1}`).join(', ');

  const result = await db.query(
    `SELECT
      v.id,
      v.version_number,
      v.description,
      v.is_active,
      v.is_production,
      v.performance_score,
      v.metrics,
      v.created_at,
      m.name as model_name,
      m.base_model,
      (SELECT AVG(response_time_ms) FROM ab_test_results WHERE version_id = v.id) as avg_response_time,
      (SELECT AVG(user_rating) FROM ab_test_results WHERE version_id = v.id AND user_rating IS NOT NULL) as avg_rating,
      (SELECT COUNT(*) FROM ab_test_results WHERE version_id = v.id AND is_preferred = true) as preference_count
     FROM model_versions v
     JOIN fine_tune_models m ON v.fine_tune_model_id = m.id
     WHERE v.id IN (${placeholders})
     ORDER BY v.created_at DESC`,
    versionIds
  );

  return result.rows.map(row => ({
    id: row.id,
    versionNumber: row.version_number,
    description: row.description,
    isActive: row.is_active,
    isProduction: row.is_production,
    performanceScore: parseFloat(row.performance_score) || null,
    metrics: row.metrics || {},
    createdAt: row.created_at,
    modelName: row.model_name,
    baseModel: row.base_model,
    avgResponseTime: parseInt(row.avg_response_time) || null,
    avgRating: parseFloat(row.avg_rating) || null,
    preferenceCount: parseInt(row.preference_count) || 0
  }));
}

/**
 * Rollback to a specific version
 * @param {number} modelId - Fine-tune model ID
 * @param {number} versionId - Version to rollback to
 * @returns {Promise<Object>} - Activated version
 */
async function rollbackVersion(modelId, versionId) {
  // Verify the version belongs to this model
  const version = await db.query(
    `SELECT * FROM model_versions
     WHERE id = $1 AND fine_tune_model_id = $2`,
    [versionId, modelId]
  );

  if (version.rows.length === 0) {
    throw new Error('Version not found for this model');
  }

  // Set this version as active and production
  await setActiveVersion(versionId);
  const result = await setProductionVersion(versionId);

  // Update the fine_tune_model to use this version's openai_model_id
  if (version.rows[0].openai_model_id) {
    await db.query(
      `UPDATE fine_tune_models SET model_id = $1
       WHERE id = $2`,
      [version.rows[0].openai_model_id, modelId]
    );
  }

  log.info('Rollback completed', { modelId, versionId });

  return result;
}

/**
 * Delete a version
 * @param {number} versionId - Version ID
 * @returns {Promise<boolean>} - Success status
 */
async function deleteVersion(versionId) {
  const version = await getVersion(versionId);
  if (!version) {
    throw new Error('Version not found');
  }

  // Don't allow deleting the only version
  const countResult = await db.query(
    `SELECT COUNT(*) FROM model_versions
     WHERE fine_tune_model_id = $1`,
    [version.fine_tune_model_id]
  );

  if (parseInt(countResult.rows[0].count) <= 1) {
    throw new Error('Cannot delete the only version');
  }

  // Don't allow deleting active or production versions
  if (version.is_active || version.is_production) {
    throw new Error('Cannot delete active or production version');
  }

  await db.query('DELETE FROM model_versions WHERE id = $1', [versionId]);

  log.info('Version deleted', { versionId });

  return true;
}

/**
 * Get active version for a model
 * @param {number} modelId - Fine-tune model ID
 * @returns {Promise<Object|null>} - Active version or null
 */
async function getActiveVersion(modelId) {
  const result = await db.query(
    `SELECT * FROM model_versions
     WHERE fine_tune_model_id = $1 AND is_active = true
     LIMIT 1`,
    [modelId]
  );

  return result.rows[0] || null;
}

/**
 * Get production version for a model
 * @param {number} modelId - Fine-tune model ID
 * @returns {Promise<Object|null>} - Production version or null
 */
async function getProductionVersion(modelId) {
  const result = await db.query(
    `SELECT * FROM model_versions
     WHERE fine_tune_model_id = $1 AND is_production = true
     LIMIT 1`,
    [modelId]
  );

  return result.rows[0] || null;
}

module.exports = {
  createVersion,
  getVersions,
  getVersion,
  updateVersion,
  setActiveVersion,
  setProductionVersion,
  compareVersions,
  rollbackVersion,
  deleteVersion,
  getActiveVersion,
  getProductionVersion
};
