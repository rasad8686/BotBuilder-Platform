/**
 * V2 Messages Routes
 * Professional API for bot messages
 */

const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const { sendMessage, listMessages, getMessage } = require('../validators/message.schema');
const { ErrorCodes } = require('../constants/errorCodes');
const { messageLinks, addLinks } = require('../utils/hateoas');
const { processCursorResults } = require('../utils/pagination');

// Get database connection
const getDb = () => require('../../db');

/**
 * GET /api/v2/bots/:botId/messages
 * List messages for a bot
 */
router.get('/:botId/messages', validate(listMessages), async (req, res) => {
  try {
    const db = getDb();
    const { botId } = req.params;
    const { limit, cursor, conversationId, role, startDate, endDate, sort } = req.query;

    // Verify bot ownership
    const bot = await db('bots')
      .where({ id: botId, user_id: req.user.id })
      .first();

    if (!bot) {
      return res.apiError(ErrorCodes.BOT_NOT_FOUND);
    }

    let query = db('messages').where('bot_id', botId);

    // Apply filters
    if (conversationId) {
      query.where('conversation_id', conversationId);
    }
    if (role) {
      query.where('role', role);
    }
    if (startDate) {
      query.where('created_at', '>=', startDate);
    }
    if (endDate) {
      query.where('created_at', '<=', endDate);
    }

    // Apply cursor
    if (cursor) {
      const decoded = req.pagination.decodeCursor(cursor);
      if (decoded) {
        query.where('id', '<', decoded.id);
      }
    }

    // Apply sorting
    const isDesc = !sort || sort.startsWith('-');
    query.orderBy('created_at', isDesc ? 'desc' : 'asc');
    query.limit(limit + 1);

    const messages = await query;

    // Process pagination
    const { data, hasMore, nextCursor } = processCursorResults(messages, limit, 'id');

    // Add HATEOAS links
    const messagesWithLinks = data.map(msg =>
      addLinks(formatMessage(msg), (m) => messageLinks(m, botId))
    );

    res.paginate(messagesWithLinks, { hasMore, nextCursor });
    res.success(messagesWithLinks);
  } catch (error) {
    console.error('V2 List messages error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * GET /api/v2/bots/:botId/messages/:messageId
 * Get a single message
 */
router.get('/:botId/messages/:messageId', validate(getMessage), async (req, res) => {
  try {
    const db = getDb();
    const { botId, messageId } = req.params;

    // Verify bot ownership
    const bot = await db('bots')
      .where({ id: botId, user_id: req.user.id })
      .first();

    if (!bot) {
      return res.apiError(ErrorCodes.BOT_NOT_FOUND);
    }

    const message = await db('messages')
      .where({ id: messageId, bot_id: botId })
      .first();

    if (!message) {
      return res.apiError(ErrorCodes.MESSAGE_NOT_FOUND);
    }

    const formattedMessage = addLinks(formatMessage(message), (m) => messageLinks(m, botId));
    res.success(formattedMessage);
  } catch (error) {
    console.error('V2 Get message error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * POST /api/v2/bots/:botId/messages
 * Send a message to bot and get AI response
 */
router.post('/:botId/messages', validate(sendMessage), async (req, res) => {
  try {
    const db = getDb();
    const { botId } = req.params;
    const { content, conversationId, metadata } = req.body;

    // Verify bot ownership
    const bot = await db('bots')
      .where({ id: botId, user_id: req.user.id })
      .first();

    if (!bot) {
      return res.apiError(ErrorCodes.BOT_NOT_FOUND);
    }

    // Generate or use existing conversation ID
    const convId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Save user message
    const [userMessage] = await db('messages')
      .insert({
        bot_id: botId,
        conversation_id: convId,
        role: 'user',
        content,
        metadata: metadata ? JSON.stringify(metadata) : null,
        created_at: new Date()
      })
      .returning('*');

    // Get AI response using existing service
    let aiResponse;
    try {
      const aiService = require('../../services/aiService');
      aiResponse = await aiService.chat(bot, content, convId);
    } catch (aiError) {
      console.error('AI Service error:', aiError);
      aiResponse = 'I apologize, but I encountered an error processing your request.';
    }

    // Save assistant message
    const [assistantMessage] = await db('messages')
      .insert({
        bot_id: botId,
        conversation_id: convId,
        role: 'assistant',
        content: aiResponse,
        created_at: new Date()
      })
      .returning('*');

    const response = {
      userMessage: addLinks(formatMessage(userMessage), (m) => messageLinks(m, botId)),
      assistantMessage: addLinks(formatMessage(assistantMessage), (m) => messageLinks(m, botId)),
      conversationId: convId
    };

    res.created(response);
  } catch (error) {
    console.error('V2 Send message error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * Format message for API response
 */
function formatMessage(message) {
  return {
    id: message.id,
    conversationId: message.conversation_id,
    role: message.role,
    content: message.content,
    metadata: message.metadata ? JSON.parse(message.metadata) : null,
    createdAt: message.created_at
  };
}

module.exports = router;
