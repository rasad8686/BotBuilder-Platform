const NodeExecutor = require('./NodeExecutor');
const FlowValidator = require('./FlowValidator');
const log = require('../../utils/logger');

/**
 * FlowEngine - Executes bot flows node by node
 * Handles flow execution, state management, and navigation
 */
class FlowEngine {
  constructor() {
    this.nodeExecutor = new NodeExecutor();
    this.validator = new FlowValidator();
    this.activeExecutions = new Map();
  }

  /**
   * Start a new flow execution
   * @param {object} flow - Flow definition
   * @param {object} context - Initial execution context
   * @returns {Promise<object>} Execution result
   */
  async executeFlow(flow, context = {}) {
    try {
      // Validate flow structure
      const validation = this.validator.validateFlow(flow);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Flow validation failed',
          errors: validation.errors
        };
      }

      // Initialize execution state
      const executionId = this.generateExecutionId();
      const executionState = {
        id: executionId,
        flowId: flow.id,
        currentNodeId: flow.settings?.startNodeId || this.findStartNode(flow)?.id,
        variables: this.initializeVariables(flow.variables || [], context),
        history: [],
        status: 'running',
        startedAt: new Date().toISOString(),
        context: { ...context }
      };

      this.activeExecutions.set(executionId, executionState);

      // Execute the flow
      const result = await this.runFlow(flow, executionState);

      return {
        success: true,
        executionId,
        result,
        finalState: executionState
      };
    } catch (error) {
      log.error('Flow execution error:', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Resume a paused flow execution
   * @param {string} executionId - Execution ID
   * @param {object} userInput - User input to continue execution
   * @returns {Promise<object>} Execution result
   */
  async resumeFlow(executionId, userInput = {}) {
    const executionState = this.activeExecutions.get(executionId);
    if (!executionState) {
      return {
        success: false,
        error: 'Execution not found'
      };
    }

    try {
      // Update context with user input
      executionState.context = {
        ...executionState.context,
        ...userInput
      };

      // Get flow from state
      const flow = executionState.flow;
      if (!flow) {
        return {
          success: false,
          error: 'Flow definition not found in execution state'
        };
      }

      executionState.status = 'running';
      const result = await this.runFlow(flow, executionState);

      return {
        success: true,
        executionId,
        result,
        finalState: executionState
      };
    } catch (error) {
      log.error('Flow resume error:', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute a single node in the flow
   * @param {object} flow - Flow definition
   * @param {string} nodeId - Node ID to execute
   * @param {object} executionState - Current execution state
   * @returns {Promise<object>} Node execution result
   */
  async executeNode(flow, nodeId, executionState) {
    const node = flow.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    try {
      // Execute the node
      const result = await this.nodeExecutor.execute(node, executionState);

      // Add to history
      executionState.history.push({
        nodeId: node.id,
        nodeType: node.type,
        timestamp: new Date().toISOString(),
        result: result
      });

      // Update variables if node modified them
      if (result.variables) {
        executionState.variables = {
          ...executionState.variables,
          ...result.variables
        };
      }

      return result;
    } catch (error) {
      log.error('Node execution error:', { nodeId, error: error.message });
      throw error;
    }
  }

  /**
   * Run the flow from current node until completion or pause
   * @param {object} flow - Flow definition
   * @param {object} executionState - Execution state
   * @returns {Promise<object>} Execution result
   */
  async runFlow(flow, executionState) {
    const maxIterations = 100; // Prevent infinite loops
    let iterations = 0;
    const outputs = [];

    executionState.flow = flow; // Store flow in state for resume

    while (executionState.currentNodeId && iterations < maxIterations) {
      iterations++;

      const nodeResult = await this.executeNode(
        flow,
        executionState.currentNodeId,
        executionState
      );

      // Collect output if any
      if (nodeResult.output) {
        outputs.push(nodeResult.output);
      }

      // Handle node result
      if (nodeResult.waitForInput) {
        executionState.status = 'waiting_input';
        return {
          status: 'waiting_input',
          outputs,
          message: nodeResult.message
        };
      }

      if (nodeResult.error) {
        executionState.status = 'error';
        return {
          status: 'error',
          error: nodeResult.error,
          outputs
        };
      }

      // Navigate to next node
      const nextNodeId = await this.getNextNode(
        flow,
        executionState.currentNodeId,
        nodeResult,
        executionState
      );

      if (!nextNodeId) {
        executionState.status = 'completed';
        executionState.completedAt = new Date().toISOString();
        return {
          status: 'completed',
          outputs
        };
      }

      executionState.currentNodeId = nextNodeId;
    }

    if (iterations >= maxIterations) {
      executionState.status = 'error';
      return {
        status: 'error',
        error: 'Maximum iterations exceeded - possible infinite loop',
        outputs
      };
    }

    return {
      status: 'completed',
      outputs
    };
  }

  /**
   * Get the next node to execute based on current node and result
   * @param {object} flow - Flow definition
   * @param {string} currentNodeId - Current node ID
   * @param {object} nodeResult - Result from current node
   * @param {object} executionState - Execution state
   * @returns {Promise<string|null>} Next node ID or null if flow ends
   */
  async getNextNode(flow, currentNodeId, nodeResult, executionState) {
    const currentNode = flow.nodes.find(n => n.id === currentNodeId);

    // If node specifies next node explicitly
    if (nodeResult.nextNodeId) {
      return nodeResult.nextNodeId;
    }

    // If node type is 'end', stop execution
    if (currentNode.type === 'end') {
      return null;
    }

    // Find outgoing edges
    const edges = flow.edges.filter(e => e.source === currentNodeId);

    if (edges.length === 0) {
      return null; // No more nodes to execute
    }

    // If only one edge, follow it
    if (edges.length === 1) {
      return edges[0].target;
    }

    // Multiple edges - need to evaluate conditions
    for (const edge of edges) {
      if (await this.evaluateEdgeCondition(edge, nodeResult, executionState)) {
        return edge.target;
      }
    }

    // No condition matched, try to find default edge
    const defaultEdge = edges.find(e => !e.condition || e.label === 'default');
    return defaultEdge ? defaultEdge.target : null;
  }

  /**
   * Evaluate edge condition to determine if it should be followed
   * @param {object} edge - Edge definition
   * @param {object} nodeResult - Result from previous node
   * @param {object} executionState - Execution state
   * @returns {Promise<boolean>} True if edge should be followed
   */
  async evaluateEdgeCondition(edge, nodeResult, executionState) {
    // No condition means always follow
    if (!edge.condition && !edge.label) {
      return true;
    }

    // Label-based routing (for menu/question nodes)
    if (edge.label && nodeResult.selectedOption) {
      return edge.label === nodeResult.selectedOption;
    }

    // Condition-based routing
    if (edge.condition) {
      return this.evaluateCondition(edge.condition, executionState.variables);
    }

    return false;
  }

  /**
   * Evaluate a condition against variables
   * @param {object} condition - Condition definition
   * @param {object} variables - Current variables
   * @returns {boolean} Evaluation result
   */
  evaluateCondition(condition, variables) {
    const { variable, operator, value } = condition;
    const varValue = variables[variable];

    switch (operator) {
      case 'equals':
      case 'eq':
        return varValue == value;
      case 'not_equals':
      case 'ne':
        return varValue != value;
      case 'greater_than':
      case 'gt':
        return Number(varValue) > Number(value);
      case 'greater_than_equals':
      case 'gte':
        return Number(varValue) >= Number(value);
      case 'less_than':
      case 'lt':
        return Number(varValue) < Number(value);
      case 'less_than_equals':
      case 'lte':
        return Number(varValue) <= Number(value);
      case 'contains':
        return String(varValue).includes(String(value));
      case 'not_contains':
        return !String(varValue).includes(String(value));
      case 'starts_with':
        return String(varValue).startsWith(String(value));
      case 'ends_with':
        return String(varValue).endsWith(String(value));
      case 'is_empty':
        return !varValue || varValue === '';
      case 'is_not_empty':
        return !!varValue && varValue !== '';
      default:
        return false;
    }
  }

  /**
   * Find start node in flow
   * @param {object} flow - Flow definition
   * @returns {object|null} Start node
   */
  findStartNode(flow) {
    return flow.nodes.find(n => n.type === 'start' || n.isStart);
  }

  /**
   * Initialize variables with default values
   * @param {array} variableDefinitions - Variable definitions from flow
   * @param {object} context - Initial context
   * @returns {object} Initialized variables
   */
  initializeVariables(variableDefinitions, context) {
    const variables = { ...context };

    for (const varDef of variableDefinitions) {
      if (!(varDef.name in variables)) {
        variables[varDef.name] = varDef.defaultValue !== undefined
          ? varDef.defaultValue
          : this.getDefaultValueForType(varDef.type);
      }
    }

    return variables;
  }

  /**
   * Get default value for variable type
   * @param {string} type - Variable type
   * @returns {*} Default value
   */
  getDefaultValueForType(type) {
    switch (type) {
      case 'string':
        return '';
      case 'number':
        return 0;
      case 'boolean':
        return false;
      case 'array':
        return [];
      case 'object':
        return {};
      default:
        return null;
    }
  }

  /**
   * Generate unique execution ID
   * @returns {string} Execution ID
   */
  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get execution state
   * @param {string} executionId - Execution ID
   * @returns {object|null} Execution state
   */
  getExecutionState(executionId) {
    return this.activeExecutions.get(executionId) || null;
  }

  /**
   * Clean up completed executions
   * @param {number} olderThanMs - Remove executions older than this (milliseconds)
   */
  cleanupExecutions(olderThanMs = 3600000) { // Default: 1 hour
    const cutoff = Date.now() - olderThanMs;

    for (const [executionId, state] of this.activeExecutions.entries()) {
      const startTime = new Date(state.startedAt).getTime();
      if (startTime < cutoff && (state.status === 'completed' || state.status === 'error')) {
        this.activeExecutions.delete(executionId);
      }
    }
  }

  /**
   * Cancel an active execution
   * @param {string} executionId - Execution ID
   * @returns {boolean} True if cancelled
   */
  cancelExecution(executionId) {
    const state = this.activeExecutions.get(executionId);
    if (state) {
      state.status = 'cancelled';
      state.cancelledAt = new Date().toISOString();
      return true;
    }
    return false;
  }
}

module.exports = FlowEngine;
