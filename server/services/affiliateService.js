const db = require('../db');
const crypto = require('crypto');
const log = require('../utils/logger');

class AffiliateService {
  /**
   * Generate unique affiliate code
   */
  generateAffiliateCode() {
    return 'AF' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  /**
   * Generate unique link slug
   */
  generateLinkSlug() {
    return crypto.randomBytes(6).toString('hex');
  }

  /**
   * Create new affiliate account
   */
  async createAffiliate(userId, data = {}) {
    try {
      const affiliateCode = this.generateAffiliateCode();

      const result = await db.query(`
        INSERT INTO affiliates (user_id, affiliate_code, payment_method, payment_details)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [userId, affiliateCode, data.paymentMethod || null, JSON.stringify(data.paymentDetails || {})]);

      return result.rows[0];
    } catch (error) {
      log.error('Failed to create affiliate', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get affiliate by user ID
   */
  async getAffiliateByUserId(userId) {
    const result = await db.query(
      'SELECT * FROM affiliates WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get affiliate by code
   */
  async getAffiliateByCode(code) {
    const result = await db.query(
      'SELECT * FROM affiliates WHERE affiliate_code = $1',
      [code]
    );
    return result.rows[0] || null;
  }

  /**
   * Update affiliate status
   */
  async updateAffiliateStatus(affiliateId, status) {
    const updates = { status };
    if (status === 'active') {
      updates.approved_at = new Date();
    }

    const result = await db.query(`
      UPDATE affiliates
      SET status = $2, approved_at = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [affiliateId, status, status === 'active' ? new Date() : null]);

    return result.rows[0];
  }

  /**
   * Update affiliate payment settings
   */
  async updatePaymentSettings(affiliateId, paymentMethod, paymentDetails) {
    const result = await db.query(`
      UPDATE affiliates
      SET payment_method = $2, payment_details = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [affiliateId, paymentMethod, JSON.stringify(paymentDetails)]);

    return result.rows[0];
  }

  /**
   * Create affiliate link
   */
  async createLink(affiliateId, data) {
    const slug = data.slug || this.generateLinkSlug();

    const result = await db.query(`
      INSERT INTO affiliate_links (affiliate_id, name, slug, destination_url, campaign)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [affiliateId, data.name, slug, data.destinationUrl, data.campaign || null]);

    return result.rows[0];
  }

  /**
   * Get affiliate links
   */
  async getLinks(affiliateId) {
    const result = await db.query(`
      SELECT * FROM affiliate_links
      WHERE affiliate_id = $1
      ORDER BY created_at DESC
    `, [affiliateId]);

    return result.rows;
  }

  /**
   * Get link by slug
   */
  async getLinkBySlug(slug) {
    const result = await db.query(
      'SELECT al.*, a.affiliate_code, a.status as affiliate_status FROM affiliate_links al JOIN affiliates a ON a.id = al.affiliate_id WHERE al.slug = $1',
      [slug]
    );
    return result.rows[0] || null;
  }

  /**
   * Update link
   */
  async updateLink(linkId, affiliateId, data) {
    const result = await db.query(`
      UPDATE affiliate_links
      SET name = COALESCE($3, name),
          destination_url = COALESCE($4, destination_url),
          campaign = COALESCE($5, campaign),
          is_active = COALESCE($6, is_active),
          updated_at = NOW()
      WHERE id = $1 AND affiliate_id = $2
      RETURNING *
    `, [linkId, affiliateId, data.name, data.destinationUrl, data.campaign, data.isActive]);

    return result.rows[0];
  }

  /**
   * Delete link
   */
  async deleteLink(linkId, affiliateId) {
    await db.query(
      'DELETE FROM affiliate_links WHERE id = $1 AND affiliate_id = $2',
      [linkId, affiliateId]
    );
  }

  /**
   * Track click
   */
  async trackClick(affiliateId, linkId, clickData) {
    try {
      // Check for duplicate click (same IP within last hour)
      const duplicateCheck = await db.query(`
        SELECT id FROM affiliate_clicks
        WHERE affiliate_id = $1 AND ip_address = $2
        AND clicked_at > NOW() - INTERVAL '1 hour'
      `, [affiliateId, clickData.ipAddress]);

      const isUnique = duplicateCheck.rows.length === 0;

      const result = await db.query(`
        INSERT INTO affiliate_clicks
        (affiliate_id, link_id, ip_address, user_agent, referrer, country, device, browser, is_unique)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        affiliateId,
        linkId,
        clickData.ipAddress,
        clickData.userAgent,
        clickData.referrer,
        clickData.country,
        clickData.device,
        clickData.browser,
        isUnique
      ]);

      // Update click counts
      if (isUnique) {
        await db.query('UPDATE affiliates SET total_clicks = total_clicks + 1 WHERE id = $1', [affiliateId]);
        if (linkId) {
          await db.query('UPDATE affiliate_links SET clicks = clicks + 1 WHERE id = $1', [linkId]);
        }
      }

      return result.rows[0];
    } catch (error) {
      log.error('Failed to track click', { error: error.message, affiliateId });
      throw error;
    }
  }

  /**
   * Track conversion
   */
  async trackConversion(data) {
    try {
      const affiliate = await this.getAffiliateByCode(data.affiliateCode);
      if (!affiliate || affiliate.status !== 'active') {
        return null;
      }

      const commissionAmount = (data.orderAmount * affiliate.commission_rate) / 100;

      const result = await db.query(`
        INSERT INTO affiliate_conversions
        (affiliate_id, link_id, click_id, referred_user_id, order_id, order_amount, commission_rate, commission_amount, type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        affiliate.id,
        data.linkId || null,
        data.clickId || null,
        data.referredUserId || null,
        data.orderId,
        data.orderAmount,
        affiliate.commission_rate,
        commissionAmount,
        data.type || 'signup'
      ]);

      // Update affiliate stats
      await db.query(`
        UPDATE affiliates
        SET total_conversions = total_conversions + 1,
            pending_balance = pending_balance + $2
        WHERE id = $1
      `, [affiliate.id, commissionAmount]);

      // Update link stats if applicable
      if (data.linkId) {
        await db.query(`
          UPDATE affiliate_links
          SET conversions = conversions + 1,
              earnings = earnings + $2
          WHERE id = $1
        `, [data.linkId, commissionAmount]);
      }

      return result.rows[0];
    } catch (error) {
      log.error('Failed to track conversion', { error: error.message, data });
      throw error;
    }
  }

  /**
   * Get conversions for affiliate
   */
  async getConversions(affiliateId, filters = {}) {
    let query = `
      SELECT ac.*, al.name as link_name, al.slug as link_slug
      FROM affiliate_conversions ac
      LEFT JOIN affiliate_links al ON al.id = ac.link_id
      WHERE ac.affiliate_id = $1
    `;
    const params = [affiliateId];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND ac.status = $${params.length}`;
    }

    if (filters.startDate) {
      params.push(filters.startDate);
      query += ` AND ac.converted_at >= $${params.length}`;
    }

    if (filters.endDate) {
      params.push(filters.endDate);
      query += ` AND ac.converted_at <= $${params.length}`;
    }

    query += ' ORDER BY ac.converted_at DESC';

    if (filters.limit) {
      params.push(filters.limit);
      query += ` LIMIT $${params.length}`;
    }

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Approve conversion
   */
  async approveConversion(conversionId) {
    const result = await db.query(`
      UPDATE affiliate_conversions
      SET status = 'approved', approved_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING *
    `, [conversionId]);

    if (result.rows[0]) {
      // Update lifetime earnings
      await db.query(`
        UPDATE affiliates
        SET lifetime_earnings = lifetime_earnings + $2
        WHERE id = $1
      `, [result.rows[0].affiliate_id, result.rows[0].commission_amount]);
    }

    return result.rows[0];
  }

  /**
   * Reject conversion
   */
  async rejectConversion(conversionId, reason) {
    const result = await db.query(`
      UPDATE affiliate_conversions
      SET status = 'rejected', updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING *
    `, [conversionId]);

    if (result.rows[0]) {
      // Deduct from pending balance
      await db.query(`
        UPDATE affiliates
        SET pending_balance = pending_balance - $2
        WHERE id = $1
      `, [result.rows[0].affiliate_id, result.rows[0].commission_amount]);
    }

    return result.rows[0];
  }

  /**
   * Request payout
   */
  async requestPayout(affiliateId, amount) {
    const affiliate = await db.query('SELECT * FROM affiliates WHERE id = $1', [affiliateId]);

    if (!affiliate.rows[0]) {
      throw new Error('Affiliate not found');
    }

    const aff = affiliate.rows[0];

    if (amount > parseFloat(aff.pending_balance)) {
      throw new Error('Insufficient balance');
    }

    if (amount < parseFloat(aff.minimum_payout)) {
      throw new Error(`Minimum payout amount is $${aff.minimum_payout}`);
    }

    const result = await db.query(`
      INSERT INTO affiliate_payouts
      (affiliate_id, amount, payment_method, payment_details)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [affiliateId, amount, aff.payment_method, aff.payment_details]);

    // Deduct from pending balance
    await db.query(`
      UPDATE affiliates
      SET pending_balance = pending_balance - $2
      WHERE id = $1
    `, [affiliateId, amount]);

    return result.rows[0];
  }

  /**
   * Get payouts for affiliate
   */
  async getPayouts(affiliateId) {
    const result = await db.query(`
      SELECT * FROM affiliate_payouts
      WHERE affiliate_id = $1
      ORDER BY requested_at DESC
    `, [affiliateId]);

    return result.rows;
  }

  /**
   * Process payout (admin)
   */
  async processPayout(payoutId, transactionId) {
    const result = await db.query(`
      UPDATE affiliate_payouts
      SET status = 'completed',
          transaction_id = $2,
          processed_at = NOW(),
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [payoutId, transactionId]);

    if (result.rows[0]) {
      // Update paid balance
      await db.query(`
        UPDATE affiliates
        SET paid_balance = paid_balance + $2
        WHERE id = $1
      `, [result.rows[0].affiliate_id, result.rows[0].amount]);
    }

    return result.rows[0];
  }

  /**
   * Get dashboard stats
   */
  async getDashboardStats(affiliateId, period = '30d') {
    let interval;
    switch (period) {
      case '7d': interval = '7 days'; break;
      case '30d': interval = '30 days'; break;
      case '90d': interval = '90 days'; break;
      default: interval = '30 days';
    }

    // Get affiliate info
    const affiliate = await db.query('SELECT * FROM affiliates WHERE id = $1', [affiliateId]);
    if (!affiliate.rows[0]) return null;

    // Get period stats
    const clicksResult = await db.query(`
      SELECT COUNT(*) as total, COUNT(CASE WHEN is_unique THEN 1 END) as unique_clicks
      FROM affiliate_clicks
      WHERE affiliate_id = $1 AND clicked_at > NOW() - INTERVAL '${interval}'
    `, [affiliateId]);

    const conversionsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(commission_amount) as earnings,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
      FROM affiliate_conversions
      WHERE affiliate_id = $1 AND converted_at > NOW() - INTERVAL '${interval}'
    `, [affiliateId]);

    // Get daily stats for chart
    const dailyStats = await db.query(`
      SELECT
        DATE(clicked_at) as date,
        COUNT(*) as clicks,
        0 as conversions
      FROM affiliate_clicks
      WHERE affiliate_id = $1 AND clicked_at > NOW() - INTERVAL '${interval}'
      GROUP BY DATE(clicked_at)
      ORDER BY date
    `, [affiliateId]);

    const dailyConversions = await db.query(`
      SELECT
        DATE(converted_at) as date,
        COUNT(*) as conversions,
        SUM(commission_amount) as earnings
      FROM affiliate_conversions
      WHERE affiliate_id = $1 AND converted_at > NOW() - INTERVAL '${interval}'
      GROUP BY DATE(converted_at)
    `, [affiliateId]);

    // Merge daily stats
    const statsMap = new Map();
    dailyStats.rows.forEach(row => {
      statsMap.set(row.date.toISOString().split('T')[0], {
        date: row.date,
        clicks: parseInt(row.clicks),
        conversions: 0,
        earnings: 0
      });
    });
    dailyConversions.rows.forEach(row => {
      const dateKey = row.date.toISOString().split('T')[0];
      if (statsMap.has(dateKey)) {
        statsMap.get(dateKey).conversions = parseInt(row.conversions);
        statsMap.get(dateKey).earnings = parseFloat(row.earnings || 0);
      } else {
        statsMap.set(dateKey, {
          date: row.date,
          clicks: 0,
          conversions: parseInt(row.conversions),
          earnings: parseFloat(row.earnings || 0)
        });
      }
    });

    const clicks = clicksResult.rows[0];
    const conversions = conversionsResult.rows[0];
    const conversionRate = clicks.unique_clicks > 0
      ? ((conversions.total / clicks.unique_clicks) * 100).toFixed(2)
      : 0;

    return {
      affiliate: affiliate.rows[0],
      period: {
        clicks: parseInt(clicks.total) || 0,
        uniqueClicks: parseInt(clicks.unique_clicks) || 0,
        conversions: parseInt(conversions.total) || 0,
        approvedConversions: parseInt(conversions.approved) || 0,
        pendingConversions: parseInt(conversions.pending) || 0,
        earnings: parseFloat(conversions.earnings) || 0,
        conversionRate: parseFloat(conversionRate)
      },
      dailyStats: Array.from(statsMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date))
    };
  }

  /**
   * Get top affiliates (admin)
   */
  async getTopAffiliates(limit = 10) {
    const result = await db.query(`
      SELECT a.*, u.email, u.name as user_name
      FROM affiliates a
      JOIN users u ON u.id = a.user_id
      WHERE a.status = 'active'
      ORDER BY a.lifetime_earnings DESC
      LIMIT $1
    `, [limit]);

    return result.rows;
  }
}

module.exports = new AffiliateService();
