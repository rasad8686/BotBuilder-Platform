const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');
const { checkPermission } = require('../middleware/checkPermission');
const crypto = require('crypto');
const { logBotCreated, logBotUpdated, logBotDeleted } = require('../middleware/audit');
const webhookService = require('../services/webhookService');
const log = require('../utils/logger');

// Apply authentication and organization middleware to all routes
router.use(authenticateToken);
router.use(organizationContext);
router.use(requireOrganization);

/**
 * POST /api/bots - Create new bot
 * Creates a new bot for the authenticated user in their current organization
 * Required: name, platform
 * Optional: description, webhook_url
 * Permission: member or admin
 */
router.post('/', checkPermission('member'), async (req, res) => {
  try {
    const { name, platform, language, description, webhook_url } = req.body;
    const user_id = req.user.id;
    const organization_id = req.organization.id;

    // Validation - Required fields
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Bot name is required'
      });
    }

    if (!platform || platform.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Platform is required (e.g., telegram, whatsapp, discord)'
      });
    }

    // Validate platform value
    let normalizedPlatform = platform.toLowerCase().trim();
    // Auto-convert voice-to-bot to web platform
    if (normalizedPlatform === 'voice-to-bot') {
      normalizedPlatform = 'web';
    }
    const validPlatforms = ['telegram', 'whatsapp', 'discord', 'slack', 'messenger', 'web'];
    if (!validPlatforms.includes(normalizedPlatform)) {
      return res.status(400).json({
        success: false,
        message: `Invalid platform. Valid platforms: ${validPlatforms.join(', ')}`
      });
    }

    // ========================================
    // CHECK PLAN LIMITS
    // ========================================
    const PLAN_LIMITS = {
      free: 1,
      pro: 10,
      enterprise: -1 // unlimited
    };

    // Get organization's current plan
    const planQuery = await db.query(
      'SELECT plan_tier FROM organizations WHERE id = $1',
      [organization_id]
    );

    const currentPlan = planQuery.rows[0]?.plan_tier || 'free';
    const maxBots = PLAN_LIMITS[currentPlan];

    log.info('Bot creation limit check', {
      organization_id,
      plan: currentPlan,
      maxBots: maxBots === -1 ? 'unlimited' : maxBots
    });

    // Count existing bots for this organization
    const countQuery = await db.query(
      'SELECT COUNT(*) as count FROM bots WHERE organization_id = $1',
      [organization_id]
    );

    const currentBots = parseInt(countQuery.rows[0].count);
    log.debug('Current bots count', { organization_id, currentBots });

    // Check if limit reached (skip check for unlimited plans)
    if (maxBots !== -1 && currentBots >= maxBots) {
      log.warn('Bot creation limit reached', {
        organization_id,
        plan: currentPlan,
        currentBots,
        maxBots
      });

      // Determine upgrade suggestion
      let upgradeMessage = '';
      let upgradePlan = '';

      if (currentPlan === 'free') {
        upgradeMessage = 'Upgrade to Pro for 10 bots or Enterprise for unlimited bots';
        upgradePlan = 'pro';
      } else if (currentPlan === 'pro') {
        upgradeMessage = 'Upgrade to Enterprise for unlimited bots';
        upgradePlan = 'enterprise';
      }

      return res.status(403).json({
        success: false,
        error: 'Plan limit reached',
        currentPlan: currentPlan,
        currentBots: currentBots,
        maxBots: maxBots,
        message: upgradeMessage,
        upgradePlan: upgradePlan,
        limitReached: true
      });
    }

    log.info('Bot creation limit OK', {
      organization_id,
      currentCount: currentBots + 1,
      maxBots: maxBots === -1 ? 'unlimited' : maxBots
    });
    // ========================================
    // END PLAN LIMIT CHECK
    // ========================================

    // Generate unique API token
    const api_token = crypto.randomBytes(32).toString('hex');

    // Insert bot into database with organization_id
    const query = `
      INSERT INTO bots (user_id, organization_id, name, description, platform, language, api_token, webhook_url, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, user_id, organization_id, name, description, platform, language, api_token, webhook_url, is_active, created_at, updated_at
    `;

    const values = [
      user_id,
      organization_id,
      name.trim(),
      description ? description.trim() : null,
      normalizedPlatform,
      language ? language.toLowerCase().trim() : 'en',
      api_token,
      webhook_url ? webhook_url.trim() : null,
      true // is_active defaults to true
    ];

    const result = await db.query(query, values);
    const bot = result.rows[0];

    // Log bot creation to audit trail
    await logBotCreated(req, organization_id, bot.id, {
      name: bot.name,
      platform: bot.platform,
      description: bot.description
    });

    // Trigger webhook for bot creation
    await webhookService.trigger(organization_id, 'bot.created', {
      bot_id: bot.id,
      name: bot.name,
      platform: bot.platform,
      description: bot.description,
      created_at: bot.created_at
    });

    return res.status(201).json({
      success: true,
      message: 'Bot created successfully!',
      bot: bot
    });

  } catch (error) {
    log.error('Create bot error', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      organization_id: req.organization?.id
    });

    // Handle duplicate bot name for user (if you add unique constraint)
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'You already have a bot with this name'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create bot',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/bots - Get all bots for current organization
 * Returns array of all bots belonging to the current organization
 * Query params (optional): page (default 1), limit (default 10)
 * If no pagination params provided, returns all bots (backward compatible)
 * Permission: viewer or higher
 */
router.get('/', checkPermission('viewer'), async (req, res) => {
  try {
    const organization_id = req.organization.id;

    // Parse pagination parameters
    let page = parseInt(req.query.page);
    let limit = parseInt(req.query.limit);

    // Check if pagination is requested
    const usePagination = !isNaN(page) || !isNaN(limit);

    if (usePagination) {
      // Set defaults and validate
      page = isNaN(page) || page < 1 ? 1 : page;
      limit = isNaN(limit) || limit < 1 ? 10 : limit;

      // Enforce maximum limit to prevent abuse
      if (limit > 100) {
        limit = 100;
      }

      // Calculate offset
      const offset = (page - 1) * limit;

      // Get total count for this organization
      const countQuery = 'SELECT COUNT(*) FROM bots WHERE organization_id = $1';
      const countResult = await db.query(countQuery, [organization_id]);
      const total = parseInt(countResult.rows[0].count);

      // Get paginated bots for this organization
      const query = `
        SELECT id, user_id, organization_id, name, description, platform, language, api_token, webhook_url, is_active, created_at, updated_at
        FROM bots
        WHERE organization_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await db.query(query, [organization_id, limit, offset]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);

      return res.status(200).json({
        success: true,
        message: 'Bots retrieved successfully',
        data: result.rows,
        pagination: {
          page: page,
          limit: limit,
          total: total,
          totalPages: totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } else {
      // No pagination - return all bots for this organization
      const query = `
        SELECT id, user_id, organization_id, name, description, platform, language, api_token, webhook_url, is_active, created_at, updated_at
        FROM bots
        WHERE organization_id = $1
        ORDER BY created_at DESC
      `;

      const result = await db.query(query, [organization_id]);

      return res.status(200).json({
        success: true,
        message: 'Bots retrieved successfully',
        bots: result.rows,
        total: result.rows.length
      });
    }

  } catch (error) {
    log.error('Get bots error', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      organization_id: req.organization?.id
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve bots',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/bots/:id - Get single bot details
 * Returns details of a specific bot (only if it belongs to current organization)
 * Permission: viewer or higher
 */
router.get('/:id', checkPermission('viewer'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get organization_id safely
    const organization_id = req.organization?.id;
    if (!organization_id) {
      log.error('GET bot - No organization context', { id, user_id: req.user?.id });
      return res.status(403).json({
        success: false,
        message: 'Organization context required'
      });
    }

    log.debug('GET bot request', { id, organization_id, user_id: req.user?.id });

    // Validate ID is a valid positive integer
    const botId = parseInt(id, 10);
    if (!id || isNaN(botId) || botId < 1) {
      log.warn('Invalid bot ID', { id, parsed: botId });
      return res.status(404).json({
        success: false,
        message: 'Bot not found'
      });
    }

    const query = `
      SELECT id, user_id, organization_id, name, description, platform, language, api_token, webhook_url, is_active, created_at, updated_at
      FROM bots
      WHERE id = $1 AND organization_id = $2
    `;

    const result = await db.query(query, [botId, organization_id]);

    // Check if bot exists in this organization
    if (result.rows.length === 0) {
      log.warn('Bot not found', { botId, organization_id, user_id: req.user?.id });
      return res.status(404).json({
        success: false,
        message: 'Bot not found or not accessible in this organization'
      });
    }

    return res.status(200).json({
      success: true,
      bot: result.rows[0]
    });

  } catch (error) {
    log.error('Get bot error', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      bot_id: req.params.id
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve bot',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /api/bots/:id - Update bot
 * Updates bot details (only if it belongs to the current organization)
 * Updatable fields: name, description, platform, webhook_url, is_active
 * NOT updatable: id, user_id, api_token, created_at
 * Permission: member or admin
 */
router.put('/:id', checkPermission('member'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;
    const { name, description, platform, language, webhook_url, is_active } = req.body;

    // Validate ID is a number
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bot ID'
      });
    }

    // First, check if bot exists and belongs to organization, and get old values for audit
    const checkQuery = 'SELECT id, name, description, platform, language, webhook_url, is_active FROM bots WHERE id = $1 AND organization_id = $2';
    const checkResult = await db.query(checkQuery, [id, organization_id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bot not found or not accessible in this organization'
      });
    }

    const oldBot = checkResult.rows[0];

    // Validate at least one field is being updated
    if (!name && !description && !platform && !language && !webhook_url && is_active === undefined) {
      return res.status(400).json({
        success: false,
        message: 'At least one field must be provided for update'
      });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      if (name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Bot name cannot be empty'
        });
      }
      updates.push(`name = $${paramCount}`);
      values.push(name.trim());
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description ? description.trim() : null);
      paramCount++;
    }

    if (platform !== undefined) {
      let normalizedPlatform = platform.toLowerCase().trim();
      // Auto-convert voice-to-bot to web platform
      if (normalizedPlatform === 'voice-to-bot') {
        normalizedPlatform = 'web';
      }
      const validPlatforms = ['telegram', 'whatsapp', 'discord', 'slack', 'messenger', 'web'];
      if (!validPlatforms.includes(normalizedPlatform)) {
        return res.status(400).json({
          success: false,
          message: `Invalid platform. Valid platforms: ${validPlatforms.join(', ')}`
        });
      }
      updates.push(`platform = $${paramCount}`);
      values.push(normalizedPlatform);
      paramCount++;
    }

    if (language !== undefined) {
      updates.push(`language = $${paramCount}`);
      values.push(language.toLowerCase().trim());
      paramCount++;
    }

    if (webhook_url !== undefined) {
      updates.push(`webhook_url = $${paramCount}`);
      values.push(webhook_url ? webhook_url.trim() : null);
      paramCount++;
    }

    if (is_active !== undefined) {
      // Validate boolean
      if (typeof is_active !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'is_active must be a boolean value'
        });
      }
      updates.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    // Always update updated_at timestamp
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add bot ID as last parameter
    values.push(id);

    const updateQuery = `
      UPDATE bots
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, user_id, name, description, platform, language, api_token, webhook_url, is_active, created_at, updated_at
    `;

    const result = await db.query(updateQuery, values);
    const updatedBot = result.rows[0];

    // Log bot update to audit trail
    const oldValues = {
      name: oldBot.name,
      description: oldBot.description,
      platform: oldBot.platform,
      language: oldBot.language,
      webhook_url: oldBot.webhook_url,
      is_active: oldBot.is_active
    };
    const newValues = {
      name: updatedBot.name,
      description: updatedBot.description,
      platform: updatedBot.platform,
      language: updatedBot.language,
      webhook_url: updatedBot.webhook_url,
      is_active: updatedBot.is_active
    };
    await logBotUpdated(req, organization_id, parseInt(id), oldValues, newValues);

    // Trigger webhook for bot update
    await webhookService.trigger(organization_id, 'bot.updated', {
      bot_id: updatedBot.id,
      name: updatedBot.name,
      platform: updatedBot.platform,
      description: updatedBot.description,
      is_active: updatedBot.is_active,
      updated_at: updatedBot.updated_at,
      changes: {
        old: oldValues,
        new: newValues
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Bot updated successfully!',
      bot: updatedBot
    });

  } catch (error) {
    log.error('Update bot error', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      bot_id: req.params.id
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to update bot',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/bots/:id - Delete bot
 * Deletes bot (only if it belongs to the current organization)
 * CASCADE: bot_messages will be automatically deleted due to database constraint
 * Permission: admin
 */
router.delete('/:id', checkPermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    // Validate ID is a number
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bot ID'
      });
    }

    // First, check if bot exists and belongs to organization
    const checkQuery = 'SELECT name, platform, description FROM bots WHERE id = $1 AND organization_id = $2';
    const checkResult = await db.query(checkQuery, [id, organization_id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bot not found or not accessible in this organization'
      });
    }

    const bot = checkResult.rows[0];

    // Delete bot (bot_messages will be deleted automatically due to CASCADE)
    const deleteQuery = 'DELETE FROM bots WHERE id = $1';
    await db.query(deleteQuery, [id]);

    // Log bot deletion to audit trail
    await logBotDeleted(req, organization_id, parseInt(id), {
      name: bot.name,
      platform: bot.platform,
      description: bot.description
    });

    // Trigger webhook for bot deletion
    await webhookService.trigger(organization_id, 'bot.deleted', {
      bot_id: parseInt(id),
      name: bot.name,
      platform: bot.platform,
      description: bot.description,
      deleted_at: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: `Bot "${bot.name}" deleted successfully!`,
      deletedId: parseInt(id)
    });

  } catch (error) {
    log.error('Delete bot error', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      bot_id: req.params.id
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to delete bot',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
