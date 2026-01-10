/**
 * @fileoverview Reseller/Partner Portal Routes
 * @description API endpoints for reseller management, customers, commissions, and payouts
 * @module routes/reseller
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const resellerService = require('../services/resellerService');
const log = require('../utils/logger');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ==========================================
// MIDDLEWARE: Authenticate User
// ==========================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Invalid token' });
  }
};

// ==========================================
// MIDDLEWARE: Authenticate Reseller
// ==========================================
const authenticateReseller = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT r.* FROM resellers r
       WHERE r.user_id = $1 AND r.status IN ('approved', 'active')`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Reseller access required'
      });
    }

    req.reseller = result.rows[0];
    next();
  } catch (error) {
    log.error('[RESELLER] Auth error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// MIDDLEWARE: Admin Check
// ==========================================
const requireAdmin = async (req, res, next) => {
  try {
    const orgId = req.headers['x-organization-id'] || req.user.current_organization_id;

    const result = await db.query(
      `SELECT role FROM organization_members
       WHERE user_id = $1 AND org_id = $2 AND status = 'active'`,
      [req.user.id, orgId]
    );

    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// PUBLIC: Apply to become a reseller
// ==========================================
router.post('/apply', async (req, res) => {
  try {
    const {
      name,
      email,
      company_name,
      phone,
      website,
      description,
      country
    } = req.body;

    // Validation
    if (!name || !email || !company_name) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and company name are required'
      });
    }

    // Check if already applied
    const existing = await db.query(
      'SELECT id, status FROM resellers WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Application already exists for this email',
        status: existing.rows[0].status
      });
    }

    // Generate API key for future use
    const apiKey = `rsl_${crypto.randomBytes(32).toString('hex')}`;

    // Create reseller application
    const result = await db.query(
      `INSERT INTO resellers (name, email, company_name, phone, website, description, country, api_key, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING id, name, email, company_name, status, created_at`,
      [name, email, company_name, phone, website, description, country, apiKey]
    );

    log.info('[RESELLER] New application', { email, company: company_name });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully. We will review and contact you soon.',
      application: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        email: result.rows[0].email,
        company_name: result.rows[0].company_name,
        status: result.rows[0].status,
        created_at: result.rows[0].created_at
      }
    });
  } catch (error) {
    log.error('[RESELLER] Apply error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// RESELLER PORTAL: Dashboard Stats
// ==========================================
router.get('/dashboard', authenticateToken, authenticateReseller, async (req, res) => {
  try {
    const resellerId = req.reseller.id;

    // Get customer count
    const customerCount = await db.query(
      `SELECT COUNT(*) as count FROM reseller_customers WHERE reseller_id = $1 AND status = 'active'`,
      [resellerId]
    );

    // Get total revenue (last 12 months)
    const revenueStats = await db.query(
      `SELECT
         COALESCE(SUM(revenue), 0) as total_revenue,
         COALESCE(SUM(commission_amount), 0) as total_commission
       FROM reseller_commissions
       WHERE reseller_id = $1
         AND period_start >= NOW() - INTERVAL '12 months'`,
      [resellerId]
    );

    // Get pending commissions
    const pendingCommissions = await db.query(
      `SELECT COALESCE(SUM(commission_amount), 0) as pending
       FROM reseller_commissions
       WHERE reseller_id = $1 AND status = 'pending'`,
      [resellerId]
    );

    // Get monthly revenue trend (last 6 months)
    const monthlyTrend = await db.query(
      `SELECT
         TO_CHAR(period_start, 'YYYY-MM') as month,
         SUM(revenue) as revenue,
         SUM(commission_amount) as commission
       FROM reseller_commissions
       WHERE reseller_id = $1
         AND period_start >= NOW() - INTERVAL '6 months'
       GROUP BY TO_CHAR(period_start, 'YYYY-MM')
       ORDER BY month DESC`,
      [resellerId]
    );

    // Get recent customers
    const recentCustomers = await db.query(
      `SELECT rc.*, o.name as organization_name
       FROM reseller_customers rc
       JOIN organizations o ON rc.organization_id = o.id
       WHERE rc.reseller_id = $1
       ORDER BY rc.created_at DESC
       LIMIT 5`,
      [resellerId]
    );

    // Get payout summary
    const payoutSummary = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_paid,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_payout
       FROM reseller_payouts
       WHERE reseller_id = $1`,
      [resellerId]
    );

    res.json({
      success: true,
      dashboard: {
        reseller: {
          id: req.reseller.id,
          name: req.reseller.name,
          tier: req.reseller.tier,
          commission_rate: req.reseller.commission_rate
        },
        stats: {
          customer_count: parseInt(customerCount.rows[0].count),
          total_revenue: parseFloat(revenueStats.rows[0].total_revenue) || 0,
          total_commission: parseFloat(revenueStats.rows[0].total_commission) || 0,
          pending_commission: parseFloat(pendingCommissions.rows[0].pending) || 0,
          total_paid: parseFloat(payoutSummary.rows[0].total_paid) || 0,
          pending_payout: parseFloat(payoutSummary.rows[0].pending_payout) || 0
        },
        monthly_trend: monthlyTrend.rows,
        recent_customers: recentCustomers.rows
      }
    });
  } catch (error) {
    log.error('[RESELLER] Dashboard error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// RESELLER PORTAL: Customer List
// ==========================================
router.get('/customers', authenticateToken, authenticateReseller, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        rc.*,
        o.name as organization_name,
        o.plan_tier,
        o.created_at as org_created_at
      FROM reseller_customers rc
      JOIN organizations o ON rc.organization_id = o.id
      WHERE rc.reseller_id = $1
    `;
    const params = [req.reseller.id];
    let paramIndex = 2;

    if (status) {
      query += ` AND rc.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      query += ` AND o.name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count
    const countResult = await db.query(
      query.replace('SELECT \n        rc.*,\n        o.name as organization_name,\n        o.plan_tier,\n        o.created_at as org_created_at', 'SELECT COUNT(*)'),
      params
    );

    // Get paginated results
    query += ` ORDER BY rc.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      customers: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    log.error('[RESELLER] Get customers error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// RESELLER PORTAL: Create Customer
// ==========================================
router.post('/customers', authenticateToken, authenticateReseller, async (req, res) => {
  try {
    const { organization_id, custom_price, margin, notes } = req.body;

    if (!organization_id) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required'
      });
    }

    // Check if organization exists
    const orgCheck = await db.query(
      'SELECT id, name FROM organizations WHERE id = $1',
      [organization_id]
    );

    if (orgCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Check if already a customer
    const existingCheck = await db.query(
      'SELECT id FROM reseller_customers WHERE reseller_id = $1 AND organization_id = $2',
      [req.reseller.id, organization_id]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Organization is already a customer'
      });
    }

    // Create customer relationship
    const result = await db.query(
      `INSERT INTO reseller_customers (reseller_id, organization_id, custom_price, margin, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.reseller.id, organization_id, custom_price, margin, notes]
    );

    // Log activity
    await db.query(
      `INSERT INTO reseller_activity_logs (reseller_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'customer_added', 'customer', $2, $3, $4)`,
      [req.reseller.id, result.rows[0].id, JSON.stringify({ organization_id }), req.ip]
    );

    log.info('[RESELLER] Customer added', {
      resellerId: req.reseller.id,
      organizationId: organization_id
    });

    res.status(201).json({
      success: true,
      message: 'Customer added successfully',
      customer: {
        ...result.rows[0],
        organization_name: orgCheck.rows[0].name
      }
    });
  } catch (error) {
    log.error('[RESELLER] Create customer error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// RESELLER PORTAL: Commission List
// ==========================================
router.get('/commissions', authenticateToken, authenticateReseller, async (req, res) => {
  try {
    const { status, year, month, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        rc.*,
        o.name as organization_name
      FROM reseller_commissions rc
      LEFT JOIN organizations o ON rc.organization_id = o.id
      WHERE rc.reseller_id = $1
    `;
    const params = [req.reseller.id];
    let paramIndex = 2;

    if (status) {
      query += ` AND rc.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (year) {
      query += ` AND EXTRACT(YEAR FROM rc.period_start) = $${paramIndex}`;
      params.push(year);
      paramIndex++;
    }

    if (month) {
      query += ` AND EXTRACT(MONTH FROM rc.period_start) = $${paramIndex}`;
      params.push(month);
      paramIndex++;
    }

    // Get total count
    const countQuery = query.replace(
      'SELECT \n        rc.*,\n        o.name as organization_name',
      'SELECT COUNT(*)'
    );
    const countResult = await db.query(countQuery, params);

    // Get paginated results
    query += ` ORDER BY rc.period_start DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get summary
    const summaryResult = await db.query(
      `SELECT
         status,
         COUNT(*) as count,
         SUM(commission_amount) as total
       FROM reseller_commissions
       WHERE reseller_id = $1
       GROUP BY status`,
      [req.reseller.id]
    );

    const summary = {
      pending: { count: 0, total: 0 },
      approved: { count: 0, total: 0 },
      paid: { count: 0, total: 0 }
    };

    summaryResult.rows.forEach(row => {
      summary[row.status] = {
        count: parseInt(row.count),
        total: parseFloat(row.total) || 0
      };
    });

    res.json({
      success: true,
      commissions: result.rows,
      summary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    log.error('[RESELLER] Get commissions error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// RESELLER PORTAL: Payout History
// ==========================================
router.get('/payouts', authenticateToken, authenticateReseller, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT * FROM reseller_payouts
      WHERE reseller_id = $1
    `;
    const params = [req.reseller.id];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Get total count
    const countResult = await db.query(
      query.replace('SELECT *', 'SELECT COUNT(*)'),
      params
    );

    // Get paginated results
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get available balance (approved commissions not yet paid)
    const balanceResult = await db.query(
      `SELECT COALESCE(SUM(commission_amount), 0) as available
       FROM reseller_commissions
       WHERE reseller_id = $1 AND status = 'approved' AND payout_id IS NULL`,
      [req.reseller.id]
    );

    res.json({
      success: true,
      payouts: result.rows,
      available_balance: parseFloat(balanceResult.rows[0].available) || 0,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    log.error('[RESELLER] Get payouts error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// RESELLER PORTAL: Request Payout
// ==========================================
router.post('/payouts/request', authenticateToken, authenticateReseller, async (req, res) => {
  try {
    const { method = 'bank_transfer', notes } = req.body;

    // Get available balance
    const balanceResult = await db.query(
      `SELECT COALESCE(SUM(commission_amount), 0) as available
       FROM reseller_commissions
       WHERE reseller_id = $1 AND status = 'approved' AND payout_id IS NULL`,
      [req.reseller.id]
    );

    const availableBalance = parseFloat(balanceResult.rows[0].available) || 0;

    if (availableBalance < 50) {
      return res.status(400).json({
        success: false,
        message: 'Minimum payout amount is $50. Your available balance is $' + availableBalance.toFixed(2)
      });
    }

    // Check if there's a pending payout
    const pendingCheck = await db.query(
      `SELECT id FROM reseller_payouts WHERE reseller_id = $1 AND status = 'pending'`,
      [req.reseller.id]
    );

    if (pendingCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending payout request'
      });
    }

    // Create payout request
    const payoutResult = await db.query(
      `INSERT INTO reseller_payouts (reseller_id, amount, method, status, notes, payment_details)
       VALUES ($1, $2, $3, 'pending', $4, $5)
       RETURNING *`,
      [req.reseller.id, availableBalance, method, notes, req.reseller.payment_info]
    );

    // Link commissions to this payout
    await db.query(
      `UPDATE reseller_commissions
       SET payout_id = $1
       WHERE reseller_id = $2 AND status = 'approved' AND payout_id IS NULL`,
      [payoutResult.rows[0].id, req.reseller.id]
    );

    // Log activity
    await db.query(
      `INSERT INTO reseller_activity_logs (reseller_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'payout_requested', 'payout', $2, $3, $4)`,
      [req.reseller.id, payoutResult.rows[0].id, JSON.stringify({ amount: availableBalance, method }), req.ip]
    );

    log.info('[RESELLER] Payout requested', {
      resellerId: req.reseller.id,
      amount: availableBalance
    });

    res.status(201).json({
      success: true,
      message: 'Payout request submitted successfully',
      payout: payoutResult.rows[0]
    });
  } catch (error) {
    log.error('[RESELLER] Request payout error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// RESELLER PORTAL: Get Branding Settings
// ==========================================
router.get('/branding', authenticateToken, authenticateReseller, async (req, res) => {
  try {
    res.json({
      success: true,
      branding: req.reseller.custom_branding || {},
      tier: req.reseller.tier,
      features: {
        custom_logo: ['gold', 'platinum'].includes(req.reseller.tier),
        custom_colors: ['gold', 'platinum'].includes(req.reseller.tier),
        custom_domain: req.reseller.tier === 'platinum',
        white_label_emails: req.reseller.tier === 'platinum'
      }
    });
  } catch (error) {
    log.error('[RESELLER] Get branding error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// RESELLER PORTAL: Update Branding Settings
// ==========================================
router.put('/branding', authenticateToken, authenticateReseller, async (req, res) => {
  try {
    const { logo_url, primary_color, secondary_color, company_name, custom_domain } = req.body;

    // Check tier permissions
    const tier = req.reseller.tier;

    if (!['gold', 'platinum'].includes(tier)) {
      return res.status(403).json({
        success: false,
        message: 'Custom branding requires Gold or Platinum tier'
      });
    }

    if (custom_domain && tier !== 'platinum') {
      return res.status(403).json({
        success: false,
        message: 'Custom domain requires Platinum tier'
      });
    }

    const branding = {
      logo_url,
      primary_color,
      secondary_color,
      company_name,
      custom_domain: tier === 'platinum' ? custom_domain : null,
      updated_at: new Date().toISOString()
    };

    const result = await db.query(
      `UPDATE resellers SET custom_branding = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING custom_branding`,
      [JSON.stringify(branding), req.reseller.id]
    );

    // Log activity
    await db.query(
      `INSERT INTO reseller_activity_logs (reseller_id, action, entity_type, details, ip_address)
       VALUES ($1, 'branding_updated', 'branding', $2, $3)`,
      [req.reseller.id, JSON.stringify(branding), req.ip]
    );

    log.info('[RESELLER] Branding updated', { resellerId: req.reseller.id });

    res.json({
      success: true,
      message: 'Branding settings updated successfully',
      branding: result.rows[0].custom_branding
    });
  } catch (error) {
    log.error('[RESELLER] Update branding error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// ADMIN: Get All Resellers
// ==========================================
router.get('/admin/list', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, tier, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        r.*,
        (SELECT COUNT(*) FROM reseller_customers WHERE reseller_id = r.id) as customer_count,
        (SELECT COALESCE(SUM(commission_amount), 0) FROM reseller_commissions WHERE reseller_id = r.id) as total_commission
      FROM resellers r
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (tier) {
      query += ` AND r.tier = $${paramIndex}`;
      params.push(tier);
      paramIndex++;
    }

    if (search) {
      query += ` AND (r.name ILIKE $${paramIndex} OR r.email ILIKE $${paramIndex} OR r.company_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM resellers r WHERE 1=1` +
      (status ? ` AND r.status = $1` : '') +
      (tier ? ` AND r.tier = $${status ? 2 : 1}` : '') +
      (search ? ` AND (r.name ILIKE $${(status ? 1 : 0) + (tier ? 1 : 0) + 1} OR r.email ILIKE $${(status ? 1 : 0) + (tier ? 1 : 0) + 1})` : ''),
      params.slice(0, paramIndex - 1)
    );

    // Get paginated results
    query += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      resellers: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    log.error('[RESELLER ADMIN] Get list error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// ADMIN: Approve Reseller
// ==========================================
router.put('/admin/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { tier = 'silver', commission_rate = 10 } = req.body;

    const result = await db.query(
      `UPDATE resellers
       SET status = 'approved', tier = $1, commission_rate = $2, approved_at = NOW(), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [tier, commission_rate, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reseller not found'
      });
    }

    log.info('[RESELLER ADMIN] Reseller approved', {
      resellerId: id,
      tier,
      commission_rate
    });

    res.json({
      success: true,
      message: 'Reseller approved successfully',
      reseller: result.rows[0]
    });
  } catch (error) {
    log.error('[RESELLER ADMIN] Approve error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// ADMIN: Update Reseller Tier
// ==========================================
router.put('/admin/:id/tier', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { tier, commission_rate } = req.body;

    if (!tier || !['silver', 'gold', 'platinum'].includes(tier)) {
      return res.status(400).json({
        success: false,
        message: 'Valid tier (silver, gold, platinum) is required'
      });
    }

    const updates = ['tier = $1', 'updated_at = NOW()'];
    const params = [tier];
    let paramIndex = 2;

    if (commission_rate !== undefined) {
      updates.push(`commission_rate = $${paramIndex}`);
      params.push(commission_rate);
      paramIndex++;
    }

    params.push(id);

    const result = await db.query(
      `UPDATE resellers SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reseller not found'
      });
    }

    log.info('[RESELLER ADMIN] Tier updated', { resellerId: id, tier });

    res.json({
      success: true,
      message: 'Reseller tier updated successfully',
      reseller: result.rows[0]
    });
  } catch (error) {
    log.error('[RESELLER ADMIN] Update tier error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
