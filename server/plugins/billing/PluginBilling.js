const pool = require('../../db');
const log = require('../../utils/logger');

// Stripe integration (mock if not configured)
let stripe = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
} catch (e) {
  log.info('Stripe not configured, using mock payments');
}

class PluginBilling {
  // Revenue split configuration
  static DEVELOPER_SHARE = 0.70; // 70%
  static PLATFORM_SHARE = 0.30;  // 30%

  /**
   * Create a plugin purchase record
   */
  static async createPluginPurchase(userId, pluginId, paymentDetails) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get plugin details
      const pluginResult = await client.query(
        'SELECT * FROM plugins WHERE id = $1',
        [pluginId]
      );

      if (pluginResult.rows.length === 0) {
        throw new Error('Plugin not found');
      }

      const plugin = pluginResult.rows[0];

      // Check if already purchased
      const existingPurchase = await client.query(
        `SELECT id FROM plugin_purchases
         WHERE user_id = $1 AND plugin_id = $2 AND status = 'completed'`,
        [userId, pluginId]
      );

      if (existingPurchase.rows.length > 0) {
        throw new Error('Plugin already purchased');
      }

      // Calculate amounts
      const grossAmount = parseFloat(plugin.price) || 0;
      const platformFee = grossAmount * PluginBilling.PLATFORM_SHARE;
      const developerRevenue = grossAmount * PluginBilling.DEVELOPER_SHARE;

      // Create purchase record
      const purchaseResult = await client.query(
        `INSERT INTO plugin_purchases
         (user_id, plugin_id, developer_id, gross_amount, platform_fee, developer_revenue,
          payment_method, payment_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         RETURNING *`,
        [
          userId,
          pluginId,
          plugin.developer_id,
          grossAmount,
          platformFee,
          developerRevenue,
          paymentDetails.method || 'stripe',
          paymentDetails.paymentId || null,
          'pending'
        ]
      );

      await client.query('COMMIT');
      return purchaseResult.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process payment through Stripe
   */
  static async processPayment(purchaseId, paymentMethodId, customerId = null) {
    const client = await pool.connect();

    try {
      // Get purchase details
      const purchaseResult = await client.query(
        `SELECT pp.*, p.name as plugin_name, p.price, u.email as buyer_email
         FROM plugin_purchases pp
         JOIN plugins p ON pp.plugin_id = p.id
         JOIN users u ON pp.user_id = u.id
         WHERE pp.id = $1`,
        [purchaseId]
      );

      if (purchaseResult.rows.length === 0) {
        throw new Error('Purchase not found');
      }

      const purchase = purchaseResult.rows[0];

      if (purchase.status === 'completed') {
        throw new Error('Purchase already completed');
      }

      let paymentResult;

      if (stripe) {
        // Real Stripe payment
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(purchase.gross_amount * 100), // Convert to cents
          currency: 'usd',
          payment_method: paymentMethodId,
          customer: customerId,
          confirm: true,
          description: `Plugin purchase: ${purchase.plugin_name}`,
          metadata: {
            purchase_id: purchaseId,
            plugin_id: purchase.plugin_id,
            user_id: purchase.user_id
          },
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never'
          }
        });

        paymentResult = {
          success: paymentIntent.status === 'succeeded',
          paymentId: paymentIntent.id,
          status: paymentIntent.status
        };
      } else {
        // Mock payment for development
        paymentResult = {
          success: true,
          paymentId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          status: 'succeeded'
        };
      }

      if (paymentResult.success) {
        await client.query('BEGIN');

        // Update purchase status
        await client.query(
          `UPDATE plugin_purchases
           SET status = 'completed', payment_id = $1, completed_at = NOW()
           WHERE id = $2`,
          [paymentResult.paymentId, purchaseId]
        );

        // Create installation record
        await client.query(
          `INSERT INTO plugin_installations (plugin_id, tenant_id, installed_at, is_active)
           SELECT $1, u.current_organization_id, NOW(), true
           FROM users u WHERE u.id = $2
           ON CONFLICT (plugin_id, tenant_id) DO UPDATE SET is_active = true`,
          [purchase.plugin_id, purchase.user_id]
        );

        // Update download count
        await client.query(
          'UPDATE plugins SET downloads = COALESCE(downloads, 0) + 1 WHERE id = $1',
          [purchase.plugin_id]
        );

        // Add to developer earnings
        await client.query(
          `INSERT INTO developer_earnings
           (developer_id, plugin_id, purchase_id, amount, status, created_at)
           VALUES ($1, $2, $3, $4, 'pending', NOW())`,
          [purchase.developer_id, purchase.plugin_id, purchaseId, purchase.developer_revenue]
        );

        await client.query('COMMIT');

        return {
          success: true,
          purchaseId,
          paymentId: paymentResult.paymentId,
          message: 'Payment successful'
        };
      } else {
        // Update purchase as failed
        await client.query(
          `UPDATE plugin_purchases SET status = 'failed' WHERE id = $1`,
          [purchaseId]
        );

        return {
          success: false,
          error: 'Payment failed',
          status: paymentResult.status
        };
      }

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create Stripe checkout session
   */
  static async createCheckoutSession(userId, pluginId, successUrl, cancelUrl) {
    // Get plugin details
    const pluginResult = await pool.query(
      'SELECT * FROM plugins WHERE id = $1',
      [pluginId]
    );

    if (pluginResult.rows.length === 0) {
      throw new Error('Plugin not found');
    }

    const plugin = pluginResult.rows[0];

    if (plugin.is_free) {
      throw new Error('This plugin is free');
    }

    // Get user details
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];

    if (stripe) {
      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: plugin.name,
              description: plugin.description || `Plugin: ${plugin.name}`,
              images: plugin.icon_url ? [plugin.icon_url] : []
            },
            unit_amount: Math.round(plugin.price * 100)
          },
          quantity: 1
        }],
        mode: 'payment',
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        customer_email: user.email,
        metadata: {
          plugin_id: pluginId,
          user_id: userId
        }
      });

      // Create pending purchase
      await this.createPluginPurchase(userId, pluginId, {
        method: 'stripe',
        paymentId: session.id
      });

      return {
        sessionId: session.id,
        url: session.url
      };
    } else {
      // Mock checkout for development
      const mockSessionId = `cs_mock_${Date.now()}`;

      await this.createPluginPurchase(userId, pluginId, {
        method: 'mock',
        paymentId: mockSessionId
      });

      return {
        sessionId: mockSessionId,
        url: `${successUrl}?session_id=${mockSessionId}&mock=true`
      };
    }
  }

  /**
   * Handle Stripe webhook for completed checkout
   */
  static async handleCheckoutComplete(sessionId) {
    const client = await pool.connect();

    try {
      // Find purchase by payment_id (session_id)
      const purchaseResult = await client.query(
        `SELECT * FROM plugin_purchases WHERE payment_id = $1`,
        [sessionId]
      );

      if (purchaseResult.rows.length === 0) {
        throw new Error('Purchase not found for session');
      }

      const purchase = purchaseResult.rows[0];

      if (purchase.status === 'completed') {
        return { success: true, message: 'Already processed' };
      }

      await client.query('BEGIN');

      // Update purchase status
      await client.query(
        `UPDATE plugin_purchases
         SET status = 'completed', completed_at = NOW()
         WHERE id = $1`,
        [purchase.id]
      );

      // Create installation
      await client.query(
        `INSERT INTO plugin_installations (plugin_id, tenant_id, installed_at, is_active)
         SELECT $1, u.current_organization_id, NOW(), true
         FROM users u WHERE u.id = $2
         ON CONFLICT (plugin_id, tenant_id) DO UPDATE SET is_active = true`,
        [purchase.plugin_id, purchase.user_id]
      );

      // Update downloads
      await client.query(
        'UPDATE plugins SET downloads = COALESCE(downloads, 0) + 1 WHERE id = $1',
        [purchase.plugin_id]
      );

      // Add earnings
      await client.query(
        `INSERT INTO developer_earnings
         (developer_id, plugin_id, purchase_id, amount, status, created_at)
         VALUES ($1, $2, $3, $4, 'pending', NOW())`,
        [purchase.developer_id, purchase.plugin_id, purchase.id, purchase.developer_revenue]
      );

      await client.query('COMMIT');

      return { success: true, purchaseId: purchase.id };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Calculate revenue for a developer
   */
  static async calculateRevenue(developerId, startDate = null, endDate = null) {
    let query = `
      SELECT
        COUNT(*) as total_sales,
        COALESCE(SUM(gross_amount), 0) as gross_revenue,
        COALESCE(SUM(developer_revenue), 0) as net_revenue,
        COALESCE(SUM(platform_fee), 0) as platform_fees
      FROM plugin_purchases
      WHERE developer_id = $1 AND status = 'completed'
    `;

    const params = [developerId];

    if (startDate) {
      query += ` AND created_at >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND created_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  /**
   * Get developer earnings summary
   */
  static async getEarnings(developerId) {
    // Total earnings
    const totalResult = await pool.query(
      `SELECT
        COALESCE(SUM(amount), 0) as total_earned,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_balance
       FROM developer_earnings
       WHERE developer_id = $1`,
      [developerId]
    );

    // Monthly breakdown
    const monthlyResult = await pool.query(
      `SELECT
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as sales,
        SUM(amount) as earnings
       FROM developer_earnings
       WHERE developer_id = $1
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month DESC
       LIMIT 12`,
      [developerId]
    );

    // Plugin breakdown
    const pluginResult = await pool.query(
      `SELECT
        p.id, p.name, p.icon_url,
        COUNT(de.id) as sales,
        SUM(de.amount) as earnings
       FROM developer_earnings de
       JOIN plugins p ON de.plugin_id = p.id
       WHERE de.developer_id = $1
       GROUP BY p.id, p.name, p.icon_url
       ORDER BY earnings DESC`,
      [developerId]
    );

    // Recent transactions
    const recentResult = await pool.query(
      `SELECT
        de.*, p.name as plugin_name, u.username as buyer_name
       FROM developer_earnings de
       JOIN plugins p ON de.plugin_id = p.id
       JOIN plugin_purchases pp ON de.purchase_id = pp.id
       JOIN users u ON pp.user_id = u.id
       WHERE de.developer_id = $1
       ORDER BY de.created_at DESC
       LIMIT 20`,
      [developerId]
    );

    // Payout history
    const payoutResult = await pool.query(
      `SELECT * FROM developer_payouts
       WHERE developer_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [developerId]
    );

    return {
      summary: totalResult.rows[0],
      monthly: monthlyResult.rows,
      byPlugin: pluginResult.rows,
      recentTransactions: recentResult.rows,
      payouts: payoutResult.rows
    };
  }

  /**
   * Get purchase history for a user
   */
  static async getPurchaseHistory(userId) {
    const result = await pool.query(
      `SELECT
        pp.*,
        p.name as plugin_name,
        p.icon_url,
        p.version
       FROM plugin_purchases pp
       JOIN plugins p ON pp.plugin_id = p.id
       WHERE pp.user_id = $1
       ORDER BY pp.created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Check if user has purchased a plugin
   */
  static async hasPurchased(userId, pluginId) {
    const result = await pool.query(
      `SELECT id FROM plugin_purchases
       WHERE user_id = $1 AND plugin_id = $2 AND status = 'completed'`,
      [userId, pluginId]
    );

    return result.rows.length > 0;
  }
}

module.exports = PluginBilling;
