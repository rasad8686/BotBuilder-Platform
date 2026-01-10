/**
 * V2 Agents Routes
 * Professional API for autonomous agents
 */

const express = require('express');
const router = express.Router();
const { ErrorCodes } = require('../constants/errorCodes');
const { agentLinks, addLinks } = require('../utils/hateoas');
const { processCursorResults } = require('../utils/pagination');
const Joi = require('joi');
const validate = require('../middleware/validate');

// Get database connection
const getDb = () => require('../../db');

// Validation schemas
const listAgents = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    cursor: Joi.string().optional(),
    status: Joi.string().valid('active', 'inactive', 'running', 'completed', 'failed').optional(),
    botId: Joi.string().optional()
  })
};

const createAgent = {
  body: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    goal: Joi.string().min(1).max(2000).required(),
    botId: Joi.string().optional(),
    tools: Joi.array().items(Joi.string()).default([]),
    constraints: Joi.array().items(Joi.string()).default([]),
    maxIterations: Joi.number().integer().min(1).max(100).default(10),
    settings: Joi.object().optional()
  })
};

const agentIdParam = {
  params: Joi.object({
    id: Joi.string().required()
  })
};

/**
 * GET /api/v2/agents
 * List all agents
 */
router.get('/', validate(listAgents), async (req, res) => {
  try {
    const db = getDb();
    const { limit, cursor, status, botId } = req.query;

    let query = db('autonomous_agents').where('user_id', req.user.id);

    if (status) {
      query.where('status', status);
    }
    if (botId) {
      query.where('bot_id', botId);
    }

    if (cursor) {
      const decoded = req.pagination.decodeCursor(cursor);
      if (decoded) {
        query.where('id', '<', decoded.id);
      }
    }

    query.orderBy('created_at', 'desc').limit(limit + 1);

    const agents = await query;
    const { data, hasMore, nextCursor } = processCursorResults(agents, limit, 'id');

    const agentsWithLinks = data.map(agent => addLinks(formatAgent(agent), agentLinks));

    res.paginate(agentsWithLinks, { hasMore, nextCursor });
    res.success(agentsWithLinks);
  } catch (error) {
    console.error('V2 List agents error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * GET /api/v2/agents/:id
 * Get a single agent
 */
router.get('/:id', validate(agentIdParam), async (req, res) => {
  try {
    const db = getDb();
    const agent = await db('autonomous_agents')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();

    if (!agent) {
      return res.apiError(ErrorCodes.AGENT_NOT_FOUND);
    }

    const formattedAgent = addLinks(formatAgent(agent), agentLinks);
    res.success(formattedAgent);
  } catch (error) {
    console.error('V2 Get agent error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * POST /api/v2/agents
 * Create a new agent
 */
router.post('/', validate(createAgent), async (req, res) => {
  try {
    const db = getDb();
    const { name, goal, botId, tools, constraints, maxIterations, settings } = req.body;

    // Verify bot if provided
    if (botId) {
      const bot = await db('bots')
        .where({ id: botId, user_id: req.user.id })
        .first();
      if (!bot) {
        return res.apiError(ErrorCodes.BOT_NOT_FOUND);
      }
    }

    const [agent] = await db('autonomous_agents')
      .insert({
        user_id: req.user.id,
        bot_id: botId,
        name,
        goal,
        tools: JSON.stringify(tools),
        constraints: JSON.stringify(constraints),
        max_iterations: maxIterations,
        status: 'pending',
        settings: settings ? JSON.stringify(settings) : null,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    const formattedAgent = addLinks(formatAgent(agent), agentLinks);
    res.created(formattedAgent);
  } catch (error) {
    console.error('V2 Create agent error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * POST /api/v2/agents/:id/start
 * Start an agent
 */
router.post('/:id/start', validate(agentIdParam), async (req, res) => {
  try {
    const db = getDb();

    const agent = await db('autonomous_agents')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();

    if (!agent) {
      return res.apiError(ErrorCodes.AGENT_NOT_FOUND);
    }

    // Update status to running
    const [updatedAgent] = await db('autonomous_agents')
      .where({ id: req.params.id })
      .update({
        status: 'running',
        started_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    // TODO: Actually start the agent execution
    // This would integrate with existing autonomous agent service

    const formattedAgent = addLinks(formatAgent(updatedAgent), agentLinks);
    res.success(formattedAgent);
  } catch (error) {
    console.error('V2 Start agent error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * POST /api/v2/agents/:id/stop
 * Stop a running agent
 */
router.post('/:id/stop', validate(agentIdParam), async (req, res) => {
  try {
    const db = getDb();

    const [agent] = await db('autonomous_agents')
      .where({ id: req.params.id, user_id: req.user.id, status: 'running' })
      .update({
        status: 'stopped',
        completed_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    if (!agent) {
      return res.apiError(ErrorCodes.AGENT_NOT_FOUND);
    }

    const formattedAgent = addLinks(formatAgent(agent), agentLinks);
    res.success(formattedAgent);
  } catch (error) {
    console.error('V2 Stop agent error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * GET /api/v2/agents/:id/tasks
 * Get agent task history
 */
router.get('/:id/tasks', validate(agentIdParam), async (req, res) => {
  try {
    const db = getDb();
    const { limit = 50 } = req.query;

    const agent = await db('autonomous_agents')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();

    if (!agent) {
      return res.apiError(ErrorCodes.AGENT_NOT_FOUND);
    }

    const tasks = await db('agent_tasks')
      .where('agent_id', req.params.id)
      .orderBy('created_at', 'desc')
      .limit(limit);

    res.success(tasks.map(formatTask));
  } catch (error) {
    console.error('V2 Get agent tasks error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * DELETE /api/v2/agents/:id
 * Delete an agent
 */
router.delete('/:id', validate(agentIdParam), async (req, res) => {
  try {
    const db = getDb();

    const deleted = await db('autonomous_agents')
      .where({ id: req.params.id, user_id: req.user.id })
      .del();

    if (!deleted) {
      return res.apiError(ErrorCodes.AGENT_NOT_FOUND);
    }

    res.noContent();
  } catch (error) {
    console.error('V2 Delete agent error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * Format agent for API response
 */
function formatAgent(agent) {
  return {
    id: agent.id,
    name: agent.name,
    goal: agent.goal,
    botId: agent.bot_id,
    status: agent.status,
    tools: agent.tools ? JSON.parse(agent.tools) : [],
    constraints: agent.constraints ? JSON.parse(agent.constraints) : [],
    maxIterations: agent.max_iterations,
    currentIteration: agent.current_iteration,
    result: agent.result,
    error: agent.error,
    settings: agent.settings ? JSON.parse(agent.settings) : null,
    startedAt: agent.started_at,
    completedAt: agent.completed_at,
    createdAt: agent.created_at,
    updatedAt: agent.updated_at
  };
}

/**
 * Format task for API response
 */
function formatTask(task) {
  return {
    id: task.id,
    type: task.type,
    input: task.input ? JSON.parse(task.input) : null,
    output: task.output ? JSON.parse(task.output) : null,
    status: task.status,
    error: task.error,
    duration: task.duration,
    createdAt: task.created_at
  };
}

module.exports = router;
