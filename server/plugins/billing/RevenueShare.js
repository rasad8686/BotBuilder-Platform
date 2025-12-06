const pool = require('../../db');
const log = require('../../utils/logger');

// Stripe for payouts
let stripe = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
} catch (e) {
  log.info('Stripe not configured for payouts');
}

class RevenueShare {
  // Revenue split
  static DEVELOPER_SHARE = 0.70; // 70%
  static PLATFORM_SHARE = 0.30;  // 30%

  // Minimum payout amount
  static MIN_PAYOUT_AMOUNT = 50.00;

  // Payout schedule: 1 = 1st of month, 15 = 15th of month
  static PAYOUT_DAY = 1;

  /**
   * Calculate payout amount for a developer
   */
  static async calculatePayout(developerId) {
    // Get pending earnings
    const earningsResult = await pool.query(
      `SELECT
        COALESCE(SUM(amount), 0) as pending_amount,
        COUNT(*) as pending_count
       FROM developer_earnings
       WHERE developer_id = $1 AND status = 'pending'`,
      [developerId]
    );

    const pendingAmount = parseFloat(earningsResult.rows[0].pending_amount) || 0;
    const pendingCount = parseInt(earningsResult.rows[0].pending_count) || 0;

    // Get developer payout info
    const developerResult = await pool.query(
      `SELECT
        dp.*,
        u.email, u.username
       FROM developer_payout_info dp
       JOIN users u ON dp.developer_id = u.id
       WHERE dp.developer_id = $1`,
      [developerId]
    );

    const payoutInfo = developerResult.rows[0] || null;

    return {
      pendingAmount,
      pendingCount,
      minimumPayout: RevenueShare.MIN_PAYOUT_AMOUNT,
      canRequestPayout: pendingAmount >= RevenueShare.MIN_PAYOUT_AMOUNT,
      hasPayoutInfo: !!payoutInfo,
      payoutMethod: payoutInfo?.payout_method || null,
      nextPayoutDate: RevenueShare.getNextPayoutDate()
    };
  }

  /**
   * Get next scheduled payout date
   */
  static getNextPayoutDate() {
    const now = new Date();
    const currentDay = now.getDate();

    let nextPayout = new Date(now.getFullYear(), now.getMonth(), RevenueShare.PAYOUT_DAY);

    if (currentDay >= RevenueShare.PAYOUT_DAY) {
      nextPayout.setMonth(nextPayout.getMonth() + 1);
    }

    return nextPayout.toISOString().split('T')[0];
  }

  /**
   * Create a payout request
   */
  static async createPayout(developerId, amount = null) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Calculate available amount if not specified
      const calculation = await this.calculatePayout(developerId);

      if (!calculation.canRequestPayout) {
        throw new Error(`Minimum payout amount is $${RevenueShare.MIN_PAYOUT_AMOUNT}`);
      }

      if (!calculation.hasPayoutInfo) {
        throw new Error('Please set up your payout information first');
      }

      const payoutAmount = amount || calculation.pendingAmount;

      if (payoutAmount > calculation.pendingAmount) {
        throw new Error('Requested amount exceeds available balance');
      }

      // Get payout info
      const payoutInfoResult = await client.query(
        'SELECT * FROM developer_payout_info WHERE developer_id = $1',
        [developerId]
      );

      const payoutInfo = payoutInfoResult.rows[0];

      // Create payout record
      const payoutResult = await client.query(
        `INSERT INTO developer_payouts
         (developer_id, amount, payout_method, payout_details, status, created_at)
         VALUES ($1, $2, $3, $4, 'pending', NOW())
         RETURNING *`,
        [
          developerId,
          payoutAmount,
          payoutInfo.payout_method,
          JSON.stringify({
            email: payoutInfo.paypal_email,
            bank_account: payoutInfo.bank_account_last4,
            stripe_account: payoutInfo.stripe_connect_id
          })
        ]
      );

      const payout = payoutResult.rows[0];

      // Mark earnings as processing
      await client.query(
        `UPDATE developer_earnings
         SET status = 'processing', payout_id = $1
         WHERE developer_id = $2 AND status = 'pending'
         AND amount <= $3`,
        [payout.id, developerId, payoutAmount]
      );

      await client.query('COMMIT');

      return payout;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process a payout (admin/cron job)
   */
  static async processPayout(payoutId) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get payout details
      const payoutResult = await client.query(
        `SELECT dp.*, dpi.*, u.email, u.username
         FROM developer_payouts dp
         JOIN developer_payout_info dpi ON dp.developer_id = dpi.developer_id
         JOIN users u ON dp.developer_id = u.id
         WHERE dp.id = $1`,
        [payoutId]
      );

      if (payoutResult.rows.length === 0) {
        throw new Error('Payout not found');
      }

      const payout = payoutResult.rows[0];

      if (payout.status !== 'pending') {
        throw new Error('Payout is not in pending status');
      }

      let payoutReference = null;

      // Process based on payout method
      switch (payout.payout_method) {
        case 'stripe':
          if (stripe && payout.stripe_connect_id) {
            // Create Stripe transfer
            const transfer = await stripe.transfers.create({
              amount: Math.round(payout.amount * 100),
              currency: 'usd',
              destination: payout.stripe_connect_id,
              description: `Plugin earnings payout #${payoutId}`
            });
            payoutReference = transfer.id;
          } else {
            payoutReference = `mock_stripe_${Date.now()}`;
          }
          break;

        case 'paypal':
          // PayPal payout would be implemented here
          payoutReference = `paypal_${Date.now()}`;
          break;

        case 'bank':
          // Bank transfer would be implemented here
          payoutReference = `bank_${Date.now()}`;
          break;

        default:
          payoutReference = `manual_${Date.now()}`;
      }

      // Update payout status
      await client.query(
        `UPDATE developer_payouts
         SET status = 'completed', payout_reference = $1, processed_at = NOW()
         WHERE id = $2`,
        [payoutReference, payoutId]
      );

      // Update earnings status
      await client.query(
        `UPDATE developer_earnings
         SET status = 'paid', paid_at = NOW()
         WHERE payout_id = $1`,
        [payoutId]
      );

      await client.query('COMMIT');

      return {
        success: true,
        payoutId,
        reference: payoutReference,
        amount: payout.amount
      };

    } catch (error) {
      await client.query('ROLLBACK');

      // Mark payout as failed
      await pool.query(
        `UPDATE developer_payouts SET status = 'failed' WHERE id = $1`,
        [payoutId]
      );

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Set up or update payout information
   */
  static async setPayoutInfo(developerId, payoutInfo) {
    const {
      payout_method,
      paypal_email,
      bank_name,
      bank_account_last4,
      bank_routing,
      stripe_connect_id
    } = payoutInfo;

    const result = await pool.query(
      `INSERT INTO developer_payout_info
       (developer_id, payout_method, paypal_email, bank_name, bank_account_last4, bank_routing, stripe_connect_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (developer_id)
       DO UPDATE SET
         payout_method = $2,
         paypal_email = $3,
         bank_name = $4,
         bank_account_last4 = $5,
         bank_routing = $6,
         stripe_connect_id = $7,
         updated_at = NOW()
       RETURNING *`,
      [developerId, payout_method, paypal_email, bank_name, bank_account_last4, bank_routing, stripe_connect_id]
    );

    return result.rows[0];
  }

  /**
   * Get payout information
   */
  static async getPayoutInfo(developerId) {
    const result = await pool.query(
      'SELECT * FROM developer_payout_info WHERE developer_id = $1',
      [developerId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all pending payouts (for admin)
   */
  static async getPendingPayouts() {
    const result = await pool.query(
      `SELECT
        dp.*,
        u.username, u.email,
        COUNT(de.id) as earnings_count
       FROM developer_payouts dp
       JOIN users u ON dp.developer_id = u.id
       LEFT JOIN developer_earnings de ON de.payout_id = dp.id
       WHERE dp.status = 'pending'
       GROUP BY dp.id, u.username, u.email
       ORDER BY dp.created_at ASC`
    );

    return result.rows;
  }

  /**
   * Run monthly payout batch (cron job)
   */
  static async runMonthlyPayouts() {
    const client = await pool.connect();

    try {
      // Get all developers with pending earnings above minimum
      const developersResult = await client.query(
        `SELECT
          developer_id,
          SUM(amount) as pending_amount
         FROM developer_earnings
         WHERE status = 'pending'
         GROUP BY developer_id
         HAVING SUM(amount) >= $1`,
        [RevenueShare.MIN_PAYOUT_AMOUNT]
      );

      const results = [];

      for (const developer of developersResult.rows) {
        try {
          // Check if developer has payout info
          const payoutInfo = await this.getPayoutInfo(developer.developer_id);

          if (payoutInfo) {
            // Create and process payout
            const payout = await this.createPayout(developer.developer_id);
            const processed = await this.processPayout(payout.id);
            results.push({
              developerId: developer.developer_id,
              success: true,
              amount: processed.amount
            });
          } else {
            results.push({
              developerId: developer.developer_id,
              success: false,
              error: 'No payout info'
            });
          }
        } catch (error) {
          results.push({
            developerId: developer.developer_id,
            success: false,
            error: error.message
          });
        }
      }

      return results;

    } finally {
      client.release();
    }
  }

  /**
   * Get platform revenue summary (for admin)
   */
  static async getPlatformRevenue(startDate = null, endDate = null) {
    let query = `
      SELECT
        COUNT(*) as total_transactions,
        COALESCE(SUM(gross_amount), 0) as gross_revenue,
        COALESCE(SUM(platform_fee), 0) as platform_revenue,
        COALESCE(SUM(developer_revenue), 0) as developer_payouts
      FROM plugin_purchases
      WHERE status = 'completed'
    `;

    const params = [];

    if (startDate) {
      query += ` AND created_at >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND created_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    const result = await pool.query(query, params);

    // Monthly breakdown
    const monthlyResult = await pool.query(
      `SELECT
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as transactions,
        SUM(gross_amount) as gross,
        SUM(platform_fee) as platform,
        SUM(developer_revenue) as developer
       FROM plugin_purchases
       WHERE status = 'completed'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month DESC
       LIMIT 12`
    );

    return {
      summary: result.rows[0],
      monthly: monthlyResult.rows
    };
  }
}

module.exports = RevenueShare;
