/**
 * WorkflowEngine Tests
 * Tests for server/agents/workflows/WorkflowEngine.js
 */

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
jest.mock('../../../models/AgentMessage', () => ({}));
jest.mock('../../../websocket', () => ({
  getExecutionSocket: jest.fn(() => null)
}));
jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));
jest.mock('openai', () => jest.fn());
jest.mock('@anthropic-ai/sdk', () => jest.fn());
jest.mock('../../../models/AgentTool', () => ({ findEnabledByAgentId: jest.fn() }));
jest.mock('../../../models/Tool', () => ({ findById: jest.fn() }));
jest.mock('../../../tools/types', () => ({ createTool: jest.fn() }));

const WorkflowEngine = require('../../../agents/workflows/WorkflowEngine');
const AgentWorkflow = require('../../../models/AgentWorkflow');
const AgentModel = require('../../../models/Agent');
const WorkflowExecution = require('../../../models/WorkflowExecution');
const AgentExecutionStep = require('../../../models/AgentExecutionStep');

describe('WorkflowEngine', () => {
  let engine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new WorkflowEngine();
  });

  describe('constructor', () => {
    it('should initialize registry', () => {
      expect(engine.registry).toBeDefined();
    });

    it('should initialize executor', () => {
      expect(engine.executor).toBeDefined();
    });

    it('should set default maxRetries', () => {
      expect(engine.maxRetries).toBe(3);
    });

    it('should set default retryDelay', () => {
      expect(engine.retryDelay).toBe(1000);
    });

    it('should initialize executionSocket as null', () => {
      expect(engine.executionSocket).toBeNull();
    });
  });

  describe('calculateCost', () => {
    it('should return 0 for null tokens', () => {
      expect(engine.calculateCost(null)).toBe(0);
    });

    it('should return 0 for undefined tokens', () => {
      expect(engine.calculateCost(undefined)).toBe(0);
    });

    it('should return 0 for 0 tokens', () => {
      expect(engine.calculateCost(0)).toBe(0);
    });

    it('should calculate cost correctly', () => {
      const cost = engine.calculateCost(1000);
      expect(cost).toBe(0.002);
    });

    it('should handle large token counts', () => {
      const cost = engine.calculateCost(100000);
      expect(cost).toBe(0.2);
    });
  });

  describe('buildAgentBreakdown', () => {
    it('should build breakdown from steps', () => {
      const steps = [
        { agentId: 1, agentName: 'Agent1', agentRole: 'writer', durationMs: 100, tokensUsed: 500 },
        { agentId: 1, agentName: 'Agent1', agentRole: 'writer', durationMs: 200, tokensUsed: 300 },
        { agentId: 2, agentName: 'Agent2', agentRole: 'reviewer', durationMs: 150, tokensUsed: 400 }
      ];

      const breakdown = engine.buildAgentBreakdown(steps);

      expect(breakdown).toHaveLength(2);

      const agent1 = breakdown.find(b => b.name === 'Agent1');
      expect(agent1.duration).toBe(300);
      expect(agent1.tokens).toBe(800);

      const agent2 = breakdown.find(b => b.name === 'Agent2');
      expect(agent2.duration).toBe(150);
      expect(agent2.tokens).toBe(400);
    });

    it('should handle missing duration and tokens', () => {
      const steps = [
        { agentId: 1, agentName: 'Agent1' }
      ];

      const breakdown = engine.buildAgentBreakdown(steps);

      expect(breakdown[0].duration).toBe(0);
      expect(breakdown[0].tokens).toBe(0);
    });

    it('should use default role if not provided', () => {
      const steps = [
        { agentId: 1, agentName: 'Agent1', durationMs: 100 }
      ];

      const breakdown = engine.buildAgentBreakdown(steps);

      expect(breakdown[0].role).toBe('agent');
    });
  });

  describe('evaluateCondition', () => {
    it('should return true for null condition', () => {
      expect(engine.evaluateCondition(null, 'any output')).toBe(true);
    });

    it('should return true for undefined condition', () => {
      expect(engine.evaluateCondition(undefined, 'any output')).toBe(true);
    });

    it('should check string condition in string output', () => {
      expect(engine.evaluateCondition('success', 'Operation was a success')).toBe(true);
      expect(engine.evaluateCondition('failure', 'Operation was a success')).toBe(false);
    });

    it('should check string condition in object output', () => {
      const output = { status: 'approved', message: 'Good' };
      expect(engine.evaluateCondition('approved', output)).toBe(true);
      expect(engine.evaluateCondition('rejected', output)).toBe(false);
    });

    it('should evaluate equals condition', () => {
      const condition = { type: 'equals', field: 'status', value: 'completed' };

      expect(engine.evaluateCondition(condition, { status: 'completed' })).toBe(true);
      expect(engine.evaluateCondition(condition, { status: 'pending' })).toBe(false);
    });

    it('should evaluate contains condition', () => {
      const condition = { type: 'contains', field: 'message', value: 'success' };

      expect(engine.evaluateCondition(condition, { message: 'Operation success!' })).toBe(true);
      expect(engine.evaluateCondition(condition, { message: 'Operation failed' })).toBe(false);
    });

    it('should return true for default condition type', () => {
      const condition = { type: 'default' };
      expect(engine.evaluateCondition(condition, 'any')).toBe(true);
    });

    it('should return false for unknown condition type', () => {
      const condition = { type: 'unknown' };
      expect(engine.evaluateCondition(condition, 'any')).toBe(false);
    });

    it('should handle missing field in output', () => {
      const condition = { type: 'equals', field: 'missing', value: 'test' };
      expect(engine.evaluateCondition(condition, { other: 'value' })).toBe(false);
    });
  });

  describe('delay', () => {
    it('should delay for specified time', async () => {
      const start = Date.now();
      await engine.delay(50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });

  describe('clear', () => {
    it('should clear registry', () => {
      engine.registry.clear = jest.fn();
      engine.clear();

      expect(engine.registry.clear).toHaveBeenCalled();
    });
  });

  describe('loadWorkflow', () => {
    it('should throw error if workflow not found', async () => {
      AgentWorkflow.findById.mockResolvedValue(null);

      await expect(engine.loadWorkflow(999))
        .rejects.toThrow('Workflow not found: 999');
    });

    it('should load workflow and register agents', async () => {
      const mockWorkflow = {
        id: 1,
        name: 'Test Workflow',
        agents_config: [{ agentId: 1 }]
      };
      const mockAgent = {
        id: 1,
        name: 'TestAgent',
        role: 'writer',
        system_prompt: 'You are a writer'
      };

      AgentWorkflow.findById.mockResolvedValue(mockWorkflow);
      AgentModel.findById.mockResolvedValue(mockAgent);

      const workflow = await engine.loadWorkflow(1);

      expect(workflow).toEqual(mockWorkflow);
      expect(AgentModel.findById).toHaveBeenCalledWith(1);
    });

    it('should handle config with id instead of agentId', async () => {
      const mockWorkflow = {
        id: 1,
        agents_config: [{ id: 2 }]
      };
      AgentWorkflow.findById.mockResolvedValue(mockWorkflow);
      AgentModel.findById.mockResolvedValue(null);

      await engine.loadWorkflow(1);

      expect(AgentModel.findById).toHaveBeenCalledWith(2);
    });
  });

  describe('saveExecution', () => {
    it('should update execution with data', async () => {
      WorkflowExecution.update.mockResolvedValue({ id: 1 });

      await engine.saveExecution(1, {
        status: 'completed',
        output: { result: 'done' },
        totalTokens: 1000,
        durationMs: 5000
      });

      expect(WorkflowExecution.update).toHaveBeenCalledWith(1, {
        status: 'completed',
        output: { result: 'done' },
        total_tokens: 1000,
        duration_ms: 5000,
        error: undefined
      });
    });

    it('should save error state', async () => {
      WorkflowExecution.update.mockResolvedValue({ id: 1 });

      await engine.saveExecution(1, {
        status: 'failed',
        error: 'Something went wrong'
      });

      expect(WorkflowExecution.update).toHaveBeenCalledWith(1, expect.objectContaining({
        status: 'failed',
        error: 'Something went wrong'
      }));
    });
  });

  describe('handleError', () => {
    it('should save failed execution', async () => {
      WorkflowExecution.update.mockResolvedValue({});
      const context = { toJSON: () => ({ key: 'value' }) };

      const result = await engine.handleError(1, new Error('Test error'), context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
      expect(WorkflowExecution.update).toHaveBeenCalled();
    });

    it('should handle string errors', async () => {
      WorkflowExecution.update.mockResolvedValue({});
      const context = { toJSON: () => ({}) };

      const result = await engine.handleError(1, 'String error', context);

      expect(result.error).toBe('String error');
    });
  });

  describe('getSocket', () => {
    it('should cache socket instance', () => {
      const { getExecutionSocket } = require('../../../websocket');
      const mockSocket = { emit: jest.fn() };
      getExecutionSocket.mockReturnValue(mockSocket);

      const socket1 = engine.getSocket();
      const socket2 = engine.getSocket();

      expect(socket1).toBe(socket2);
    });

    it('should return null if no socket', () => {
      const { getExecutionSocket } = require('../../../websocket');
      getExecutionSocket.mockReturnValue(null);
      engine.executionSocket = null;

      const socket = engine.getSocket();
      expect(socket).toBeNull();
    });
  });

  describe('executeSequential', () => {
    let mockAgent;
    let mockContext;

    beforeEach(() => {
      mockAgent = {
        id: 1,
        name: 'TestAgent',
        role: 'assistant',
        execute: jest.fn().mockResolvedValue({ success: true, output: 'done', tokensUsed: 100 })
      };

      mockContext = {
        set: jest.fn(),
        get: jest.fn(),
        setCurrentAgent: jest.fn(),
        addAgentOutput: jest.fn()
      };

      engine.registry.get = jest.fn().mockReturnValue(mockAgent);
      AgentExecutionStep.create.mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete.mockResolvedValue({});
    });

    it('should execute agents in sequence', async () => {
      const workflow = { agents_config: [{ agentId: 1 }, { agentId: 2 }] };

      const result = await engine.executeSequential(workflow, 'input', mockContext, 100);

      expect(result.steps).toHaveLength(2);
      expect(result.totalTokens).toBe(200);
    });

    it('should throw if agent not found', async () => {
      engine.registry.get = jest.fn().mockReturnValue(null);
      const workflow = { agents_config: [{ agentId: 999 }] };

      await expect(engine.executeSequential(workflow, 'input', mockContext, 100))
        .rejects.toThrow('Agent not found: 999');
    });

    it('should throw on step failure', async () => {
      mockAgent.execute = jest.fn().mockResolvedValue({ success: false, error: 'Step failed' });
      AgentExecutionStep.fail.mockResolvedValue({});

      const workflow = { agents_config: [{ agentId: 1 }] };

      await expect(engine.executeSequential(workflow, 'input', mockContext, 100))
        .rejects.toThrow('Step 0 failed: Step failed');
    });

    it('should pass output to next agent', async () => {
      let callCount = 0;
      mockAgent.execute = jest.fn().mockImplementation(() => {
        callCount++;
        return { success: true, output: `output-${callCount}`, tokensUsed: 50 };
      });

      const workflow = { agents_config: [{ agentId: 1 }, { agentId: 1 }] };

      await engine.executeSequential(workflow, 'initial', mockContext, 100);

      expect(mockAgent.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe('executeParallel', () => {
    let mockAgent;
    let mockContext;

    beforeEach(() => {
      mockAgent = {
        id: 1,
        name: 'TestAgent',
        execute: jest.fn().mockResolvedValue({ success: true, output: 'parallel-done', tokensUsed: 50 })
      };

      mockContext = {
        set: jest.fn(),
        setCurrentAgent: jest.fn(),
        addAgentOutput: jest.fn()
      };

      engine.registry.get = jest.fn().mockReturnValue(mockAgent);
      AgentExecutionStep.create.mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete.mockResolvedValue({});
    });

    it('should execute agents in parallel', async () => {
      const workflow = { agents_config: [{ agentId: 1 }, { agentId: 2 }, { agentId: 3 }] };

      const result = await engine.executeParallel(workflow, 'input', mockContext, 100);

      expect(result.steps).toHaveLength(3);
      expect(result.output.parallelResults).toHaveLength(3);
    });

    it('should throw if agent not found', async () => {
      engine.registry.get = jest.fn()
        .mockReturnValueOnce(mockAgent)
        .mockReturnValueOnce(null);

      const workflow = { agents_config: [{ agentId: 1 }, { agentId: 999 }] };

      await expect(engine.executeParallel(workflow, 'input', mockContext, 100))
        .rejects.toThrow('Agent not found: 999');
    });
  });

  describe('executeConditional', () => {
    let mockAgent;
    let mockContext;

    beforeEach(() => {
      mockAgent = {
        id: 1,
        name: 'RouterAgent',
        execute: jest.fn().mockResolvedValue({ success: true, output: 'route-result', tokensUsed: 30 })
      };

      mockContext = {
        set: jest.fn(),
        setCurrentAgent: jest.fn(),
        addAgentOutput: jest.fn()
      };

      engine.registry.get = jest.fn().mockReturnValue(mockAgent);
      AgentExecutionStep.create.mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete.mockResolvedValue({});
    });

    it('should execute conditional workflow', async () => {
      const workflow = {
        entry_agent_id: 1,
        flow_config: { routes: [] }
      };

      const result = await engine.executeConditional(workflow, 'input', mockContext, 100);

      expect(result.steps).toHaveLength(1);
    });

    it('should follow route based on condition', async () => {
      const agent1 = { id: 1, name: 'Agent1', execute: jest.fn().mockResolvedValue({ success: true, output: 'go-next', tokensUsed: 20 }) };
      const agent2 = { id: 2, name: 'Agent2', execute: jest.fn().mockResolvedValue({ success: true, output: 'done', tokensUsed: 20 }) };

      engine.registry.get = jest.fn()
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2);

      const workflow = {
        entry_agent_id: 1,
        flow_config: {
          routes: [{ fromAgentId: 1, condition: 'next', targetAgentId: 2 }]
        }
      };

      const result = await engine.executeConditional(workflow, 'input', mockContext, 100);

      expect(result.steps).toHaveLength(2);
    });

    it('should throw if agent not found', async () => {
      engine.registry.get = jest.fn().mockReturnValue(null);

      const workflow = { entry_agent_id: 999, flow_config: { routes: [] } };

      await expect(engine.executeConditional(workflow, 'input', mockContext, 100))
        .rejects.toThrow('Agent not found: 999');
    });
  });

  describe('executeMixed', () => {
    let mockAgent;
    let mockContext;

    beforeEach(() => {
      mockAgent = {
        id: 1,
        name: 'TestAgent',
        execute: jest.fn().mockResolvedValue({ success: true, output: 'mixed-done', tokensUsed: 40 })
      };

      mockContext = {
        set: jest.fn(),
        setCurrentAgent: jest.fn(),
        addAgentOutput: jest.fn()
      };

      engine.registry.get = jest.fn().mockReturnValue(mockAgent);
      AgentExecutionStep.create.mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete.mockResolvedValue({});
    });

    it('should execute mixed workflow with sequential stage', async () => {
      const workflow = {
        flow_config: {
          stages: [{ type: 'sequential', agents: [1, 2] }]
        }
      };

      const result = await engine.executeMixed(workflow, 'input', mockContext, 100);

      expect(result.steps).toHaveLength(2);
    });

    it('should execute mixed workflow with parallel stage', async () => {
      const workflow = {
        flow_config: {
          stages: [{ type: 'parallel', agents: [1, 2, 3] }]
        }
      };

      const result = await engine.executeMixed(workflow, 'input', mockContext, 100);

      expect(result.steps).toHaveLength(3);
      expect(result.output.parallelResults).toBeDefined();
    });

    it('should handle empty stages', async () => {
      const workflow = { flow_config: { stages: [] } };

      const result = await engine.executeMixed(workflow, 'input', mockContext, 100);

      expect(result.steps).toHaveLength(0);
    });

    it('should throw if agent not found in sequential stage', async () => {
      engine.registry.get = jest.fn().mockReturnValue(null);

      const workflow = {
        flow_config: { stages: [{ type: 'sequential', agents: [999] }] }
      };

      await expect(engine.executeMixed(workflow, 'input', mockContext, 100))
        .rejects.toThrow('Agent not found: 999');
    });

    it('should throw if agent not found in parallel stage', async () => {
      engine.registry.get = jest.fn()
        .mockReturnValueOnce(mockAgent)
        .mockReturnValueOnce(null);

      const workflow = {
        flow_config: { stages: [{ type: 'parallel', agents: [1, 999] }] }
      };

      await expect(engine.executeMixed(workflow, 'input', mockContext, 100))
        .rejects.toThrow('Agent not found: 999');
    });
  });

  describe('processStep', () => {
    let mockAgent;
    let mockContext;

    beforeEach(() => {
      mockAgent = {
        id: 1,
        name: 'TestAgent',
        role: 'assistant',
        execute: jest.fn().mockResolvedValue({ success: true, output: 'step-done', tokensUsed: 75 })
      };

      mockContext = {
        setCurrentAgent: jest.fn(),
        addAgentOutput: jest.fn()
      };

      AgentExecutionStep.create.mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete.mockResolvedValue({});
      AgentExecutionStep.fail.mockResolvedValue({});
    });

    it('should process step successfully', async () => {
      const result = await engine.processStep(mockAgent, 'input', mockContext, 100, 0);

      expect(result.success).toBe(true);
      expect(result.output).toBe('step-done');
      expect(result.tokensUsed).toBe(75);
    });

    it('should retry on failure', async () => {
      engine.maxRetries = 3;
      engine.retryDelay = 10;

      mockAgent.execute = jest.fn()
        .mockResolvedValueOnce({ success: false, error: 'First fail' })
        .mockResolvedValueOnce({ success: false, error: 'Second fail' })
        .mockResolvedValueOnce({ success: true, output: 'success', tokensUsed: 50 });

      const result = await engine.processStep(mockAgent, 'input', mockContext, 100, 0);

      expect(result.success).toBe(true);
      expect(mockAgent.execute).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      engine.maxRetries = 2;
      engine.retryDelay = 10;

      mockAgent.execute = jest.fn().mockResolvedValue({ success: false, error: 'Always fails' });

      const result = await engine.processStep(mockAgent, 'input', mockContext, 100, 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Always fails');
      expect(AgentExecutionStep.fail).toHaveBeenCalled();
    });

    it('should handle exceptions', async () => {
      engine.maxRetries = 1;
      mockAgent.execute = jest.fn().mockRejectedValue(new Error('Exception'));

      const result = await engine.processStep(mockAgent, 'input', mockContext, 100, 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Exception');
    });
  });

  describe('execute - integration', () => {
    let mockAgent;

    beforeEach(() => {
      mockAgent = {
        id: 1,
        name: 'TestAgent',
        role: 'assistant',
        execute: jest.fn().mockResolvedValue({ success: true, output: 'executed', tokensUsed: 100 })
      };

      AgentWorkflow.findById.mockResolvedValue({
        id: 1,
        name: 'Test Workflow',
        workflow_type: 'sequential',
        agents_config: [{ agentId: 1 }]
      });

      AgentModel.findById.mockResolvedValue({
        id: 1,
        name: 'TestAgent',
        role: 'assistant'
      });

      WorkflowExecution.create.mockResolvedValue({ id: 100 });
      WorkflowExecution.update.mockResolvedValue({});
      AgentExecutionStep.create.mockResolvedValue({ id: 1 });
      AgentExecutionStep.complete.mockResolvedValue({});

      engine.registry.get = jest.fn().mockReturnValue(mockAgent);
    });

    it('should execute full workflow', async () => {
      const result = await engine.execute(1, { message: 'test' }, 1);

      expect(result.status).toBe('completed');
      expect(result.executionId).toBe(100);
    });

    it('should handle parallel workflow type', async () => {
      AgentWorkflow.findById.mockResolvedValue({
        id: 1,
        name: 'Parallel Workflow',
        workflow_type: 'parallel',
        agents_config: [{ agentId: 1 }]
      });

      const result = await engine.execute(1, { message: 'test' }, 1);

      expect(result.status).toBe('completed');
    });

    it('should handle conditional workflow type', async () => {
      AgentWorkflow.findById.mockResolvedValue({
        id: 1,
        name: 'Conditional Workflow',
        workflow_type: 'conditional',
        entry_agent_id: 1,
        agents_config: [{ agentId: 1 }],
        flow_config: { routes: [] }
      });

      const result = await engine.execute(1, { message: 'test' }, 1);

      expect(result.status).toBe('completed');
    });

    it('should handle mixed workflow type', async () => {
      AgentWorkflow.findById.mockResolvedValue({
        id: 1,
        name: 'Mixed Workflow',
        workflow_type: 'mixed',
        agents_config: [],
        flow_config: { stages: [{ type: 'sequential', agents: [1] }] }
      });

      const result = await engine.execute(1, { message: 'test' }, 1);

      expect(result.status).toBe('completed');
    });

    it('should save failed execution on error', async () => {
      mockAgent.execute = jest.fn().mockRejectedValue(new Error('Execution failed'));
      AgentExecutionStep.fail.mockResolvedValue({});

      const result = await engine.execute(1, { message: 'test' }, 1);

      expect(result.status).toBe('failed');
      expect(WorkflowExecution.update).toHaveBeenCalledWith(100, expect.objectContaining({
        status: 'failed'
      }));
    });
  });
});
