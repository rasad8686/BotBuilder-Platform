/**
 * Channel Model - Database operations for messaging channels
 */

const pool = require('../db');

class Channel {
  /**
   * Find all channels for a tenant
   */
  static async findByTenant(tenantId, type = null) {
    let query = `
      SELECT * FROM channels
      WHERE tenant_id = $1
    `;
    const params = [tenantId];

    if (type) {
      query += ` AND type = $2`;
      params.push(type);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Find channel by ID
   */
  static async findById(id) {
    const result = await pool.query(
      `SELECT * FROM channels WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find channel by phone number
   */
  static async findByPhoneNumber(phoneNumber) {
    const result = await pool.query(
      `SELECT * FROM channels WHERE phone_number = $1 AND status = 'active'`,
      [phoneNumber]
    );
    return result.rows[0] || null;
  }

  /**
   * Find channel by username (for Instagram, Telegram)
   */
  static async findByUsername(username, type) {
    const result = await pool.query(
      `SELECT * FROM channels WHERE username = $1 AND type = $2 AND status = 'active'`,
      [username, type]
    );
    return result.rows[0] || null;
  }

  /**
   * Find channel by business account ID (for WhatsApp, Instagram)
   */
  static async findByBusinessAccountId(businessAccountId) {
    const result = await pool.query(
      `SELECT * FROM channels WHERE business_account_id = $1 AND status = 'active'`,
      [businessAccountId]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new channel
   */
  static async create(channelData) {
    const {
      tenant_id,
      type,
      name,
      credentials,
      phone_number,
      username,
      webhook_secret,
      webhook_url,
      api_key,
      access_token,
      refresh_token,
      token_expires_at,
      business_account_id,
      settings,
      status
    } = channelData;

    const result = await pool.query(
      `INSERT INTO channels
       (tenant_id, type, name, credentials, phone_number, username, webhook_secret, webhook_url,
        api_key, access_token, refresh_token, token_expires_at, business_account_id, settings, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        tenant_id, type, name, credentials || {}, phone_number, username,
        webhook_secret, webhook_url, api_key, access_token, refresh_token,
        token_expires_at, business_account_id, settings || {}, status || 'pending'
      ]
    );

    return result.rows[0];
  }

  /**
   * Update a channel
   */
  static async update(id, updates) {
    const allowedFields = [
      'name', 'credentials', 'phone_number', 'username', 'status',
      'webhook_secret', 'webhook_url', 'api_key', 'access_token',
      'refresh_token', 'token_expires_at', 'business_account_id',
      'settings', 'last_sync_at', 'error_message'
    ];

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE channels SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Delete a channel
   */
  static async delete(id) {
    const result = await pool.query(
      `DELETE FROM channels WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Update channel credentials
   */
  static async updateCredentials(id, credentials) {
    const result = await pool.query(
      `UPDATE channels
       SET credentials = credentials || $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [credentials, id]
    );
    return result.rows[0];
  }

  /**
   * Update access tokens (for OAuth channels)
   */
  static async updateTokens(id, accessToken, refreshToken = null, expiresAt = null) {
    const result = await pool.query(
      `UPDATE channels
       SET access_token = $1,
           refresh_token = COALESCE($2, refresh_token),
           token_expires_at = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [accessToken, refreshToken, expiresAt, id]
    );
    return result.rows[0];
  }

  /**
   * Update channel status
   */
  static async updateStatus(id, status, errorMessage = null) {
    const result = await pool.query(
      `UPDATE channels
       SET status = $1, error_message = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, errorMessage, id]
    );
    return result.rows[0];
  }

  /**
   * Get active channels by type
   */
  static async getActiveByType(type) {
    const result = await pool.query(
      `SELECT * FROM channels WHERE type = $1 AND status = 'active'`,
      [type]
    );
    return result.rows;
  }

  /**
   * Get channels with expiring tokens
   */
  static async getExpiringTokens(hoursBeforeExpiry = 24) {
    // SECURITY FIX: Use parameterized interval to prevent SQL injection
    const hoursNum = parseInt(hoursBeforeExpiry, 10) || 24;
    const result = await pool.query(
      `SELECT * FROM channels
       WHERE token_expires_at IS NOT NULL
       AND token_expires_at <= NOW() + INTERVAL '1 hour' * $1
       AND status = 'active'`,
      [hoursNum]
    );
    return result.rows;
  }

  /**
   * Get channel count by tenant
   */
  static async getCountByTenant(tenantId) {
    const result = await pool.query(
      `SELECT type, COUNT(*) as count
       FROM channels
       WHERE tenant_id = $1
       GROUP BY type`,
      [tenantId]
    );
    return result.rows;
  }

  /**
   * Verify webhook secret
   */
  static async verifyWebhookSecret(id, secret) {
    const result = await pool.query(
      `SELECT id FROM channels WHERE id = $1 AND webhook_secret = $2`,
      [id, secret]
    );
    return result.rows.length > 0;
  }

  /**
   * Update last sync timestamp
   */
  static async updateLastSync(id) {
    const result = await pool.query(
      `UPDATE channels SET last_sync_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  /**
   * Get channel settings
   */
  static async getSettings(id) {
    const result = await pool.query(
      `SELECT settings FROM channels WHERE id = $1`,
      [id]
    );
    return result.rows[0]?.settings || {};
  }

  /**
   * Update channel settings
   */
  static async updateSettings(id, settings) {
    const result = await pool.query(
      `UPDATE channels
       SET settings = settings || $1, updated_at = NOW()
       WHERE id = $2
       RETURNING settings`,
      [settings, id]
    );
    return result.rows[0]?.settings;
  }
}

module.exports = Channel;
