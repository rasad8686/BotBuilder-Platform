/**
 * FlowValidator - Validates flow structure and configurations
 * Ensures flows are properly structured before execution
 */
class FlowValidator {
  constructor() {
    this.validNodeTypes = [
      'start',
      'message',
      'question',
      'condition',
      'action',
      'api_call',
      'set_variable',
      'delay',
      'end',
      'goto',
      'email',
      'webhook',
      'ai_response',
      'menu',
      'input'
    ];

    this.requiredNodeFields = ['id', 'type', 'data'];
    this.requiredEdgeFields = ['id', 'source', 'target'];
  }

  /**
   * Validate complete flow structure
   * @param {object} flow - Flow to validate
   * @returns {object} Validation result
   */
  validateFlow(flow) {
    const errors = [];
    const warnings = [];

    // Check if flow exists
    if (!flow) {
      return {
        valid: false,
        errors: ['Flow is null or undefined'],
        warnings: []
      };
    }

    // Validate basic structure
    if (!flow.nodes || !Array.isArray(flow.nodes)) {
      errors.push('Flow must have a nodes array');
    }

    if (!flow.edges || !Array.isArray(flow.edges)) {
      errors.push('Flow must have an edges array');
    }

    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    // Validate nodes
    const nodeValidation = this.validateNodes(flow.nodes);
    errors.push(...nodeValidation.errors);
    warnings.push(...nodeValidation.warnings);

    // Validate edges
    const edgeValidation = this.validateEdges(flow.edges, flow.nodes);
    errors.push(...edgeValidation.errors);
    warnings.push(...edgeValidation.warnings);

    // Validate flow structure
    const structureValidation = this.validateStructure(flow);
    errors.push(...structureValidation.errors);
    warnings.push(...structureValidation.warnings);

    // Validate variables
    if (flow.variables) {
      const variableValidation = this.validateVariables(flow.variables);
      errors.push(...variableValidation.errors);
      warnings.push(...variableValidation.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate all nodes in flow
   * @param {array} nodes - Nodes to validate
   * @returns {object} Validation result
   */
  validateNodes(nodes) {
    const errors = [];
    const warnings = [];
    const nodeIds = new Set();

    if (nodes.length === 0) {
      warnings.push('Flow has no nodes');
    }

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const nodePrefix = `Node ${i}`;

      // Check required fields
      for (const field of this.requiredNodeFields) {
        if (!(field in node)) {
          errors.push(`${nodePrefix}: Missing required field '${field}'`);
        }
      }

      // Check node ID uniqueness
      if (node.id) {
        if (nodeIds.has(node.id)) {
          errors.push(`${nodePrefix}: Duplicate node ID '${node.id}'`);
        }
        nodeIds.add(node.id);
      }

      // Validate node type
      if (node.type && !this.validNodeTypes.includes(node.type)) {
        errors.push(`${nodePrefix}: Invalid node type '${node.type}'`);
      }

      // Validate specific node types
      const nodeTypeValidation = this.validateNodeType(node);
      errors.push(...nodeTypeValidation.errors.map(e => `${nodePrefix}: ${e}`));
      warnings.push(...nodeTypeValidation.warnings.map(w => `${nodePrefix}: ${w}`));
    }

    return { errors, warnings };
  }

  /**
   * Validate node based on its type
   * @param {object} node - Node to validate
   * @returns {object} Validation result
   */
  validateNodeType(node) {
    const errors = [];
    const warnings = [];

    if (!node.data) {
      return { errors: ['Missing data object'], warnings };
    }

    switch (node.type) {
      case 'start':
        // Start nodes should not have incoming edges (checked in structure validation)
        break;

      case 'message':
        if (!node.data.content && !node.data.label) {
          warnings.push('Message node has no content or label');
        }
        break;

      case 'question':
      case 'menu':
        if (!node.data.options || !Array.isArray(node.data.options)) {
          errors.push('Question/Menu node must have options array');
        } else if (node.data.options.length === 0) {
          warnings.push('Question/Menu node has no options');
        }
        break;

      case 'input':
        if (!node.data.variableName) {
          errors.push('Input node must specify variableName');
        }
        if (node.data.validation && !this.isValidValidationType(node.data.validation)) {
          warnings.push(`Unknown validation type: ${node.data.validation}`);
        }
        break;

      case 'condition':
        if (!node.data.conditions || !Array.isArray(node.data.conditions)) {
          errors.push('Condition node must have conditions array');
        } else if (node.data.conditions.length === 0) {
          warnings.push('Condition node has no conditions');
        } else {
          // Validate each condition
          for (const cond of node.data.conditions) {
            if (!cond.operator || !cond.value) {
              errors.push('Condition must have operator and value');
            }
          }
        }
        break;

      case 'action':
        if (!node.data.actionType) {
          warnings.push('Action node missing actionType');
        }
        break;

      case 'api_call':
        if (!node.data.endpoint) {
          errors.push('API call node must have endpoint');
        }
        if (!node.data.method) {
          warnings.push('API call node missing HTTP method');
        }
        break;

      case 'set_variable':
        if (!node.data.variableName) {
          errors.push('Set variable node must specify variableName');
        }
        break;

      case 'delay':
        if (!node.data.duration && node.data.duration !== 0) {
          warnings.push('Delay node missing duration');
        }
        break;

      case 'email':
        if (!node.data.template && !node.data.subject) {
          warnings.push('Email node missing template or subject');
        }
        break;

      case 'webhook':
        if (!node.data.url) {
          errors.push('Webhook node must have URL');
        }
        break;

      case 'ai_response':
        // AI response nodes are generally flexible
        break;

      case 'goto':
        if (!node.data.targetNodeId) {
          errors.push('Goto node must specify targetNodeId');
        }
        break;

      case 'end':
        // End nodes don't need special validation
        break;
    }

    return { errors, warnings };
  }

  /**
   * Validate all edges in flow
   * @param {array} edges - Edges to validate
   * @param {array} nodes - Nodes in flow (for reference checking)
   * @returns {object} Validation result
   */
  validateEdges(edges, nodes) {
    const errors = [];
    const warnings = [];
    const edgeIds = new Set();
    const nodeIds = new Set(nodes.map(n => n.id));

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const edgePrefix = `Edge ${i}`;

      // Check required fields
      for (const field of this.requiredEdgeFields) {
        if (!(field in edge)) {
          errors.push(`${edgePrefix}: Missing required field '${field}'`);
        }
      }

      // Check edge ID uniqueness
      if (edge.id) {
        if (edgeIds.has(edge.id)) {
          errors.push(`${edgePrefix}: Duplicate edge ID '${edge.id}'`);
        }
        edgeIds.add(edge.id);
      }

      // Validate source and target nodes exist
      if (edge.source && !nodeIds.has(edge.source)) {
        errors.push(`${edgePrefix}: Source node '${edge.source}' does not exist`);
      }

      if (edge.target && !nodeIds.has(edge.target)) {
        errors.push(`${edgePrefix}: Target node '${edge.target}' does not exist`);
      }

      // Check for self-referencing edges
      if (edge.source === edge.target) {
        warnings.push(`${edgePrefix}: Edge connects node to itself`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate flow structure (start node, reachability, etc.)
   * @param {object} flow - Flow to validate
   * @returns {object} Validation result
   */
  validateStructure(flow) {
    const errors = [];
    const warnings = [];

    // Check for start node
    const startNodes = flow.nodes.filter(n => n.type === 'start' || n.isStart);
    if (startNodes.length === 0) {
      errors.push('Flow must have at least one start node');
    } else if (startNodes.length > 1) {
      warnings.push('Flow has multiple start nodes');
    }

    // Check for end node
    const endNodes = flow.nodes.filter(n => n.type === 'end');
    if (endNodes.length === 0) {
      warnings.push('Flow has no end nodes');
    }

    // Check for unreachable nodes
    if (startNodes.length > 0) {
      const reachableNodes = this.findReachableNodes(startNodes[0], flow);
      const unreachableNodes = flow.nodes.filter(n => !reachableNodes.has(n.id));

      if (unreachableNodes.length > 0) {
        warnings.push(`Flow has ${unreachableNodes.length} unreachable node(s): ${unreachableNodes.map(n => n.id).join(', ')}`);
      }
    }

    // Check for orphaned nodes (nodes with no connections)
    const connectedNodeIds = new Set();
    for (const edge of flow.edges) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }

    const orphanedNodes = flow.nodes.filter(n =>
      !connectedNodeIds.has(n.id) && n.type !== 'start'
    );

    if (orphanedNodes.length > 0) {
      warnings.push(`Flow has ${orphanedNodes.length} orphaned node(s): ${orphanedNodes.map(n => n.id).join(', ')}`);
    }

    // Check for circular dependencies
    const circularPaths = this.findCircularPaths(flow);
    if (circularPaths.length > 0) {
      warnings.push(`Flow has potential circular paths: ${circularPaths.length} detected`);
    }

    // Check that start nodes have no incoming edges
    for (const startNode of startNodes) {
      const incomingEdges = flow.edges.filter(e => e.target === startNode.id);
      if (incomingEdges.length > 0) {
        warnings.push(`Start node '${startNode.id}' has incoming edges`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate variables definition
   * @param {array} variables - Variables to validate
   * @returns {object} Validation result
   */
  validateVariables(variables) {
    const errors = [];
    const warnings = [];
    const variableNames = new Set();

    if (!Array.isArray(variables)) {
      return {
        errors: ['Variables must be an array'],
        warnings: []
      };
    }

    for (let i = 0; i < variables.length; i++) {
      const variable = variables[i];
      const varPrefix = `Variable ${i}`;

      if (!variable.name) {
        errors.push(`${varPrefix}: Missing variable name`);
        continue;
      }

      // Check for duplicate names
      if (variableNames.has(variable.name)) {
        errors.push(`${varPrefix}: Duplicate variable name '${variable.name}'`);
      }
      variableNames.add(variable.name);

      // Validate variable name format
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable.name)) {
        errors.push(`${varPrefix}: Invalid variable name '${variable.name}' - must start with letter or underscore`);
      }

      // Check type
      const validTypes = ['string', 'number', 'boolean', 'array', 'object'];
      if (variable.type && !validTypes.includes(variable.type)) {
        warnings.push(`${varPrefix}: Unknown variable type '${variable.type}'`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Find all nodes reachable from a start node
   * @param {object} startNode - Starting node
   * @param {object} flow - Flow definition
   * @returns {Set} Set of reachable node IDs
   */
  findReachableNodes(startNode, flow) {
    const reachable = new Set();
    const queue = [startNode.id];
    const visited = new Set();

    while (queue.length > 0) {
      const nodeId = queue.shift();

      if (visited.has(nodeId)) {
        continue;
      }

      visited.add(nodeId);
      reachable.add(nodeId);

      // Find outgoing edges
      const outgoingEdges = flow.edges.filter(e => e.source === nodeId);
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.target)) {
          queue.push(edge.target);
        }
      }
    }

    return reachable;
  }

  /**
   * Find circular paths in flow
   * @param {object} flow - Flow definition
   * @returns {array} Array of circular paths found
   */
  findCircularPaths(flow) {
    const paths = [];
    const visited = new Set();
    const recursionStack = new Set();

    const dfs = (nodeId, path = []) => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        if (cycleStart !== -1) {
          paths.push([...path.slice(cycleStart), nodeId]);
        }
        return;
      }

      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const outgoingEdges = flow.edges.filter(e => e.source === nodeId);
      for (const edge of outgoingEdges) {
        dfs(edge.target, [...path]);
      }

      recursionStack.delete(nodeId);
    };

    for (const node of flow.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return paths;
  }

  /**
   * Check if validation type is valid
   * @param {string} validationType - Validation type
   * @returns {boolean} True if valid
   */
  isValidValidationType(validationType) {
    const validTypes = ['email', 'phone', 'url', 'number', 'date', 'time', 'regex'];
    return validTypes.includes(validationType);
  }

  /**
   * Validate a single node (for ad-hoc validation)
   * @param {object} node - Node to validate
   * @returns {object} Validation result
   */
  validateNode(node) {
    const errors = [];
    const warnings = [];

    // Check required fields
    for (const field of this.requiredNodeFields) {
      if (!(field in node)) {
        errors.push(`Missing required field '${field}'`);
      }
    }

    // Validate node type
    if (node.type && !this.validNodeTypes.includes(node.type)) {
      errors.push(`Invalid node type '${node.type}'`);
    }

    // Validate based on type
    const typeValidation = this.validateNodeType(node);
    errors.push(...typeValidation.errors);
    warnings.push(...typeValidation.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate a single edge (for ad-hoc validation)
   * @param {object} edge - Edge to validate
   * @param {array} nodeIds - Valid node IDs (optional)
   * @returns {object} Validation result
   */
  validateEdge(edge, nodeIds = null) {
    const errors = [];
    const warnings = [];

    // Check required fields
    for (const field of this.requiredEdgeFields) {
      if (!(field in edge)) {
        errors.push(`Missing required field '${field}'`);
      }
    }

    // Validate node references if nodeIds provided
    if (nodeIds) {
      if (edge.source && !nodeIds.includes(edge.source)) {
        errors.push(`Source node '${edge.source}' does not exist`);
      }
      if (edge.target && !nodeIds.includes(edge.target)) {
        errors.push(`Target node '${edge.target}' does not exist`);
      }
    }

    // Check for self-referencing
    if (edge.source === edge.target) {
      warnings.push('Edge connects node to itself');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = FlowValidator;
