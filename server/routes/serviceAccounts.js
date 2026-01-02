/**
 * @fileoverview Service Accounts Routes
 * @description API endpoints for managing service accounts and their API tokens.
 * Service accounts are used for CI/CD pipelines, automated systems, and
 * server-to-server communication with long-lived credentials.
 * @module routes/serviceAccounts
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');
const { checkPermission } = require('../middleware/checkPermission');
const crypto = require('crypto');
const log = require('../utils/logger');

// Apply authentication and organization middleware to all routes
router.use(authenticateToken);
router.use(organizationContext);
router.use(requireOrganization);

// =====================================================
// SERVICE ACCOUNT CRUD ENDPOINTS
// =====================================================

/**
 * GET /api/service-accounts
 * Get all service accounts for the current organization
 * Permission: member
 */
router.get('/', checkPermission('member'), async (req, res) => {
  try {
    const organization_id = req.organization.id;

    const result = await db.query(
      `SELECT
        sa.id,
        sa.name,
        sa.description,
        sa.is_active,
        sa.created_by,
        sa.created_at,
        sa.updated_at,
        u.name as created_by_name,
        u.email as created_by_email,
        COUNT(at.id) as token_count,
        MAX(at.last_used_at) as last_used_at
      FROM service_accounts sa
      LEFT JOIN users u ON sa.created_by = u.id
      LEFT JOIN api_tokens at ON at.service_account_id = sa.id AND at.is_active = true
      WHERE sa.organization_id = $1
      GROUP BY sa.id, u.name, u.email
      ORDER BY sa.created_at DESC`,
      [organization_id]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        isActive: row.is_active,
        createdBy: row.created_by ? {
          id: row.created_by,
          name: row.created_by_name,
          email: row.created_by_email
        } : null,
        tokenCount: parseInt(row.token_count) || 0,
        lastUsedAt: row.last_used_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });

  } catch (error) {
    log.error('[SERVICE_ACCOUNTS] Error fetching service accounts:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service accounts',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/service-accounts
 * Create a new service account
 * Body: { name, description }
 * Permission: admin
 */
router.post('/', checkPermission('admin'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const organization_id = req.organization.id;
    const created_by = req.user.id;

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Service account name is required'
      });
    }

    if (name.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Service account name must be 255 characters or less'
      });
    }

    // Check for duplicate name in organization
    const existingCheck = await db.query(
      'SELECT id FROM service_accounts WHERE organization_id = $1 AND LOWER(name) = LOWER($2)',
      [organization_id, name.trim()]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A service account with this name already exists'
      });
    }

    // Insert service account
    const result = await db.query(
      `INSERT INTO service_accounts (
        organization_id,
        name,
        description,
        created_by,
        is_active,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, name, description, is_active, created_by, created_at, updated_at`,
      [organization_id, name.trim(), description || null, created_by]
    );

    const serviceAccount = result.rows[0];

    log.info('[SERVICE_ACCOUNTS] Service account created', {
      id: serviceAccount.id,
      name: serviceAccount.name,
      organizationId: organization_id,
      createdBy: created_by
    });

    res.status(201).json({
      success: true,
      message: 'Service account created successfully',
      data: {
        id: serviceAccount.id,
        name: serviceAccount.name,
        description: serviceAccount.description,
        isActive: serviceAccount.is_active,
        createdAt: serviceAccount.created_at,
        updatedAt: serviceAccount.updated_at
      }
    });

  } catch (error) {
    log.error('[SERVICE_ACCOUNTS] Error creating service account:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create service account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/service-accounts/:id
 * Get a specific service account with details
 * Permission: member
 */
router.get('/:id', checkPermission('member'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    const result = await db.query(
      `SELECT
        sa.id,
        sa.name,
        sa.description,
        sa.is_active,
        sa.created_by,
        sa.created_at,
        sa.updated_at,
        u.name as created_by_name,
        u.email as created_by_email
      FROM service_accounts sa
      LEFT JOIN users u ON sa.created_by = u.id
      WHERE sa.id = $1 AND sa.organization_id = $2`,
      [id, organization_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service account not found'
      });
    }

    const sa = result.rows[0];

    // Get token stats
    const tokenStats = await db.query(
      `SELECT
        COUNT(*) as total_tokens,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_tokens,
        MAX(last_used_at) as last_used_at,
        SUM(CASE WHEN aku.id IS NOT NULL THEN 1 ELSE 0 END) as total_requests
      FROM api_tokens at
      LEFT JOIN api_key_usage aku ON aku.api_token_id = at.id
      WHERE at.service_account_id = $1`,
      [id]
    );

    const stats = tokenStats.rows[0] || {};

    res.json({
      success: true,
      data: {
        id: sa.id,
        name: sa.name,
        description: sa.description,
        isActive: sa.is_active,
        createdBy: sa.created_by ? {
          id: sa.created_by,
          name: sa.created_by_name,
          email: sa.created_by_email
        } : null,
        createdAt: sa.created_at,
        updatedAt: sa.updated_at,
        stats: {
          totalTokens: parseInt(stats.total_tokens) || 0,
          activeTokens: parseInt(stats.active_tokens) || 0,
          lastUsedAt: stats.last_used_at,
          totalRequests: parseInt(stats.total_requests) || 0
        }
      }
    });

  } catch (error) {
    log.error('[SERVICE_ACCOUNTS] Error fetching service account:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /api/service-accounts/:id
 * Update a service account
 * Body: { name, description, isActive }
 * Permission: admin
 */
router.put('/:id', checkPermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;
    const organization_id = req.organization.id;

    // Verify ownership
    const ownerCheck = await db.query(
      'SELECT id FROM service_accounts WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service account not found'
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      if (name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Service account name cannot be empty'
        });
      }
      // Check for duplicate name
      const duplicateCheck = await db.query(
        'SELECT id FROM service_accounts WHERE organization_id = $1 AND LOWER(name) = LOWER($2) AND id != $3',
        [organization_id, name.trim(), id]
      );
      if (duplicateCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'A service account with this name already exists'
        });
      }
      updates.push(`name = $${paramCount++}`);
      values.push(name.trim());
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }

    if (isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await db.query(
      `UPDATE service_accounts
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, name, description, is_active, updated_at`,
      values
    );

    const updated = result.rows[0];

    log.info('[SERVICE_ACCOUNTS] Service account updated', {
      id: updated.id,
      changes: { name, description, isActive }
    });

    res.json({
      success: true,
      message: 'Service account updated successfully',
      data: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        isActive: updated.is_active,
        updatedAt: updated.updated_at
      }
    });

  } catch (error) {
    log.error('[SERVICE_ACCOUNTS] Error updating service account:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update service account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/service-accounts/:id
 * Delete a service account and all its tokens
 * Permission: admin
 */
router.delete('/:id', checkPermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    // Verify ownership
    const ownerCheck = await db.query(
      'SELECT id, name FROM service_accounts WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service account not found'
      });
    }

    const serviceAccountName = ownerCheck.rows[0].name;

    // Delete associated tokens first (cascade should handle this, but be explicit)
    await db.query(
      'DELETE FROM api_tokens WHERE service_account_id = $1',
      [id]
    );

    // Delete service account
    await db.query(
      'DELETE FROM service_accounts WHERE id = $1',
      [id]
    );

    log.info('[SERVICE_ACCOUNTS] Service account deleted', {
      id,
      name: serviceAccountName,
      organizationId: organization_id
    });

    res.json({
      success: true,
      message: 'Service account and all associated tokens deleted successfully'
    });

  } catch (error) {
    log.error('[SERVICE_ACCOUNTS] Error deleting service account:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete service account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// =====================================================
// SERVICE ACCOUNT TOKEN ENDPOINTS
// =====================================================

/**
 * POST /api/service-accounts/:id/tokens
 * Create a new API token for a service account
 * Body: { tokenName, expiresInDays (optional, null for never) }
 * Permission: admin
 */
router.post('/:id/tokens', checkPermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { tokenName, expiresInDays } = req.body;
    const organization_id = req.organization.id;
    const user_id = req.user.id;

    // Verify service account ownership
    const saCheck = await db.query(
      'SELECT id, name, is_active FROM service_accounts WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (saCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service account not found'
      });
    }

    if (!saCheck.rows[0].is_active) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create tokens for inactive service account'
      });
    }

    // Validation
    if (!tokenName || tokenName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Token name is required'
      });
    }

    // Generate secure token (32 bytes = 64 hex characters)
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenPreview = token.substring(0, 8) + '...' + token.substring(token.length - 4);

    // Calculate expiration (null for never expires)
    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays));
    }

    // Insert token
    const result = await db.query(
      `INSERT INTO api_tokens (
        user_id,
        organization_id,
        service_account_id,
        is_service_account,
        token_name,
        token_hash,
        token_preview,
        expires_at,
        is_active,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, true, $4, $5, $6, $7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, token_name, token_preview, expires_at, is_active, created_at`,
      [user_id, organization_id, id, tokenName.trim(), tokenHash, tokenPreview, expiresAt]
    );

    const newToken = result.rows[0];

    log.info('[SERVICE_ACCOUNTS] Token created for service account', {
      tokenId: newToken.id,
      serviceAccountId: id,
      serviceAccountName: saCheck.rows[0].name,
      expiresAt
    });

    res.status(201).json({
      success: true,
      message: 'API token created successfully',
      data: {
        id: newToken.id,
        name: newToken.token_name,
        preview: newToken.token_preview,
        token: token, // Only returned once on creation!
        expiresAt: newToken.expires_at,
        isActive: newToken.is_active,
        createdAt: newToken.created_at
      },
      warning: 'Save this token now! It will not be shown again.'
    });

  } catch (error) {
    log.error('[SERVICE_ACCOUNTS] Error creating token:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/service-accounts/:id/tokens
 * Get all tokens for a service account
 * Permission: member
 */
router.get('/:id/tokens', checkPermission('member'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    // Verify service account ownership
    const saCheck = await db.query(
      'SELECT id FROM service_accounts WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (saCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service account not found'
      });
    }

    // Get tokens with usage stats
    const result = await db.query(
      `SELECT
        at.id,
        at.token_name,
        at.token_preview,
        at.is_active,
        at.expires_at,
        at.last_used_at,
        at.created_at,
        at.updated_at,
        COUNT(aku.id) as request_count,
        COALESCE(SUM(aku.tokens_used), 0) as total_tokens_used,
        COALESCE(SUM(aku.cost_usd), 0) as total_cost
      FROM api_tokens at
      LEFT JOIN api_key_usage aku ON aku.api_token_id = at.id
      WHERE at.service_account_id = $1
      GROUP BY at.id
      ORDER BY at.created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        name: row.token_name,
        preview: row.token_preview,
        isActive: row.is_active,
        expiresAt: row.expires_at,
        lastUsedAt: row.last_used_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        usage: {
          requestCount: parseInt(row.request_count) || 0,
          totalTokensUsed: parseInt(row.total_tokens_used) || 0,
          totalCost: parseFloat(row.total_cost) || 0
        }
      }))
    });

  } catch (error) {
    log.error('[SERVICE_ACCOUNTS] Error fetching tokens:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tokens',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/service-accounts/:id/tokens/:tokenId
 * Delete a specific token from a service account
 * Permission: admin
 */
router.delete('/:id/tokens/:tokenId', checkPermission('admin'), async (req, res) => {
  try {
    const { id, tokenId } = req.params;
    const organization_id = req.organization.id;

    // Verify service account ownership
    const saCheck = await db.query(
      'SELECT id FROM service_accounts WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (saCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service account not found'
      });
    }

    // Verify token belongs to this service account
    const tokenCheck = await db.query(
      'SELECT id, token_name FROM api_tokens WHERE id = $1 AND service_account_id = $2',
      [tokenId, id]
    );

    if (tokenCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Token not found'
      });
    }

    // Delete token
    await db.query('DELETE FROM api_tokens WHERE id = $1', [tokenId]);

    log.info('[SERVICE_ACCOUNTS] Token deleted', {
      tokenId,
      tokenName: tokenCheck.rows[0].token_name,
      serviceAccountId: id
    });

    res.json({
      success: true,
      message: 'Token deleted successfully'
    });

  } catch (error) {
    log.error('[SERVICE_ACCOUNTS] Error deleting token:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PATCH /api/service-accounts/:id/tokens/:tokenId/toggle
 * Toggle token active/inactive status
 * Permission: admin
 */
router.patch('/:id/tokens/:tokenId/toggle', checkPermission('admin'), async (req, res) => {
  try {
    const { id, tokenId } = req.params;
    const organization_id = req.organization.id;

    // Verify service account ownership
    const saCheck = await db.query(
      'SELECT id FROM service_accounts WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (saCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service account not found'
      });
    }

    // Verify token belongs to this service account
    const tokenCheck = await db.query(
      'SELECT id, is_active FROM api_tokens WHERE id = $1 AND service_account_id = $2',
      [tokenId, id]
    );

    if (tokenCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Token not found'
      });
    }

    const newStatus = !tokenCheck.rows[0].is_active;

    // Toggle token status
    const result = await db.query(
      `UPDATE api_tokens
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, is_active, updated_at`,
      [newStatus, tokenId]
    );

    res.json({
      success: true,
      message: `Token ${newStatus ? 'activated' : 'deactivated'} successfully`,
      data: {
        id: result.rows[0].id,
        isActive: result.rows[0].is_active,
        updatedAt: result.rows[0].updated_at
      }
    });

  } catch (error) {
    log.error('[SERVICE_ACCOUNTS] Error toggling token:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to toggle token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/service-accounts/:id/usage
 * Get usage statistics for a service account (all tokens combined)
 * Query: period (24h, 7d, 30d, 90d)
 * Permission: member
 */
router.get('/:id/usage', checkPermission('member'), async (req, res) => {
  try {
    const { id } = req.params;
    const { period = '30d' } = req.query;
    const organization_id = req.organization.id;

    // Verify service account ownership
    const saCheck = await db.query(
      'SELECT id, name FROM service_accounts WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (saCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service account not found'
      });
    }

    // Calculate date range
    let intervalSql;
    switch (period) {
      case '24h':
        intervalSql = "NOW() - INTERVAL '24 hours'";
        break;
      case '7d':
        intervalSql = "NOW() - INTERVAL '7 days'";
        break;
      case '90d':
        intervalSql = "NOW() - INTERVAL '90 days'";
        break;
      case '30d':
      default:
        intervalSql = "NOW() - INTERVAL '30 days'";
        break;
    }

    // Get aggregated usage stats
    const statsResult = await db.query(
      `SELECT
        COUNT(*) as total_requests,
        COALESCE(AVG(aku.response_time_ms), 0) as avg_response_time,
        COALESCE(SUM(aku.tokens_used), 0) as total_tokens,
        COALESCE(SUM(aku.cost_usd), 0) as total_cost,
        COUNT(CASE WHEN aku.status_code >= 200 AND aku.status_code < 300 THEN 1 END) as successful_requests,
        COUNT(CASE WHEN aku.status_code >= 400 THEN 1 END) as failed_requests
      FROM api_key_usage aku
      JOIN api_tokens at ON at.id = aku.api_token_id
      WHERE at.service_account_id = $1 AND aku.created_at >= ${intervalSql}`,
      [id]
    );

    // Get daily trend
    const trendResult = await db.query(
      `SELECT
        DATE_TRUNC('day', aku.created_at) as date,
        COUNT(*) as requests,
        COALESCE(SUM(aku.cost_usd), 0) as cost
      FROM api_key_usage aku
      JOIN api_tokens at ON at.id = aku.api_token_id
      WHERE at.service_account_id = $1 AND aku.created_at >= ${intervalSql}
      GROUP BY DATE_TRUNC('day', aku.created_at)
      ORDER BY date ASC`,
      [id]
    );

    // Get top endpoints
    const endpointsResult = await db.query(
      `SELECT
        aku.endpoint,
        COUNT(*) as request_count,
        COALESCE(AVG(aku.response_time_ms), 0) as avg_response_time
      FROM api_key_usage aku
      JOIN api_tokens at ON at.id = aku.api_token_id
      WHERE at.service_account_id = $1 AND aku.created_at >= ${intervalSql}
      GROUP BY aku.endpoint
      ORDER BY request_count DESC
      LIMIT 10`,
      [id]
    );

    const stats = statsResult.rows[0] || {};

    res.json({
      success: true,
      serviceAccount: {
        id: saCheck.rows[0].id,
        name: saCheck.rows[0].name
      },
      period,
      summary: {
        totalRequests: parseInt(stats.total_requests) || 0,
        avgResponseTime: Math.round(parseFloat(stats.avg_response_time) || 0),
        totalTokens: parseInt(stats.total_tokens) || 0,
        totalCost: parseFloat(stats.total_cost) || 0,
        successfulRequests: parseInt(stats.successful_requests) || 0,
        failedRequests: parseInt(stats.failed_requests) || 0,
        successRate: stats.total_requests > 0
          ? Math.round((stats.successful_requests / stats.total_requests) * 100)
          : 0
      },
      dailyTrend: trendResult.rows.map(row => ({
        date: row.date,
        requests: parseInt(row.requests),
        cost: parseFloat(row.cost)
      })),
      topEndpoints: endpointsResult.rows.map(row => ({
        endpoint: row.endpoint,
        requestCount: parseInt(row.request_count),
        avgResponseTime: Math.round(parseFloat(row.avg_response_time))
      }))
    });

  } catch (error) {
    log.error('[SERVICE_ACCOUNTS] Error fetching usage:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch usage statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
