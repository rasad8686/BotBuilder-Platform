/**
 * NLU (Natural Language Understanding) API Routes
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
 * POST /api/nlu/analyze - Analyze a message
 */
router.post('/analyze', async (req, res) => {
  try {
    const { botId, message } = req.body;

    if (!botId || !message) {
      return res.status(400).json({ error: 'botId and message are required' });
    }

    const result = await manager.analyzeMessage(parseInt(botId), message);
    res.json(result);
  } catch (error) {
    log.error('Error analyzing message:', { error: error.message });
    res.status(500).json({ error: 'Failed to analyze message' });
  }
});

/**
 * POST /api/nlu/system-entities - Create system entities for a bot
 */
router.post('/system-entities', async (req, res) => {
  try {
    const { botId } = req.body;

    if (!botId) {
      return res.status(400).json({ error: 'botId is required' });
    }

    const entities = await manager.createSystemEntities(parseInt(botId));
    res.status(201).json(entities);
  } catch (error) {
    log.error('Error creating system entities:', { error: error.message });
    res.status(500).json({ error: 'Failed to create system entities' });
  }
});

module.exports = router;
