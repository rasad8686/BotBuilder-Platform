const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');
const { checkPermission } = require('../middleware/checkPermission');
const log = require('../utils/logger');

// Apply authentication and organization middleware to all routes
router.use(authenticateToken);
router.use(organizationContext);
router.use(requireOrganization);

/**
 * Helper function to verify bot belongs to organization
 * @param {number} botId - Bot ID
 * @param {number} organizationId - Organization ID
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
async function verifyBotInOrganization(botId, organizationId) {
  const result = await db.query(
    'SELECT id FROM bots WHERE id = $1 AND organization_id = $2',
    [botId, organizationId]
  );

  if (result.rows.length === 0) {
    return { valid: false, error: 'Bot not found or not accessible in this organization' };
  }

  return { valid: true };
}

/**
 * POST /:botId/flow - Create new flow for a bot
 * Creates a new flow configuration and deactivates previous active flows
 * Permission: member or admin
 */
router.post('/:botId/flow', checkPermission('member'), async (req, res) => {
  const client = await db.pool.connect();

  try {
    const { botId } = req.params;
    const { flowData } = req.body;
    const organization_id = req.organization.id;

    // Validate botId
    if (isNaN(botId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bot ID'
      });
    }

    // Validate flowData
    if (!flowData || typeof flowData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Flow data is required and must be an object'
      });
    }

    // Verify bot belongs to organization
    const verification = await verifyBotInOrganization(botId, organization_id);
    if (!verification.valid) {
      return res.status(404).json({
        success: false,
        message: verification.error
      });
    }

    // Start transaction
    await client.query('BEGIN');

    // Get the next version number
    const versionResult = await client.query(
      'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM bot_flows WHERE bot_id = $1',
      [botId]
    );
    const nextVersion = versionResult.rows[0].next_version;

    // Deactivate all previous flows for this bot
    await client.query(
      'UPDATE bot_flows SET is_active = false WHERE bot_id = $1',
      [botId]
    );

    // Insert new flow
    const insertResult = await client.query(
      `INSERT INTO bot_flows (bot_id, flow_data, version, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, bot_id, flow_data, version, is_active, created_at, updated_at`,
      [botId, JSON.stringify(flowData), nextVersion]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Flow created successfully',
      data: insertResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    log.error('Create flow error:', { error: error.message });

    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'A flow with this version already exists'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create flow',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

/**
 * GET /:botId/flow - Get active flow for a bot
 * Returns the currently active flow configuration
 * Permission: viewer or higher
 */
router.get('/:botId/flow', checkPermission('viewer'), async (req, res) => {
  try {
    const { botId } = req.params;
    const organization_id = req.organization.id;

    // Validate botId
    if (isNaN(botId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bot ID'
      });
    }

    // Verify bot belongs to organization
    const verification = await verifyBotInOrganization(botId, organization_id);
    if (!verification.valid) {
      return res.status(404).json({
        success: false,
        message: verification.error
      });
    }

    // Get active flow
    const result = await db.query(
      `SELECT id, bot_id, flow_data, version, is_active, created_at, updated_at
       FROM bot_flows
       WHERE bot_id = $1 AND is_active = true`,
      [botId]
    );

    if (result.rows.length === 0) {
      // No flow exists, return empty state
      return res.status(200).json({
        success: true,
        message: 'No active flow found',
        data: null
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    log.error('Get active flow error:', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve flow',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /:botId/flow/:flowId - Update an existing flow
 * Updates flow data and increments version
 * Permission: member or admin
 */
router.put('/:botId/flow/:flowId', checkPermission('member'), async (req, res) => {
  const client = await db.pool.connect();

  try {
    const { botId, flowId } = req.params;
    const { flowData } = req.body;
    const organization_id = req.organization.id;

    // Validate IDs
    if (isNaN(botId) || isNaN(flowId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bot ID or flow ID'
      });
    }

    // Validate flowData
    if (!flowData || typeof flowData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Flow data is required and must be an object'
      });
    }

    // Verify bot belongs to organization
    const verification = await verifyBotInOrganization(botId, organization_id);
    if (!verification.valid) {
      return res.status(404).json({
        success: false,
        message: verification.error
      });
    }

    // Start transaction
    await client.query('BEGIN');

    // Check if flow exists and belongs to the bot
    const flowCheck = await client.query(
      'SELECT id, version FROM bot_flows WHERE id = $1 AND bot_id = $2',
      [flowId, botId]
    );

    if (flowCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Flow not found'
      });
    }

    // Get the next version number
    const versionResult = await client.query(
      'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM bot_flows WHERE bot_id = $1',
      [botId]
    );
    const nextVersion = versionResult.rows[0].next_version;

    // Deactivate all previous flows
    await client.query(
      'UPDATE bot_flows SET is_active = false WHERE bot_id = $1',
      [botId]
    );

    // Create new version of the flow
    const insertResult = await client.query(
      `INSERT INTO bot_flows (bot_id, flow_data, version, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, bot_id, flow_data, version, is_active, created_at, updated_at`,
      [botId, JSON.stringify(flowData), nextVersion]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Flow updated successfully',
      data: insertResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    log.error('Update flow error:', { error: error.message });

    return res.status(500).json({
      success: false,
      message: 'Failed to update flow',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

/**
 * GET /:botId/flow/history - Get all flow versions for a bot
 * Returns all versions ordered by version number (newest first)
 * Permission: viewer or higher
 */
router.get('/:botId/flow/history', checkPermission('viewer'), async (req, res) => {
  try {
    const { botId } = req.params;
    const organization_id = req.organization.id;

    // Validate botId
    if (isNaN(botId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bot ID'
      });
    }

    // Verify bot belongs to organization
    const verification = await verifyBotInOrganization(botId, organization_id);
    if (!verification.valid) {
      return res.status(404).json({
        success: false,
        message: verification.error
      });
    }

    // Get all flow versions
    const result = await db.query(
      `SELECT id, bot_id, flow_data, version, is_active, created_at, updated_at
       FROM bot_flows
       WHERE bot_id = $1
       ORDER BY version DESC`,
      [botId]
    );

    return res.status(200).json({
      success: true,
      message: 'Flow history retrieved successfully',
      data: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    log.error('Get flow history error:', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve flow history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
