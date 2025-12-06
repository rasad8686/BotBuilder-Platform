/**
 * ChannelMessage Model - Database operations for channel messages
 */

const pool = require('../db');

class ChannelMessage {
  /**
   * Create a new message
   */
  static async create(messageData) {
    const {
      channel_id,
      bot_id,
      conversation_id,
      direction,
      from_number,
      to_number,
      from_name,
      message_type,
      content,
      media_url,
      media_mime_type,
      media_filename,
      caption,
      status,
      external_id,
      reply_to_id,
      metadata,
      created_at
    } = messageData;

    // Generate conversation ID if not provided
    const convId = conversation_id || this.generateConversationId(from_number, to_number);

    const result = await pool.query(
      `INSERT INTO channel_messages
       (channel_id, bot_id, conversation_id, direction, from_number, to_number, from_name,
        message_type, content, media_url, media_mime_type, media_filename, caption,
        status, external_id, reply_to_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        channel_id, bot_id, convId, direction, from_number, to_number, from_name,
        message_type || 'text', content, media_url, media_mime_type, media_filename, caption,
        status || 'pending', external_id, reply_to_id, metadata || {},
        created_at || new Date()
      ]
    );

    return result.rows[0];
  }

  /**
   * Find messages by channel
   */
  static async findByChannel(channelId, options = {}) {
    const {
      conversationId,
      limit = 50,
      offset = 0,
      direction,
      startDate,
      endDate,
      status,
      messageType
    } = options;

    let query = `SELECT * FROM channel_messages WHERE channel_id = $1`;
    const params = [channelId];
    let paramIndex = 2;

    if (conversationId) {
      query += ` AND conversation_id = $${paramIndex}`;
      params.push(conversationId);
      paramIndex++;
    }

    if (direction) {
      query += ` AND direction = $${paramIndex}`;
      params.push(direction);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (messageType) {
      query += ` AND message_type = $${paramIndex}`;
      params.push(messageType);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Find message by ID
   */
  static async findById(id) {
    const result = await pool.query(
      `SELECT * FROM channel_messages WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find message by external ID
   */
  static async findByExternalId(externalId) {
    if (!externalId) return null;

    const result = await pool.query(
      `SELECT * FROM channel_messages WHERE external_id = $1`,
      [externalId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update message status
   */
  static async updateStatus(id, status, errorMessage = null, additionalUpdates = {}) {
    const updates = { status, error_message: errorMessage, ...additionalUpdates };

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE channel_messages SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Get conversation between channel and contact
   */
  static async getConversation(channelId, contactNumber, limit = 50) {
    const result = await pool.query(
      `SELECT * FROM channel_messages
       WHERE channel_id = $1
       AND (from_number = $2 OR to_number = $2)
       ORDER BY created_at DESC
       LIMIT $3`,
      [channelId, contactNumber, limit]
    );

    // Return in chronological order
    return result.rows.reverse();
  }

  /**
   * Get conversations list (grouped by contact)
   */
  static async getConversations(channelId, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT DISTINCT ON (conversation_id)
        conversation_id,
        CASE WHEN direction = 'inbound' THEN from_number ELSE to_number END as contact_number,
        CASE WHEN direction = 'inbound' THEN from_name ELSE NULL END as contact_name,
        content as last_message,
        message_type as last_message_type,
        direction as last_direction,
        created_at as last_message_at,
        (SELECT COUNT(*) FROM channel_messages cm2
         WHERE cm2.conversation_id = channel_messages.conversation_id) as message_count
       FROM channel_messages
       WHERE channel_id = $1
       ORDER BY conversation_id, created_at DESC
       LIMIT $2 OFFSET $3`,
      [channelId, limit, offset]
    );

    return result.rows;
  }

  /**
   * Mark messages as read
   */
  static async markAsRead(channelId, conversationId) {
    const result = await pool.query(
      `UPDATE channel_messages
       SET status = 'read', read_at = NOW()
       WHERE channel_id = $1
       AND conversation_id = $2
       AND direction = 'inbound'
       AND status != 'read'
       RETURNING *`,
      [channelId, conversationId]
    );

    return result.rows;
  }

  /**
   * Get unread message count
   */
  static async getUnreadCount(channelId, conversationId = null) {
    let query = `
      SELECT COUNT(*) as count
      FROM channel_messages
      WHERE channel_id = $1
      AND direction = 'inbound'
      AND status != 'read'
    `;
    const params = [channelId];

    if (conversationId) {
      query += ` AND conversation_id = $2`;
      params.push(conversationId);
    }

    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count) || 0;
  }

  /**
   * Delete message
   */
  static async delete(id) {
    const result = await pool.query(
      `DELETE FROM channel_messages WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Delete messages by channel
   */
  static async deleteByChannel(channelId) {
    const result = await pool.query(
      `DELETE FROM channel_messages WHERE channel_id = $1 RETURNING id`,
      [channelId]
    );
    return result.rows.length;
  }

  /**
   * Get message statistics
   */
  static async getStats(channelId, period = '30d') {
    const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;

    const result = await pool.query(
      `SELECT
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE direction = 'inbound') as inbound,
        COUNT(*) FILTER (WHERE direction = 'outbound') as outbound,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE status = 'read') as read,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
       FROM channel_messages
       WHERE channel_id = $1
       AND created_at >= NOW() - INTERVAL '${periodDays} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [channelId]
    );

    return result.rows;
  }

  /**
   * Search messages
   */
  static async search(channelId, query, limit = 50) {
    const result = await pool.query(
      `SELECT * FROM channel_messages
       WHERE channel_id = $1
       AND content ILIKE $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [channelId, `%${query}%`, limit]
    );

    return result.rows;
  }

  /**
   * Get failed messages for retry
   */
  static async getFailedMessages(channelId, limit = 100) {
    const result = await pool.query(
      `SELECT * FROM channel_messages
       WHERE channel_id = $1
       AND status = 'failed'
       AND direction = 'outbound'
       ORDER BY created_at ASC
       LIMIT $2`,
      [channelId, limit]
    );

    return result.rows;
  }

  /**
   * Generate conversation ID from phone numbers
   */
  static generateConversationId(from, to) {
    const sorted = [from, to].sort();
    return `conv_${sorted.join('_')}`;
  }

  /**
   * Get messages by date range
   */
  static async getByDateRange(channelId, startDate, endDate) {
    const result = await pool.query(
      `SELECT * FROM channel_messages
       WHERE channel_id = $1
       AND created_at >= $2
       AND created_at <= $3
       ORDER BY created_at ASC`,
      [channelId, startDate, endDate]
    );

    return result.rows;
  }

  /**
   * Count messages by channel
   */
  static async countByChannel(channelId) {
    const result = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE direction = 'inbound') as inbound,
        COUNT(*) FILTER (WHERE direction = 'outbound') as outbound
       FROM channel_messages
       WHERE channel_id = $1`,
      [channelId]
    );

    return result.rows[0];
  }
}

module.exports = ChannelMessage;
