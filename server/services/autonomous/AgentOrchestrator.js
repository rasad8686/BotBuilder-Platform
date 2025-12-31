/**
 * Agent Orchestrator - Multi-Agent Coordination System
 * Manages collaboration between multiple agents for complex tasks
 */

const db = require('../../db');
const log = require('../../utils/logger');
const AgentCore = require('./AgentCore');
const TaskExecutor = require('./TaskExecutor');

// Orchestration configuration
const ORCHESTRATOR_CONFIG = {
  maxConcurrentAgents: parseInt(process.env.MAX_CONCURRENT_AGENTS) || 5,
  coordinationTimeout: parseInt(process.env.AGENT_COORDINATION_TIMEOUT) || 300000, // 5 minutes
  handoffTimeout: parseInt(process.env.AGENT_HANDOFF_TIMEOUT) || 60000, // 1 minute
  retryAttempts: parseInt(process.env.ORCHESTRATOR_RETRY_ATTEMPTS) || 3
};

// Agent roles for orchestration
const AGENT_ROLES = {
  ORCHESTRATOR: 'orchestrator',
  RESEARCHER: 'researcher',
  WRITER: 'writer',
  ANALYZER: 'analyzer',
  REVIEWER: 'reviewer',
  ROUTER: 'router'
};

// Workflow execution states
const WORKFLOW_STATES = {
  PENDING: 'pending',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

class AgentOrchestrator {
  constructor(userId) {
    this.userId = userId;
    this.activeWorkflows = new Map();
    this.agentPool = new Map();
    this.messageQueue = [];
    this.eventHandlers = new Map();
  }

  /**
   * Create a new multi-agent workflow
   */
  async createWorkflow(workflowData) {
    const {
      name,
      description,
      agents = [],
      steps = [],
      settings = {}
    } = workflowData;

    if (!name) {
      throw new Error('Workflow name is required');
    }

    const result = await db.query(
      `INSERT INTO agent_workflows
       (user_id, name, description, agents, steps, settings, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        this.userId,
        name,
        description,
        JSON.stringify(agents),
        JSON.stringify(steps),
        JSON.stringify(settings),
        WORKFLOW_STATES.PENDING
      ]
    );

    log.info('AgentOrchestrator: Workflow created', {
      workflowId: result.rows[0].id,
      userId: this.userId
    });

    return this.parseWorkflow(result.rows[0]);
  }

  /**
   * Execute a multi-agent workflow
   */
  async executeWorkflow(workflowId, inputData = {}) {
    const workflow = await this.getWorkflow(workflowId);

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Check concurrent workflow limit
    if (this.activeWorkflows.size >= ORCHESTRATOR_CONFIG.maxConcurrentAgents) {
      throw new Error('Maximum concurrent workflows reached');
    }

    // Initialize workflow execution
    const execution = {
      id: `exec_${Date.now()}`,
      workflowId,
      startTime: new Date(),
      status: WORKFLOW_STATES.RUNNING,
      currentStep: 0,
      results: [],
      context: { ...inputData }
    };

    this.activeWorkflows.set(execution.id, execution);

    // Update workflow status
    await this.updateWorkflowStatus(workflowId, WORKFLOW_STATES.RUNNING, {
      execution_id: execution.id,
      started_at: execution.startTime
    });

    try {
      log.info('AgentOrchestrator: Starting workflow execution', {
        workflowId,
        executionId: execution.id
      });

      // Initialize agents for this workflow
      await this.initializeAgents(workflow.agents);

      // Execute workflow steps
      for (let i = 0; i < workflow.steps.length; i++) {
        execution.currentStep = i;
        const step = workflow.steps[i];

        const stepResult = await this.executeWorkflowStep(step, execution.context);

        execution.results.push({
          stepIndex: i,
          stepName: step.name,
          success: stepResult.success,
          output: stepResult.output,
          duration: stepResult.duration
        });

        // Update context with step results
        if (stepResult.output) {
          execution.context[`step_${i}_result`] = stepResult.output;
        }

        // Check for early termination
        if (!stepResult.success && step.required !== false) {
          throw new Error(`Required step failed: ${step.name}`);
        }
      }

      // Complete workflow
      execution.status = WORKFLOW_STATES.COMPLETED;
      execution.endTime = new Date();

      await this.updateWorkflowStatus(workflowId, WORKFLOW_STATES.COMPLETED, {
        execution_id: execution.id,
        completed_at: execution.endTime,
        results: execution.results
      });

      log.info('AgentOrchestrator: Workflow completed', {
        workflowId,
        executionId: execution.id
      });

      return {
        success: true,
        executionId: execution.id,
        results: execution.results,
        duration: execution.endTime - execution.startTime
      };

    } catch (error) {
      execution.status = WORKFLOW_STATES.FAILED;
      execution.error = error.message;
      execution.endTime = new Date();

      await this.updateWorkflowStatus(workflowId, WORKFLOW_STATES.FAILED, {
        execution_id: execution.id,
        error: error.message,
        failed_at: execution.endTime
      });

      log.error('AgentOrchestrator: Workflow failed', {
        workflowId,
        executionId: execution.id,
        error: error.message
      });

      throw error;

    } finally {
      this.activeWorkflows.delete(execution.id);
      await this.cleanupAgents(workflow.agents);
    }
  }

  /**
   * Execute a single workflow step
   */
  async executeWorkflowStep(step, context) {
    const startTime = Date.now();

    try {
      const agent = this.agentPool.get(step.agentId);

      if (!agent) {
        throw new Error(`Agent not found: ${step.agentId}`);
      }

      // Prepare input for the agent
      const input = this.prepareStepInput(step, context);

      // Execute the step
      const result = await this.executeAgentTask(agent, step, input);

      return {
        success: true,
        output: result,
        duration: Date.now() - startTime
      };

    } catch (error) {
      log.error('AgentOrchestrator: Step execution failed', {
        step: step.name,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Initialize agents for workflow
   */
  async initializeAgents(agentIds) {
    for (const agentId of agentIds) {
      if (!this.agentPool.has(agentId)) {
        const agent = await AgentCore.findById(agentId);
        if (agent) {
          this.agentPool.set(agentId, {
            agent,
            executor: new TaskExecutor(agent),
            status: 'ready'
          });
        }
      }
    }
  }

  /**
   * Cleanup agents after workflow
   */
  async cleanupAgents(agentIds) {
    for (const agentId of agentIds) {
      const poolEntry = this.agentPool.get(agentId);
      if (poolEntry) {
        // Persist any memory if needed
        if (poolEntry.executor.persistMemory) {
          await poolEntry.executor.persistMemory();
        }
      }
    }
  }

  /**
   * Prepare input for a workflow step
   */
  prepareStepInput(step, context) {
    const input = { ...step.input };

    // Replace context variables
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        const contextKey = value.slice(2, -2).trim();
        input[key] = context[contextKey] || value;
      }
    }

    return input;
  }

  /**
   * Execute an agent task
   */
  async executeAgentTask(poolEntry, step, input) {
    const { agent, executor } = poolEntry;

    // Create and execute task
    const task = await TaskExecutor.createTask(
      agent.id,
      step.description || step.name,
      input
    );

    const result = await executor.execute(task.id);
    return result;
  }

  /**
   * Coordinate handoff between agents
   */
  async handoffToAgent(fromAgentId, toAgentId, data) {
    const fromPool = this.agentPool.get(fromAgentId);
    const toPool = this.agentPool.get(toAgentId);

    if (!fromPool || !toPool) {
      throw new Error('One or both agents not found in pool');
    }

    const handoff = {
      id: `handoff_${Date.now()}`,
      from: fromAgentId,
      to: toAgentId,
      data,
      timestamp: new Date(),
      status: 'pending'
    };

    // Log the handoff
    await db.query(
      `INSERT INTO agent_handoffs (workflow_id, from_agent_id, to_agent_id, data, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [null, fromAgentId, toAgentId, JSON.stringify(data), 'completed']
    );

    log.info('AgentOrchestrator: Agent handoff completed', {
      from: fromAgentId,
      to: toAgentId
    });

    return handoff;
  }

  /**
   * Send message between agents
   */
  async sendAgentMessage(fromAgentId, toAgentId, message) {
    const msg = {
      id: `msg_${Date.now()}`,
      from: fromAgentId,
      to: toAgentId,
      content: message,
      timestamp: new Date(),
      status: 'sent'
    };

    this.messageQueue.push(msg);

    // Emit event for real-time updates
    this.emit('agent_message', msg);

    return msg;
  }

  /**
   * Get pending messages for an agent
   */
  getAgentMessages(agentId) {
    return this.messageQueue.filter(msg => msg.to === agentId && msg.status === 'sent');
  }

  /**
   * Register event handler
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  /**
   * Emit event
   */
  emit(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        log.error('AgentOrchestrator: Event handler error', { event, error: error.message });
      }
    });
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(workflowId) {
    const result = await db.query(
      `SELECT * FROM agent_workflows WHERE id = $1 AND user_id = $2`,
      [workflowId, this.userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.parseWorkflow(result.rows[0]);
  }

  /**
   * Get all workflows for user
   */
  async getWorkflows(options = {}) {
    const { status, limit = 50, offset = 0 } = options;

    let query = `SELECT * FROM agent_workflows WHERE user_id = $1`;
    const params = [this.userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows.map(this.parseWorkflow);
  }

  /**
   * Update workflow status
   */
  async updateWorkflowStatus(workflowId, status, metadata = {}) {
    await db.query(
      `UPDATE agent_workflows
       SET status = $1, metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [status, JSON.stringify(metadata), workflowId]
    );
  }

  /**
   * Delete workflow
   */
  async deleteWorkflow(workflowId) {
    const result = await db.query(
      `DELETE FROM agent_workflows WHERE id = $1 AND user_id = $2 RETURNING id`,
      [workflowId, this.userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Workflow not found or access denied');
    }

    return true;
  }

  /**
   * Parse workflow from database row
   */
  parseWorkflow(row) {
    if (!row) return null;

    return {
      ...row,
      agents: typeof row.agents === 'string' ? JSON.parse(row.agents) : row.agents || [],
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps || [],
      settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings || {},
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {}
    };
  }

  /**
   * Get workflow execution statistics
   */
  async getWorkflowStats(workflowId) {
    const result = await db.query(
      `SELECT
        COUNT(*) as total_executions,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
       FROM workflow_executions WHERE workflow_id = $1`,
      [workflowId]
    );

    return result.rows[0] || {
      total_executions: 0,
      successful: 0,
      failed: 0,
      avg_duration_seconds: 0
    };
  }

  /**
   * Pause a running workflow
   */
  async pauseWorkflow(executionId) {
    const execution = this.activeWorkflows.get(executionId);

    if (!execution) {
      throw new Error('Execution not found');
    }

    execution.status = WORKFLOW_STATES.PAUSED;
    execution.pausedAt = new Date();

    await this.updateWorkflowStatus(execution.workflowId, WORKFLOW_STATES.PAUSED, {
      paused_at: execution.pausedAt,
      paused_at_step: execution.currentStep
    });

    return true;
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(executionId) {
    const execution = this.activeWorkflows.get(executionId);

    if (!execution || execution.status !== WORKFLOW_STATES.PAUSED) {
      throw new Error('No paused execution found');
    }

    execution.status = WORKFLOW_STATES.RUNNING;
    execution.resumedAt = new Date();

    await this.updateWorkflowStatus(execution.workflowId, WORKFLOW_STATES.RUNNING, {
      resumed_at: execution.resumedAt
    });

    // Continue execution from paused step
    // (Implementation would continue from execution.currentStep)

    return true;
  }

  /**
   * Cancel a running workflow
   */
  async cancelWorkflow(executionId) {
    const execution = this.activeWorkflows.get(executionId);

    if (!execution) {
      throw new Error('Execution not found');
    }

    execution.status = WORKFLOW_STATES.CANCELLED;
    execution.cancelledAt = new Date();

    await this.updateWorkflowStatus(execution.workflowId, WORKFLOW_STATES.CANCELLED, {
      cancelled_at: execution.cancelledAt,
      cancelled_at_step: execution.currentStep
    });

    this.activeWorkflows.delete(executionId);

    return true;
  }

  /**
   * Get active workflow executions
   */
  getActiveExecutions() {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * Create a workflow from template
   */
  async createFromTemplate(templateId, customizations = {}) {
    const AgentTemplates = require('./AgentTemplates');
    const template = AgentTemplates.getWorkflowTemplate(templateId);

    if (!template) {
      throw new Error('Template not found');
    }

    const workflowData = {
      name: customizations.name || template.name,
      description: customizations.description || template.description,
      agents: template.agents,
      steps: template.steps,
      settings: { ...template.settings, ...customizations.settings }
    };

    return this.createWorkflow(workflowData);
  }
}

// Export constants
AgentOrchestrator.ROLES = AGENT_ROLES;
AgentOrchestrator.STATES = WORKFLOW_STATES;
AgentOrchestrator.CONFIG = ORCHESTRATOR_CONFIG;

module.exports = AgentOrchestrator;
