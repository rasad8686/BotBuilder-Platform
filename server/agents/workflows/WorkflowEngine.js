/**
 * WorkflowEngine - Main workflow execution engine
 */

const Agent = require('../core/Agent');
const AgentContext = require('../core/AgentContext');
const AgentRegistry = require('../core/AgentRegistry');
const AgentExecutor = require('../core/AgentExecutor');
const AgentModel = require('../../models/Agent');
const AgentWorkflow = require('../../models/AgentWorkflow');
const WorkflowExecution = require('../../models/WorkflowExecution');
const AgentExecutionStep = require('../../models/AgentExecutionStep');
const AgentMessage = require('../../models/AgentMessage');
const { getExecutionSocket } = require('../../websocket');
const log = require('../../utils/logger');

class WorkflowEngine {
  constructor() {
    this.registry = new AgentRegistry();
    this.executor = new AgentExecutor(this.registry);
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.executionSocket = null;
  }

  /**
   * Get execution socket instance
   */
  getSocket() {
    if (!this.executionSocket) {
      this.executionSocket = getExecutionSocket();
    }
    return this.executionSocket;
  }

  /**
   * Load workflow from database
   * @param {number} workflowId - Workflow ID
   * @returns {Promise<Object>} - Workflow configuration
   */
  async loadWorkflow(workflowId) {
    const workflow = await AgentWorkflow.findById(workflowId);

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Load agents for this workflow
    const agentsConfig = workflow.agents_config || [];

    for (const config of agentsConfig) {
      const agentId = config.agentId || config.id;
      const agentData = await AgentModel.findById(agentId);

      if (agentData) {
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

        this.registry.register(agent);
      }
    }

    return workflow;
  }

  /**
   * Execute a workflow
   * @param {number} workflowId - Workflow ID
   * @param {any} input - Input data
   * @param {number} botId - Bot ID
   * @returns {Promise<Object>} - Execution result
   */
  async execute(workflowId, input, botId) {
    const startTime = Date.now();

    // Load workflow
    const workflow = await this.loadWorkflow(workflowId);

    // Create execution record
    const execution = await WorkflowExecution.create({
      workflow_id: workflowId,
      bot_id: botId,
      status: 'running',
      input
    });

    // Create context
    const context = new AgentContext(execution.id);
    context.set('input', input);
    context.set('workflowId', workflowId);
    context.set('botId', botId);

    // Emit execution start event
    const socket = this.getSocket();
    if (socket) {
      socket.emitExecutionStart(execution.id, {
        workflowId,
        workflowName: workflow.name,
        input
      });
    }

    try {
      let result;

      switch (workflow.workflow_type) {
        case 'sequential':
          result = await this.executeSequential(workflow, input, context, execution.id);
          break;

        case 'parallel':
          result = await this.executeParallel(workflow, input, context, execution.id);
          break;

        case 'conditional':
          result = await this.executeConditional(workflow, input, context, execution.id);
          break;

        case 'mixed':
          result = await this.executeMixed(workflow, input, context, execution.id);
          break;

        default:
          result = await this.executeSequential(workflow, input, context, execution.id);
      }

      // Save successful execution
      const totalDuration = Date.now() - startTime;
      await this.saveExecution(execution.id, {
        status: 'completed',
        output: result.output,
        totalTokens: result.totalTokens,
        durationMs: totalDuration
      });

      // Emit execution complete event
      if (socket) {
        socket.emitExecutionComplete(execution.id, {
          output: result.output,
          totalDuration,
          totalTokens: result.totalTokens,
          totalCost: this.calculateCost(result.totalTokens),
          agentBreakdown: this.buildAgentBreakdown(result.steps)
        });
      }

      return {
        executionId: execution.id,
        status: 'completed',
        output: result.output,
        steps: result.steps,
        totalTokens: result.totalTokens,
        totalDuration
      };

    } catch (error) {
      // Save failed execution
      const totalDuration = Date.now() - startTime;
      await this.saveExecution(execution.id, {
        status: 'failed',
        error: error.message,
        durationMs: totalDuration
      });

      // Emit execution error event
      if (socket) {
        socket.emitExecutionError(execution.id, {
          error: error.message
        });
      }

      return {
        executionId: execution.id,
        status: 'failed',
        error: error.message,
        totalDuration
      };
    }
  }

  /**
   * Calculate cost based on tokens
   */
  calculateCost(tokens) {
    if (!tokens) return 0;
    // Approximate cost: $0.002 per 1K tokens
    return (tokens / 1000) * 0.002;
  }

  /**
   * Build agent breakdown from steps
   */
  buildAgentBreakdown(steps) {
    const breakdown = {};

    for (const step of steps) {
      if (!breakdown[step.agentId]) {
        breakdown[step.agentId] = {
          name: step.agentName,
          role: step.agentRole || 'agent',
          duration: 0,
          tokens: 0
        };
      }
      breakdown[step.agentId].duration += step.durationMs || 0;
      breakdown[step.agentId].tokens += step.tokensUsed || 0;
    }

    return Object.values(breakdown);
  }

  /**
   * Execute sequential workflow
   */
  async executeSequential(workflow, input, context, executionId) {
    const agentsConfig = workflow.agents_config || [];
    const steps = [];
    let currentInput = input;
    let totalTokens = 0;

    for (let i = 0; i < agentsConfig.length; i++) {
      const config = agentsConfig[i];
      const agentId = config.agentId || config.id;
      const agent = this.registry.get(agentId);

      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      const stepResult = await this.processStep(
        agent,
        currentInput,
        context,
        executionId,
        i
      );

      steps.push(stepResult);
      totalTokens += stepResult.tokensUsed || 0;

      if (!stepResult.success) {
        throw new Error(`Step ${i} failed: ${stepResult.error}`);
      }

      currentInput = stepResult.output;
    }

    return {
      output: steps[steps.length - 1]?.output,
      steps,
      totalTokens
    };
  }

  /**
   * Execute parallel workflow
   */
  async executeParallel(workflow, input, context, executionId) {
    const agentsConfig = workflow.agents_config || [];
    const steps = [];
    let totalTokens = 0;

    const executions = agentsConfig.map(async (config, index) => {
      const agentId = config.agentId || config.id;
      const agent = this.registry.get(agentId);

      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      return this.processStep(agent, input, context, executionId, index);
    });

    const results = await Promise.all(executions);

    for (const result of results) {
      steps.push(result);
      totalTokens += result.tokensUsed || 0;
    }

    // Combine outputs from all parallel agents
    const outputs = results.map(r => r.output);

    return {
      output: { parallelResults: outputs },
      steps,
      totalTokens
    };
  }

  /**
   * Execute conditional workflow
   */
  async executeConditional(workflow, input, context, executionId) {
    const flowConfig = workflow.flow_config || {};
    const routes = flowConfig.routes || [];
    const steps = [];
    let totalTokens = 0;
    let currentInput = input;
    let stepOrder = 0;

    // Start with entry agent
    let currentAgentId = workflow.entry_agent_id;

    while (currentAgentId) {
      const agent = this.registry.get(currentAgentId);

      if (!agent) {
        throw new Error(`Agent not found: ${currentAgentId}`);
      }

      const stepResult = await this.processStep(
        agent,
        currentInput,
        context,
        executionId,
        stepOrder++
      );

      steps.push(stepResult);
      totalTokens += stepResult.tokensUsed || 0;

      if (!stepResult.success) {
        throw new Error(`Conditional step failed: ${stepResult.error}`);
      }

      currentInput = stepResult.output;

      // Find next agent based on conditions
      currentAgentId = null;
      for (const route of routes) {
        if (route.fromAgentId === agent.id) {
          if (this.evaluateCondition(route.condition, stepResult.output)) {
            currentAgentId = route.targetAgentId;
            break;
          }
        }
      }
    }

    return {
      output: steps[steps.length - 1]?.output,
      steps,
      totalTokens
    };
  }

  /**
   * Execute mixed workflow (combination of sequential and parallel)
   */
  async executeMixed(workflow, input, context, executionId) {
    const flowConfig = workflow.flow_config || {};
    const stages = flowConfig.stages || [];
    const steps = [];
    let totalTokens = 0;
    let currentInput = input;
    let stepOrder = 0;

    for (const stage of stages) {
      if (stage.type === 'sequential') {
        for (const agentId of stage.agents) {
          const agent = this.registry.get(agentId);

          if (!agent) {
            throw new Error(`Agent not found: ${agentId}`);
          }

          const stepResult = await this.processStep(
            agent,
            currentInput,
            context,
            executionId,
            stepOrder++
          );

          steps.push(stepResult);
          totalTokens += stepResult.tokensUsed || 0;

          if (!stepResult.success) {
            throw new Error(`Mixed step failed: ${stepResult.error}`);
          }

          currentInput = stepResult.output;
        }
      } else if (stage.type === 'parallel') {
        const parallelExecutions = stage.agents.map(async (agentId) => {
          const agent = this.registry.get(agentId);

          if (!agent) {
            throw new Error(`Agent not found: ${agentId}`);
          }

          return this.processStep(agent, currentInput, context, executionId, stepOrder++);
        });

        const parallelResults = await Promise.all(parallelExecutions);

        for (const result of parallelResults) {
          steps.push(result);
          totalTokens += result.tokensUsed || 0;
        }

        // Merge parallel outputs
        currentInput = { parallelResults: parallelResults.map(r => r.output) };
      }
    }

    return {
      output: currentInput,
      steps,
      totalTokens
    };
  }

  /**
   * Process a single step with retry logic
   */
  async processStep(agent, input, context, executionId, stepOrder) {
    const stepStartTime = Date.now();
    const socket = this.getSocket();

    // Create step record
    const step = await AgentExecutionStep.create({
      execution_id: executionId,
      agent_id: agent.id,
      step_order: stepOrder,
      status: 'running',
      input
    });

    // Emit step start event
    if (socket) {
      socket.emitStepStart(executionId, {
        stepId: step.id,
        agentId: agent.id,
        agentName: agent.name,
        agentRole: agent.role,
        input,
        order: stepOrder
      });
    }

    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        context.setCurrentAgent(agent);
        const result = await agent.execute(input, context);

        if (result.success) {
          const stepDuration = Date.now() - stepStartTime;

          // Update step with success
          await AgentExecutionStep.complete(
            step.id,
            result.output,
            null,
            result.tokensUsed,
            stepDuration
          );

          // Store output in context
          context.addAgentOutput(agent.id, result.output);

          // Emit step complete event
          if (socket) {
            socket.emitStepComplete(executionId, {
              stepId: step.id,
              agentId: agent.id,
              agentName: agent.name,
              output: result.output,
              duration: stepDuration,
              tokens: result.tokensUsed,
              cost: this.calculateCost(result.tokensUsed)
            });
          }

          return {
            stepId: step.id,
            agentId: agent.id,
            agentName: agent.name,
            agentRole: agent.role,
            success: true,
            output: result.output,
            tokensUsed: result.tokensUsed,
            durationMs: stepDuration,
            attempt
          };
        }

        lastError = result.error;
      } catch (error) {
        lastError = error.message;
      }

      // Wait before retry
      if (attempt < this.maxRetries) {
        await this.delay(this.retryDelay * attempt);
      }
    }

    // All retries failed
    const stepDuration = Date.now() - stepStartTime;
    await AgentExecutionStep.fail(step.id, lastError, stepDuration);

    // Emit step failed event
    if (socket) {
      socket.emitStepFailed(executionId, {
        stepId: step.id,
        agentId: agent.id,
        agentName: agent.name,
        error: lastError,
        duration: stepDuration
      });
    }

    return {
      stepId: step.id,
      agentId: agent.id,
      agentName: agent.name,
      agentRole: agent.role,
      success: false,
      error: lastError,
      attempts: this.maxRetries
    };
  }

  /**
   * Handle execution error
   */
  async handleError(executionId, error, context) {
    log.error(`Workflow execution ${executionId} failed:`, { error: error.message, executionId });

    await this.saveExecution(executionId, {
      status: 'failed',
      error: error.message || error
    });

    return {
      success: false,
      error: error.message || error,
      context: context.toJSON()
    };
  }

  /**
   * Save execution results to database
   */
  async saveExecution(executionId, data) {
    return WorkflowExecution.update(executionId, {
      status: data.status,
      output: data.output,
      total_tokens: data.totalTokens,
      duration_ms: data.durationMs,
      error: data.error
    });
  }

  /**
   * Evaluate a condition
   */
  evaluateCondition(condition, output) {
    if (!condition) return true;

    if (typeof condition === 'string') {
      const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
      return outputStr.includes(condition);
    }

    if (typeof condition === 'object') {
      if (condition.type === 'equals') {
        return output?.[condition.field] === condition.value;
      }
      if (condition.type === 'contains') {
        return String(output?.[condition.field] || '').includes(condition.value);
      }
      if (condition.type === 'default') {
        return true;
      }
    }

    return false;
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear registry
   */
  clear() {
    this.registry.clear();
  }
}

module.exports = WorkflowEngine;
