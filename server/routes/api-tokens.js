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

module.exports = router;
