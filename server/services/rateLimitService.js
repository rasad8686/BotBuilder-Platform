const db = require('../db');
const log = require('../utils/logger');

// Cache for settings (1 minute TTL)
let settingsCache = null;
let settingsCacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Rate Limit Service - Professional rate limiting management
 */
const rateLimitService = {
  /**
   * Get all rate limit settings
   * @returns {Promise<Array>} All settings
   */
  async getSettings() {
    try {
      const now = Date.now();

      // Return cached if valid
      if (settingsCache && (now - settingsCacheTime) < CACHE_TTL) {
        return settingsCache;
      }

      const result = await db.query(
        'SELECT * FROM rate_limit_settings ORDER BY key ASC'
      );

      settingsCache = result.rows;
      settingsCacheTime = now;

      return result.rows;
    } catch (error) {
      log.error('Error getting rate limit settings', { error: error.message });
      throw error;
    }
  },

  /**
   * Get setting by key
   * @param {string} key - Setting key (login, register, api, password_reset)
   * @returns {Promise<Object|null>} Setting or null
   */
  async getSettingByKey(key) {
    try {
      const result = await db.query(
        'SELECT * FROM rate_limit_settings WHERE key = $1',
        [key]
      );
      return result.rows[0] || null;
    } catch (error) {
      log.error('Error getting rate limit setting', { error: error.message, key });
      throw error;
    }
  },

  /**
   * Create a new rate limit setting
   * @param {Object} data - Setting data
   * @param {number} createdBy - User ID who created
   * @returns {Promise<Object>} Created setting
   */
  async createSetting(data, createdBy) {
    try {
      const { key, max_attempts, window_ms, block_duration_ms, is_enabled } = data;

      // Check if key already exists
      const existing = await this.getSettingByKey(key);
      if (existing) {
        throw new Error('Setting already exists');
      }

      const result = await db.query(
        `INSERT INTO rate_limit_settings (key, max_attempts, window_ms, block_duration_ms, is_enabled, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING *`,
        [key, max_attempts, window_ms, block_duration_ms, is_enabled, createdBy]
      );

      // Invalidate cache
      settingsCache = null;

      log.info('Rate limit setting created', { key, createdBy });
      return result.rows[0];
    } catch (error) {
      log.error('Error creating rate limit setting', { error: error.message });
      throw error;
    }
  },

  /**
   * Delete a rate limit setting
   * @param {string} key - Setting key
   * @param {number} deletedBy - User ID who deleted
   * @returns {Promise<boolean>} Success status
   */
  async deleteSetting(key, deletedBy) {
    try {
      const result = await db.query(
        'DELETE FROM rate_limit_settings WHERE key = $1 RETURNING *',
        [key]
      );

      if (result.rows.length === 0) {
        throw new Error('Setting not found');
      }

      // Invalidate cache
      settingsCache = null;

      log.info('Rate limit setting deleted', { key, deletedBy });
      return true;
    } catch (error) {
      log.error('Error deleting rate limit setting', { error: error.message, key });
      throw error;
    }
  },

  /**
   * Update a rate limit setting
   * @param {string} key - Setting key
   * @param {Object} data - Updated data
   * @param {number} updatedBy - User ID who updated
   * @returns {Promise<Object>} Updated setting
   */
  async updateSetting(key, data, updatedBy) {
    try {
      const { max_attempts, window_ms, block_duration_ms, is_enabled } = data;

      const result = await db.query(
        `UPDATE rate_limit_settings SET
          max_attempts = COALESCE($1, max_attempts),
          window_ms = COALESCE($2, window_ms),
          block_duration_ms = COALESCE($3, block_duration_ms),
          is_enabled = COALESCE($4, is_enabled),
          updated_by = $5,
          updated_at = NOW()
        WHERE key = $6
        RETURNING *`,
        [max_attempts, window_ms, block_duration_ms, is_enabled, updatedBy, key]
      );

      if (result.rows.length === 0) {
        throw new Error('Setting not found');
      }

      // Invalidate cache
      settingsCache = null;

      // Log the change
      await this.logAction(null, key, updatedBy, 'setting_updated', {
        max_attempts,
        window_ms,
        block_duration_ms,
        is_enabled
      });

      log.info('Rate limit setting updated', { key, updatedBy });
      return result.rows[0];
    } catch (error) {
      log.error('Error updating rate limit setting', { error: error.message, key });
      throw error;
    }
  },

  /**
   * Get blocked IPs with filters
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Blocked IPs with pagination
   */
  async getBlockedIps(filters = {}) {
    try {
      const {
        reason,
        is_permanent,
        include_expired = false,
        page = 1,
        limit = 20
      } = filters;

      let query = 'SELECT * FROM blocked_ips WHERE unblocked_at IS NULL';
      const params = [];
      let paramIndex = 1;

      if (!include_expired) {
        query += ` AND (expires_at IS NULL OR expires_at > NOW() OR is_permanent = true)`;
      }

      if (reason) {
        query += ` AND reason = $${paramIndex++}`;
        params.push(reason);
      }

      if (is_permanent !== undefined) {
        query += ` AND is_permanent = $${paramIndex++}`;
        params.push(is_permanent);
      }

      query += ' ORDER BY blocked_at DESC';
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, (page - 1) * limit);

      const result = await db.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM blocked_ips WHERE unblocked_at IS NULL';
      const countParams = [];
      let countIndex = 1;

      if (!include_expired) {
        countQuery += ` AND (expires_at IS NULL OR expires_at > NOW() OR is_permanent = true)`;
      }

      if (reason) {
        countQuery += ` AND reason = $${countIndex++}`;
        countParams.push(reason);
      }

      if (is_permanent !== undefined) {
        countQuery += ` AND is_permanent = $${countIndex++}`;
        countParams.push(is_permanent);
      }

      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count, 10);

      return {
        blocked: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      log.error('Error getting blocked IPs', { error: error.message });
      throw error;
    }
  },

  /**
   * Check if an IP is blocked
   * @param {string} ipAddress - IP address to check
   * @returns {Promise<Object|null>} Block record or null
   */
  async isIpBlocked(ipAddress) {
    try {
      const result = await db.query(
        `SELECT * FROM blocked_ips
         WHERE ip_address = $1
         AND unblocked_at IS NULL
         AND (is_permanent = true OR expires_at > NOW())
         LIMIT 1`,
        [ipAddress]
      );
      return result.rows[0] || null;
    } catch (error) {
      log.error('Error checking blocked IP', { error: error.message, ipAddress });
      return null;
    }
  },

  /**
   * Unblock an IP
   * @param {number} id - Block record ID
   * @param {number} unblockedBy - User ID who unblocked
   * @returns {Promise<boolean>} Success status
   */
  async unblockIp(id, unblockedBy) {
    try {
      const result = await db.query(
        `UPDATE blocked_ips SET
          unblocked_by = $1,
          unblocked_at = NOW()
        WHERE id = $2
        RETURNING *`,
        [unblockedBy, id]
      );

      if (result.rows.length === 0) {
        throw new Error('Block record not found');
      }

      const record = result.rows[0];

      // Log the unblock
      await this.logAction(record.ip_address, 'manual', unblockedBy, 'unblocked', {
        original_reason: record.reason,
        blocked_at: record.blocked_at
      });

      log.info('IP unblocked', { id, ipAddress: record.ip_address, unblockedBy });
      return true;
    } catch (error) {
      log.error('Error unblocking IP', { error: error.message, id });
      throw error;
    }
  },

  /**
   * Update a blocked IP record
   * @param {number} id - Block record ID
   * @param {Object} data - Update data
   * @param {number} updatedBy - User ID who updated
   * @returns {Promise<Object>} Updated record
   */
  async updateBlock(id, data, updatedBy) {
    try {
      const { reason, duration_ms, is_permanent } = data;

      // Calculate new expires_at
      const expiresAt = is_permanent ? null : new Date(Date.now() + (duration_ms || 3600000));

      const result = await db.query(
        `UPDATE blocked_ips SET
          reason = COALESCE($1, reason),
          is_permanent = $2,
          expires_at = $3
        WHERE id = $4
        RETURNING *`,
        [reason, is_permanent, expiresAt, id]
      );

      if (result.rows.length === 0) {
        throw new Error('Block record not found');
      }

      const record = result.rows[0];

      // Log the update
      await this.logAction(record.ip_address, 'manual', updatedBy, 'block_updated', {
        reason: record.reason,
        is_permanent: record.is_permanent,
        expires_at: record.expires_at
      });

      log.info('Block record updated', { id, ipAddress: record.ip_address, updatedBy });
      return record;
    } catch (error) {
      log.error('Error updating block', { error: error.message, id });
      throw error;
    }
  },

  /**
   * Manually block an IP
   * @param {string} ipAddress - IP address to block
   * @param {string} reason - Reason for blocking
   * @param {number|null} durationMs - Duration in milliseconds (null for permanent)
   * @param {number} blockedBy - User ID who blocked
   * @returns {Promise<Object>} Block record
   */
  async blockIpManually(ipAddress, reason, durationMs, blockedBy) {
    try {
      const isPermanent = durationMs === null;
      const expiresAt = isPermanent ? null : new Date(Date.now() + durationMs);

      const result = await db.query(
        `INSERT INTO blocked_ips (ip_address, reason, attempts, blocked_at, expires_at, is_permanent, created_at)
         VALUES ($1, $2, 0, NOW(), $3, $4, NOW())
         RETURNING *`,
        [ipAddress, reason || 'manual', expiresAt, isPermanent]
      );

      const record = result.rows[0];

      // Log the block
      await this.logAction(ipAddress, 'manual', blockedBy, 'blocked', {
        reason,
        is_permanent: isPermanent,
        duration_ms: durationMs
      });

      log.info('IP manually blocked', { ipAddress, reason, blockedBy });
      return record;
    } catch (error) {
      log.error('Error blocking IP manually', { error: error.message, ipAddress });
      throw error;
    }
  },

  /**
   * Record a rate limit attempt
   * @param {string} ipAddress - IP address
   * @param {string} endpoint - Endpoint key
   * @param {number|null} userId - User ID if authenticated
   * @returns {Promise<Object>} Block status
   */
  async recordAttempt(ipAddress, endpoint, userId = null) {
    try {
      // Get settings for this endpoint
      const setting = await this.getSettingByKey(endpoint);
      if (!setting || !setting.is_enabled) {
        return { blocked: false };
      }

      // Check if already blocked
      const existingBlock = await this.isIpBlocked(ipAddress);
      if (existingBlock) {
        return {
          blocked: true,
          retryAfter: Math.ceil((new Date(existingBlock.expires_at) - new Date()) / 1000),
          reason: existingBlock.reason
        };
      }

      // Count recent attempts
      const windowStart = new Date(Date.now() - setting.window_ms);
      const countResult = await db.query(
        `SELECT COUNT(*) FROM rate_limit_logs
         WHERE ip_address = $1 AND endpoint = $2 AND action = 'attempt' AND created_at > $3`,
        [ipAddress, endpoint, windowStart]
      );

      const attemptCount = parseInt(countResult.rows[0].count, 10) + 1;

      // Log the attempt
      await this.logAction(ipAddress, endpoint, userId, 'attempt', { attempt_number: attemptCount });

      // Check if should block
      if (attemptCount >= setting.max_attempts) {
        const expiresAt = new Date(Date.now() + setting.block_duration_ms);

        // Create block record
        await db.query(
          `INSERT INTO blocked_ips (ip_address, reason, attempts, blocked_at, expires_at, is_permanent, created_at)
           VALUES ($1, $2, $3, NOW(), $4, false, NOW())`,
          [ipAddress, endpoint, attemptCount, expiresAt]
        );

        // Log the block
        await this.logAction(ipAddress, endpoint, userId, 'blocked', {
          attempts: attemptCount,
          block_duration_ms: setting.block_duration_ms
        });

        return {
          blocked: true,
          retryAfter: Math.ceil(setting.block_duration_ms / 1000),
          reason: endpoint
        };
      }

      return {
        blocked: false,
        remaining: setting.max_attempts - attemptCount
      };
    } catch (error) {
      log.error('Error recording rate limit attempt', { error: error.message, ipAddress, endpoint });
      return { blocked: false };
    }
  },

  /**
   * Get audit logs with filters
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Logs with pagination
   */
  async getAuditLogs(filters = {}) {
    try {
      const {
        action,
        endpoint,
        ip_address,
        start_date,
        end_date,
        page = 1,
        limit = 50
      } = filters;

      let query = 'SELECT * FROM rate_limit_logs WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      if (action) {
        query += ` AND action = $${paramIndex++}`;
        params.push(action);
      }

      if (endpoint) {
        query += ` AND endpoint = $${paramIndex++}`;
        params.push(endpoint);
      }

      if (ip_address) {
        query += ` AND ip_address = $${paramIndex++}`;
        params.push(ip_address);
      }

      if (start_date) {
        query += ` AND created_at >= $${paramIndex++}`;
        params.push(start_date);
      }

      if (end_date) {
        query += ` AND created_at <= $${paramIndex++}`;
        params.push(end_date);
      }

      query += ' ORDER BY created_at DESC';
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, (page - 1) * limit);

      const result = await db.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM rate_limit_logs WHERE 1=1';
      const countParams = [];
      let countIndex = 1;

      if (action) {
        countQuery += ` AND action = $${countIndex++}`;
        countParams.push(action);
      }

      if (endpoint) {
        countQuery += ` AND endpoint = $${countIndex++}`;
        countParams.push(endpoint);
      }

      if (ip_address) {
        countQuery += ` AND ip_address = $${countIndex++}`;
        countParams.push(ip_address);
      }

      if (start_date) {
        countQuery += ` AND created_at >= $${countIndex++}`;
        countParams.push(start_date);
      }

      if (end_date) {
        countQuery += ` AND created_at <= $${countIndex++}`;
        countParams.push(end_date);
      }

      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count, 10);

      return {
        logs: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      log.error('Error getting audit logs', { error: error.message });
      throw error;
    }
  },

  /**
   * Get statistics for last 24 hours
   * @returns {Promise<Object>} Statistics
   */
  async getStats() {
    try {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Total blocked IPs in last 24h
      const blockedResult = await db.query(
        `SELECT COUNT(*) as count FROM blocked_ips WHERE blocked_at > $1`,
        [last24h]
      );

      // Blocks by endpoint
      const byEndpointResult = await db.query(
        `SELECT reason as endpoint, COUNT(*) as count
         FROM blocked_ips
         WHERE blocked_at > $1
         GROUP BY reason
         ORDER BY count DESC`,
        [last24h]
      );

      // Top blocked IPs
      const topIpsResult = await db.query(
        `SELECT ip_address, COUNT(*) as block_count, MAX(blocked_at) as last_blocked
         FROM blocked_ips
         WHERE blocked_at > $1
         GROUP BY ip_address
         ORDER BY block_count DESC
         LIMIT 10`,
        [last24h]
      );

      // Attempts vs blocks over time (hourly)
      const hourlyResult = await db.query(
        `SELECT
           date_trunc('hour', created_at) as hour,
           action,
           COUNT(*) as count
         FROM rate_limit_logs
         WHERE created_at > $1
         GROUP BY date_trunc('hour', created_at), action
         ORDER BY hour ASC`,
        [last24h]
      );

      // Currently active blocks
      const activeBlocksResult = await db.query(
        `SELECT COUNT(*) as count FROM blocked_ips
         WHERE unblocked_at IS NULL
         AND (is_permanent = true OR expires_at > NOW())`
      );

      return {
        totalBlockedLast24h: parseInt(blockedResult.rows[0].count, 10),
        activeBlocks: parseInt(activeBlocksResult.rows[0].count, 10),
        byEndpoint: byEndpointResult.rows,
        topBlockedIps: topIpsResult.rows,
        hourlyStats: hourlyResult.rows
      };
    } catch (error) {
      log.error('Error getting rate limit stats', { error: error.message });
      throw error;
    }
  },

  /**
   * Cleanup expired blocks
   * @returns {Promise<number>} Number of cleaned records
   */
  async cleanupExpiredBlocks() {
    try {
      const result = await db.query(
        `DELETE FROM blocked_ips
         WHERE is_permanent = false
         AND expires_at < NOW()
         AND unblocked_at IS NULL`
      );

      const count = result.rowCount;
      if (count > 0) {
        log.info('Cleaned up expired blocks', { count });
      }
      return count;
    } catch (error) {
      log.error('Error cleaning up expired blocks', { error: error.message });
      return 0;
    }
  },

  /**
   * Log a rate limit action
   * @param {string} ipAddress - IP address
   * @param {string} endpoint - Endpoint
   * @param {number|null} userId - User ID
   * @param {string} action - Action type
   * @param {Object} details - Additional details
   */
  async logAction(ipAddress, endpoint, userId, action, details = {}) {
    try {
      await db.query(
        `INSERT INTO rate_limit_logs (ip_address, endpoint, user_id, action, details, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [ipAddress, endpoint, userId, action, JSON.stringify(details)]
      );
    } catch (error) {
      log.error('Error logging rate limit action', { error: error.message });
    }
  },

  /**
   * Clear rate limit attempts for successful auth
   * @param {string} ipAddress - IP address
   * @param {string} endpoint - Endpoint
   */
  async clearAttempts(ipAddress, endpoint) {
    try {
      // Remove any non-permanent blocks for this IP/endpoint
      await db.query(
        `UPDATE blocked_ips SET
          unblocked_at = NOW()
        WHERE ip_address = $1
        AND reason = $2
        AND is_permanent = false
        AND unblocked_at IS NULL`,
        [ipAddress, endpoint]
      );
    } catch (error) {
      log.error('Error clearing rate limit attempts', { error: error.message });
    }
  }
};

module.exports = rateLimitService;
