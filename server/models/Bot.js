/**
 * Bot Model - Database operations for bots
 */

const db = require('../db');

const Bot = {
  /**
   * Create a new bot
   */
  async create(botData) {
    const result = await db.query(
      `INSERT INTO bots (name, description, user_id, organization_id, settings, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id`,
      [
        botData.name,
        botData.description || null,
        botData.user_id,
        botData.organization_id,
        JSON.stringify(botData.settings || {}),
        botData.is_active !== false
      ]
    );
    return this.findById(result.rows[0].id);
  },

  /**
   * Find bot by ID
   */
  async findById(id) {
    const result = await db.query('SELECT * FROM bots WHERE id = $1', [id]);
    return result.rows[0] ? this.parseBot(result.rows[0]) : null;
  },

  /**
   * Find all bots with pagination
   */
  async findAll(options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM bots
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows.map(this.parseBot);
  },

  /**
   * Find bots by organization
   */
  async findByOrganization(organizationId, options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM bots
       WHERE organization_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    return result.rows.map(this.parseBot);
  },

  /**
   * Find bots by user
   */
  async findByUser(userId, options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM bots
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows.map(this.parseBot);
  },

  /**
   * Search bots by name
   */
  async search(query, options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM bots
       WHERE name ILIKE $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [`%${query}%`, limit, offset]
    );
    return result.rows.map(this.parseBot);
  },

  /**
   * Update a bot
   */
  async update(id, botData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (botData.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(botData.name); }
    if (botData.description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(botData.description); }
    if (botData.settings !== undefined) { fields.push(`settings = $${paramIndex++}`); values.push(JSON.stringify(botData.settings)); }
    if (botData.is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(botData.is_active); }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    await db.query(
      `UPDATE bots SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
    return this.findById(id);
  },

  /**
   * Soft delete a bot
   */
  async delete(id) {
    await db.query(
      'UPDATE bots SET deleted_at = NOW() WHERE id = $1',
      [id]
    );
  },

  /**
   * Count bots by organization
   */
  async countByOrganization(organizationId) {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM bots WHERE organization_id = $1 AND deleted_at IS NULL',
      [organizationId]
    );
    return parseInt(result.rows[0].count, 10);
  },

  /**
   * Parse bot from database
   */
  parseBot(bot) {
    return {
      ...bot,
      settings: typeof bot.settings === 'string'
        ? JSON.parse(bot.settings)
        : bot.settings || {}
    };
  }
};

module.exports = Bot;
