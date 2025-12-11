/**
 * WorkflowParser Tests
 * Tests for server/agents/workflows/WorkflowParser.js
 */

const WorkflowParser = require('../../../agents/workflows/WorkflowParser');

describe('WorkflowParser', () => {
  let parser;

  beforeEach(() => {
    parser = new WorkflowParser();
  });

  describe('constructor', () => {
    it('should initialize supported types', () => {
      expect(parser.supportedTypes).toContain('sequential');
      expect(parser.supportedTypes).toContain('parallel');
      expect(parser.supportedTypes).toContain('conditional');
      expect(parser.supportedTypes).toContain('mixed');
    });
  });

  describe('parse', () => {
    it('should parse basic workflow', () => {
      const workflow = {
        id: 1,
        name: 'Test Workflow',
        workflow_type: 'sequential',
        bot_id: 1,
        entry_agent_id: 1,
        is_default: true,
        is_active: true,
        agents_config: [
          { agentId: 1, order: 0, role: 'router' },
          { agentId: 2, order: 1, role: 'writer' }
        ],
        flow_config: {
          routes: [],
          stages: [],
          conditions: []
        }
      };

      const parsed = parser.parse(workflow);

      expect(parsed.id).toBe(1);
      expect(parsed.name).toBe('Test Workflow');
      expect(parsed.type).toBe('sequential');
      expect(parsed.agents).toHaveLength(2);
      expect(parsed.executionOrder).toEqual([1, 2]);
    });

    it('should default to sequential type', () => {
      const workflow = { id: 1, name: 'Test' };

      const parsed = parser.parse(workflow);

      expect(parsed.type).toBe('sequential');
    });
  });

  describe('parseAgentsConfig', () => {
    it('should parse agent configurations', () => {
      const config = [
        { agentId: 1, order: 0, role: 'router', config: { key: 'value' } },
        { id: 2, role: 'writer', dependsOn: [1] }
      ];

      const agents = parser.parseAgentsConfig(config);

      expect(agents).toHaveLength(2);
      expect(agents[0].agentId).toBe(1);
      expect(agents[0].order).toBe(0);
      expect(agents[1].agentId).toBe(2);
      expect(agents[1].order).toBe(1); // Defaults to index
      expect(agents[1].dependsOn).toEqual([1]);
    });
  });

  describe('parseFlowConfig', () => {
    it('should parse flow configuration', () => {
      const config = {
        routes: [{ fromAgentId: 1, targetAgentId: 2 }],
        stages: [{ type: 'sequential', agents: [1, 2] }],
        conditions: [{ field: 'intent', value: 'support' }],
        fallback: { agentId: 3 }
      };

      const flow = parser.parseFlowConfig(config);

      expect(flow.routes).toHaveLength(1);
      expect(flow.stages).toHaveLength(1);
      expect(flow.conditions).toHaveLength(1);
      expect(flow.fallback).toEqual({ agentId: 3 });
    });

    it('should use defaults for empty config', () => {
      const flow = parser.parseFlowConfig({});

      expect(flow.routes).toEqual([]);
      expect(flow.stages).toEqual([]);
      expect(flow.conditions).toEqual([]);
      expect(flow.fallback).toBeNull();
    });
  });

  describe('validate', () => {
    it('should validate workflow with all required fields', () => {
      const workflow = {
        name: 'Valid Workflow',
        bot_id: 1,
        agents_config: [{ agentId: 1 }]
      };

      const result = parser.validate(workflow);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error if name is missing', () => {
      const workflow = {
        bot_id: 1,
        agents_config: [{ agentId: 1 }]
      };

      const result = parser.validate(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Workflow name is required');
    });

    it('should error if bot_id is missing', () => {
      const workflow = {
        name: 'Test',
        agents_config: [{ agentId: 1 }]
      };

      const result = parser.validate(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Bot ID is required');
    });

    it('should error for unsupported workflow type', () => {
      const workflow = {
        name: 'Test',
        bot_id: 1,
        workflow_type: 'unknown',
        agents_config: [{ agentId: 1 }]
      };

      const result = parser.validate(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unsupported workflow type');
    });

    it('should error if no agents', () => {
      const workflow = {
        name: 'Test',
        bot_id: 1,
        agents_config: []
      };

      const result = parser.validate(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one agent is required');
    });

    it('should error if agent missing agentId', () => {
      const workflow = {
        name: 'Test',
        bot_id: 1,
        agents_config: [{ role: 'router' }]
      };

      const result = parser.validate(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('missing agentId');
    });

    it('should warn for duplicate agent IDs', () => {
      const workflow = {
        name: 'Test',
        bot_id: 1,
        agents_config: [{ agentId: 1 }, { agentId: 1 }]
      };

      const result = parser.validate(workflow);

      expect(result.warnings).toContain('Duplicate agent ID: 1');
    });

    it('should error for unknown dependency', () => {
      const workflow = {
        name: 'Test',
        bot_id: 1,
        agents_config: [
          { agentId: 1, dependsOn: [999] }
        ]
      };

      const result = parser.validate(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('depends on unknown agent');
    });

    it('should require entry_agent_id for conditional workflow', () => {
      const workflow = {
        name: 'Test',
        bot_id: 1,
        workflow_type: 'conditional',
        agents_config: [{ agentId: 1 }]
      };

      const result = parser.validate(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Conditional workflow requires entry_agent_id');
    });

    it('should warn if conditional workflow has no routes', () => {
      const workflow = {
        name: 'Test',
        bot_id: 1,
        workflow_type: 'conditional',
        entry_agent_id: 1,
        agents_config: [{ agentId: 1 }],
        flow_config: { routes: [] }
      };

      const result = parser.validate(workflow);

      expect(result.warnings).toContain('Conditional workflow has no routes defined');
    });

    it('should error for circular routes', () => {
      const workflow = {
        name: 'Test',
        bot_id: 1,
        workflow_type: 'conditional',
        entry_agent_id: 1,
        agents_config: [{ agentId: 1 }, { agentId: 2 }],
        flow_config: {
          routes: [
            { fromAgentId: 1, targetAgentId: 2 },
            { fromAgentId: 2, targetAgentId: 1 }
          ]
        }
      };

      const result = parser.validate(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Circular route detected');
    });

    it('should require stages for mixed workflow', () => {
      const workflow = {
        name: 'Test',
        bot_id: 1,
        workflow_type: 'mixed',
        agents_config: [{ agentId: 1 }],
        flow_config: { stages: [] }
      };

      const result = parser.validate(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Mixed workflow requires stages in flow_config');
    });

    it('should validate stage types in mixed workflow', () => {
      const workflow = {
        name: 'Test',
        bot_id: 1,
        workflow_type: 'mixed',
        agents_config: [{ agentId: 1 }],
        flow_config: {
          stages: [
            { type: 'invalid', agents: [1] }
          ]
        }
      };

      const result = parser.validate(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Stage 0 has invalid type');
    });

    it('should validate stages have agents', () => {
      const workflow = {
        name: 'Test',
        bot_id: 1,
        workflow_type: 'mixed',
        agents_config: [{ agentId: 1 }],
        flow_config: {
          stages: [
            { type: 'sequential', agents: [] }
          ]
        }
      };

      const result = parser.validate(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Stage 0 has no agents');
    });
  });

  describe('getExecutionOrder', () => {
    it('should return sequential order', () => {
      const parsed = {
        type: 'sequential',
        agents: [
          { agentId: 2, order: 1 },
          { agentId: 1, order: 0 }
        ]
      };

      const order = parser.getExecutionOrder(parsed);

      expect(order).toEqual([1, 2]);
    });

    it('should return parallel execution', () => {
      const parsed = {
        type: 'parallel',
        agents: [
          { agentId: 1 },
          { agentId: 2 }
        ]
      };

      const order = parser.getExecutionOrder(parsed);

      expect(order).toEqual([[1, 2]]);
    });

    it('should return entry agent for conditional', () => {
      const parsed = {
        type: 'conditional',
        entryAgentId: 5,
        agents: []
      };

      const order = parser.getExecutionOrder(parsed);

      expect(order).toEqual([5]);
    });

    it('should return empty for conditional without entry', () => {
      const parsed = {
        type: 'conditional',
        agents: []
      };

      const order = parser.getExecutionOrder(parsed);

      expect(order).toEqual([]);
    });

    it('should return stages for mixed', () => {
      const parsed = {
        type: 'mixed',
        agents: [],
        flow: {
          stages: [
            { type: 'sequential', agents: [1, 2] },
            { type: 'parallel', agents: [3, 4] }
          ]
        }
      };

      const order = parser.getExecutionOrder(parsed);

      expect(order).toHaveLength(2);
      expect(order[0]).toEqual({ type: 'sequential', agents: [1, 2] });
    });
  });

  describe('getConditions', () => {
    it('should extract conditions from routes', () => {
      const parsed = {
        flow: {
          routes: [
            { fromAgentId: 1, targetAgentId: 2, condition: 'intent === "support"' }
          ],
          conditions: []
        }
      };

      const conditions = parser.getConditions(parsed);

      expect(conditions).toHaveLength(1);
      expect(conditions[0].fromAgentId).toBe(1);
      expect(conditions[0].condition).toBe('intent === "support"');
    });

    it('should include flow conditions', () => {
      const parsed = {
        flow: {
          routes: [],
          conditions: [
            { field: 'sentiment', operator: '>', value: 0.5 }
          ]
        }
      };

      const conditions = parser.getConditions(parsed);

      expect(conditions).toHaveLength(1);
      expect(conditions[0].field).toBe('sentiment');
    });
  });

  describe('detectCircularRoutes', () => {
    it('should detect circular routes', () => {
      const routes = [
        { fromAgentId: 1, targetAgentId: 2 },
        { fromAgentId: 2, targetAgentId: 3 },
        { fromAgentId: 3, targetAgentId: 1 }
      ];

      const result = parser.detectCircularRoutes(routes);

      expect(result.hasCircular).toBe(true);
    });

    it('should not flag non-circular routes', () => {
      const routes = [
        { fromAgentId: 1, targetAgentId: 2 },
        { fromAgentId: 2, targetAgentId: 3 }
      ];

      const result = parser.detectCircularRoutes(routes);

      expect(result.hasCircular).toBe(false);
    });

    it('should handle empty routes', () => {
      const result = parser.detectCircularRoutes([]);

      expect(result.hasCircular).toBe(false);
    });
  });

  describe('toConfig', () => {
    it('should convert parsed workflow back to config', () => {
      const parsed = {
        id: 1,
        name: 'Test',
        type: 'sequential',
        botId: 1,
        entryAgentId: 1,
        isDefault: true,
        isActive: true,
        agents: [
          { agentId: 1, order: 0, role: 'router', dependsOn: [], config: {} }
        ],
        flow: {
          routes: [],
          stages: [],
          conditions: [],
          fallback: null
        }
      };

      const config = parser.toConfig(parsed);

      expect(config.id).toBe(1);
      expect(config.workflow_type).toBe('sequential');
      expect(config.bot_id).toBe(1);
      expect(config.agents_config).toHaveLength(1);
    });
  });
});
