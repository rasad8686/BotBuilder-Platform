/**
 * Entities API Routes
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
 * GET /api/entities - List all entities for a bot
 */
router.get('/', async (req, res) => {
  try {
    const { bot_id } = req.query;

    if (!bot_id) {
      return res.json([]);
    }

    const entities = await manager.getEntities(parseInt(bot_id));
    res.json(entities);
  } catch (error) {
    log.error('Error fetching entities:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch entities' });
  }
});

/**
 * POST /api/entities - Create new entity
 */
router.post('/', async (req, res) => {
  try {
    const { bot_id, name, displayName, type } = req.body;

    if (!bot_id || !name) {
      return res.status(400).json({ error: 'bot_id and name are required' });
    }

    const entity = await manager.createEntity(bot_id, {
      name,
      displayName,
      type
    });

    res.status(201).json(entity);
  } catch (error) {
    log.error('Error creating entity:', { error: error.message });
    res.status(500).json({ error: 'Failed to create entity' });
  }
});

/**
 * GET /api/entities/:id - Get single entity
 */
router.get('/:id', async (req, res) => {
  try {
    const entity = await manager.getEntity(parseInt(req.params.id));

    if (!entity) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    res.json(entity);
  } catch (error) {
    log.error('Error fetching entity:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch entity' });
  }
});

/**
 * PUT /api/entities/:id - Update entity
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, displayName, type } = req.body;

    const entity = await manager.updateEntity(parseInt(req.params.id), {
      name,
      displayName,
      type
    });

    if (!entity) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    res.json(entity);
  } catch (error) {
    log.error('Error updating entity:', { error: error.message });
    res.status(500).json({ error: 'Failed to update entity' });
  }
});

/**
 * DELETE /api/entities/:id - Delete entity
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await manager.deleteEntity(parseInt(req.params.id));

    if (!deleted) {
      return res.status(404).json({ error: 'Entity not found or is a system entity' });
    }

    res.json({ success: true });
  } catch (error) {
    log.error('Error deleting entity:', { error: error.message });
    res.status(500).json({ error: 'Failed to delete entity' });
  }
});

// ==================== ENTITY VALUES ====================

/**
 * GET /api/entities/:id/values - Get entity values
 */
router.get('/:id/values', async (req, res) => {
  try {
    const values = await manager.getValues(parseInt(req.params.id));
    res.json(values);
  } catch (error) {
    log.error('Error fetching values:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch values' });
  }
});

/**
 * POST /api/entities/:id/values - Add value
 */
router.post('/:id/values', async (req, res) => {
  try {
    const { value, synonyms } = req.body;

    if (!value) {
      return res.status(400).json({ error: 'value is required' });
    }

    const created = await manager.addValue(parseInt(req.params.id), { value, synonyms });
    res.status(201).json(created);
  } catch (error) {
    log.error('Error adding value:', { error: error.message });
    res.status(500).json({ error: 'Failed to add value' });
  }
});

/**
 * DELETE /api/entities/:id/values/:valueId - Delete value
 */
router.delete('/:id/values/:valueId', async (req, res) => {
  try {
    const deleted = await manager.deleteValue(parseInt(req.params.valueId));

    if (!deleted) {
      return res.status(404).json({ error: 'Value not found' });
    }

    res.json({ success: true });
  } catch (error) {
    log.error('Error deleting value:', { error: error.message });
    res.status(500).json({ error: 'Failed to delete value' });
  }
});

module.exports = router;
