/**
 * Comprehensive Flow Builder Services Tests
 * Tests for FlowEngine, FlowValidator, NodeExecutor, ConditionalLogic, WorkflowEngine, and FlowOptimizer
 */

jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../../websocket', () => ({
  getExecutionSocket: jest.fn(() => ({
    emitExecutionStart: jest.fn(),
    emitExecutionComplete: jest.fn(),
    emitExecutionError: jest.fn(),
    emitStepStart: jest.fn(),
    emitStepComplete: jest.fn(),
    emitStepFailed: jest.fn()
  }))
}));

jest.mock('../../../models/Agent', () => ({
  findById: jest.fn()
}));

jest.mock('../../../models/AgentWorkflow', () => ({
  findById: jest.fn()
}));

jest.mock('../../../models/WorkflowExecution', () => ({
  create: jest.fn(),
  update: jest.fn()
}));

jest.mock('../../../models/AgentExecutionStep', () => ({
  create: jest.fn(),
  complete: jest.fn(),
  fail: jest.fn()
}));

const FlowEngine = require('../../../services/flowBuilder/FlowEngine');
const FlowValidator = require('../../../services/flowBuilder/FlowValidator');
const NodeExecutor = require('../../../services/flowBuilder/NodeExecutor');
const WorkflowEngine = require('../../../agents/workflows/WorkflowEngine');
const log = require('../../../utils/logger');
const db = require('../../../db');
const AgentModel = require('../../../models/Agent');
const AgentWorkflow = require('../../../models/AgentWorkflow');
const WorkflowExecution = require('../../../models/WorkflowExecution');
const AgentExecutionStep = require('../../../models/AgentExecutionStep');

describe('Comprehensive Flow Builder Services Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // FlowEngine Tests
  // ============================================================================
  describe('FlowEngine - Flow Execution Engine', () => {
    let flowEngine;

    beforeEach(() => {
      flowEngine = new FlowEngine();
    });

    describe('Flow Creation and Initialization', () => {
      it('should create a new FlowEngine instance', () => {
        expect(flowEngine).toBeDefined();
        expect(flowEngine.nodeExecutor).toBeDefined();
        expect(flowEngine.validator).toBeDefined();
        expect(flowEngine.activeExecutions).toBeDefined();
      });

      it('should initialize with empty active executions', () => {
        expect(flowEngine.activeExecutions.size).toBe(0);
      });

      it('should generate unique execution IDs', () => {
        const id1 = flowEngine.generateExecutionId();
        const id2 = flowEngine.generateExecutionId();
        expect(id1).toMatch(/^exec_\d+_[a-z0-9]+$/);
        expect(id2).toMatch(/^exec_\d+_[a-z0-9]+$/);
        expect(id1).not.toBe(id2);
      });
    });

    describe('Flow Validation', () => {
      it('should validate flow before execution', async () => {
        const flow = {
          id: 'flow-1',
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'msg', type: 'message', data: { content: 'Hello' } },
            { id: 'end', type: 'end', data: {} }
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'msg' },
            { id: 'e2', source: 'msg', target: 'end' }
          ]
        };

        const result = await flowEngine.executeFlow(flow);
        expect(result.success).toBe(true);
        expect(result.executionId).toBeDefined();
      });

      it('should reject invalid flow structure', async () => {
        const invalidFlow = {
          id: 'flow-1',
          nodes: null,
          edges: []
        };

        const result = await flowEngine.executeFlow(invalidFlow);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Flow validation failed');
        expect(result.errors).toBeDefined();
      });

      it('should reject flow without start node', async () => {
        const flow = {
          id: 'flow-1',
          nodes: [
            { id: 'msg', type: 'message', data: { content: 'Hello' } }
          ],
          edges: []
        };

        const result = await flowEngine.executeFlow(flow);
        expect(result.success).toBe(false);
        expect(result.errors).toContain('Flow must have at least one start node');
      });

      it('should handle flow with duplicate node IDs', async () => {
        const flow = {
          id: 'flow-1',
          nodes: [
            { id: 'node-1', type: 'start', data: {} },
            { id: 'node-1', type: 'message', data: { content: 'Duplicate' } }
          ],
          edges: []
        };

        const result = await flowEngine.executeFlow(flow);
        expect(result.success).toBe(false);
      });
    });

    describe('Flow Execution', () => {
      it('should execute simple linear flow', async () => {
        const flow = {
          id: 'flow-1',
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'msg', type: 'message', data: { content: 'Hello' } },
            { id: 'end', type: 'end', data: {} }
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'msg' },
            { id: 'e2', source: 'msg', target: 'end' }
          ]
        };

        const result = await flowEngine.executeFlow(flow);
        expect(result.success).toBe(true);
        expect(result.finalState.status).toBe('completed');
        expect(result.result.outputs.length).toBeGreaterThan(0);
      });

      it('should track execution history', async () => {
        const flow = {
          id: 'flow-1',
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'msg', type: 'message', data: { content: 'Test' } },
            { id: 'end', type: 'end', data: {} }
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'msg' },
            { id: 'e2', source: 'msg', target: 'end' }
          ]
        };

        const result = await flowEngine.executeFlow(flow);
        expect(result.finalState.history.length).toBe(3);
        expect(result.finalState.history[0].nodeType).toBe('start');
        expect(result.finalState.history[1].nodeType).toBe('message');
        expect(result.finalState.history[2].nodeType).toBe('end');
      });

      it('should handle flow with variables', async () => {
        const flow = {
          id: 'flow-1',
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'set', type: 'set_variable', data: { variableName: 'name', value: 'John' } },
            { id: 'end', type: 'end', data: {} }
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'set' },
            { id: 'e2', source: 'set', target: 'end' }
          ],
          variables: [
            { name: 'name', type: 'string', defaultValue: '' }
          ]
        };

        const result = await flowEngine.executeFlow(flow);
        expect(result.success).toBe(true);
        expect(result.finalState.variables.name).toBe('John');
      });

      it('should prevent infinite loops with max iterations', async () => {
        const flow = {
          id: 'flow-1',
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'msg', type: 'message', data: { content: 'Loop' } }
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'msg' },
            { id: 'e2', source: 'msg', target: 'msg' }
          ]
        };

        const result = await flowEngine.executeFlow(flow);
        expect(result.result.status).toBe('error');
        expect(result.result.error).toContain('Maximum iterations exceeded');
      });
    });

    describe('Flow State Management', () => {
      it('should store active executions', async () => {
        const flow = {
          id: 'flow-1',
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'input', type: 'input', data: { variableName: 'name', content: 'Enter name' } }
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'input' }
          ]
        };

        const result = await flowEngine.executeFlow(flow);
        expect(flowEngine.activeExecutions.size).toBe(1);
        const state = flowEngine.getExecutionState(result.executionId);
        expect(state).toBeDefined();
        expect(state.id).toBe(result.executionId);
      });

      it('should retrieve execution state', async () => {
        const flow = {
          id: 'flow-1',
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'end', type: 'end', data: {} }
          ],
          edges: [{ id: 'e1', source: 'start', target: 'end' }]
        };

        const result = await flowEngine.executeFlow(flow);
        const state = flowEngine.getExecutionState(result.executionId);
        expect(state.flowId).toBe('flow-1');
        expect(state.status).toBe('completed');
      });

      it('should return null for non-existent execution', () => {
        const state = flowEngine.getExecutionState('non-existent');
        expect(state).toBeNull();
      });
    });

    describe('Flow Resume Functionality', () => {
      it('should resume paused flow with user input', async () => {
        const flow = {
          id: 'flow-1',
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'input', type: 'input', data: { variableName: 'name', content: 'Enter name' } },
            { id: 'end', type: 'end', data: {} }
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'input' },
            { id: 'e2', source: 'input', target: 'end' }
          ]
        };

        const result1 = await flowEngine.executeFlow(flow);
        expect(result1.result.status).toBe('waiting_input');

        const result2 = await flowEngine.resumeFlow(result1.executionId, { userInput: 'John' });
        expect(result2.success).toBe(true);
        expect(result2.finalState.status).toBe('completed');
        expect(result2.finalState.variables.name).toBe('John');
      });

      it('should handle resume of non-existent execution', async () => {
        const result = await flowEngine.resumeFlow('non-existent', { userInput: 'test' });
        expect(result.success).toBe(false);
        expect(result.error).toBe('Execution not found');
      });

      it('should update context on resume', async () => {
        const flow = {
          id: 'flow-1',
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'input', type: 'input', data: { variableName: 'age', content: 'Enter age' } },
            { id: 'end', type: 'end', data: {} }
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'input' },
            { id: 'e2', source: 'input', target: 'end' }
          ]
        };

        const result1 = await flowEngine.executeFlow(flow, { userId: '123' });
        const result2 = await flowEngine.resumeFlow(result1.executionId, { userInput: 25 });
        expect(result2.finalState.context.userId).toBe('123');
        expect(result2.finalState.context.userInput).toBe(25);
      });
    });

    describe('Variable Handling', () => {
      it('should initialize variables with default values', () => {
        const variableDefs = [
          { name: 'name', type: 'string', defaultValue: 'Guest' },
          { name: 'count', type: 'number', defaultValue: 0 },
          { name: 'active', type: 'boolean', defaultValue: true }
        ];

        const variables = flowEngine.initializeVariables(variableDefs, {});
        expect(variables.name).toBe('Guest');
        expect(variables.count).toBe(0);
        expect(variables.active).toBe(true);
      });

      it('should use context values over defaults', () => {
        const variableDefs = [
          { name: 'name', type: 'string', defaultValue: 'Guest' }
        ];

        const variables = flowEngine.initializeVariables(variableDefs, { name: 'John' });
        expect(variables.name).toBe('John');
      });

      it('should get default values for types', () => {
        expect(flowEngine.getDefaultValueForType('string')).toBe('');
        expect(flowEngine.getDefaultValueForType('number')).toBe(0);
        expect(flowEngine.getDefaultValueForType('boolean')).toBe(false);
        expect(flowEngine.getDefaultValueForType('array')).toEqual([]);
        expect(flowEngine.getDefaultValueForType('object')).toEqual({});
        expect(flowEngine.getDefaultValueForType('unknown')).toBeNull();
      });
    });

    describe('Conditional Logic Evaluation', () => {
      it('should evaluate equals condition', () => {
        const condition = { variable: 'status', operator: 'equals', value: 'active' };
        const variables = { status: 'active' };
        expect(flowEngine.evaluateCondition(condition, variables)).toBe(true);
      });

      it('should evaluate not equals condition', () => {
        const condition = { variable: 'status', operator: 'not_equals', value: 'inactive' };
        const variables = { status: 'active' };
        expect(flowEngine.evaluateCondition(condition, variables)).toBe(true);
      });

      it('should evaluate greater than condition', () => {
        const condition = { variable: 'age', operator: 'greater_than', value: 18 };
        const variables = { age: 25 };
        expect(flowEngine.evaluateCondition(condition, variables)).toBe(true);
      });

      it('should evaluate less than condition', () => {
        const condition = { variable: 'count', operator: 'less_than', value: 10 };
        const variables = { count: 5 };
        expect(flowEngine.evaluateCondition(condition, variables)).toBe(true);
      });

      it('should evaluate contains condition', () => {
        const condition = { variable: 'text', operator: 'contains', value: 'hello' };
        const variables = { text: 'hello world' };
        expect(flowEngine.evaluateCondition(condition, variables)).toBe(true);
      });

      it('should evaluate starts_with condition', () => {
        const condition = { variable: 'text', operator: 'starts_with', value: 'hello' };
        const variables = { text: 'hello world' };
        expect(flowEngine.evaluateCondition(condition, variables)).toBe(true);
      });

      it('should evaluate ends_with condition', () => {
        const condition = { variable: 'text', operator: 'ends_with', value: 'world' };
        const variables = { text: 'hello world' };
        expect(flowEngine.evaluateCondition(condition, variables)).toBe(true);
      });

      it('should evaluate is_empty condition', () => {
        const condition = { variable: 'text', operator: 'is_empty' };
        expect(flowEngine.evaluateCondition(condition, { text: '' })).toBe(true);
        expect(flowEngine.evaluateCondition(condition, { text: 'value' })).toBe(false);
      });

      it('should evaluate is_not_empty condition', () => {
        const condition = { variable: 'text', operator: 'is_not_empty' };
        expect(flowEngine.evaluateCondition(condition, { text: 'value' })).toBe(true);
        expect(flowEngine.evaluateCondition(condition, { text: '' })).toBe(false);
      });
    });

    describe('Navigation and Edge Handling', () => {
      it('should find next node from edge', async () => {
        const flow = {
          nodes: [
            { id: 'node1', type: 'message', data: { content: 'Test' } },
            { id: 'node2', type: 'end', data: {} }
          ],
          edges: [
            { id: 'e1', source: 'node1', target: 'node2' }
          ]
        };

        const nextNode = await flowEngine.getNextNode(flow, 'node1', {}, {});
        expect(nextNode).toBe('node2');
      });

      it('should return null for end nodes', async () => {
        const flow = {
          nodes: [
            { id: 'end', type: 'end', data: {} }
          ],
          edges: []
        };

        const nextNode = await flowEngine.getNextNode(flow, 'end', {}, {});
        expect(nextNode).toBeNull();
      });

      it('should handle multiple edges with conditions', async () => {
        const flow = {
          nodes: [
            { id: 'cond', type: 'condition', data: {} },
            { id: 'yes', type: 'message', data: { content: 'Yes' } },
            { id: 'no', type: 'message', data: { content: 'No' } }
          ],
          edges: [
            { id: 'e1', source: 'cond', target: 'yes', condition: { variable: 'answer', operator: 'equals', value: 'yes' } },
            { id: 'e2', source: 'cond', target: 'no', label: 'default' }
          ]
        };

        const executionState = { variables: { answer: 'yes' } };
        const nextNode = await flowEngine.getNextNode(flow, 'cond', {}, executionState);
        expect(nextNode).toBe('yes');
      });

      it('should use default edge when no condition matches', async () => {
        const flow = {
          nodes: [
            { id: 'cond', type: 'condition', data: {} },
            { id: 'default', type: 'message', data: { content: 'Default' } }
          ],
          edges: [
            { id: 'e1', source: 'cond', target: 'default', label: 'default' }
          ]
        };

        const nextNode = await flowEngine.getNextNode(flow, 'cond', {}, { variables: {} });
        expect(nextNode).toBe('default');
      });
    });

    describe('Execution Cleanup', () => {
      it('should clean up old completed executions', async () => {
        const flow = {
          id: 'flow-1',
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'end', type: 'end', data: {} }
          ],
          edges: [{ id: 'e1', source: 'start', target: 'end' }]
        };

        await flowEngine.executeFlow(flow);
        expect(flowEngine.activeExecutions.size).toBe(1);

        flowEngine.cleanupExecutions(0); // Clean up all
        expect(flowEngine.activeExecutions.size).toBe(0);
      });

      it('should not clean up recent executions', async () => {
        const flow = {
          id: 'flow-1',
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'end', type: 'end', data: {} }
          ],
          edges: [{ id: 'e1', source: 'start', target: 'end' }]
        };

        await flowEngine.executeFlow(flow);
        flowEngine.cleanupExecutions(3600000); // 1 hour
        expect(flowEngine.activeExecutions.size).toBe(1);
      });

      it('should cancel active execution', async () => {
        const flow = {
          id: 'flow-1',
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'input', type: 'input', data: { variableName: 'name' } }
          ],
          edges: [{ id: 'e1', source: 'start', target: 'input' }]
        };

        const result = await flowEngine.executeFlow(flow);
        const cancelled = flowEngine.cancelExecution(result.executionId);
        expect(cancelled).toBe(true);

        const state = flowEngine.getExecutionState(result.executionId);
        expect(state.status).toBe('cancelled');
        expect(state.cancelledAt).toBeDefined();
      });

      it('should return false when cancelling non-existent execution', () => {
        const cancelled = flowEngine.cancelExecution('non-existent');
        expect(cancelled).toBe(false);
      });
    });

    describe('Error Handling', () => {
      it('should handle execution errors gracefully', async () => {
        const flow = {
          id: 'flow-1',
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'bad', type: 'invalid_type', data: {} }
          ],
          edges: [{ id: 'e1', source: 'start', target: 'bad' }]
        };

        const result = await flowEngine.executeFlow(flow);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should handle node not found error', async () => {
        const flow = {
          id: 'flow-1',
          nodes: [
            { id: 'start', type: 'start', data: {} }
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'missing' }
          ]
        };

        const result = await flowEngine.executeFlow(flow);
        expect(result.success).toBe(false);
      });
    });
  });

  // ============================================================================
  // FlowValidator Tests
  // ============================================================================
  describe('FlowValidator - Flow Validation Logic', () => {
    let validator;

    beforeEach(() => {
      validator = new FlowValidator();
    });

    describe('Validator Initialization', () => {
      it('should initialize with valid node types', () => {
        expect(validator.validNodeTypes).toContain('start');
        expect(validator.validNodeTypes).toContain('message');
        expect(validator.validNodeTypes).toContain('condition');
        expect(validator.validNodeTypes).toContain('api_call');
        expect(validator.validNodeTypes).toContain('end');
      });

      it('should have required field definitions', () => {
        expect(validator.requiredNodeFields).toEqual(['id', 'type', 'data']);
        expect(validator.requiredEdgeFields).toEqual(['id', 'source', 'target']);
      });
    });

    describe('Basic Flow Validation', () => {
      it('should validate correct flow', () => {
        const flow = {
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'end', type: 'end', data: {} }
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'end' }
          ]
        };

        const result = validator.validateFlow(flow);
        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
      });

      it('should reject null flow', () => {
        const result = validator.validateFlow(null);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Flow is null or undefined');
      });

      it('should reject flow without nodes', () => {
        const flow = { edges: [] };
        const result = validator.validateFlow(flow);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Flow must have a nodes array');
      });

      it('should reject flow without edges', () => {
        const flow = { nodes: [] };
        const result = validator.validateFlow(flow);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Flow must have an edges array');
      });
    });

    describe('Node Validation', () => {
      it('should detect missing required node fields', () => {
        const result = validator.validateNodes([
          { id: 'node1', type: 'message' }
        ]);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some(e => e.includes('data'))).toBe(true);
      });

      it('should detect duplicate node IDs', () => {
        const result = validator.validateNodes([
          { id: 'node1', type: 'start', data: {} },
          { id: 'node1', type: 'end', data: {} }
        ]);
        expect(result.errors.some(e => e.includes('Duplicate'))).toBe(true);
      });

      it('should detect invalid node types', () => {
        const result = validator.validateNodes([
          { id: 'node1', type: 'invalid_type', data: {} }
        ]);
        expect(result.errors.some(e => e.includes('Invalid node type'))).toBe(true);
      });

      it('should warn about empty node list', () => {
        const result = validator.validateNodes([]);
        expect(result.warnings).toContain('Flow has no nodes');
      });
    });

    describe('Specific Node Type Validation', () => {
      it('should validate message node', () => {
        const node = { id: 'msg', type: 'message', data: { content: 'Hello' } };
        const result = validator.validateNodeType(node);
        expect(result.errors.length).toBe(0);
      });

      it('should warn about empty message node', () => {
        const node = { id: 'msg', type: 'message', data: {} };
        const result = validator.validateNodeType(node);
        expect(result.warnings.length).toBeGreaterThan(0);
      });

      it('should require options for question node', () => {
        const node = { id: 'q', type: 'question', data: {} };
        const result = validator.validateNodeType(node);
        expect(result.errors.some(e => e.includes('options'))).toBe(true);
      });

      it('should validate question node with options', () => {
        const node = {
          id: 'q',
          type: 'question',
          data: { content: 'Choose?', options: ['Yes', 'No'] }
        };
        const result = validator.validateNodeType(node);
        expect(result.errors.length).toBe(0);
      });

      it('should require variableName for input node', () => {
        const node = { id: 'inp', type: 'input', data: {} };
        const result = validator.validateNodeType(node);
        expect(result.errors.some(e => e.includes('variableName'))).toBe(true);
      });

      it('should validate input node with variableName', () => {
        const node = {
          id: 'inp',
          type: 'input',
          data: { variableName: 'name', content: 'Enter name' }
        };
        const result = validator.validateNodeType(node);
        expect(result.errors.length).toBe(0);
      });

      it('should require conditions for condition node', () => {
        const node = { id: 'cond', type: 'condition', data: {} };
        const result = validator.validateNodeType(node);
        expect(result.errors.some(e => e.includes('conditions'))).toBe(true);
      });

      it('should validate condition node structure', () => {
        const node = {
          id: 'cond',
          type: 'condition',
          data: {
            conditions: [
              { operator: 'equals', value: 'test' }
            ]
          }
        };
        const result = validator.validateNodeType(node);
        expect(result.errors.length).toBe(0);
      });

      it('should require endpoint for api_call node', () => {
        const node = { id: 'api', type: 'api_call', data: {} };
        const result = validator.validateNodeType(node);
        expect(result.errors.some(e => e.includes('endpoint'))).toBe(true);
      });

      it('should validate api_call node', () => {
        const node = {
          id: 'api',
          type: 'api_call',
          data: { endpoint: 'https://api.example.com', method: 'GET' }
        };
        const result = validator.validateNodeType(node);
        expect(result.errors.length).toBe(0);
      });

      it('should require variableName for set_variable node', () => {
        const node = { id: 'set', type: 'set_variable', data: {} };
        const result = validator.validateNodeType(node);
        expect(result.errors.some(e => e.includes('variableName'))).toBe(true);
      });

      it('should require url for webhook node', () => {
        const node = { id: 'hook', type: 'webhook', data: {} };
        const result = validator.validateNodeType(node);
        expect(result.errors.some(e => e.includes('URL'))).toBe(true);
      });

      it('should require targetNodeId for goto node', () => {
        const node = { id: 'goto', type: 'goto', data: {} };
        const result = validator.validateNodeType(node);
        expect(result.errors.some(e => e.includes('targetNodeId'))).toBe(true);
      });
    });

    describe('Edge Validation', () => {
      it('should validate correct edges', () => {
        const nodes = [
          { id: 'node1', type: 'start', data: {} },
          { id: 'node2', type: 'end', data: {} }
        ];
        const edges = [
          { id: 'e1', source: 'node1', target: 'node2' }
        ];
        const result = validator.validateEdges(edges, nodes);
        expect(result.errors.length).toBe(0);
      });

      it('should detect missing edge fields', () => {
        const result = validator.validateEdges([{ id: 'e1' }], []);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should detect duplicate edge IDs', () => {
        const nodes = [{ id: 'n1', type: 'start', data: {} }];
        const edges = [
          { id: 'e1', source: 'n1', target: 'n1' },
          { id: 'e1', source: 'n1', target: 'n1' }
        ];
        const result = validator.validateEdges(edges, nodes);
        expect(result.errors.some(e => e.includes('Duplicate'))).toBe(true);
      });

      it('should detect non-existent source node', () => {
        const nodes = [{ id: 'node1', type: 'start', data: {} }];
        const edges = [{ id: 'e1', source: 'missing', target: 'node1' }];
        const result = validator.validateEdges(edges, nodes);
        expect(result.errors.some(e => e.includes('Source node'))).toBe(true);
      });

      it('should detect non-existent target node', () => {
        const nodes = [{ id: 'node1', type: 'start', data: {} }];
        const edges = [{ id: 'e1', source: 'node1', target: 'missing' }];
        const result = validator.validateEdges(edges, nodes);
        expect(result.errors.some(e => e.includes('Target node'))).toBe(true);
      });

      it('should warn about self-referencing edges', () => {
        const nodes = [{ id: 'node1', type: 'message', data: {} }];
        const edges = [{ id: 'e1', source: 'node1', target: 'node1' }];
        const result = validator.validateEdges(edges, nodes);
        expect(result.warnings.some(w => w.includes('itself'))).toBe(true);
      });
    });

    describe('Structure Validation', () => {
      it('should require start node', () => {
        const flow = {
          nodes: [{ id: 'msg', type: 'message', data: {} }],
          edges: []
        };
        const result = validator.validateStructure(flow);
        expect(result.errors.some(e => e.includes('start node'))).toBe(true);
      });

      it('should warn about multiple start nodes', () => {
        const flow = {
          nodes: [
            { id: 'start1', type: 'start', data: {} },
            { id: 'start2', type: 'start', data: {} }
          ],
          edges: []
        };
        const result = validator.validateStructure(flow);
        expect(result.warnings.some(w => w.includes('multiple start'))).toBe(true);
      });

      it('should warn about missing end nodes', () => {
        const flow = {
          nodes: [{ id: 'start', type: 'start', data: {} }],
          edges: []
        };
        const result = validator.validateStructure(flow);
        expect(result.warnings.some(w => w.includes('no end'))).toBe(true);
      });

      it('should detect unreachable nodes', () => {
        const flow = {
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'connected', type: 'message', data: {} },
            { id: 'unreachable', type: 'message', data: {} }
          ],
          edges: [{ id: 'e1', source: 'start', target: 'connected' }]
        };
        const result = validator.validateStructure(flow);
        expect(result.warnings.some(w => w.includes('unreachable'))).toBe(true);
      });

      it('should detect orphaned nodes', () => {
        const flow = {
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'orphan', type: 'message', data: {} }
          ],
          edges: []
        };
        const result = validator.validateStructure(flow);
        expect(result.warnings.some(w => w.includes('orphaned'))).toBe(true);
      });

      it('should detect circular paths', () => {
        const flow = {
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'a', type: 'message', data: {} },
            { id: 'b', type: 'message', data: {} }
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'a' },
            { id: 'e2', source: 'a', target: 'b' },
            { id: 'e3', source: 'b', target: 'a' }
          ]
        };
        const result = validator.validateStructure(flow);
        expect(result.warnings.some(w => w.includes('circular'))).toBe(true);
      });

      it('should warn about start nodes with incoming edges', () => {
        const flow = {
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'msg', type: 'message', data: {} }
          ],
          edges: [{ id: 'e1', source: 'msg', target: 'start' }]
        };
        const result = validator.validateStructure(flow);
        expect(result.warnings.some(w => w.includes('incoming edges'))).toBe(true);
      });
    });

    describe('Variable Validation', () => {
      it('should validate correct variables', () => {
        const variables = [
          { name: 'userName', type: 'string' },
          { name: 'userAge', type: 'number' }
        ];
        const result = validator.validateVariables(variables);
        expect(result.errors.length).toBe(0);
      });

      it('should reject non-array variables', () => {
        const result = validator.validateVariables('not-an-array');
        expect(result.errors).toContain('Variables must be an array');
      });

      it('should detect missing variable name', () => {
        const result = validator.validateVariables([
          { type: 'string' }
        ]);
        expect(result.errors.some(e => e.includes('Missing variable name'))).toBe(true);
      });

      it('should detect duplicate variable names', () => {
        const result = validator.validateVariables([
          { name: 'test', type: 'string' },
          { name: 'test', type: 'number' }
        ]);
        expect(result.errors.some(e => e.includes('Duplicate'))).toBe(true);
      });

      it('should validate variable name format', () => {
        const result = validator.validateVariables([
          { name: '123invalid', type: 'string' }
        ]);
        expect(result.errors.some(e => e.includes('Invalid variable name'))).toBe(true);
      });

      it('should accept valid variable names', () => {
        const result = validator.validateVariables([
          { name: 'validName', type: 'string' },
          { name: '_private', type: 'string' },
          { name: 'var123', type: 'number' }
        ]);
        expect(result.errors.length).toBe(0);
      });

      it('should warn about unknown variable types', () => {
        const result = validator.validateVariables([
          { name: 'test', type: 'unknown_type' }
        ]);
        expect(result.warnings.some(w => w.includes('Unknown variable type'))).toBe(true);
      });
    });

    describe('Single Node Validation', () => {
      it('should validate single node', () => {
        const node = { id: 'msg', type: 'message', data: { content: 'Test' } };
        const result = validator.validateNode(node);
        expect(result.valid).toBe(true);
      });

      it('should detect errors in single node', () => {
        const node = { id: 'api', type: 'api_call', data: {} };
        const result = validator.validateNode(node);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('Single Edge Validation', () => {
      it('should validate single edge', () => {
        const edge = { id: 'e1', source: 'n1', target: 'n2' };
        const result = validator.validateEdge(edge, ['n1', 'n2']);
        expect(result.valid).toBe(true);
      });

      it('should detect missing edge fields', () => {
        const edge = { id: 'e1' };
        const result = validator.validateEdge(edge);
        expect(result.valid).toBe(false);
      });

      it('should detect invalid node references', () => {
        const edge = { id: 'e1', source: 'n1', target: 'missing' };
        const result = validator.validateEdge(edge, ['n1', 'n2']);
        expect(result.valid).toBe(false);
      });
    });

    describe('Validation Type Checking', () => {
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
        expect(validator.isValidValidationType('invalid')).toBe(false);
        expect(validator.isValidValidationType('unknown')).toBe(false);
      });
    });
  });

  // ============================================================================
  // NodeExecutor Tests
  // ============================================================================
  describe('NodeExecutor - Node Execution Handling', () => {
    let executor;

    beforeEach(() => {
      executor = new NodeExecutor();
    });

    describe('Executor Initialization', () => {
      it('should initialize with node handlers', () => {
        expect(executor.nodeHandlers).toBeDefined();
        expect(executor.nodeHandlers.start).toBeDefined();
        expect(executor.nodeHandlers.message).toBeDefined();
        expect(executor.nodeHandlers.condition).toBeDefined();
        expect(executor.nodeHandlers.end).toBeDefined();
      });

      it('should have handlers for all node types', () => {
        const expectedTypes = [
          'start', 'message', 'question', 'menu', 'input', 'condition',
          'action', 'api_call', 'set_variable', 'delay', 'email',
          'webhook', 'ai_response', 'goto', 'end'
        ];
        expectedTypes.forEach(type => {
          expect(executor.nodeHandlers[type]).toBeDefined();
        });
      });
    });

    describe('Node Execution', () => {
      it('should execute start node', async () => {
        const node = { id: 'start', type: 'start', data: {} };
        const result = await executor.execute(node, { variables: {} });
        expect(result.success).toBe(true);
        expect(result.waitForInput).toBe(false);
      });

      it('should execute message node', async () => {
        const node = { id: 'msg', type: 'message', data: { content: 'Hello World' } };
        const result = await executor.execute(node, { variables: {} });
        expect(result.success).toBe(true);
        expect(result.output.type).toBe('message');
        expect(result.output.content).toBe('Hello World');
      });

      it('should execute end node', async () => {
        const node = { id: 'end', type: 'end', data: { content: 'Goodbye' } };
        const result = await executor.execute(node, { variables: {} });
        expect(result.success).toBe(true);
        expect(result.output.type).toBe('end');
      });

      it('should throw error for invalid node', async () => {
        const node = null;
        await expect(executor.execute(node, {})).rejects.toThrow('Invalid node');
      });

      it('should throw error for unknown node type', async () => {
        const node = { id: 'unknown', type: 'unknown_type', data: {} };
        await expect(executor.execute(node, {})).rejects.toThrow('No handler for node type');
      });
    });

    describe('Message Node Execution', () => {
      it('should substitute variables in message', async () => {
        const node = {
          id: 'msg',
          type: 'message',
          data: { content: 'Hello {{name}}!' }
        };
        const result = await executor.execute(node, { variables: { name: 'John' } });
        expect(result.output.content).toBe('Hello John!');
      });

      it('should handle message with label instead of content', async () => {
        const node = { id: 'msg', type: 'message', data: { label: 'Test Label' } };
        const result = await executor.execute(node, { variables: {} });
        expect(result.output.content).toBe('Test Label');
      });
    });

    describe('Question Node Execution', () => {
      it('should wait for user input on question node', async () => {
        const node = {
          id: 'q',
          type: 'question',
          data: { content: 'Choose?', options: ['Yes', 'No'] }
        };
        const result = await executor.execute(node, { variables: {}, context: {} });
        expect(result.waitForInput).toBe(true);
        expect(result.output.type).toBe('question');
        expect(result.output.options).toEqual(['Yes', 'No']);
      });

      it('should process user response on question node', async () => {
        const node = {
          id: 'q',
          type: 'question',
          data: { content: 'Choose?', options: ['Yes', 'No'], variableName: 'answer' }
        };
        const result = await executor.execute(node, {
          variables: {},
          context: { userResponse: 'Yes' }
        });
        expect(result.waitForInput).toBe(false);
        expect(result.variables.answer).toBe('Yes');
      });
    });

    describe('Menu Node Execution', () => {
      it('should wait for menu selection', async () => {
        const node = {
          id: 'menu',
          type: 'menu',
          data: { content: 'Select:', options: ['Option 1', 'Option 2'] }
        };
        const result = await executor.execute(node, { variables: {}, context: {} });
        expect(result.waitForInput).toBe(true);
        expect(result.output.type).toBe('menu');
      });

      it('should process menu selection', async () => {
        const node = {
          id: 'menu',
          type: 'menu',
          data: { options: ['A', 'B'], variableName: 'choice' }
        };
        const result = await executor.execute(node, {
          variables: {},
          context: { userResponse: 'A' }
        });
        expect(result.variables.choice).toBe('A');
      });
    });

    describe('Input Node Execution', () => {
      it('should wait for user input', async () => {
        const node = {
          id: 'inp',
          type: 'input',
          data: { variableName: 'name', content: 'Enter name:' }
        };
        const result = await executor.execute(node, { variables: {}, context: {} });
        expect(result.waitForInput).toBe(true);
        expect(result.output.variableName).toBe('name');
      });

      it('should process user input', async () => {
        const node = {
          id: 'inp',
          type: 'input',
          data: { variableName: 'name' }
        };
        const result = await executor.execute(node, {
          variables: {},
          context: { userInput: 'John' }
        });
        expect(result.waitForInput).toBe(false);
        expect(result.variables.name).toBe('John');
      });

      it('should validate email input', async () => {
        const node = {
          id: 'inp',
          type: 'input',
          data: { variableName: 'email', validation: 'email' }
        };
        const result = await executor.execute(node, {
          variables: {},
          context: { userInput: 'invalid-email' }
        });
        expect(result.waitForInput).toBe(true);
        expect(result.error).toBeDefined();
      });

      it('should accept valid email', async () => {
        const node = {
          id: 'inp',
          type: 'input',
          data: { variableName: 'email', validation: 'email' }
        };
        const result = await executor.execute(node, {
          variables: {},
          context: { userInput: 'test@example.com' }
        });
        expect(result.waitForInput).toBe(false);
        expect(result.variables.email).toBe('test@example.com');
      });

      it('should validate phone number', async () => {
        expect(executor.validateInput('1234567890', 'phone')).toBe(true);
        expect(executor.validateInput('+1-234-567-8900', 'phone')).toBe(true);
        expect(executor.validateInput('abc', 'phone')).toBe(false);
      });

      it('should validate URL', async () => {
        expect(executor.validateInput('https://example.com', 'url')).toBe(true);
        expect(executor.validateInput('invalid', 'url')).toBe(false);
      });

      it('should validate number', async () => {
        expect(executor.validateInput('123', 'number')).toBe(true);
        expect(executor.validateInput('abc', 'number')).toBe(false);
      });

      it('should validate date', async () => {
        expect(executor.validateInput('2024-01-01', 'date')).toBe(true);
        expect(executor.validateInput('invalid-date', 'date')).toBe(false);
      });

      it('should validate time', async () => {
        expect(executor.validateInput('14:30', 'time')).toBe(true);
        expect(executor.validateInput('25:00', 'time')).toBe(false);
      });
    });

    describe('Condition Node Execution', () => {
      it('should evaluate conditions and return match', async () => {
        const node = {
          id: 'cond',
          type: 'condition',
          data: {
            conditions: [
              { variable: 'age', operator: 'greater_than', value: 18, label: 'adult' }
            ]
          }
        };
        const result = await executor.execute(node, { variables: { age: 25 } });
        expect(result.selectedOption).toBe('adult');
      });

      it('should return default when no condition matches', async () => {
        const node = {
          id: 'cond',
          type: 'condition',
          data: {
            conditions: [
              { variable: 'age', operator: 'less_than', value: 18, label: 'child' }
            ]
          }
        };
        const result = await executor.execute(node, { variables: { age: 25 } });
        expect(result.selectedOption).toBe('default');
      });
    });

    describe('Set Variable Node Execution', () => {
      it('should set variable value', async () => {
        const node = {
          id: 'set',
          type: 'set_variable',
          data: { variableName: 'counter', value: 5 }
        };
        const result = await executor.execute(node, { variables: {} });
        expect(result.variables.counter).toBe(5);
      });

      it('should substitute variables in value', async () => {
        const node = {
          id: 'set',
          type: 'set_variable',
          data: { variableName: 'greeting', value: 'Hello {{name}}' }
        };
        const result = await executor.execute(node, { variables: { name: 'Alice' } });
        expect(result.variables.greeting).toBe('Hello Alice');
      });

      it('should evaluate expression', async () => {
        const node = {
          id: 'set',
          type: 'set_variable',
          data: { variableName: 'result', expression: '2 + 3' }
        };
        const result = await executor.execute(node, { variables: {} });
        expect(result.variables.result).toBe(5);
      });
    });

    describe('Action Node Execution', () => {
      it('should execute action node', async () => {
        const node = {
          id: 'action',
          type: 'action',
          data: { actionType: 'log', content: 'Logging...' }
        };
        const result = await executor.execute(node, { variables: {} });
        expect(result.output.type).toBe('action');
        expect(result.output.executed).toBe(true);
      });
    });

    describe('API Call Node Execution', () => {
      it('should execute API call node', async () => {
        const node = {
          id: 'api',
          type: 'api_call',
          data: { endpoint: 'https://api.example.com', method: 'GET' }
        };
        const result = await executor.execute(node, { variables: {} });
        expect(result.output.type).toBe('api_call');
        expect(result.variables.api_response).toBeDefined();
      });

      it('should substitute variables in endpoint', async () => {
        const node = {
          id: 'api',
          type: 'api_call',
          data: { endpoint: 'https://api.example.com/users/{{userId}}', method: 'GET' }
        };
        const result = await executor.execute(node, { variables: { userId: '123' } });
        expect(result.output.endpoint).toBe('https://api.example.com/users/123');
      });
    });

    describe('Delay Node Execution', () => {
      it('should execute delay node', async () => {
        const node = {
          id: 'delay',
          type: 'delay',
          data: { duration: 1000 }
        };
        const result = await executor.execute(node, { variables: {} });
        expect(result.output.type).toBe('delay');
        expect(result.output.duration).toBe(1000);
      });
    });

    describe('Email Node Execution', () => {
      it('should execute email node', async () => {
        const node = {
          id: 'email',
          type: 'email',
          data: { to: 'test@example.com', subject: 'Test', content: 'Hello' }
        };
        const result = await executor.execute(node, { variables: {} });
        expect(result.output.type).toBe('email');
        expect(result.output.sent).toBe(true);
      });

      it('should substitute variables in email', async () => {
        const node = {
          id: 'email',
          type: 'email',
          data: { to: '{{email}}', subject: 'Hello {{name}}', content: 'Test' }
        };
        const result = await executor.execute(node, {
          variables: { email: 'user@test.com', name: 'John' }
        });
        expect(result.output.to).toBe('user@test.com');
        expect(result.output.subject).toBe('Hello John');
      });
    });

    describe('Webhook Node Execution', () => {
      it('should execute webhook node', async () => {
        const node = {
          id: 'hook',
          type: 'webhook',
          data: { url: 'https://webhook.example.com', method: 'POST' }
        };
        const result = await executor.execute(node, { variables: {} });
        expect(result.output.type).toBe('webhook');
        expect(result.output.status).toBe('simulated');
      });
    });

    describe('AI Response Node Execution', () => {
      it('should execute AI response node', async () => {
        const node = {
          id: 'ai',
          type: 'ai_response',
          data: { prompt: 'Generate response' }
        };
        const result = await executor.execute(node, { variables: {} });
        expect(result.output.type).toBe('ai_response');
        expect(result.variables.ai_response).toBeDefined();
      });
    });

    describe('Goto Node Execution', () => {
      it('should execute goto node', async () => {
        const node = {
          id: 'goto',
          type: 'goto',
          data: { targetNodeId: 'target-123' }
        };
        const result = await executor.execute(node, { variables: {} });
        expect(result.nextNodeId).toBe('target-123');
      });

      it('should throw error if targetNodeId missing', async () => {
        const node = {
          id: 'goto',
          type: 'goto',
          data: {}
        };
        const result = await executor.execute(node, { variables: {} });
        expect(result.success).toBe(false);
      });
    });

    describe('Variable Substitution', () => {
      it('should substitute single variable', () => {
        const result = executor.substituteVariables('Hello {{name}}', { name: 'World' });
        expect(result).toBe('Hello World');
      });

      it('should substitute multiple variables', () => {
        const result = executor.substituteVariables(
          '{{greeting}} {{name}}!',
          { greeting: 'Hello', name: 'John' }
        );
        expect(result).toBe('Hello John!');
      });

      it('should handle missing variables', () => {
        const result = executor.substituteVariables('Hello {{missing}}', {});
        expect(result).toBe('Hello {{missing}}');
      });

      it('should handle non-string input', () => {
        const result = executor.substituteVariables(123, { name: 'test' });
        expect(result).toBe(123);
      });

      it('should trim variable names', () => {
        const result = executor.substituteVariables('{{  name  }}', { name: 'Test' });
        expect(result).toBe('Test');
      });
    });

    describe('Expression Evaluation', () => {
      it('should evaluate arithmetic expressions', () => {
        expect(executor.evaluateExpression('2 + 3', {})).toBe(5);
        expect(executor.evaluateExpression('10 - 4', {})).toBe(6);
        expect(executor.evaluateExpression('3 * 4', {})).toBe(12);
        expect(executor.evaluateExpression('10 / 2', {})).toBe(5);
      });

      it('should substitute variables in expressions', () => {
        const result = executor.evaluateExpression('{{a}} + {{b}}', { a: 5, b: 3 });
        expect(result).toBe(8);
      });

      it('should handle invalid expressions safely', () => {
        const result = executor.evaluateExpression('invalid expression', {});
        expect(result).toBe('invalid expression');
      });
    });

    describe('Condition Evaluation', () => {
      it('should evaluate all comparison operators', () => {
        const vars = { val: 10 };
        expect(executor.evaluateCondition({ variable: 'val', operator: 'equals', value: 10 }, vars)).toBe(true);
        expect(executor.evaluateCondition({ variable: 'val', operator: 'not_equals', value: 5 }, vars)).toBe(true);
        expect(executor.evaluateCondition({ variable: 'val', operator: 'greater_than', value: 5 }, vars)).toBe(true);
        expect(executor.evaluateCondition({ variable: 'val', operator: 'less_than', value: 20 }, vars)).toBe(true);
      });

      it('should evaluate string conditions', () => {
        const vars = { text: 'hello world' };
        expect(executor.evaluateCondition({ variable: 'text', operator: 'contains', value: 'world' }, vars)).toBe(true);
        expect(executor.evaluateCondition({ variable: 'text', operator: 'starts_with', value: 'hello' }, vars)).toBe(true);
        expect(executor.evaluateCondition({ variable: 'text', operator: 'ends_with', value: 'world' }, vars)).toBe(true);
      });

      it('should evaluate empty conditions', () => {
        expect(executor.evaluateCondition({ variable: 'empty', operator: 'is_empty' }, { empty: '' })).toBe(true);
        expect(executor.evaluateCondition({ variable: 'full', operator: 'is_not_empty' }, { full: 'value' })).toBe(true);
      });
    });
  });

  // ============================================================================
  // WorkflowEngine Tests
  // ============================================================================
  describe('WorkflowEngine - Workflow Orchestration', () => {
    let workflowEngine;

    beforeEach(() => {
      workflowEngine = new WorkflowEngine();
      jest.clearAllMocks();
    });

    describe('Engine Initialization', () => {
      it('should create WorkflowEngine instance', () => {
        expect(workflowEngine).toBeDefined();
        expect(workflowEngine.registry).toBeDefined();
        expect(workflowEngine.executor).toBeDefined();
      });

      it('should have default configuration', () => {
        expect(workflowEngine.maxRetries).toBe(3);
        expect(workflowEngine.retryDelay).toBe(1000);
      });
    });

    describe('Workflow Loading', () => {
      it('should load workflow from database', async () => {
        const mockWorkflow = {
          id: 1,
          name: 'Test Workflow',
          workflow_type: 'sequential',
          agents_config: [
            { agentId: 1, id: 1 }
          ]
        };

        const mockAgent = {
          id: 1,
          name: 'Test Agent',
          role: 'assistant',
          system_prompt: 'You are helpful',
          model_provider: 'openai',
          model_name: 'gpt-4',
          temperature: 0.7,
          max_tokens: 1000,
          capabilities: [],
          tools: []
        };

        AgentWorkflow.findById.mockResolvedValue(mockWorkflow);
        AgentModel.findById.mockResolvedValue(mockAgent);

        const workflow = await workflowEngine.loadWorkflow(1);
        expect(workflow).toBeDefined();
        expect(workflow.id).toBe(1);
      });

      it('should throw error if workflow not found', async () => {
        AgentWorkflow.findById.mockResolvedValue(null);
        await expect(workflowEngine.loadWorkflow(999)).rejects.toThrow('Workflow not found');
      });
    });

    describe('Sequential Workflow Execution', () => {
      it('should execute sequential workflow', async () => {
        const mockWorkflow = {
          id: 1,
          name: 'Sequential Test',
          workflow_type: 'sequential',
          agents_config: []
        };

        const mockExecution = {
          id: 'exec-1',
          workflow_id: 1,
          status: 'running'
        };

        AgentWorkflow.findById.mockResolvedValue(mockWorkflow);
        WorkflowExecution.create.mockResolvedValue(mockExecution);
        WorkflowExecution.update.mockResolvedValue({});

        const result = await workflowEngine.execute(1, { test: 'input' }, 1);
        expect(result.status).toBe('completed');
      });
    });

    describe('Parallel Workflow Execution', () => {
      it('should execute parallel workflow', async () => {
        const mockWorkflow = {
          id: 2,
          name: 'Parallel Test',
          workflow_type: 'parallel',
          agents_config: []
        };

        const mockExecution = {
          id: 'exec-2',
          workflow_id: 2,
          status: 'running'
        };

        AgentWorkflow.findById.mockResolvedValue(mockWorkflow);
        WorkflowExecution.create.mockResolvedValue(mockExecution);
        WorkflowExecution.update.mockResolvedValue({});

        const result = await workflowEngine.execute(2, { test: 'input' }, 1);
        expect(result.status).toBe('completed');
      });
    });

    describe('Conditional Workflow Execution', () => {
      it('should execute conditional workflow', async () => {
        const mockWorkflow = {
          id: 3,
          name: 'Conditional Test',
          workflow_type: 'conditional',
          flow_config: { routes: [] },
          agents_config: [],
          entry_agent_id: null
        };

        const mockExecution = {
          id: 'exec-3',
          workflow_id: 3,
          status: 'running'
        };

        AgentWorkflow.findById.mockResolvedValue(mockWorkflow);
        WorkflowExecution.create.mockResolvedValue(mockExecution);
        WorkflowExecution.update.mockResolvedValue({});

        const result = await workflowEngine.execute(3, { test: 'input' }, 1);
        expect(result.status).toBe('completed');
      });
    });

    describe('Mixed Workflow Execution', () => {
      it('should execute mixed workflow', async () => {
        const mockWorkflow = {
          id: 4,
          name: 'Mixed Test',
          workflow_type: 'mixed',
          flow_config: { stages: [] },
          agents_config: []
        };

        const mockExecution = {
          id: 'exec-4',
          workflow_id: 4,
          status: 'running'
        };

        AgentWorkflow.findById.mockResolvedValue(mockWorkflow);
        WorkflowExecution.create.mockResolvedValue(mockExecution);
        WorkflowExecution.update.mockResolvedValue({});

        const result = await workflowEngine.execute(4, { test: 'input' }, 1);
        expect(result.status).toBe('completed');
      });
    });

    describe('Error Handling', () => {
      it('should handle workflow execution errors', async () => {
        const mockWorkflow = {
          id: 5,
          name: 'Error Test',
          workflow_type: 'sequential',
          agents_config: [{ agentId: 999 }]
        };

        const mockExecution = {
          id: 'exec-5',
          workflow_id: 5,
          status: 'running'
        };

        AgentWorkflow.findById.mockResolvedValue(mockWorkflow);
        WorkflowExecution.create.mockResolvedValue(mockExecution);
        WorkflowExecution.update.mockResolvedValue({});
        AgentModel.findById.mockResolvedValue(null);

        const result = await workflowEngine.execute(5, { test: 'input' }, 1);
        expect(result.status).toBe('failed');
        expect(result.error).toBeDefined();
      });
    });

    describe('Cost Calculation', () => {
      it('should calculate cost based on tokens', () => {
        expect(workflowEngine.calculateCost(0)).toBe(0);
        expect(workflowEngine.calculateCost(1000)).toBe(0.002);
        expect(workflowEngine.calculateCost(5000)).toBe(0.01);
      });

      it('should handle null tokens', () => {
        expect(workflowEngine.calculateCost(null)).toBe(0);
        expect(workflowEngine.calculateCost(undefined)).toBe(0);
      });
    });

    describe('Condition Evaluation', () => {
      it('should evaluate string conditions', () => {
        expect(workflowEngine.evaluateCondition('test', 'test value')).toBe(true);
        expect(workflowEngine.evaluateCondition('missing', 'test value')).toBe(false);
      });

      it('should evaluate object conditions', () => {
        const output = { status: 'success' };
        expect(workflowEngine.evaluateCondition(
          { type: 'equals', field: 'status', value: 'success' },
          output
        )).toBe(true);
      });

      it('should evaluate contains conditions', () => {
        const output = { message: 'hello world' };
        expect(workflowEngine.evaluateCondition(
          { type: 'contains', field: 'message', value: 'world' },
          output
        )).toBe(true);
      });

      it('should return true for default conditions', () => {
        expect(workflowEngine.evaluateCondition({ type: 'default' }, {})).toBe(true);
      });

      it('should return true for null conditions', () => {
        expect(workflowEngine.evaluateCondition(null, {})).toBe(true);
      });
    });

    describe('Agent Breakdown', () => {
      it('should build agent breakdown from steps', () => {
        const steps = [
          {
            agentId: 1,
            agentName: 'Agent 1',
            agentRole: 'assistant',
            durationMs: 1000,
            tokensUsed: 500
          },
          {
            agentId: 1,
            agentName: 'Agent 1',
            agentRole: 'assistant',
            durationMs: 2000,
            tokensUsed: 300
          },
          {
            agentId: 2,
            agentName: 'Agent 2',
            agentRole: 'researcher',
            durationMs: 1500,
            tokensUsed: 400
          }
        ];

        const breakdown = workflowEngine.buildAgentBreakdown(steps);
        expect(breakdown.length).toBe(2);
        expect(breakdown[0].duration).toBe(3000);
        expect(breakdown[0].tokens).toBe(800);
      });
    });

    describe('Registry Management', () => {
      it('should clear registry', () => {
        workflowEngine.clear();
        expect(log.debug).not.toHaveBeenCalled(); // Just ensure no errors
      });
    });

    describe('Delay Helper', () => {
      it('should delay execution', async () => {
        const start = Date.now();
        await workflowEngine.delay(100);
        const duration = Date.now() - start;
        expect(duration).toBeGreaterThanOrEqual(100);
      });
    });
  });

  // ============================================================================
  // Performance and Optimization Tests
  // ============================================================================
  describe('Performance and Optimization', () => {
    describe('Flow Execution Performance', () => {
      it('should execute simple flow quickly', async () => {
        const flowEngine = new FlowEngine();
        const flow = {
          id: 'perf-1',
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'end', type: 'end', data: {} }
          ],
          edges: [{ id: 'e1', source: 'start', target: 'end' }]
        };

        const start = Date.now();
        await flowEngine.executeFlow(flow);
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(1000);
      });

      it('should handle large flows efficiently', async () => {
        const flowEngine = new FlowEngine();
        const nodes = [{ id: 'start', type: 'start', data: {} }];
        const edges = [];

        // Create a flow with 50 nodes
        for (let i = 1; i < 50; i++) {
          nodes.push({
            id: `node${i}`,
            type: 'message',
            data: { content: `Message ${i}` }
          });
          edges.push({
            id: `e${i}`,
            source: i === 1 ? 'start' : `node${i - 1}`,
            target: `node${i}`
          });
        }

        const flow = { id: 'large-flow', nodes, edges };

        const start = Date.now();
        await flowEngine.executeFlow(flow);
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(5000);
      });
    });

    describe('Validation Performance', () => {
      it('should validate large flows quickly', () => {
        const validator = new FlowValidator();
        const nodes = [];
        const edges = [];

        for (let i = 0; i < 100; i++) {
          nodes.push({
            id: `node${i}`,
            type: i === 0 ? 'start' : 'message',
            data: { content: `Node ${i}` }
          });
          if (i > 0) {
            edges.push({
              id: `e${i}`,
              source: `node${i - 1}`,
              target: `node${i}`
            });
          }
        }

        const flow = { nodes, edges };

        const start = Date.now();
        const result = validator.validateFlow(flow);
        const duration = Date.now() - start;

        expect(result.valid).toBe(true);
        expect(duration).toBeLessThan(500);
      });
    });

    describe('Memory Management', () => {
      it('should clean up old executions to prevent memory leaks', async () => {
        const flowEngine = new FlowEngine();
        const flow = {
          id: 'mem-test',
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'end', type: 'end', data: {} }
          ],
          edges: [{ id: 'e1', source: 'start', target: 'end' }]
        };

        // Execute multiple flows
        for (let i = 0; i < 10; i++) {
          await flowEngine.executeFlow(flow);
        }

        expect(flowEngine.activeExecutions.size).toBe(10);

        // Clean up
        flowEngine.cleanupExecutions(0);
        expect(flowEngine.activeExecutions.size).toBe(0);
      });
    });
  });

  // ============================================================================
  // Edge Cases and Complex Scenarios
  // ============================================================================
  describe('Edge Cases and Complex Scenarios', () => {
    describe('Complex Flow Patterns', () => {
      it('should handle branching flows', async () => {
        const flowEngine = new FlowEngine();
        const flow = {
          id: 'branch-flow',
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'cond', type: 'condition', data: {
              conditions: [
                { variable: 'value', operator: 'greater_than', value: 10, label: 'high' }
              ]
            }},
            { id: 'high', type: 'message', data: { content: 'High value' } },
            { id: 'low', type: 'message', data: { content: 'Low value' } },
            { id: 'end', type: 'end', data: {} }
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'cond' },
            { id: 'e2', source: 'cond', target: 'high', label: 'high' },
            { id: 'e3', source: 'cond', target: 'low', label: 'default' },
            { id: 'e4', source: 'high', target: 'end' },
            { id: 'e5', source: 'low', target: 'end' }
          ]
        };

        const result = await flowEngine.executeFlow(flow, { value: 15 });
        expect(result.success).toBe(true);
      });

      it('should handle nested conditions', async () => {
        const executor = new NodeExecutor();
        const node = {
          id: 'cond',
          type: 'condition',
          data: {
            conditions: [
              { variable: 'age', operator: 'greater_than', value: 18, label: 'adult' },
              { variable: 'age', operator: 'less_than', value: 13, label: 'child' }
            ]
          }
        };

        const result1 = await executor.execute(node, { variables: { age: 25 } });
        expect(result1.selectedOption).toBe('adult');

        const result2 = await executor.execute(node, { variables: { age: 10 } });
        expect(result2.selectedOption).toBe('child');

        const result3 = await executor.execute(node, { variables: { age: 15 } });
        expect(result3.selectedOption).toBe('default');
      });
    });

    describe('Variable Scope and Context', () => {
      it('should maintain variable scope across nodes', async () => {
        const flowEngine = new FlowEngine();
        const flow = {
          id: 'scope-test',
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'set1', type: 'set_variable', data: { variableName: 'x', value: 10 } },
            { id: 'set2', type: 'set_variable', data: { variableName: 'y', expression: '{{x}} * 2' } },
            { id: 'end', type: 'end', data: {} }
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'set1' },
            { id: 'e2', source: 'set1', target: 'set2' },
            { id: 'e3', source: 'set2', target: 'end' }
          ]
        };

        const result = await flowEngine.executeFlow(flow);
        expect(result.finalState.variables.x).toBe(10);
        expect(result.finalState.variables.y).toBe(20);
      });

      it('should preserve context through pause/resume', async () => {
        const flowEngine = new FlowEngine();
        const flow = {
          id: 'context-test',
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'set', type: 'set_variable', data: { variableName: 'count', value: 5 } },
            { id: 'input', type: 'input', data: { variableName: 'name' } },
            { id: 'end', type: 'end', data: {} }
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'set' },
            { id: 'e2', source: 'set', target: 'input' },
            { id: 'e3', source: 'input', target: 'end' }
          ]
        };

        const result1 = await flowEngine.executeFlow(flow);
        expect(result1.finalState.variables.count).toBe(5);

        const result2 = await flowEngine.resumeFlow(result1.executionId, { userInput: 'Test' });
        expect(result2.finalState.variables.count).toBe(5);
        expect(result2.finalState.variables.name).toBe('Test');
      });
    });

    describe('Error Recovery', () => {
      it('should handle node execution errors gracefully', async () => {
        const executor = new NodeExecutor();
        const node = {
          id: 'bad',
          type: 'set_variable',
          data: { variableName: null, value: 'test' }
        };

        const result = await executor.execute(node, { variables: {} });
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should handle validation errors in input nodes', async () => {
        const executor = new NodeExecutor();
        const node = {
          id: 'inp',
          type: 'input',
          data: { variableName: 'email', validation: 'email' }
        };

        const result = await executor.execute(node, {
          variables: {},
          context: { userInput: 'not-an-email' }
        });

        expect(result.waitForInput).toBe(true);
        expect(result.error).toBeDefined();
      });
    });

    describe('Concurrent Execution', () => {
      it('should handle multiple concurrent flow executions', async () => {
        const flowEngine = new FlowEngine();
        const flow = {
          id: 'concurrent',
          nodes: [
            { id: 'start', type: 'start', data: {} },
            { id: 'msg', type: 'message', data: { content: 'Test' } },
            { id: 'end', type: 'end', data: {} }
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'msg' },
            { id: 'e2', source: 'msg', target: 'end' }
          ]
        };

        const executions = await Promise.all([
          flowEngine.executeFlow(flow, { id: 1 }),
          flowEngine.executeFlow(flow, { id: 2 }),
          flowEngine.executeFlow(flow, { id: 3 })
        ]);

        expect(executions.length).toBe(3);
        executions.forEach(result => {
          expect(result.success).toBe(true);
        });
        expect(flowEngine.activeExecutions.size).toBe(3);
      });
    });
  });
});
