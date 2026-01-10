/**
 * V2 Bots Routes
 * Professional API with consistent responses
 */

const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const { createBot, updateBot, botIdParam, listBots } = require('../validators/bot.schema');
const { ErrorCodes } = require('../constants/errorCodes');
const { botLinks, addLinks } = require('../utils/hateoas');
const { processCursorResults } = require('../utils/pagination');
const { applySort, applySearch } = require('../utils/queryBuilder');

// Get database connection
const getDb = () => require('../../db');

/**
 * GET /api/v2/bots
 * List all bots for authenticated user
 */
router.get('/', validate(listBots), async (req, res) => {
  try {
    const db = getDb();
    const { limit, cursor, status, sort, search } = req.query;
    const userId = req.user.id;

    let query = db('bots').where('user_id', userId);

    // Apply status filter
    if (status === 'active') {
      query.where('is_active', true);
    } else if (status === 'inactive') {
      query.where('is_active', false);
    }

    // Apply search
    if (search) {
      applySearch(query, search, ['name', 'description']);
    }

    // Apply cursor pagination
    if (cursor) {
      const decoded = req.pagination.decodeCursor(cursor);
      if (decoded) {
        query.where('id', '<', decoded.id);
      }
    }

    // Apply sorting
    applySort(query, sort, ['created_at', 'name', 'updated_at']);

    // Get results
    query.limit(limit + 1);
    const bots = await query;

    // Process pagination
    const { data, hasMore, nextCursor } = processCursorResults(bots, limit, 'id');

    // Add HATEOAS links
    const botsWithLinks = data.map(bot => addLinks(formatBot(bot), botLinks));

    // Set pagination meta
    res.paginate(botsWithLinks, { hasMore, nextCursor });

    res.success(botsWithLinks);
  } catch (error) {
    console.error('V2 List bots error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * GET /api/v2/bots/:id
 * Get a single bot
 */
router.get('/:id', validate(botIdParam), async (req, res) => {
  try {
    const db = getDb();
    const bot = await db('bots')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();

    if (!bot) {
      return res.apiError(ErrorCodes.BOT_NOT_FOUND);
    }

    const formattedBot = addLinks(formatBot(bot), botLinks);
    res.success(formattedBot);
  } catch (error) {
    console.error('V2 Get bot error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * POST /api/v2/bots
 * Create a new bot
 */
router.post('/', validate(createBot), async (req, res) => {
  try {
    const db = getDb();
    const {
      name,
      description,
      language,
      aiProvider,
      aiModel,
      systemPrompt,
      temperature,
      maxTokens,
      isActive,
      settings
    } = req.body;

    const [bot] = await db('bots')
      .insert({
        user_id: req.user.id,
        name,
        description,
        language: language || 'en',
        ai_provider: aiProvider || 'openai',
        ai_model: aiModel,
        system_prompt: systemPrompt,
        temperature: temperature || 0.7,
        max_tokens: maxTokens || 500,
        is_active: isActive !== false,
        settings: settings ? JSON.stringify(settings) : null,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    const formattedBot = addLinks(formatBot(bot), botLinks);
    res.created(formattedBot);
  } catch (error) {
    console.error('V2 Create bot error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * PUT /api/v2/bots/:id
 * Update a bot
 */
router.put('/:id', validate(updateBot), async (req, res) => {
  try {
    const db = getDb();

    // Check if bot exists
    const existing = await db('bots')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();

    if (!existing) {
      return res.apiError(ErrorCodes.BOT_NOT_FOUND);
    }

    // Build update object
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.language !== undefined) updates.language = req.body.language;
    if (req.body.aiProvider !== undefined) updates.ai_provider = req.body.aiProvider;
    if (req.body.aiModel !== undefined) updates.ai_model = req.body.aiModel;
    if (req.body.systemPrompt !== undefined) updates.system_prompt = req.body.systemPrompt;
    if (req.body.temperature !== undefined) updates.temperature = req.body.temperature;
    if (req.body.maxTokens !== undefined) updates.max_tokens = req.body.maxTokens;
    if (req.body.isActive !== undefined) updates.is_active = req.body.isActive;
    if (req.body.settings !== undefined) updates.settings = JSON.stringify(req.body.settings);
    updates.updated_at = new Date();

    const [bot] = await db('bots')
      .where({ id: req.params.id, user_id: req.user.id })
      .update(updates)
      .returning('*');

    const formattedBot = addLinks(formatBot(bot), botLinks);
    res.success(formattedBot);
  } catch (error) {
    console.error('V2 Update bot error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * DELETE /api/v2/bots/:id
 * Delete a bot
 */
router.delete('/:id', validate(botIdParam), async (req, res) => {
  try {
    const db = getDb();

    const deleted = await db('bots')
      .where({ id: req.params.id, user_id: req.user.id })
      .del();

    if (!deleted) {
      return res.apiError(ErrorCodes.BOT_NOT_FOUND);
    }

    res.noContent();
  } catch (error) {
    console.error('V2 Delete bot error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * Format bot for API response
 */
function formatBot(bot) {
  return {
    id: bot.id,
    name: bot.name,
    description: bot.description,
    language: bot.language,
    aiProvider: bot.ai_provider,
    aiModel: bot.ai_model,
    systemPrompt: bot.system_prompt,
    temperature: bot.temperature,
    maxTokens: bot.max_tokens,
    isActive: bot.is_active,
    settings: bot.settings ? JSON.parse(bot.settings) : null,
    createdAt: bot.created_at,
    updatedAt: bot.updated_at
  };
}

module.exports = router;
