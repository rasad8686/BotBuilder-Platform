/**
 * Clone Export Service
 * Handles exporting clone data in various formats
 */

const db = require('../../db');
const log = require('../../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');

class CloneExport {
  constructor() {
    this.exportDir = path.join(__dirname, '../../exports/clones');
    this.supportedFormats = ['json', 'zip', 'yaml'];
  }

  /**
   * Export clone data to JSON format
   * @param {string} cloneId - Clone ID to export
   * @param {string} userId - User ID for verification
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result with data or file path
   */
  async exportToJson(cloneId, userId, options = {}) {
    try {
      // Get clone data
      const cloneResult = await db.query(
        `SELECT * FROM work_clones WHERE id = $1 AND user_id = $2`,
        [cloneId, userId]
      );

      if (cloneResult.rows.length === 0) {
        return { success: false, error: 'Clone not found' };
      }

      const clone = cloneResult.rows[0];

      // Get training data if requested
      let trainingData = [];
      if (options.includeTrainingData) {
        const trainingResult = await db.query(
          `SELECT data_type, source, original_content, processed_content,
                  extracted_features, style_markers, quality_score, metadata
           FROM clone_training_data WHERE clone_id = $1`,
          [cloneId]
        );
        trainingData = trainingResult.rows;
      }

      // Get responses if requested
      let responses = [];
      if (options.includeResponses) {
        const responsesResult = await db.query(
          `SELECT input_prompt, generated_response, response_type, rating,
                  feedback, similarity_score
           FROM clone_responses WHERE clone_id = $1
           ORDER BY created_at DESC LIMIT $2`,
          [cloneId, options.responseLimit || 100]
        );
        responses = responsesResult.rows;
      }

      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        clone: {
          name: clone.name,
          description: clone.description,
          aiModel: clone.ai_model,
          temperature: clone.temperature,
          maxTokens: clone.max_tokens,
          baseSystemPrompt: clone.base_system_prompt,
          personalityPrompt: clone.personality_prompt,
          writingStylePrompt: clone.writing_style_prompt,
          styleProfile: this._parseJson(clone.style_profile),
          toneSettings: this._parseJson(clone.tone_settings),
          vocabularyPreferences: this._parseJson(clone.vocabulary_preferences),
          responsePatterns: this._parseJson(clone.response_patterns),
          settings: this._parseJson(clone.settings),
          trainingScore: clone.training_score
        },
        trainingData: options.includeTrainingData ? trainingData : undefined,
        responses: options.includeResponses ? responses : undefined,
        metadata: {
          trainingSamplesCount: clone.training_samples_count,
          status: clone.status,
          lastTrainedAt: clone.last_trained_at
        }
      };

      if (options.saveToFile) {
        const fileName = `clone-${cloneId}-${Date.now()}.json`;
        const filePath = path.join(this.exportDir, fileName);

        await fs.mkdir(this.exportDir, { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));

        return {
          success: true,
          filePath,
          fileName,
          size: JSON.stringify(exportData).length
        };
      }

      return { success: true, data: exportData };
    } catch (error) {
      log.error('Error exporting clone to JSON', { error: error.message, cloneId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Export clone with all assets as ZIP
   * @param {string} cloneId - Clone ID
   * @param {string} userId - User ID
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result with file path
   */
  async exportToZip(cloneId, userId, options = {}) {
    try {
      // Get JSON export first
      const jsonExport = await this.exportToJson(cloneId, userId, {
        includeTrainingData: true,
        includeResponses: options.includeResponses || false
      });

      if (!jsonExport.success) {
        return jsonExport;
      }

      const exportId = uuidv4();
      const zipFileName = `clone-export-${cloneId}-${exportId}.zip`;
      const zipPath = path.join(this.exportDir, zipFileName);

      await fs.mkdir(this.exportDir, { recursive: true });

      // Create ZIP archive
      const output = require('fs').createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      return new Promise((resolve, reject) => {
        output.on('close', async () => {
          const stats = await fs.stat(zipPath);
          resolve({
            success: true,
            filePath: zipPath,
            fileName: zipFileName,
            size: stats.size,
            exportId
          });
        });

        archive.on('error', (err) => {
          reject({ success: false, error: err.message });
        });

        archive.pipe(output);

        // Add clone data JSON
        archive.append(JSON.stringify(jsonExport.data, null, 2), { name: 'clone-data.json' });

        // Add README
        const readme = this._generateReadme(jsonExport.data.clone);
        archive.append(readme, { name: 'README.md' });

        // Add sample prompts
        if (jsonExport.data.clone.baseSystemPrompt) {
          archive.append(jsonExport.data.clone.baseSystemPrompt, { name: 'prompts/system-prompt.txt' });
        }
        if (jsonExport.data.clone.personalityPrompt) {
          archive.append(jsonExport.data.clone.personalityPrompt, { name: 'prompts/personality-prompt.txt' });
        }
        if (jsonExport.data.clone.writingStylePrompt) {
          archive.append(jsonExport.data.clone.writingStylePrompt, { name: 'prompts/style-prompt.txt' });
        }

        archive.finalize();
      });
    } catch (error) {
      log.error('Error exporting clone to ZIP', { error: error.message, cloneId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Export multiple clones
   * @param {string[]} cloneIds - Array of clone IDs
   * @param {string} userId - User ID
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportMultiple(cloneIds, userId, options = {}) {
    try {
      const exports = [];
      const failed = [];

      for (const cloneId of cloneIds) {
        const result = await this.exportClone(cloneId, userId, options);
        if (result.success) {
          exports.push({ cloneId, data: result.data });
        } else {
          failed.push({ cloneId, error: result.error });
        }
      }

      if (options.saveToFile) {
        const exportId = uuidv4();
        const fileName = `clones-export-${exportId}.json`;
        const filePath = path.join(this.exportDir, fileName);

        await fs.mkdir(this.exportDir, { recursive: true });
        await fs.writeFile(filePath, JSON.stringify({
          version: '1.0',
          exportedAt: new Date().toISOString(),
          clones: exports.map(e => e.data),
          failed
        }, null, 2));

        return { success: true, filePath, fileName, count: exports.length, failed };
      }

      return { success: true, exports, failed };
    } catch (error) {
      log.error('Error exporting multiple clones', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get export download URL
   * @param {string} exportId - Export ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Download info
   */
  async getDownloadUrl(exportId, userId) {
    try {
      // In production, this would generate a signed URL
      const filePath = path.join(this.exportDir, `clone-export-*-${exportId}.zip`);

      // Check if file exists
      const files = await fs.readdir(this.exportDir);
      const matchingFile = files.find(f => f.includes(exportId));

      if (!matchingFile) {
        return { success: false, error: 'Export not found' };
      }

      return {
        success: true,
        downloadUrl: `/api/clones/exports/${exportId}/download`,
        fileName: matchingFile,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      };
    } catch (error) {
      log.error('Error getting download URL', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Export clone (wrapper for exportToJson with format support)
   * @param {string} cloneId - Clone ID
   * @param {string} userId - User ID
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportClone(cloneId, userId, options = {}) {
    try {
      const result = await db.query(
        `SELECT * FROM work_clones WHERE id = $1 AND user_id = $2`,
        [cloneId, userId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Clone not found or unauthorized' };
      }

      const clone = result.rows[0];

      let trainingData = [];
      if (options.includeTrainingData) {
        const trainingResult = await db.query(
          `SELECT * FROM clone_training_data WHERE clone_id = $1`,
          [cloneId]
        );
        trainingData = trainingResult.rows;
      }

      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        clone: {
          id: clone.id,
          name: clone.name,
          type: clone.type || 'personality',
          config: this._parseJson(clone.config) || clone.style_profile || {},
          status: clone.status,
          created_at: clone.created_at,
          updated_at: clone.updated_at
        },
        trainingData: options.includeTrainingData ? trainingData : undefined
      };

      return {
        success: true,
        data: JSON.stringify(exportData),
        format: options.format || 'json'
      };
    } catch (error) {
      log.error('Error exporting clone', { error: error.message, cloneId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get export history for user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Export history
   */
  async getExportHistory(userId, options = {}) {
    try {
      const limit = options.limit || 50;
      const result = await db.query(
        `SELECT id, clone_id, format, file_size, created_at
         FROM clone_exports
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return { success: true, history: result.rows };
    } catch (error) {
      log.error('Error getting export history', { error: error.message, userId });
      return { success: true, history: [] }; // Return empty on error
    }
  }

  /**
   * Clean up old exports
   * @param {number} maxAgeDays - Maximum age in days
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupOldExports(maxAgeDays = 7) {
    try {
      const files = await fs.readdir(this.exportDir);
      const now = Date.now();
      const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.exportDir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      return { success: true, deletedCount };
    } catch (error) {
      log.error('Error cleaning up exports', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate README for export
   * @private
   */
  _generateReadme(clone) {
    return `# Clone Export: ${clone.name}

## Description
${clone.description || 'No description provided'}

## Settings
- AI Model: ${clone.aiModel}
- Temperature: ${clone.temperature}
- Max Tokens: ${clone.maxTokens}

## Files Included
- \`clone-data.json\` - Complete clone configuration
- \`prompts/\` - System prompts and personality settings

## Import Instructions
1. Go to Clone Dashboard
2. Click "Import Clone"
3. Select this ZIP file or upload clone-data.json
4. Review settings and confirm

## Notes
- Training data may need to be re-processed after import
- API keys and sensitive data are not included

Exported at: ${new Date().toISOString()}
`;
  }

  /**
   * Parse JSON safely
   * @private
   */
  _parseJson(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}

module.exports = new CloneExport();
