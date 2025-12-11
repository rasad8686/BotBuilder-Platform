/**
 * Autonomous Agents API Routes
 * Handles agent management and task execution
 */

const express = require('express');
const router = express.Router();
const AgentCore = require('../services/autonomous/AgentCore');
const TaskExecutor = require('../services/autonomous/TaskExecutor');
const toolRegistry = require('../services/autonomous/ToolRegistry');
const authMiddleware = require('../middleware/auth');
const log = require('../utils/logger');

// All routes require authentication
router.use(authMiddleware);

// ==========================================
// AGENT CRUD ROUTES
// ==========================================

/**
 * POST /api/autonomous/agents
 * Create a new autonomous agent
 */
router.post('/agents', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      description,
      capabilities,
      model,
      temperature,
      max_tokens,
      system_prompt,
      settings
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Agent name is required' });
    }

    const agent = await AgentCore.create(userId, {
      name,
      description,
      capabilities,
      model,
      temperature,
      max_tokens,
      system_prompt,
      settings
    });

    res.status(201).json({
      success: true,
      agent
    });
  } catch (error) {
    log.error('Error creating agent', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to create agent' });
  }
});

/**
 * GET /api/autonomous/agents
 * Get all agents for current user
 */
router.get('/agents', async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit, offset } = req.query;

    const agents = await AgentCore.findByUser(userId, {
      status,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    });

    res.json({
      success: true,
      agents,
      count: agents.length
    });
  } catch (error) {
    log.error('Error fetching agents', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

/**
 * GET /api/autonomous/agents/:id
 * Get agent by ID
 */
router.get('/agents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const agent = await AgentCore.findById(parseInt(id));

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get agent stats
    const stats = await AgentCore.getStats(parseInt(id));

    res.json({
      success: true,
      agent: {
        ...agent,
        stats
      }
    });
  } catch (error) {
    log.error('Error fetching agent', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

/**
 * PUT /api/autonomous/agents/:id
 * Update an agent
 */
router.put('/agents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const agent = await AgentCore.update(parseInt(id), userId, req.body);

    res.json({
      success: true,
      agent
    });
  } catch (error) {
    log.error('Error updating agent', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to update agent' });
  }
});

/**
 * DELETE /api/autonomous/agents/:id
 * Delete an agent
 */
router.delete('/agents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await AgentCore.delete(parseInt(id), userId);

    res.json({
      success: true,
      message: 'Agent deleted successfully'
    });
  } catch (error) {
    log.error('Error deleting agent', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to delete agent' });
  }
});

// ==========================================
// TASK ROUTES
// ==========================================

/**
 * POST /api/autonomous/agents/:id/tasks
 * Create and execute a task for an agent
 */
router.post('/agents/:id/tasks', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { task_description, input_data, execute_now = true } = req.body;

    if (!task_description) {
      return res.status(400).json({ error: 'Task description is required' });
    }

    // Validate agent ownership
    const agent = await AgentCore.findById(parseInt(id));

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create task
    const task = await TaskExecutor.createTask(parseInt(id), task_description, input_data);

    // Execute task if requested
    if (execute_now) {
      // Execute asynchronously
      const executor = new TaskExecutor(agent);

      // Start execution in background
      executor.execute(task.id).catch(err => {
        log.error('Background task execution failed', { taskId: task.id, error: err.message });
      });

      res.status(201).json({
        success: true,
        task: {
          ...task,
          status: 'running'
        },
        message: 'Task created and execution started'
      });
    } else {
      res.status(201).json({
        success: true,
        task,
        message: 'Task created (not executed)'
      });
    }
  } catch (error) {
    log.error('Error creating task', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to create task' });
  }
});

/**
 * GET /api/autonomous/agents/:id/tasks
 * Get all tasks for an agent
 */
router.get('/agents/:id/tasks', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { status, limit, offset } = req.query;

    // Validate agent ownership
    const isOwner = await AgentCore.validateOwnership(parseInt(id), userId);

    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const tasks = await TaskExecutor.getTasksByAgent(parseInt(id), {
      status,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    });

    res.json({
      success: true,
      tasks,
      count: tasks.length
    });
  } catch (error) {
    log.error('Error fetching tasks', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * GET /api/autonomous/tasks/:id
 * Get task details
 */
router.get('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const task = await TaskExecutor.getTask(parseInt(id));

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Validate agent ownership
    const isOwner = await AgentCore.validateOwnership(task.agent_id, userId);

    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      success: true,
      task
    });
  } catch (error) {
    log.error('Error fetching task', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

/**
 * GET /api/autonomous/tasks/:id/steps
 * Get execution steps for a task
 */
router.get('/tasks/:id/steps', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const task = await TaskExecutor.getTask(parseInt(id));

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Validate agent ownership
    const isOwner = await AgentCore.validateOwnership(task.agent_id, userId);

    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const steps = await TaskExecutor.getTaskSteps(parseInt(id));

    res.json({
      success: true,
      task_id: task.id,
      task_status: task.status,
      steps,
      count: steps.length
    });
  } catch (error) {
    log.error('Error fetching task steps', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch task steps' });
  }
});

/**
 * POST /api/autonomous/tasks/:id/execute
 * Execute a pending task
 */
router.post('/tasks/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const task = await TaskExecutor.getTask(parseInt(id));

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Validate agent ownership
    const agent = await AgentCore.findById(task.agent_id);

    if (!agent || agent.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (task.status !== 'pending') {
      return res.status(400).json({ error: `Task cannot be executed. Current status: ${task.status}` });
    }

    // Execute task in background
    const executor = new TaskExecutor(agent);

    executor.execute(task.id).catch(err => {
      log.error('Task execution failed', { taskId: task.id, error: err.message });
    });

    res.json({
      success: true,
      message: 'Task execution started',
      task_id: task.id
    });
  } catch (error) {
    log.error('Error executing task', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to execute task' });
  }
});

// ==========================================
// TOOLS ROUTES
// ==========================================

/**
 * GET /api/autonomous/tools
 * Get available tools
 */
router.get('/tools', async (req, res) => {
  try {
    const tools = toolRegistry.getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));

    res.json({
      success: true,
      tools,
      count: tools.length
    });
  } catch (error) {
    log.error('Error fetching tools', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
});

module.exports = router;
