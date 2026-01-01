/**
 * Clone Backup Service
 * Backup and restore functionality for clones
 */

const db = require('../../db');
const log = require('../../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class CloneBackup {
  constructor() {
    this.backupDir = path.join(__dirname, '../../backups/clones');
    this.maxBackupsPerClone = 10;
  }

  /**
   * Create backup of a clone
   * @param {string} cloneId - Clone ID
   * @param {string} userId - User ID
   * @param {Object} options - Backup options
   * @returns {Promise<Object>} Backup result
   */
  async createBackup(cloneId, userId, options = {}) {
    try {
      // Verify ownership
      const cloneResult = await db.query(
        `SELECT * FROM work_clones WHERE id = $1 AND user_id = $2`,
        [cloneId, userId]
      );

      if (cloneResult.rows.length === 0) {
        return { success: false, error: 'Clone not found' };
      }

      const clone = cloneResult.rows[0];

      // Get training data
      const trainingResult = await db.query(
        `SELECT * FROM clone_training_data WHERE clone_id = $1`,
        [cloneId]
      );

      // Get responses if requested
      let responses = [];
      if (options.includeResponses) {
        const responsesResult = await db.query(
          `SELECT * FROM clone_responses WHERE clone_id = $1
           ORDER BY created_at DESC LIMIT $2`,
          [cloneId, options.responseLimit || 1000]
        );
        responses = responsesResult.rows;
      }

      // Create backup data
      const backupData = {
        version: '1.0',
        backupId: uuidv4(),
        createdAt: new Date().toISOString(),
        clone: this._sanitizeClone(clone),
        trainingData: trainingResult.rows,
        responses: responses,
        metadata: {
          trainingSamplesCount: trainingResult.rows.length,
          responsesCount: responses.length,
          backupType: options.type || 'manual',
          description: options.description
        }
      };

      // Save to database
      const backupResult = await db.query(
        `INSERT INTO clone_backups (
          clone_id, user_id, backup_id, name, description,
          backup_type, backup_data, file_size
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          cloneId,
          userId,
          backupData.backupId,
          options.name || `Backup ${new Date().toLocaleDateString()}`,
          options.description,
          options.type || 'manual',
          JSON.stringify(backupData),
          JSON.stringify(backupData).length
        ]
      );

      // Save to file system if requested
      if (options.saveToFile) {
        await fs.mkdir(this.backupDir, { recursive: true });
        const filePath = path.join(this.backupDir, `${backupData.backupId}.json`);
        await fs.writeFile(filePath, JSON.stringify(backupData, null, 2));

        await db.query(
          `UPDATE clone_backups SET file_path = $1 WHERE id = $2`,
          [filePath, backupResult.rows[0].id]
        );
      }

      // Cleanup old backups
      await this._cleanupOldBackups(cloneId);

      return {
        success: true,
        backup: {
          id: backupResult.rows[0].id,
          backupId: backupData.backupId,
          name: backupResult.rows[0].name,
          createdAt: backupResult.rows[0].created_at,
          size: backupResult.rows[0].file_size
        }
      };
    } catch (error) {
      log.error('Error creating backup', { error: error.message, cloneId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Restore clone from backup
   * @param {string} backupId - Backup ID (database ID)
   * @param {string} userId - User ID
   * @param {Object} options - Restore options
   * @returns {Promise<Object>} Restore result
   */
  async restoreFromBackup(backupId, userId, options = {}) {
    try {
      // Get backup
      const backupResult = await db.query(
        `SELECT * FROM clone_backups WHERE id = $1 AND user_id = $2`,
        [backupId, userId]
      );

      if (backupResult.rows.length === 0) {
        return { success: false, error: 'Backup not found' };
      }

      const backup = backupResult.rows[0];
      const backupData = typeof backup.backup_data === 'string'
        ? JSON.parse(backup.backup_data)
        : backup.backup_data;

      if (options.createNew) {
        // Create new clone from backup
        return await this._restoreAsNewClone(backupData, userId, backup.clone_id, options);
      } else {
        // Restore to existing clone
        return await this._restoreToExisting(backupData, backup.clone_id, userId, options);
      }
    } catch (error) {
      log.error('Error restoring from backup', { error: error.message, backupId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Restore as new clone
   * @private
   */
  async _restoreAsNewClone(backupData, userId, originalCloneId, options) {
    const cloneData = backupData.clone;

    // Get org ID from original clone
    const orgResult = await db.query(
      `SELECT organization_id FROM work_clones WHERE id = $1`,
      [originalCloneId]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    // Create new clone
    const result = await db.query(
      `INSERT INTO work_clones (
        organization_id, user_id, name, description, avatar_url,
        ai_model, temperature, max_tokens, base_system_prompt,
        personality_prompt, writing_style_prompt, style_profile,
        tone_settings, vocabulary_preferences, response_patterns,
        settings, status, training_score, restored_from_backup_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        orgId,
        userId,
        options.newName || `${cloneData.name} (Restored)`,
        cloneData.description,
        cloneData.avatar_url,
        cloneData.ai_model,
        cloneData.temperature,
        cloneData.max_tokens,
        cloneData.base_system_prompt,
        cloneData.personality_prompt,
        cloneData.writing_style_prompt,
        cloneData.style_profile,
        cloneData.tone_settings,
        cloneData.vocabulary_preferences,
        cloneData.response_patterns,
        cloneData.settings,
        options.keepStatus ? cloneData.status : 'draft',
        cloneData.training_score,
        backupData.backupId
      ]
    );

    const newClone = result.rows[0];

    // Restore training data if requested
    let trainingRestored = 0;
    if (options.includeTrainingData !== false && backupData.trainingData) {
      for (const data of backupData.trainingData) {
        try {
          await db.query(
            `INSERT INTO clone_training_data (
              clone_id, data_type, source, original_content, processed_content,
              extracted_features, style_markers, quality_score, metadata,
              is_processed, is_approved
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              newClone.id,
              data.data_type,
              data.source,
              data.original_content,
              data.processed_content,
              data.extracted_features,
              data.style_markers,
              data.quality_score,
              data.metadata,
              data.is_processed,
              data.is_approved
            ]
          );
          trainingRestored++;
        } catch (err) {
          log.warn('Failed to restore training item', { error: err.message });
        }
      }

      await db.query(
        `UPDATE work_clones SET training_samples_count = $1 WHERE id = $2`,
        [trainingRestored, newClone.id]
      );
    }

    return {
      success: true,
      clone: newClone,
      trainingRestored,
      message: `Clone restored as "${newClone.name}"`
    };
  }

  /**
   * Restore to existing clone
   * @private
   */
  async _restoreToExisting(backupData, cloneId, userId, options) {
    // Verify ownership
    const cloneCheck = await db.query(
      `SELECT id FROM work_clones WHERE id = $1 AND user_id = $2`,
      [cloneId, userId]
    );

    if (cloneCheck.rows.length === 0) {
      return { success: false, error: 'Clone not found' };
    }

    const cloneData = backupData.clone;

    // Create backup of current state first
    if (options.backupCurrent !== false) {
      await this.createBackup(cloneId, userId, {
        type: 'pre-restore',
        description: 'Automatic backup before restore'
      });
    }

    // Update clone
    await db.query(
      `UPDATE work_clones SET
        description = COALESCE($1, description),
        ai_model = COALESCE($2, ai_model),
        temperature = COALESCE($3, temperature),
        max_tokens = COALESCE($4, max_tokens),
        base_system_prompt = COALESCE($5, base_system_prompt),
        personality_prompt = COALESCE($6, personality_prompt),
        writing_style_prompt = COALESCE($7, writing_style_prompt),
        style_profile = COALESCE($8, style_profile),
        tone_settings = COALESCE($9, tone_settings),
        vocabulary_preferences = COALESCE($10, vocabulary_preferences),
        response_patterns = COALESCE($11, response_patterns),
        settings = COALESCE($12, settings),
        status = COALESCE($13, status),
        training_score = COALESCE($14, training_score),
        updated_at = NOW()
      WHERE id = $15`,
      [
        cloneData.description,
        cloneData.ai_model,
        cloneData.temperature,
        cloneData.max_tokens,
        cloneData.base_system_prompt,
        cloneData.personality_prompt,
        cloneData.writing_style_prompt,
        cloneData.style_profile,
        cloneData.tone_settings,
        cloneData.vocabulary_preferences,
        cloneData.response_patterns,
        cloneData.settings,
        options.keepStatus ? null : cloneData.status,
        cloneData.training_score,
        cloneId
      ]
    );

    // Restore training data if requested
    let trainingRestored = 0;
    if (options.includeTrainingData && backupData.trainingData) {
      // Clear existing training data if requested
      if (options.replaceTrainingData) {
        await db.query(`DELETE FROM clone_training_data WHERE clone_id = $1`, [cloneId]);
      }

      for (const data of backupData.trainingData) {
        try {
          await db.query(
            `INSERT INTO clone_training_data (
              clone_id, data_type, source, original_content, metadata
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT DO NOTHING`,
            [
              cloneId,
              data.data_type,
              'restored',
              data.original_content,
              data.metadata
            ]
          );
          trainingRestored++;
        } catch (err) {
          // Skip duplicates
        }
      }
    }

    return {
      success: true,
      cloneId,
      trainingRestored,
      message: 'Clone restored successfully'
    };
  }

  /**
   * Get backups for a clone
   * @param {string} cloneId - Clone ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Backups list
   */
  async getBackups(cloneId, userId) {
    try {
      const result = await db.query(
        `SELECT id, backup_id, name, description, backup_type,
                file_size, created_at
         FROM clone_backups
         WHERE clone_id = $1 AND user_id = $2
         ORDER BY created_at DESC`,
        [cloneId, userId]
      );

      return {
        success: true,
        backups: result.rows.map(b => ({
          id: b.id,
          backupId: b.backup_id,
          name: b.name,
          description: b.description,
          type: b.backup_type,
          size: b.file_size,
          createdAt: b.created_at
        }))
      };
    } catch (error) {
      log.error('Error getting backups', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get backup details
   * @param {string} cloneId - Clone ID
   * @param {string} backupId - Backup ID
   * @param {string} userId - User ID
   * @param {Object} options - Options
   * @returns {Promise<Object>} Backup details
   */
  async getBackupDetails(cloneId, backupId, userId, options = {}) {
    try {
      // Verify clone ownership
      const cloneCheck = await db.query(
        `SELECT id FROM work_clones WHERE id = $1 AND user_id = $2`,
        [cloneId, userId]
      );

      if (cloneCheck.rows.length === 0) {
        return { success: false, error: 'Clone not found' };
      }

      const result = await db.query(
        `SELECT * FROM clone_backups WHERE id = $1 AND clone_id = $2`,
        [backupId, cloneId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Backup not found' };
      }

      const backup = result.rows[0];
      const data = typeof backup.backup_data === 'string'
        ? JSON.parse(backup.backup_data)
        : (backup.data ? JSON.parse(backup.data) : backup.backup_data);

      const response = {
        success: true,
        backup: {
          id: backup.id,
          backupId: backup.backup_id,
          name: backup.name,
          description: backup.description,
          type: backup.backup_type,
          sizeBytes: backup.file_size || backup.size_bytes,
          createdAt: backup.created_at,
          includesTrainingData: backup.includes_training_data
        }
      };

      if (options.includePreview && data) {
        response.backup.preview = {
          cloneName: data.clone?.name,
          samplesCount: data.trainingData?.length || 0
        };
      }

      return response;
    } catch (error) {
      log.error('Error getting backup details', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete backup
   * @param {string} cloneId - Clone ID
   * @param {string} backupId - Backup ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteBackup(cloneId, backupId, userId) {
    try {
      // Verify clone ownership
      const cloneCheck = await db.query(
        `SELECT id FROM work_clones WHERE id = $1 AND user_id = $2`,
        [cloneId, userId]
      );

      if (cloneCheck.rows.length === 0) {
        return { success: false, error: 'Clone not found' };
      }

      const result = await db.query(
        `DELETE FROM clone_backups WHERE id = $1 AND clone_id = $2
         RETURNING file_path`,
        [backupId, cloneId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Backup not found' };
      }

      // Delete file if exists
      if (result.rows[0].file_path) {
        try {
          await fs.unlink(result.rows[0].file_path);
        } catch {
          // File may not exist
        }
      }

      return { success: true, message: 'Backup deleted' };
    } catch (error) {
      log.error('Error deleting backup', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Create automatic backup (for scheduled jobs)
   * @param {string} cloneId - Clone ID
   * @returns {Promise<Object>} Backup result
   */
  async createAutoBackup(cloneId) {
    try {
      const cloneResult = await db.query(
        `SELECT user_id FROM work_clones WHERE id = $1`,
        [cloneId]
      );

      if (cloneResult.rows.length === 0) {
        return { success: false, error: 'Clone not found' };
      }

      return await this.createBackup(cloneId, cloneResult.rows[0].user_id, {
        type: 'automatic',
        description: 'Scheduled automatic backup',
        saveToFile: true
      });
    } catch (error) {
      log.error('Error creating auto backup', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Cleanup old backups for a clone
   * @private
   */
  async _cleanupOldBackups(cloneId) {
    try {
      // Get backup count
      const countResult = await db.query(
        `SELECT COUNT(*) FROM clone_backups WHERE clone_id = $1`,
        [cloneId]
      );

      const count = parseInt(countResult.rows[0].count);

      if (count > this.maxBackupsPerClone) {
        // Delete oldest backups
        const toDelete = count - this.maxBackupsPerClone;

        const oldBackups = await db.query(
          `SELECT id, file_path FROM clone_backups
           WHERE clone_id = $1 AND backup_type = 'automatic'
           ORDER BY created_at ASC
           LIMIT $2`,
          [cloneId, toDelete]
        );

        for (const backup of oldBackups.rows) {
          await db.query(`DELETE FROM clone_backups WHERE id = $1`, [backup.id]);
          if (backup.file_path) {
            try {
              await fs.unlink(backup.file_path);
            } catch {
              // File may not exist
            }
          }
        }
      }
    } catch (error) {
      log.warn('Error cleaning up old backups', { error: error.message });
    }
  }

  /**
   * Sanitize clone data for backup (remove sensitive info)
   * @private
   */
  _sanitizeClone(clone) {
    const sanitized = { ...clone };
    // Remove any API keys or sensitive data
    delete sanitized.api_key;
    delete sanitized.secret;
    return sanitized;
  }

  /**
   * List backups for a clone
   * @param {string} cloneId - Clone ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Backups list
   */
  async listBackups(cloneId, userId) {
    try {
      // Verify ownership
      const cloneCheck = await db.query(
        `SELECT id FROM work_clones WHERE id = $1 AND user_id = $2`,
        [cloneId, userId]
      );

      if (cloneCheck.rows.length === 0) {
        return { success: false, error: 'Clone not found' };
      }

      const result = await db.query(
        `SELECT id, backup_id, name, description, backup_type,
                file_size as size_bytes, created_at, includes_training_data
         FROM clone_backups
         WHERE clone_id = $1 AND user_id = $2
         ORDER BY created_at DESC`,
        [cloneId, userId]
      );

      return {
        success: true,
        backups: result.rows
      };
    } catch (error) {
      log.error('Error listing backups', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Restore backup with clone ID verification
   * @param {string} cloneId - Clone ID
   * @param {string} backupId - Backup ID
   * @param {string} userId - User ID
   * @param {Object} options - Restore options
   * @returns {Promise<Object>} Restore result
   */
  async restoreBackup(cloneId, backupId, userId, options = {}) {
    try {
      // Verify clone ownership
      const cloneCheck = await db.query(
        `SELECT id FROM work_clones WHERE id = $1 AND user_id = $2`,
        [cloneId, userId]
      );

      if (cloneCheck.rows.length === 0) {
        return { success: false, error: 'Clone not found' };
      }

      // Get backup
      const backupResult = await db.query(
        `SELECT * FROM clone_backups WHERE id = $1 AND clone_id = $2`,
        [backupId, cloneId]
      );

      if (backupResult.rows.length === 0) {
        return { success: false, error: 'Backup not found' };
      }

      const backup = backupResult.rows[0];
      const backupData = typeof backup.backup_data === 'string'
        ? JSON.parse(backup.backup_data)
        : (backup.data ? JSON.parse(backup.data) : backup.backup_data);

      if (options.createNew) {
        // Create new clone from backup
        return await this._restoreAsNewClone(backupData, userId, cloneId, options);
      } else {
        // Restore to existing clone
        const cloneData = backupData.clone || backupData;

        const result = await db.query(
          `UPDATE work_clones SET
            config = COALESCE($1, config),
            status = COALESCE($2, status),
            updated_at = NOW()
          WHERE id = $3
          RETURNING *`,
          [
            JSON.stringify(cloneData.config || {}),
            cloneData.status || 'active',
            cloneId
          ]
        );

        // Restore training data if requested
        if (options.includeTrainingData && backupData.trainingData) {
          for (const item of backupData.trainingData) {
            try {
              await db.query(
                `INSERT INTO clone_training_data (clone_id, input, output)
                 VALUES ($1, $2, $3)
                 ON CONFLICT DO NOTHING`,
                [cloneId, item.input, item.output]
              );
            } catch {
              // Skip duplicates
            }
          }
        }

        return {
          success: true,
          clone: result.rows[0]
        };
      }
    } catch (error) {
      log.error('Error restoring backup', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete backup with clone ID verification
   * @param {string} cloneId - Clone ID
   * @param {string} backupId - Backup ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteBackupWithClone(cloneId, backupId, userId) {
    try {
      // Verify clone ownership
      const cloneCheck = await db.query(
        `SELECT id FROM work_clones WHERE id = $1 AND user_id = $2`,
        [cloneId, userId]
      );

      if (cloneCheck.rows.length === 0) {
        return { success: false, error: 'Clone not found' };
      }

      const result = await db.query(
        `DELETE FROM clone_backups WHERE id = $1 AND clone_id = $2
         RETURNING file_path`,
        [backupId, cloneId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Backup not found' };
      }

      return { success: true, message: 'Backup deleted' };
    } catch (error) {
      log.error('Error deleting backup', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get backup details with clone ID verification
   * @param {string} cloneId - Clone ID
   * @param {string} backupId - Backup ID
   * @param {string} userId - User ID
   * @param {Object} options - Options
   * @returns {Promise<Object>} Backup details
   */
  async getBackupDetailsWithClone(cloneId, backupId, userId, options = {}) {
    try {
      // Verify clone ownership
      const cloneCheck = await db.query(
        `SELECT id FROM work_clones WHERE id = $1 AND user_id = $2`,
        [cloneId, userId]
      );

      if (cloneCheck.rows.length === 0) {
        return { success: false, error: 'Clone not found' };
      }

      const result = await db.query(
        `SELECT * FROM clone_backups WHERE id = $1 AND clone_id = $2`,
        [backupId, cloneId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Backup not found' };
      }

      const backup = result.rows[0];
      const data = typeof backup.backup_data === 'string'
        ? JSON.parse(backup.backup_data)
        : (backup.data ? JSON.parse(backup.data) : backup.backup_data);

      const response = {
        success: true,
        backup: {
          id: backup.id,
          backupId: backup.backup_id,
          description: backup.description,
          sizeBytes: backup.file_size || backup.size_bytes,
          createdAt: backup.created_at,
          includesTrainingData: backup.includes_training_data
        }
      };

      if (options.includePreview && data) {
        response.backup.preview = {
          cloneName: data.clone?.name,
          samplesCount: data.trainingData?.length || 0
        };
      }

      return response;
    } catch (error) {
      log.error('Error getting backup details', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up old backups for a user
   * @param {string} userId - User ID
   * @param {Object} options - Cleanup options
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupOldBackups(userId, options = {}) {
    try {
      const retentionDays = options.retentionDays || 30;
      const maxBackupsPerClone = options.maxBackupsPerClone || 10;

      // Find old backups
      const oldBackups = await db.query(
        `SELECT cb.id, cb.file_path
         FROM clone_backups cb
         JOIN work_clones wc ON wc.id = cb.clone_id
         WHERE wc.user_id = $1
           AND (cb.created_at < NOW() - INTERVAL '${retentionDays} days'
                OR cb.backup_type = 'automatic')
         ORDER BY cb.created_at ASC`,
        [userId]
      );

      let deletedCount = 0;
      for (const backup of oldBackups.rows) {
        try {
          await db.query(`DELETE FROM clone_backups WHERE id = $1`, [backup.id]);
          if (backup.file_path) {
            try {
              await fs.unlink(backup.file_path);
            } catch {
              // File may not exist
            }
          }
          deletedCount++;
        } catch {
          // Continue with other deletions
        }
      }

      return {
        success: true,
        deletedCount
      };
    } catch (error) {
      log.error('Error cleaning up old backups', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Schedule automatic backup for a clone
   * @param {string} cloneId - Clone ID
   * @param {string} userId - User ID
   * @param {Object} options - Schedule options
   * @returns {Promise<Object>} Schedule result
   */
  async scheduleAutoBackup(cloneId, userId, options = {}) {
    try {
      // Verify clone ownership
      const cloneCheck = await db.query(
        `SELECT id FROM work_clones WHERE id = $1 AND user_id = $2`,
        [cloneId, userId]
      );

      if (cloneCheck.rows.length === 0) {
        return { success: false, error: 'Clone not found' };
      }

      const frequency = options.frequency || 'weekly';
      const retentionCount = options.retentionCount || 7;

      if (frequency === 'none') {
        // Disable auto backup
        await db.query(
          `DELETE FROM clone_backup_schedules WHERE clone_id = $1`,
          [cloneId]
        );
        return { success: true, schedule: null };
      }

      // Create or update schedule
      const result = await db.query(
        `INSERT INTO clone_backup_schedules (clone_id, user_id, frequency, retention_count)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (clone_id)
         DO UPDATE SET frequency = $3, retention_count = $4, updated_at = NOW()
         RETURNING *`,
        [cloneId, userId, frequency, retentionCount]
      );

      return {
        success: true,
        schedule: result.rows[0]
      };
    } catch (error) {
      log.error('Error scheduling auto backup', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get storage usage for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Storage usage
   */
  async getStorageUsage(userId) {
    try {
      const result = await db.query(
        `SELECT
          COUNT(*) as total_backups,
          COALESCE(SUM(file_size), 0) as total_size_bytes,
          COUNT(DISTINCT clone_id) as clones_with_backups
         FROM clone_backups cb
         JOIN work_clones wc ON wc.id = cb.clone_id
         WHERE wc.user_id = $1`,
        [userId]
      );

      const stats = result.rows[0] || {};
      const totalSizeBytes = parseInt(stats.total_size_bytes) || 0;

      return {
        success: true,
        usage: {
          totalBackups: parseInt(stats.total_backups) || 0,
          totalSizeBytes,
          totalSizeMB: totalSizeBytes / (1024 * 1024),
          clonesWithBackups: parseInt(stats.clones_with_backups) || 0
        }
      };
    } catch (error) {
      log.error('Error getting storage usage', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = new CloneBackup();
