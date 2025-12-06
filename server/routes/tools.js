/**
 * Tools API Routes - CRUD + Execute endpoints for Tool Calling system
 */

const express = require('express');
const router = express.Router();
const log = require('../utils/logger');
const Tool = require('../models/Tool');
const AgentTool = require('../models/AgentTool');
const ToolExecution = require('../models/ToolExecution');
const { toolRegistry, toolExecutor } = require('../tools/core');
const { createTool, getAvailableTypes, getToolSchemas, isValidType } = require('../tools/types');
const authenticateToken = require('../middleware/auth');
const db = require('../db');
const Ajv = require('ajv');

const ajv = new Ajv({ allErrors: true, strict: false });

// Rate limiting for tool execution
const executionRateLimit = new Map(); // toolId -> { count, resetTime }
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 executions per minute

/**
 * Check execution rate limit
 */
function checkRateLimit(toolId) {
  const now = Date.now();
  const limit = executionRateLimit.get(toolId);

  if (!limit || now > limit.resetTime) {
    executionRateLimit.set(toolId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (limit.count >= RATE_LIMIT_MAX) {
    return false;
  }

  limit.count++;
  return true;
}

/**
 * Verify bot ownership
 */
async function verifyBotOwnership(botId, userId) {
  const result = await db.query(
    `SELECT b.id FROM bots b
     JOIN organizations o ON b.organization_id = o.id
     JOIN organization_members om ON o.id = om.org_id
     WHERE b.id = $1 AND om.user_id = $2 AND om.status = 'active'`,
    [botId, userId]
  );
  return result.rows.length > 0;
}

/**
 * Verify tool ownership (via bot)
 */
async function verifyToolOwnership(toolId, userId) {
  const result = await db.query(
    `SELECT t.id FROM tools t
     JOIN bots b ON t.bot_id = b.id
     JOIN organizations o ON b.organization_id = o.id
     JOIN organization_members om ON o.id = om.org_id
     WHERE t.id = $1 AND om.user_id = $2 AND om.status = 'active'`,
    [toolId, userId]
  );
  return result.rows.length > 0;
}

// All routes require authentication
router.use(authenticateToken);

// ============================================
// TOOL TYPES
// ============================================

/**
 * GET /api/tools/types - Get available tool types with schemas
 */
router.get('/types', async (req, res) => {
  try {
    const types = getAvailableTypes();
    res.json(types);
  } catch (error) {
    log.error('Error fetching tool types', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch tool types' });
  }
});

/**
 * GET /api/tools/types/:type/schema - Get schema for specific type
 */
router.get('/types/:type/schema', async (req, res) => {
  try {
    const { type } = req.params;

    if (!isValidType(type)) {
      return res.status(404).json({ error: `Unknown tool type: ${type}` });
    }

    const schemas = getToolSchemas(type);
    res.json(schemas);
  } catch (error) {
    log.error('Error fetching tool schema', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch tool schema' });
  }
});

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * POST /api/tools - Create new tool
 */
router.post('/', async (req, res) => {
  try {
    const {
      bot_id,
      name,
      description,
      tool_type,
      configuration,
      input_schema,
      output_schema
    } = req.body;

    // Validation
    if (!bot_id || !name || !tool_type) {
      return res.status(400).json({
        error: 'bot_id, name, and tool_type are required'
      });
    }

    // Verify bot ownership
    const hasAccess = await verifyBotOwnership(bot_id, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this bot' });
    }

    // Validate tool type
    if (!isValidType(tool_type)) {
      return res.status(400).json({
        error: `Invalid tool type: ${tool_type}`,
        availableTypes: getAvailableTypes().map(t => t.type)
      });
    }

    // Create tool
    const tool = await Tool.create({
      bot_id,
      name,
      description,
      tool_type,
      configuration,
      input_schema,
      output_schema
    });

    res.status(201).json(tool);
  } catch (error) {
    log.error('Error creating tool', { error: error.message });
    res.status(500).json({ error: 'Failed to create tool' });
  }
});

/**
 * GET /api/tools/bot/:botId - List all tools for a bot
 */
router.get('/bot/:botId', async (req, res) => {
  try {
    const { botId } = req.params;

    // Verify bot ownership
    const hasAccess = await verifyBotOwnership(botId, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this bot' });
    }

    const tools = await Tool.findByBotId(botId);
    res.json(tools);
  } catch (error) {
    log.error('Error fetching tools', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
});

/**
 * GET /api/tools/:id - Get single tool
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Skip if id matches a route keyword
    if (['types', 'bot'].includes(id)) {
      return res.status(400).json({ error: 'Invalid tool ID' });
    }

    const tool = await Tool.findById(id);

    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    // Verify ownership
    const hasAccess = await verifyToolOwnership(id, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this tool' });
    }

    res.json(tool);
  } catch (error) {
    log.error('Error fetching tool', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch tool' });
  }
});

/**
 * PUT /api/tools/:id - Update tool
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await Tool.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    // Verify ownership
    const hasAccess = await verifyToolOwnership(id, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this tool' });
    }

    // Validate tool type if provided
    if (req.body.tool_type && !isValidType(req.body.tool_type)) {
      return res.status(400).json({
        error: `Invalid tool type: ${req.body.tool_type}`,
        availableTypes: getAvailableTypes().map(t => t.type)
      });
    }

    const tool = await Tool.update(id, req.body);
    res.json(tool);
  } catch (error) {
    log.error('Error updating tool', { error: error.message });
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

/**
 * DELETE /api/tools/:id - Delete tool
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await Tool.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    // Verify ownership
    const hasAccess = await verifyToolOwnership(id, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this tool' });
    }

    await Tool.delete(id);
    res.json({ message: 'Tool deleted successfully' });
  } catch (error) {
    log.error('Error deleting tool', { error: error.message });
    res.status(500).json({ error: 'Failed to delete tool' });
  }
});

// ============================================
// TOOL EXECUTION
// ============================================

/**
 * POST /api/tools/:id/execute - Execute tool with input
 */
router.post('/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;
    const { input, context = {} } = req.body;

    // Get tool
    const tool = await Tool.findById(id);
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    // Verify ownership
    const hasAccess = await verifyToolOwnership(id, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this tool' });
    }

    // Check if tool is active
    if (!tool.is_active) {
      return res.status(400).json({ error: 'Tool is not active' });
    }

    // Check rate limit
    if (!checkRateLimit(id)) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Maximum ${RATE_LIMIT_MAX} executions per minute`
      });
    }

    // Validate input against schema if provided
    if (tool.input_schema) {
      try {
        const validate = ajv.compile(tool.input_schema);
        if (!validate(input)) {
          return res.status(400).json({
            error: 'Input validation failed',
            details: validate.errors
          });
        }
      } catch (schemaError) {
        log.debug('Schema validation error', { error: schemaError.message });
      }
    }

    // Create tool instance
    const toolInstance = createTool(tool.tool_type, tool.configuration);

    // Execute tool
    const startTime = Date.now();
    let executionId;

    try {
      // Create execution record
      const execution = await ToolExecution.create({
        tool_id: id,
        agent_id: context.agentId || null,
        execution_id: context.executionId || null,
        input,
        status: 'running'
      });
      executionId = execution.id;

      // Execute
      const result = await toolInstance.execute(input, context);
      const durationMs = Date.now() - startTime;

      // Update execution record
      await ToolExecution.updateStatus(executionId, 'completed', {
        output: result,
        duration_ms: durationMs
      });

      res.json({
        success: true,
        execution_id: executionId,
        result,
        duration_ms: durationMs
      });
    } catch (execError) {
      const durationMs = Date.now() - startTime;

      // Update execution record with error
      if (executionId) {
        await ToolExecution.updateStatus(executionId, 'failed', {
          error: execError.message,
          duration_ms: durationMs
        });
      }

      // Check for timeout
      if (execError.message.includes('timeout')) {
        return res.status(408).json({
          error: 'Execution timeout',
          message: execError.message,
          execution_id: executionId
        });
      }

      // External service error
      if (execError.message.includes('fetch') || execError.message.includes('ECONNREFUSED')) {
        return res.status(502).json({
          error: 'External service error',
          message: execError.message,
          execution_id: executionId
        });
      }

      throw execError;
    }
  } catch (error) {
    log.error('Error executing tool', { error: error.message });
    res.status(500).json({
      error: 'Failed to execute tool',
      message: error.message
    });
  }
});

/**
 * POST /api/tools/:id/test - Test tool (dry run)
 */
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const { input } = req.body;

    // Get tool
    const tool = await Tool.findById(id);
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    // Verify ownership
    const hasAccess = await verifyToolOwnership(id, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this tool' });
    }

    // Validate configuration
    const configResult = { valid: true, errors: [] };

    // Validate input against schema
    let inputResult = { valid: true, errors: [] };
    if (tool.input_schema && input) {
      try {
        const validate = ajv.compile(tool.input_schema);
        if (!validate(input)) {
          inputResult = { valid: false, errors: validate.errors };
        }
      } catch (e) {
        inputResult = { valid: false, errors: [{ message: e.message }] };
      }
    }

    // Try to create tool instance
    let toolInstanceResult = { valid: true, errors: [] };
    try {
      createTool(tool.tool_type, tool.configuration);
    } catch (e) {
      toolInstanceResult = { valid: false, errors: [{ message: e.message }] };
    }

    res.json({
      tool_id: id,
      tool_type: tool.tool_type,
      validation: {
        configuration: configResult,
        input: inputResult,
        toolInstance: toolInstanceResult
      },
      ready: configResult.valid && inputResult.valid && toolInstanceResult.valid
    });
  } catch (error) {
    log.error('Error testing tool', { error: error.message });
    res.status(500).json({ error: 'Failed to test tool' });
  }
});

/**
 * GET /api/tools/:id/executions - Get execution history
 */
router.get('/:id/executions', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verify ownership
    const hasAccess = await verifyToolOwnership(id, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this tool' });
    }

    const executions = await ToolExecution.findByToolId(id, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Get stats
    const stats = await ToolExecution.getStatsByToolId(id);

    res.json({
      executions,
      stats,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    log.error('Error fetching executions', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch executions' });
  }
});

// ============================================
// AGENT-TOOL ASSIGNMENT
// ============================================

/**
 * POST /api/tools/:id/assign/:agentId - Assign tool to agent
 */
router.post('/:id/assign/:agentId', async (req, res) => {
  try {
    const { id, agentId } = req.params;
    const { is_enabled = true, priority = 0 } = req.body;

    // Verify tool ownership
    const hasToolAccess = await verifyToolOwnership(id, req.user.id);
    if (!hasToolAccess) {
      return res.status(403).json({ error: 'Access denied to this tool' });
    }

    // Verify agent exists and belongs to same bot
    const tool = await Tool.findById(id);
    const agentResult = await db.query(
      'SELECT id, bot_id FROM agents WHERE id = $1',
      [agentId]
    );

    if (agentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const agent = agentResult.rows[0];
    if (agent.bot_id !== tool.bot_id) {
      return res.status(400).json({ error: 'Tool and agent must belong to the same bot' });
    }

    // Create assignment
    const assignment = await AgentTool.create({
      agent_id: agentId,
      tool_id: id,
      is_enabled,
      priority
    });

    res.status(201).json(assignment);
  } catch (error) {
    log.error('Error assigning tool', { error: error.message });
    res.status(500).json({ error: 'Failed to assign tool' });
  }
});

/**
 * DELETE /api/tools/:id/unassign/:agentId - Remove tool from agent
 */
router.delete('/:id/unassign/:agentId', async (req, res) => {
  try {
    const { id, agentId } = req.params;

    // Verify tool ownership
    const hasToolAccess = await verifyToolOwnership(id, req.user.id);
    if (!hasToolAccess) {
      return res.status(403).json({ error: 'Access denied to this tool' });
    }

    await AgentTool.deleteByAgentAndTool(agentId, id);
    res.json({ message: 'Tool unassigned from agent successfully' });
  } catch (error) {
    log.error('Error unassigning tool', { error: error.message });
    res.status(500).json({ error: 'Failed to unassign tool' });
  }
});

/**
 * GET /api/tools/agent/:agentId - Get tools assigned to agent
 */
router.get('/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;

    // Verify agent access
    const agentResult = await db.query(
      `SELECT a.id, a.bot_id FROM agents a
       JOIN bots b ON a.bot_id = b.id
       JOIN organizations o ON b.organization_id = o.id
       JOIN organization_members om ON o.id = om.org_id
       WHERE a.id = $1 AND om.user_id = $2 AND om.status = 'active'`,
      [agentId, req.user.id]
    );

    if (agentResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this agent' });
    }

    const assignments = await AgentTool.findByAgentId(agentId);

    // Get full tool details for each assignment
    const toolsWithDetails = await Promise.all(
      assignments.map(async (assignment) => {
        const tool = await Tool.findById(assignment.tool_id);
        return {
          ...assignment,
          tool
        };
      })
    );

    res.json(toolsWithDetails);
  } catch (error) {
    log.error('Error fetching agent tools', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch agent tools' });
  }
});

module.exports = router;
