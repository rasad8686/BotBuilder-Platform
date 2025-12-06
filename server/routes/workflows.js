/**
 * Workflows API Routes
 */

const express = require('express');
const router = express.Router();
const AgentWorkflow = require('../models/AgentWorkflow');
const WorkflowExecution = require('../models/WorkflowExecution');
const AgentModel = require('../models/Agent');
const { AgentOrchestrator, Agent } = require('../agents');
const authenticateToken = require('../middleware/auth');
const { getExecutionSocket } = require('../websocket');
const log = require('../utils/logger');

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/workflows - Create new workflow
 */
router.post('/', async (req, res) => {
  try {
    const {
      bot_id,
      name,
      workflow_type,
      agents_config,
      flow_config,
      entry_agent_id,
      is_default
    } = req.body;

    if (!bot_id || !name) {
      return res.status(400).json({
        error: 'bot_id and name are required'
      });
    }

    const workflow = await AgentWorkflow.create({
      bot_id,
      name,
      workflow_type,
      agents_config,
      flow_config,
      entry_agent_id,
      is_default
    });

    res.status(201).json(workflow);
  } catch (error) {
    log.error('Error creating workflow', { error: error.message });
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

/**
 * GET /api/workflows - List all workflows (with optional bot_id filter)
 */
router.get('/', async (req, res) => {
  try {
    const { bot_id } = req.query;

    if (!bot_id) {
      return res.json([]);
    }

    const workflows = await AgentWorkflow.findByBotId(bot_id);
    res.json(workflows);
  } catch (error) {
    log.error('Error fetching workflows', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

/**
 * GET /api/workflows/bot/:botId - List workflows for a bot
 */
router.get('/bot/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const workflows = await AgentWorkflow.findByBotId(botId);
    res.json(workflows);
  } catch (error) {
    log.error('Error fetching workflows', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

/**
 * GET /api/workflows/:id - Get single workflow
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const workflow = await AgentWorkflow.findById(id);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json(workflow);
  } catch (error) {
    log.error('Error fetching workflow', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

/**
 * PUT /api/workflows/:id - Update workflow
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await AgentWorkflow.findById(id);

    if (!existing) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const workflow = await AgentWorkflow.update(id, req.body);
    res.json(workflow);
  } catch (error) {
    log.error('Error updating workflow', { error: error.message });
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

/**
 * DELETE /api/workflows/:id - Delete workflow
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await AgentWorkflow.findById(id);

    if (!existing) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    await AgentWorkflow.delete(id);
    res.json({ message: 'Workflow deleted successfully' });
  } catch (error) {
    log.error('Error deleting workflow', { error: error.message });
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

/**
 * POST /api/workflows/:id/execute - Execute workflow with input
 */
router.post('/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;
    const { input } = req.body;

    log.info('Starting workflow execution', { workflowId: id, input });

    if (!input) {
      return res.status(400).json({ error: 'input is required' });
    }

    const workflow = await AgentWorkflow.findById(id);
    log.debug('Workflow lookup result', { workflowId: id, found: !!workflow, name: workflow?.name });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Create execution record
    const execution = await WorkflowExecution.create({
      workflow_id: id,
      bot_id: workflow.bot_id,
      status: 'running',
      input
    });

    // Get WebSocket for real-time updates
    const executionSocket = getExecutionSocket();
    log.debug('ExecutionSocket status', { available: !!executionSocket });

    // Load agents for the workflow
    const orchestrator = new AgentOrchestrator();
    const agentConfigs = workflow.agents_config || [];
    const loadedAgents = [];

    for (const config of agentConfigs) {
      const agentData = await AgentModel.findById(config.agentId || config.id);
      if (agentData) {
        orchestrator.loadAgent({
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
        loadedAgents.push(agentData);
      }
    }

    // Send execution start event
    if (executionSocket) {
      executionSocket.emitExecutionStart(execution.id, {
        workflowId: workflow.id,
        workflowName: workflow.name,
        input
      });
    }

    // Execute workflow with WebSocket updates
    const executeWithUpdates = async () => {
      const startTime = Date.now();
      let stepOrder = 0;
      const results = [];
      let totalTokens = 0;

      // Helper function for delay
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      // If no agents loaded, simulate demo execution with steps
      if (loadedAgents.length === 0) {
        log.debug('Running demo execution', { executionId: execution.id });

        // Demo step 1: Start node
        const step1Id = `step-${Date.now()}-0`;
        log.debug('Emitting step start', { stepId: step1Id });
        if (executionSocket) {
          executionSocket.emitStepStart(execution.id, {
            stepId: step1Id,
            agentId: 'start',
            agentName: 'Start',
            agentRole: 'trigger',
            input: input,
            order: 0
          });
        }
        await delay(500);

        if (executionSocket) {
          executionSocket.emitStepComplete(execution.id, {
            stepId: step1Id,
            agentId: 'start',
            agentName: 'Start',
            output: `Workflow started with: ${JSON.stringify(input)}`,
            duration: 500,
            tokens: 0,
            cost: 0
          });

          executionSocket.emitAgentMessage(execution.id, {
            messageId: `msg-${Date.now()}`,
            fromAgent: 'Start',
            toAgent: 'System',
            messageType: 'trigger',
            content: `Input received: ${JSON.stringify(input)}`
          });
        }

        await delay(300);

        // Demo step 2: Processing
        const step2Id = `step-${Date.now()}-1`;
        if (executionSocket) {
          executionSocket.emitStepStart(execution.id, {
            stepId: step2Id,
            agentId: 'processor',
            agentName: 'Processor',
            agentRole: 'processor',
            input: input,
            order: 1
          });
        }
        await delay(800);

        const demoOutput = `Workflow "${workflow.name}" processed: ${input.message || JSON.stringify(input)}`;
        if (executionSocket) {
          executionSocket.emitStepComplete(execution.id, {
            stepId: step2Id,
            agentId: 'processor',
            agentName: 'Processor',
            output: demoOutput,
            duration: 800,
            tokens: 150,
            cost: 0.0015
          });

          executionSocket.emitAgentMessage(execution.id, {
            messageId: `msg-${Date.now()}`,
            fromAgent: 'Processor',
            toAgent: 'End',
            messageType: 'response',
            content: demoOutput
          });
        }

        await delay(300);

        const totalDuration = Date.now() - startTime;

        // Emit execution complete
        log.debug('Emitting execution complete', { executionId: execution.id });
        if (executionSocket) {
          executionSocket.emitExecutionComplete(execution.id, {
            output: demoOutput,
            totalDuration,
            totalTokens: 150,
            totalCost: 0.0015,
            agentBreakdown: [
              { agentName: 'Start', duration: 500, tokens: 0 },
              { agentName: 'Processor', duration: 800, tokens: 150 }
            ]
          });
        }

        log.info('Demo execution completed successfully');
        return {
          status: 'completed',
          output: demoOutput,
          totalTokens: 150,
          totalDuration,
          steps: [
            { stepId: step1Id, agentName: 'Start', duration: 500, tokens: 0 },
            { stepId: step2Id, agentName: 'Processor', duration: 800, tokens: 150 }
          ]
        };
      }

      for (const agentData of loadedAgents) {
        const stepId = `step-${Date.now()}-${stepOrder}`;
        const stepStartTime = Date.now();

        // Emit step start
        if (executionSocket) {
          executionSocket.emitStepStart(execution.id, {
            stepId,
            agentId: agentData.id,
            agentName: agentData.name,
            agentRole: agentData.role,
            input: stepOrder === 0 ? input : results[results.length - 1]?.output,
            order: stepOrder
          });
        }

        try {
          // Get agent and execute
          const agent = orchestrator.getAgent(agentData.id);
          const stepInput = stepOrder === 0 ? input : results[results.length - 1]?.output;

          // Simulate agent execution (replace with actual agent.execute when available)
          const stepResult = {
            success: true,
            output: `Agent ${agentData.name} processed: ${JSON.stringify(stepInput)}`,
            tokensUsed: Math.floor(Math.random() * 500) + 100
          };

          const stepDuration = Date.now() - stepStartTime;
          totalTokens += stepResult.tokensUsed || 0;

          results.push({
            stepId,
            agentId: agentData.id,
            agentName: agentData.name,
            output: stepResult.output,
            duration: stepDuration,
            tokens: stepResult.tokensUsed
          });

          // Emit step complete
          if (executionSocket) {
            executionSocket.emitStepComplete(execution.id, {
              stepId,
              agentId: agentData.id,
              agentName: agentData.name,
              output: stepResult.output,
              duration: stepDuration,
              tokens: stepResult.tokensUsed,
              cost: (stepResult.tokensUsed || 0) * 0.00001
            });

            // Emit agent message
            executionSocket.emitAgentMessage(execution.id, {
              messageId: `msg-${Date.now()}`,
              fromAgent: agentData.name,
              toAgent: loadedAgents[stepOrder + 1]?.name || 'System',
              messageType: 'response',
              content: stepResult.output
            });
          }

          stepOrder++;
        } catch (stepError) {
          const stepDuration = Date.now() - stepStartTime;

          // Emit step failed
          if (executionSocket) {
            executionSocket.emitStepFailed(execution.id, {
              stepId,
              agentId: agentData.id,
              agentName: agentData.name,
              error: stepError.message,
              duration: stepDuration
            });
          }

          throw stepError;
        }
      }

      const totalDuration = Date.now() - startTime;
      const finalOutput = results[results.length - 1]?.output || 'Workflow completed';

      // Emit execution complete
      if (executionSocket) {
        executionSocket.emitExecutionComplete(execution.id, {
          output: finalOutput,
          totalDuration,
          totalTokens,
          totalCost: totalTokens * 0.00001,
          agentBreakdown: results.map(r => ({
            agentName: r.agentName,
            duration: r.duration,
            tokens: r.tokens
          }))
        });
      }

      return {
        status: 'completed',
        output: finalOutput,
        totalTokens,
        totalDuration,
        steps: results
      };
    };

    // Store execution function for later triggering
    global.pendingExecutions = global.pendingExecutions || new Map();
    global.pendingExecutions.set(execution.id, {
      executeWithUpdates,
      execution,
      workflow
    });

    // Return immediately - execution will start when client sends ready signal
    log.debug('Execution pending', { executionId: execution.id });

    res.json({
      executionId: execution.id,
      status: 'pending'
    });
  } catch (error) {
    log.error('Error executing workflow', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    // Emit error event
    const executionSocket = getExecutionSocket();
    if (executionSocket && req.params.id) {
      executionSocket.emitExecutionError(req.params.id, {
        error: error.message
      });
    }

    res.status(500).json({ error: 'Failed to execute workflow', details: error.message });
  }
});

/**
 * POST /api/workflows/:workflowId/executions/:executionId/ready - Client ready to receive events
 */
router.post('/:workflowId/executions/:executionId/ready', async (req, res) => {
  const { executionId } = req.params;
  const execId = parseInt(executionId);

  log.info('Client ready for execution', { executionId: execId });

  const pending = global.pendingExecutions?.get(execId);
  if (!pending) {
    return res.status(404).json({ error: 'Execution not found or already started' });
  }

  // Remove from pending
  global.pendingExecutions.delete(execId);

  const { executeWithUpdates, execution } = pending;

  // Execute now that client is ready
  try {
    const result = await executeWithUpdates();

    // Update execution record
    if (result.status === 'completed') {
      await WorkflowExecution.complete(
        execution.id,
        result.output,
        result.totalTokens,
        result.totalDuration
      );
    } else {
      await WorkflowExecution.fail(
        execution.id,
        result.error,
        result.totalDuration
      );
    }

    res.json({
      executionId: execution.id,
      ...result
    });
  } catch (error) {
    log.error('Error executing workflow', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    // Emit error event
    const executionSocket = getExecutionSocket();
    if (executionSocket && req.params.id) {
      executionSocket.emitExecutionError(req.params.id, {
        error: error.message
      });
    }

    res.status(500).json({ error: 'Failed to execute workflow', details: error.message });
  }
});

/**
 * GET /api/workflows/:id/executions - Get execution history
 */
router.get('/:id/executions', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    const workflow = await AgentWorkflow.findById(id);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const executions = await WorkflowExecution.findByWorkflowId(id, parseInt(limit));
    res.json(executions);
  } catch (error) {
    log.error('Error fetching executions', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch executions' });
  }
});

module.exports = router;
