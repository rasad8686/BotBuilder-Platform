/**
 * Superadmin Routes
 *
 * Platform-wide administration endpoints for superadmins.
 * All routes require superadmin authentication.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireSuperAdmin, logAdminAction } = require('../middleware/requireSuperAdmin');
const authenticateToken = require('../middleware/auth');

// All routes require authentication and superadmin status
router.use(authenticateToken);
router.use(requireSuperAdmin);

/**
 * GET /api/superadmin/dashboard
 * Get superadmin dashboard statistics
 */
router.get('/dashboard', async (req, res) => {
  try {
    // Get total counts
    const [users, organizations, bots, superadmins] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM users'),
      db.query('SELECT COUNT(*) as count FROM organizations'),
      db.query('SELECT COUNT(*) as count FROM bots'),
      db.query('SELECT COUNT(*) as count FROM users WHERE is_superadmin = true')
    ]);

    // Get recent registrations (last 30 days)
    const recentUsers = await db.query(`
      SELECT COUNT(*) as count FROM users
      WHERE created_at > NOW() - INTERVAL '30 days'
    `);

    // Get recent activity (last 7 days)
    const recentActivity = await db.query(`
      SELECT COUNT(*) as count FROM admin_audit_log
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);

    // Get plan distribution
    const planDistribution = await db.query(`
      SELECT plan_tier, COUNT(*) as count
      FROM organizations
      GROUP BY plan_tier
      ORDER BY count DESC
    `);

    // Get top organizations by bot count
    const topOrganizations = await db.query(`
      SELECT o.id, o.name, o.plan_tier, COUNT(b.id) as bot_count
      FROM organizations o
      LEFT JOIN bots b ON b.organization_id = o.id
      GROUP BY o.id, o.name, o.plan_tier
      ORDER BY bot_count DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        totalUsers: parseInt(users.rows[0].count),
        totalOrganizations: parseInt(organizations.rows[0].count),
        totalBots: parseInt(bots.rows[0].count),
        totalSuperadmins: parseInt(superadmins.rows[0].count),
        recentRegistrations: parseInt(recentUsers.rows[0].count),
        recentActivity: parseInt(recentActivity.rows[0].count),
        planDistribution: planDistribution.rows,
        topOrganizations: topOrganizations.rows
      }
    });
  } catch (error) {
    // Superadmin dashboard error - silent fail
    res.status(500).json({
      success: false,
      message: 'Failed to load dashboard data'
    });
  }
});

/**
 * GET /api/superadmin/users
 * List all users with pagination and search
 */
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [limit, offset];

    if (search) {
      whereClause = 'WHERE u.email ILIKE $3 OR u.name ILIKE $3';
      params.push(`%${search}%`);
    }

    const users = await db.query(`
      SELECT u.id, u.name, u.email, u.is_superadmin, u.email_verified,
             u.created_at, u.updated_at,
             COUNT(DISTINCT om.org_id) as org_count
      FROM users u
      LEFT JOIN organization_members om ON om.user_id = u.id
      ${whereClause}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `, params);

    const countParams = search ? [`%${search}%`] : [];
    const totalResult = await db.query(`
      SELECT COUNT(*) as count FROM users u
      ${whereClause.replace('$3', '$1')}
    `, countParams);

    res.json({
      success: true,
      data: {
        users: users.rows,
        pagination: {
          page,
          limit,
          total: parseInt(totalResult.rows[0].count),
          pages: Math.ceil(totalResult.rows[0].count / limit)
        }
      }
    });
  } catch (error) {
    // List users error - silent fail
    res.status(500).json({
      success: false,
      message: 'Failed to list users'
    });
  }
});

/**
 * GET /api/superadmin/users/:id
 * Get user details
 */
router.get('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await db.query(`
      SELECT u.id, u.name, u.email, u.is_superadmin, u.email_verified,
             u.created_at, u.updated_at, u.two_factor_enabled
      FROM users u
      WHERE u.id = $1
    `, [userId]);

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's organizations
    const orgs = await db.query(`
      SELECT o.id, o.name, o.slug, o.plan_tier, om.role, o.owner_id
      FROM organizations o
      JOIN organization_members om ON om.org_id = o.id
      WHERE om.user_id = $1
    `, [userId]);

    res.json({
      success: true,
      data: {
        user: user.rows[0],
        organizations: orgs.rows
      }
    });
  } catch (error) {
    // Get user error - silent fail
    res.status(500).json({
      success: false,
      message: 'Failed to get user details'
    });
  }
});

/**
 * PUT /api/superadmin/users/:id/superadmin
 * Toggle superadmin status
 */
router.put('/users/:id/superadmin', async (req, res) => {
  try {
    const userId = req.params.id;
    const { is_superadmin } = req.body;

    // Prevent removing own superadmin status
    if (parseInt(userId) === req.user.id && !is_superadmin) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove your own superadmin status'
      });
    }

    const result = await db.query(`
      UPDATE users SET is_superadmin = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, is_superadmin
    `, [is_superadmin, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Log action
    await logAdminAction(
      req.user.id,
      req.user.email,
      is_superadmin ? 'GRANT_SUPERADMIN' : 'REVOKE_SUPERADMIN',
      'user',
      userId,
      { targetEmail: result.rows[0].email },
      req
    );

    res.json({
      success: true,
      message: is_superadmin ? 'Superadmin status granted' : 'Superadmin status revoked',
      data: result.rows[0]
    });
  } catch (error) {
    // Toggle superadmin error - silent fail
    res.status(500).json({
      success: false,
      message: 'Failed to update superadmin status'
    });
  }
});

/**
 * GET /api/superadmin/organizations
 * List all organizations
 */
router.get('/organizations', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [limit, offset];

    if (search) {
      whereClause = 'WHERE o.name ILIKE $3 OR o.slug ILIKE $3';
      params.push(`%${search}%`);
    }

    const orgs = await db.query(`
      SELECT o.id, o.name, o.slug, o.plan_tier, o.created_at,
             u.name as owner_name, u.email as owner_email,
             COUNT(DISTINCT om.user_id) as member_count,
             COUNT(DISTINCT b.id) as bot_count
      FROM organizations o
      JOIN users u ON u.id = o.owner_id
      LEFT JOIN organization_members om ON om.org_id = o.id
      LEFT JOIN bots b ON b.organization_id = o.id
      ${whereClause}
      GROUP BY o.id, u.name, u.email
      ORDER BY o.created_at DESC
      LIMIT $1 OFFSET $2
    `, params);

    const countParams = search ? [`%${search}%`] : [];
    const totalResult = await db.query(`
      SELECT COUNT(*) as count FROM organizations o
      ${whereClause.replace('$3', '$1')}
    `, countParams);

    res.json({
      success: true,
      data: {
        organizations: orgs.rows,
        pagination: {
          page,
          limit,
          total: parseInt(totalResult.rows[0].count),
          pages: Math.ceil(totalResult.rows[0].count / limit)
        }
      }
    });
  } catch (error) {
    // List organizations error - silent fail
    res.status(500).json({
      success: false,
      message: 'Failed to list organizations'
    });
  }
});

/**
 * PUT /api/superadmin/organizations/:id/plan
 * Update organization plan
 */
router.put('/organizations/:id/plan', async (req, res) => {
  try {
    const orgId = req.params.id;
    const { plan_tier } = req.body;

    const validPlans = ['free', 'starter', 'pro', 'enterprise'];
    if (!validPlans.includes(plan_tier)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan tier'
      });
    }

    const result = await db.query(`
      UPDATE organizations SET plan_tier = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, name, plan_tier
    `, [plan_tier, orgId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Log action
    await logAdminAction(
      req.user.id,
      req.user.email,
      'UPDATE_ORG_PLAN',
      'organization',
      orgId,
      { newPlan: plan_tier, orgName: result.rows[0].name },
      req
    );

    res.json({
      success: true,
      message: 'Plan updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    // Update org plan error - silent fail
    res.status(500).json({
      success: false,
      message: 'Failed to update plan'
    });
  }
});

/**
 * GET /api/superadmin/audit-logs
 * Get admin audit logs
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const action = req.query.action || '';
    const userId = req.query.userId || '';
    const offset = (page - 1) * limit;

    let conditions = [];
    let params = [limit, offset];
    let paramIndex = 3;

    if (action) {
      conditions.push(`action = $${paramIndex}`);
      params.push(action);
      paramIndex++;
    }

    if (userId) {
      conditions.push(`user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const logs = await db.query(`
      SELECT al.*, u.name as user_name
      FROM admin_audit_log al
      LEFT JOIN users u ON u.id = al.user_id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $1 OFFSET $2
    `, params);

    const countParams = params.slice(2);
    const totalResult = await db.query(`
      SELECT COUNT(*) as count FROM admin_audit_log al
      ${whereClause.replace(/\$(\d+)/g, (match, num) => `$${parseInt(num) - 2}`)}
    `, countParams);

    res.json({
      success: true,
      data: {
        logs: logs.rows,
        pagination: {
          page,
          limit,
          total: parseInt(totalResult.rows[0].count),
          pages: Math.ceil(totalResult.rows[0].count / limit)
        }
      }
    });
  } catch (error) {
    // Get audit logs error - silent fail
    res.status(500).json({
      success: false,
      message: 'Failed to get audit logs'
    });
  }
});

/**
 * GET /api/superadmin/ip-whitelist
 * Get IP whitelist
 */
router.get('/ip-whitelist', async (req, res) => {
  try {
    const whitelist = await db.query(`
      SELECT iw.*, u.name as created_by_name, u.email as created_by_email
      FROM admin_ip_whitelist iw
      LEFT JOIN users u ON u.id = iw.created_by
      ORDER BY iw.created_at DESC
    `);

    res.json({
      success: true,
      data: whitelist.rows
    });
  } catch (error) {
    // Get IP whitelist error - silent fail
    res.status(500).json({
      success: false,
      message: 'Failed to get IP whitelist'
    });
  }
});

/**
 * POST /api/superadmin/ip-whitelist
 * Add IP to whitelist
 */
router.post('/ip-whitelist', async (req, res) => {
  try {
    const { ip_address, description } = req.body;

    if (!ip_address) {
      return res.status(400).json({
        success: false,
        message: 'IP address is required'
      });
    }

    const result = await db.query(`
      INSERT INTO admin_ip_whitelist (ip_address, description, created_by, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING *
    `, [ip_address, description || '', req.user.id]);

    // Log action
    await logAdminAction(
      req.user.id,
      req.user.email,
      'ADD_IP_WHITELIST',
      'ip_whitelist',
      result.rows[0].id,
      { ip_address, description },
      req
    );

    res.json({
      success: true,
      message: 'IP added to whitelist',
      data: result.rows[0]
    });
  } catch (error) {
    // Add IP whitelist error - silent fail
    res.status(500).json({
      success: false,
      message: 'Failed to add IP to whitelist'
    });
  }
});

/**
 * DELETE /api/superadmin/ip-whitelist/:id
 * Remove IP from whitelist
 */
router.delete('/ip-whitelist/:id', async (req, res) => {
  try {
    const result = await db.query(`
      DELETE FROM admin_ip_whitelist WHERE id = $1
      RETURNING ip_address
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'IP not found in whitelist'
      });
    }

    // Log action
    await logAdminAction(
      req.user.id,
      req.user.email,
      'REMOVE_IP_WHITELIST',
      'ip_whitelist',
      req.params.id,
      { ip_address: result.rows[0].ip_address },
      req
    );

    res.json({
      success: true,
      message: 'IP removed from whitelist'
    });
  } catch (error) {
    // Remove IP whitelist error - silent fail
    res.status(500).json({
      success: false,
      message: 'Failed to remove IP from whitelist'
    });
  }
});

/**
 * GET /api/superadmin/login-attempts
 * Get recent admin login attempts
 */
router.get('/login-attempts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const attempts = await db.query(`
      SELECT * FROM admin_login_attempts
      ORDER BY attempted_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const totalResult = await db.query('SELECT COUNT(*) as count FROM admin_login_attempts');

    res.json({
      success: true,
      data: {
        attempts: attempts.rows,
        pagination: {
          page,
          limit,
          total: parseInt(totalResult.rows[0].count),
          pages: Math.ceil(totalResult.rows[0].count / limit)
        }
      }
    });
  } catch (error) {
    // Get login attempts error - silent fail
    res.status(500).json({
      success: false,
      message: 'Failed to get login attempts'
    });
  }
});

/**
 * GET /api/superadmin/me
 * Get current superadmin info
 */
router.get('/me', async (req, res) => {
  try {
    const user = await db.query(`
      SELECT id, name, email, is_superadmin, created_at
      FROM users WHERE id = $1
    `, [req.user.id]);

    res.json({
      success: true,
      data: user.rows[0]
    });
  } catch (error) {
    // Get superadmin info error - silent fail
    res.status(500).json({
      success: false,
      message: 'Failed to get superadmin info'
    });
  }
});

module.exports = router;
