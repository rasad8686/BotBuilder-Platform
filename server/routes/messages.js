const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');
const { checkPermission } = require('../middleware/checkPermission');

// Apply authentication and organization middleware to all routes
router.use(authenticateToken);
router.use(organizationContext);
router.use(requireOrganization);

/**
 * Helper function to verify bot belongs to organization
 * Checks if the bot belongs to the current organization
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
 * POST /api/messages - Create new message
 * Creates a new message for a bot in the current organization
 * Required: bot_id, message_type, content
 * Optional: trigger_keywords
 * Permission: member or admin
 */
router.post('/', checkPermission('member'), async (req, res) => {
  try {
    const { bot_id, message_type, content, trigger_keywords } = req.body;
    const organization_id = req.organization.id;

    // Validation - Required fields
    if (!bot_id) {
      return res.status(400).json({
        success: false,
        message: 'Bot ID is required'
      });
    }

    if (!message_type || message_type.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Message type is required'
      });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Validate message_type
    const validTypes = ['greeting', 'response', 'fallback', 'command', 'help'];
    if (!validTypes.includes(message_type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid message type. Valid types: ${validTypes.join(', ')}`
      });
    }

    // Verify bot belongs to organization
    const verification = await verifyBotInOrganization(bot_id, organization_id);
    if (!verification.valid) {
      return res.status(404).json({
        success: false,
        message: verification.error
      });
    }

    // Insert message into database
    const query = `
      INSERT INTO bot_messages (bot_id, message_type, content, trigger_keywords, created_at, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, bot_id, message_type, content, trigger_keywords, created_at, updated_at
    `;

    const values = [
      bot_id,
      message_type.toLowerCase().trim(),
      content.trim(),
      trigger_keywords ? trigger_keywords.trim() : null
    ];

    const result = await db.query(query, values);
    const message = result.rows[0];

    return res.status(201).json({
      success: true,
      message: 'Message created successfully!',
      data: message
    });

  } catch (error) {
    console.error('Create message error:', error);

    // Handle foreign key constraint error
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Invalid bot_id'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/messages/bot/:botId - Get all messages for a bot
 * Returns array of all messages belonging to the bot in current organization
 * Query params (optional): page (default 1), limit (default 10)
 * If no pagination params provided, returns all messages (backward compatible)
 * Permission: viewer or higher
 */
router.get('/bot/:botId', checkPermission('viewer'), async (req, res) => {
  try {
    const { botId } = req.params;
    const organization_id = req.organization.id;

    // Validate botId is a number
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

      // Get total count
      const countQuery = 'SELECT COUNT(*) FROM bot_messages WHERE bot_id = $1';
      const countResult = await db.query(countQuery, [botId]);
      const total = parseInt(countResult.rows[0].count);

      // Get paginated messages
      const query = `
        SELECT id, bot_id, message_type, content, trigger_keywords, created_at, updated_at
        FROM bot_messages
        WHERE bot_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await db.query(query, [botId, limit, offset]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);

      return res.status(200).json({
        success: true,
        message: 'Messages retrieved successfully',
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
      // No pagination - return all messages (backward compatible)
      const query = `
        SELECT id, bot_id, message_type, content, trigger_keywords, created_at, updated_at
        FROM bot_messages
        WHERE bot_id = $1
        ORDER BY created_at DESC
      `;

      const result = await db.query(query, [botId]);

      return res.status(200).json({
        success: true,
        message: 'Messages retrieved successfully',
        data: result.rows,
        total: result.rows.length
      });
    }

  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve messages',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/messages/:id - Get single message details
 * Returns details of a specific message in current organization
 * Permission: viewer or higher
 */
router.get('/:id', checkPermission('viewer'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    // Validate ID is a number
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID'
      });
    }

    // Get message with organization check
    const query = `
      SELECT bm.id, bm.bot_id, bm.message_type, bm.content, bm.trigger_keywords,
             bm.created_at, bm.updated_at
      FROM bot_messages bm
      JOIN bots b ON bm.bot_id = b.id
      WHERE bm.id = $1 AND b.organization_id = $2
    `;

    const result = await db.query(query, [id, organization_id]);

    // Check if message exists
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or not accessible in this organization'
      });
    }

    const message = result.rows[0];

    return res.status(200).json({
      success: true,
      data: message
    });

  } catch (error) {
    console.error('Get message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /api/messages/:id - Update message
 * Updates message details in current organization
 * Updatable fields: message_type, content, trigger_keywords
 * Permission: member or admin
 */
router.put('/:id', checkPermission('member'), async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;
    const { message_type, content, trigger_keywords } = req.body;

    // Validate ID is a number
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID'
      });
    }

    // First, check if message exists in organization
    const checkQuery = `
      SELECT bm.id
      FROM bot_messages bm
      JOIN bots b ON bm.bot_id = b.id
      WHERE bm.id = $1 AND b.organization_id = $2
    `;
    const checkResult = await db.query(checkQuery, [id, organization_id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or not accessible in this organization'
      });
    }

    // Validate at least one field is being updated
    if (!message_type && !content && trigger_keywords === undefined) {
      return res.status(400).json({
        success: false,
        message: 'At least one field must be provided for update'
      });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (message_type !== undefined) {
      const validTypes = ['greeting', 'response', 'fallback', 'command', 'help'];
      if (!validTypes.includes(message_type.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Invalid message type. Valid types: ${validTypes.join(', ')}`
        });
      }
      updates.push(`message_type = $${paramCount}`);
      values.push(message_type.toLowerCase().trim());
      paramCount++;
    }

    if (content !== undefined) {
      if (content.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Message content cannot be empty'
        });
      }
      updates.push(`content = $${paramCount}`);
      values.push(content.trim());
      paramCount++;
    }

    if (trigger_keywords !== undefined) {
      updates.push(`trigger_keywords = $${paramCount}`);
      values.push(trigger_keywords ? trigger_keywords.trim() : null);
      paramCount++;
    }

    // Always update updated_at timestamp
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add message ID as last parameter
    values.push(id);

    const updateQuery = `
      UPDATE bot_messages
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, bot_id, message_type, content, trigger_keywords, created_at, updated_at
    `;

    const result = await db.query(updateQuery, values);
    const updatedMessage = result.rows[0];

    return res.status(200).json({
      success: true,
      message: 'Message updated successfully!',
      data: updatedMessage
    });

  } catch (error) {
    console.error('Update message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/messages/:id - Delete message
 * Deletes a message from current organization
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
        message: 'Invalid message ID'
      });
    }

    // First, check if message exists in organization
    const checkQuery = `
      SELECT bm.message_type
      FROM bot_messages bm
      JOIN bots b ON bm.bot_id = b.id
      WHERE bm.id = $1 AND b.organization_id = $2
    `;
    const checkResult = await db.query(checkQuery, [id, organization_id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or not accessible in this organization'
      });
    }

    const messageType = checkResult.rows[0].message_type;

    // Delete message
    const deleteQuery = 'DELETE FROM bot_messages WHERE id = $1';
    await db.query(deleteQuery, [id]);

    return res.status(200).json({
      success: true,
      message: `Message "${messageType}" deleted successfully!`,
      deletedId: parseInt(id)
    });

  } catch (error) {
    console.error('Delete message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
