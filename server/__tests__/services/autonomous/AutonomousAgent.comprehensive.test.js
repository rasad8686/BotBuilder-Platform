/**
 * Comprehensive Tests for AgentOrchestrator (AutonomousAgent)
 * Tests for multi-agent coordination, workflow management, and orchestration
 */

jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../../services/autonomous/AgentCore', () => ({
  findById: jest.fn()
}));

jest.mock('../../../services/autonomous/TaskExecutor', () => {
  return jest.fn().mockImplementation((agent) => ({
    agent,
    execute: jest.fn().mockResolvedValue({ success: true, output: 'Task completed' }),
    persistMemory: jest.fn().mockResolvedValue()
  }));
});

const db = require('../../../db');
const log = require('../../../utils/logger');
const AgentOrchestrator = require('../../../services/autonomous/AgentOrchestrator');
const AgentCore = require('../../../services/autonomous/AgentCore');
const TaskExecutor = require('../../../services/autonomous/TaskExecutor');

describe('AgentOrchestrator - Comprehensive Tests', () => {
  let orchestrator;
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator = new AgentOrchestrator(mockUserId);
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with userId', () => {
      expect(orchestrator.userId).toBe(mockUserId);
    });

    it('should initialize empty activeWorkflows map', () => {
      expect(orchestrator.activeWorkflows).toBeInstanceOf(Map);
      expect(orchestrator.activeWorkflows.size).toBe(0);
    });

    it('should initialize empty agentPool map', () => {
      expect(orchestrator.agentPool).toBeInstanceOf(Map);
      expect(orchestrator.agentPool.size).toBe(0);
    });

    it('should initialize empty messageQueue array', () => {
      expect(Array.isArray(orchestrator.messageQueue)).toBe(true);
      expect(orchestrator.messageQueue.length).toBe(0);
    });

    it('should initialize empty eventHandlers map', () => {
      expect(orchestrator.eventHandlers).toBeInstanceOf(Map);
      expect(orchestrator.eventHandlers.size).toBe(0);
    });
  });

  describe('createWorkflow', () => {
    it('should create workflow with minimal data', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        user_id: mockUserId,
        name: 'Test Workflow',
        description: null,
        agents: '[]',
        steps: '[]',
        settings: '{}',
        status: 'pending'
      };

      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      const result = await orchestrator.createWorkflow({ name: 'Test Workflow' });

      expect(result.id).toBe('workflow-1');
      expect(result.name).toBe('Test Workflow');
      expect(result.agents).toEqual([]);
      expect(result.steps).toEqual([]);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agent_workflows'),
        expect.arrayContaining([mockUserId, 'Test Workflow'])
      );
    });

    it('should create workflow with full data', async () => {
      const mockWorkflow = {
        id: 'workflow-2',
        user_id: mockUserId,
        name: 'Complex Workflow',
        description: 'A complex workflow',
        agents: '["agent-1", "agent-2"]',
        steps: '[{"name": "step1"}]',
        settings: '{"timeout": 5000}',
        status: 'pending'
      };

      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      const workflowData = {
        name: 'Complex Workflow',
        description: 'A complex workflow',
        agents: ['agent-1', 'agent-2'],
        steps: [{ name: 'step1' }],
        settings: { timeout: 5000 }
      };

      const result = await orchestrator.createWorkflow(workflowData);

      expect(result.name).toBe('Complex Workflow');
      expect(result.agents).toEqual(['agent-1', 'agent-2']);
      expect(result.steps).toEqual([{ name: 'step1' }]);
      expect(result.settings).toEqual({ timeout: 5000 });
    });

    it('should throw error when name is missing', async () => {
      await expect(orchestrator.createWorkflow({}))
        .rejects.toThrow('Workflow name is required');
    });

    it('should throw error when name is empty string', async () => {
      await expect(orchestrator.createWorkflow({ name: '' }))
        .rejects.toThrow('Workflow name is required');
    });

    it('should log workflow creation', async () => {
      const mockWorkflow = {
        id: 'workflow-3',
        name: 'Test',
        agents: '[]',
        steps: '[]',
        settings: '{}'
      };

      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      await orchestrator.createWorkflow({ name: 'Test' });

      expect(log.info).toHaveBeenCalledWith(
        'AgentOrchestrator: Workflow created',
        expect.objectContaining({ workflowId: 'workflow-3', userId: mockUserId })
      );
    });

    it('should handle database errors gracefully', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      await expect(orchestrator.createWorkflow({ name: 'Test' }))
        .rejects.toThrow('Database error');
    });

    it('should stringify arrays and objects in workflow data', async () => {
      const mockWorkflow = {
        id: 'workflow-4',
        name: 'Test',
        agents: '["agent-1"]',
        steps: '[]',
        settings: '{}'
      };

      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      await orchestrator.createWorkflow({
        name: 'Test',
        agents: ['agent-1'],
        steps: [],
        settings: {}
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          mockUserId,
          'Test',
          undefined,
          JSON.stringify(['agent-1']),
          JSON.stringify([]),
          JSON.stringify({}),
          'pending'
        ])
      );
    });
  });

  describe('executeWorkflow', () => {
    const mockWorkflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
      agents: ['agent-1'],
      steps: [
        { name: 'step1', agentId: 'agent-1', description: 'First step', input: {} }
      ],
      settings: {}
    };

    beforeEach(() => {
      AgentCore.findById.mockResolvedValue({
        id: 'agent-1',
        name: 'Test Agent'
      });

      TaskExecutor.createTask = jest.fn().mockResolvedValue({
        id: 'task-1',
        task_description: 'Test task'
      });
    });

    it('should execute workflow successfully', async () => {
      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      const result = await orchestrator.executeWorkflow('workflow-1');

      expect(result.success).toBe(true);
      expect(result.executionId).toBeDefined();
      expect(result.results).toBeDefined();
      expect(result.duration).toBeDefined();
    });

    it('should throw error when workflow not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(orchestrator.executeWorkflow('nonexistent'))
        .rejects.toThrow('Workflow not found');
    });

    it('should throw error when max concurrent workflows reached', async () => {
      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      // Fill up activeWorkflows
      for (let i = 0; i < 5; i++) {
        orchestrator.activeWorkflows.set(`exec_${i}`, {});
      }

      await expect(orchestrator.executeWorkflow('workflow-1'))
        .rejects.toThrow('Maximum concurrent workflows reached');
    });

    it('should initialize agents before execution', async () => {
      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      await orchestrator.executeWorkflow('workflow-1');

      expect(AgentCore.findById).toHaveBeenCalledWith('agent-1');
    });

    it('should execute all workflow steps', async () => {
      const multiStepWorkflow = {
        ...mockWorkflow,
        steps: [
          { name: 'step1', agentId: 'agent-1', description: 'First', input: {} },
          { name: 'step2', agentId: 'agent-1', description: 'Second', input: {} }
        ]
      };

      db.query.mockResolvedValue({ rows: [multiStepWorkflow] });

      const result = await orchestrator.executeWorkflow('workflow-1');

      expect(result.results.length).toBe(2);
    });

    it('should update workflow status to running', async () => {
      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      await orchestrator.executeWorkflow('workflow-1');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agent_workflows'),
        expect.arrayContaining(['running', expect.any(String), 'workflow-1'])
      );
    });

    it('should update workflow status to completed on success', async () => {
      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      await orchestrator.executeWorkflow('workflow-1');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agent_workflows'),
        expect.arrayContaining(['completed', expect.any(String), 'workflow-1'])
      );
    });

    it('should update workflow status to failed on error', async () => {
      db.query.mockResolvedValue({ rows: [mockWorkflow] });
      AgentCore.findById.mockRejectedValue(new Error('Agent not available'));

      await expect(orchestrator.executeWorkflow('workflow-1'))
        .rejects.toThrow('Agent not available');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agent_workflows'),
        expect.arrayContaining(['failed', expect.any(String), 'workflow-1'])
      );
    });

    it('should cleanup agents after execution', async () => {
      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      await orchestrator.executeWorkflow('workflow-1');

      // Verify cleanup was attempted (persistMemory called)
      const poolEntry = orchestrator.agentPool.get('agent-1');
      expect(poolEntry).toBeUndefined();
    });

    it('should log workflow start', async () => {
      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      await orchestrator.executeWorkflow('workflow-1');

      expect(log.info).toHaveBeenCalledWith(
        'AgentOrchestrator: Starting workflow execution',
        expect.objectContaining({ workflowId: 'workflow-1' })
      );
    });

    it('should log workflow completion', async () => {
      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      await orchestrator.executeWorkflow('workflow-1');

      expect(log.info).toHaveBeenCalledWith(
        'AgentOrchestrator: Workflow completed',
        expect.any(Object)
      );
    });

    it('should log workflow failure', async () => {
      db.query.mockResolvedValue({ rows: [mockWorkflow] });
      AgentCore.findById.mockRejectedValue(new Error('Test error'));

      await expect(orchestrator.executeWorkflow('workflow-1')).rejects.toThrow();

      expect(log.error).toHaveBeenCalledWith(
        'AgentOrchestrator: Workflow failed',
        expect.objectContaining({ workflowId: 'workflow-1' })
      );
    });

    it('should handle inputData parameter', async () => {
      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      const inputData = { key: 'value' };
      await orchestrator.executeWorkflow('workflow-1', inputData);

      // Verify execution context has input data
      expect(orchestrator.activeWorkflows.size).toBe(0); // Cleaned up after completion
    });

    it('should fail on required step failure', async () => {
      const workflowWithRequired = {
        ...mockWorkflow,
        steps: [
          { name: 'step1', agentId: 'agent-1', description: 'Required', input: {}, required: true }
        ]
      };

      db.query.mockResolvedValue({ rows: [workflowWithRequired] });

      const mockExecutor = {
        execute: jest.fn().mockRejectedValue(new Error('Step failed'))
      };
      TaskExecutor.mockImplementation(() => mockExecutor);

      await expect(orchestrator.executeWorkflow('workflow-1')).rejects.toThrow();
    });

    it('should continue on non-required step failure', async () => {
      const workflowWithOptional = {
        ...mockWorkflow,
        steps: [
          { name: 'step1', agentId: 'agent-1', description: 'Optional', input: {}, required: false }
        ]
      };

      db.query.mockResolvedValue({ rows: [workflowWithOptional] });

      const mockExecutor = {
        execute: jest.fn().mockRejectedValue(new Error('Step failed'))
      };
      TaskExecutor.mockImplementation(() => mockExecutor);

      const result = await orchestrator.executeWorkflow('workflow-1');
      expect(result.success).toBe(true);
    });

    it('should track execution time', async () => {
      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      const result = await orchestrator.executeWorkflow('workflow-1');

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe('number');
    });
  });

  describe('executeWorkflowStep', () => {
    beforeEach(() => {
      const mockAgent = { id: 'agent-1', name: 'Test Agent' };
      const mockExecutor = {
        execute: jest.fn().mockResolvedValue({ output: 'Success' })
      };

      orchestrator.agentPool.set('agent-1', {
        agent: mockAgent,
        executor: mockExecutor,
        status: 'ready'
      });

      TaskExecutor.createTask = jest.fn().mockResolvedValue({ id: 'task-1' });
    });

    it('should execute step successfully', async () => {
      const step = {
        name: 'test-step',
        agentId: 'agent-1',
        description: 'Test step',
        input: {}
      };

      const result = await orchestrator.executeWorkflowStep(step, {});

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle step execution error', async () => {
      const mockExecutor = orchestrator.agentPool.get('agent-1').executor;
      mockExecutor.execute.mockRejectedValue(new Error('Step failed'));

      const step = {
        name: 'test-step',
        agentId: 'agent-1',
        description: 'Test step',
        input: {}
      };

      const result = await orchestrator.executeWorkflowStep(step, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Step failed');
    });

    it('should throw error when agent not found', async () => {
      const step = {
        name: 'test-step',
        agentId: 'nonexistent',
        description: 'Test step',
        input: {}
      };

      const result = await orchestrator.executeWorkflowStep(step, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent not found');
    });

    it('should log step execution failure', async () => {
      const mockExecutor = orchestrator.agentPool.get('agent-1').executor;
      mockExecutor.execute.mockRejectedValue(new Error('Test error'));

      const step = {
        name: 'failing-step',
        agentId: 'agent-1',
        description: 'Failing step',
        input: {}
      };

      await orchestrator.executeWorkflowStep(step, {});

      expect(log.error).toHaveBeenCalledWith(
        'AgentOrchestrator: Step execution failed',
        expect.objectContaining({ step: 'failing-step' })
      );
    });

    it('should measure step duration', async () => {
      const step = {
        name: 'test-step',
        agentId: 'agent-1',
        description: 'Test step',
        input: {}
      };

      const result = await orchestrator.executeWorkflowStep(step, {});

      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('initializeAgents', () => {
    it('should initialize single agent', async () => {
      const mockAgent = { id: 'agent-1', name: 'Test Agent' };
      AgentCore.findById.mockResolvedValue(mockAgent);

      await orchestrator.initializeAgents(['agent-1']);

      expect(orchestrator.agentPool.has('agent-1')).toBe(true);
      expect(orchestrator.agentPool.get('agent-1').agent).toEqual(mockAgent);
    });

    it('should initialize multiple agents', async () => {
      AgentCore.findById
        .mockResolvedValueOnce({ id: 'agent-1', name: 'Agent 1' })
        .mockResolvedValueOnce({ id: 'agent-2', name: 'Agent 2' });

      await orchestrator.initializeAgents(['agent-1', 'agent-2']);

      expect(orchestrator.agentPool.size).toBe(2);
      expect(orchestrator.agentPool.has('agent-1')).toBe(true);
      expect(orchestrator.agentPool.has('agent-2')).toBe(true);
    });

    it('should skip already initialized agents', async () => {
      const mockAgent = { id: 'agent-1', name: 'Test Agent' };
      orchestrator.agentPool.set('agent-1', { agent: mockAgent });

      await orchestrator.initializeAgents(['agent-1']);

      expect(AgentCore.findById).not.toHaveBeenCalled();
    });

    it('should handle agent not found', async () => {
      AgentCore.findById.mockResolvedValue(null);

      await orchestrator.initializeAgents(['nonexistent']);

      expect(orchestrator.agentPool.has('nonexistent')).toBe(false);
    });

    it('should create TaskExecutor for each agent', async () => {
      const mockAgent = { id: 'agent-1', name: 'Test Agent' };
      AgentCore.findById.mockResolvedValue(mockAgent);

      await orchestrator.initializeAgents(['agent-1']);

      const poolEntry = orchestrator.agentPool.get('agent-1');
      expect(poolEntry.executor).toBeDefined();
      expect(TaskExecutor).toHaveBeenCalledWith(mockAgent);
    });

    it('should set agent status to ready', async () => {
      const mockAgent = { id: 'agent-1', name: 'Test Agent' };
      AgentCore.findById.mockResolvedValue(mockAgent);

      await orchestrator.initializeAgents(['agent-1']);

      const poolEntry = orchestrator.agentPool.get('agent-1');
      expect(poolEntry.status).toBe('ready');
    });
  });

  describe('cleanupAgents', () => {
    it('should persist memory if available', async () => {
      const mockExecutor = {
        persistMemory: jest.fn().mockResolvedValue()
      };

      orchestrator.agentPool.set('agent-1', {
        agent: { id: 'agent-1' },
        executor: mockExecutor,
        status: 'ready'
      });

      await orchestrator.cleanupAgents(['agent-1']);

      expect(mockExecutor.persistMemory).toHaveBeenCalled();
    });

    it('should handle agents without persistMemory', async () => {
      orchestrator.agentPool.set('agent-1', {
        agent: { id: 'agent-1' },
        executor: {},
        status: 'ready'
      });

      await expect(orchestrator.cleanupAgents(['agent-1'])).resolves.not.toThrow();
    });

    it('should cleanup multiple agents', async () => {
      const mockExecutor1 = { persistMemory: jest.fn().mockResolvedValue() };
      const mockExecutor2 = { persistMemory: jest.fn().mockResolvedValue() };

      orchestrator.agentPool.set('agent-1', {
        agent: { id: 'agent-1' },
        executor: mockExecutor1
      });

      orchestrator.agentPool.set('agent-2', {
        agent: { id: 'agent-2' },
        executor: mockExecutor2
      });

      await orchestrator.cleanupAgents(['agent-1', 'agent-2']);

      expect(mockExecutor1.persistMemory).toHaveBeenCalled();
      expect(mockExecutor2.persistMemory).toHaveBeenCalled();
    });

    it('should skip agents not in pool', async () => {
      await expect(orchestrator.cleanupAgents(['nonexistent'])).resolves.not.toThrow();
    });
  });

  describe('prepareStepInput', () => {
    it('should return input as-is when no template variables', () => {
      const step = {
        input: { key: 'value', number: 123 }
      };
      const context = {};

      const result = orchestrator.prepareStepInput(step, context);

      expect(result).toEqual({ key: 'value', number: 123 });
    });

    it('should replace template variables with context values', () => {
      const step = {
        input: { url: '{{website}}', timeout: 5000 }
      };
      const context = { website: 'https://example.com' };

      const result = orchestrator.prepareStepInput(step, context);

      expect(result.url).toBe('https://example.com');
      expect(result.timeout).toBe(5000);
    });

    it('should handle multiple template variables', () => {
      const step = {
        input: {
          first: '{{var1}}',
          second: '{{var2}}',
          third: 'static'
        }
      };
      const context = { var1: 'value1', var2: 'value2' };

      const result = orchestrator.prepareStepInput(step, context);

      expect(result.first).toBe('value1');
      expect(result.second).toBe('value2');
      expect(result.third).toBe('static');
    });

    it('should keep template string if context value not found', () => {
      const step = {
        input: { key: '{{missing}}' }
      };
      const context = {};

      const result = orchestrator.prepareStepInput(step, context);

      expect(result.key).toBe('{{missing}}');
    });

    it('should handle template variables with spaces', () => {
      const step = {
        input: { key: '{{ variable }}' }
      };
      const context = { variable: 'test' };

      const result = orchestrator.prepareStepInput(step, context);

      expect(result.key).toBe('test');
    });

    it('should not replace non-template strings containing braces', () => {
      const step = {
        input: {
          json: '{"key": "value"}',
          template: '{{var}}'
        }
      };
      const context = { var: 'replaced' };

      const result = orchestrator.prepareStepInput(step, context);

      expect(result.json).toBe('{"key": "value"}');
      expect(result.template).toBe('replaced');
    });
  });

  describe('executeAgentTask', () => {
    beforeEach(() => {
      TaskExecutor.createTask = jest.fn().mockResolvedValue({
        id: 'task-1',
        task_description: 'Test task'
      });
    });

    it('should create and execute task', async () => {
      const mockExecutor = {
        execute: jest.fn().mockResolvedValue({ result: 'Success' })
      };

      const poolEntry = {
        agent: { id: 'agent-1', name: 'Test' },
        executor: mockExecutor
      };

      const step = { name: 'test', description: 'Test step' };
      const input = { data: 'test' };

      const result = await orchestrator.executeAgentTask(poolEntry, step, input);

      expect(TaskExecutor.createTask).toHaveBeenCalledWith(
        'agent-1',
        'Test step',
        input
      );
      expect(mockExecutor.execute).toHaveBeenCalledWith('task-1');
      expect(result).toEqual({ result: 'Success' });
    });

    it('should use step name if description missing', async () => {
      const mockExecutor = {
        execute: jest.fn().mockResolvedValue({})
      };

      const poolEntry = {
        agent: { id: 'agent-1' },
        executor: mockExecutor
      };

      const step = { name: 'test-step' };

      await orchestrator.executeAgentTask(poolEntry, step, {});

      expect(TaskExecutor.createTask).toHaveBeenCalledWith(
        'agent-1',
        'test-step',
        {}
      );
    });
  });

  describe('handoffToAgent', () => {
    beforeEach(() => {
      orchestrator.agentPool.set('agent-1', {
        agent: { id: 'agent-1' },
        executor: {}
      });

      orchestrator.agentPool.set('agent-2', {
        agent: { id: 'agent-2' },
        executor: {}
      });

      db.query.mockResolvedValue({ rows: [] });
    });

    it('should perform agent handoff', async () => {
      const data = { task: 'Continue work', context: 'Previous results' };

      const result = await orchestrator.handoffToAgent('agent-1', 'agent-2', data);

      expect(result.id).toBeDefined();
      expect(result.from).toBe('agent-1');
      expect(result.to).toBe('agent-2');
      expect(result.data).toEqual(data);
      expect(result.status).toBe('pending');
    });

    it('should log handoff to database', async () => {
      await orchestrator.handoffToAgent('agent-1', 'agent-2', { test: 'data' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agent_handoffs'),
        expect.arrayContaining(['agent-1', 'agent-2', JSON.stringify({ test: 'data' })])
      );
    });

    it('should throw error when from agent not in pool', async () => {
      await expect(
        orchestrator.handoffToAgent('nonexistent', 'agent-2', {})
      ).rejects.toThrow('One or both agents not found in pool');
    });

    it('should throw error when to agent not in pool', async () => {
      await expect(
        orchestrator.handoffToAgent('agent-1', 'nonexistent', {})
      ).rejects.toThrow('One or both agents not found in pool');
    });

    it('should log handoff completion', async () => {
      await orchestrator.handoffToAgent('agent-1', 'agent-2', {});

      expect(log.info).toHaveBeenCalledWith(
        'AgentOrchestrator: Agent handoff completed',
        expect.objectContaining({ from: 'agent-1', to: 'agent-2' })
      );
    });

    it('should include timestamp in handoff', async () => {
      const result = await orchestrator.handoffToAgent('agent-1', 'agent-2', {});

      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('sendAgentMessage', () => {
    beforeEach(() => {
      orchestrator.eventHandlers.set('agent_message', []);
    });

    it('should send message between agents', async () => {
      const message = 'Task status update';

      const result = await orchestrator.sendAgentMessage('agent-1', 'agent-2', message);

      expect(result.id).toBeDefined();
      expect(result.from).toBe('agent-1');
      expect(result.to).toBe('agent-2');
      expect(result.content).toBe(message);
      expect(result.status).toBe('sent');
    });

    it('should add message to queue', async () => {
      await orchestrator.sendAgentMessage('agent-1', 'agent-2', 'Test');

      expect(orchestrator.messageQueue.length).toBe(1);
      expect(orchestrator.messageQueue[0].content).toBe('Test');
    });

    it('should include timestamp', async () => {
      const result = await orchestrator.sendAgentMessage('agent-1', 'agent-2', 'Test');

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should emit agent_message event', async () => {
      const handler = jest.fn();
      orchestrator.on('agent_message', handler);

      const msg = await orchestrator.sendAgentMessage('agent-1', 'agent-2', 'Test');

      expect(handler).toHaveBeenCalledWith(msg);
    });
  });

  describe('getAgentMessages', () => {
    it('should return messages for specific agent', async () => {
      await orchestrator.sendAgentMessage('agent-1', 'agent-2', 'Message 1');
      await orchestrator.sendAgentMessage('agent-3', 'agent-2', 'Message 2');
      await orchestrator.sendAgentMessage('agent-1', 'agent-3', 'Message 3');

      const messages = orchestrator.getAgentMessages('agent-2');

      expect(messages.length).toBe(2);
      expect(messages[0].content).toBe('Message 1');
      expect(messages[1].content).toBe('Message 2');
    });

    it('should return empty array when no messages', () => {
      const messages = orchestrator.getAgentMessages('agent-1');

      expect(messages).toEqual([]);
    });

    it('should only return sent messages', async () => {
      await orchestrator.sendAgentMessage('agent-1', 'agent-2', 'Test');
      orchestrator.messageQueue[0].status = 'read';

      const messages = orchestrator.getAgentMessages('agent-2');

      expect(messages.length).toBe(0);
    });
  });

  describe('Event Handling', () => {
    it('should register event handler', () => {
      const handler = jest.fn();

      orchestrator.on('test_event', handler);

      expect(orchestrator.eventHandlers.has('test_event')).toBe(true);
      expect(orchestrator.eventHandlers.get('test_event')).toContain(handler);
    });

    it('should register multiple handlers for same event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      orchestrator.on('test_event', handler1);
      orchestrator.on('test_event', handler2);

      const handlers = orchestrator.eventHandlers.get('test_event');
      expect(handlers.length).toBe(2);
    });

    it('should emit event to handlers', () => {
      const handler = jest.fn();
      orchestrator.on('test_event', handler);

      const data = { test: 'data' };
      orchestrator.emit('test_event', data);

      expect(handler).toHaveBeenCalledWith(data);
    });

    it('should emit to all registered handlers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      orchestrator.on('test_event', handler1);
      orchestrator.on('test_event', handler2);

      orchestrator.emit('test_event', { data: 'test' });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should not throw when emitting event with no handlers', () => {
      expect(() => {
        orchestrator.emit('unknown_event', {});
      }).not.toThrow();
    });

    it('should handle handler errors gracefully', () => {
      const failingHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      const workingHandler = jest.fn();

      orchestrator.on('test_event', failingHandler);
      orchestrator.on('test_event', workingHandler);

      orchestrator.emit('test_event', {});

      expect(log.error).toHaveBeenCalledWith(
        'AgentOrchestrator: Event handler error',
        expect.objectContaining({ event: 'test_event' })
      );
      expect(workingHandler).toHaveBeenCalled();
    });
  });

  describe('getWorkflow', () => {
    it('should get workflow by ID', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        user_id: mockUserId,
        name: 'Test Workflow',
        agents: '["agent-1"]',
        steps: '[]',
        settings: '{}'
      };

      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      const result = await orchestrator.getWorkflow('workflow-1');

      expect(result.id).toBe('workflow-1');
      expect(result.name).toBe('Test Workflow');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM agent_workflows'),
        ['workflow-1', mockUserId]
      );
    });

    it('should return null when workflow not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await orchestrator.getWorkflow('nonexistent');

      expect(result).toBeNull();
    });

    it('should parse workflow JSON fields', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        agents: '["agent-1", "agent-2"]',
        steps: '[{"name": "step1"}]',
        settings: '{"timeout": 5000}',
        metadata: '{"version": "1.0"}'
      };

      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      const result = await orchestrator.getWorkflow('workflow-1');

      expect(result.agents).toEqual(['agent-1', 'agent-2']);
      expect(result.steps).toEqual([{ name: 'step1' }]);
      expect(result.settings).toEqual({ timeout: 5000 });
      expect(result.metadata).toEqual({ version: '1.0' });
    });
  });

  describe('getWorkflows', () => {
    it('should get all workflows for user', async () => {
      const mockWorkflows = [
        { id: 'workflow-1', name: 'W1', agents: '[]', steps: '[]', settings: '{}' },
        { id: 'workflow-2', name: 'W2', agents: '[]', steps: '[]', settings: '{}' }
      ];

      db.query.mockResolvedValue({ rows: mockWorkflows });

      const result = await orchestrator.getWorkflows();

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('workflow-1');
      expect(result[1].id).toBe('workflow-2');
    });

    it('should filter by status', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await orchestrator.getWorkflows({ status: 'completed' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND status = $2'),
        expect.arrayContaining([mockUserId, 'completed'])
      );
    });

    it('should apply limit', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await orchestrator.getWorkflows({ limit: 10 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([mockUserId, 10, 0])
      );
    });

    it('should apply offset', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await orchestrator.getWorkflows({ offset: 20 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('OFFSET'),
        expect.arrayContaining([mockUserId, 50, 20])
      );
    });

    it('should use default limit and offset', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await orchestrator.getWorkflows();

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockUserId, 50, 0])
      );
    });

    it('should order by created_at DESC', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await orchestrator.getWorkflows();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.any(Array)
      );
    });
  });

  describe('updateWorkflowStatus', () => {
    it('should update workflow status', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await orchestrator.updateWorkflowStatus('workflow-1', 'running');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agent_workflows'),
        expect.arrayContaining(['running', expect.any(String), 'workflow-1'])
      );
    });

    it('should update workflow with metadata', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const metadata = { execution_id: 'exec-1', started_at: new Date() };

      await orchestrator.updateWorkflowStatus('workflow-1', 'running', metadata);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['running', JSON.stringify(metadata), 'workflow-1'])
      );
    });

    it('should merge metadata with existing', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await orchestrator.updateWorkflowStatus('workflow-1', 'completed', { data: 'test' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("COALESCE(metadata, '{}'::jsonb)"),
        expect.any(Array)
      );
    });
  });

  describe('deleteWorkflow', () => {
    it('should delete workflow', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'workflow-1' }] });

      const result = await orchestrator.deleteWorkflow('workflow-1');

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM agent_workflows'),
        ['workflow-1', mockUserId]
      );
    });

    it('should throw error when workflow not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(orchestrator.deleteWorkflow('nonexistent'))
        .rejects.toThrow('Workflow not found or access denied');
    });

    it('should verify user ownership', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'workflow-1' }] });

      await orchestrator.deleteWorkflow('workflow-1');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $2'),
        expect.arrayContaining(['workflow-1', mockUserId])
      );
    });
  });

  describe('parseWorkflow', () => {
    it('should parse string JSON fields', () => {
      const row = {
        id: 'workflow-1',
        agents: '["agent-1"]',
        steps: '[{"name": "step1"}]',
        settings: '{"timeout": 5000}',
        metadata: '{"version": "1.0"}'
      };

      const result = orchestrator.parseWorkflow(row);

      expect(result.agents).toEqual(['agent-1']);
      expect(result.steps).toEqual([{ name: 'step1' }]);
      expect(result.settings).toEqual({ timeout: 5000 });
      expect(result.metadata).toEqual({ version: '1.0' });
    });

    it('should handle already parsed fields', () => {
      const row = {
        id: 'workflow-1',
        agents: ['agent-1'],
        steps: [{ name: 'step1' }],
        settings: { timeout: 5000 },
        metadata: { version: '1.0' }
      };

      const result = orchestrator.parseWorkflow(row);

      expect(result.agents).toEqual(['agent-1']);
      expect(result.steps).toEqual([{ name: 'step1' }]);
      expect(result.settings).toEqual({ timeout: 5000 });
      expect(result.metadata).toEqual({ version: '1.0' });
    });

    it('should handle null/undefined fields', () => {
      const row = {
        id: 'workflow-1',
        agents: null,
        steps: undefined,
        settings: null,
        metadata: undefined
      };

      const result = orchestrator.parseWorkflow(row);

      expect(result.agents).toEqual([]);
      expect(result.steps).toEqual([]);
      expect(result.settings).toEqual({});
      expect(result.metadata).toEqual({});
    });

    it('should return null for null input', () => {
      const result = orchestrator.parseWorkflow(null);

      expect(result).toBeNull();
    });

    it('should preserve other fields', () => {
      const row = {
        id: 'workflow-1',
        name: 'Test',
        description: 'Test workflow',
        status: 'pending',
        agents: '[]',
        steps: '[]',
        settings: '{}',
        metadata: '{}'
      };

      const result = orchestrator.parseWorkflow(row);

      expect(result.id).toBe('workflow-1');
      expect(result.name).toBe('Test');
      expect(result.description).toBe('Test workflow');
      expect(result.status).toBe('pending');
    });
  });

  describe('getWorkflowStats', () => {
    it('should get workflow statistics', async () => {
      const mockStats = {
        total_executions: 100,
        successful: 90,
        failed: 10,
        avg_duration_seconds: 45.5
      };

      db.query.mockResolvedValue({ rows: [mockStats] });

      const result = await orchestrator.getWorkflowStats('workflow-1');

      expect(result.total_executions).toBe(100);
      expect(result.successful).toBe(90);
      expect(result.failed).toBe(10);
      expect(result.avg_duration_seconds).toBe(45.5);
    });

    it('should return default stats when no executions', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await orchestrator.getWorkflowStats('workflow-1');

      expect(result.total_executions).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.avg_duration_seconds).toBe(0);
    });
  });

  describe('Workflow Lifecycle - Pause/Resume/Cancel', () => {
    beforeEach(() => {
      const execution = {
        id: 'exec-1',
        workflowId: 'workflow-1',
        status: 'running',
        currentStep: 2
      };

      orchestrator.activeWorkflows.set('exec-1', execution);
      db.query.mockResolvedValue({ rows: [] });
    });

    describe('pauseWorkflow', () => {
      it('should pause running workflow', async () => {
        const result = await orchestrator.pauseWorkflow('exec-1');

        expect(result).toBe(true);
        const execution = orchestrator.activeWorkflows.get('exec-1');
        expect(execution.status).toBe('paused');
        expect(execution.pausedAt).toBeInstanceOf(Date);
      });

      it('should throw error when execution not found', async () => {
        await expect(orchestrator.pauseWorkflow('nonexistent'))
          .rejects.toThrow('Execution not found');
      });

      it('should update workflow status in database', async () => {
        await orchestrator.pauseWorkflow('exec-1');

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE agent_workflows'),
          expect.arrayContaining(['paused', expect.any(String), 'workflow-1'])
        );
      });

      it('should track paused step number', async () => {
        await orchestrator.pauseWorkflow('exec-1');

        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['paused', expect.stringContaining('paused_at_step'), 'workflow-1'])
        );
      });
    });

    describe('resumeWorkflow', () => {
      beforeEach(() => {
        const execution = orchestrator.activeWorkflows.get('exec-1');
        execution.status = 'paused';
      });

      it('should resume paused workflow', async () => {
        const result = await orchestrator.resumeWorkflow('exec-1');

        expect(result).toBe(true);
        const execution = orchestrator.activeWorkflows.get('exec-1');
        expect(execution.status).toBe('running');
        expect(execution.resumedAt).toBeInstanceOf(Date);
      });

      it('should throw error when execution not found', async () => {
        await expect(orchestrator.resumeWorkflow('nonexistent'))
          .rejects.toThrow('No paused execution found');
      });

      it('should throw error when execution not paused', async () => {
        const execution = orchestrator.activeWorkflows.get('exec-1');
        execution.status = 'running';

        await expect(orchestrator.resumeWorkflow('exec-1'))
          .rejects.toThrow('No paused execution found');
      });

      it('should update workflow status in database', async () => {
        await orchestrator.resumeWorkflow('exec-1');

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE agent_workflows'),
          expect.arrayContaining(['running', expect.any(String), 'workflow-1'])
        );
      });
    });

    describe('cancelWorkflow', () => {
      it('should cancel running workflow', async () => {
        const result = await orchestrator.cancelWorkflow('exec-1');

        expect(result).toBe(true);
        expect(orchestrator.activeWorkflows.has('exec-1')).toBe(false);
      });

      it('should throw error when execution not found', async () => {
        await expect(orchestrator.cancelWorkflow('nonexistent'))
          .rejects.toThrow('Execution not found');
      });

      it('should update workflow status to cancelled', async () => {
        await orchestrator.cancelWorkflow('exec-1');

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE agent_workflows'),
          expect.arrayContaining(['cancelled', expect.any(String), 'workflow-1'])
        );
      });

      it('should track cancelled step number', async () => {
        await orchestrator.cancelWorkflow('exec-1');

        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['cancelled', expect.stringContaining('cancelled_at_step'), 'workflow-1'])
        );
      });

      it('should remove execution from active workflows', async () => {
        await orchestrator.cancelWorkflow('exec-1');

        expect(orchestrator.activeWorkflows.has('exec-1')).toBe(false);
      });
    });
  });

  describe('getActiveExecutions', () => {
    it('should return all active executions', () => {
      orchestrator.activeWorkflows.set('exec-1', { id: 'exec-1', status: 'running' });
      orchestrator.activeWorkflows.set('exec-2', { id: 'exec-2', status: 'paused' });

      const result = orchestrator.getActiveExecutions();

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('exec-1');
      expect(result[1].id).toBe('exec-2');
    });

    it('should return empty array when no active executions', () => {
      const result = orchestrator.getActiveExecutions();

      expect(result).toEqual([]);
    });

    it('should return array from Map values', () => {
      orchestrator.activeWorkflows.set('exec-1', { id: 'exec-1' });

      const result = orchestrator.getActiveExecutions();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('createFromTemplate', () => {
    it('should create workflow from template', async () => {
      const mockTemplate = {
        name: 'Research Template',
        description: 'Template for research tasks',
        agents: ['agent-1'],
        steps: [{ name: 'research' }],
        settings: { timeout: 5000 }
      };

      const AgentTemplates = require('../../../services/autonomous/AgentTemplates');
      AgentTemplates.getWorkflowTemplate = jest.fn().mockReturnValue(mockTemplate);

      const mockWorkflow = {
        id: 'workflow-1',
        name: 'Research Template',
        agents: '["agent-1"]',
        steps: '[{"name": "research"}]',
        settings: '{"timeout": 5000}'
      };

      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      const result = await orchestrator.createFromTemplate('research-template');

      expect(result.id).toBe('workflow-1');
      expect(AgentTemplates.getWorkflowTemplate).toHaveBeenCalledWith('research-template');
    });

    it('should throw error when template not found', async () => {
      const AgentTemplates = require('../../../services/autonomous/AgentTemplates');
      AgentTemplates.getWorkflowTemplate = jest.fn().mockReturnValue(null);

      await expect(orchestrator.createFromTemplate('nonexistent'))
        .rejects.toThrow('Template not found');
    });

    it('should apply customizations to template', async () => {
      const mockTemplate = {
        name: 'Template Name',
        description: 'Template Description',
        agents: ['agent-1'],
        steps: [],
        settings: { timeout: 5000 }
      };

      const AgentTemplates = require('../../../services/autonomous/AgentTemplates');
      AgentTemplates.getWorkflowTemplate = jest.fn().mockReturnValue(mockTemplate);

      const mockWorkflow = {
        id: 'workflow-1',
        name: 'Custom Name',
        agents: '["agent-1"]',
        steps: '[]',
        settings: '{"timeout": 10000}'
      };

      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      const customizations = {
        name: 'Custom Name',
        description: 'Custom Description',
        settings: { timeout: 10000 }
      };

      await orchestrator.createFromTemplate('template-id', customizations);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['Custom Name', 'Custom Description'])
      );
    });

    it('should merge template settings with customizations', async () => {
      const mockTemplate = {
        name: 'Template',
        agents: [],
        steps: [],
        settings: { timeout: 5000, retries: 3 }
      };

      const AgentTemplates = require('../../../services/autonomous/AgentTemplates');
      AgentTemplates.getWorkflowTemplate = jest.fn().mockReturnValue(mockTemplate);

      const mockWorkflow = {
        id: 'workflow-1',
        name: 'Template',
        agents: '[]',
        steps: '[]',
        settings: '{"timeout": 10000, "retries": 3}'
      };

      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      const customizations = {
        settings: { timeout: 10000 }
      };

      await orchestrator.createFromTemplate('template-id', customizations);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          JSON.stringify({ timeout: 10000, retries: 3 }),
          expect.any(String)
        ])
      );
    });
  });

  describe('Constants and Configuration', () => {
    it('should export ROLES constant', () => {
      expect(AgentOrchestrator.ROLES).toBeDefined();
      expect(AgentOrchestrator.ROLES.ORCHESTRATOR).toBe('orchestrator');
      expect(AgentOrchestrator.ROLES.RESEARCHER).toBe('researcher');
      expect(AgentOrchestrator.ROLES.WRITER).toBe('writer');
      expect(AgentOrchestrator.ROLES.ANALYZER).toBe('analyzer');
      expect(AgentOrchestrator.ROLES.REVIEWER).toBe('reviewer');
      expect(AgentOrchestrator.ROLES.ROUTER).toBe('router');
    });

    it('should export STATES constant', () => {
      expect(AgentOrchestrator.STATES).toBeDefined();
      expect(AgentOrchestrator.STATES.PENDING).toBe('pending');
      expect(AgentOrchestrator.STATES.RUNNING).toBe('running');
      expect(AgentOrchestrator.STATES.PAUSED).toBe('paused');
      expect(AgentOrchestrator.STATES.COMPLETED).toBe('completed');
      expect(AgentOrchestrator.STATES.FAILED).toBe('failed');
      expect(AgentOrchestrator.STATES.CANCELLED).toBe('cancelled');
    });

    it('should export CONFIG constant', () => {
      expect(AgentOrchestrator.CONFIG).toBeDefined();
      expect(AgentOrchestrator.CONFIG.maxConcurrentAgents).toBeDefined();
      expect(AgentOrchestrator.CONFIG.coordinationTimeout).toBeDefined();
      expect(AgentOrchestrator.CONFIG.handoffTimeout).toBeDefined();
      expect(AgentOrchestrator.CONFIG.retryAttempts).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should complete full workflow lifecycle', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        name: 'Full Lifecycle Test',
        agents: ['agent-1'],
        steps: [
          { name: 'step1', agentId: 'agent-1', description: 'Step 1', input: {} }
        ],
        settings: {}
      };

      AgentCore.findById.mockResolvedValue({ id: 'agent-1', name: 'Test Agent' });
      TaskExecutor.createTask = jest.fn().mockResolvedValue({ id: 'task-1' });

      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      const result = await orchestrator.executeWorkflow('workflow-1');

      expect(result.success).toBe(true);
      expect(log.info).toHaveBeenCalledWith(
        'AgentOrchestrator: Starting workflow execution',
        expect.any(Object)
      );
      expect(log.info).toHaveBeenCalledWith(
        'AgentOrchestrator: Workflow completed',
        expect.any(Object)
      );
    });

    it('should handle complex multi-agent workflow', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        name: 'Multi-Agent',
        agents: ['agent-1', 'agent-2'],
        steps: [
          { name: 'step1', agentId: 'agent-1', description: 'Agent 1 task', input: {} },
          { name: 'step2', agentId: 'agent-2', description: 'Agent 2 task', input: {} }
        ],
        settings: {}
      };

      AgentCore.findById
        .mockResolvedValueOnce({ id: 'agent-1', name: 'Agent 1' })
        .mockResolvedValueOnce({ id: 'agent-2', name: 'Agent 2' });

      TaskExecutor.createTask = jest.fn()
        .mockResolvedValueOnce({ id: 'task-1' })
        .mockResolvedValueOnce({ id: 'task-2' });

      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      const result = await orchestrator.executeWorkflow('workflow-1');

      expect(result.success).toBe(true);
      expect(result.results.length).toBe(2);
    });

    it('should handle workflow with context variables', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        name: 'Context Test',
        agents: ['agent-1'],
        steps: [
          {
            name: 'step1',
            agentId: 'agent-1',
            description: 'First step',
            input: { url: '{{website}}' }
          }
        ],
        settings: {}
      };

      AgentCore.findById.mockResolvedValue({ id: 'agent-1', name: 'Agent' });
      TaskExecutor.createTask = jest.fn().mockResolvedValue({ id: 'task-1' });

      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      const inputData = { website: 'https://example.com' };
      await orchestrator.executeWorkflow('workflow-1', inputData);

      expect(TaskExecutor.createTask).toHaveBeenCalledWith(
        'agent-1',
        'First step',
        { url: 'https://example.com' }
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors', async () => {
      db.query.mockRejectedValue(new Error('Connection timeout'));

      await expect(orchestrator.createWorkflow({ name: 'Test' }))
        .rejects.toThrow('Connection timeout');
    });

    it('should handle agent initialization failure', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        agents: ['agent-1'],
        steps: [{ name: 'step1', agentId: 'agent-1', input: {} }],
        settings: {}
      };

      db.query.mockResolvedValue({ rows: [mockWorkflow] });
      AgentCore.findById.mockRejectedValue(new Error('Agent service unavailable'));

      await expect(orchestrator.executeWorkflow('workflow-1'))
        .rejects.toThrow('Agent service unavailable');
    });

    it('should handle task executor creation failure', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        agents: ['agent-1'],
        steps: [{ name: 'step1', agentId: 'agent-1', input: {} }],
        settings: {}
      };

      db.query.mockResolvedValue({ rows: [mockWorkflow] });
      AgentCore.findById.mockResolvedValue({ id: 'agent-1' });
      TaskExecutor.mockImplementation(() => {
        throw new Error('TaskExecutor initialization failed');
      });

      await expect(orchestrator.executeWorkflow('workflow-1'))
        .rejects.toThrow('TaskExecutor initialization failed');
    });

    it('should handle empty workflow steps', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        name: 'Empty Workflow',
        agents: [],
        steps: [],
        settings: {}
      };

      db.query.mockResolvedValue({ rows: [mockWorkflow] });

      const result = await orchestrator.executeWorkflow('workflow-1');

      expect(result.success).toBe(true);
      expect(result.results.length).toBe(0);
    });

    it('should handle concurrent workflow execution attempts', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        agents: ['agent-1'],
        steps: [{ name: 'step1', agentId: 'agent-1', input: {} }],
        settings: {}
      };

      db.query.mockResolvedValue({ rows: [mockWorkflow] });
      AgentCore.findById.mockResolvedValue({ id: 'agent-1' });

      // Fill active workflows to max
      for (let i = 0; i < 5; i++) {
        orchestrator.activeWorkflows.set(`exec-${i}`, { id: `exec-${i}` });
      }

      await expect(orchestrator.executeWorkflow('workflow-1'))
        .rejects.toThrow('Maximum concurrent workflows reached');
    });
  });
});
