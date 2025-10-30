const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Helper function to verify bot ownership
 * Checks if the bot belongs to the authenticated user
 */
async function verifyBotOwnership(botId, userId) {
  const result = await db.query(
    'SELECT user_id FROM bots WHERE id = $1',
    [botId]
  );

  if (result.rows.length === 0) {
    return { valid: false, error: 'Bot not found' };
  }

  if (result.rows[0].user_id !== userId) {
    return { valid: false, error: 'Access denied. This bot does not belong to you.' };
  }

  return { valid: true };
}

/**
 * POST /api/messages - Create new message
 * Creates a new message for a bot
 * Required: bot_id, message_type, content
 * Optional: trigger_keywords
 */
router.post('/', async (req, res) => {
  try {
    const { bot_id, message_type, content, trigger_keywords } = req.body;
    const user_id = req.user.id;

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

    // Verify bot ownership
    const ownership = await verifyBotOwnership(bot_id, user_id);
    if (!ownership.valid) {
      return res.status(ownership.error === 'Bot not found' ? 404 : 403).json({
        success: false,
        message: ownership.error
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
 * Returns array of all messages belonging to the bot
 */
router.get('/bot/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const user_id = req.user.id;

    // Validate botId is a number
    if (isNaN(botId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bot ID'
      });
    }

    // Verify bot ownership
    const ownership = await verifyBotOwnership(botId, user_id);
    if (!ownership.valid) {
      return res.status(ownership.error === 'Bot not found' ? 404 : 403).json({
        success: false,
        message: ownership.error
      });
    }

    // Get all messages for the bot
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
 * Returns details of a specific message
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    // Validate ID is a number
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID'
      });
    }

    // Get message with bot ownership check
    const query = `
      SELECT bm.id, bm.bot_id, bm.message_type, bm.content, bm.trigger_keywords,
             bm.created_at, bm.updated_at
      FROM bot_messages bm
      JOIN bots b ON bm.bot_id = b.id
      WHERE bm.id = $1
    `;

    const result = await db.query(query, [id]);

    // Check if message exists
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    const message = result.rows[0];

    // Verify bot ownership
    const ownership = await verifyBotOwnership(message.bot_id, user_id);
    if (!ownership.valid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This message does not belong to your bot.'
      });
    }

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
 * Updates message details
 * Updatable fields: message_type, content, trigger_keywords
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;
    const { message_type, content, trigger_keywords } = req.body;

    // Validate ID is a number
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID'
      });
    }

    // First, check if message exists and get bot_id
    const checkQuery = `
      SELECT bm.bot_id
      FROM bot_messages bm
      JOIN bots b ON bm.bot_id = b.id
      WHERE bm.id = $1
    `;
    const checkResult = await db.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    const botId = checkResult.rows[0].bot_id;

    // Verify bot ownership
    const ownership = await verifyBotOwnership(botId, user_id);
    if (!ownership.valid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This message does not belong to your bot.'
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
 * Deletes a message
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    // Validate ID is a number
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID'
      });
    }

    // First, check if message exists and get bot_id
    const checkQuery = `
      SELECT bm.bot_id, bm.message_type, bm.content
      FROM bot_messages bm
      JOIN bots b ON bm.bot_id = b.id
      WHERE bm.id = $1
    `;
    const checkResult = await db.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    const botId = checkResult.rows[0].bot_id;
    const messageType = checkResult.rows[0].message_type;

    // Verify bot ownership
    const ownership = await verifyBotOwnership(botId, user_id);
    if (!ownership.valid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This message does not belong to your bot.'
      });
    }

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
