/**
 * WorkflowEngine Tests
 * Comprehensive tests for workflow execution engine
 */

// Mock dependencies
jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../../agents/core/Agent');
jest.mock('../../../agents/core/AgentContext');
jest.mock('../../../agents/core/AgentRegistry');
jest.mock('../../../agents/core/AgentExecutor');
jest.mock('../../../models/Agent');
jest.mock('../../../models/AgentWorkflow');
jest.mock('../../../models/WorkflowExecution');
jest.mock('../../../models/AgentExecutionStep');
jest.mock('../../../models/AgentMessage');
jest.mock('../../../websocket', () => ({
  getExecutionSocket: jest.fn()
}));

const WorkflowEngine = require('../../../agents/workflows/WorkflowEngine');
const Agent = require('../../../agents/core/Agent');
const AgentContext = require('../../../agents/core/AgentContext');
const AgentRegistry = require('../../../agents/core/AgentRegistry');
const AgentExecutor = require('../../../agents/core/AgentExecutor');
const AgentModel = require('../../../models/Agent');
const AgentWorkflow = require('../../../models/AgentWorkflow');
const WorkflowExecution = require('../../../models/WorkflowExecution');
const AgentExecutionStep = require('../../../models/AgentExecutionStep');
const { getExecutionSocket } = require('../../../websocket');
const log = require('../../../utils/logger');

describe('WorkflowEngine', () => {
  let engine;
  let mockRegistry;
  let mockExecutor;
  let mockSocket;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock registry
    mockRegistry = {
      register: jest.fn(),
      get: jest.fn(),
      clear: jest.fn()
    };
    AgentRegistry.mockImplementation(() => mockRegistry);

    // Mock executor
    mockExecutor = {
      execute: jest.fn()
    };
    AgentExecutor.mockImplementation(() => mockExecutor);

    // Mock socket
    mockSocket = {
      emitExecutionStart: jest.fn(),
      emitExecutionComplete: jest.fn(),
      emitExecutionError: jest.fn(),
      emitStepStart: jest.fn(),
      emitStepComplete: jest.fn(),
      emitStepFailed: jest.fn()
    };
    getExecutionSocket.mockReturnValue(mockSocket);

    // Mock AgentContext
    AgentContext.mockImplementation((executionId) => ({
      executionId,
      set: jest.fn(),
      get: jest.fn(),
      setCurrentAgent: jest.fn(),
      addAgentOutput: jest.fn(),
      toJSON: jest.fn(() => ({}))
    }));

    engine = new WorkflowEngine();
  });

  describe('Constructor', () => {
    it('should initialize with registry', () => {
      expect(engine.registry).toBeDefined();
      expect(AgentRegistry).toHaveBeenCalled();
    });

    it('should initialize with executor', () => {
      expect(engine.executor).toBeDefined();
      expect(AgentExecutor).toHaveBeenCalledWith(mockRegistry);
    });

    it('should set default maxRetries to 3', () => {
      expect(engine.maxRetries).toBe(3);
    });

    it('should set default retryDelay to 1000ms', () => {
      expect(engine.retryDelay).toBe(1000);
    });

    it('should initialize executionSocket as null', () => {
      expect(engine.executionSocket).toBeNull();
    });
  });

  describe('getSocket', () => {
    it('should get execution socket on first call', () => {
      const socket = engine.getSocket();
      expect(getExecutionSocket).toHaveBeenCalled();
      expect(socket).toBe(mockSocket);
    });

    it('should cache execution socket for subsequent calls', () => {
      const socket1 = engine.getSocket();
      const socket2 = engine.getSocket();
      expect(getExecutionSocket).toHaveBeenCalledTimes(1);
      expect(socket1).toBe(socket2);
    });

    it('should return null if getExecutionSocket returns null', () => {
      getExecutionSocket.mockReturnValue(null);
      const newEngine = new WorkflowEngine();
      expect(newEngine.getSocket()).toBeNull();
    });
  });

  describe('loadWorkflow', () => {
    const mockWorkflowData = {
      id: 1,
      name: 'Test Workflow',
      workflow_type: 'sequential',
      agents_config: [
        { agentId: 101 },
        { id: 102 }
      ]
    };

    const mockAgentData = {
      id: 101,
      name: 'Agent 1',
      role: 'assistant',
      system_prompt: 'You are helpful',
      model_provider: 'openai',
      model_name: 'gpt-4',
      temperature: 0.7,
      max_tokens: 2048,
      capabilities: ['chat'],
      tools: []
    };

    beforeEach(() => {
      AgentWorkflow.findById = jest.fn();
      AgentModel.findById = jest.fn();
      Agent.mockImplementation((config) => ({
        id: config.id,
        name: config.name,
        role: config.role
      }));
    });

    it('should load workflow from database', async () => {
      AgentWorkflow.findById.mockResolvedValue(mockWorkflowData);
      AgentModel.findById.mockResolvedValue(mockAgentData);

      const workflow = await engine.loadWorkflow(1);

      expect(AgentWorkflow.findById).toHaveBeenCalledWith(1);
      expect(workflow).toEqual(mockWorkflowData);
    });

    it('should throw error if workflow not found', async () => {
      AgentWorkflow.findById.mockResolvedValue(null);

      await expect(engine.loadWorkflow(999)).rejects.toThrow('Workflow not found: 999');
    });

    it('should load and register agents from workflow config', async () => {
      AgentWorkflow.findById.mockResolvedValue(mockWorkflowData);
      AgentModel.findById.mockResolvedValue(mockAgentData);

      await engine.loadWorkflow(1);

      expect(AgentModel.findById).toHaveBeenCalledWith(101);
      expect(AgentModel.findById).toHaveBeenCalledWith(102);
      expect(mockRegistry.register).toHaveBeenCalledTimes(2);
    });

    it('should handle agentId or id in config', async () => {
      AgentWorkflow.findById.mockResolvedValue(mockWorkflowData);
      AgentModel.findById.mockResolvedValue(mockAgentData);

      await engine.loadWorkflow(1);

      expect(AgentModel.findById).toHaveBeenCalledWith(101); // agentId
      expect(AgentModel.findById).toHaveBeenCalledWith(102); // id
    });

    it('should skip agents not found in database', async () => {
      AgentWorkflow.findById.mockResolvedValue(mockWorkflowData);
      AgentModel.findById
        .mockResolvedValueOnce(mockAgentData)
        .mockResolvedValueOnce(null);

      await engine.loadWorkflow(1);

      expect(mockRegistry.register).toHaveBeenCalledTimes(1);
    });

    it('should handle empty agents_config', async () => {
      AgentWorkflow.findById.mockResolvedValue({
        ...mockWorkflowData,
        agents_config: []
      });

      const workflow = await engine.loadWorkflow(1);

      expect(workflow.agents_config).toEqual([]);
      expect(mockRegistry.register).not.toHaveBeenCalled();
    });

    it('should handle null agents_config', async () => {
      AgentWorkflow.findById.mockResolvedValue({
        ...mockWorkflowData,
        agents_config: null
      });

      const workflow = await engine.loadWorkflow(1);

      expect(mockRegistry.register).not.toHaveBeenCalled();
    });

    it('should create Agent with correct config', async () => {
      AgentWorkflow.findById.mockResolvedValue(mockWorkflowData);
      AgentModel.findById.mockResolvedValue(mockAgentData);

      await engine.loadWorkflow(1);

      expect(Agent).toHaveBeenCalledWith({
        id: 101,
        name: 'Agent 1',
        role: 'assistant',
        systemPrompt: 'You are helpful',
        modelProvider: 'openai',
        modelName: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2048,
        capabilities: ['chat'],
        tools: []
      });
    });
  });

  describe('execute', () => {
    const mockWorkflow = {
      id: 1,
      name: 'Test Workflow',
      workflow_type: 'sequential',
      agents_config: [{ agentId: 101 }]
    };

    const mockExecution = {
      id: 1001,
      workflow_id: 1,
      bot_id: 5,
      status: 'running'
    };

    beforeEach(() => {
      AgentWorkflow.findById = jest.fn().mockResolvedValue(mockWorkflow);
      AgentModel.findById = jest.fn().mockResolvedValue({
        id: 101,
        name: 'Agent 1',
        role: 'assistant'
      });
      WorkflowExecution.create = jest.fn().mockResolvedValue(mockExecution);
      WorkflowExecution.update = jest.fn().mockResolvedValue(mockExecution);

      Agent.mockImplementation((config) => ({
        id: config.id,
        name: config.name,
        execute: jest.fn().mockResolvedValue({ success: true, output: 'result' })
      }));
    });

    it('should load workflow before execution', async () => {
      await engine.execute(1, 'test input', 5);

      expect(AgentWorkflow.findById).toHaveBeenCalledWith(1);
    });

    it('should create execution record', async () => {
      await engine.execute(1, 'test input', 5);

      expect(WorkflowExecution.create).toHaveBeenCalledWith({
        workflow_id: 1,
        bot_id: 5,
        status: 'running',
        input: 'test input'
      });
    });

    it('should create execution context with correct data', async () => {
      await engine.execute(1, 'test input', 5);

      expect(AgentContext).toHaveBeenCalledWith(1001);
    });

    it('should emit execution start event', async () => {
      await engine.execute(1, 'test input', 5);

      expect(mockSocket.emitExecutionStart).toHaveBeenCalledWith(1001, {
        workflowId: 1,
        workflowName: 'Test Workflow',
        input: 'test input'
      });
    });

    it('should execute sequential workflow by default', async () => {
      const spy = jest.spyOn(engine, 'executeSequential');
      mockRegistry.get.mockReturnValue({
        id: 101,
        execute: jest.fn().mockResolvedValue({ success: true, output: 'result' })
      });
      AgentExecutionStep.create = jest.fn().mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete = jest.fn();

      await engine.execute(1, 'test input', 5);

      expect(spy).toHaveBeenCalled();
    });

    it('should return successful execution result', async () => {
      mockRegistry.get.mockReturnValue({
        id: 101,
        execute: jest.fn().mockResolvedValue({ success: true, output: 'result', tokensUsed: 100 })
      });
      AgentExecutionStep.create = jest.fn().mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete = jest.fn();

      const result = await engine.execute(1, 'test input', 5);

      expect(result.status).toBe('completed');
      expect(result.executionId).toBe(1001);
      expect(result).toHaveProperty('totalDuration');
    });

    it('should handle execution errors', async () => {
      mockRegistry.get.mockReturnValue({
        id: 101,
        execute: jest.fn().mockRejectedValue(new Error('Execution failed'))
      });
      AgentExecutionStep.create = jest.fn().mockResolvedValue({ id: 1 });
      AgentExecutionStep.fail = jest.fn();

      const result = await engine.execute(1, 'test input', 5);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Execution failed');
    });

    it('should emit execution complete event on success', async () => {
      mockRegistry.get.mockReturnValue({
        id: 101,
        execute: jest.fn().mockResolvedValue({ success: true, output: 'result', tokensUsed: 100 })
      });
      AgentExecutionStep.create = jest.fn().mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete = jest.fn();

      await engine.execute(1, 'test input', 5);

      expect(mockSocket.emitExecutionComplete).toHaveBeenCalledWith(
        1001,
        expect.objectContaining({
          output: expect.anything(),
          totalDuration: expect.any(Number)
        })
      );
    });

    it('should emit execution error event on failure', async () => {
      mockRegistry.get.mockReturnValue({
        id: 101,
        execute: jest.fn().mockRejectedValue(new Error('Failed'))
      });
      AgentExecutionStep.create = jest.fn().mockResolvedValue({ id: 1 });
      AgentExecutionStep.fail = jest.fn();

      await engine.execute(1, 'test input', 5);

      expect(mockSocket.emitExecutionError).toHaveBeenCalledWith(
        1001,
        { error: expect.stringContaining('Failed') }
      );
    });

    it('should handle workflow type: sequential', async () => {
      const spy = jest.spyOn(engine, 'executeSequential');
      mockRegistry.get.mockReturnValue({
        id: 101,
        execute: jest.fn().mockResolvedValue({ success: true, output: 'result' })
      });
      AgentExecutionStep.create = jest.fn().mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete = jest.fn();

      await engine.execute(1, 'test input', 5);

      expect(spy).toHaveBeenCalled();
    });

    it('should handle workflow type: parallel', async () => {
      AgentWorkflow.findById.mockResolvedValue({
        ...mockWorkflow,
        workflow_type: 'parallel'
      });
      const spy = jest.spyOn(engine, 'executeParallel');
      mockRegistry.get.mockReturnValue({
        id: 101,
        execute: jest.fn().mockResolvedValue({ success: true, output: 'result' })
      });
      AgentExecutionStep.create = jest.fn().mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete = jest.fn();

      await engine.execute(1, 'test input', 5);

      expect(spy).toHaveBeenCalled();
    });

    it('should handle workflow type: conditional', async () => {
      AgentWorkflow.findById.mockResolvedValue({
        ...mockWorkflow,
        workflow_type: 'conditional',
        entry_agent_id: 101
      });
      const spy = jest.spyOn(engine, 'executeConditional');
      mockRegistry.get.mockReturnValue({
        id: 101,
        execute: jest.fn().mockResolvedValue({ success: true, output: 'result' })
      });
      AgentExecutionStep.create = jest.fn().mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete = jest.fn();

      await engine.execute(1, 'test input', 5);

      expect(spy).toHaveBeenCalled();
    });

    it('should handle workflow type: mixed', async () => {
      AgentWorkflow.findById.mockResolvedValue({
        ...mockWorkflow,
        workflow_type: 'mixed',
        flow_config: { stages: [] }
      });
      const spy = jest.spyOn(engine, 'executeMixed');

      await engine.execute(1, 'test input', 5);

      expect(spy).toHaveBeenCalled();
    });

    it('should save execution with status and duration on success', async () => {
      mockRegistry.get.mockReturnValue({
        id: 101,
        execute: jest.fn().mockResolvedValue({ success: true, output: 'result', tokensUsed: 100 })
      });
      AgentExecutionStep.create = jest.fn().mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete = jest.fn();

      await engine.execute(1, 'test input', 5);

      expect(WorkflowExecution.update).toHaveBeenCalledWith(
        1001,
        expect.objectContaining({
          status: 'completed',
          output: expect.anything(),
          durationMs: expect.any(Number)
        })
      );
    });

    it('should save execution with error on failure', async () => {
      mockRegistry.get.mockReturnValue({
        id: 101,
        execute: jest.fn().mockRejectedValue(new Error('Failed'))
      });
      AgentExecutionStep.create = jest.fn().mockResolvedValue({ id: 1 });
      AgentExecutionStep.fail = jest.fn();

      await engine.execute(1, 'test input', 5);

      expect(WorkflowExecution.update).toHaveBeenCalledWith(
        1001,
        expect.objectContaining({
          status: 'failed',
          error: expect.stringContaining('Failed'),
          durationMs: expect.any(Number)
        })
      );
    });

    it('should work without socket', async () => {
      getExecutionSocket.mockReturnValue(null);
      const newEngine = new WorkflowEngine();
      mockRegistry.get.mockReturnValue({
        id: 101,
        execute: jest.fn().mockResolvedValue({ success: true, output: 'result' })
      });
      AgentExecutionStep.create = jest.fn().mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete = jest.fn();

      const result = await newEngine.execute(1, 'test input', 5);

      expect(result.status).toBe('completed');
      expect(mockSocket.emitExecutionStart).not.toHaveBeenCalled();
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost based on tokens', () => {
      const cost = engine.calculateCost(1000);
      expect(cost).toBe(0.002); // (1000 / 1000) * 0.002
    });

    it('should handle 0 tokens', () => {
      const cost = engine.calculateCost(0);
      expect(cost).toBe(0);
    });

    it('should handle null tokens', () => {
      const cost = engine.calculateCost(null);
      expect(cost).toBe(0);
    });

    it('should handle undefined tokens', () => {
      const cost = engine.calculateCost(undefined);
      expect(cost).toBe(0);
    });

    it('should calculate correctly for large token counts', () => {
      const cost = engine.calculateCost(50000);
      expect(cost).toBe(0.1); // (50000 / 1000) * 0.002
    });

    it('should calculate correctly for small token counts', () => {
      const cost = engine.calculateCost(100);
      expect(cost).toBe(0.0002); // (100 / 1000) * 0.002
    });
  });

  describe('buildAgentBreakdown', () => {
    it('should build agent breakdown from steps', () => {
      const steps = [
        {
          agentId: 1,
          agentName: 'Agent 1',
          agentRole: 'assistant',
          durationMs: 1000,
          tokensUsed: 100
        },
        {
          agentId: 1,
          agentName: 'Agent 1',
          agentRole: 'assistant',
          durationMs: 500,
          tokensUsed: 50
        }
      ];

      const breakdown = engine.buildAgentBreakdown(steps);

      expect(breakdown).toEqual([
        {
          name: 'Agent 1',
          role: 'assistant',
          duration: 1500,
          tokens: 150
        }
      ]);
    });

    it('should handle multiple agents', () => {
      const steps = [
        { agentId: 1, agentName: 'Agent 1', agentRole: 'assistant', durationMs: 1000, tokensUsed: 100 },
        { agentId: 2, agentName: 'Agent 2', agentRole: 'analyzer', durationMs: 500, tokensUsed: 50 }
      ];

      const breakdown = engine.buildAgentBreakdown(steps);

      expect(breakdown).toHaveLength(2);
      expect(breakdown[0].name).toBe('Agent 1');
      expect(breakdown[1].name).toBe('Agent 2');
    });

    it('should handle missing duration and tokens', () => {
      const steps = [
        { agentId: 1, agentName: 'Agent 1', agentRole: 'assistant' }
      ];

      const breakdown = engine.buildAgentBreakdown(steps);

      expect(breakdown).toEqual([
        { name: 'Agent 1', role: 'assistant', duration: 0, tokens: 0 }
      ]);
    });

    it('should handle missing role', () => {
      const steps = [
        { agentId: 1, agentName: 'Agent 1', durationMs: 1000, tokensUsed: 100 }
      ];

      const breakdown = engine.buildAgentBreakdown(steps);

      expect(breakdown[0].role).toBe('agent');
    });

    it('should handle empty steps array', () => {
      const breakdown = engine.buildAgentBreakdown([]);
      expect(breakdown).toEqual([]);
    });
  });

  describe('executeSequential', () => {
    const mockContext = {
      set: jest.fn(),
      addAgentOutput: jest.fn(),
      setCurrentAgent: jest.fn()
    };

    const mockWorkflow = {
      agents_config: [
        { agentId: 1 },
        { agentId: 2 }
      ]
    };

    beforeEach(() => {
      AgentExecutionStep.create = jest.fn().mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete = jest.fn();
    });

    it('should execute agents sequentially', async () => {
      const agent1 = { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: true, output: 'result1', tokensUsed: 50 }) };
      const agent2 = { id: 2, name: 'Agent 2', execute: jest.fn().mockResolvedValue({ success: true, output: 'result2', tokensUsed: 75 }) };

      mockRegistry.get
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2);

      const result = await engine.executeSequential(mockWorkflow, 'input', mockContext, 1001);

      expect(agent1.execute).toHaveBeenCalledBefore(agent2.execute);
      expect(result.steps).toHaveLength(2);
      expect(result.totalTokens).toBe(125);
    });

    it('should pass output from previous agent as input to next', async () => {
      const agent1 = { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: true, output: 'result1' }) };
      const agent2 = { id: 2, name: 'Agent 2', execute: jest.fn().mockResolvedValue({ success: true, output: 'result2' }) };

      mockRegistry.get
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2);

      const spy = jest.spyOn(engine, 'processStep');

      await engine.executeSequential(mockWorkflow, 'input', mockContext, 1001);

      // Second agent should receive first agent's output as input
      expect(spy).toHaveBeenNthCalledWith(2, agent2, expect.anything(), mockContext, 1001, 1);
    });

    it('should throw error if agent not found', async () => {
      mockRegistry.get.mockReturnValue(null);

      await expect(
        engine.executeSequential(mockWorkflow, 'input', mockContext, 1001)
      ).rejects.toThrow('Agent not found: 1');
    });

    it('should throw error if step fails', async () => {
      const agent1 = { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: false, error: 'Failed' }) };
      mockRegistry.get.mockReturnValue(agent1);
      AgentExecutionStep.fail = jest.fn();

      await expect(
        engine.executeSequential(mockWorkflow, 'input', mockContext, 1001)
      ).rejects.toThrow('Step 0 failed');
    });

    it('should return final output from last agent', async () => {
      const agent1 = { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: true, output: 'result1' }) };
      const agent2 = { id: 2, name: 'Agent 2', execute: jest.fn().mockResolvedValue({ success: true, output: 'final' }) };

      mockRegistry.get
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2);

      const result = await engine.executeSequential(mockWorkflow, 'input', mockContext, 1001);

      expect(result.output).toBe('final');
    });

    it('should handle empty agents_config', async () => {
      const result = await engine.executeSequential(
        { agents_config: [] },
        'input',
        mockContext,
        1001
      );

      expect(result.steps).toEqual([]);
      expect(result.output).toBeUndefined();
    });

    it('should handle id instead of agentId', async () => {
      const agent = { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: true, output: 'result' }) };
      mockRegistry.get.mockReturnValue(agent);

      await engine.executeSequential(
        { agents_config: [{ id: 1 }] },
        'input',
        mockContext,
        1001
      );

      expect(mockRegistry.get).toHaveBeenCalledWith(1);
    });
  });

  describe('executeParallel', () => {
    const mockContext = {
      set: jest.fn(),
      addAgentOutput: jest.fn(),
      setCurrentAgent: jest.fn()
    };

    const mockWorkflow = {
      agents_config: [
        { agentId: 1 },
        { agentId: 2 },
        { agentId: 3 }
      ]
    };

    beforeEach(() => {
      AgentExecutionStep.create = jest.fn().mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete = jest.fn();
    });

    it('should execute all agents in parallel', async () => {
      const agent1 = { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: true, output: 'result1', tokensUsed: 50 }) };
      const agent2 = { id: 2, name: 'Agent 2', execute: jest.fn().mockResolvedValue({ success: true, output: 'result2', tokensUsed: 75 }) };
      const agent3 = { id: 3, name: 'Agent 3', execute: jest.fn().mockResolvedValue({ success: true, output: 'result3', tokensUsed: 100 }) };

      mockRegistry.get
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2)
        .mockReturnValueOnce(agent3);

      const result = await engine.executeParallel(mockWorkflow, 'input', mockContext, 1001);

      expect(result.steps).toHaveLength(3);
      expect(result.totalTokens).toBe(225);
    });

    it('should pass same input to all agents', async () => {
      const agent1 = { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: true, output: 'result1' }) };
      const agent2 = { id: 2, name: 'Agent 2', execute: jest.fn().mockResolvedValue({ success: true, output: 'result2' }) };

      mockRegistry.get
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2);

      const spy = jest.spyOn(engine, 'processStep');

      await engine.executeParallel(
        { agents_config: [{ agentId: 1 }, { agentId: 2 }] },
        'test input',
        mockContext,
        1001
      );

      expect(spy).toHaveBeenCalledWith(agent1, 'test input', mockContext, 1001, 0);
      expect(spy).toHaveBeenCalledWith(agent2, 'test input', mockContext, 1001, 1);
    });

    it('should combine outputs from all agents', async () => {
      const agent1 = { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: true, output: 'result1' }) };
      const agent2 = { id: 2, name: 'Agent 2', execute: jest.fn().mockResolvedValue({ success: true, output: 'result2' }) };

      mockRegistry.get
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2);

      const result = await engine.executeParallel(
        { agents_config: [{ agentId: 1 }, { agentId: 2 }] },
        'input',
        mockContext,
        1001
      );

      expect(result.output).toEqual({
        parallelResults: expect.arrayContaining(['result1', 'result2'])
      });
    });

    it('should throw error if agent not found', async () => {
      mockRegistry.get.mockReturnValue(null);

      await expect(
        engine.executeParallel(mockWorkflow, 'input', mockContext, 1001)
      ).rejects.toThrow('Agent not found: 1');
    });

    it('should handle empty agents_config', async () => {
      const result = await engine.executeParallel(
        { agents_config: [] },
        'input',
        mockContext,
        1001
      );

      expect(result.steps).toEqual([]);
      expect(result.output).toEqual({ parallelResults: [] });
    });
  });

  describe('executeConditional', () => {
    const mockContext = {
      set: jest.fn(),
      addAgentOutput: jest.fn(),
      setCurrentAgent: jest.fn()
    };

    const mockWorkflow = {
      entry_agent_id: 1,
      flow_config: {
        routes: [
          {
            fromAgentId: 1,
            targetAgentId: 2,
            condition: { type: 'contains', field: 'result', value: 'success' }
          },
          {
            fromAgentId: 1,
            targetAgentId: 3,
            condition: { type: 'default' }
          }
        ]
      }
    };

    beforeEach(() => {
      AgentExecutionStep.create = jest.fn().mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete = jest.fn();
    });

    it('should start with entry agent', async () => {
      const agent1 = { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: true, output: { result: 'success' } }) };
      const agent2 = { id: 2, name: 'Agent 2', execute: jest.fn().mockResolvedValue({ success: true, output: 'done' }) };

      mockRegistry.get
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2);

      await engine.executeConditional(mockWorkflow, 'input', mockContext, 1001);

      expect(mockRegistry.get).toHaveBeenCalledWith(1);
    });

    it('should follow conditional route when condition met', async () => {
      const agent1 = { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: true, output: { result: 'success' } }) };
      const agent2 = { id: 2, name: 'Agent 2', execute: jest.fn().mockResolvedValue({ success: true, output: 'done' }) };

      mockRegistry.get
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2);

      const result = await engine.executeConditional(mockWorkflow, 'input', mockContext, 1001);

      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].agentId).toBe(1);
      expect(result.steps[1].agentId).toBe(2);
    });

    it('should follow default route when condition not met', async () => {
      const agent1 = { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: true, output: { result: 'failure' } }) };
      const agent3 = { id: 3, name: 'Agent 3', execute: jest.fn().mockResolvedValue({ success: true, output: 'done' }) };

      mockRegistry.get
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent3);

      const result = await engine.executeConditional(mockWorkflow, 'input', mockContext, 1001);

      expect(result.steps[1].agentId).toBe(3);
    });

    it('should stop when no matching route found', async () => {
      const agent1 = { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: true, output: 'result' }) };

      mockRegistry.get.mockReturnValue(agent1);

      const result = await engine.executeConditional(
        {
          entry_agent_id: 1,
          flow_config: { routes: [] }
        },
        'input',
        mockContext,
        1001
      );

      expect(result.steps).toHaveLength(1);
    });

    it('should throw error if agent not found', async () => {
      mockRegistry.get.mockReturnValue(null);

      await expect(
        engine.executeConditional(mockWorkflow, 'input', mockContext, 1001)
      ).rejects.toThrow('Agent not found: 1');
    });

    it('should throw error if step fails', async () => {
      const agent1 = { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: false, error: 'Failed' }) };
      mockRegistry.get.mockReturnValue(agent1);
      AgentExecutionStep.fail = jest.fn();

      await expect(
        engine.executeConditional(mockWorkflow, 'input', mockContext, 1001)
      ).rejects.toThrow('Conditional step failed');
    });

    it('should handle empty routes array', async () => {
      const agent1 = { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: true, output: 'result' }) };
      mockRegistry.get.mockReturnValue(agent1);

      const result = await engine.executeConditional(
        { entry_agent_id: 1, flow_config: { routes: [] } },
        'input',
        mockContext,
        1001
      );

      expect(result.steps).toHaveLength(1);
    });

    it('should pass output between agents', async () => {
      const agent1 = { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: true, output: { result: 'success' } }) };
      const agent2 = { id: 2, name: 'Agent 2', execute: jest.fn().mockResolvedValue({ success: true, output: 'final' }) };

      mockRegistry.get
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2);

      const spy = jest.spyOn(engine, 'processStep');

      await engine.executeConditional(mockWorkflow, 'input', mockContext, 1001);

      expect(spy).toHaveBeenNthCalledWith(2, agent2, { result: 'success' }, mockContext, 1001, 1);
    });
  });

  describe('executeMixed', () => {
    const mockContext = {
      set: jest.fn(),
      addAgentOutput: jest.fn(),
      setCurrentAgent: jest.fn()
    };

    const mockWorkflow = {
      flow_config: {
        stages: [
          {
            type: 'sequential',
            agents: [1, 2]
          },
          {
            type: 'parallel',
            agents: [3, 4]
          }
        ]
      }
    };

    beforeEach(() => {
      AgentExecutionStep.create = jest.fn().mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete = jest.fn();
    });

    it('should execute sequential stage', async () => {
      const agent1 = { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: true, output: 'result1' }) };
      const agent2 = { id: 2, name: 'Agent 2', execute: jest.fn().mockResolvedValue({ success: true, output: 'result2' }) };

      mockRegistry.get
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2);

      const result = await engine.executeMixed(
        { flow_config: { stages: [{ type: 'sequential', agents: [1, 2] }] } },
        'input',
        mockContext,
        1001
      );

      expect(result.steps).toHaveLength(2);
    });

    it('should execute parallel stage', async () => {
      const agent3 = { id: 3, name: 'Agent 3', execute: jest.fn().mockResolvedValue({ success: true, output: 'result3' }) };
      const agent4 = { id: 4, name: 'Agent 4', execute: jest.fn().mockResolvedValue({ success: true, output: 'result4' }) };

      mockRegistry.get
        .mockReturnValueOnce(agent3)
        .mockReturnValueOnce(agent4);

      const result = await engine.executeMixed(
        { flow_config: { stages: [{ type: 'parallel', agents: [3, 4] }] } },
        'input',
        mockContext,
        1001
      );

      expect(result.steps).toHaveLength(2);
    });

    it('should pass output between stages', async () => {
      const agent1 = { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: true, output: 'stage1' }) };
      const agent2 = { id: 2, name: 'Agent 2', execute: jest.fn().mockResolvedValue({ success: true, output: 'stage2' }) };

      mockRegistry.get
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2);

      const spy = jest.spyOn(engine, 'processStep');

      await engine.executeMixed(
        { flow_config: { stages: [{ type: 'sequential', agents: [1, 2] }] } },
        'input',
        mockContext,
        1001
      );

      expect(spy).toHaveBeenNthCalledWith(2, agent2, 'stage1', mockContext, 1001, 1);
    });

    it('should merge parallel outputs', async () => {
      const agent1 = { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: true, output: 'result1' }) };
      const agent2 = { id: 2, name: 'Agent 2', execute: jest.fn().mockResolvedValue({ success: true, output: 'result2' }) };

      mockRegistry.get
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2);

      const result = await engine.executeMixed(
        { flow_config: { stages: [{ type: 'parallel', agents: [1, 2] }] } },
        'input',
        mockContext,
        1001
      );

      expect(result.output).toEqual({
        parallelResults: expect.arrayContaining(['result1', 'result2'])
      });
    });

    it('should throw error if agent not found in sequential stage', async () => {
      mockRegistry.get.mockReturnValue(null);

      await expect(
        engine.executeMixed(
          { flow_config: { stages: [{ type: 'sequential', agents: [1] }] } },
          'input',
          mockContext,
          1001
        )
      ).rejects.toThrow('Agent not found: 1');
    });

    it('should throw error if agent not found in parallel stage', async () => {
      mockRegistry.get.mockReturnValue(null);

      await expect(
        engine.executeMixed(
          { flow_config: { stages: [{ type: 'parallel', agents: [1] }] } },
          'input',
          mockContext,
          1001
        )
      ).rejects.toThrow('Agent not found: 1');
    });

    it('should throw error if step fails in sequential stage', async () => {
      const agent = { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: false, error: 'Failed' }) };
      mockRegistry.get.mockReturnValue(agent);
      AgentExecutionStep.fail = jest.fn();

      await expect(
        engine.executeMixed(
          { flow_config: { stages: [{ type: 'sequential', agents: [1] }] } },
          'input',
          mockContext,
          1001
        )
      ).rejects.toThrow('Mixed step failed');
    });

    it('should handle empty stages', async () => {
      const result = await engine.executeMixed(
        { flow_config: { stages: [] } },
        'input',
        mockContext,
        1001
      );

      expect(result.steps).toEqual([]);
      expect(result.output).toBe('input');
    });

    it('should execute mixed stages in order', async () => {
      const agents = [
        { id: 1, name: 'Agent 1', execute: jest.fn().mockResolvedValue({ success: true, output: 'seq1' }) },
        { id: 2, name: 'Agent 2', execute: jest.fn().mockResolvedValue({ success: true, output: 'par1' }) },
        { id: 3, name: 'Agent 3', execute: jest.fn().mockResolvedValue({ success: true, output: 'par2' }) },
        { id: 4, name: 'Agent 4', execute: jest.fn().mockResolvedValue({ success: true, output: 'seq2' }) }
      ];

      mockRegistry.get
        .mockReturnValueOnce(agents[0])
        .mockReturnValueOnce(agents[1])
        .mockReturnValueOnce(agents[2])
        .mockReturnValueOnce(agents[3]);

      const result = await engine.executeMixed(mockWorkflow, 'input', mockContext, 1001);

      expect(result.steps).toHaveLength(4);
      expect(result.steps[0].agentId).toBe(1);
      expect(result.steps[1].agentId).toBe(2);
      expect(result.steps[2].agentId).toBe(3);
      expect(result.steps[3].agentId).toBe(4);
    });
  });

  describe('processStep', () => {
    const mockAgent = {
      id: 1,
      name: 'Test Agent',
      role: 'assistant',
      execute: jest.fn()
    };

    const mockContext = {
      setCurrentAgent: jest.fn(),
      addAgentOutput: jest.fn()
    };

    beforeEach(() => {
      AgentExecutionStep.create = jest.fn().mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete = jest.fn();
      AgentExecutionStep.fail = jest.fn();
    });

    it('should create step record', async () => {
      mockAgent.execute.mockResolvedValue({ success: true, output: 'result', tokensUsed: 100 });

      await engine.processStep(mockAgent, 'input', mockContext, 1001, 0);

      expect(AgentExecutionStep.create).toHaveBeenCalledWith({
        execution_id: 1001,
        agent_id: 1,
        step_order: 0,
        status: 'running',
        input: 'input'
      });
    });

    it('should emit step start event', async () => {
      mockAgent.execute.mockResolvedValue({ success: true, output: 'result' });

      await engine.processStep(mockAgent, 'input', mockContext, 1001, 0);

      expect(mockSocket.emitStepStart).toHaveBeenCalledWith(1001, {
        stepId: 1,
        agentId: 1,
        agentName: 'Test Agent',
        agentRole: 'assistant',
        input: 'input',
        order: 0
      });
    });

    it('should set current agent in context', async () => {
      mockAgent.execute.mockResolvedValue({ success: true, output: 'result' });

      await engine.processStep(mockAgent, 'input', mockContext, 1001, 0);

      expect(mockContext.setCurrentAgent).toHaveBeenCalledWith(mockAgent);
    });

    it('should execute agent', async () => {
      mockAgent.execute.mockResolvedValue({ success: true, output: 'result', tokensUsed: 100 });

      await engine.processStep(mockAgent, 'input', mockContext, 1001, 0);

      expect(mockAgent.execute).toHaveBeenCalledWith('input', mockContext);
    });

    it('should complete step on success', async () => {
      mockAgent.execute.mockResolvedValue({ success: true, output: 'result', tokensUsed: 100 });

      await engine.processStep(mockAgent, 'input', mockContext, 1001, 0);

      expect(AgentExecutionStep.complete).toHaveBeenCalledWith(
        1,
        'result',
        null,
        100,
        expect.any(Number)
      );
    });

    it('should add output to context on success', async () => {
      mockAgent.execute.mockResolvedValue({ success: true, output: 'result' });

      await engine.processStep(mockAgent, 'input', mockContext, 1001, 0);

      expect(mockContext.addAgentOutput).toHaveBeenCalledWith(1, 'result');
    });

    it('should emit step complete event on success', async () => {
      mockAgent.execute.mockResolvedValue({ success: true, output: 'result', tokensUsed: 100 });

      await engine.processStep(mockAgent, 'input', mockContext, 1001, 0);

      expect(mockSocket.emitStepComplete).toHaveBeenCalledWith(1001, {
        stepId: 1,
        agentId: 1,
        agentName: 'Test Agent',
        output: 'result',
        duration: expect.any(Number),
        tokens: 100,
        cost: expect.any(Number)
      });
    });

    it('should return success result', async () => {
      mockAgent.execute.mockResolvedValue({ success: true, output: 'result', tokensUsed: 100 });

      const result = await engine.processStep(mockAgent, 'input', mockContext, 1001, 0);

      expect(result).toEqual({
        stepId: 1,
        agentId: 1,
        agentName: 'Test Agent',
        agentRole: 'assistant',
        success: true,
        output: 'result',
        tokensUsed: 100,
        durationMs: expect.any(Number),
        attempt: 1
      });
    });

    it('should retry on failure', async () => {
      mockAgent.execute
        .mockResolvedValueOnce({ success: false, error: 'Failed' })
        .mockResolvedValueOnce({ success: false, error: 'Failed again' })
        .mockResolvedValueOnce({ success: true, output: 'success', tokensUsed: 100 });

      const result = await engine.processStep(mockAgent, 'input', mockContext, 1001, 0);

      expect(mockAgent.execute).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
      expect(result.attempt).toBe(3);
    });

    it('should retry on exception', async () => {
      mockAgent.execute
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true, output: 'success', tokensUsed: 100 });

      const result = await engine.processStep(mockAgent, 'input', mockContext, 1001, 0);

      expect(mockAgent.execute).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it('should delay between retries', async () => {
      jest.useFakeTimers();
      mockAgent.execute
        .mockResolvedValueOnce({ success: false, error: 'Failed' })
        .mockResolvedValueOnce({ success: true, output: 'success', tokensUsed: 100 });

      const promise = engine.processStep(mockAgent, 'input', mockContext, 1001, 0);

      // Wait for first attempt
      await Promise.resolve();

      // Advance timers for retry delay
      jest.advanceTimersByTime(engine.retryDelay);

      await promise;

      expect(mockAgent.execute).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should fail step after max retries', async () => {
      mockAgent.execute.mockResolvedValue({ success: false, error: 'Failed' });

      const result = await engine.processStep(mockAgent, 'input', mockContext, 1001, 0);

      expect(mockAgent.execute).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed');
    });

    it('should mark step as failed after max retries', async () => {
      mockAgent.execute.mockResolvedValue({ success: false, error: 'Failed' });

      await engine.processStep(mockAgent, 'input', mockContext, 1001, 0);

      expect(AgentExecutionStep.fail).toHaveBeenCalledWith(1, 'Failed', expect.any(Number));
    });

    it('should emit step failed event after max retries', async () => {
      mockAgent.execute.mockResolvedValue({ success: false, error: 'Failed' });

      await engine.processStep(mockAgent, 'input', mockContext, 1001, 0);

      expect(mockSocket.emitStepFailed).toHaveBeenCalledWith(1001, {
        stepId: 1,
        agentId: 1,
        agentName: 'Test Agent',
        error: 'Failed',
        duration: expect.any(Number)
      });
    });

    it('should return failure result after max retries', async () => {
      mockAgent.execute.mockResolvedValue({ success: false, error: 'Failed' });

      const result = await engine.processStep(mockAgent, 'input', mockContext, 1001, 0);

      expect(result).toEqual({
        stepId: 1,
        agentId: 1,
        agentName: 'Test Agent',
        agentRole: 'assistant',
        success: false,
        error: 'Failed',
        attempts: 3
      });
    });

    it('should work without socket', async () => {
      getExecutionSocket.mockReturnValue(null);
      const newEngine = new WorkflowEngine();
      mockAgent.execute.mockResolvedValue({ success: true, output: 'result' });

      const result = await newEngine.processStep(mockAgent, 'input', mockContext, 1001, 0);

      expect(result.success).toBe(true);
      expect(mockSocket.emitStepStart).not.toHaveBeenCalled();
    });

    it('should handle missing tokensUsed in result', async () => {
      mockAgent.execute.mockResolvedValue({ success: true, output: 'result' });

      const result = await engine.processStep(mockAgent, 'input', mockContext, 1001, 0);

      expect(result.tokensUsed).toBeUndefined();
    });
  });

  describe('handleError', () => {
    const mockContext = {
      toJSON: jest.fn().mockReturnValue({ data: 'context' })
    };

    beforeEach(() => {
      WorkflowExecution.update = jest.fn();
    });

    it('should log error', async () => {
      const error = new Error('Test error');

      await engine.handleError(1001, error, mockContext);

      expect(log.error).toHaveBeenCalledWith(
        'Workflow execution 1001 failed:',
        { error: 'Test error', executionId: 1001 }
      );
    });

    it('should save execution as failed', async () => {
      const error = new Error('Test error');

      await engine.handleError(1001, error, mockContext);

      expect(WorkflowExecution.update).toHaveBeenCalledWith(1001, {
        status: 'failed',
        error: 'Test error'
      });
    });

    it('should return error result with context', async () => {
      const error = new Error('Test error');

      const result = await engine.handleError(1001, error, mockContext);

      expect(result).toEqual({
        success: false,
        error: 'Test error',
        context: { data: 'context' }
      });
    });

    it('should handle error without message', async () => {
      const error = 'String error';

      const result = await engine.handleError(1001, error, mockContext);

      expect(result.error).toBe('String error');
    });
  });

  describe('saveExecution', () => {
    beforeEach(() => {
      WorkflowExecution.update = jest.fn();
    });

    it('should update execution with all fields', async () => {
      await engine.saveExecution(1001, {
        status: 'completed',
        output: 'result',
        totalTokens: 100,
        durationMs: 5000,
        error: null
      });

      expect(WorkflowExecution.update).toHaveBeenCalledWith(1001, {
        status: 'completed',
        output: 'result',
        total_tokens: 100,
        duration_ms: 5000,
        error: null
      });
    });

    it('should update execution with error', async () => {
      await engine.saveExecution(1001, {
        status: 'failed',
        error: 'Test error',
        durationMs: 1000
      });

      expect(WorkflowExecution.update).toHaveBeenCalledWith(1001, {
        status: 'failed',
        output: undefined,
        total_tokens: undefined,
        duration_ms: 1000,
        error: 'Test error'
      });
    });
  });

  describe('evaluateCondition', () => {
    it('should return true for null/undefined condition', () => {
      expect(engine.evaluateCondition(null, 'output')).toBe(true);
      expect(engine.evaluateCondition(undefined, 'output')).toBe(true);
    });

    it('should evaluate string condition with includes', () => {
      expect(engine.evaluateCondition('success', 'Operation was successful')).toBe(true);
      expect(engine.evaluateCondition('failed', 'Operation was successful')).toBe(false);
    });

    it('should evaluate string condition with object output', () => {
      expect(engine.evaluateCondition('success', { result: 'success' })).toBe(true);
      expect(engine.evaluateCondition('failed', { result: 'success' })).toBe(false);
    });

    it('should evaluate equals condition', () => {
      const condition = { type: 'equals', field: 'status', value: 'complete' };
      expect(engine.evaluateCondition(condition, { status: 'complete' })).toBe(true);
      expect(engine.evaluateCondition(condition, { status: 'pending' })).toBe(false);
    });

    it('should evaluate contains condition', () => {
      const condition = { type: 'contains', field: 'message', value: 'success' };
      expect(engine.evaluateCondition(condition, { message: 'Operation successful' })).toBe(true);
      expect(engine.evaluateCondition(condition, { message: 'Operation failed' })).toBe(false);
    });

    it('should evaluate default condition', () => {
      const condition = { type: 'default' };
      expect(engine.evaluateCondition(condition, 'any output')).toBe(true);
    });

    it('should handle missing field in output', () => {
      const condition = { type: 'equals', field: 'status', value: 'complete' };
      expect(engine.evaluateCondition(condition, {})).toBe(false);
    });

    it('should handle null output with equals', () => {
      const condition = { type: 'equals', field: 'status', value: 'complete' };
      expect(engine.evaluateCondition(condition, null)).toBe(false);
    });

    it('should handle null output with contains', () => {
      const condition = { type: 'contains', field: 'message', value: 'test' };
      expect(engine.evaluateCondition(condition, null)).toBe(false);
    });

    it('should handle unknown condition type', () => {
      const condition = { type: 'unknown' };
      expect(engine.evaluateCondition(condition, 'output')).toBe(false);
    });
  });

  describe('delay', () => {
    it('should delay for specified milliseconds', async () => {
      jest.useFakeTimers();

      const promise = engine.delay(1000);

      jest.advanceTimersByTime(999);
      await Promise.resolve(); // Let any pending promises resolve

      jest.advanceTimersByTime(1);
      await promise;

      expect(true).toBe(true); // If we get here, delay worked

      jest.useRealTimers();
    });

    it('should handle zero delay', async () => {
      jest.useFakeTimers();

      const promise = engine.delay(0);
      jest.advanceTimersByTime(0);
      await promise;

      expect(true).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('clear', () => {
    it('should clear registry', () => {
      engine.clear();
      expect(mockRegistry.clear).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle workflow execution with no socket events', async () => {
      getExecutionSocket.mockReturnValue(null);
      const newEngine = new WorkflowEngine();

      const mockWorkflow = {
        id: 1,
        name: 'Test',
        workflow_type: 'sequential',
        agents_config: []
      };

      AgentWorkflow.findById = jest.fn().mockResolvedValue(mockWorkflow);
      WorkflowExecution.create = jest.fn().mockResolvedValue({ id: 1001 });
      WorkflowExecution.update = jest.fn();

      const result = await newEngine.execute(1, 'input', 5);

      expect(result.status).toBe('completed');
    });

    it('should handle very large token counts', async () => {
      const cost = engine.calculateCost(1000000);
      expect(cost).toBe(2); // (1000000 / 1000) * 0.002
    });

    it('should handle complex nested output structures', async () => {
      const output = {
        level1: {
          level2: {
            level3: 'deep value'
          }
        }
      };

      expect(engine.evaluateCondition('deep value', output)).toBe(true);
    });

    it('should handle concurrent workflow executions', async () => {
      const mockWorkflow = {
        id: 1,
        name: 'Test',
        workflow_type: 'sequential',
        agents_config: [{ agentId: 1 }]
      };

      AgentWorkflow.findById = jest.fn().mockResolvedValue(mockWorkflow);
      AgentModel.findById = jest.fn().mockResolvedValue({ id: 1, name: 'Agent' });
      WorkflowExecution.create = jest.fn()
        .mockResolvedValueOnce({ id: 1001 })
        .mockResolvedValueOnce({ id: 1002 });
      WorkflowExecution.update = jest.fn();

      mockRegistry.get.mockReturnValue({
        id: 1,
        execute: jest.fn().mockResolvedValue({ success: true, output: 'result' })
      });
      AgentExecutionStep.create = jest.fn().mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete = jest.fn();

      const [result1, result2] = await Promise.all([
        engine.execute(1, 'input1', 5),
        engine.execute(1, 'input2', 5)
      ]);

      expect(result1.executionId).toBe(1001);
      expect(result2.executionId).toBe(1002);
    });
  });
});
