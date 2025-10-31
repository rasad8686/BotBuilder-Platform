const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');
const { checkPermission } = require('../middleware/checkPermission');

// Apply authentication to all admin routes
router.use(authenticateToken);

/**
 * GET /api/admin/audit-logs
 * Retrieve audit logs with filtering and pagination
 * Admin only - organization-scoped
 */
router.get('/audit-logs', organizationContext, requireOrganization, checkPermission('admin'), async (req, res) => {
  try {
    const organizationId = req.organization.id;
    console.log('[Admin] Fetching audit logs for organization:', organizationId);

    // Parse query parameters
    const {
      user_id,
      action,
      resource_type,
      start_date,
      end_date,
      page = 1,
      limit = 50
    } = req.query;

    // Build WHERE conditions
    const conditions = ['organization_id = $1'];
    const values = [organizationId];
    let paramCount = 2;

    if (user_id) {
      conditions.push(`user_id = $${paramCount}`);
      values.push(user_id);
      paramCount++;
    }

    if (action) {
      conditions.push(`action = $${paramCount}`);
      values.push(action);
      paramCount++;
    }

    if (resource_type) {
      conditions.push(`resource_type = $${paramCount}`);
      values.push(resource_type);
      paramCount++;
    }

    if (start_date) {
      conditions.push(`created_at >= $${paramCount}`);
      values.push(start_date);
      paramCount++;
    }

    if (end_date) {
      conditions.push(`created_at <= $${paramCount}`);
      values.push(end_date);
      paramCount++;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*)
      FROM audit_logs
      WHERE ${conditions.join(' AND ')}
    `;
    const countResult = await db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Calculate pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;
    const totalPages = Math.ceil(total / limitNum);

    // Get paginated audit logs with user details
    const query = `
      SELECT
        al.id,
        al.user_id,
        al.organization_id,
        al.action,
        al.resource_type,
        al.resource_id,
        al.old_values,
        al.new_values,
        al.ip_address,
        al.user_agent,
        al.metadata,
        al.created_at,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY al.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    values.push(limitNum, offset);
    const result = await db.query(query, values);

    console.log(`[Admin] Found ${result.rows.length} audit logs (total: ${total})`);

    return res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        totalPages: totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });

  } catch (error) {
    console.error('Get audit logs error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      organizationId: req.organization?.id
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit logs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/admin/audit-logs/actions
 * Get list of unique actions for filtering
 * Admin only - organization-scoped
 */
router.get('/audit-logs/actions', organizationContext, requireOrganization, checkPermission('admin'), async (req, res) => {
  try {
    const organizationId = req.organization.id;

    const query = `
      SELECT DISTINCT action
      FROM audit_logs
      WHERE organization_id = $1
      ORDER BY action
    `;

    const result = await db.query(query, [organizationId]);

    return res.status(200).json({
      success: true,
      actions: result.rows.map(row => row.action)
    });

  } catch (error) {
    console.error('Get audit actions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit actions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/admin/stats
 * Get system statistics for the organization
 * Admin only - organization-scoped
 */
router.get('/stats', organizationContext, requireOrganization, checkPermission('admin'), async (req, res) => {
  try {
    const organizationId = req.organization.id;
    console.log('[Admin] Fetching stats for organization:', organizationId);

    // Get various statistics
    const stats = {};

    // Total members
    const membersResult = await db.query(
      'SELECT COUNT(*) as count FROM organization_members WHERE org_id = $1 AND status = $2',
      [organizationId, 'active']
    );
    stats.totalMembers = parseInt(membersResult.rows[0].count);

    // Total bots
    const botsResult = await db.query(
      'SELECT COUNT(*) as count FROM bots WHERE organization_id = $1',
      [organizationId]
    );
    stats.totalBots = parseInt(botsResult.rows[0].count);

    // Active bots
    const activeBotsResult = await db.query(
      'SELECT COUNT(*) as count FROM bots WHERE organization_id = $1 AND is_active = true',
      [organizationId]
    );
    stats.activeBots = parseInt(activeBotsResult.rows[0].count);

    // Total messages (last 30 days)
    const messagesResult = await db.query(
      `SELECT COUNT(*) as count
       FROM messages m
       JOIN bots b ON m.bot_id = b.id
       WHERE b.organization_id = $1
       AND m.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'`,
      [organizationId]
    );
    stats.messagesLast30Days = parseInt(messagesResult.rows[0].count);

    // Total audit events (last 30 days)
    const auditResult = await db.query(
      `SELECT COUNT(*) as count
       FROM audit_logs
       WHERE organization_id = $1
       AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'`,
      [organizationId]
    );
    stats.auditEventsLast30Days = parseInt(auditResult.rows[0].count);

    // Recent activity (last 24 hours)
    const recentActivityResult = await db.query(
      `SELECT action, COUNT(*) as count
       FROM audit_logs
       WHERE organization_id = $1
       AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
       GROUP BY action
       ORDER BY count DESC
       LIMIT 10`,
      [organizationId]
    );
    stats.recentActivity = recentActivityResult.rows;

    // Top users by activity (last 30 days)
    const topUsersResult = await db.query(
      `SELECT
         u.id,
         u.name,
         u.email,
         COUNT(*) as action_count
       FROM audit_logs al
       JOIN users u ON al.user_id = u.id
       WHERE al.organization_id = $1
       AND al.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
       GROUP BY u.id, u.name, u.email
       ORDER BY action_count DESC
       LIMIT 5`,
      [organizationId]
    );
    stats.topUsers = topUsersResult.rows;

    // Organization plan info
    const orgResult = await db.query(
      'SELECT plan_tier, created_at FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (orgResult.rows.length > 0) {
      stats.planTier = orgResult.rows[0].plan_tier;
      stats.organizationCreatedAt = orgResult.rows[0].created_at;
    } else {
      stats.planTier = 'unknown';
      stats.organizationCreatedAt = null;
    }

    console.log('[Admin] Stats retrieved successfully:', {
      totalMembers: stats.totalMembers,
      totalBots: stats.totalBots,
      activeBots: stats.activeBots,
      messagesLast30Days: stats.messagesLast30Days,
      auditEventsLast30Days: stats.auditEventsLast30Days
    });

    return res.status(200).json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('Get stats error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      organizationId: req.organization?.id
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/admin/health
 * System health check
 * Admin only - requires organization context for permission check
 */
router.get('/health', organizationContext, requireOrganization, checkPermission('admin'), async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: 'connected'
    };

    // Test database connection
    try {
      await db.query('SELECT 1');
    } catch (dbError) {
      health.status = 'unhealthy';
      health.database = 'disconnected';
      health.databaseError = dbError.message;
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;

    return res.status(statusCode).json({
      success: health.status === 'healthy',
      health: health
    });

  } catch (error) {
    console.error('Health check error:', error);
    return res.status(503).json({
      success: false,
      health: {
        status: 'unhealthy',
        error: error.message
      }
    });
  }
});

/**
 * GET /api/admin/activity-timeline
 * Get timeline of recent activity across the organization
 * Admin only - organization-scoped
 */
router.get('/activity-timeline', organizationContext, requireOrganization, checkPermission('admin'), async (req, res) => {
  try {
    const organizationId = req.organization.id;
    const { days = 7, limit = 100 } = req.query;

    const daysNum = Math.min(30, Math.max(1, parseInt(days)));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit)));

    const query = `
      SELECT
        al.id,
        al.action,
        al.resource_type,
        al.resource_id,
        al.created_at,
        al.metadata,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.organization_id = $1
      AND al.created_at >= CURRENT_TIMESTAMP - INTERVAL '${daysNum} days'
      ORDER BY al.created_at DESC
      LIMIT $2
    `;

    const result = await db.query(query, [organizationId, limitNum]);

    return res.status(200).json({
      success: true,
      timeline: result.rows,
      period: {
        days: daysNum,
        startDate: new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get activity timeline error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve activity timeline',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
