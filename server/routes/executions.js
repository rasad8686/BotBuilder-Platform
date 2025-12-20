/**
 * Executions API Routes
 */

const express = require('express');
const router = express.Router();
const WorkflowExecution = require('../models/WorkflowExecution');
const AgentExecutionStep = require('../models/AgentExecutionStep');
const AgentMessage = require('../models/AgentMessage');
const authenticateToken = require('../middleware/auth');
const log = require('../utils/logger');

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/executions - Get executions list with filters
 */
router.get('/', async (req, res) => {
  try {
    const { bot_id, workflow_id, status, start_date, end_date } = req.query;

    if (!bot_id) {
      return res.status(400).json({ error: 'bot_id is required' });
    }

    const executions = await WorkflowExecution.findByBotId(bot_id, {
      workflow_id,
      status,
      start_date,
      end_date
    });

    res.json(executions);
  } catch (error) {
    if (error.code === '42P01') {
      // Table doesn't exist yet - return empty array
      return res.json({ data: [], message: 'No executions found' });
    }
    res.status(500).json({
      error: 'Failed to fetch executions',
      code: error.code
    });
  }
});

/**
 * GET /api/executions/:id - Get execution details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const execution = await WorkflowExecution.findById(id);

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    res.json(execution);
  } catch (error) {
    log.error('Error fetching execution:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch execution' });
  }
});

/**
 * GET /api/executions/:id/steps - Get execution steps
 */
router.get('/:id/steps', async (req, res) => {
  try {
    const { id } = req.params;

    const execution = await WorkflowExecution.findById(id);

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    const steps = await AgentExecutionStep.findByExecutionId(id);
    res.json(steps);
  } catch (error) {
    log.error('Error fetching execution steps:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch execution steps' });
  }
});

/**
 * GET /api/executions/:id/messages - Get agent messages
 */
router.get('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;

    const execution = await WorkflowExecution.findById(id);

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    const messages = await AgentMessage.findByExecutionId(id);
    res.json(messages);
  } catch (error) {
    log.error('Error fetching agent messages:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch agent messages' });
  }
});

/**
 * DELETE /api/executions/:id - Delete execution record
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const execution = await WorkflowExecution.findById(id);

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    // Delete related records first
    await AgentMessage.deleteByExecutionId(id);
    await AgentExecutionStep.deleteByExecutionId(id);
    await WorkflowExecution.delete(id);

    res.json({ message: 'Execution deleted successfully' });
  } catch (error) {
    log.error('Error deleting execution:', { error: error.message });
    res.status(500).json({ error: 'Failed to delete execution' });
  }
});

module.exports = router;
