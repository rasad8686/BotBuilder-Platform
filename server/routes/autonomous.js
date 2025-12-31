/**
 * Autonomous Agents API Routes
 * Handles agent management and task execution
 */

const express = require('express');
const router = express.Router();
const AgentCore = require('../services/autonomous/AgentCore');
const TaskExecutor = require('../services/autonomous/TaskExecutor');
const toolRegistry = require('../services/autonomous/ToolRegistry');
const AgentOrchestrator = require('../services/autonomous/AgentOrchestrator');
const AgentMemory = require('../services/autonomous/AgentMemory');
const AgentScheduler = require('../services/autonomous/AgentScheduler');
const AgentAnalytics = require('../services/autonomous/AgentAnalytics');
const AgentTemplates = require('../services/autonomous/AgentTemplates');
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

// ==========================================
// TEMPLATES ROUTES
// ==========================================

/**
 * GET /api/autonomous/templates
 * Get all available agent templates
 */
router.get('/templates', async (req, res) => {
  try {
    const { category, search } = req.query;

    let templates;
    if (search) {
      templates = AgentTemplates.search(search);
    } else if (category) {
      templates = AgentTemplates.getByCategory(category);
    } else {
      templates = AgentTemplates.getAll();
    }

    res.json({
      success: true,
      templates,
      count: templates.length,
      categories: AgentTemplates.getCategories()
    });
  } catch (error) {
    log.error('Error fetching templates', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * GET /api/autonomous/templates/:id
 * Get a specific template
 */
router.get('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = AgentTemplates.getById(id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      success: true,
      template
    });
  } catch (error) {
    log.error('Error fetching template', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

/**
 * POST /api/autonomous/templates/:id/create
 * Create an agent from a template
 */
router.post('/templates/:id/create', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const customizations = req.body;

    const agentConfig = AgentTemplates.createAgentConfig(id, customizations);

    const agent = await AgentCore.create(userId, agentConfig);

    res.status(201).json({
      success: true,
      agent,
      message: 'Agent created from template'
    });
  } catch (error) {
    log.error('Error creating agent from template', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to create agent' });
  }
});

/**
 * GET /api/autonomous/templates/workflows
 * Get workflow templates
 */
router.get('/templates/workflows', async (req, res) => {
  try {
    const workflows = AgentTemplates.getWorkflowTemplates();

    res.json({
      success: true,
      workflows,
      count: workflows.length
    });
  } catch (error) {
    log.error('Error fetching workflow templates', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch workflow templates' });
  }
});

// ==========================================
// SCHEDULING ROUTES
// ==========================================

/**
 * POST /api/autonomous/schedules
 * Create a new schedule
 */
router.post('/schedules', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      agentId,
      taskDescription,
      inputData,
      scheduleType,
      scheduleConfig,
      priority,
      tags
    } = req.body;

    if (!agentId || !taskDescription) {
      return res.status(400).json({ error: 'agentId and taskDescription are required' });
    }

    // Validate agent ownership
    const isOwner = await AgentCore.validateOwnership(agentId, userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const scheduler = AgentScheduler.instance;
    const schedule = await scheduler.createSchedule({
      agentId,
      userId,
      taskDescription,
      inputData,
      scheduleType,
      scheduleConfig,
      priority,
      tags
    });

    res.status(201).json({
      success: true,
      schedule
    });
  } catch (error) {
    log.error('Error creating schedule', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to create schedule' });
  }
});

/**
 * GET /api/autonomous/schedules
 * Get all schedules for user
 */
router.get('/schedules', async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit, offset } = req.query;

    const scheduler = AgentScheduler.instance;
    const schedules = await scheduler.getUserSchedules(userId, {
      status,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    });

    res.json({
      success: true,
      schedules,
      count: schedules.length
    });
  } catch (error) {
    log.error('Error fetching schedules', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

/**
 * GET /api/autonomous/schedules/upcoming
 * Get upcoming scheduled tasks
 */
router.get('/schedules/upcoming', async (req, res) => {
  try {
    const { limit } = req.query;

    const scheduler = AgentScheduler.instance;
    const upcoming = await scheduler.getUpcoming(limit ? parseInt(limit) : 10);

    res.json({
      success: true,
      schedules: upcoming,
      count: upcoming.length
    });
  } catch (error) {
    log.error('Error fetching upcoming schedules', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch upcoming schedules' });
  }
});

/**
 * POST /api/autonomous/schedules/:id/trigger
 * Manually trigger a schedule
 */
router.post('/schedules/:id/trigger', async (req, res) => {
  try {
    const { id } = req.params;
    const additionalInput = req.body;

    const scheduler = AgentScheduler.instance;
    await scheduler.trigger(parseInt(id), additionalInput);

    res.json({
      success: true,
      message: 'Schedule triggered'
    });
  } catch (error) {
    log.error('Error triggering schedule', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to trigger schedule' });
  }
});

/**
 * PUT /api/autonomous/schedules/:id/pause
 * Pause a schedule
 */
router.put('/schedules/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;

    const scheduler = AgentScheduler.instance;
    await scheduler.pauseSchedule(parseInt(id));

    res.json({
      success: true,
      message: 'Schedule paused'
    });
  } catch (error) {
    log.error('Error pausing schedule', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to pause schedule' });
  }
});

/**
 * PUT /api/autonomous/schedules/:id/resume
 * Resume a paused schedule
 */
router.put('/schedules/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;

    const scheduler = AgentScheduler.instance;
    await scheduler.resumeSchedule(parseInt(id));

    res.json({
      success: true,
      message: 'Schedule resumed'
    });
  } catch (error) {
    log.error('Error resuming schedule', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to resume schedule' });
  }
});

/**
 * DELETE /api/autonomous/schedules/:id
 * Delete a schedule
 */
router.delete('/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const scheduler = AgentScheduler.instance;
    await scheduler.deleteSchedule(parseInt(id));

    res.json({
      success: true,
      message: 'Schedule deleted'
    });
  } catch (error) {
    log.error('Error deleting schedule', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to delete schedule' });
  }
});

// ==========================================
// ANALYTICS ROUTES
// ==========================================

/**
 * GET /api/autonomous/agents/:id/analytics
 * Get analytics for an agent
 */
router.get('/agents/:id/analytics', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { days } = req.query;

    // Validate agent ownership
    const isOwner = await AgentCore.validateOwnership(parseInt(id), userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const analytics = AgentAnalytics.instance;
    const [performance, trends, tools, errors, alerts] = await Promise.all([
      analytics.getAgentPerformance(parseInt(id), { days: days ? parseInt(days) : 30 }),
      analytics.getExecutionTrends(parseInt(id), { days: days ? parseInt(days) : 30 }),
      analytics.getToolStats(parseInt(id), { days: days ? parseInt(days) : 30 }),
      analytics.getErrorAnalysis(parseInt(id), { days: days ? parseInt(days) : 30 }),
      analytics.getAlerts(parseInt(id))
    ]);

    res.json({
      success: true,
      analytics: {
        performance,
        trends,
        tools,
        errors,
        alerts
      }
    });
  } catch (error) {
    log.error('Error fetching analytics', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/autonomous/agents/:id/analytics/report
 * Generate a comprehensive analytics report
 */
router.get('/agents/:id/analytics/report', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { days } = req.query;

    // Validate agent ownership
    const isOwner = await AgentCore.validateOwnership(parseInt(id), userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const analytics = AgentAnalytics.instance;
    const report = await analytics.generateReport(parseInt(id), {
      days: days ? parseInt(days) : 30
    });

    res.json({
      success: true,
      report
    });
  } catch (error) {
    log.error('Error generating report', { error: error.message });
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * GET /api/autonomous/agents/:id/analytics/realtime
 * Get real-time metrics
 */
router.get('/agents/:id/analytics/realtime', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate agent ownership
    const isOwner = await AgentCore.validateOwnership(parseInt(id), userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const analytics = AgentAnalytics.instance;
    const metrics = await analytics.getRealTimeMetrics(parseInt(id));

    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    log.error('Error fetching realtime metrics', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch realtime metrics' });
  }
});

/**
 * GET /api/autonomous/agents/:id/suggestions
 * Get optimization suggestions
 */
router.get('/agents/:id/suggestions', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate agent ownership
    const isOwner = await AgentCore.validateOwnership(parseInt(id), userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const analytics = AgentAnalytics.instance;
    const suggestions = await analytics.getSuggestions(parseInt(id));

    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    log.error('Error fetching suggestions', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// ==========================================
// MEMORY ROUTES
// ==========================================

/**
 * GET /api/autonomous/agents/:id/memory
 * Get agent memory stats and recent memories
 */
router.get('/agents/:id/memory', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate agent ownership
    const isOwner = await AgentCore.validateOwnership(parseInt(id), userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const memory = new AgentMemory(parseInt(id));
    const [stats, recent] = await Promise.all([
      memory.getStats(),
      memory.retrieve(null, { limit: 20 })
    ]);

    res.json({
      success: true,
      stats,
      recent
    });
  } catch (error) {
    log.error('Error fetching memory', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch memory' });
  }
});

/**
 * POST /api/autonomous/agents/:id/memory
 * Store a new memory
 */
router.post('/agents/:id/memory', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { content, type, importance, tags, metadata } = req.body;

    // Validate agent ownership
    const isOwner = await AgentCore.validateOwnership(parseInt(id), userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const memory = new AgentMemory(parseInt(id));
    const stored = await memory.store(content, { type, importance, tags, metadata });

    res.status(201).json({
      success: true,
      memory: stored
    });
  } catch (error) {
    log.error('Error storing memory', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to store memory' });
  }
});

/**
 * GET /api/autonomous/agents/:id/memory/search
 * Search agent memories
 */
router.get('/agents/:id/memory/search', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { query, type, limit, tags } = req.query;

    // Validate agent ownership
    const isOwner = await AgentCore.validateOwnership(parseInt(id), userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const memory = new AgentMemory(parseInt(id));
    const memories = await memory.retrieve(query, {
      type,
      limit: limit ? parseInt(limit) : 20,
      tags: tags ? tags.split(',') : []
    });

    res.json({
      success: true,
      memories,
      count: memories.length
    });
  } catch (error) {
    log.error('Error searching memories', { error: error.message });
    res.status(500).json({ error: 'Failed to search memories' });
  }
});

/**
 * POST /api/autonomous/agents/:id/memory/consolidate
 * Trigger memory consolidation
 */
router.post('/agents/:id/memory/consolidate', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate agent ownership
    const isOwner = await AgentCore.validateOwnership(parseInt(id), userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const memory = new AgentMemory(parseInt(id));
    await memory.loadShortTermMemory();
    const consolidated = await memory.consolidate();

    res.json({
      success: true,
      consolidated,
      message: `Consolidated ${consolidated} memories to long-term storage`
    });
  } catch (error) {
    log.error('Error consolidating memory', { error: error.message });
    res.status(500).json({ error: 'Failed to consolidate memory' });
  }
});

// ==========================================
// WORKFLOW ROUTES
// ==========================================

/**
 * POST /api/autonomous/workflows
 * Create a new workflow
 */
router.post('/workflows', async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, agents, steps, settings } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Workflow name is required' });
    }

    const orchestrator = new AgentOrchestrator(userId);
    const workflow = await orchestrator.createWorkflow({
      name,
      description,
      agents,
      steps,
      settings
    });

    res.status(201).json({
      success: true,
      workflow
    });
  } catch (error) {
    log.error('Error creating workflow', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to create workflow' });
  }
});

/**
 * GET /api/autonomous/workflows
 * Get all workflows for user
 */
router.get('/workflows', async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit, offset } = req.query;

    const orchestrator = new AgentOrchestrator(userId);
    const workflows = await orchestrator.getWorkflows({
      status,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    });

    res.json({
      success: true,
      workflows,
      count: workflows.length
    });
  } catch (error) {
    log.error('Error fetching workflows', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

/**
 * GET /api/autonomous/workflows/:id
 * Get workflow by ID
 */
router.get('/workflows/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const orchestrator = new AgentOrchestrator(userId);
    const workflow = await orchestrator.getWorkflow(parseInt(id));

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json({
      success: true,
      workflow
    });
  } catch (error) {
    log.error('Error fetching workflow', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

/**
 * POST /api/autonomous/workflows/:id/execute
 * Execute a workflow
 */
router.post('/workflows/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const inputData = req.body;

    const orchestrator = new AgentOrchestrator(userId);

    // Start execution in background
    orchestrator.executeWorkflow(parseInt(id), inputData)
      .then(result => {
        log.info('Workflow execution completed', { workflowId: id, result });
      })
      .catch(err => {
        log.error('Workflow execution failed', { workflowId: id, error: err.message });
      });

    res.json({
      success: true,
      message: 'Workflow execution started',
      workflowId: parseInt(id)
    });
  } catch (error) {
    log.error('Error executing workflow', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to execute workflow' });
  }
});

/**
 * DELETE /api/autonomous/workflows/:id
 * Delete a workflow
 */
router.delete('/workflows/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const orchestrator = new AgentOrchestrator(userId);
    await orchestrator.deleteWorkflow(parseInt(id));

    res.json({
      success: true,
      message: 'Workflow deleted'
    });
  } catch (error) {
    log.error('Error deleting workflow', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to delete workflow' });
  }
});

/**
 * GET /api/autonomous/agents/:id/logs
 * Get execution logs for an agent
 */
router.get('/agents/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { limit, offset } = req.query;

    // Validate agent ownership
    const isOwner = await AgentCore.validateOwnership(parseInt(id), userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const tasks = await TaskExecutor.getTasksByAgent(parseInt(id), {
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0
    });

    // Get steps for recent tasks
    const logsPromises = tasks.slice(0, 10).map(async (task) => {
      const steps = await TaskExecutor.getTaskSteps(task.id);
      return {
        task,
        steps
      };
    });

    const logs = await Promise.all(logsPromises);

    res.json({
      success: true,
      logs,
      taskCount: tasks.length
    });
  } catch (error) {
    log.error('Error fetching logs', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

module.exports = router;
