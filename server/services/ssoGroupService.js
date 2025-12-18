/**
 * SSO Group Mapping Service
 * Maps IdP groups to application roles
 */

const db = require('../db');
const log = require('../utils/logger');

class SSOGroupService {
  /**
   * Create group mapping
   * @param {number} configId - SSO Configuration ID
   * @param {Object} data - Mapping data
   * @returns {Object} Created mapping
   */
  static async createMapping(configId, data) {
    try {
      const result = await db.query(
        `INSERT INTO sso_group_mappings (sso_configuration_id, external_group_id, external_group_name, role_id, is_default, priority)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [configId, data.external_group_id, data.external_group_name, data.role_id, data.is_default || false, data.priority || 0]
      );

      log.info('SSO group mapping created', { configId, groupId: data.external_group_id });

      return result.rows[0];
    } catch (error) {
      log.error('Error creating group mapping:', { error: error.message });
      throw error;
    }
  }

  /**
   * Get all mappings for configuration
   * @param {number} configId - SSO Configuration ID
   * @returns {Array} Mappings with role info
   */
  static async getMappings(configId) {
    try {
      const result = await db.query(
        `SELECT gm.*, r.name as role_name, r.description as role_description
         FROM sso_group_mappings gm
         LEFT JOIN roles r ON gm.role_id = r.id
         WHERE gm.sso_configuration_id = $1
         ORDER BY gm.priority DESC`,
        [configId]
      );
      return result.rows;
    } catch (error) {
      log.error('Error getting group mappings:', { error: error.message });
      throw error;
    }
  }

  /**
   * Update group mapping
   * @param {number} configId - SSO Configuration ID
   * @param {number} mappingId - Mapping ID
   * @param {Object} data - Update data
   * @returns {Object} Updated mapping
   */
  static async updateMapping(configId, mappingId, data) {
    try {
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (data.external_group_name !== undefined) {
        updates.push(`external_group_name = $${paramIndex}`);
        values.push(data.external_group_name);
        paramIndex++;
      }
      if (data.role_id !== undefined) {
        updates.push(`role_id = $${paramIndex}`);
        values.push(data.role_id);
        paramIndex++;
      }
      if (data.is_default !== undefined) {
        updates.push(`is_default = $${paramIndex}`);
        values.push(data.is_default);
        paramIndex++;
      }
      if (data.priority !== undefined) {
        updates.push(`priority = $${paramIndex}`);
        values.push(data.priority);
        paramIndex++;
      }

      updates.push(`updated_at = NOW()`);

      values.push(mappingId, configId);

      const result = await db.query(
        `UPDATE sso_group_mappings SET ${updates.join(', ')} WHERE id = $${paramIndex} AND sso_configuration_id = $${paramIndex + 1} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Mapping not found');
      }

      return result.rows[0];
    } catch (error) {
      log.error('Error updating group mapping:', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete group mapping
   * @param {number} configId - SSO Configuration ID
   * @param {number} mappingId - Mapping ID
   */
  static async deleteMapping(configId, mappingId) {
    try {
      const result = await db.query(
        'DELETE FROM sso_group_mappings WHERE id = $1 AND sso_configuration_id = $2',
        [mappingId, configId]
      );

      if (result.rowCount === 0) {
        throw new Error('Mapping not found');
      }

      return { success: true };
    } catch (error) {
      log.error('Error deleting group mapping:', { error: error.message });
      throw error;
    }
  }

  /**
   * Get role for user based on their groups
   * @param {number} configId - SSO Configuration ID
   * @param {Array} groups - User's group IDs from IdP
   * @returns {number|null} Role ID
   */
  static async getRoleForGroups(configId, groups) {
    try {
      if (!groups || groups.length === 0) {
        // Return default role if no groups
        const defaultResult = await db.query(
          'SELECT role_id FROM sso_group_mappings WHERE sso_configuration_id = $1 AND is_default = true LIMIT 1',
          [configId]
        );

        return defaultResult.rows[0]?.role_id || null;
      }

      // Find highest priority matching mapping
      const placeholders = groups.map((_, i) => `$${i + 2}`).join(', ');
      const mappingResult = await db.query(
        `SELECT role_id FROM sso_group_mappings WHERE sso_configuration_id = $1 AND external_group_id IN (${placeholders}) ORDER BY priority DESC LIMIT 1`,
        [configId, ...groups]
      );

      if (mappingResult.rows.length > 0) {
        return mappingResult.rows[0].role_id;
      }

      // Fall back to default
      const defaultResult = await db.query(
        'SELECT role_id FROM sso_group_mappings WHERE sso_configuration_id = $1 AND is_default = true LIMIT 1',
        [configId]
      );

      return defaultResult.rows[0]?.role_id || null;
    } catch (error) {
      log.error('Error getting role for groups:', { error: error.message });
      return null;
    }
  }

  /**
   * Apply group mappings to user
   * @param {number} configId - SSO Configuration ID
   * @param {number} userId - User ID
   * @param {Array} groups - User's group IDs from IdP
   */
  static async applyGroupMappings(configId, userId, groups) {
    try {
      const configResult = await db.query(
        'SELECT * FROM sso_configurations WHERE id = $1',
        [configId]
      );

      const config = configResult.rows[0];

      if (!config || !config.sync_groups) {
        return;
      }

      const roleId = await this.getRoleForGroups(configId, groups);

      if (roleId) {
        await db.query(
          'UPDATE team_members SET role_id = $1, updated_at = NOW() WHERE user_id = $2 AND tenant_id = $3',
          [roleId, userId, config.organization_id]
        );

        log.info('User role updated from SSO groups', { userId, roleId, groups });
      }
    } catch (error) {
      log.error('Error applying group mappings:', { error: error.message });
    }
  }

  // ==================== ATTRIBUTE MAPPINGS ====================

  /**
   * Create attribute mapping
   * @param {number} configId - SSO Configuration ID
   * @param {Object} data - Mapping data
   * @returns {Object} Created mapping
   */
  static async createAttributeMapping(configId, data) {
    try {
      const result = await db.query(
        `INSERT INTO sso_attribute_mappings (sso_configuration_id, source_attribute, target_field, transform, default_value, is_required)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [configId, data.source_attribute, data.target_field, data.transform, data.default_value, data.is_required || false]
      );

      return result.rows[0];
    } catch (error) {
      log.error('Error creating attribute mapping:', { error: error.message });
      throw error;
    }
  }

  /**
   * Get attribute mappings
   * @param {number} configId - SSO Configuration ID
   * @returns {Array} Mappings
   */
  static async getAttributeMappings(configId) {
    try {
      const result = await db.query(
        'SELECT * FROM sso_attribute_mappings WHERE sso_configuration_id = $1 ORDER BY target_field',
        [configId]
      );
      return result.rows;
    } catch (error) {
      log.error('Error getting attribute mappings:', { error: error.message });
      throw error;
    }
  }

  /**
   * Update attribute mapping
   */
  static async updateAttributeMapping(configId, mappingId, data) {
    try {
      const result = await db.query(
        `UPDATE sso_attribute_mappings
         SET source_attribute = $1, target_field = $2, transform = $3, default_value = $4, is_required = $5
         WHERE id = $6 AND sso_configuration_id = $7 RETURNING *`,
        [data.source_attribute, data.target_field, data.transform, data.default_value, data.is_required, mappingId, configId]
      );

      if (result.rows.length === 0) {
        throw new Error('Mapping not found');
      }

      return result.rows[0];
    } catch (error) {
      log.error('Error updating attribute mapping:', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete attribute mapping
   */
  static async deleteAttributeMapping(configId, mappingId) {
    try {
      const result = await db.query(
        'DELETE FROM sso_attribute_mappings WHERE id = $1 AND sso_configuration_id = $2',
        [mappingId, configId]
      );

      if (result.rowCount === 0) {
        throw new Error('Mapping not found');
      }

      return { success: true };
    } catch (error) {
      log.error('Error deleting attribute mapping:', { error: error.message });
      throw error;
    }
  }

  /**
   * Apply attribute mappings to extract user data
   * @param {number} configId - SSO Configuration ID
   * @param {Object} rawAttributes - Raw attributes from IdP
   * @returns {Object} Mapped user data
   */
  static async applyAttributeMappings(configId, rawAttributes) {
    try {
      const mappings = await this.getAttributeMappings(configId);

      if (mappings.length === 0) {
        // Use default extraction if no mappings configured
        return rawAttributes;
      }

      const userData = {};

      for (const mapping of mappings) {
        let value = this.getNestedValue(rawAttributes, mapping.source_attribute);

        // Apply transform
        if (value && mapping.transform) {
          value = this.applyTransform(value, mapping.transform);
        }

        // Use default if no value and required
        if (!value && mapping.default_value) {
          value = mapping.default_value;
        }

        // Check required
        if (!value && mapping.is_required) {
          throw new Error(`Required attribute missing: ${mapping.source_attribute}`);
        }

        if (value) {
          userData[mapping.target_field] = value;
        }
      }

      return userData;
    } catch (error) {
      log.error('Error applying attribute mappings:', { error: error.message });
      throw error;
    }
  }

  /**
   * Get nested value from object
   */
  static getNestedValue(obj, path) {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Apply transform to value
   */
  static applyTransform(value, transform) {
    if (typeof value !== 'string') {
      return value;
    }

    switch (transform.toLowerCase()) {
      case 'lowercase':
        return value.toLowerCase();
      case 'uppercase':
        return value.toUpperCase();
      case 'trim':
        return value.trim();
      case 'email_to_username':
        return value.split('@')[0];
      default:
        return value;
    }
  }
}

module.exports = SSOGroupService;
