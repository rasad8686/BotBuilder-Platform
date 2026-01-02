const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');
const { checkPermission } = require('../middleware/checkPermission');
const { getTokenUsageStats } = require('../middleware/apiKeyUsageTracker');
const crypto = require('crypto');
const log = require('../utils/logger');

// Apply authentication and organization middleware to all routes
router.use(authenticateToken);
router.use(organizationContext);
router.use(requireOrganization);

/**
 * GET /api/api-tokens
 * Get all API tokens for the current organization
 * Permission: member or admin
 */
router.get('/', checkPermission('member'), async (req, res) => {
  try {
    const organization_id = req.organization.id;
    const user_id = req.user.id;

    const result = await db.query(
      `SELECT
        t.id,
        t.user_id,
        t.bot_id,
        t.token_name,
        t.token_preview,
        t.permissions,
        t.last_used_at,
        t.expires_at,
        t.is_active,
        t.created_at,
        t.updated_at,
        b.name as bot_name
      FROM api_tokens t
      LEFT JOIN bots b ON t.bot_id = b.id
      WHERE t.organization_id = $1
      ORDER BY t.created_at DESC`,
      [organization_id]
    );

    // Return array directly to match frontend expectations
    res.json(result.rows);

  } catch (error) {
    log.error('[API_TOKENS] Error fetching tokens:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch API tokens',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/api-tokens
 * Create a new API token
 * Required: tokenName
 * Optional: botId, expiresInDays
 * Permission: admin
 */
router.post('/', checkPermission('admin'), async (req, res) => {
  try {
    const { tokenName, botId, expiresInDays } = req.body;
    const user_id = req.user.id;
    const organization_id = req.organization.id;

    // Validation
    if (!tokenName || tokenName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Token name is required'
      });
    }

    // Generate secure random token (32 bytes = 64 hex characters)
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenPreview = token.substring(0, 8) + '...' + token.substring(token.length - 4);

    // Calculate expiration date
    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays));
    }

    // Verify bot belongs to organization if botId is provided
    if (botId) {
      const botCheck = await db.query(
        'SELECT id FROM bots WHERE id = $1 AND organization_id = $2',
        [botId, organization_id]
      );

      if (botCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Bot not found or does not belong to your organization'
        });
      }
    }

    // Insert token
    const result = await db.query(
      `INSERT INTO api_tokens (
        user_id,
        organization_id,
        bot_id,
        token_name,
        token_hash,
        token_preview,
        expires_at,
        is_active,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, user_id, bot_id, token_name, token_preview, expires_at, is_active, created_at`,
      [user_id, organization_id, botId || null, tokenName.trim(), tokenHash, tokenPreview, expiresAt]
    );

    const newToken = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'API token created successfully',
      data: {
        ...newToken,
        token: token // Only return the actual token on creation
      }
    });

  } catch (error) {
    log.error('[API_TOKENS] Error creating token:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create API token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/api-tokens/:id
 * Delete an API token
 * Permission: admin
 */
router.delete('/:id', checkPermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    // Verify token belongs to organization
    const tokenCheck = await db.query(
      'SELECT id FROM api_tokens WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (tokenCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API token not found'
      });
    }

    // Delete token
    await db.query(
      'DELETE FROM api_tokens WHERE id = $1',
      [id]
    );

    res.json({
      success: true,
      message: 'API token deleted successfully'
    });

  } catch (error) {
    log.error('[API_TOKENS] Error deleting token:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete API token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PATCH /api/api-tokens/:id/toggle
 * Toggle an API token active/inactive status
 * Permission: admin
 */
router.patch('/:id/toggle', checkPermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    // Verify token belongs to organization
    const tokenCheck = await db.query(
      'SELECT id, is_active FROM api_tokens WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (tokenCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API token not found'
      });
    }

    const currentStatus = tokenCheck.rows[0].is_active;

    // Toggle token status
    const result = await db.query(
      `UPDATE api_tokens
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, is_active, updated_at`,
      [!currentStatus, id]
    );

    res.json({
      success: true,
      message: `API token ${result.rows[0].is_active ? 'activated' : 'deactivated'} successfully`,
      data: result.rows[0]
    });

  } catch (error) {
    log.error('[API_TOKENS] Error toggling token:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to toggle API token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /api/api-tokens/:id/deactivate
 * Deactivate an API token (soft delete)
 * Permission: admin
 */
router.put('/:id/deactivate', checkPermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    // Verify token belongs to organization
    const tokenCheck = await db.query(
      'SELECT id FROM api_tokens WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (tokenCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API token not found'
      });
    }

    // Deactivate token
    const result = await db.query(
      `UPDATE api_tokens
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, is_active, updated_at`,
      [id]
    );

    res.json({
      success: true,
      message: 'API token deactivated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    log.error('[API_TOKENS] Error deactivating token:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate API token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/api-tokens/:id/usage
 * Get usage statistics for an API token
 * Query params: period (24h, 7d, 30d, 90d), groupBy (hour, day, week)
 * Permission: member
 */
router.get('/:id/usage', checkPermission('member'), async (req, res) => {
  try {
    const { id } = req.params;
    const { period = '30d', groupBy = 'day' } = req.query;
    const organization_id = req.organization.id;

    // Verify token belongs to organization
    const tokenCheck = await db.query(
      `SELECT id, token_name, token_preview, is_active, last_used_at, created_at
       FROM api_tokens WHERE id = $1 AND organization_id = $2`,
      [id, organization_id]
    );

    if (tokenCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API token not found'
      });
    }

    const tokenInfo = tokenCheck.rows[0];

    // Get usage statistics
    const usage = await getTokenUsageStats(id, { period, groupBy });

    res.json({
      success: true,
      token: {
        id: tokenInfo.id,
        name: tokenInfo.token_name,
        preview: tokenInfo.token_preview,
        isActive: tokenInfo.is_active,
        lastUsedAt: tokenInfo.last_used_at,
        createdAt: tokenInfo.created_at
      },
      period,
      groupBy,
      usage
    });

  } catch (error) {
    log.error('[API_TOKENS] Error fetching usage:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch API token usage',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/api-tokens/usage/summary
 * Get aggregated usage summary for all tokens in organization
 * Query params: period (24h, 7d, 30d, 90d)
 * Permission: member
 */
router.get('/usage/summary', checkPermission('member'), async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const organization_id = req.organization.id;

    // Calculate date range
    let intervalSql;
    switch (period) {
      case '24h':
        intervalSql = "NOW() - INTERVAL '24 hours'";
        break;
      case '7d':
        intervalSql = "NOW() - INTERVAL '7 days'";
        break;
      case '30d':
      default:
        intervalSql = "NOW() - INTERVAL '30 days'";
        break;
      case '90d':
        intervalSql = "NOW() - INTERVAL '90 days'";
        break;
    }

    // Get summary for all tokens
    const summaryResult = await db.query(
      `SELECT
         COUNT(DISTINCT aku.api_token_id) as active_tokens,
         COUNT(*) as total_requests,
         COALESCE(AVG(aku.response_time_ms), 0) as avg_response_time,
         COALESCE(SUM(aku.tokens_used), 0) as total_tokens,
         COALESCE(SUM(aku.cost_usd), 0) as total_cost,
         COUNT(CASE WHEN aku.status_code >= 200 AND aku.status_code < 300 THEN 1 END) as successful_requests,
         COUNT(CASE WHEN aku.status_code >= 400 THEN 1 END) as failed_requests
       FROM api_key_usage aku
       JOIN api_tokens at ON at.id = aku.api_token_id
       WHERE at.organization_id = $1 AND aku.created_at >= ${intervalSql}`,
      [organization_id]
    );

    // Get per-token breakdown
    const perTokenResult = await db.query(
      `SELECT
         at.id,
         at.token_name,
         at.token_preview,
         COUNT(*) as request_count,
         COALESCE(AVG(aku.response_time_ms), 0) as avg_response_time,
         COALESCE(SUM(aku.tokens_used), 0) as tokens_used,
         COALESCE(SUM(aku.cost_usd), 0) as cost
       FROM api_tokens at
       LEFT JOIN api_key_usage aku ON aku.api_token_id = at.id AND aku.created_at >= ${intervalSql}
       WHERE at.organization_id = $1
       GROUP BY at.id, at.token_name, at.token_preview
       ORDER BY request_count DESC`,
      [organization_id]
    );

    // Get daily trend
    const trendResult = await db.query(
      `SELECT
         DATE_TRUNC('day', aku.created_at) as date,
         COUNT(*) as requests,
         COALESCE(SUM(aku.cost_usd), 0) as cost
       FROM api_key_usage aku
       JOIN api_tokens at ON at.id = aku.api_token_id
       WHERE at.organization_id = $1 AND aku.created_at >= ${intervalSql}
       GROUP BY DATE_TRUNC('day', aku.created_at)
       ORDER BY date ASC`,
      [organization_id]
    );

    const summary = summaryResult.rows[0] || {};

    res.json({
      success: true,
      period,
      summary: {
        activeTokens: parseInt(summary.active_tokens) || 0,
        totalRequests: parseInt(summary.total_requests) || 0,
        avgResponseTime: Math.round(parseFloat(summary.avg_response_time) || 0),
        totalTokens: parseInt(summary.total_tokens) || 0,
        totalCost: parseFloat(summary.total_cost) || 0,
        successfulRequests: parseInt(summary.successful_requests) || 0,
        failedRequests: parseInt(summary.failed_requests) || 0,
        successRate: summary.total_requests > 0
          ? Math.round((summary.successful_requests / summary.total_requests) * 100)
          : 0
      },
      tokenBreakdown: perTokenResult.rows.map(row => ({
        id: row.id,
        name: row.token_name,
        preview: row.token_preview,
        requestCount: parseInt(row.request_count) || 0,
        avgResponseTime: Math.round(parseFloat(row.avg_response_time) || 0),
        tokensUsed: parseInt(row.tokens_used) || 0,
        cost: parseFloat(row.cost) || 0
      })),
      dailyTrend: trendResult.rows.map(row => ({
        date: row.date,
        requests: parseInt(row.requests),
        cost: parseFloat(row.cost)
      }))
    });

  } catch (error) {
    log.error('[API_TOKENS] Error fetching usage summary:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch usage summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// =====================================================
// API KEY ROTATION ENDPOINTS
// =====================================================

/**
 * POST /api/api-tokens/:id/rotate
 * Rotate an API token - creates new token and sets overlap period on old one
 * Body: { overlapHours: 24 } (optional, default 24 hours)
 * Permission: admin
 */
router.post('/:id/rotate', checkPermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { overlapHours = 24 } = req.body;
    const user_id = req.user.id;
    const organization_id = req.organization.id;

    // Validate overlap hours (1-168 hours = 1 hour to 7 days)
    const validOverlapHours = Math.min(Math.max(parseInt(overlapHours) || 24, 1), 168);

    // Get the old token
    const oldTokenResult = await db.query(
      `SELECT id, token_name, bot_id, permissions, expires_at
       FROM api_tokens WHERE id = $1 AND organization_id = $2 AND is_active = true`,
      [id, organization_id]
    );

    if (oldTokenResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API token not found or already inactive'
      });
    }

    const oldToken = oldTokenResult.rows[0];

    // Generate new token
    const newTokenValue = crypto.randomBytes(32).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newTokenValue).digest('hex');
    const newTokenPreview = newTokenValue.substring(0, 8) + '...' + newTokenValue.substring(newTokenValue.length - 4);

    // Calculate overlap expiry for old token
    const overlapExpiresAt = new Date(Date.now() + validOverlapHours * 60 * 60 * 1000);

    // Start transaction
    const client = await db.query('BEGIN');

    try {
      // Update old token with overlap expiry
      await db.query(
        `UPDATE api_tokens
         SET overlap_expires_at = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [overlapExpiresAt, id]
      );

      // Create new token
      const newTokenResult = await db.query(
        `INSERT INTO api_tokens (
          user_id, organization_id, bot_id, token_name, token_hash, token_preview,
          permissions, expires_at, is_active, rotated_from_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, token_name, token_preview, expires_at, created_at`,
        [
          user_id,
          organization_id,
          oldToken.bot_id,
          oldToken.token_name + ' (rotated)',
          newTokenHash,
          newTokenPreview,
          oldToken.permissions,
          oldToken.expires_at,
          id
        ]
      );

      await db.query('COMMIT');

      const newToken = newTokenResult.rows[0];

      log.info('[API_TOKENS] Token rotated', {
        oldTokenId: id,
        newTokenId: newToken.id,
        overlapHours: validOverlapHours
      });

      res.status(201).json({
        success: true,
        message: 'API token rotated successfully',
        data: {
          newToken: {
            id: newToken.id,
            name: newToken.token_name,
            preview: newToken.token_preview,
            token: newTokenValue, // Only returned once
            createdAt: newToken.created_at
          },
          oldToken: {
            id: parseInt(id),
            validUntil: overlapExpiresAt,
            overlapHours: validOverlapHours
          }
        }
      });

    } catch (txError) {
      await db.query('ROLLBACK');
      throw txError;
    }

  } catch (error) {
    log.error('[API_TOKENS] Error rotating token:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to rotate API token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/api-tokens/:id/schedule-rotation
 * Schedule automatic rotation for a token
 * Body: { scheduledAt: ISO date string }
 * Permission: admin
 */
router.post('/:id/schedule-rotation', checkPermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledAt } = req.body;
    const organization_id = req.organization.id;

    if (!scheduledAt) {
      return res.status(400).json({
        success: false,
        message: 'scheduledAt is required'
      });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format for scheduledAt'
      });
    }

    if (scheduledDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Scheduled date must be in the future'
      });
    }

    // Verify token belongs to organization
    const tokenCheck = await db.query(
      'SELECT id, token_name FROM api_tokens WHERE id = $1 AND organization_id = $2 AND is_active = true',
      [id, organization_id]
    );

    if (tokenCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API token not found'
      });
    }

    // Schedule rotation
    const result = await db.query(
      `UPDATE api_tokens
       SET rotation_scheduled_at = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, token_name, rotation_scheduled_at`,
      [scheduledDate, id]
    );

    log.info('[API_TOKENS] Rotation scheduled', {
      tokenId: id,
      scheduledAt: scheduledDate
    });

    res.json({
      success: true,
      message: 'Rotation scheduled successfully',
      data: {
        id: result.rows[0].id,
        name: result.rows[0].token_name,
        rotationScheduledAt: result.rows[0].rotation_scheduled_at
      }
    });

  } catch (error) {
    log.error('[API_TOKENS] Error scheduling rotation:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to schedule rotation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/api-tokens/:id/cancel-rotation
 * Cancel a scheduled rotation
 * Permission: admin
 */
router.delete('/:id/cancel-rotation', checkPermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    // Verify token and check if rotation is scheduled
    const tokenCheck = await db.query(
      `SELECT id, token_name, rotation_scheduled_at
       FROM api_tokens WHERE id = $1 AND organization_id = $2`,
      [id, organization_id]
    );

    if (tokenCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API token not found'
      });
    }

    if (!tokenCheck.rows[0].rotation_scheduled_at) {
      return res.status(400).json({
        success: false,
        message: 'No rotation is scheduled for this token'
      });
    }

    // Cancel rotation
    await db.query(
      `UPDATE api_tokens
       SET rotation_scheduled_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    log.info('[API_TOKENS] Rotation cancelled', { tokenId: id });

    res.json({
      success: true,
      message: 'Scheduled rotation cancelled successfully'
    });

  } catch (error) {
    log.error('[API_TOKENS] Error cancelling rotation:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to cancel rotation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/api-tokens/:id/rotation-history
 * Get rotation history for a token (chain of rotated tokens)
 * Permission: member
 */
router.get('/:id/rotation-history', checkPermission('member'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    // Verify token belongs to organization
    const tokenCheck = await db.query(
      'SELECT id FROM api_tokens WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (tokenCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API token not found'
      });
    }

    // Get rotation history - tokens rotated from this one
    const childTokens = await db.query(
      `SELECT id, token_name, token_preview, is_active, created_at, overlap_expires_at
       FROM api_tokens
       WHERE rotated_from_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    // Get parent token if this was rotated from another
    const parentResult = await db.query(
      `SELECT t.rotated_from_id, p.token_name as parent_name, p.token_preview as parent_preview,
              p.is_active as parent_active, p.created_at as parent_created_at
       FROM api_tokens t
       LEFT JOIN api_tokens p ON t.rotated_from_id = p.id
       WHERE t.id = $1`,
      [id]
    );

    const currentToken = await db.query(
      `SELECT id, token_name, token_preview, is_active, rotation_scheduled_at, overlap_expires_at, created_at
       FROM api_tokens WHERE id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        current: {
          id: currentToken.rows[0].id,
          name: currentToken.rows[0].token_name,
          preview: currentToken.rows[0].token_preview,
          isActive: currentToken.rows[0].is_active,
          rotationScheduledAt: currentToken.rows[0].rotation_scheduled_at,
          overlapExpiresAt: currentToken.rows[0].overlap_expires_at,
          createdAt: currentToken.rows[0].created_at
        },
        rotatedFrom: parentResult.rows[0]?.rotated_from_id ? {
          id: parentResult.rows[0].rotated_from_id,
          name: parentResult.rows[0].parent_name,
          preview: parentResult.rows[0].parent_preview,
          isActive: parentResult.rows[0].parent_active,
          createdAt: parentResult.rows[0].parent_created_at
        } : null,
        rotatedTo: childTokens.rows.map(row => ({
          id: row.id,
          name: row.token_name,
          preview: row.token_preview,
          isActive: row.is_active,
          createdAt: row.created_at,
          overlapExpiresAt: row.overlap_expires_at
        }))
      }
    });

  } catch (error) {
    log.error('[API_TOKENS] Error fetching rotation history:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rotation history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// =====================================================
// SPENDING LIMITS ENDPOINTS
// =====================================================

/**
 * PUT /api/api-tokens/:id/spending-limit
 * Set spending limit for an API token
 * Body: { hardLimit, warningLimit, autoDisable, periodType }
 * Permission: admin
 */
router.put('/:id/spending-limit', checkPermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { hardLimit, warningLimit, autoDisable = true, periodType = 'monthly' } = req.body;
    const organization_id = req.organization.id;

    // Validate periodType
    if (!['daily', 'monthly'].includes(periodType)) {
      return res.status(400).json({
        success: false,
        message: 'periodType must be "daily" or "monthly"'
      });
    }

    // Validate limits
    if (hardLimit !== null && hardLimit !== undefined) {
      if (typeof hardLimit !== 'number' || hardLimit < 0) {
        return res.status(400).json({
          success: false,
          message: 'hardLimit must be a positive number'
        });
      }
    }

    if (warningLimit !== null && warningLimit !== undefined) {
      if (typeof warningLimit !== 'number' || warningLimit < 0) {
        return res.status(400).json({
          success: false,
          message: 'warningLimit must be a positive number'
        });
      }
    }

    // Warning limit should be less than hard limit
    if (hardLimit && warningLimit && warningLimit >= hardLimit) {
      return res.status(400).json({
        success: false,
        message: 'warningLimit must be less than hardLimit'
      });
    }

    // Verify token belongs to organization
    const tokenCheck = await db.query(
      'SELECT id, period_reset_at, spending_period_type FROM api_tokens WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (tokenCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API token not found'
      });
    }

    const currentToken = tokenCheck.rows[0];

    // Calculate period reset time if periodType changes or not set
    let periodResetAt = currentToken.period_reset_at;
    if (!periodResetAt || currentToken.spending_period_type !== periodType) {
      const now = new Date();
      if (periodType === 'daily') {
        // Reset at midnight tomorrow
        periodResetAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      } else {
        // Reset on first day of next month
        periodResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      }
    }

    // Update token with spending limits
    const result = await db.query(
      `UPDATE api_tokens
       SET spending_limit_usd = $1,
           spending_warning_usd = $2,
           auto_disable_on_limit = $3,
           spending_period_type = $4,
           period_reset_at = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, spending_limit_usd, spending_warning_usd, current_period_spend_usd,
                 period_reset_at, spending_period_type, auto_disable_on_limit, disabled_by_limit`,
      [hardLimit || null, warningLimit || null, autoDisable, periodType, periodResetAt, id]
    );

    const updatedToken = result.rows[0];

    res.json({
      success: true,
      message: 'Spending limit updated successfully',
      data: {
        id: updatedToken.id,
        spendingLimitUsd: parseFloat(updatedToken.spending_limit_usd) || null,
        spendingWarningUsd: parseFloat(updatedToken.spending_warning_usd) || null,
        currentPeriodSpendUsd: parseFloat(updatedToken.current_period_spend_usd) || 0,
        periodResetAt: updatedToken.period_reset_at,
        periodType: updatedToken.spending_period_type,
        autoDisableOnLimit: updatedToken.auto_disable_on_limit,
        disabledByLimit: updatedToken.disabled_by_limit
      }
    });

  } catch (error) {
    log.error('[API_TOKENS] Error setting spending limit:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to set spending limit',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/api-tokens/:id/spending
 * Get spending information for an API token
 * Response: { currentSpend, limit, warning, percentUsed, resetAt }
 * Permission: member
 */
router.get('/:id/spending', checkPermission('member'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    // Get token with spending info
    const result = await db.query(
      `SELECT
        id,
        token_name,
        token_preview,
        spending_limit_usd,
        spending_warning_usd,
        current_period_spend_usd,
        period_reset_at,
        spending_period_type,
        auto_disable_on_limit,
        disabled_by_limit,
        is_active
       FROM api_tokens
       WHERE id = $1 AND organization_id = $2`,
      [id, organization_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API token not found'
      });
    }

    const token = result.rows[0];
    const currentSpend = parseFloat(token.current_period_spend_usd) || 0;
    const limit = parseFloat(token.spending_limit_usd) || null;
    const warning = parseFloat(token.spending_warning_usd) || null;

    // Calculate percent used
    let percentUsed = 0;
    if (limit && limit > 0) {
      percentUsed = Math.min(100, Math.round((currentSpend / limit) * 100));
    }

    // Check if warning threshold reached
    const warningReached = warning && currentSpend >= warning;
    const limitReached = limit && currentSpend >= limit;

    res.json({
      success: true,
      data: {
        tokenId: token.id,
        tokenName: token.token_name,
        tokenPreview: token.token_preview,
        currentSpend,
        limit,
        warning,
        percentUsed,
        warningReached,
        limitReached,
        resetAt: token.period_reset_at,
        periodType: token.spending_period_type,
        autoDisableOnLimit: token.auto_disable_on_limit,
        disabledByLimit: token.disabled_by_limit,
        isActive: token.is_active
      }
    });

  } catch (error) {
    log.error('[API_TOKENS] Error fetching spending:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch spending information',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/api-tokens/spending/all
 * Get spending information for all tokens in organization
 * Permission: member
 */
router.get('/spending/all', checkPermission('member'), async (req, res) => {
  try {
    const organization_id = req.organization.id;

    // Get all tokens with spending info
    const result = await db.query(
      `SELECT
        id,
        token_name,
        token_preview,
        spending_limit_usd,
        spending_warning_usd,
        current_period_spend_usd,
        period_reset_at,
        spending_period_type,
        auto_disable_on_limit,
        disabled_by_limit,
        is_active
       FROM api_tokens
       WHERE organization_id = $1
       ORDER BY current_period_spend_usd DESC`,
      [organization_id]
    );

    const tokens = result.rows.map(token => {
      const currentSpend = parseFloat(token.current_period_spend_usd) || 0;
      const limit = parseFloat(token.spending_limit_usd) || null;
      const warning = parseFloat(token.spending_warning_usd) || null;

      let percentUsed = 0;
      if (limit && limit > 0) {
        percentUsed = Math.min(100, Math.round((currentSpend / limit) * 100));
      }

      return {
        tokenId: token.id,
        tokenName: token.token_name,
        tokenPreview: token.token_preview,
        currentSpend,
        limit,
        warning,
        percentUsed,
        warningReached: warning && currentSpend >= warning,
        limitReached: limit && currentSpend >= limit,
        resetAt: token.period_reset_at,
        periodType: token.spending_period_type,
        autoDisableOnLimit: token.auto_disable_on_limit,
        disabledByLimit: token.disabled_by_limit,
        isActive: token.is_active
      };
    });

    // Calculate totals
    const totalSpend = tokens.reduce((sum, t) => sum + t.currentSpend, 0);
    const totalLimit = tokens.reduce((sum, t) => sum + (t.limit || 0), 0);

    res.json({
      success: true,
      summary: {
        totalTokens: tokens.length,
        totalSpend,
        totalLimit: totalLimit || null,
        tokensAtWarning: tokens.filter(t => t.warningReached).length,
        tokensAtLimit: tokens.filter(t => t.limitReached).length,
        tokensDisabled: tokens.filter(t => t.disabledByLimit).length
      },
      tokens
    });

  } catch (error) {
    log.error('[API_TOKENS] Error fetching all spending:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch spending information',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/api-tokens/:id/spending/reset
 * Manually reset spending for an API token
 * Permission: admin
 */
router.post('/:id/spending/reset', checkPermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    // Verify token belongs to organization
    const tokenCheck = await db.query(
      'SELECT id, spending_period_type FROM api_tokens WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (tokenCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API token not found'
      });
    }

    const periodType = tokenCheck.rows[0].spending_period_type || 'monthly';

    // Calculate new reset time
    const now = new Date();
    let periodResetAt;
    if (periodType === 'daily') {
      periodResetAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else {
      periodResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    // Reset spending
    const result = await db.query(
      `UPDATE api_tokens
       SET current_period_spend_usd = 0,
           period_reset_at = $1,
           disabled_by_limit = false,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, current_period_spend_usd, period_reset_at, disabled_by_limit`,
      [periodResetAt, id]
    );

    log.info('[API_TOKENS] Manual spending reset', { tokenId: id, organization_id });

    res.json({
      success: true,
      message: 'Spending reset successfully',
      data: {
        id: result.rows[0].id,
        currentPeriodSpendUsd: 0,
        periodResetAt: result.rows[0].period_reset_at,
        disabledByLimit: false
      }
    });

  } catch (error) {
    log.error('[API_TOKENS] Error resetting spending:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to reset spending',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// =====================================================
// IP ALLOWLIST ENDPOINTS
// =====================================================

const {
  getIpAllowlist,
  addIpToAllowlist,
  removeIpFromAllowlist,
  updateIpRestriction,
  isValidIp,
  isValidCidr
} = require('../middleware/ipAllowlist');

/**
 * GET /api/api-tokens/:id/ip-allowlist
 * Get IP allowlist for a token
 * Permission: member
 */
router.get('/:id/ip-allowlist', checkPermission('member'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    // Verify token belongs to organization
    const tokenCheck = await db.query(
      'SELECT id, ip_restriction_enabled FROM api_tokens WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (tokenCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API token not found'
      });
    }

    const allowlist = await getIpAllowlist(id);

    res.json({
      success: true,
      data: {
        ipRestrictionEnabled: tokenCheck.rows[0].ip_restriction_enabled,
        allowlist: allowlist.map(entry => ({
          id: entry.id,
          ipAddress: entry.ip_address,
          cidrRange: entry.cidr_range,
          description: entry.description,
          isActive: entry.is_active,
          createdAt: entry.created_at
        }))
      }
    });

  } catch (error) {
    log.error('[API_TOKENS] Error fetching IP allowlist:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IP allowlist',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/api-tokens/:id/ip-allowlist
 * Add IP to allowlist
 * Body: { ipAddress, cidrRange?, description? }
 * Permission: admin
 */
router.post('/:id/ip-allowlist', checkPermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { ipAddress, cidrRange, description } = req.body;
    const organization_id = req.organization.id;

    // Validate required fields
    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        message: 'IP address is required'
      });
    }

    // Validate IP format
    if (!isValidIp(ipAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid IP address format'
      });
    }

    // Validate CIDR if provided
    if (cidrRange && !isValidCidr(cidrRange)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid CIDR notation'
      });
    }

    // Verify token belongs to organization
    const tokenCheck = await db.query(
      'SELECT id FROM api_tokens WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (tokenCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API token not found'
      });
    }

    // Check for duplicate IP
    const duplicateCheck = await db.query(
      `SELECT id FROM api_token_ip_allowlist
       WHERE api_token_id = $1 AND ip_address = $2`,
      [id, ipAddress]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'IP address already in allowlist'
      });
    }

    const entry = await addIpToAllowlist(id, { ipAddress, cidrRange, description });

    log.info('[API_TOKENS] IP added to allowlist', {
      tokenId: id,
      ipAddress,
      cidrRange
    });

    res.status(201).json({
      success: true,
      message: 'IP added to allowlist',
      data: {
        id: entry.id,
        ipAddress: entry.ip_address,
        cidrRange: entry.cidr_range,
        description: entry.description,
        isActive: entry.is_active,
        createdAt: entry.created_at
      }
    });

  } catch (error) {
    log.error('[API_TOKENS] Error adding IP to allowlist:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to add IP to allowlist',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/api-tokens/:id/ip-allowlist/:ipId
 * Remove IP from allowlist
 * Permission: admin
 */
router.delete('/:id/ip-allowlist/:ipId', checkPermission('admin'), async (req, res) => {
  try {
    const { id, ipId } = req.params;
    const organization_id = req.organization.id;

    // Verify token belongs to organization
    const tokenCheck = await db.query(
      'SELECT id FROM api_tokens WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (tokenCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API token not found'
      });
    }

    const removed = await removeIpFromAllowlist(id, ipId);

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: 'IP entry not found'
      });
    }

    log.info('[API_TOKENS] IP removed from allowlist', {
      tokenId: id,
      ipEntryId: ipId
    });

    res.json({
      success: true,
      message: 'IP removed from allowlist'
    });

  } catch (error) {
    log.error('[API_TOKENS] Error removing IP from allowlist:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to remove IP from allowlist',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /api/api-tokens/:id/ip-restriction
 * Enable or disable IP restriction for a token
 * Body: { enabled: boolean }
 * Permission: admin
 */
router.put('/:id/ip-restriction', checkPermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const organization_id = req.organization.id;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'enabled must be a boolean'
      });
    }

    // Verify token belongs to organization
    const tokenCheck = await db.query(
      'SELECT id FROM api_tokens WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (tokenCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API token not found'
      });
    }

    // If enabling, check that there's at least one IP in allowlist
    if (enabled) {
      const allowlistCheck = await db.query(
        'SELECT COUNT(*) as count FROM api_token_ip_allowlist WHERE api_token_id = $1 AND is_active = true',
        [id]
      );

      if (parseInt(allowlistCheck.rows[0].count) === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot enable IP restriction with empty allowlist. Add at least one IP first.'
        });
      }
    }

    const result = await updateIpRestriction(id, enabled);

    log.info('[API_TOKENS] IP restriction updated', {
      tokenId: id,
      enabled
    });

    res.json({
      success: true,
      message: `IP restriction ${enabled ? 'enabled' : 'disabled'}`,
      data: {
        id: result.id,
        ipRestrictionEnabled: result.ip_restriction_enabled
      }
    });

  } catch (error) {
    log.error('[API_TOKENS] Error updating IP restriction:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update IP restriction',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
