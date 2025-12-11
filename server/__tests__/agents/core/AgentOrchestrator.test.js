/**
 * AgentOrchestrator Tests
 * Tests for server/agents/core/AgentOrchestrator.js
 */

jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

// Mock Agent class
jest.mock('../../../agents/core/Agent', () => {
  return jest.fn().mockImplementation((config) => ({
    id: config.id,
    name: config.name,
    role: config.role || 'assistant',
    loadedTools: [],
    loadTools: jest.fn().mockResolvedValue([]),
    execute: jest.fn().mockResolvedValue({
      success: true,
      output: { type: 'text', data: 'Result' }
    })
  }));
});

const AgentOrchestrator = require('../../../agents/core/AgentOrchestrator');

describe('AgentOrchestrator', () => {
  let orchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator = new AgentOrchestrator();
  });

  describe('constructor', () => {
    it('should initialize with registry and executor', () => {
      expect(orchestrator.registry).toBeDefined();
      expect(orchestrator.executor).toBeDefined();
      expect(orchestrator.workflows).toBeInstanceOf(Map);
    });
  });

  describe('loadAgents', () => {
    it('should load multiple agents', () => {
      const configs = [
        { id: 'agent_1', name: 'Agent 1' },
        { id: 'agent_2', name: 'Agent 2' }
      ];

      const agents = orchestrator.loadAgents(configs);

      expect(agents).toHaveLength(2);
      expect(orchestrator.registry.get('agent_1')).toBeDefined();
      expect(orchestrator.registry.get('agent_2')).toBeDefined();
    });
  });

  describe('loadAgent', () => {
    it('should load a single agent', () => {
      const agent = orchestrator.loadAgent({ id: 'single', name: 'Single Agent' });

      expect(agent).toBeDefined();
      expect(orchestrator.registry.get('single')).toBe(agent);
    });
  });

  describe('registerWorkflow', () => {
    it('should register a workflow', () => {
      const workflow = { id: 'wf_1', name: 'Test Workflow' };

      orchestrator.registerWorkflow(workflow);

      expect(orchestrator.workflows.get('wf_1')).toBe(workflow);
    });
  });

  describe('executeWorkflow', () => {
    beforeEach(() => {
      orchestrator.loadAgents([
        { id: 'agent_1', name: 'Agent 1' },
        { id: 'agent_2', name: 'Agent 2' }
      ]);
    });

    it('should execute sequential workflow', async () => {
      const workflow = {
        id: 'wf_seq',
        name: 'Sequential Workflow',
        workflowType: 'sequential',
        agentsConfig: [
          { agentId: 'agent_1' },
          { agentId: 'agent_2' }
        ]
      };

      const result = await orchestrator.executeWorkflow(workflow, 'input');

      expect(result.executionId).toBeDefined();
      expect(result.workflowId).toBe('wf_seq');
      expect(result.status).toBe('completed');
    });

    it('should execute parallel workflow', async () => {
      const workflow = {
        id: 'wf_par',
        name: 'Parallel Workflow',
        workflowType: 'parallel',
        agentsConfig: [
          { agentId: 'agent_1' },
          { agentId: 'agent_2' }
        ]
      };

      const result = await orchestrator.executeWorkflow(workflow, 'input');

      expect(result.status).toBe('completed');
    });

    it('should execute DAG workflow', async () => {
      const workflow = {
        id: 'wf_dag',
        name: 'DAG Workflow',
        workflowType: 'dag',
        agentsConfig: [
          { agentId: 'agent_1' },
          { agentId: 'agent_2', dependsOn: ['agent_1'] }
        ]
      };

      const result = await orchestrator.executeWorkflow(workflow, 'input');

      expect(result.status).toBe('completed');
    });

    it('should default to sequential for unknown type', async () => {
      const workflow = {
        id: 'wf_unknown',
        name: 'Unknown Workflow',
        workflowType: 'unknown_type',
        agentsConfig: [{ agentId: 'agent_1' }]
      };

      const result = await orchestrator.executeWorkflow(workflow, 'input');

      expect(result.status).toBe('completed');
    });

    it('should handle execution errors', async () => {
      orchestrator.executor.executeSequential = jest.fn().mockRejectedValue(
        new Error('Execution failed')
      );

      const workflow = {
        id: 'wf_err',
        name: 'Error Workflow',
        workflowType: 'sequential',
        agentsConfig: [{ agentId: 'agent_1' }]
      };

      const result = await orchestrator.executeWorkflow(workflow, 'input');

      expect(result.status).toBe('error');
      expect(result.error).toBe('Execution failed');
    });

    it('should include total duration', async () => {
      const workflow = {
        id: 'wf_dur',
        name: 'Duration Test',
        workflowType: 'sequential',
        agentsConfig: [{ agentId: 'agent_1' }]
      };

      const result = await orchestrator.executeWorkflow(workflow, 'input');

      expect(result.totalDuration).toBeDefined();
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('executeConditionalWorkflow', () => {
    beforeEach(() => {
      const mockAgent1 = {
        id: 'entry',
        name: 'Entry Agent',
        loadedTools: [],
        loadTools: jest.fn().mockResolvedValue([]),
        execute: jest.fn().mockResolvedValue({
          success: true,
          output: { type: 'decision', category: 'A' }
        })
      };

      const mockAgent2 = {
        id: 'handler_a',
        name: 'Handler A',
        loadedTools: [],
        loadTools: jest.fn().mockResolvedValue([]),
        execute: jest.fn().mockResolvedValue({
          success: true,
          output: { result: 'Handled by A' }
        })
      };

      orchestrator.registry.register(mockAgent1);
      orchestrator.registry.register(mockAgent2);
    });

    it('should execute conditional workflow', async () => {
      const workflow = {
        id: 'wf_cond',
        name: 'Conditional Workflow',
        workflowType: 'conditional',
        entryAgentId: 'entry',
        flowConfig: {
          routes: [
            {
              condition: { type: 'equals', field: 'category', value: 'A' },
              targetAgentId: 'handler_a'
            }
          ]
        }
      };

      const result = await orchestrator.executeWorkflow(workflow, 'input');

      expect(result.status).toBe('completed');
    });

    it('should throw if entry agent not found', async () => {
      const workflow = {
        id: 'wf_missing',
        name: 'Missing Entry',
        workflowType: 'conditional',
        entryAgentId: 'nonexistent'
      };

      const result = await orchestrator.executeWorkflow(workflow, 'input');

      expect(result.status).toBe('error');
      expect(result.error).toContain('Entry agent not found');
    });
  });

  describe('getWorkflowAgents', () => {
    it('should return agents for workflow', () => {
      orchestrator.loadAgents([
        { id: 'a1', name: 'A1' },
        { id: 'a2', name: 'A2' }
      ]);

      const workflow = {
        agentsConfig: [
          { agentId: 'a1' },
          { agentId: 'a2' }
        ]
      };

      const agents = orchestrator.getWorkflowAgents(workflow);

      expect(agents).toHaveLength(2);
    });

    it('should handle alternative id field', () => {
      orchestrator.loadAgents([{ id: 'alt', name: 'Alt Agent' }]);

      const workflow = {
        agentsConfig: [{ id: 'alt' }]
      };

      const agents = orchestrator.getWorkflowAgents(workflow);

      expect(agents).toHaveLength(1);
    });

    it('should skip missing agents', () => {
      const workflow = {
        agentsConfig: [{ agentId: 'missing' }]
      };

      const agents = orchestrator.getWorkflowAgents(workflow);

      expect(agents).toHaveLength(0);
    });
  });

  describe('evaluateCondition', () => {
    it('should return true for null condition', () => {
      expect(orchestrator.evaluateCondition(null, {}, null)).toBe(true);
    });

    it('should return true for undefined condition', () => {
      expect(orchestrator.evaluateCondition(undefined, {}, null)).toBe(true);
    });

    it('should match string condition in output', () => {
      expect(orchestrator.evaluateCondition('success', 'The task was a success', null)).toBe(true);
      expect(orchestrator.evaluateCondition('failure', 'The task was a success', null)).toBe(false);
    });

    it('should handle string condition with object output', () => {
      expect(orchestrator.evaluateCondition('success', { status: 'success' }, null)).toBe(true);
    });

    it('should evaluate equals condition', () => {
      const condition = { type: 'equals', field: 'status', value: 'approved' };

      expect(orchestrator.evaluateCondition(condition, { status: 'approved' }, null)).toBe(true);
      expect(orchestrator.evaluateCondition(condition, { status: 'rejected' }, null)).toBe(false);
    });

    it('should evaluate contains condition', () => {
      const condition = { type: 'contains', field: 'message', value: 'error' };

      expect(orchestrator.evaluateCondition(condition, { message: 'An error occurred' }, null)).toBe(true);
      expect(orchestrator.evaluateCondition(condition, { message: 'All good' }, null)).toBe(false);
    });

    it('should evaluate exists condition', () => {
      const condition = { type: 'exists', field: 'data' };

      expect(orchestrator.evaluateCondition(condition, { data: 'something' }, null)).toBe(true);
      expect(orchestrator.evaluateCondition(condition, { other: 'field' }, null)).toBe(false);
    });

    it('should return true for default condition', () => {
      const condition = { type: 'default' };

      expect(orchestrator.evaluateCondition(condition, {}, null)).toBe(true);
    });

    it('should return false for unknown condition type', () => {
      const condition = { type: 'unknown' };

      expect(orchestrator.evaluateCondition(condition, {}, null)).toBe(false);
    });
  });

  describe('getAgent', () => {
    it('should get agent by ID', () => {
      orchestrator.loadAgent({ id: 'test', name: 'Test' });

      const agent = orchestrator.getAgent('test');

      expect(agent).toBeDefined();
      expect(agent.id).toBe('test');
    });

    it('should return null for nonexistent agent', () => {
      expect(orchestrator.getAgent('missing')).toBeNull();
    });
  });

  describe('getAllAgents', () => {
    it('should return all agents', () => {
      orchestrator.loadAgents([
        { id: 'a1', name: 'A1' },
        { id: 'a2', name: 'A2' }
      ]);

      const agents = orchestrator.getAllAgents();

      expect(agents).toHaveLength(2);
    });
  });

  describe('getAgentsByRole', () => {
    it('should filter agents by role', () => {
      orchestrator.loadAgents([
        { id: 'a1', name: 'A1', role: 'assistant' },
        { id: 'a2', name: 'A2', role: 'router' },
        { id: 'a3', name: 'A3', role: 'assistant' }
      ]);

      const assistants = orchestrator.getAgentsByRole('assistant');

      expect(assistants).toHaveLength(2);
    });
  });

  describe('clear', () => {
    it('should clear all agents and workflows', () => {
      orchestrator.loadAgents([{ id: 'a1', name: 'A1' }]);
      orchestrator.registerWorkflow({ id: 'wf1', name: 'WF1' });

      orchestrator.clear();

      expect(orchestrator.getAllAgents()).toHaveLength(0);
      expect(orchestrator.workflows.size).toBe(0);
    });
  });
});
