/**
 * User Model - Database operations for users
 */

const db = require('../db');

const User = {
  /**
   * Create a new user
   */
  async create(userData) {
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, avatar_url, is_active, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id`,
      [
        userData.name,
        userData.email,
        userData.password_hash,
        userData.avatar_url || null,
        userData.is_active !== false,
        userData.email_verified || false
      ]
    );
    return this.findById(result.rows[0].id);
  },

  /**
   * Find user by ID
   */
  async findById(id) {
    const result = await db.query(
      'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Find user by email
   */
  async findByEmail(email) {
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );
    return result.rows[0] || null;
  },

  /**
   * Find all users with pagination
   */
  async findAll(options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM users
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  },

  /**
   * Find users by organization
   */
  async findByOrganization(organizationId, options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT u.* FROM users u
       JOIN organization_members om ON u.id = om.user_id
       WHERE om.org_id = $1 AND u.deleted_at IS NULL
       ORDER BY u.created_at DESC
       LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    return result.rows;
  },

  /**
   * Search users by name or email
   */
  async search(query, options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM users
       WHERE (name ILIKE $1 OR email ILIKE $1) AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [`%${query}%`, limit, offset]
    );
    return result.rows;
  },

  /**
   * Update a user
   */
  async update(id, userData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (userData.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(userData.name); }
    if (userData.email !== undefined) { fields.push(`email = $${paramIndex++}`); values.push(userData.email); }
    if (userData.password_hash !== undefined) { fields.push(`password_hash = $${paramIndex++}`); values.push(userData.password_hash); }
    if (userData.avatar_url !== undefined) { fields.push(`avatar_url = $${paramIndex++}`); values.push(userData.avatar_url); }
    if (userData.is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(userData.is_active); }
    if (userData.email_verified !== undefined) { fields.push(`email_verified = $${paramIndex++}`); values.push(userData.email_verified); }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
    return this.findById(id);
  },

  /**
   * Soft delete a user
   */
  async delete(id) {
    await db.query(
      'UPDATE users SET deleted_at = NOW() WHERE id = $1',
      [id]
    );
  },

  /**
   * Count total users
   */
  async count() {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL'
    );
    return parseInt(result.rows[0].count, 10);
  }
};

module.exports = User;
