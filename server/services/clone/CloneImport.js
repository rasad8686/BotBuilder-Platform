/**
 * Clone Import Service
 * Handles importing clone data from various formats
 */

const db = require('../../db');
const log = require('../../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const unzipper = require('unzipper');
const { v4: uuidv4 } = require('uuid');

class CloneImport {
  constructor() {
    this.uploadDir = path.join(__dirname, '../../uploads/clone-imports');
    this.supportedVersions = ['1.0'];
  }

  /**
   * Import clone from JSON data
   * @param {Object} data - Clone data object
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importFromJson(data, userId, orgId, options = {}) {
    try {
      // Validate import data
      const validation = this._validateImportData(data);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const cloneData = data.clone || data;

      // Check for name conflicts
      if (!options.overwrite) {
        const existing = await db.query(
          `SELECT id FROM work_clones WHERE user_id = $1 AND name = $2`,
          [userId, cloneData.name]
        );

        if (existing.rows.length > 0) {
          if (options.rename) {
            cloneData.name = `${cloneData.name} (Imported ${new Date().toLocaleDateString()})`;
          } else {
            return {
              success: false,
              error: 'Clone with this name already exists',
              existingId: existing.rows[0].id
            };
          }
        }
      }

      // Create the clone
      const result = await db.query(
        `INSERT INTO work_clones (
          organization_id, user_id, name, description, ai_model, temperature, max_tokens,
          base_system_prompt, personality_prompt, writing_style_prompt,
          style_profile, tone_settings, vocabulary_preferences, response_patterns,
          settings, status, training_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *`,
        [
          orgId,
          userId,
          cloneData.name,
          cloneData.description,
          cloneData.aiModel || 'gpt-4',
          cloneData.temperature || 0.7,
          cloneData.maxTokens || 2048,
          cloneData.baseSystemPrompt,
          cloneData.personalityPrompt,
          cloneData.writingStylePrompt,
          JSON.stringify(cloneData.styleProfile || {}),
          JSON.stringify(cloneData.toneSettings || {}),
          JSON.stringify(cloneData.vocabularyPreferences || {}),
          JSON.stringify(cloneData.responsePatterns || {}),
          JSON.stringify(cloneData.settings || {}),
          cloneData.trainingScore ? 'ready' : 'draft',
          cloneData.trainingScore || 0
        ]
      );

      const newClone = result.rows[0];

      // Import training data if included
      let trainingImported = 0;
      if (data.trainingData && Array.isArray(data.trainingData)) {
        for (const item of data.trainingData) {
          try {
            await db.query(
              `INSERT INTO clone_training_data (
                clone_id, data_type, source, original_content, processed_content,
                extracted_features, style_markers, quality_score, metadata, is_processed
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [
                newClone.id,
                item.data_type || 'text',
                item.source || 'import',
                item.original_content,
                item.processed_content,
                JSON.stringify(item.extracted_features || {}),
                JSON.stringify(item.style_markers || {}),
                item.quality_score || 0,
                JSON.stringify(item.metadata || {}),
                !!item.processed_content
              ]
            );
            trainingImported++;
          } catch (err) {
            log.warn('Failed to import training item', { error: err.message });
          }
        }

        // Update training count
        await db.query(
          `UPDATE work_clones SET training_samples_count = $1 WHERE id = $2`,
          [trainingImported, newClone.id]
        );
      }

      return {
        success: true,
        clone: newClone,
        trainingImported,
        message: `Clone "${newClone.name}" imported successfully`
      };
    } catch (error) {
      log.error('Error importing clone from JSON', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Import clone from ZIP file
   * @param {string} filePath - Path to ZIP file
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importFromZip(filePath, userId, orgId, options = {}) {
    try {
      const extractDir = path.join(this.uploadDir, `extract-${uuidv4()}`);
      await fs.mkdir(extractDir, { recursive: true });

      // Extract ZIP
      await new Promise((resolve, reject) => {
        const readStream = require('fs').createReadStream(filePath);
        readStream
          .pipe(unzipper.Extract({ path: extractDir }))
          .on('close', resolve)
          .on('error', reject);
      });

      // Find and read clone-data.json
      const dataPath = path.join(extractDir, 'clone-data.json');
      const dataExists = await fs.access(dataPath).then(() => true).catch(() => false);

      if (!dataExists) {
        await this._cleanup(extractDir);
        return { success: false, error: 'Invalid export: clone-data.json not found' };
      }

      const dataContent = await fs.readFile(dataPath, 'utf-8');
      const data = JSON.parse(dataContent);

      // Import using JSON importer
      const result = await this.importFromJson(data, userId, orgId, options);

      // Cleanup
      await this._cleanup(extractDir);

      return result;
    } catch (error) {
      log.error('Error importing clone from ZIP', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Import multiple clones from bulk export
   * @param {Object} data - Bulk export data
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importBulk(data, userId, orgId, options = {}) {
    try {
      const validation = this._validateBulkImportData(data);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const results = {
        imported: [],
        failed: [],
        skipped: []
      };

      const clones = data.clones || [data];

      for (const cloneData of clones) {
        const result = await this.importFromJson(
          { clone: cloneData.clone || cloneData },
          userId,
          orgId,
          { ...options, rename: true }
        );

        if (result.success) {
          results.imported.push({
            name: result.clone.name,
            id: result.clone.id
          });
        } else {
          results.failed.push({
            name: cloneData.clone?.name || cloneData.name,
            error: result.error
          });
        }
      }

      return {
        success: true,
        ...results,
        summary: {
          total: clones.length,
          imported: results.imported.length,
          failed: results.failed.length
        }
      };
    } catch (error) {
      log.error('Error importing bulk clones', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate import and preview what will be imported
   * @param {Object} data - Import data
   * @returns {Object} Preview information
   */
  async previewImport(data) {
    try {
      const validation = this._validateImportData(data);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const clone = data.clone || data;

      return {
        success: true,
        preview: {
          name: clone.name,
          description: clone.description,
          aiModel: clone.aiModel,
          hasTrainingData: !!(data.trainingData && data.trainingData.length > 0),
          trainingDataCount: data.trainingData?.length || 0,
          hasResponses: !!(data.responses && data.responses.length > 0),
          responsesCount: data.responses?.length || 0,
          trainingScore: clone.trainingScore || 0,
          exportedAt: data.exportedAt,
          version: data.version
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Merge imported clone with existing clone
   * @param {string} existingCloneId - Existing clone ID
   * @param {Object} importData - Import data
   * @param {string} userId - User ID
   * @param {Object} options - Merge options
   * @returns {Promise<Object>} Merge result
   */
  async mergeWithExisting(existingCloneId, importData, userId, options = {}) {
    try {
      // Get existing clone
      const existing = await db.query(
        `SELECT * FROM work_clones WHERE id = $1 AND user_id = $2`,
        [existingCloneId, userId]
      );

      if (existing.rows.length === 0) {
        return { success: false, error: 'Existing clone not found' };
      }

      const clone = existing.rows[0];
      const newData = importData.clone || importData;

      // Merge settings based on options
      const mergedSettings = options.preferExisting
        ? { ...this._parseJson(newData.settings), ...this._parseJson(clone.settings) }
        : { ...this._parseJson(clone.settings), ...this._parseJson(newData.settings) };

      // Update clone
      await db.query(
        `UPDATE work_clones SET
          settings = $1,
          style_profile = COALESCE($2, style_profile),
          tone_settings = COALESCE($3, tone_settings),
          updated_at = NOW()
        WHERE id = $4`,
        [
          JSON.stringify(mergedSettings),
          options.mergeStyleProfile ? JSON.stringify(newData.styleProfile) : null,
          options.mergeToneSettings ? JSON.stringify(newData.toneSettings) : null,
          existingCloneId
        ]
      );

      // Add new training data if requested
      let trainingAdded = 0;
      if (options.mergeTrainingData && importData.trainingData) {
        for (const item of importData.trainingData) {
          try {
            await db.query(
              `INSERT INTO clone_training_data (
                clone_id, data_type, source, original_content, metadata
              ) VALUES ($1, $2, $3, $4, $5)`,
              [
                existingCloneId,
                item.data_type || 'text',
                'import-merge',
                item.original_content,
                JSON.stringify(item.metadata || {})
              ]
            );
            trainingAdded++;
          } catch (err) {
            // Skip duplicates
          }
        }
      }

      return {
        success: true,
        cloneId: existingCloneId,
        trainingAdded,
        message: 'Clone merged successfully'
      };
    } catch (error) {
      log.error('Error merging clone', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate import data structure
   * @private
   */
  _validateImportData(data) {
    if (!data) {
      return { valid: false, error: 'No import data provided' };
    }

    if (data.version && !this.supportedVersions.includes(data.version)) {
      return { valid: false, error: `Unsupported export version: ${data.version}` };
    }

    const clone = data.clone || data;

    if (!clone.name) {
      return { valid: false, error: 'Clone name is required' };
    }

    return { valid: true };
  }

  /**
   * Validate bulk import data
   * @private
   */
  _validateBulkImportData(data) {
    if (!data) {
      return { valid: false, error: 'No import data provided' };
    }

    if (!data.clones || !Array.isArray(data.clones)) {
      return { valid: false, error: 'Invalid bulk import format' };
    }

    if (data.clones.length === 0) {
      return { valid: false, error: 'No clones to import' };
    }

    return { valid: true };
  }

  /**
   * Parse JSON safely
   * @private
   */
  _parseJson(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  /**
   * Cleanup temporary directory
   * @private
   */
  async _cleanup(dir) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      log.warn('Failed to cleanup directory', { dir, error: error.message });
    }
  }
}

module.exports = CloneImport;
