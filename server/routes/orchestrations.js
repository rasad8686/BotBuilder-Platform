const express = require('express');
const router = express.Router();
const OrchestrationManager = require('../services/OrchestrationManager');
const authMiddleware = require('../middleware/auth');
const log = require('../utils/logger');

// Apply auth middleware to all routes
router.use(authMiddleware);

// ==================== ORCHESTRATION ROUTES ====================

// GET /api/orchestrations?bot_id= - List orchestrations
router.get('/', async (req, res) => {
  try {
    const { bot_id } = req.query;
    if (!bot_id) {
      return res.status(400).json({ success: false, message: 'bot_id is required' });
    }
    const orchestrations = await OrchestrationManager.listOrchestrations(bot_id);
    res.json({ success: true, data: orchestrations });
  } catch (error) {
    log.error('Error listing orchestrations:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/orchestrations - Create orchestration
router.post('/', async (req, res) => {
  try {
    const { bot_id, name, entry_flow_id, description } = req.body;
    if (!bot_id || !name) {
      return res.status(400).json({ success: false, message: 'bot_id and name are required' });
    }
    const orchestration = await OrchestrationManager.createOrchestration(bot_id, name, entry_flow_id, description);
    res.status(201).json({ success: true, data: orchestration });
  } catch (error) {
    log.error('Error creating orchestration:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/orchestrations/:id - Get orchestration
router.get('/:id', async (req, res) => {
  try {
    const orchestration = await OrchestrationManager.getOrchestration(req.params.id);
    if (!orchestration) {
      return res.status(404).json({ success: false, message: 'Orchestration not found' });
    }
    res.json({ success: true, data: orchestration });
  } catch (error) {
    log.error('Error getting orchestration:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/orchestrations/:id - Update orchestration
router.put('/:id', async (req, res) => {
  try {
    const orchestration = await OrchestrationManager.updateOrchestration(req.params.id, req.body);
    if (!orchestration) {
      return res.status(404).json({ success: false, message: 'Orchestration not found' });
    }
    res.json({ success: true, data: orchestration });
  } catch (error) {
    log.error('Error updating orchestration:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/orchestrations/:id - Delete orchestration
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await OrchestrationManager.deleteOrchestration(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Orchestration not found' });
    }
    res.json({ success: true, message: 'Orchestration deleted' });
  } catch (error) {
    log.error('Error deleting orchestration:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== TRANSITION ROUTES ====================

// GET /api/orchestrations/:id/transitions - Get transitions
router.get('/:id/transitions', async (req, res) => {
  try {
    const transitions = await OrchestrationManager.getTransitions(req.params.id);
    res.json({ success: true, data: transitions });
  } catch (error) {
    log.error('Error getting transitions:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/orchestrations/:id/transitions - Add transition
router.post('/:id/transitions', async (req, res) => {
  try {
    const { from_flow_id, to_flow_id, trigger_type, trigger_value, priority } = req.body;
    if (!from_flow_id || !to_flow_id || !trigger_type) {
      return res.status(400).json({ success: false, message: 'from_flow_id, to_flow_id, and trigger_type are required' });
    }
    const transition = await OrchestrationManager.addTransition(
      req.params.id,
      from_flow_id,
      to_flow_id,
      trigger_type,
      trigger_value || {},
      priority || 0
    );
    res.status(201).json({ success: true, data: transition });
  } catch (error) {
    log.error('Error adding transition:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/orchestrations/:id/transitions/:transitionId - Remove transition
router.delete('/:id/transitions/:transitionId', async (req, res) => {
  try {
    const deleted = await OrchestrationManager.removeTransition(req.params.transitionId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Transition not found' });
    }
    res.json({ success: true, message: 'Transition deleted' });
  } catch (error) {
    log.error('Error removing transition:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== VARIABLE ROUTES ====================

// GET /api/orchestrations/:id/variables - Get variables
router.get('/:id/variables', async (req, res) => {
  try {
    const variables = await OrchestrationManager.getVariables(req.params.id);
    res.json({ success: true, data: variables });
  } catch (error) {
    log.error('Error getting variables:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/orchestrations/:id/variables - Add variable
router.post('/:id/variables', async (req, res) => {
  try {
    const { name, type, default_value, scope } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }
    const variable = await OrchestrationManager.addVariable(
      req.params.id,
      name,
      type || 'string',
      default_value || null,
      scope || 'session'
    );
    res.status(201).json({ success: true, data: variable });
  } catch (error) {
    log.error('Error adding variable:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== EXECUTION ROUTES ====================

// POST /api/orchestrations/:id/execute - Execute orchestration
router.post('/:id/execute', async (req, res) => {
  try {
    const { session_id, input } = req.body;
    if (!session_id) {
      return res.status(400).json({ success: false, message: 'session_id is required' });
    }
    const result = await OrchestrationManager.executeOrchestration(req.params.id, session_id, input);
    res.json({ success: true, data: result });
  } catch (error) {
    log.error('Error executing orchestration:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
