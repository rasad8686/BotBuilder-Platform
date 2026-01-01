/**
 * Organization Model - Database operations for organizations
 */

const db = require('../db');

const Organization = {
  /**
   * Create a new organization
   */
  async create(orgData) {
    const result = await db.query(
      `INSERT INTO organizations (name, slug, owner_id, plan_tier, settings, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      [
        orgData.name,
        orgData.slug,
        orgData.owner_id,
        orgData.plan_tier || 'free',
        JSON.stringify(orgData.settings || {})
      ]
    );
    return this.findById(result.rows[0].id);
  },

  /**
   * Find organization by ID
   */
  async findById(id) {
    const result = await db.query('SELECT * FROM organizations WHERE id = $1', [id]);
    return result.rows[0] ? this.parseOrganization(result.rows[0]) : null;
  },

  /**
   * Find organization by slug
   */
  async findBySlug(slug) {
    const result = await db.query('SELECT * FROM organizations WHERE slug = $1', [slug]);
    return result.rows[0] ? this.parseOrganization(result.rows[0]) : null;
  },

  /**
   * Find all organizations with pagination
   */
  async findAll(options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM organizations
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows.map(this.parseOrganization);
  },

  /**
   * Find organizations by owner
   */
  async findByOwner(ownerId, options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM organizations
       WHERE owner_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [ownerId, limit, offset]
    );
    return result.rows.map(this.parseOrganization);
  },

  /**
   * Find organizations by user (as member)
   */
  async findByUser(userId, options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT o.* FROM organizations o
       JOIN organization_members om ON o.id = om.org_id
       WHERE om.user_id = $1
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows.map(this.parseOrganization);
  },

  /**
   * Search organizations by name
   */
  async search(query, options = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM organizations
       WHERE name ILIKE $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [`%${query}%`, limit, offset]
    );
    return result.rows.map(this.parseOrganization);
  },

  /**
   * Update an organization
   */
  async update(id, orgData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (orgData.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(orgData.name); }
    if (orgData.slug !== undefined) { fields.push(`slug = $${paramIndex++}`); values.push(orgData.slug); }
    if (orgData.plan_tier !== undefined) { fields.push(`plan_tier = $${paramIndex++}`); values.push(orgData.plan_tier); }
    if (orgData.settings !== undefined) { fields.push(`settings = $${paramIndex++}`); values.push(JSON.stringify(orgData.settings)); }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    await db.query(
      `UPDATE organizations SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
    return this.findById(id);
  },

  /**
   * Delete an organization
   */
  async delete(id) {
    await db.query('DELETE FROM organizations WHERE id = $1', [id]);
  },

  /**
   * Count total organizations
   */
  async count() {
    const result = await db.query('SELECT COUNT(*) as count FROM organizations');
    return parseInt(result.rows[0].count, 10);
  },

  /**
   * Parse organization from database
   */
  parseOrganization(org) {
    return {
      ...org,
      settings: typeof org.settings === 'string'
        ? JSON.parse(org.settings)
        : org.settings || {}
    };
  }
};

module.exports = Organization;
