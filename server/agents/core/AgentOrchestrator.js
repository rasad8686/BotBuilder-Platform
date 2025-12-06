/**
 * AgentOrchestrator - Main workflow controller
 */

const Agent = require('./Agent');
const AgentContext = require('./AgentContext');
const AgentRegistry = require('./AgentRegistry');
const AgentExecutor = require('./AgentExecutor');

class AgentOrchestrator {
  constructor() {
    this.registry = new AgentRegistry();
    this.executor = new AgentExecutor(this.registry);
    this.workflows = new Map();
  }

  /**
   * Load agents from configuration
   * @param {Array<Object>} agentConfigs - Array of agent configurations
   * @returns {Array<Agent>} - Loaded agents
   */
  loadAgents(agentConfigs) {
    const agents = [];

    for (const config of agentConfigs) {
      const agent = new Agent(config);
      this.registry.register(agent);
      agents.push(agent);
    }

    return agents;
  }

  /**
   * Load a single agent
   * @param {Object} config - Agent configuration
   * @returns {Agent} - The loaded agent
   */
  loadAgent(config) {
    const agent = new Agent(config);
    this.registry.register(agent);
    return agent;
  }

  /**
   * Register a workflow
   * @param {Object} workflow - Workflow configuration
   */
  registerWorkflow(workflow) {
    this.workflows.set(workflow.id, workflow);
  }

  /**
   * Execute a workflow
   * @param {Object} workflow - Workflow configuration
   * @param {any} input - Initial input
   * @returns {Promise<Object>} - Workflow execution result
   */
  async executeWorkflow(workflow, input) {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const context = new AgentContext(executionId);
    const startTime = Date.now();

    try {
      let result;

      switch (workflow.workflowType) {
        case 'sequential':
          result = await this.executeSequentialWorkflow(workflow, input, context);
          break;

        case 'parallel':
          result = await this.executeParallelWorkflow(workflow, input, context);
          break;

        case 'conditional':
          result = await this.executeConditionalWorkflow(workflow, input, context);
          break;

        case 'dag':
          result = await this.executeDAGWorkflow(workflow, input, context);
          break;

        default:
          // Default to sequential
          result = await this.executeSequentialWorkflow(workflow, input, context);
      }

      return {
        executionId,
        workflowId: workflow.id,
        workflowName: workflow.name,
        status: result.success ? 'completed' : 'failed',
        input,
        output: result.finalOutput || result.outputs,
        totalTokens: result.totalTokens || 0,
        totalDuration: Date.now() - startTime,
        steps: result.results,
        context: context.toJSON(),
        error: result.error
      };
    } catch (error) {
      return {
        executionId,
        workflowId: workflow.id,
        workflowName: workflow.name,
        status: 'error',
        input,
        error: error.message,
        totalDuration: Date.now() - startTime,
        context: context.toJSON()
      };
    }
  }

  /**
   * Execute a sequential workflow
   * @param {Object} workflow - Workflow configuration
   * @param {any} input - Initial input
   * @param {AgentContext} context - Execution context
   * @returns {Promise<Object>} - Execution result
   */
  async executeSequentialWorkflow(workflow, input, context) {
    const agents = this.getWorkflowAgents(workflow);
    return this.executor.executeSequential(agents, input, context);
  }

  /**
   * Execute a parallel workflow
   * @param {Object} workflow - Workflow configuration
   * @param {any} input - Initial input
   * @param {AgentContext} context - Execution context
   * @returns {Promise<Object>} - Execution result
   */
  async executeParallelWorkflow(workflow, input, context) {
    const agents = this.getWorkflowAgents(workflow);
    return this.executor.executeParallel(agents, input, context);
  }

  /**
   * Execute a conditional workflow
   * @param {Object} workflow - Workflow configuration
   * @param {any} input - Initial input
   * @param {AgentContext} context - Execution context
   * @returns {Promise<Object>} - Execution result
   */
  async executeConditionalWorkflow(workflow, input, context) {
    const results = [];
    let currentInput = input;
    let totalTokens = 0;

    // Start with entry agent
    const entryAgent = this.registry.get(workflow.entryAgentId);
    if (!entryAgent) {
      throw new Error(`Entry agent not found: ${workflow.entryAgentId}`);
    }

    const entryResult = await this.executor.executeAgent(entryAgent, currentInput, context);
    results.push(entryResult);
    totalTokens += entryResult.tokensUsed || 0;

    if (!entryResult.success) {
      return {
        success: false,
        results,
        totalTokens,
        error: entryResult.error
      };
    }

    // Process flow config for routing
    const flowConfig = workflow.flowConfig || {};
    const routes = flowConfig.routes || [];

    let nextAgentId = null;
    for (const route of routes) {
      if (this.evaluateCondition(route.condition, entryResult.output, context)) {
        nextAgentId = route.targetAgentId;
        break;
      }
    }

    // Continue with next agent if found
    while (nextAgentId) {
      const nextAgent = this.registry.get(nextAgentId);
      if (!nextAgent) {
        break;
      }

      currentInput = results[results.length - 1]?.output;
      const result = await this.executor.executeAgent(nextAgent, currentInput, context);
      results.push(result);
      totalTokens += result.tokensUsed || 0;

      if (!result.success) {
        return {
          success: false,
          results,
          totalTokens,
          error: result.error
        };
      }

      // Check for next route
      nextAgentId = null;
      for (const route of routes) {
        if (route.fromAgentId === nextAgent.id && this.evaluateCondition(route.condition, result.output, context)) {
          nextAgentId = route.targetAgentId;
          break;
        }
      }
    }

    return {
      success: true,
      results,
      totalTokens,
      finalOutput: results[results.length - 1]?.output
    };
  }

  /**
   * Execute a DAG workflow
   * @param {Object} workflow - Workflow configuration
   * @param {any} input - Initial input
   * @param {AgentContext} context - Execution context
   * @returns {Promise<Object>} - Execution result
   */
  async executeDAGWorkflow(workflow, input, context) {
    const agentsConfig = workflow.agentsConfig || [];
    return this.executor.executeWithDependencies(agentsConfig, input, context);
  }

  /**
   * Get agents for a workflow
   * @param {Object} workflow - Workflow configuration
   * @returns {Array<Agent>} - Agents in the workflow
   */
  getWorkflowAgents(workflow) {
    const agentsConfig = workflow.agentsConfig || [];
    const agents = [];

    for (const config of agentsConfig) {
      const agentId = config.agentId || config.id;
      const agent = this.registry.get(agentId);
      if (agent) {
        agents.push(agent);
      }
    }

    return agents;
  }

  /**
   * Evaluate a condition for routing
   * @param {Object|string} condition - The condition to evaluate
   * @param {any} output - The current output
   * @param {AgentContext} context - Execution context
   * @returns {boolean} - Whether the condition is met
   */
  evaluateCondition(condition, output, context) {
    if (!condition) {
      return true;
    }

    if (typeof condition === 'string') {
      // Simple string match
      const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
      return outputStr.includes(condition);
    }

    if (typeof condition === 'object') {
      // Object-based condition
      if (condition.type === 'equals') {
        return output?.[condition.field] === condition.value;
      }
      if (condition.type === 'contains') {
        return String(output?.[condition.field] || '').includes(condition.value);
      }
      if (condition.type === 'exists') {
        return output?.[condition.field] !== undefined;
      }
      if (condition.type === 'default') {
        return true;
      }
    }

    return false;
  }

  /**
   * Get an agent by ID
   * @param {number|string} id - Agent ID
   * @returns {Agent|null} - The agent or null
   */
  getAgent(id) {
    return this.registry.get(id);
  }

  /**
   * Get all agents
   * @returns {Array<Agent>} - All registered agents
   */
  getAllAgents() {
    return this.registry.getAll();
  }

  /**
   * Get agents by role
   * @param {string} role - The role to filter by
   * @returns {Array<Agent>} - Matching agents
   */
  getAgentsByRole(role) {
    return this.registry.getByRole(role);
  }

  /**
   * Clear all agents and workflows
   */
  clear() {
    this.registry.clear();
    this.workflows.clear();
  }
}

module.exports = AgentOrchestrator;
