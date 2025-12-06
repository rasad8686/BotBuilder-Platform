/**
 * WorkflowParser - Parses and validates workflow configuration
 */

class WorkflowParser {
  constructor() {
    this.supportedTypes = ['sequential', 'parallel', 'conditional', 'mixed'];
  }

  /**
   * Parse workflow configuration
   * @param {Object} workflow - Workflow configuration
   * @returns {Object} - Parsed workflow
   */
  parse(workflow) {
    const parsed = {
      id: workflow.id,
      name: workflow.name,
      type: workflow.workflow_type || 'sequential',
      botId: workflow.bot_id,
      entryAgentId: workflow.entry_agent_id,
      isDefault: workflow.is_default,
      isActive: workflow.is_active,
      agents: this.parseAgentsConfig(workflow.agents_config || []),
      flow: this.parseFlowConfig(workflow.flow_config || {}),
      executionOrder: [],
      conditions: []
    };

    // Calculate execution order
    parsed.executionOrder = this.getExecutionOrder(parsed);

    // Extract conditions
    parsed.conditions = this.getConditions(parsed);

    return parsed;
  }

  /**
   * Parse agents configuration
   */
  parseAgentsConfig(agentsConfig) {
    return agentsConfig.map((config, index) => ({
      agentId: config.agentId || config.id,
      order: config.order ?? index,
      role: config.role,
      dependsOn: config.dependsOn || [],
      config: config.config || {}
    }));
  }

  /**
   * Parse flow configuration
   */
  parseFlowConfig(flowConfig) {
    return {
      routes: flowConfig.routes || [],
      stages: flowConfig.stages || [],
      conditions: flowConfig.conditions || [],
      fallback: flowConfig.fallback || null
    };
  }

  /**
   * Validate workflow structure
   * @param {Object} workflow - Workflow to validate
   * @returns {Object} - Validation result
   */
  validate(workflow) {
    const errors = [];
    const warnings = [];

    // Check required fields
    if (!workflow.name) {
      errors.push('Workflow name is required');
    }

    if (!workflow.bot_id) {
      errors.push('Bot ID is required');
    }

    // Check workflow type
    const workflowType = workflow.workflow_type || 'sequential';
    if (!this.supportedTypes.includes(workflowType)) {
      errors.push(`Unsupported workflow type: ${workflowType}`);
    }

    // Check agents config
    const agentsConfig = workflow.agents_config || [];

    if (agentsConfig.length === 0) {
      errors.push('At least one agent is required');
    }

    // Validate each agent config
    const agentIds = new Set();
    for (let i = 0; i < agentsConfig.length; i++) {
      const config = agentsConfig[i];
      const agentId = config.agentId || config.id;

      if (!agentId) {
        errors.push(`Agent at index ${i} is missing agentId`);
      }

      if (agentIds.has(agentId)) {
        warnings.push(`Duplicate agent ID: ${agentId}`);
      }
      agentIds.add(agentId);

      // Validate dependencies
      if (config.dependsOn) {
        for (const depId of config.dependsOn) {
          if (!agentIds.has(depId) && !agentsConfig.some(a => (a.agentId || a.id) === depId)) {
            errors.push(`Agent ${agentId} depends on unknown agent: ${depId}`);
          }
        }
      }
    }

    // Validate conditional workflow
    if (workflowType === 'conditional') {
      if (!workflow.entry_agent_id) {
        errors.push('Conditional workflow requires entry_agent_id');
      }

      const flowConfig = workflow.flow_config || {};
      const routes = flowConfig.routes || [];

      if (routes.length === 0) {
        warnings.push('Conditional workflow has no routes defined');
      }

      // Check for circular routes
      const circularCheck = this.detectCircularRoutes(routes);
      if (circularCheck.hasCircular) {
        errors.push(`Circular route detected: ${circularCheck.path.join(' -> ')}`);
      }
    }

    // Validate mixed workflow
    if (workflowType === 'mixed') {
      const flowConfig = workflow.flow_config || {};
      const stages = flowConfig.stages || [];

      if (stages.length === 0) {
        errors.push('Mixed workflow requires stages in flow_config');
      }

      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        if (!stage.type || !['sequential', 'parallel'].includes(stage.type)) {
          errors.push(`Stage ${i} has invalid type: ${stage.type}`);
        }
        if (!stage.agents || stage.agents.length === 0) {
          errors.push(`Stage ${i} has no agents`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get execution order for agents
   * @param {Object} parsed - Parsed workflow
   * @returns {Array} - Ordered list of agent IDs
   */
  getExecutionOrder(parsed) {
    const agents = parsed.agents;
    const type = parsed.type;

    if (type === 'sequential') {
      // Sort by order field
      return agents
        .sort((a, b) => a.order - b.order)
        .map(a => a.agentId);
    }

    if (type === 'parallel') {
      // All agents execute at once
      return [agents.map(a => a.agentId)];
    }

    if (type === 'conditional') {
      // Start with entry agent, rest determined at runtime
      return parsed.entryAgentId ? [parsed.entryAgentId] : [];
    }

    if (type === 'mixed') {
      // Return stages
      return parsed.flow.stages.map(stage => ({
        type: stage.type,
        agents: stage.agents
      }));
    }

    return agents.map(a => a.agentId);
  }

  /**
   * Get conditions from workflow
   * @param {Object} parsed - Parsed workflow
   * @returns {Array} - List of conditions
   */
  getConditions(parsed) {
    const conditions = [];

    // From flow config routes
    for (const route of parsed.flow.routes) {
      if (route.condition) {
        conditions.push({
          fromAgentId: route.fromAgentId,
          targetAgentId: route.targetAgentId,
          condition: route.condition
        });
      }
    }

    // From flow config conditions
    for (const cond of parsed.flow.conditions) {
      conditions.push(cond);
    }

    return conditions;
  }

  /**
   * Detect circular routes
   */
  detectCircularRoutes(routes) {
    const graph = new Map();

    // Build adjacency list
    for (const route of routes) {
      if (!graph.has(route.fromAgentId)) {
        graph.set(route.fromAgentId, []);
      }
      graph.get(route.fromAgentId).push(route.targetAgentId);
    }

    // DFS to detect cycle
    const visited = new Set();
    const recursionStack = new Set();
    const path = [];

    const hasCycle = (node) => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          path.push(neighbor);
          return true;
        }
      }

      recursionStack.delete(node);
      path.pop();
      return false;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        if (hasCycle(node)) {
          return { hasCircular: true, path };
        }
      }
    }

    return { hasCircular: false, path: [] };
  }

  /**
   * Convert parsed workflow back to config
   */
  toConfig(parsed) {
    return {
      id: parsed.id,
      name: parsed.name,
      workflow_type: parsed.type,
      bot_id: parsed.botId,
      entry_agent_id: parsed.entryAgentId,
      is_default: parsed.isDefault,
      is_active: parsed.isActive,
      agents_config: parsed.agents.map(a => ({
        agentId: a.agentId,
        order: a.order,
        role: a.role,
        dependsOn: a.dependsOn,
        config: a.config
      })),
      flow_config: {
        routes: parsed.flow.routes,
        stages: parsed.flow.stages,
        conditions: parsed.flow.conditions,
        fallback: parsed.flow.fallback
      }
    };
  }
}

module.exports = WorkflowParser;
