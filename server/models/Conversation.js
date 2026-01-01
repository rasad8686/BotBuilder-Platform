/**
 * Conversation Model - Database operations for AI conversations
 */

const db = require('../db');

const Conversation = {
  /**
   * Create a new conversation message
   */
  async create(conversationData) {
    const result = await db.query(
      `INSERT INTO ai_conversations (bot_id, session_id, role, content, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [
        conversationData.bot_id,
        conversationData.session_id,
        conversationData.role,
        conversationData.content
      ]
    );
    return this.findById(result.rows[0].id);
  },

  /**
   * Find conversation message by ID
   */
  async findById(id) {
    const result = await db.query('SELECT * FROM ai_conversations WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  /**
   * Find all conversation messages with pagination
   */
  async findAll(options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM ai_conversations
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  },

  /**
   * Find conversations by bot
   */
  async findByBot(botId, options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM ai_conversations
       WHERE bot_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [botId, limit, offset]
    );
    return result.rows;
  },

  /**
   * Find conversations by session
   */
  async findBySession(botId, sessionId, options = {}) {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM ai_conversations
       WHERE bot_id = $1 AND session_id = $2
       ORDER BY created_at ASC
       LIMIT $3 OFFSET $4`,
      [botId, sessionId, limit, offset]
    );
    return result.rows;
  },

  /**
   * Find conversations by organization (via bots)
   */
  async findByOrganization(organizationId, options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT ac.* FROM ai_conversations ac
       JOIN bots b ON ac.bot_id = b.id
       WHERE b.organization_id = $1
       ORDER BY ac.created_at DESC
       LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    return result.rows;
  },

  /**
   * Search conversations by content
   */
  async search(query, options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM ai_conversations
       WHERE content ILIKE $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [`%${query}%`, limit, offset]
    );
    return result.rows;
  },

  /**
   * Update a conversation message
   */
  async update(id, conversationData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (conversationData.content !== undefined) { fields.push(`content = $${paramIndex++}`); values.push(conversationData.content); }
    if (conversationData.role !== undefined) { fields.push(`role = $${paramIndex++}`); values.push(conversationData.role); }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    await db.query(
      `UPDATE ai_conversations SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
    return this.findById(id);
  },

  /**
   * Delete a conversation message
   */
  async delete(id) {
    await db.query('DELETE FROM ai_conversations WHERE id = $1', [id]);
  },

  /**
   * Delete all messages in a session
   */
  async deleteSession(botId, sessionId) {
    await db.query(
      'DELETE FROM ai_conversations WHERE bot_id = $1 AND session_id = $2',
      [botId, sessionId]
    );
  },

  /**
   * Count conversations by bot
   */
  async countByBot(botId) {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM ai_conversations WHERE bot_id = $1',
      [botId]
    );
    return parseInt(result.rows[0].count, 10);
  }
};

module.exports = Conversation;
