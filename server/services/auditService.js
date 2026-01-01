const db = require('../db');
const log = require('../utils/logger');
const { Parser } = require('json2csv');

/**
 * Audit Service
 * Comprehensive audit logging service with filtering, export, and retention capabilities
 */

class AuditService {
  /**
   * Log an action to the audit trail
   * @param {Object} params - Audit log parameters
   * @returns {Promise<Object>} Created audit log entry
   */
  static async logAction({
    userId = null,
    organizationId = null,
    action,
    resourceType,
    resourceId = null,
    oldValues = null,
    newValues = null,
    ipAddress = null,
    userAgent = null,
    metadata = {}
  }) {
    try {
      // Mask sensitive data before storing
      const maskedOldValues = this.maskSensitiveData(oldValues);
      const maskedNewValues = this.maskSensitiveData(newValues);
      const maskedMetadata = this.maskSensitiveData(metadata);

      // Log to Winston
      log.audit(action, {
        userId,
        organizationId,
        resourceType,
        resourceId,
        ipAddress,
        ...maskedMetadata
      });

      // Insert into database
      const query = `
        INSERT INTO audit_logs (
          user_id,
          organization_id,
          action,
          resource_type,
          resource_id,
          old_values,
          new_values,
          ip_address,
          user_agent,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING *
      `;

      const result = await db.query(query, [
        userId,
        organizationId,
        action,
        resourceType,
        resourceId,
        maskedOldValues ? JSON.stringify(maskedOldValues) : null,
        maskedNewValues ? JSON.stringify(maskedNewValues) : null,
        ipAddress,
        userAgent,
        JSON.stringify(maskedMetadata)
      ]);

      log.info(`[Audit] Logged action: ${action} for user ${userId} in org ${organizationId}`);
      return result.rows[0];
    } catch (error) {
      log.error('Audit logging failed', {
        error: error.message,
        action,
        resourceType
      });
      throw error;
    }
  }

  /**
   * Get audit logs with pagination and filtering
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated audit logs
   */
  static async getAuditLogs({
    organizationId = null,
    userId = null,
    action = null,
    resourceType = null,
    resourceId = null,
    startDate = null,
    endDate = null,
    ipAddress = null,
    limit = 50,
    offset = 0,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  } = {}) {
    try {
      let query = `
        SELECT
          al.*,
          u.name as user_name,
          u.email as user_email
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE 1=1
      `;
      const params = [];

      // Apply filters
      if (organizationId !== null) {
        params.push(organizationId);
        query += ` AND al.organization_id = $${params.length}`;
      }

      if (userId !== null) {
        params.push(userId);
        query += ` AND al.user_id = $${params.length}`;
      }

      if (action !== null) {
        params.push(action);
        query += ` AND al.action = $${params.length}`;
      }

      if (resourceType !== null) {
        params.push(resourceType);
        query += ` AND al.resource_type = $${params.length}`;
      }

      if (resourceId !== null) {
        params.push(resourceId);
        query += ` AND al.resource_id = $${params.length}`;
      }

      if (startDate !== null) {
        params.push(startDate);
        query += ` AND al.created_at >= $${params.length}`;
      }

      if (endDate !== null) {
        params.push(endDate);
        query += ` AND al.created_at <= $${params.length}`;
      }

      if (ipAddress !== null) {
        params.push(ipAddress);
        query += ` AND al.ip_address = $${params.length}`;
      }

      // Get total count
      const countQuery = query.replace(
        /SELECT.*FROM/s,
        'SELECT COUNT(*) as total FROM'
      );
      const countResult = await db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total, 10);

      // Add sorting and pagination
      const validSortColumns = ['created_at', 'action', 'user_id', 'organization_id'];
      const validSortOrders = ['ASC', 'DESC'];

      const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
      const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      query += ` ORDER BY al.${safeSortBy} ${safeSortOrder}`;

      params.push(limit, offset);
      query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

      const result = await db.query(query, params);

      return {
        logs: result.rows,
        pagination: {
          total,
          limit,
          offset,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      log.error('Failed to get audit logs', { error: error.message });
      throw error;
    }
  }

  /**
   * Filter logs by action type
   * @param {string} action - Action type to filter by
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} Filtered audit logs
   */
  static async filterByAction(action, options = {}) {
    return this.getAuditLogs({ ...options, action });
  }

  /**
   * Filter logs by user
   * @param {number} userId - User ID to filter by
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} Filtered audit logs
   */
  static async filterByUser(userId, options = {}) {
    return this.getAuditLogs({ ...options, userId });
  }

  /**
   * Filter logs by resource
   * @param {string} resourceType - Resource type
   * @param {number} resourceId - Resource ID
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} Filtered audit logs
   */
  static async filterByResource(resourceType, resourceId, options = {}) {
    return this.getAuditLogs({ ...options, resourceType, resourceId });
  }

  /**
   * Export audit logs to CSV or JSON
   * @param {string} format - Export format ('csv' or 'json')
   * @param {Object} filters - Filter options
   * @returns {Promise<string>} Exported data
   */
  static async exportLogs(format = 'json', filters = {}) {
    try {
      // Remove pagination for export
      const { logs } = await this.getAuditLogs({
        ...filters,
        limit: 100000, // Large limit for export
        offset: 0
      });

      if (format === 'csv') {
        return this.exportToCSV(logs);
      } else if (format === 'json') {
        return this.exportToJSON(logs);
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      log.error('Failed to export audit logs', { error: error.message, format });
      throw error;
    }
  }

  /**
   * Export logs to CSV format
   * @param {Array} logs - Audit logs to export
   * @returns {string} CSV string
   */
  static exportToCSV(logs) {
    const fields = [
      'id',
      'user_id',
      'user_name',
      'user_email',
      'organization_id',
      'action',
      'resource_type',
      'resource_id',
      'ip_address',
      'user_agent',
      'created_at'
    ];

    const parser = new Parser({ fields });
    return parser.parse(logs);
  }

  /**
   * Export logs to JSON format
   * @param {Array} logs - Audit logs to export
   * @returns {string} JSON string
   */
  static exportToJSON(logs) {
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Clean up old audit logs based on retention policy
   * @param {number} retentionDays - Number of days to retain logs
   * @param {number} organizationId - Optional organization filter
   * @returns {Promise<number>} Number of deleted records
   */
  static async applyRetentionPolicy(retentionDays = 90, organizationId = null) {
    try {
      const retentionDaysInt = parseInt(retentionDays, 10);
      if (isNaN(retentionDaysInt) || retentionDaysInt < 1) {
        throw new Error('Retention days must be a positive integer');
      }

      let query = `
        DELETE FROM audit_logs
        WHERE created_at < NOW() - INTERVAL '1 day' * $1
      `;
      const params = [retentionDaysInt];

      if (organizationId !== null) {
        params.push(organizationId);
        query += ` AND organization_id = $${params.length}`;
      }

      query += ' RETURNING id';

      const result = await db.query(query, params);
      const deletedCount = result.rowCount;

      log.info(`[Audit] Retention policy applied: deleted ${deletedCount} logs older than ${retentionDays} days`);
      return deletedCount;
    } catch (error) {
      log.error('Failed to apply retention policy', {
        error: error.message,
        retentionDays,
        organizationId
      });
      throw error;
    }
  }

  /**
   * Mask sensitive data in audit logs
   * @param {Object} data - Data to mask
   * @returns {Object} Masked data
   */
  static maskSensitiveData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'password',
      'password_hash',
      'token',
      'access_token',
      'refresh_token',
      'secret',
      'api_key',
      'apiKey',
      'private_key',
      'privateKey',
      'ssn',
      'credit_card',
      'creditCard',
      'cvv',
      'pin'
    ];

    const masked = Array.isArray(data) ? [...data] : { ...data };

    const maskValue = (obj) => {
      if (!obj || typeof obj !== 'object') {
        return obj;
      }

      const result = Array.isArray(obj) ? [...obj] : { ...obj };

      for (const key in result) {
        if (result.hasOwnProperty(key)) {
          const lowerKey = key.toLowerCase();

          // Check if field is sensitive
          if (sensitiveFields.some(field => lowerKey.includes(field))) {
            result[key] = '***MASKED***';
          } else if (typeof result[key] === 'object' && result[key] !== null) {
            // Recursively mask nested objects
            result[key] = maskValue(result[key]);
          }
        }
      }

      return result;
    };

    return maskValue(masked);
  }

  /**
   * Get audit statistics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Audit statistics
   */
  static async getStatistics(filters = {}) {
    try {
      const { organizationId, startDate, endDate } = filters;
      let whereClause = 'WHERE 1=1';
      const params = [];

      if (organizationId) {
        params.push(organizationId);
        whereClause += ` AND organization_id = $${params.length}`;
      }

      if (startDate) {
        params.push(startDate);
        whereClause += ` AND created_at >= $${params.length}`;
      }

      if (endDate) {
        params.push(endDate);
        whereClause += ` AND created_at <= $${params.length}`;
      }

      // Get action counts
      const actionCountsQuery = `
        SELECT action, COUNT(*) as count
        FROM audit_logs
        ${whereClause}
        GROUP BY action
        ORDER BY count DESC
      `;

      // Get resource type counts
      const resourceCountsQuery = `
        SELECT resource_type, COUNT(*) as count
        FROM audit_logs
        ${whereClause}
        GROUP BY resource_type
        ORDER BY count DESC
      `;

      // Get user activity
      const userActivityQuery = `
        SELECT user_id, COUNT(*) as count
        FROM audit_logs
        ${whereClause}
        GROUP BY user_id
        ORDER BY count DESC
        LIMIT 10
      `;

      const [actionCounts, resourceCounts, userActivity] = await Promise.all([
        db.query(actionCountsQuery, params),
        db.query(resourceCountsQuery, params),
        db.query(userActivityQuery, params)
      ]);

      return {
        actionCounts: actionCounts.rows,
        resourceCounts: resourceCounts.rows,
        topUsers: userActivity.rows
      };
    } catch (error) {
      log.error('Failed to get audit statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Search audit logs by metadata
   * @param {Object} metadataQuery - Metadata search criteria
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} Matching audit logs
   */
  static async searchByMetadata(metadataQuery, options = {}) {
    try {
      const { limit = 50, offset = 0 } = options;

      const query = `
        SELECT al.*, u.name as user_name, u.email as user_email
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.metadata @> $1::jsonb
        ORDER BY al.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await db.query(query, [
        JSON.stringify(metadataQuery),
        limit,
        offset
      ]);

      return result.rows;
    } catch (error) {
      log.error('Failed to search audit logs by metadata', { error: error.message });
      throw error;
    }
  }

  /**
   * Get audit log by ID
   * @param {number} id - Audit log ID
   * @returns {Promise<Object>} Audit log entry
   */
  static async getById(id) {
    try {
      const query = `
        SELECT al.*, u.name as user_name, u.email as user_email
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.id = $1
      `;

      const result = await db.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      log.error('Failed to get audit log by ID', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Get recent audit logs
   * @param {number} limit - Number of logs to retrieve
   * @param {number} organizationId - Optional organization filter
   * @returns {Promise<Array>} Recent audit logs
   */
  static async getRecent(limit = 10, organizationId = null) {
    return this.getAuditLogs({ limit, offset: 0, organizationId });
  }

  /**
   * Check if user has performed action recently
   * @param {number} userId - User ID
   * @param {string} action - Action type
   * @param {number} minutes - Time window in minutes
   * @returns {Promise<boolean>} True if action was performed recently
   */
  static async hasRecentAction(userId, action, minutes = 5) {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM audit_logs
        WHERE user_id = $1
          AND action = $2
          AND created_at >= NOW() - INTERVAL '1 minute' * $3
      `;

      const result = await db.query(query, [userId, action, minutes]);
      return parseInt(result.rows[0].count, 10) > 0;
    } catch (error) {
      log.error('Failed to check recent action', { error: error.message });
      throw error;
    }
  }
}

module.exports = AuditService;
