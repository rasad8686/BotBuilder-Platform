const FlowEngine = require('../../../services/flowBuilder/FlowEngine');
const NodeExecutor = require('../../../services/flowBuilder/NodeExecutor');
const FlowValidator = require('../../../services/flowBuilder/FlowValidator');

jest.mock('../../../utils/logger');
jest.mock('../../../services/flowBuilder/NodeExecutor');
jest.mock('../../../services/flowBuilder/FlowValidator');

describe('FlowEngine', () => {
  let flowEngine;
  let mockNodeExecutor;
  let mockValidator;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    mockNodeExecutor = {
      execute: jest.fn()
    };

    mockValidator = {
      validateFlow: jest.fn()
    };

    NodeExecutor.mockImplementation(() => mockNodeExecutor);
    FlowValidator.mockImplementation(() => mockValidator);

    flowEngine = new FlowEngine();
  });

  describe('executeFlow', () => {
    it('should successfully execute a simple flow', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [
          {
            id: 'start_1',
            type: 'start',
            data: { label: 'Start' },
            isStart: true
          },
          {
            id: 'msg_1',
            type: 'message',
            data: { content: 'Hello!' }
          },
          {
            id: 'end_1',
            type: 'end',
            data: { content: 'Done' }
          }
        ],
        edges: [
          { id: 'e1', source: 'start_1', target: 'msg_1' },
          { id: 'e2', source: 'msg_1', target: 'end_1' }
        ],
        settings: {
          startNodeId: 'start_1'
        }
      };

      mockValidator.validateFlow.mockReturnValue({ valid: true, errors: [], warnings: [] });
      mockNodeExecutor.execute
        .mockResolvedValueOnce({ success: true, output: null, waitForInput: false })
        .mockResolvedValueOnce({ success: true, output: { type: 'message', content: 'Hello!' }, waitForInput: false })
        .mockResolvedValueOnce({ success: true, output: { type: 'end' }, waitForInput: false });

      const result = await flowEngine.executeFlow(flow);

      expect(result.success).toBe(true);
      expect(result.executionId).toBeDefined();
      expect(mockValidator.validateFlow).toHaveBeenCalledWith(flow);
      expect(mockNodeExecutor.execute).toHaveBeenCalledTimes(3);
    });

    it('should fail if flow validation fails', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [],
        edges: []
      };

      mockValidator.validateFlow.mockReturnValue({
        valid: false,
        errors: ['No start node found'],
        warnings: []
      });

      const result = await flowEngine.executeFlow(flow);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Flow validation failed');
      expect(result.errors).toEqual(['No start node found']);
      expect(mockNodeExecutor.execute).not.toHaveBeenCalled();
    });

    it('should initialize variables from flow definition', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [
          { id: 'start_1', type: 'start', data: {}, isStart: true },
          { id: 'end_1', type: 'end', data: {} }
        ],
        edges: [{ id: 'e1', source: 'start_1', target: 'end_1' }],
        variables: [
          { name: 'user_name', type: 'string', defaultValue: 'Guest' },
          { name: 'count', type: 'number', defaultValue: 0 }
        ],
        settings: { startNodeId: 'start_1' }
      };

      mockValidator.validateFlow.mockReturnValue({ valid: true, errors: [], warnings: [] });
      mockNodeExecutor.execute
        .mockResolvedValueOnce({ success: true, waitForInput: false })
        .mockResolvedValueOnce({ success: true, waitForInput: false });

      const result = await flowEngine.executeFlow(flow);

      expect(result.success).toBe(true);
      expect(result.finalState.variables).toMatchObject({
        user_name: 'Guest',
        count: 0
      });
    });

    it('should merge context with variable defaults', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [
          { id: 'start_1', type: 'start', data: {}, isStart: true },
          { id: 'end_1', type: 'end', data: {} }
        ],
        edges: [{ id: 'e1', source: 'start_1', target: 'end_1' }],
        variables: [
          { name: 'user_name', type: 'string', defaultValue: 'Guest' }
        ],
        settings: { startNodeId: 'start_1' }
      };

      const context = {
        user_name: 'John',
        custom_var: 'value'
      };

      mockValidator.validateFlow.mockReturnValue({ valid: true, errors: [], warnings: [] });
      mockNodeExecutor.execute
        .mockResolvedValueOnce({ success: true, waitForInput: false })
        .mockResolvedValueOnce({ success: true, waitForInput: false });

      const result = await flowEngine.executeFlow(flow, context);

      expect(result.success).toBe(true);
      expect(result.finalState.variables.user_name).toBe('John');
      expect(result.finalState.variables.custom_var).toBe('value');
    });

    it('should handle flow execution errors', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [{ id: 'start_1', type: 'start', data: {}, isStart: true }],
        edges: [],
        settings: { startNodeId: 'start_1' }
      };

      mockValidator.validateFlow.mockReturnValue({ valid: true, errors: [], warnings: [] });
      mockNodeExecutor.execute.mockRejectedValue(new Error('Execution failed'));

      const result = await flowEngine.executeFlow(flow);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });

    it('should find start node when not specified in settings', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [
          { id: 'start_1', type: 'start', data: {}, isStart: true },
          { id: 'end_1', type: 'end', data: {} }
        ],
        edges: [{ id: 'e1', source: 'start_1', target: 'end_1' }]
      };

      mockValidator.validateFlow.mockReturnValue({ valid: true, errors: [], warnings: [] });
      mockNodeExecutor.execute
        .mockResolvedValueOnce({ success: true, waitForInput: false })
        .mockResolvedValueOnce({ success: true, waitForInput: false });

      const result = await flowEngine.executeFlow(flow);

      expect(result.success).toBe(true);
      expect(result.finalState.currentNodeId).toBe('end_1');
    });
  });

  describe('resumeFlow', () => {
    it('should resume a paused flow with user input', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [
          { id: 'input_1', type: 'input', data: { variableName: 'name' } },
          { id: 'end_1', type: 'end', data: {} }
        ],
        edges: [{ id: 'e1', source: 'input_1', target: 'end_1' }],
        settings: { startNodeId: 'input_1' }
      };

      mockValidator.validateFlow.mockReturnValue({ valid: true, errors: [], warnings: [] });
      mockNodeExecutor.execute
        .mockResolvedValueOnce({ success: true, output: { type: 'input' }, waitForInput: true });

      const executeResult = await flowEngine.executeFlow(flow);
      const executionId = executeResult.executionId;

      mockNodeExecutor.execute
        .mockResolvedValueOnce({ success: true, output: { type: 'input_received' }, variables: { name: 'John' }, waitForInput: false })
        .mockResolvedValueOnce({ success: true, output: { type: 'end' }, waitForInput: false });

      const resumeResult = await flowEngine.resumeFlow(executionId, { userInput: 'John' });

      expect(resumeResult.success).toBe(true);
      expect(resumeResult.finalState.variables.name).toBe('John');
    });

    it('should fail if execution not found', async () => {
      const result = await flowEngine.resumeFlow('invalid_id', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution not found');
    });

    it('should update execution context with user input', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [
          { id: 'start_1', type: 'start', data: {}, isStart: true },
          { id: 'end_1', type: 'end', data: {} }
        ],
        edges: [{ id: 'e1', source: 'start_1', target: 'end_1' }],
        settings: { startNodeId: 'start_1' }
      };

      mockValidator.validateFlow.mockReturnValue({ valid: true, errors: [], warnings: [] });
      mockNodeExecutor.execute
        .mockResolvedValueOnce({ success: true, waitForInput: true });

      const executeResult = await flowEngine.executeFlow(flow);
      const executionId = executeResult.executionId;

      mockNodeExecutor.execute
        .mockResolvedValueOnce({ success: true, waitForInput: false })
        .mockResolvedValueOnce({ success: true, waitForInput: false });

      const resumeResult = await flowEngine.resumeFlow(executionId, { customData: 'test' });

      expect(resumeResult.success).toBe(true);
      expect(resumeResult.finalState.context.customData).toBe('test');
    });

    it('should handle resume errors', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [{ id: 'start_1', type: 'start', data: {}, isStart: true }],
        edges: [],
        settings: { startNodeId: 'start_1' }
      };

      mockValidator.validateFlow.mockReturnValue({ valid: true, errors: [], warnings: [] });
      mockNodeExecutor.execute.mockResolvedValueOnce({ success: true, waitForInput: true });

      const executeResult = await flowEngine.executeFlow(flow);
      const executionId = executeResult.executionId;

      mockNodeExecutor.execute.mockRejectedValue(new Error('Resume failed'));

      const resumeResult = await flowEngine.resumeFlow(executionId, {});

      expect(resumeResult.success).toBe(false);
      expect(resumeResult.error).toBe('Resume failed');
    });
  });

  describe('executeNode', () => {
    it('should execute a node and update execution state', async () => {
      const flow = {
        nodes: [
          { id: 'msg_1', type: 'message', data: { content: 'Hello' } }
        ]
      };

      const executionState = {
        variables: {},
        history: []
      };

      mockNodeExecutor.execute.mockResolvedValue({
        success: true,
        output: { type: 'message', content: 'Hello' }
      });

      const result = await flowEngine.executeNode(flow, 'msg_1', executionState);

      expect(result.success).toBe(true);
      expect(executionState.history.length).toBe(1);
      expect(executionState.history[0].nodeId).toBe('msg_1');
    });

    it('should update variables from node execution', async () => {
      const flow = {
        nodes: [
          { id: 'set_1', type: 'set_variable', data: { variableName: 'test' } }
        ]
      };

      const executionState = {
        variables: {},
        history: []
      };

      mockNodeExecutor.execute.mockResolvedValue({
        success: true,
        variables: { test: 'value' }
      });

      await flowEngine.executeNode(flow, 'set_1', executionState);

      expect(executionState.variables.test).toBe('value');
    });

    it('should throw error if node not found', async () => {
      const flow = {
        nodes: []
      };

      const executionState = {
        variables: {},
        history: []
      };

      await expect(
        flowEngine.executeNode(flow, 'nonexistent', executionState)
      ).rejects.toThrow('Node not found: nonexistent');
    });

    it('should record node execution in history', async () => {
      const flow = {
        nodes: [
          { id: 'node_1', type: 'message', data: {} }
        ]
      };

      const executionState = {
        variables: {},
        history: []
      };

      mockNodeExecutor.execute.mockResolvedValue({ success: true });

      await flowEngine.executeNode(flow, 'node_1', executionState);

      expect(executionState.history).toHaveLength(1);
      expect(executionState.history[0]).toMatchObject({
        nodeId: 'node_1',
        nodeType: 'message'
      });
      expect(executionState.history[0].timestamp).toBeDefined();
    });
  });

  describe('getNextNode', () => {
    it('should follow single edge', async () => {
      const flow = {
        nodes: [
          { id: 'node_1', type: 'message', data: {} }
        ],
        edges: [
          { id: 'e1', source: 'node_1', target: 'node_2' }
        ]
      };

      const nextNode = await flowEngine.getNextNode(flow, 'node_1', {}, {});

      expect(nextNode).toBe('node_2');
    });

    it('should return null for end node', async () => {
      const flow = {
        nodes: [
          { id: 'end_1', type: 'end', data: {} }
        ],
        edges: []
      };

      const nextNode = await flowEngine.getNextNode(flow, 'end_1', {}, {});

      expect(nextNode).toBeNull();
    });

    it('should return null when no edges', async () => {
      const flow = {
        nodes: [
          { id: 'node_1', type: 'message', data: {} }
        ],
        edges: []
      };

      const nextNode = await flowEngine.getNextNode(flow, 'node_1', {}, {});

      expect(nextNode).toBeNull();
    });

    it('should use nextNodeId from node result if provided', async () => {
      const flow = {
        nodes: [
          { id: 'node_1', type: 'goto', data: {} }
        ],
        edges: [
          { id: 'e1', source: 'node_1', target: 'node_2' }
        ]
      };

      const nodeResult = { nextNodeId: 'custom_node' };
      const nextNode = await flowEngine.getNextNode(flow, 'node_1', nodeResult, {});

      expect(nextNode).toBe('custom_node');
    });

    it('should evaluate edge conditions for branching', async () => {
      const flow = {
        nodes: [
          { id: 'cond_1', type: 'condition', data: {} }
        ],
        edges: [
          { id: 'e1', source: 'cond_1', target: 'node_yes', label: 'yes' },
          { id: 'e2', source: 'cond_1', target: 'node_no', label: 'no' }
        ]
      };

      const nodeResult = { selectedOption: 'yes' };
      const nextNode = await flowEngine.getNextNode(flow, 'cond_1', nodeResult, {});

      expect(nextNode).toBe('node_yes');
    });

    it('should use default edge when no condition matches', async () => {
      const flow = {
        nodes: [
          { id: 'cond_1', type: 'condition', data: {} }
        ],
        edges: [
          { id: 'e1', source: 'cond_1', target: 'node_specific', condition: { variable: 'x', operator: 'eq', value: '10' } },
          { id: 'e2', source: 'cond_1', target: 'node_default', label: 'default' }
        ]
      };

      const nextNode = await flowEngine.getNextNode(flow, 'cond_1', {}, { variables: { x: '5' } });

      expect(nextNode).toBe('node_default');
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate equals condition', () => {
      const condition = { variable: 'status', operator: 'equals', value: 'active' };
      const variables = { status: 'active' };

      const result = flowEngine.evaluateCondition(condition, variables);

      expect(result).toBe(true);
    });

    it('should evaluate not_equals condition', () => {
      const condition = { variable: 'status', operator: 'not_equals', value: 'inactive' };
      const variables = { status: 'active' };

      const result = flowEngine.evaluateCondition(condition, variables);

      expect(result).toBe(true);
    });

    it('should evaluate greater_than condition', () => {
      const condition = { variable: 'age', operator: 'greater_than', value: '18' };
      const variables = { age: 25 };

      const result = flowEngine.evaluateCondition(condition, variables);

      expect(result).toBe(true);
    });

    it('should evaluate less_than condition', () => {
      const condition = { variable: 'count', operator: 'less_than', value: '100' };
      const variables = { count: 50 };

      const result = flowEngine.evaluateCondition(condition, variables);

      expect(result).toBe(true);
    });

    it('should evaluate contains condition', () => {
      const condition = { variable: 'message', operator: 'contains', value: 'hello' };
      const variables = { message: 'hello world' };

      const result = flowEngine.evaluateCondition(condition, variables);

      expect(result).toBe(true);
    });

    it('should evaluate starts_with condition', () => {
      const condition = { variable: 'text', operator: 'starts_with', value: 'Hello' };
      const variables = { text: 'Hello there' };

      const result = flowEngine.evaluateCondition(condition, variables);

      expect(result).toBe(true);
    });

    it('should evaluate ends_with condition', () => {
      const condition = { variable: 'file', operator: 'ends_with', value: '.pdf' };
      const variables = { file: 'document.pdf' };

      const result = flowEngine.evaluateCondition(condition, variables);

      expect(result).toBe(true);
    });

    it('should evaluate is_empty condition', () => {
      const condition = { variable: 'value', operator: 'is_empty' };
      const variables = { value: '' };

      const result = flowEngine.evaluateCondition(condition, variables);

      expect(result).toBe(true);
    });

    it('should evaluate is_not_empty condition', () => {
      const condition = { variable: 'value', operator: 'is_not_empty' };
      const variables = { value: 'data' };

      const result = flowEngine.evaluateCondition(condition, variables);

      expect(result).toBe(true);
    });

    it('should return false for unknown operator', () => {
      const condition = { variable: 'x', operator: 'unknown', value: 'y' };
      const variables = { x: 'test' };

      const result = flowEngine.evaluateCondition(condition, variables);

      expect(result).toBe(false);
    });
  });

  describe('getDefaultValueForType', () => {
    it('should return empty string for string type', () => {
      expect(flowEngine.getDefaultValueForType('string')).toBe('');
    });

    it('should return 0 for number type', () => {
      expect(flowEngine.getDefaultValueForType('number')).toBe(0);
    });

    it('should return false for boolean type', () => {
      expect(flowEngine.getDefaultValueForType('boolean')).toBe(false);
    });

    it('should return empty array for array type', () => {
      expect(flowEngine.getDefaultValueForType('array')).toEqual([]);
    });

    it('should return empty object for object type', () => {
      expect(flowEngine.getDefaultValueForType('object')).toEqual({});
    });

    it('should return null for unknown type', () => {
      expect(flowEngine.getDefaultValueForType('unknown')).toBeNull();
    });
  });

  describe('runFlow', () => {
    it('should stop when waiting for input', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [
          { id: 'input_1', type: 'input', data: { variableName: 'name' } }
        ],
        edges: [],
        settings: { startNodeId: 'input_1' }
      };

      const executionState = {
        currentNodeId: 'input_1',
        variables: {},
        history: []
      };

      mockNodeExecutor.execute.mockResolvedValue({
        success: true,
        waitForInput: true,
        message: 'Waiting for input',
        output: { type: 'input' }
      });

      const result = await flowEngine.runFlow(flow, executionState);

      expect(result.status).toBe('waiting_input');
      expect(result.message).toBe('Waiting for input');
    });

    it('should complete when reaching end', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [
          { id: 'end_1', type: 'end', data: {} }
        ],
        edges: [],
        settings: { startNodeId: 'end_1' }
      };

      const executionState = {
        currentNodeId: 'end_1',
        variables: {},
        history: []
      };

      mockNodeExecutor.execute.mockResolvedValue({
        success: true,
        waitForInput: false,
        output: { type: 'end' }
      });

      const result = await flowEngine.runFlow(flow, executionState);

      expect(result.status).toBe('completed');
    });

    it('should prevent infinite loops with max iterations', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [
          { id: 'node_1', type: 'message', data: {} }
        ],
        edges: [
          { id: 'e1', source: 'node_1', target: 'node_1' }
        ],
        settings: { startNodeId: 'node_1' }
      };

      const executionState = {
        currentNodeId: 'node_1',
        variables: {},
        history: []
      };

      mockNodeExecutor.execute.mockResolvedValue({
        success: true,
        waitForInput: false
      });

      const result = await flowEngine.runFlow(flow, executionState);

      expect(result.status).toBe('error');
      expect(result.error).toContain('Maximum iterations exceeded');
    });

    it('should collect outputs from nodes', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [
          { id: 'msg_1', type: 'message', data: {} },
          { id: 'msg_2', type: 'message', data: {} }
        ],
        edges: [
          { id: 'e1', source: 'msg_1', target: 'msg_2' }
        ],
        settings: { startNodeId: 'msg_1' }
      };

      const executionState = {
        currentNodeId: 'msg_1',
        variables: {},
        history: []
      };

      mockNodeExecutor.execute
        .mockResolvedValueOnce({
          success: true,
          output: { type: 'message', content: 'First' },
          waitForInput: false
        })
        .mockResolvedValueOnce({
          success: true,
          output: { type: 'message', content: 'Second' },
          waitForInput: false
        });

      const result = await flowEngine.runFlow(flow, executionState);

      expect(result.status).toBe('completed');
      expect(result.outputs).toHaveLength(2);
      expect(result.outputs[0].content).toBe('First');
      expect(result.outputs[1].content).toBe('Second');
    });

    it('should handle node errors', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [
          { id: 'node_1', type: 'message', data: {} }
        ],
        edges: [],
        settings: { startNodeId: 'node_1' }
      };

      const executionState = {
        currentNodeId: 'node_1',
        variables: {},
        history: []
      };

      mockNodeExecutor.execute.mockResolvedValue({
        success: true,
        error: 'Node execution failed',
        waitForInput: false
      });

      const result = await flowEngine.runFlow(flow, executionState);

      expect(result.status).toBe('error');
      expect(result.error).toBe('Node execution failed');
    });
  });

  describe('execution management', () => {
    it('should generate unique execution IDs', () => {
      const id1 = flowEngine.generateExecutionId();
      const id2 = flowEngine.generateExecutionId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^exec_\d+_[a-z0-9]+$/);
    });

    it('should retrieve execution state', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [{ id: 'start_1', type: 'start', data: {}, isStart: true }],
        edges: [],
        settings: { startNodeId: 'start_1' }
      };

      mockValidator.validateFlow.mockReturnValue({ valid: true, errors: [], warnings: [] });
      mockNodeExecutor.execute.mockResolvedValue({ success: true, waitForInput: true });

      const result = await flowEngine.executeFlow(flow);
      const state = flowEngine.getExecutionState(result.executionId);

      expect(state).toBeDefined();
      expect(state.id).toBe(result.executionId);
      expect(state.flowId).toBe('flow_1');
    });

    it('should return null for non-existent execution', () => {
      const state = flowEngine.getExecutionState('nonexistent_id');

      expect(state).toBeNull();
    });

    it('should cancel active execution', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [{ id: 'start_1', type: 'start', data: {}, isStart: true }],
        edges: [],
        settings: { startNodeId: 'start_1' }
      };

      mockValidator.validateFlow.mockReturnValue({ valid: true, errors: [], warnings: [] });
      mockNodeExecutor.execute.mockResolvedValue({ success: true, waitForInput: true });

      const result = await flowEngine.executeFlow(flow);
      const cancelled = flowEngine.cancelExecution(result.executionId);

      expect(cancelled).toBe(true);

      const state = flowEngine.getExecutionState(result.executionId);
      expect(state.status).toBe('cancelled');
      expect(state.cancelledAt).toBeDefined();
    });

    it('should return false when cancelling non-existent execution', () => {
      const cancelled = flowEngine.cancelExecution('nonexistent_id');

      expect(cancelled).toBe(false);
    });

    it('should cleanup old executions', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [{ id: 'start_1', type: 'start', data: {}, isStart: true }],
        edges: [],
        settings: { startNodeId: 'start_1' }
      };

      mockValidator.validateFlow.mockReturnValue({ valid: true, errors: [], warnings: [] });
      mockNodeExecutor.execute.mockResolvedValue({ success: true, waitForInput: false });

      const result = await flowEngine.executeFlow(flow);
      const executionId = result.executionId;

      // Manually set old start time
      const state = flowEngine.getExecutionState(executionId);
      state.startedAt = new Date(Date.now() - 7200000).toISOString(); // 2 hours ago
      state.status = 'completed';

      flowEngine.cleanupExecutions(3600000); // Clean up older than 1 hour

      const cleanedState = flowEngine.getExecutionState(executionId);
      expect(cleanedState).toBeNull();
    });

    it('should not cleanup active executions', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [{ id: 'start_1', type: 'start', data: {}, isStart: true }],
        edges: [],
        settings: { startNodeId: 'start_1' }
      };

      mockValidator.validateFlow.mockReturnValue({ valid: true, errors: [], warnings: [] });
      mockNodeExecutor.execute.mockResolvedValue({ success: true, waitForInput: true });

      const result = await flowEngine.executeFlow(flow);
      const executionId = result.executionId;

      const state = flowEngine.getExecutionState(executionId);
      state.startedAt = new Date(Date.now() - 7200000).toISOString();
      state.status = 'running'; // Still running

      flowEngine.cleanupExecutions(3600000);

      const stillThere = flowEngine.getExecutionState(executionId);
      expect(stillThere).toBeDefined();
    });
  });

  describe('edge case handling', () => {
    it('should handle flow with no edges', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [
          { id: 'start_1', type: 'start', data: {}, isStart: true }
        ],
        edges: []
      };

      mockValidator.validateFlow.mockReturnValue({ valid: true, errors: [], warnings: [] });
      mockNodeExecutor.execute.mockResolvedValue({ success: true, waitForInput: false });

      const result = await flowEngine.executeFlow(flow);

      expect(result.success).toBe(true);
      expect(result.result.status).toBe('completed');
    });

    it('should handle missing flow settings', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [
          { id: 'start_1', type: 'start', data: {}, isStart: true }
        ],
        edges: []
      };

      mockValidator.validateFlow.mockReturnValue({ valid: true, errors: [], warnings: [] });
      mockNodeExecutor.execute.mockResolvedValue({ success: true, waitForInput: false });

      const result = await flowEngine.executeFlow(flow);

      expect(result.success).toBe(true);
    });

    it('should handle empty variables array', async () => {
      const flow = {
        id: 'flow_1',
        nodes: [
          { id: 'start_1', type: 'start', data: {}, isStart: true }
        ],
        edges: [],
        variables: []
      };

      mockValidator.validateFlow.mockReturnValue({ valid: true, errors: [], warnings: [] });
      mockNodeExecutor.execute.mockResolvedValue({ success: true, waitForInput: false });

      const result = await flowEngine.executeFlow(flow);

      expect(result.success).toBe(true);
      expect(result.finalState.variables).toBeDefined();
    });
  });
});
