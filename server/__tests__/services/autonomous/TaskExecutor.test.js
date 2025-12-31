/**
 * TaskExecutor Tests
 * Tests for autonomous agent task execution
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

jest.mock('../../../services/autonomous/AgentCore', () => ({
  updateStats: jest.fn(() => Promise.resolve())
}));

jest.mock('../../../services/autonomous/ToolRegistry', () => ({
  has: jest.fn(() => false),
  execute: jest.fn(() => Promise.resolve({ success: true }))
}));

const db = require('../../../db');
const TaskExecutor = require('../../../services/autonomous/TaskExecutor');
const AgentCore = require('../../../services/autonomous/AgentCore');
const toolRegistry = require('../../../services/autonomous/ToolRegistry');

describe('TaskExecutor', () => {
  let executor;
  const mockAgent = { id: 1, name: 'TestAgent' };

  beforeEach(() => {
    executor = new TaskExecutor(mockAgent);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with agent', () => {
      expect(executor.agent).toBe(mockAgent);
    });

    it('should initialize context with empty values', () => {
      expect(executor.context.notes).toEqual({});
      expect(executor.context.history).toEqual([]);
      expect(executor.context.shortTermMemory).toEqual([]);
      expect(executor.context.longTermMemory).toBeInstanceOf(Map);
      expect(executor.context.workingMemory).toEqual({});
      expect(executor.context.toolLogs).toEqual([]);
    });

    it('should initialize recovery strategies', () => {
      expect(executor.recoveryStrategies.size).toBeGreaterThan(0);
      expect(executor.recoveryStrategies.has('NETWORK_ERROR')).toBe(true);
      expect(executor.recoveryStrategies.has('RATE_LIMIT')).toBe(true);
      expect(executor.recoveryStrategies.has('NOT_FOUND')).toBe(true);
      expect(executor.recoveryStrategies.has('AUTH_ERROR')).toBe(true);
      expect(executor.recoveryStrategies.has('GENERIC')).toBe(true);
    });
  });

  describe('addRecoveryStrategy', () => {
    it('should add custom recovery strategy', () => {
      const customHandler = jest.fn();
      executor.addRecoveryStrategy('CUSTOM_ERROR', customHandler);
      expect(executor.recoveryStrategies.has('CUSTOM_ERROR')).toBe(true);
    });
  });

  describe('classifyError', () => {
    it('should classify network errors', () => {
      expect(executor.classifyError(new Error('network error'))).toBe('NETWORK_ERROR');
      expect(executor.classifyError(new Error('ECONNREFUSED'))).toBe('NETWORK_ERROR');
      expect(executor.classifyError(new Error('Request timeout'))).toBe('NETWORK_ERROR');
    });

    it('should classify rate limit errors', () => {
      expect(executor.classifyError(new Error('rate limit exceeded'))).toBe('RATE_LIMIT');
      expect(executor.classifyError(new Error('429 Too Many Requests'))).toBe('RATE_LIMIT');
    });

    it('should classify not found errors', () => {
      expect(executor.classifyError(new Error('Resource not found'))).toBe('NOT_FOUND');
      expect(executor.classifyError(new Error('404 Not Found'))).toBe('NOT_FOUND');
    });

    it('should classify auth errors', () => {
      expect(executor.classifyError(new Error('Unauthorized'))).toBe('AUTH_ERROR');
      expect(executor.classifyError(new Error('401 Authentication required'))).toBe('AUTH_ERROR');
      expect(executor.classifyError(new Error('403 Forbidden'))).toBe('AUTH_ERROR');
    });

    it('should return GENERIC for unknown errors', () => {
      expect(executor.classifyError(new Error('Some random error'))).toBe('GENERIC');
    });

    it('should handle errors without message', () => {
      expect(executor.classifyError({})).toBe('GENERIC');
    });
  });

  describe('extractWaitTime', () => {
    it('should extract wait time from error message', () => {
      const error = new Error('Rate limited, retry after 60 seconds');
      expect(executor.extractWaitTime(error)).toBe(60000);
    });

    it('should return null if no wait time found', () => {
      const error = new Error('Some other error');
      expect(executor.extractWaitTime(error)).toBeNull();
    });
  });

  describe('static createTask', () => {
    it('should create a new task', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          agent_id: 1,
          task_description: 'Test task',
          input_data: '{}',
          status: 'pending'
        }]
      });

      const task = await TaskExecutor.createTask(1, 'Test task', {});

      expect(db.query).toHaveBeenCalled();
      expect(task.id).toBe(1);
      expect(task.status).toBe('pending');
    });
  });

  describe('static getTask', () => {
    it('should get task by ID', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          agent_id: 1,
          task_description: 'Test task',
          input_data: '{}',
          status: 'pending'
        }]
      });

      const task = await TaskExecutor.getTask(1);

      expect(task).not.toBeNull();
      expect(task.id).toBe(1);
    });

    it('should return null if task not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const task = await TaskExecutor.getTask(999);

      expect(task).toBeNull();
    });
  });

  describe('static getTasksByAgent', () => {
    it('should get tasks for an agent', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, agent_id: 1, task_description: 'Task 1', input_data: '{}' },
          { id: 2, agent_id: 1, task_description: 'Task 2', input_data: '{}' }
        ]
      });

      const tasks = await TaskExecutor.getTasksByAgent(1);

      expect(tasks.length).toBe(2);
    });

    it('should filter by status', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await TaskExecutor.getTasksByAgent(1, { status: 'completed' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.arrayContaining(['completed'])
      );
    });

    it('should support pagination', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await TaskExecutor.getTasksByAgent(1, { limit: 10, offset: 20 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([10, 20])
      );
    });
  });

  describe('static getTaskSteps', () => {
    it('should get steps for a task', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, task_id: 1, step_number: 1, action: 'think', input: '{}' },
          { id: 2, task_id: 1, step_number: 2, action: 'plan', input: '{}' }
        ]
      });

      const steps = await TaskExecutor.getTaskSteps(1);

      expect(steps.length).toBe(2);
    });
  });

  describe('execute', () => {
    it('should throw error if task not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(executor.execute(999)).rejects.toThrow('Task not found');
    });

    it('should execute task successfully', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          agent_id: 1,
          task_description: 'Find Python libraries',
          input_data: '{}',
          status: 'pending'
        }]
      });

      const result = await executor.execute(1);

      expect(result).toBeDefined();
      expect(AgentCore.updateStats).toHaveBeenCalledWith(1, true);
    });

    it('should update task status on failure', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            agent_id: 1,
            task_description: 'Test task',
            input_data: '{}'
          }]
        })
        .mockRejectedValueOnce(new Error('Database error'));

      await expect(executor.execute(1)).rejects.toThrow();
      expect(AgentCore.updateStats).toHaveBeenCalledWith(1, false);
    });
  });

  describe('simulateThinking', () => {
    it('should return analysis result', async () => {
      const result = await executor.simulateThinking('Test task', {});

      expect(result.analysis).toBeDefined();
      expect(result.approach).toBeDefined();
      expect(result.reasoning).toBeDefined();
    });
  });

  describe('simulatePlanning', () => {
    it('should create steps for research task', async () => {
      const thinkingResult = { analysis: 'test' };
      const result = await executor.simulatePlanning('Find information', thinkingResult);

      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.reasoning).toBeDefined();
    });

    it('should create steps for non-research task', async () => {
      const thinkingResult = { analysis: 'test' };
      const result = await executor.simulatePlanning('Process data', thinkingResult);

      expect(result.steps.length).toBe(2);
    });
  });

  describe('simulateStepExecution', () => {
    it('should return research data for research action', async () => {
      const result = await executor.simulateStepExecution({ action: 'research' });

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should return analysis for analyze action', async () => {
      const result = await executor.simulateStepExecution({ action: 'analyze' });

      expect(result.analysis).toBeDefined();
    });

    it('should return formatted result for format action', async () => {
      const result = await executor.simulateStepExecution({ action: 'format' });

      expect(result.formatted).toBe(true);
    });

    it('should return completed for unknown action', async () => {
      const result = await executor.simulateStepExecution({ action: 'unknown' });

      expect(result.completed).toBe(true);
    });
  });

  describe('simulateCompilation', () => {
    it('should compile research results', async () => {
      const results = [{
        action: 'research',
        output: { data: [{ name: 'Test', description: 'Test lib' }] }
      }];

      const result = await executor.simulateCompilation('Test', results);

      expect(result.output).toContain('Test');
      expect(result.success).toBe(true);
    });

    it('should handle empty results', async () => {
      const result = await executor.simulateCompilation('Test', []);

      expect(result.success).toBe(true);
    });
  });

  describe('executeStep', () => {
    it('should execute tool if available', async () => {
      toolRegistry.has.mockReturnValue(true);
      toolRegistry.execute.mockResolvedValue({ success: true, data: 'test' });

      const result = await executor.executeStep({ tool: 'web_search', params: { query: 'test' } });

      expect(toolRegistry.execute).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should simulate execution if no tool', async () => {
      toolRegistry.has.mockReturnValue(false);

      const result = await executor.executeStep({ action: 'research' });

      expect(result.data).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    describe('addToShortTermMemory', () => {
      it('should add item with timestamp', () => {
        executor.addToShortTermMemory({ type: 'test', data: 'value' });

        expect(executor.context.shortTermMemory.length).toBe(1);
        expect(executor.context.shortTermMemory[0].timestamp).toBeDefined();
      });

      it('should limit memory size', () => {
        for (let i = 0; i < 15; i++) {
          executor.addToShortTermMemory({ type: 'test', index: i });
        }

        expect(executor.context.shortTermMemory.length).toBeLessThanOrEqual(10);
      });
    });

    describe('storeLongTermMemory', () => {
      it('should store value with metadata', () => {
        executor.storeLongTermMemory('key1', 'value1');

        const item = executor.context.longTermMemory.get('key1');
        expect(item.value).toBe('value1');
        expect(item.storedAt).toBeDefined();
        expect(item.accessCount).toBe(0);
      });
    });

    describe('retrieveLongTermMemory', () => {
      it('should retrieve stored value', () => {
        executor.storeLongTermMemory('key1', 'value1');

        const value = executor.retrieveLongTermMemory('key1');

        expect(value).toBe('value1');
      });

      it('should increment access count', () => {
        executor.storeLongTermMemory('key1', 'value1');

        executor.retrieveLongTermMemory('key1');
        executor.retrieveLongTermMemory('key1');

        const item = executor.context.longTermMemory.get('key1');
        expect(item.accessCount).toBe(2);
      });

      it('should return null for non-existent key', () => {
        const value = executor.retrieveLongTermMemory('nonexistent');

        expect(value).toBeNull();
      });
    });

    describe('updateWorkingMemory', () => {
      it('should update working memory', () => {
        executor.updateWorkingMemory('task', 'current task');

        expect(executor.context.workingMemory.task).toBe('current task');
      });
    });

    describe('clearWorkingMemory', () => {
      it('should clear working memory', () => {
        executor.updateWorkingMemory('task', 'current task');
        executor.clearWorkingMemory();

        expect(executor.context.workingMemory).toEqual({});
      });
    });

    describe('getRelevantContext', () => {
      it('should return recent history', () => {
        for (let i = 0; i < 10; i++) {
          executor.addToShortTermMemory({ index: i });
        }

        const context = executor.getRelevantContext();

        expect(context.recentHistory.length).toBe(5);
      });

      it('should search long-term memory', () => {
        executor.storeLongTermMemory('python_libs', ['numpy', 'pandas']);
        executor.storeLongTermMemory('javascript_libs', ['react', 'vue']);

        const context = executor.getRelevantContext('python');

        expect(context.relevantLongTerm.length).toBe(1);
        expect(context.relevantLongTerm[0].key).toBe('python_libs');
      });
    });
  });

  describe('Error Recovery', () => {
    describe('attemptRecovery', () => {
      it('should apply recovery strategy', async () => {
        const error = new Error('Network error');
        const step = { action: 'research' };

        const recovery = await executor.attemptRecovery(error, step, 1);

        expect(recovery.action).toBe('retry');
        expect(executor.errorHistory.length).toBe(1);
      });

      it('should return abort for unknown strategy', async () => {
        executor.recoveryStrategies.clear();
        const error = new Error('Unknown error');
        const step = { action: 'test' };

        const recovery = await executor.attemptRecovery(error, step, 1);

        expect(recovery.action).toBe('abort');
      });
    });

    describe('executeStepWithRecovery', () => {
      it('should return success on first try', async () => {
        toolRegistry.has.mockReturnValue(false);

        const result = await executor.executeStepWithRecovery({ action: 'research' }, 1);

        expect(result.success).toBe(true);
        expect(result.retryCount).toBe(0);
      });
    });
  });

  describe('Tool Execution Logging', () => {
    describe('logToolExecution', () => {
      it('should log tool execution', () => {
        const entry = executor.logToolExecution('web_search', { query: 'test' }, { results: [] }, 100, true);

        expect(entry.tool).toBe('web_search');
        expect(entry.success).toBe(true);
        expect(entry.timestamp).toBeDefined();
      });

      it('should limit log size', () => {
        for (let i = 0; i < 120; i++) {
          executor.logToolExecution('tool', {}, {}, 100, true);
        }

        expect(executor.context.toolLogs.length).toBeLessThanOrEqual(100);
      });
    });

    describe('getToolLogs', () => {
      it('should return limited logs', () => {
        for (let i = 0; i < 20; i++) {
          executor.logToolExecution('tool', {}, {}, 100, true);
        }

        const logs = executor.getToolLogs(10);

        expect(logs.length).toBe(10);
      });
    });

    describe('sanitizeForLog', () => {
      it('should redact sensitive fields', () => {
        const data = {
          password: 'secret123',
          api_key: 'key123',
          token: 'tok123',
          username: 'user'
        };

        const sanitized = executor.sanitizeForLog(data);

        expect(sanitized.password).toBe('[REDACTED]');
        expect(sanitized.api_key).toBe('[REDACTED]');
        expect(sanitized.token).toBe('[REDACTED]');
        expect(sanitized.username).toBe('user');
      });

      it('should handle null data', () => {
        expect(executor.sanitizeForLog(null)).toBeNull();
      });
    });
  });

  describe('Advanced Task Planning', () => {
    describe('createAdaptivePlan', () => {
      it('should create plan with steps', async () => {
        const plan = await executor.createAdaptivePlan('Find Python libraries', {});

        expect(plan.id).toBeDefined();
        expect(plan.steps.length).toBeGreaterThan(0);
        expect(plan.estimatedDuration).toBeGreaterThan(0);
      });
    });

    describe('identifyParallelGroups', () => {
      it('should group parallel steps', () => {
        const steps = [
          { id: 's1', canRunInParallel: true, dependencies: [] },
          { id: 's2', canRunInParallel: true, dependencies: [] },
          { id: 's3', canRunInParallel: false, dependencies: ['s1'] }
        ];

        const groups = executor.identifyParallelGroups(steps);

        expect(groups.length).toBe(2);
        expect(groups[0]).toContain('s1');
        expect(groups[0]).toContain('s2');
      });
    });

    describe('revisePlan', () => {
      it('should revise plan with alternative steps', async () => {
        await executor.createAdaptivePlan('Test task', {});
        const failedStep = executor.currentPlan.steps[0];

        const alternatives = await executor.revisePlan(failedStep, new Error('Test error'));

        expect(alternatives.length).toBeGreaterThan(0);
        expect(executor.planRevisions).toBe(1);
      });

      it('should return null when max revisions reached', async () => {
        executor.planRevisions = 3;

        const alternatives = await executor.revisePlan({}, new Error('Test'));

        expect(alternatives).toBeNull();
      });
    });

    describe('generateAlternativeSteps', () => {
      it('should generate alternatives for browser step', () => {
        const step = { id: 's1', tool: 'browser', description: 'Scrape data' };
        const alternatives = executor.generateAlternativeSteps(step, new Error('Failed'));

        expect(alternatives.length).toBeGreaterThan(0);
      });

      it('should add wait step for rate limit error', () => {
        const step = { id: 's1', action: 'api_call' };
        const alternatives = executor.generateAlternativeSteps(step, new Error('rate limit exceeded'));

        expect(alternatives.some(s => s.action === 'wait')).toBe(true);
      });

      it('should generate retry step for unknown error', () => {
        const step = { id: 's1', action: 'unknown', description: 'Do something' };
        const alternatives = executor.generateAlternativeSteps(step, new Error('Unknown error'));

        expect(alternatives[0].id).toContain('retry');
      });
    });
  });

  describe('getExecutionStats', () => {
    it('should return execution statistics', () => {
      executor.addToShortTermMemory({ type: 'test' });
      executor.storeLongTermMemory('key1', 'value1');
      executor.logToolExecution('tool', {}, {}, 100, true);

      const stats = executor.getExecutionStats();

      expect(stats.shortTermMemorySize).toBe(1);
      expect(stats.longTermMemorySize).toBe(1);
      expect(stats.toolLogCount).toBe(1);
    });
  });

  describe('static parseTask', () => {
    it('should parse task row', () => {
      const row = {
        id: 1,
        input_data: '{"key": "value"}',
        result: '{"success": true}'
      };

      const task = TaskExecutor.parseTask(row);

      expect(task.input_data).toEqual({ key: 'value' });
      expect(task.result).toEqual({ success: true });
    });

    it('should handle null row', () => {
      expect(TaskExecutor.parseTask(null)).toBeNull();
    });

    it('should handle already parsed objects', () => {
      const row = {
        id: 1,
        input_data: { key: 'value' },
        result: { success: true }
      };

      const task = TaskExecutor.parseTask(row);

      expect(task.input_data).toEqual({ key: 'value' });
    });
  });

  describe('static parseStep', () => {
    it('should parse step row', () => {
      const row = {
        id: 1,
        input: '{"key": "value"}',
        output: '{"result": "data"}'
      };

      const step = TaskExecutor.parseStep(row);

      expect(step.input).toEqual({ key: 'value' });
      expect(step.output).toEqual({ result: 'data' });
    });

    it('should handle null row', () => {
      expect(TaskExecutor.parseStep(null)).toBeNull();
    });
  });
});
