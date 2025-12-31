/**
 * AgentOrchestrator Test Suite
 */

const AgentOrchestrator = require('../../services/autonomous/AgentOrchestrator');

// Mock dependencies
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../services/autonomous/AgentCore', () => ({
  findById: jest.fn()
}));

jest.mock('../../services/autonomous/TaskExecutor', () => {
  return jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({ success: true }),
    persistMemory: jest.fn().mockResolvedValue(true)
  }));
});

const db = require('../../db');
const AgentCore = require('../../services/autonomous/AgentCore');

describe('AgentOrchestrator', () => {
  let orchestrator;
  const testUserId = 1;

  beforeEach(() => {
    orchestrator = new AgentOrchestrator(testUserId);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct userId', () => {
      expect(orchestrator.userId).toBe(testUserId);
    });

    it('should initialize empty active workflows map', () => {
      expect(orchestrator.activeWorkflows).toBeInstanceOf(Map);
      expect(orchestrator.activeWorkflows.size).toBe(0);
    });

    it('should initialize empty agent pool', () => {
      expect(orchestrator.agentPool).toBeInstanceOf(Map);
      expect(orchestrator.agentPool.size).toBe(0);
    });
  });

  describe('createWorkflow', () => {
    it('should create a workflow successfully', async () => {
      const workflowData = {
        name: 'Test Workflow',
        description: 'A test workflow',
        agents: [1, 2],
        steps: [{ name: 'Step 1', agentId: 1 }],
        settings: { timeout: 5000 }
      };

      const mockResult = {
        rows: [{
          id: 1,
          user_id: testUserId,
          name: 'Test Workflow',
          description: 'A test workflow',
          agents: JSON.stringify([1, 2]),
          steps: JSON.stringify([{ name: 'Step 1', agentId: 1 }]),
          settings: JSON.stringify({ timeout: 5000 }),
          status: 'pending'
        }]
      };

      db.query.mockResolvedValueOnce(mockResult);

      const workflow = await orchestrator.createWorkflow(workflowData);

      expect(db.query).toHaveBeenCalled();
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.agents).toEqual([1, 2]);
    });

    it('should throw error if name is missing', async () => {
      await expect(orchestrator.createWorkflow({})).rejects.toThrow('Workflow name is required');
    });
  });

  describe('getWorkflow', () => {
    it('should return workflow if found', async () => {
      const mockResult = {
        rows: [{
          id: 1,
          user_id: testUserId,
          name: 'Test Workflow',
          agents: '[]',
          steps: '[]',
          settings: '{}',
          metadata: '{}'
        }]
      };

      db.query.mockResolvedValueOnce(mockResult);

      const workflow = await orchestrator.getWorkflow(1);

      expect(workflow).toBeTruthy();
      expect(workflow.id).toBe(1);
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const workflow = await orchestrator.getWorkflow(999);

      expect(workflow).toBeNull();
    });
  });

  describe('getWorkflows', () => {
    it('should return all workflows for user', async () => {
      const mockResult = {
        rows: [
          { id: 1, name: 'Workflow 1', agents: '[]', steps: '[]', settings: '{}', metadata: '{}' },
          { id: 2, name: 'Workflow 2', agents: '[]', steps: '[]', settings: '{}', metadata: '{}' }
        ]
      };

      db.query.mockResolvedValueOnce(mockResult);

      const workflows = await orchestrator.getWorkflows();

      expect(workflows.length).toBe(2);
    });

    it('should filter by status', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await orchestrator.getWorkflows({ status: 'completed' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.arrayContaining(['completed'])
      );
    });
  });

  describe('deleteWorkflow', () => {
    it('should delete workflow successfully', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await orchestrator.deleteWorkflow(1);

      expect(result).toBe(true);
    });

    it('should throw error if workflow not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(orchestrator.deleteWorkflow(999)).rejects.toThrow('Workflow not found or access denied');
    });
  });

  describe('initializeAgents', () => {
    it('should initialize agents into pool', async () => {
      const mockAgent = { id: 1, name: 'Test Agent' };
      AgentCore.findById.mockResolvedValueOnce(mockAgent);

      await orchestrator.initializeAgents([1]);

      expect(orchestrator.agentPool.has(1)).toBe(true);
      expect(orchestrator.agentPool.get(1).agent).toEqual(mockAgent);
    });

    it('should not add agent if already in pool', async () => {
      orchestrator.agentPool.set(1, { agent: { id: 1 }, status: 'ready' });

      await orchestrator.initializeAgents([1]);

      expect(AgentCore.findById).not.toHaveBeenCalled();
    });
  });

  describe('prepareStepInput', () => {
    it('should replace context variables', () => {
      const step = {
        input: {
          topic: '{{context.topic}}',
          staticValue: 'hello'
        }
      };

      const context = {
        topic: 'AI Research'
      };

      const result = orchestrator.prepareStepInput(step, context);

      expect(result.topic).toBe('AI Research');
      expect(result.staticValue).toBe('hello');
    });

    it('should keep original value if context key not found', () => {
      const step = {
        input: {
          value: '{{missing.key}}'
        }
      };

      const result = orchestrator.prepareStepInput(step, {});

      expect(result.value).toBe('{{missing.key}}');
    });
  });

  describe('sendAgentMessage', () => {
    it('should add message to queue', async () => {
      const msg = await orchestrator.sendAgentMessage(1, 2, 'Hello');

      expect(msg.from).toBe(1);
      expect(msg.to).toBe(2);
      expect(msg.content).toBe('Hello');
      expect(orchestrator.messageQueue.length).toBe(1);
    });
  });

  describe('getAgentMessages', () => {
    it('should return messages for specific agent', async () => {
      await orchestrator.sendAgentMessage(1, 2, 'Message 1');
      await orchestrator.sendAgentMessage(1, 3, 'Message 2');
      await orchestrator.sendAgentMessage(2, 3, 'Message 3');

      const messages = orchestrator.getAgentMessages(3);

      expect(messages.length).toBe(2);
    });
  });

  describe('event handling', () => {
    it('should register and emit events', () => {
      const handler = jest.fn();
      orchestrator.on('test_event', handler);

      orchestrator.emit('test_event', { data: 'test' });

      expect(handler).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should handle multiple handlers for same event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      orchestrator.on('multi_event', handler1);
      orchestrator.on('multi_event', handler2);

      orchestrator.emit('multi_event', { data: 'test' });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('getActiveExecutions', () => {
    it('should return active workflow executions', () => {
      orchestrator.activeWorkflows.set('exec_1', { id: 'exec_1', status: 'running' });
      orchestrator.activeWorkflows.set('exec_2', { id: 'exec_2', status: 'running' });

      const executions = orchestrator.getActiveExecutions();

      expect(executions.length).toBe(2);
    });
  });

  describe('parseWorkflow', () => {
    it('should parse JSON strings in workflow', () => {
      const row = {
        id: 1,
        agents: '[1, 2, 3]',
        steps: '[{"name": "step1"}]',
        settings: '{"timeout": 5000}',
        metadata: '{"key": "value"}'
      };

      const parsed = orchestrator.parseWorkflow(row);

      expect(parsed.agents).toEqual([1, 2, 3]);
      expect(parsed.steps).toEqual([{ name: 'step1' }]);
      expect(parsed.settings).toEqual({ timeout: 5000 });
    });

    it('should handle already parsed objects', () => {
      const row = {
        id: 1,
        agents: [1, 2],
        steps: [],
        settings: {},
        metadata: {}
      };

      const parsed = orchestrator.parseWorkflow(row);

      expect(parsed.agents).toEqual([1, 2]);
    });

    it('should return null for null input', () => {
      expect(orchestrator.parseWorkflow(null)).toBeNull();
    });
  });

  describe('static properties', () => {
    it('should have ROLES constant', () => {
      expect(AgentOrchestrator.ROLES).toBeDefined();
      expect(AgentOrchestrator.ROLES.ORCHESTRATOR).toBe('orchestrator');
    });

    it('should have STATES constant', () => {
      expect(AgentOrchestrator.STATES).toBeDefined();
      expect(AgentOrchestrator.STATES.RUNNING).toBe('running');
    });

    it('should have CONFIG constant', () => {
      expect(AgentOrchestrator.CONFIG).toBeDefined();
      expect(AgentOrchestrator.CONFIG.maxConcurrentAgents).toBeDefined();
    });
  });
});
