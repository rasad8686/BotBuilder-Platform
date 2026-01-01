const FlowValidator = require('../../../services/flowBuilder/FlowValidator');

describe('FlowValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new FlowValidator();
  });

  describe('validateFlow', () => {
    it('should validate a valid flow', () => {
      const flow = {
        id: 'flow_1',
        nodes: [
          { id: 'start_1', type: 'start', data: { label: 'Start' }, isStart: true },
          { id: 'msg_1', type: 'message', data: { content: 'Hello' } },
          { id: 'end_1', type: 'end', data: { content: 'Done' } }
        ],
        edges: [
          { id: 'e1', source: 'start_1', target: 'msg_1' },
          { id: 'e2', source: 'msg_1', target: 'end_1' }
        ]
      };

      const result = validator.validateFlow(flow);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail if flow is null', () => {
      const result = validator.validateFlow(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Flow is null or undefined');
    });

    it('should fail if nodes is not an array', () => {
      const flow = {
        nodes: 'not an array',
        edges: []
      };

      const result = validator.validateFlow(flow);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Flow must have a nodes array');
    });

    it('should fail if edges is not an array', () => {
      const flow = {
        nodes: [],
        edges: 'not an array'
      };

      const result = validator.validateFlow(flow);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Flow must have an edges array');
    });

    it('should warn if flow has no nodes', () => {
      const flow = {
        nodes: [],
        edges: []
      };

      const result = validator.validateFlow(flow);

      expect(result.warnings).toContain('Flow has no nodes');
    });

    it('should validate variables if present', () => {
      const flow = {
        nodes: [{ id: 'start_1', type: 'start', data: {}, isStart: true }],
        edges: [],
        variables: [
          { name: 'var1', type: 'string' },
          { name: 'var1', type: 'number' } // Duplicate
        ]
      };

      const result = validator.validateFlow(flow);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate variable name'))).toBe(true);
    });

    it('should detect missing start node', () => {
      const flow = {
        nodes: [
          { id: 'msg_1', type: 'message', data: {} }
        ],
        edges: []
      };

      const result = validator.validateFlow(flow);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Flow must have at least one start node');
    });

    it('should warn about multiple start nodes', () => {
      const flow = {
        nodes: [
          { id: 'start_1', type: 'start', data: {}, isStart: true },
          { id: 'start_2', type: 'start', data: {}, isStart: true }
        ],
        edges: []
      };

      const result = validator.validateFlow(flow);

      expect(result.warnings).toContain('Flow has multiple start nodes');
    });

    it('should warn if no end nodes', () => {
      const flow = {
        nodes: [
          { id: 'start_1', type: 'start', data: {}, isStart: true },
          { id: 'msg_1', type: 'message', data: {} }
        ],
        edges: [{ id: 'e1', source: 'start_1', target: 'msg_1' }]
      };

      const result = validator.validateFlow(flow);

      expect(result.warnings).toContain('Flow has no end nodes');
    });
  });

  describe('validateNodes', () => {
    it('should validate all required node fields', () => {
      const nodes = [
        { id: 'node_1', type: 'message', data: {} },
        { type: 'message', data: {} } // Missing id
      ];

      const result = validator.validateNodes(nodes);

      expect(result.errors.some(e => e.includes("Missing required field 'id'"))).toBe(true);
    });

    it('should detect duplicate node IDs', () => {
      const nodes = [
        { id: 'node_1', type: 'message', data: {} },
        { id: 'node_1', type: 'message', data: {} }
      ];

      const result = validator.validateNodes(nodes);

      expect(result.errors.some(e => e.includes('Duplicate node ID'))).toBe(true);
    });

    it('should validate node types', () => {
      const nodes = [
        { id: 'node_1', type: 'invalid_type', data: {} }
      ];

      const result = validator.validateNodes(nodes);

      expect(result.errors.some(e => e.includes('Invalid node type'))).toBe(true);
    });

    it('should validate message nodes', () => {
      const nodes = [
        { id: 'msg_1', type: 'message', data: {} }
      ];

      const result = validator.validateNodes(nodes);

      expect(result.warnings.some(w => w.includes('has no content or label'))).toBe(true);
    });

    it('should validate question nodes require options', () => {
      const nodes = [
        { id: 'q_1', type: 'question', data: {} }
      ];

      const result = validator.validateNodes(nodes);

      expect(result.errors.some(e => e.includes('must have options array'))).toBe(true);
    });

    it('should warn if question has no options', () => {
      const nodes = [
        { id: 'q_1', type: 'question', data: { options: [] } }
      ];

      const result = validator.validateNodes(nodes);

      expect(result.warnings.some(w => w.includes('has no options'))).toBe(true);
    });

    it('should validate input nodes require variableName', () => {
      const nodes = [
        { id: 'input_1', type: 'input', data: {} }
      ];

      const result = validator.validateNodes(nodes);

      expect(result.errors.some(e => e.includes('must specify variableName'))).toBe(true);
    });

    it('should validate condition nodes require conditions', () => {
      const nodes = [
        { id: 'cond_1', type: 'condition', data: {} }
      ];

      const result = validator.validateNodes(nodes);

      expect(result.errors.some(e => e.includes('must have conditions array'))).toBe(true);
    });

    it('should validate condition operators and values', () => {
      const nodes = [
        {
          id: 'cond_1',
          type: 'condition',
          data: {
            conditions: [
              { operator: 'eq' } // Missing value
            ]
          }
        }
      ];

      const result = validator.validateNodes(nodes);

      expect(result.errors.some(e => e.includes('must have operator and value'))).toBe(true);
    });

    it('should validate API call nodes require endpoint', () => {
      const nodes = [
        { id: 'api_1', type: 'api_call', data: {} }
      ];

      const result = validator.validateNodes(nodes);

      expect(result.errors.some(e => e.includes('must have endpoint'))).toBe(true);
    });

    it('should validate set_variable nodes require variableName', () => {
      const nodes = [
        { id: 'set_1', type: 'set_variable', data: {} }
      ];

      const result = validator.validateNodes(nodes);

      expect(result.errors.some(e => e.includes('must specify variableName'))).toBe(true);
    });

    it('should validate webhook nodes require URL', () => {
      const nodes = [
        { id: 'hook_1', type: 'webhook', data: {} }
      ];

      const result = validator.validateNodes(nodes);

      expect(result.errors.some(e => e.includes('must have URL'))).toBe(true);
    });

    it('should validate goto nodes require targetNodeId', () => {
      const nodes = [
        { id: 'goto_1', type: 'goto', data: {} }
      ];

      const result = validator.validateNodes(nodes);

      expect(result.errors.some(e => e.includes('must specify targetNodeId'))).toBe(true);
    });

    it('should accept valid action nodes', () => {
      const nodes = [
        { id: 'action_1', type: 'action', data: { actionType: 'handoff' } }
      ];

      const result = validator.validateNodes(nodes);

      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid email nodes', () => {
      const nodes = [
        { id: 'email_1', type: 'email', data: { subject: 'Test', template: 'welcome' } }
      ];

      const result = validator.validateNodes(nodes);

      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateEdges', () => {
    const nodes = [
      { id: 'node_1', type: 'message', data: {} },
      { id: 'node_2', type: 'message', data: {} }
    ];

    it('should validate all required edge fields', () => {
      const edges = [
        { id: 'e1', source: 'node_1', target: 'node_2' },
        { source: 'node_1', target: 'node_2' } // Missing id
      ];

      const result = validator.validateEdges(edges, nodes);

      expect(result.errors.some(e => e.includes("Missing required field 'id'"))).toBe(true);
    });

    it('should detect duplicate edge IDs', () => {
      const edges = [
        { id: 'e1', source: 'node_1', target: 'node_2' },
        { id: 'e1', source: 'node_1', target: 'node_2' }
      ];

      const result = validator.validateEdges(edges, nodes);

      expect(result.errors.some(e => e.includes('Duplicate edge ID'))).toBe(true);
    });

    it('should validate source node exists', () => {
      const edges = [
        { id: 'e1', source: 'nonexistent', target: 'node_2' }
      ];

      const result = validator.validateEdges(edges, nodes);

      expect(result.errors.some(e => e.includes('Source node'))).toBe(true);
      expect(result.errors.some(e => e.includes('does not exist'))).toBe(true);
    });

    it('should validate target node exists', () => {
      const edges = [
        { id: 'e1', source: 'node_1', target: 'nonexistent' }
      ];

      const result = validator.validateEdges(edges, nodes);

      expect(result.errors.some(e => e.includes('Target node'))).toBe(true);
      expect(result.errors.some(e => e.includes('does not exist'))).toBe(true);
    });

    it('should warn about self-referencing edges', () => {
      const edges = [
        { id: 'e1', source: 'node_1', target: 'node_1' }
      ];

      const result = validator.validateEdges(edges, nodes);

      expect(result.warnings.some(w => w.includes('connects node to itself'))).toBe(true);
    });

    it('should accept valid edges', () => {
      const edges = [
        { id: 'e1', source: 'node_1', target: 'node_2' }
      ];

      const result = validator.validateEdges(edges, nodes);

      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateStructure', () => {
    it('should detect unreachable nodes', () => {
      const flow = {
        nodes: [
          { id: 'start_1', type: 'start', data: {}, isStart: true },
          { id: 'node_1', type: 'message', data: {} },
          { id: 'node_2', type: 'message', data: {} }
        ],
        edges: [
          { id: 'e1', source: 'start_1', target: 'node_1' }
          // node_2 is unreachable
        ]
      };

      const result = validator.validateStructure(flow);

      expect(result.warnings.some(w => w.includes('unreachable node'))).toBe(true);
      expect(result.warnings.some(w => w.includes('node_2'))).toBe(true);
    });

    it('should detect orphaned nodes', () => {
      const flow = {
        nodes: [
          { id: 'start_1', type: 'start', data: {}, isStart: true },
          { id: 'orphan', type: 'message', data: {} }
        ],
        edges: []
      };

      const result = validator.validateStructure(flow);

      expect(result.warnings.some(w => w.includes('orphaned node'))).toBe(true);
    });

    it('should not mark start nodes as orphaned', () => {
      const flow = {
        nodes: [
          { id: 'start_1', type: 'start', data: {}, isStart: true }
        ],
        edges: []
      };

      const result = validator.validateStructure(flow);

      expect(result.warnings.some(w => w.includes('orphaned'))).toBe(false);
    });

    it('should warn about circular paths', () => {
      const flow = {
        nodes: [
          { id: 'start_1', type: 'start', data: {}, isStart: true },
          { id: 'node_1', type: 'message', data: {} },
          { id: 'node_2', type: 'message', data: {} }
        ],
        edges: [
          { id: 'e1', source: 'start_1', target: 'node_1' },
          { id: 'e2', source: 'node_1', target: 'node_2' },
          { id: 'e3', source: 'node_2', target: 'node_1' } // Creates cycle
        ]
      };

      const result = validator.validateStructure(flow);

      expect(result.warnings.some(w => w.includes('circular paths'))).toBe(true);
    });

    it('should warn if start node has incoming edges', () => {
      const flow = {
        nodes: [
          { id: 'start_1', type: 'start', data: {}, isStart: true },
          { id: 'node_1', type: 'message', data: {} }
        ],
        edges: [
          { id: 'e1', source: 'node_1', target: 'start_1' }
        ]
      };

      const result = validator.validateStructure(flow);

      expect(result.warnings.some(w => w.includes('Start node') && w.includes('incoming edges'))).toBe(true);
    });
  });

  describe('validateVariables', () => {
    it('should validate variable array', () => {
      const variables = [
        { name: 'var1', type: 'string' },
        { name: 'var2', type: 'number' }
      ];

      const result = validator.validateVariables(variables);

      expect(result.errors).toHaveLength(0);
    });

    it('should fail if variables is not an array', () => {
      const result = validator.validateVariables('not an array');

      expect(result.errors).toContain('Variables must be an array');
    });

    it('should require variable name', () => {
      const variables = [
        { type: 'string' } // Missing name
      ];

      const result = validator.validateVariables(variables);

      expect(result.errors.some(e => e.includes('Missing variable name'))).toBe(true);
    });

    it('should detect duplicate variable names', () => {
      const variables = [
        { name: 'var1', type: 'string' },
        { name: 'var1', type: 'number' }
      ];

      const result = validator.validateVariables(variables);

      expect(result.errors.some(e => e.includes('Duplicate variable name'))).toBe(true);
    });

    it('should validate variable name format', () => {
      const variables = [
        { name: '123invalid', type: 'string' }, // Can't start with number
        { name: 'valid_name', type: 'string' },
        { name: '_alsoValid', type: 'string' }
      ];

      const result = validator.validateVariables(variables);

      expect(result.errors.some(e => e.includes('Invalid variable name'))).toBe(true);
      expect(result.errors.some(e => e.includes('123invalid'))).toBe(true);
    });

    it('should warn about unknown variable types', () => {
      const variables = [
        { name: 'var1', type: 'unknown_type' }
      ];

      const result = validator.validateVariables(variables);

      expect(result.warnings.some(w => w.includes('Unknown variable type'))).toBe(true);
    });

    it('should accept valid variable types', () => {
      const variables = [
        { name: 'str', type: 'string' },
        { name: 'num', type: 'number' },
        { name: 'bool', type: 'boolean' },
        { name: 'arr', type: 'array' },
        { name: 'obj', type: 'object' }
      ];

      const result = validator.validateVariables(variables);

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('findReachableNodes', () => {
    it('should find all reachable nodes from start', () => {
      const flow = {
        nodes: [
          { id: 'start_1', type: 'start', data: {}, isStart: true },
          { id: 'node_1', type: 'message', data: {} },
          { id: 'node_2', type: 'message', data: {} }
        ],
        edges: [
          { id: 'e1', source: 'start_1', target: 'node_1' },
          { id: 'e2', source: 'node_1', target: 'node_2' }
        ]
      };

      const startNode = flow.nodes[0];
      const reachable = validator.findReachableNodes(startNode, flow);

      expect(reachable.size).toBe(3);
      expect(reachable.has('start_1')).toBe(true);
      expect(reachable.has('node_1')).toBe(true);
      expect(reachable.has('node_2')).toBe(true);
    });

    it('should handle branching paths', () => {
      const flow = {
        nodes: [
          { id: 'start_1', type: 'start', data: {}, isStart: true },
          { id: 'cond_1', type: 'condition', data: {} },
          { id: 'branch_a', type: 'message', data: {} },
          { id: 'branch_b', type: 'message', data: {} }
        ],
        edges: [
          { id: 'e1', source: 'start_1', target: 'cond_1' },
          { id: 'e2', source: 'cond_1', target: 'branch_a', label: 'yes' },
          { id: 'e3', source: 'cond_1', target: 'branch_b', label: 'no' }
        ]
      };

      const startNode = flow.nodes[0];
      const reachable = validator.findReachableNodes(startNode, flow);

      expect(reachable.size).toBe(4);
      expect(reachable.has('branch_a')).toBe(true);
      expect(reachable.has('branch_b')).toBe(true);
    });

    it('should not include unreachable nodes', () => {
      const flow = {
        nodes: [
          { id: 'start_1', type: 'start', data: {}, isStart: true },
          { id: 'node_1', type: 'message', data: {} },
          { id: 'unreachable', type: 'message', data: {} }
        ],
        edges: [
          { id: 'e1', source: 'start_1', target: 'node_1' }
        ]
      };

      const startNode = flow.nodes[0];
      const reachable = validator.findReachableNodes(startNode, flow);

      expect(reachable.has('unreachable')).toBe(false);
    });
  });

  describe('findCircularPaths', () => {
    it('should detect simple circular path', () => {
      const flow = {
        nodes: [
          { id: 'node_1', type: 'message', data: {} },
          { id: 'node_2', type: 'message', data: {} }
        ],
        edges: [
          { id: 'e1', source: 'node_1', target: 'node_2' },
          { id: 'e2', source: 'node_2', target: 'node_1' }
        ]
      };

      const paths = validator.findCircularPaths(flow);

      expect(paths.length).toBeGreaterThan(0);
    });

    it('should detect self-loop', () => {
      const flow = {
        nodes: [
          { id: 'node_1', type: 'message', data: {} }
        ],
        edges: [
          { id: 'e1', source: 'node_1', target: 'node_1' }
        ]
      };

      const paths = validator.findCircularPaths(flow);

      expect(paths.length).toBeGreaterThan(0);
    });

    it('should not detect cycles in acyclic flow', () => {
      const flow = {
        nodes: [
          { id: 'node_1', type: 'message', data: {} },
          { id: 'node_2', type: 'message', data: {} },
          { id: 'node_3', type: 'message', data: {} }
        ],
        edges: [
          { id: 'e1', source: 'node_1', target: 'node_2' },
          { id: 'e2', source: 'node_2', target: 'node_3' }
        ]
      };

      const paths = validator.findCircularPaths(flow);

      expect(paths.length).toBe(0);
    });
  });

  describe('validateNode', () => {
    it('should validate a single node', () => {
      const node = {
        id: 'msg_1',
        type: 'message',
        data: { content: 'Hello' }
      };

      const result = validator.validateNode(node);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const node = {
        type: 'message'
        // Missing id and data
      };

      const result = validator.validateNode(node);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate node type', () => {
      const node = {
        id: 'node_1',
        type: 'invalid_type',
        data: {}
      };

      const result = validator.validateNode(node);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid node type'))).toBe(true);
    });
  });

  describe('validateEdge', () => {
    it('should validate a single edge', () => {
      const edge = {
        id: 'e1',
        source: 'node_1',
        target: 'node_2'
      };

      const result = validator.validateEdge(edge);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const edge = {
        source: 'node_1'
        // Missing id and target
      };

      const result = validator.validateEdge(edge);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate node references when nodeIds provided', () => {
      const edge = {
        id: 'e1',
        source: 'node_1',
        target: 'nonexistent'
      };

      const result = validator.validateEdge(edge, ['node_1', 'node_2']);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('does not exist'))).toBe(true);
    });

    it('should warn about self-referencing edge', () => {
      const edge = {
        id: 'e1',
        source: 'node_1',
        target: 'node_1'
      };

      const result = validator.validateEdge(edge);

      expect(result.warnings.some(w => w.includes('connects node to itself'))).toBe(true);
    });
  });

  describe('isValidValidationType', () => {
    it('should recognize valid validation types', () => {
      expect(validator.isValidValidationType('email')).toBe(true);
      expect(validator.isValidValidationType('phone')).toBe(true);
      expect(validator.isValidValidationType('url')).toBe(true);
      expect(validator.isValidValidationType('number')).toBe(true);
      expect(validator.isValidValidationType('date')).toBe(true);
      expect(validator.isValidValidationType('time')).toBe(true);
      expect(validator.isValidValidationType('regex')).toBe(true);
    });

    it('should reject invalid validation types', () => {
      expect(validator.isValidValidationType('unknown')).toBe(false);
      expect(validator.isValidValidationType('custom')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle flow with only start node', () => {
      const flow = {
        nodes: [
          { id: 'start_1', type: 'start', data: {}, isStart: true }
        ],
        edges: []
      };

      const result = validator.validateFlow(flow);

      expect(result.valid).toBe(true);
    });

    it('should handle complex branching flow', () => {
      const flow = {
        nodes: [
          { id: 'start_1', type: 'start', data: {}, isStart: true },
          { id: 'menu_1', type: 'menu', data: { options: ['a', 'b', 'c'] } },
          { id: 'option_a', type: 'message', data: { content: 'A' } },
          { id: 'option_b', type: 'message', data: { content: 'B' } },
          { id: 'option_c', type: 'message', data: { content: 'C' } },
          { id: 'end_1', type: 'end', data: {} }
        ],
        edges: [
          { id: 'e1', source: 'start_1', target: 'menu_1' },
          { id: 'e2', source: 'menu_1', target: 'option_a', label: 'a' },
          { id: 'e3', source: 'menu_1', target: 'option_b', label: 'b' },
          { id: 'e4', source: 'menu_1', target: 'option_c', label: 'c' },
          { id: 'e5', source: 'option_a', target: 'end_1' },
          { id: 'e6', source: 'option_b', target: 'end_1' },
          { id: 'e7', source: 'option_c', target: 'end_1' }
        ]
      };

      const result = validator.validateFlow(flow);

      expect(result.valid).toBe(true);
    });

    it('should handle node with missing data gracefully', () => {
      const node = {
        id: 'node_1',
        type: 'message'
        // Missing data
      };

      const result = validator.validateNode(node);

      expect(result.errors.some(e => e.includes('Missing data object'))).toBe(true);
    });

    it('should validate input node with validation type', () => {
      const nodes = [
        {
          id: 'input_1',
          type: 'input',
          data: {
            variableName: 'email',
            validation: 'email'
          }
        }
      ];

      const result = validator.validateNodes(nodes);

      expect(result.errors).toHaveLength(0);
    });

    it('should warn about unknown validation type', () => {
      const nodes = [
        {
          id: 'input_1',
          type: 'input',
          data: {
            variableName: 'value',
            validation: 'unknown_validation'
          }
        }
      ];

      const result = validator.validateNodes(nodes);

      expect(result.warnings.some(w => w.includes('Unknown validation type'))).toBe(true);
    });
  });
});
