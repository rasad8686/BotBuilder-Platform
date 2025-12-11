/**
 * MultiAgentService Tests
 * Tests for server/services/multiAgentService.js
 */

const mockCreate = jest.fn();
const mockFindByBotId = jest.fn();
const mockWorkflowFindByBotId = jest.fn();
const mockWorkflowCreate = jest.fn();
const mockExecutionFindByBotId = jest.fn();
const mockStepFindByAgentId = jest.fn();
const mockExecute = jest.fn();

jest.mock('../../models/Agent', () => ({
  create: mockCreate,
  findByBotId: mockFindByBotId
}));

jest.mock('../../models/AgentWorkflow', () => ({
  create: mockWorkflowCreate,
  findByBotId: mockWorkflowFindByBotId
}));

jest.mock('../../models/WorkflowExecution', () => ({
  findByBotId: mockExecutionFindByBotId
}));

jest.mock('../../models/AgentExecutionStep', () => ({
  findByAgentId: mockStepFindByAgentId
}));

jest.mock('../../agents/workflows/WorkflowEngine', () => {
  return jest.fn().mockImplementation(() => ({
    execute: mockExecute
  }));
});

const multiAgentService = require('../../services/multiAgentService');

describe('MultiAgentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createDefaultAgents', () => {
    it('should create 4 default agents', async () => {
      const mockAgents = [
        { id: 1, name: 'Router', role: 'router' },
        { id: 2, name: 'Researcher', role: 'researcher' },
        { id: 3, name: 'Writer', role: 'writer' },
        { id: 4, name: 'Analyzer', role: 'analyzer' }
      ];

      mockCreate
        .mockResolvedValueOnce(mockAgents[0])
        .mockResolvedValueOnce(mockAgents[1])
        .mockResolvedValueOnce(mockAgents[2])
        .mockResolvedValueOnce(mockAgents[3]);

      mockWorkflowCreate.mockResolvedValueOnce({ id: 1, name: 'Default Workflow' });

      const result = await multiAgentService.createDefaultAgents(1, 1);

      expect(mockCreate).toHaveBeenCalledTimes(4);
      expect(result.agents).toHaveLength(4);
      expect(result.workflow).toBeDefined();
    });

    it('should create default workflow with agents config', async () => {
      const mockAgents = [
        { id: 1, name: 'Router' },
        { id: 2, name: 'Researcher' },
        { id: 3, name: 'Writer' },
        { id: 4, name: 'Analyzer' }
      ];

      mockAgents.forEach(agent => mockCreate.mockResolvedValueOnce(agent));
      mockWorkflowCreate.mockResolvedValueOnce({ id: 1 });

      await multiAgentService.createDefaultAgents(1, 1);

      expect(mockWorkflowCreate).toHaveBeenCalledWith(expect.objectContaining({
        bot_id: 1,
        name: 'Default Workflow',
        workflow_type: 'sequential',
        is_active: true
      }));
    });

    it('should set correct bot_id and organization_id', async () => {
      mockCreate.mockResolvedValue({ id: 1 });
      mockWorkflowCreate.mockResolvedValue({ id: 1 });

      await multiAgentService.createDefaultAgents(5, 10);

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        bot_id: 5,
        organization_id: 10
      }));
    });

    it('should create Router agent with correct properties', async () => {
      mockCreate.mockResolvedValue({ id: 1 });
      mockWorkflowCreate.mockResolvedValue({ id: 1 });

      await multiAgentService.createDefaultAgents(1, 1);

      expect(mockCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
        name: 'Router',
        role: 'router',
        model_provider: 'openai',
        model_name: 'gpt-4o-mini',
        temperature: 0.3,
        is_active: true
      }));
    });
  });

  describe('executeWithBot', () => {
    it('should execute workflow for bot', async () => {
      const mockWorkflows = [{ id: 1, is_active: true }];
      mockWorkflowFindByBotId.mockResolvedValueOnce(mockWorkflows);
      mockExecute.mockResolvedValueOnce({ success: true });

      const result = await multiAgentService.executeWithBot(1, { message: 'test' });

      expect(mockExecute).toHaveBeenCalledWith(1, { message: 'test' }, 1);
      expect(result.success).toBe(true);
    });

    it('should throw error if no active workflow', async () => {
      mockWorkflowFindByBotId.mockResolvedValueOnce([{ id: 1, is_active: false }]);

      await expect(multiAgentService.executeWithBot(1, {}))
        .rejects.toThrow('No active workflow found for bot 1');
    });

    it('should throw error if no workflows exist', async () => {
      mockWorkflowFindByBotId.mockResolvedValueOnce([]);

      await expect(multiAgentService.executeWithBot(1, {}))
        .rejects.toThrow('No active workflow found for bot 1');
    });

    it('should find first active workflow', async () => {
      const mockWorkflows = [
        { id: 1, is_active: false },
        { id: 2, is_active: true },
        { id: 3, is_active: true }
      ];
      mockWorkflowFindByBotId.mockResolvedValueOnce(mockWorkflows);
      mockExecute.mockResolvedValueOnce({});

      await multiAgentService.executeWithBot(1, {});

      expect(mockExecute).toHaveBeenCalledWith(2, {}, 1);
    });
  });

  describe('getAgentStats', () => {
    beforeEach(() => {
      mockFindByBotId.mockResolvedValue([
        { id: 1, role: 'router', is_active: true },
        { id: 2, role: 'researcher', is_active: true },
        { id: 3, role: 'writer', is_active: false }
      ]);

      mockWorkflowFindByBotId.mockResolvedValue([
        { id: 1, workflow_type: 'sequential', is_active: true },
        { id: 2, workflow_type: 'parallel', is_active: false }
      ]);

      mockExecutionFindByBotId.mockResolvedValue([
        { id: 1, status: 'completed', duration_ms: 1000, total_tokens: 100, created_at: new Date() }
      ]);

      mockStepFindByAgentId.mockResolvedValue([]);
    });

    it('should return agent statistics', async () => {
      const stats = await multiAgentService.getAgentStats(1);

      expect(stats.agents.total).toBe(3);
      expect(stats.agents.active).toBe(2);
    });

    it('should return workflow statistics', async () => {
      const stats = await multiAgentService.getAgentStats(1);

      expect(stats.workflows.total).toBe(2);
      expect(stats.workflows.active).toBe(1);
    });

    it('should return execution statistics', async () => {
      const stats = await multiAgentService.getAgentStats(1);

      expect(stats.executions.total).toBe(1);
      expect(stats.executions.completed).toBe(1);
    });

    it('should group agents by role', async () => {
      const stats = await multiAgentService.getAgentStats(1);

      expect(stats.agents.byRole.router).toBe(1);
      expect(stats.agents.byRole.researcher).toBe(1);
      expect(stats.agents.byRole.writer).toBe(1);
    });

    it('should group workflows by type', async () => {
      const stats = await multiAgentService.getAgentStats(1);

      expect(stats.workflows.byType.sequential).toBe(1);
      expect(stats.workflows.byType.parallel).toBe(1);
    });
  });

  describe('getExecutionStats', () => {
    it('should calculate execution statistics', async () => {
      mockExecutionFindByBotId.mockResolvedValueOnce([
        { id: 1, status: 'completed', duration_ms: 1000, total_tokens: 100, created_at: new Date() },
        { id: 2, status: 'completed', duration_ms: 2000, total_tokens: 200, created_at: new Date() },
        { id: 3, status: 'failed', duration_ms: null, total_tokens: 50, created_at: new Date() },
        { id: 4, status: 'running', duration_ms: null, total_tokens: 0, created_at: new Date() }
      ]);

      const stats = await multiAgentService.getExecutionStats(1);

      expect(stats.total).toBe(4);
      expect(stats.completed).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.running).toBe(1);
      expect(stats.avgDuration).toBe(1500);
      expect(stats.totalTokens).toBe(350);
    });

    it('should return recent executions sorted by date', async () => {
      const older = new Date('2024-01-01');
      const newer = new Date('2024-01-02');

      mockExecutionFindByBotId.mockResolvedValueOnce([
        { id: 1, status: 'completed', created_at: older },
        { id: 2, status: 'completed', created_at: newer }
      ]);

      const stats = await multiAgentService.getExecutionStats(1);

      expect(stats.recent[0].id).toBe(2);
      expect(stats.recent[1].id).toBe(1);
    });

    it('should limit recent executions to 10', async () => {
      const executions = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        status: 'completed',
        created_at: new Date()
      }));

      mockExecutionFindByBotId.mockResolvedValueOnce(executions);

      const stats = await multiAgentService.getExecutionStats(1);

      expect(stats.recent).toHaveLength(10);
    });

    it('should handle empty executions', async () => {
      mockExecutionFindByBotId.mockResolvedValueOnce([]);

      const stats = await multiAgentService.getExecutionStats(1);

      expect(stats.total).toBe(0);
      expect(stats.avgDuration).toBe(0);
    });
  });

  describe('getAgentUsage', () => {
    it('should calculate agent usage statistics', async () => {
      mockFindByBotId.mockResolvedValueOnce([
        { id: 1, name: 'Router', role: 'router' },
        { id: 2, name: 'Writer', role: 'writer' }
      ]);

      mockStepFindByAgentId
        .mockResolvedValueOnce([
          { status: 'completed', tokens_used: 100, duration_ms: 500 },
          { status: 'completed', tokens_used: 150, duration_ms: 600 }
        ])
        .mockResolvedValueOnce([
          { status: 'completed', tokens_used: 200, duration_ms: 800 },
          { status: 'failed', tokens_used: 50, duration_ms: 200 }
        ]);

      const usage = await multiAgentService.getAgentUsage(1);

      expect(usage).toHaveLength(2);
    });

    it('should calculate success rate', async () => {
      mockFindByBotId.mockResolvedValueOnce([{ id: 1, name: 'Test', role: 'test' }]);
      mockStepFindByAgentId.mockResolvedValueOnce([
        { status: 'completed' },
        { status: 'completed' },
        { status: 'completed' },
        { status: 'failed' }
      ]);

      const usage = await multiAgentService.getAgentUsage(1);

      expect(usage[0].successRate).toBe('75.0');
    });

    it('should sort by total executions', async () => {
      mockFindByBotId.mockResolvedValueOnce([
        { id: 1, name: 'Low', role: 'low' },
        { id: 2, name: 'High', role: 'high' }
      ]);

      mockStepFindByAgentId
        .mockResolvedValueOnce([{ status: 'completed' }])
        .mockResolvedValueOnce([
          { status: 'completed' },
          { status: 'completed' },
          { status: 'completed' }
        ]);

      const usage = await multiAgentService.getAgentUsage(1);

      expect(usage[0].agentName).toBe('High');
      expect(usage[1].agentName).toBe('Low');
    });

    it('should handle agent with no executions', async () => {
      mockFindByBotId.mockResolvedValueOnce([{ id: 1, name: 'New', role: 'new' }]);
      mockStepFindByAgentId.mockResolvedValueOnce([]);

      const usage = await multiAgentService.getAgentUsage(1);

      expect(usage[0].totalExecutions).toBe(0);
      expect(usage[0].successRate).toBe(0);
      expect(usage[0].avgDuration).toBe(0);
    });
  });

  describe('groupByRole', () => {
    it('should group agents by role', () => {
      const agents = [
        { role: 'router' },
        { role: 'writer' },
        { role: 'writer' },
        { role: 'analyzer' }
      ];

      const result = multiAgentService.groupByRole(agents);

      expect(result.router).toBe(1);
      expect(result.writer).toBe(2);
      expect(result.analyzer).toBe(1);
    });

    it('should use "custom" for agents without role', () => {
      const agents = [
        { role: null },
        { role: undefined },
        { name: 'NoRole' }
      ];

      const result = multiAgentService.groupByRole(agents);

      expect(result.custom).toBe(3);
    });

    it('should handle empty array', () => {
      const result = multiAgentService.groupByRole([]);
      expect(result).toEqual({});
    });
  });

  describe('groupByType', () => {
    it('should group workflows by type', () => {
      const workflows = [
        { workflow_type: 'sequential' },
        { workflow_type: 'parallel' },
        { workflow_type: 'parallel' }
      ];

      const result = multiAgentService.groupByType(workflows);

      expect(result.sequential).toBe(1);
      expect(result.parallel).toBe(2);
    });

    it('should use "sequential" for workflows without type', () => {
      const workflows = [
        { workflow_type: null },
        { workflow_type: undefined },
        { name: 'NoType' }
      ];

      const result = multiAgentService.groupByType(workflows);

      expect(result.sequential).toBe(3);
    });

    it('should handle empty array', () => {
      const result = multiAgentService.groupByType([]);
      expect(result).toEqual({});
    });
  });

  describe('getQuickLinks', () => {
    it('should return quick links with correct paths', () => {
      const links = multiAgentService.getQuickLinks(5);

      expect(links).toHaveLength(3);
      expect(links[0].path).toBe('/bots/5/agents');
      expect(links[1].path).toBe('/bots/5/workflows');
      expect(links[2].path).toBe('/bots/5/executions');
    });

    it('should include labels and icons', () => {
      const links = multiAgentService.getQuickLinks(1);

      expect(links[0].label).toBe('Agent Studio');
      expect(links[0].icon).toBeDefined();
    });

    it('should generate links for any bot ID', () => {
      const links = multiAgentService.getQuickLinks(999);

      expect(links[0].path).toContain('999');
    });
  });
});
