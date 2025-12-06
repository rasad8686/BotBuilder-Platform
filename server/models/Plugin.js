/**
 * Plugin Model - Database operations for plugins
 */

const db = require('../db');

const Plugin = {
  /**
   * Find all plugins with optional filters
   */
  async findAll(options = {}) {
    const { status = 'published', limit = 50, offset = 0, orderBy = 'downloads' } = options;

    const validOrderFields = ['downloads', 'rating', 'created_at', 'name'];
    const order = validOrderFields.includes(orderBy) ? orderBy : 'downloads';

    const result = await db.query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM plugins p
       LEFT JOIN plugin_categories c ON p.category_id = c.id
       WHERE p.status = $1
       ORDER BY p.${order} DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    return result.rows;
  },

  /**
   * Find plugin by ID
   */
  async findById(id) {
    const result = await db.query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM plugins p
       LEFT JOIN plugin_categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Find plugin by slug
   */
  async findBySlug(slug) {
    const result = await db.query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM plugins p
       LEFT JOIN plugin_categories c ON p.category_id = c.id
       WHERE p.slug = $1`,
      [slug]
    );
    return result.rows[0] || null;
  },

  /**
   * Create a new plugin
   */
  async create(data) {
    const {
      developer_id,
      name,
      slug,
      description,
      version = '1.0.0',
      category_id,
      icon_url,
      banner_url,
      price = 0,
      is_free = true,
      status = 'pending',
      manifest = {},
      permissions = []
    } = data;

    const result = await db.query(
      `INSERT INTO plugins (
        developer_id, name, slug, description, version, category_id,
        icon_url, banner_url, price, is_free, status, manifest, permissions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        developer_id, name, slug, description, version, category_id,
        icon_url, banner_url, price, is_free, status,
        JSON.stringify(manifest), JSON.stringify(permissions)
      ]
    );

    return result.rows[0];
  },

  /**
   * Update a plugin
   */
  async update(id, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = [
      'name', 'description', 'version', 'category_id', 'icon_url',
      'banner_url', 'price', 'is_free', 'status', 'manifest', 'permissions'
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = $${paramIndex++}`);
        if (field === 'manifest' || field === 'permissions') {
          values.push(JSON.stringify(data[field]));
        } else {
          values.push(data[field]);
        }
      }
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await db.query(
      `UPDATE plugins SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  },

  /**
   * Delete a plugin
   */
  async delete(id) {
    const result = await db.query(
      'DELETE FROM plugins WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Search plugins
   */
  async search(query, options = {}) {
    const { status = 'published', limit = 20, category_id } = options;
    const searchTerm = `%${query}%`;

    let sql = `
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM plugins p
      LEFT JOIN plugin_categories c ON p.category_id = c.id
      WHERE p.status = $1
        AND (p.name ILIKE $2 OR p.description ILIKE $2)
    `;
    const params = [status, searchTerm];

    if (category_id) {
      sql += ` AND p.category_id = $3`;
      params.push(category_id);
    }

    sql += ` ORDER BY p.downloads DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(sql, params);
    return result.rows;
  },

  /**
   * Get plugins by category
   */
  async getByCategory(categorySlug, options = {}) {
    const { status = 'published', limit = 50, offset = 0 } = options;

    const result = await db.query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM plugins p
       JOIN plugin_categories c ON p.category_id = c.id
       WHERE c.slug = $1 AND p.status = $2
       ORDER BY p.downloads DESC
       LIMIT $3 OFFSET $4`,
      [categorySlug, status, limit, offset]
    );

    return result.rows;
  },

  /**
   * Get plugins by developer
   */
  async getByDeveloper(developerId) {
    const result = await db.query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM plugins p
       LEFT JOIN plugin_categories c ON p.category_id = c.id
       WHERE p.developer_id = $1
       ORDER BY p.created_at DESC`,
      [developerId]
    );
    return result.rows;
  },

  /**
   * Increment download count
   */
  async incrementDownloads(id) {
    const result = await db.query(
      `UPDATE plugins SET downloads = downloads + 1 WHERE id = $1 RETURNING downloads`,
      [id]
    );
    return result.rows[0]?.downloads || 0;
  },

  /**
   * Update rating
   */
  async updateRating(id) {
    const result = await db.query(
      `UPDATE plugins SET
        rating = (SELECT COALESCE(AVG(rating), 0) FROM plugin_reviews WHERE plugin_id = $1),
        review_count = (SELECT COUNT(*) FROM plugin_reviews WHERE plugin_id = $1)
       WHERE id = $1
       RETURNING rating, review_count`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Get all categories
   */
  async getCategories() {
    const result = await db.query(
      `SELECT c.*, COUNT(p.id) as plugin_count
       FROM plugin_categories c
       LEFT JOIN plugins p ON c.id = p.category_id AND p.status = 'published'
       GROUP BY c.id
       ORDER BY c.name`
    );
    return result.rows;
  },

  /**
   * Get featured plugins
   */
  async getFeatured(limit = 6) {
    const result = await db.query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM plugins p
       LEFT JOIN plugin_categories c ON p.category_id = c.id
       WHERE p.status = 'published'
       ORDER BY p.rating DESC, p.downloads DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }
};

module.exports = Plugin;
