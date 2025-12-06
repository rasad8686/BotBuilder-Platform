/**
 * Intents API Routes
 */

const express = require('express');
const router = express.Router();
const IntentEntityManager = require('../services/IntentEntityManager');
const authenticateToken = require('../middleware/auth');
const log = require('../utils/logger');

const manager = new IntentEntityManager();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/intents - List all intents for a bot
 */
router.get('/', async (req, res) => {
  try {
    const { bot_id } = req.query;

    if (!bot_id) {
      return res.json([]);
    }

    const intents = await manager.getIntents(parseInt(bot_id));
    res.json(intents);
  } catch (error) {
    log.error('Error fetching intents:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch intents' });
  }
});

/**
 * POST /api/intents - Create new intent
 */
router.post('/', async (req, res) => {
  try {
    const { bot_id, name, displayName, description, confidenceThreshold } = req.body;

    if (!bot_id || !name) {
      return res.status(400).json({ error: 'bot_id and name are required' });
    }

    const intent = await manager.createIntent(bot_id, {
      name,
      displayName,
      description,
      confidenceThreshold
    });

    res.status(201).json(intent);
  } catch (error) {
    log.error('Error creating intent:', { error: error.message });
    res.status(500).json({ error: 'Failed to create intent' });
  }
});

/**
 * GET /api/intents/:id - Get single intent
 */
router.get('/:id', async (req, res) => {
  try {
    const intent = await manager.getIntent(parseInt(req.params.id));

    if (!intent) {
      return res.status(404).json({ error: 'Intent not found' });
    }

    res.json(intent);
  } catch (error) {
    log.error('Error fetching intent:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch intent' });
  }
});

/**
 * PUT /api/intents/:id - Update intent
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, displayName, description, isActive, confidenceThreshold } = req.body;

    const intent = await manager.updateIntent(parseInt(req.params.id), {
      name,
      displayName,
      description,
      isActive,
      confidenceThreshold
    });

    if (!intent) {
      return res.status(404).json({ error: 'Intent not found' });
    }

    res.json(intent);
  } catch (error) {
    log.error('Error updating intent:', { error: error.message });
    res.status(500).json({ error: 'Failed to update intent' });
  }
});

/**
 * DELETE /api/intents/:id - Delete intent
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await manager.deleteIntent(parseInt(req.params.id));

    if (!deleted) {
      return res.status(404).json({ error: 'Intent not found' });
    }

    res.json({ success: true });
  } catch (error) {
    log.error('Error deleting intent:', { error: error.message });
    res.status(500).json({ error: 'Failed to delete intent' });
  }
});

// ==================== INTENT EXAMPLES ====================

/**
 * GET /api/intents/:id/examples - Get intent examples
 */
router.get('/:id/examples', async (req, res) => {
  try {
    const examples = await manager.getExamples(parseInt(req.params.id));
    res.json(examples);
  } catch (error) {
    log.error('Error fetching examples:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch examples' });
  }
});

/**
 * POST /api/intents/:id/examples - Add example
 */
router.post('/:id/examples', async (req, res) => {
  try {
    const { text, language } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const example = await manager.addExample(parseInt(req.params.id), { text, language });
    res.status(201).json(example);
  } catch (error) {
    log.error('Error adding example:', { error: error.message });
    res.status(500).json({ error: 'Failed to add example' });
  }
});

/**
 * POST /api/intents/:id/examples/bulk - Bulk add examples
 */
router.post('/:id/examples/bulk', async (req, res) => {
  try {
    const { examples } = req.body;

    if (!examples || !Array.isArray(examples)) {
      return res.status(400).json({ error: 'examples array is required' });
    }

    const created = await manager.bulkAddExamples(parseInt(req.params.id), examples);
    res.status(201).json(created);
  } catch (error) {
    log.error('Error bulk adding examples:', { error: error.message });
    res.status(500).json({ error: 'Failed to bulk add examples' });
  }
});

/**
 * DELETE /api/intents/:id/examples/:exampleId - Delete example
 */
router.delete('/:id/examples/:exampleId', async (req, res) => {
  try {
    const deleted = await manager.deleteExample(parseInt(req.params.exampleId));

    if (!deleted) {
      return res.status(404).json({ error: 'Example not found' });
    }

    res.json({ success: true });
  } catch (error) {
    log.error('Error deleting example:', { error: error.message });
    res.status(500).json({ error: 'Failed to delete example' });
  }
});

module.exports = router;
