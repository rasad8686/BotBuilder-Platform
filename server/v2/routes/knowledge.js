/**
 * V2 Knowledge Base Routes
 * Professional API for RAG/knowledge management
 */

const express = require('express');
const router = express.Router();
const { ErrorCodes } = require('../constants/errorCodes');
const { knowledgeLinks, addLinks } = require('../utils/hateoas');
const { processCursorResults } = require('../utils/pagination');
const Joi = require('joi');
const validate = require('../middleware/validate');

// Get database connection
const getDb = () => require('../../db');

// Validation schemas
const listKnowledge = {
  params: Joi.object({
    botId: Joi.string().required()
  }),
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    cursor: Joi.string().optional()
  })
};

const createKnowledge = {
  params: Joi.object({
    botId: Joi.string().required()
  }),
  body: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(500).optional(),
    type: Joi.string().valid('document', 'faq', 'website').default('document'),
    settings: Joi.object({
      chunkSize: Joi.number().integer().min(100).max(2000).default(500),
      chunkOverlap: Joi.number().integer().min(0).max(500).default(50),
      embeddingModel: Joi.string().default('text-embedding-ada-002')
    }).optional()
  })
};

const queryKnowledge = {
  params: Joi.object({
    botId: Joi.string().required(),
    id: Joi.string().required()
  }),
  body: Joi.object({
    query: Joi.string().min(1).max(1000).required(),
    limit: Joi.number().integer().min(1).max(20).default(5),
    threshold: Joi.number().min(0).max(1).default(0.7)
  })
};

/**
 * GET /api/v2/bots/:botId/knowledge
 * List knowledge bases for a bot
 */
router.get('/:botId/knowledge', validate(listKnowledge), async (req, res) => {
  try {
    const db = getDb();
    const { botId } = req.params;
    const { limit, cursor } = req.query;

    // Verify bot ownership
    const bot = await db('bots')
      .where({ id: botId, user_id: req.user.id })
      .first();

    if (!bot) {
      return res.apiError(ErrorCodes.BOT_NOT_FOUND);
    }

    let query = db('knowledge_bases').where('bot_id', botId);

    if (cursor) {
      const decoded = req.pagination.decodeCursor(cursor);
      if (decoded) {
        query.where('id', '<', decoded.id);
      }
    }

    query.orderBy('created_at', 'desc').limit(limit + 1);

    const kbs = await query;
    const { data, hasMore, nextCursor } = processCursorResults(kbs, limit, 'id');

    const kbsWithLinks = data.map(kb =>
      addLinks(formatKnowledgeBase(kb), (k) => knowledgeLinks(k, botId))
    );

    res.paginate(kbsWithLinks, { hasMore, nextCursor });
    res.success(kbsWithLinks);
  } catch (error) {
    console.error('V2 List knowledge error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * GET /api/v2/bots/:botId/knowledge/:id
 * Get a single knowledge base
 */
router.get('/:botId/knowledge/:id', async (req, res) => {
  try {
    const db = getDb();
    const { botId, id } = req.params;

    // Verify bot ownership
    const bot = await db('bots')
      .where({ id: botId, user_id: req.user.id })
      .first();

    if (!bot) {
      return res.apiError(ErrorCodes.BOT_NOT_FOUND);
    }

    const kb = await db('knowledge_bases')
      .where({ id, bot_id: botId })
      .first();

    if (!kb) {
      return res.apiError(ErrorCodes.KNOWLEDGE_NOT_FOUND);
    }

    // Get document count
    const [{ count }] = await db('knowledge_documents')
      .where('knowledge_base_id', id)
      .count();

    const formattedKb = addLinks(
      { ...formatKnowledgeBase(kb), documentCount: parseInt(count) },
      (k) => knowledgeLinks(k, botId)
    );

    res.success(formattedKb);
  } catch (error) {
    console.error('V2 Get knowledge error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * POST /api/v2/bots/:botId/knowledge
 * Create a new knowledge base
 */
router.post('/:botId/knowledge', validate(createKnowledge), async (req, res) => {
  try {
    const db = getDb();
    const { botId } = req.params;
    const { name, description, type, settings } = req.body;

    // Verify bot ownership
    const bot = await db('bots')
      .where({ id: botId, user_id: req.user.id })
      .first();

    if (!bot) {
      return res.apiError(ErrorCodes.BOT_NOT_FOUND);
    }

    const [kb] = await db('knowledge_bases')
      .insert({
        bot_id: botId,
        name,
        description,
        type: type || 'document',
        settings: settings ? JSON.stringify(settings) : null,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    const formattedKb = addLinks(formatKnowledgeBase(kb), (k) => knowledgeLinks(k, botId));
    res.created(formattedKb);
  } catch (error) {
    console.error('V2 Create knowledge error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * POST /api/v2/bots/:botId/knowledge/:id/query
 * Query a knowledge base
 */
router.post('/:botId/knowledge/:id/query', validate(queryKnowledge), async (req, res) => {
  try {
    const db = getDb();
    const { botId, id } = req.params;
    const { query, limit, threshold } = req.body;

    // Verify bot ownership
    const bot = await db('bots')
      .where({ id: botId, user_id: req.user.id })
      .first();

    if (!bot) {
      return res.apiError(ErrorCodes.BOT_NOT_FOUND);
    }

    const kb = await db('knowledge_bases')
      .where({ id, bot_id: botId })
      .first();

    if (!kb) {
      return res.apiError(ErrorCodes.KNOWLEDGE_NOT_FOUND);
    }

    // Use RAG service if available
    let results = [];
    try {
      const ragService = require('../../services/ragService');
      results = await ragService.query(id, query, { limit, threshold });
    } catch (ragError) {
      console.error('RAG query error:', ragError);
      // Return empty results if RAG service fails
    }

    res.success({
      query,
      results: results.map(r => ({
        content: r.content,
        score: r.score,
        metadata: r.metadata,
        documentId: r.document_id
      })),
      totalResults: results.length
    });
  } catch (error) {
    console.error('V2 Query knowledge error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * DELETE /api/v2/bots/:botId/knowledge/:id
 * Delete a knowledge base
 */
router.delete('/:botId/knowledge/:id', async (req, res) => {
  try {
    const db = getDb();
    const { botId, id } = req.params;

    // Verify bot ownership
    const bot = await db('bots')
      .where({ id: botId, user_id: req.user.id })
      .first();

    if (!bot) {
      return res.apiError(ErrorCodes.BOT_NOT_FOUND);
    }

    const deleted = await db('knowledge_bases')
      .where({ id, bot_id: botId })
      .del();

    if (!deleted) {
      return res.apiError(ErrorCodes.KNOWLEDGE_NOT_FOUND);
    }

    res.noContent();
  } catch (error) {
    console.error('V2 Delete knowledge error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * Format knowledge base for API response
 */
function formatKnowledgeBase(kb) {
  return {
    id: kb.id,
    name: kb.name,
    description: kb.description,
    type: kb.type,
    status: kb.status,
    settings: kb.settings ? JSON.parse(kb.settings) : null,
    createdAt: kb.created_at,
    updatedAt: kb.updated_at
  };
}

module.exports = router;
