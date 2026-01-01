/**
 * Message Model - Database operations for bot messages
 */

const db = require('../db');

const Message = {
  /**
   * Create a new message
   */
  async create(messageData) {
    const result = await db.query(
      `INSERT INTO bot_messages (bot_id, organization_id, sender, content, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [
        messageData.bot_id,
        messageData.organization_id,
        messageData.sender || 'user',
        messageData.content,
        JSON.stringify(messageData.metadata || {})
      ]
    );
    return this.findById(result.rows[0].id);
  },

  /**
   * Find message by ID
   */
  async findById(id) {
    const result = await db.query('SELECT * FROM bot_messages WHERE id = $1', [id]);
    return result.rows[0] ? this.parseMessage(result.rows[0]) : null;
  },

  /**
   * Find all messages with pagination
   */
  async findAll(options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM bot_messages
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows.map(this.parseMessage);
  },

  /**
   * Find messages by bot
   */
  async findByBot(botId, options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM bot_messages
       WHERE bot_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [botId, limit, offset]
    );
    return result.rows.map(this.parseMessage);
  },

  /**
   * Find messages by organization
   */
  async findByOrganization(organizationId, options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM bot_messages
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    return result.rows.map(this.parseMessage);
  },

  /**
   * Find messages by sender
   */
  async findBySender(sender, options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM bot_messages
       WHERE sender = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [sender, limit, offset]
    );
    return result.rows.map(this.parseMessage);
  },

  /**
   * Search messages by content
   */
  async search(query, options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM bot_messages
       WHERE content ILIKE $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [`%${query}%`, limit, offset]
    );
    return result.rows.map(this.parseMessage);
  },

  /**
   * Update a message
   */
  async update(id, messageData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (messageData.content !== undefined) { fields.push(`content = $${paramIndex++}`); values.push(messageData.content); }
    if (messageData.metadata !== undefined) { fields.push(`metadata = $${paramIndex++}`); values.push(JSON.stringify(messageData.metadata)); }
    if (messageData.sender !== undefined) { fields.push(`sender = $${paramIndex++}`); values.push(messageData.sender); }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    await db.query(
      `UPDATE bot_messages SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
    return this.findById(id);
  },

  /**
   * Delete a message
   */
  async delete(id) {
    await db.query('DELETE FROM bot_messages WHERE id = $1', [id]);
  },

  /**
   * Count messages by bot
   */
  async countByBot(botId) {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM bot_messages WHERE bot_id = $1',
      [botId]
    );
    return parseInt(result.rows[0].count, 10);
  },

  /**
   * Count messages by organization
   */
  async countByOrganization(organizationId) {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM bot_messages WHERE organization_id = $1',
      [organizationId]
    );
    return parseInt(result.rows[0].count, 10);
  },

  /**
   * Parse message from database
   */
  parseMessage(message) {
    return {
      ...message,
      metadata: typeof message.metadata === 'string'
        ? JSON.parse(message.metadata)
        : message.metadata || {}
    };
  }
};

module.exports = Message;
