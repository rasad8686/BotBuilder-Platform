const db = require('../db');
const log = require('../utils/logger');

/**
 * Banner Service - In-app banner management
 */
const bannerService = {
  /**
   * Get active banners for a specific user
   * @param {number} userId - User ID
   * @param {string} userPlan - User's plan (free, paid, trial)
   * @param {number|null} organizationId - Organization ID (optional)
   * @returns {Promise<Array>} Active banners for the user
   */
  async getActiveBannersForUser(userId, userPlan = 'free', organizationId = null) {
    try {
      const now = new Date().toISOString();

      const query = `
        SELECT b.*
        FROM banners b
        LEFT JOIN banner_dismissals bd ON bd.banner_id = b.id AND bd.user_id = $1
        WHERE b.is_active = true
          AND bd.id IS NULL
          AND b.start_date <= $2
          AND (b.end_date IS NULL OR b.end_date >= $2)
          AND (b.target_audience = 'all' OR b.target_audience = $3)
          AND (b.organization_id IS NULL OR b.organization_id = $4)
        ORDER BY b.priority DESC, b.created_at DESC
      `;

      const result = await db.query(query, [userId, now, userPlan, organizationId]);

      return result.rows;
    } catch (error) {
      log.error('Error getting active banners for user', {
        error: error.message,
        userId,
        userPlan
      });
      throw error;
    }
  },

  /**
   * Dismiss a banner for a user
   * @param {number} bannerId - Banner ID
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async dismissBanner(bannerId, userId) {
    try {
      // Check if banner exists and is dismissible
      const bannerCheck = await db.query(
        'SELECT id, is_dismissible FROM banners WHERE id = $1',
        [bannerId]
      );

      if (bannerCheck.rows.length === 0) {
        throw new Error('Banner not found');
      }

      if (!bannerCheck.rows[0].is_dismissible) {
        throw new Error('This banner cannot be dismissed');
      }

      // Insert dismissal record (ignore if already exists)
      await db.query(
        `INSERT INTO banner_dismissals (banner_id, user_id, dismissed_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (banner_id, user_id) DO NOTHING`,
        [bannerId, userId]
      );

      log.info('Banner dismissed', { bannerId, userId });
      return true;
    } catch (error) {
      log.error('Error dismissing banner', {
        error: error.message,
        bannerId,
        userId
      });
      throw error;
    }
  },

  /**
   * Create a new banner
   * @param {Object} data - Banner data
   * @param {number} createdBy - Creator user ID
   * @returns {Promise<Object>} Created banner
   */
  async createBanner(data, createdBy) {
    try {
      const {
        title,
        message,
        type = 'info',
        bg_color = null,
        text_color = null,
        link_url = null,
        link_text = null,
        target_audience = 'all',
        start_date = new Date(),
        end_date = null,
        is_dismissible = true,
        is_active = true,
        priority = 0,
        organization_id = null
      } = data;

      const result = await db.query(
        `INSERT INTO banners (
          title, message, type, bg_color, text_color, link_url, link_text,
          target_audience, start_date, end_date, is_dismissible, is_active,
          priority, organization_id, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
        RETURNING *`,
        [
          title, message, type, bg_color, text_color, link_url, link_text,
          target_audience, start_date, end_date, is_dismissible, is_active,
          priority, organization_id, createdBy
        ]
      );

      log.info('Banner created', { bannerId: result.rows[0].id, createdBy });
      return result.rows[0];
    } catch (error) {
      log.error('Error creating banner', { error: error.message, createdBy });
      throw error;
    }
  },

  /**
   * Update an existing banner
   * @param {number} id - Banner ID
   * @param {Object} data - Updated banner data
   * @returns {Promise<Object>} Updated banner
   */
  async updateBanner(id, data) {
    try {
      const {
        title,
        message,
        type,
        bg_color,
        text_color,
        link_url,
        link_text,
        target_audience,
        start_date,
        end_date,
        is_dismissible,
        is_active,
        priority,
        organization_id
      } = data;

      const result = await db.query(
        `UPDATE banners SET
          title = COALESCE($1, title),
          message = COALESCE($2, message),
          type = COALESCE($3, type),
          bg_color = $4,
          text_color = $5,
          link_url = $6,
          link_text = $7,
          target_audience = COALESCE($8, target_audience),
          start_date = COALESCE($9, start_date),
          end_date = $10,
          is_dismissible = COALESCE($11, is_dismissible),
          is_active = COALESCE($12, is_active),
          priority = COALESCE($13, priority),
          organization_id = $14,
          updated_at = NOW()
        WHERE id = $15
        RETURNING *`,
        [
          title, message, type, bg_color, text_color, link_url, link_text,
          target_audience, start_date, end_date, is_dismissible, is_active,
          priority, organization_id, id
        ]
      );

      if (result.rows.length === 0) {
        throw new Error('Banner not found');
      }

      log.info('Banner updated', { bannerId: id });
      return result.rows[0];
    } catch (error) {
      log.error('Error updating banner', { error: error.message, bannerId: id });
      throw error;
    }
  },

  /**
   * Delete a banner
   * @param {number} id - Banner ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteBanner(id) {
    try {
      const result = await db.query(
        'DELETE FROM banners WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error('Banner not found');
      }

      log.info('Banner deleted', { bannerId: id });
      return true;
    } catch (error) {
      log.error('Error deleting banner', { error: error.message, bannerId: id });
      throw error;
    }
  },

  /**
   * Get all banners with optional filters (admin)
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} List of banners
   */
  async getAllBanners(filters = {}) {
    try {
      const {
        is_active,
        type,
        target_audience,
        organization_id,
        page = 1,
        limit = 20
      } = filters;

      let query = 'SELECT * FROM banners WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      if (is_active !== undefined) {
        query += ` AND is_active = $${paramIndex++}`;
        params.push(is_active);
      }

      if (type) {
        query += ` AND type = $${paramIndex++}`;
        params.push(type);
      }

      if (target_audience) {
        query += ` AND target_audience = $${paramIndex++}`;
        params.push(target_audience);
      }

      if (organization_id !== undefined) {
        if (organization_id === null) {
          query += ' AND organization_id IS NULL';
        } else {
          query += ` AND organization_id = $${paramIndex++}`;
          params.push(organization_id);
        }
      }

      query += ` ORDER BY priority DESC, created_at DESC`;
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, (page - 1) * limit);

      const result = await db.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM banners WHERE 1=1';
      const countParams = [];
      let countParamIndex = 1;

      if (is_active !== undefined) {
        countQuery += ` AND is_active = $${countParamIndex++}`;
        countParams.push(is_active);
      }

      if (type) {
        countQuery += ` AND type = $${countParamIndex++}`;
        countParams.push(type);
      }

      if (target_audience) {
        countQuery += ` AND target_audience = $${countParamIndex++}`;
        countParams.push(target_audience);
      }

      if (organization_id !== undefined) {
        if (organization_id === null) {
          countQuery += ' AND organization_id IS NULL';
        } else {
          countQuery += ` AND organization_id = $${countParamIndex++}`;
          countParams.push(organization_id);
        }
      }

      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count, 10);

      return {
        banners: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      log.error('Error getting all banners', { error: error.message, filters });
      throw error;
    }
  },

  /**
   * Get a single banner by ID
   * @param {number} id - Banner ID
   * @returns {Promise<Object|null>} Banner or null
   */
  async getBannerById(id) {
    try {
      const result = await db.query(
        'SELECT * FROM banners WHERE id = $1',
        [id]
      );

      return result.rows[0] || null;
    } catch (error) {
      log.error('Error getting banner by ID', { error: error.message, bannerId: id });
      throw error;
    }
  }
};

module.exports = bannerService;
