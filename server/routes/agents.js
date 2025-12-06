/**
 * Agents API Routes
 */

const express = require('express');
const router = express.Router();
const AgentModel = require('../models/Agent');
const { Agent } = require('../agents');
const authenticateToken = require('../middleware/auth');
const log = require('../utils/logger');

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/agents - List all agents for tenant
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.id;
    const agents = await AgentModel.findByTenant(tenantId);
    res.json(agents);
  } catch (error) {
    log.error('Error fetching agents:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

/**
 * POST /api/agents - Create new agent for a bot
 */
router.post('/', async (req, res) => {
  try {
    const {
      bot_id,
      name,
      role,
      system_prompt,
      model_provider,
      model_name,
      temperature,
      max_tokens,
      capabilities,
      tools
    } = req.body;

    if (!bot_id || !name || !role || !system_prompt) {
      return res.status(400).json({
        error: 'bot_id, name, role, and system_prompt are required'
      });
    }

    const agent = await AgentModel.create({
      bot_id,
      name,
      role,
      system_prompt,
      model_provider,
      model_name,
      temperature,
      max_tokens,
      capabilities,
      tools
    });

    res.status(201).json(agent);
  } catch (error) {
    log.error('Error creating agent:', { error: error.message });
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

/**
 * GET /api/agents/bot/:botId - List all agents for a bot
 */
router.get('/bot/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const agents = await AgentModel.findByBotId(botId);
    res.json(agents);
  } catch (error) {
    log.error('Error fetching agents:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

/**
 * GET /api/agents/:id - Get single agent
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const agent = await AgentModel.findById(id);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json(agent);
  } catch (error) {
    log.error('Error fetching agent:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

/**
 * PUT /api/agents/:id - Update agent
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await AgentModel.findById(id);

    if (!existing) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const agent = await AgentModel.update(id, req.body);
    res.json(agent);
  } catch (error) {
    log.error('Error updating agent:', { error: error.message });
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

/**
 * DELETE /api/agents/:id - Delete agent
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await AgentModel.findById(id);

    if (!existing) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    await AgentModel.delete(id);
    res.json({ message: 'Agent deleted successfully' });
  } catch (error) {
    log.error('Error deleting agent:', { error: error.message });
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

/**
 * POST /api/agents/:id/test - Test agent with sample input
 */
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const { input } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'input is required' });
    }

    const agentData = await AgentModel.findById(id);

    if (!agentData) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Create agent instance
    const agent = new Agent({
      id: agentData.id,
      name: agentData.name,
      role: agentData.role,
      systemPrompt: agentData.system_prompt,
      modelProvider: agentData.model_provider,
      modelName: agentData.model_name,
      temperature: agentData.temperature,
      maxTokens: agentData.max_tokens,
      capabilities: agentData.capabilities,
      tools: agentData.tools
    });

    // Execute agent
    const result = await agent.execute(input, null);

    res.json({
      success: result.success,
      output: result.output,
      tokensUsed: result.tokensUsed,
      durationMs: result.durationMs,
      error: result.error
    });
  } catch (error) {
    log.error('Error testing agent:', { error: error.message });
    res.status(500).json({ error: 'Failed to test agent' });
  }
});

module.exports = router;
