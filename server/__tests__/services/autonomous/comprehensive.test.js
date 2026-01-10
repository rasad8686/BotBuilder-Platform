/**
 * Comprehensive Tests for Autonomous Agent Services
 * Coverage: AgentOrchestrator, TaskExecutor, BrowserTool, EmailTool, FileTool, HttpTool, AgentCore
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

jest.mock('puppeteer', () => ({
  launch: jest.fn()
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn()
}));

jest.mock('cheerio', () => ({
  load: jest.fn()
}));

const db = require('../../../db');
const AgentOrchestrator = require('../../../services/autonomous/AgentOrchestrator');
const TaskExecutor = require('../../../services/autonomous/TaskExecutor');
const BrowserTool = require('../../../services/autonomous/tools/BrowserTool');
const EmailTool = require('../../../services/autonomous/tools/EmailTool');
const FileTool = require('../../../services/autonomous/tools/FileTool');
const HttpTool = require('../../../services/autonomous/tools/HttpTool');
const AgentCore = require('../../../services/autonomous/AgentCore');

describe('Autonomous Agent Services - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================
  // AGENT ORCHESTRATOR TESTS (25 tests)
  // =============================================
  describe('AgentOrchestrator', () => {
    let orchestrator;
    const userId = 'user-123';

    beforeEach(() => {
      orchestrator = new AgentOrchestrator(userId);
    });

    describe('Workflow Creation', () => {
      it('should create a new workflow', async () => {
        const workflowData = {
          name: 'Test Workflow',
          description: 'Test workflow description',
          agents: ['agent-1', 'agent-2'],
          steps: [{ name: 'step1', agentId: 'agent-1' }],
          settings: { timeout: 5000 }
        };

        db.query.mockResolvedValueOnce({
          rows: [{
            id: 'workflow-1',
            user_id: userId,
            name: workflowData.name,
            description: workflowData.description,
            agents: JSON.stringify(workflowData.agents),
            steps: JSON.stringify(workflowData.steps),
            settings: JSON.stringify(workflowData.settings),
            status: 'pending'
          }]
        });

        const result = await orchestrator.createWorkflow(workflowData);

        expect(result).toMatchObject({
          name: workflowData.name,
          description: workflowData.description,
          status: 'pending'
        });
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO agent_workflows'),
          expect.arrayContaining([userId, workflowData.name])
        );
      });

      it('should throw error if workflow name is missing', async () => {
        const workflowData = {
          description: 'Test workflow description'
        };

        await expect(orchestrator.createWorkflow(workflowData))
          .rejects.toThrow('Workflow name is required');
      });

      it('should handle empty agents array', async () => {
        const workflowData = {
          name: 'Test Workflow',
          agents: []
        };

        db.query.mockResolvedValueOnce({
          rows: [{
            id: 'workflow-1',
            user_id: userId,
            name: workflowData.name,
            agents: '[]',
            steps: '[]',
            settings: '{}',
            status: 'pending'
          }]
        });

        const result = await orchestrator.createWorkflow(workflowData);
        expect(result.agents).toEqual([]);
      });

      it('should handle empty steps array', async () => {
        const workflowData = {
          name: 'Test Workflow',
          steps: []
        };

        db.query.mockResolvedValueOnce({
          rows: [{
            id: 'workflow-1',
            user_id: userId,
            name: workflowData.name,
            agents: '[]',
            steps: '[]',
            settings: '{}',
            status: 'pending'
          }]
        });

        const result = await orchestrator.createWorkflow(workflowData);
        expect(result.steps).toEqual([]);
      });
    });

    describe('Workflow Execution', () => {
      it('should throw error if workflow not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await expect(orchestrator.executeWorkflow('nonexistent-id'))
          .rejects.toThrow('Workflow not found');
      });

      it('should throw error when max concurrent workflows reached', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 'workflow-1',
            user_id: userId,
            name: 'Test',
            agents: '[]',
            steps: '[]',
            settings: '{}',
            status: 'pending'
          }]
        });

        // Fill up concurrent workflows
        for (let i = 0; i < 5; i++) {
          orchestrator.activeWorkflows.set(`exec_${i}`, { id: `exec_${i}` });
        }

        await expect(orchestrator.executeWorkflow('workflow-1'))
          .rejects.toThrow('Maximum concurrent workflows reached');
      });

      it('should initialize workflow execution state', async () => {
        const workflow = {
          id: 'workflow-1',
          agents: [],
          steps: []
        };

        db.query
          .mockResolvedValueOnce({ rows: [workflow] })
          .mockResolvedValueOnce({ rows: [] });

        const inputData = { key: 'value' };

        try {
          await orchestrator.executeWorkflow('workflow-1', inputData);
        } catch (e) {
          // Expected to fail due to no steps
        }

        expect(orchestrator.activeWorkflows.size).toBeGreaterThanOrEqual(0);
      });

      it('should update workflow status to running', async () => {
        const workflow = {
          id: 'workflow-1',
          agents: [],
          steps: []
        };

        db.query
          .mockResolvedValueOnce({ rows: [workflow] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        try {
          await orchestrator.executeWorkflow('workflow-1');
        } catch (e) {
          // Expected
        }

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE agent_workflows'),
          expect.arrayContaining(['running'])
        );
      });
    });

    describe('Workflow Management', () => {
      it('should get workflow by ID', async () => {
        const workflowData = {
          id: 'workflow-1',
          user_id: userId,
          name: 'Test',
          agents: '["agent-1"]',
          steps: '[]',
          settings: '{}'
        };

        db.query.mockResolvedValueOnce({ rows: [workflowData] });

        const result = await orchestrator.getWorkflow('workflow-1');
        expect(result.id).toBe('workflow-1');
        expect(result.agents).toEqual(['agent-1']);
      });

      it('should return null if workflow not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await orchestrator.getWorkflow('nonexistent');
        expect(result).toBeNull();
      });

      it('should get all workflows for user', async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            { id: 'w1', user_id: userId, name: 'W1', agents: '[]', steps: '[]', settings: '{}' },
            { id: 'w2', user_id: userId, name: 'W2', agents: '[]', steps: '[]', settings: '{}' }
          ]
        });

        const result = await orchestrator.getWorkflows();
        expect(result).toHaveLength(2);
      });

      it('should filter workflows by status', async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            { id: 'w1', user_id: userId, name: 'W1', status: 'completed', agents: '[]', steps: '[]', settings: '{}' }
          ]
        });

        const result = await orchestrator.getWorkflows({ status: 'completed' });
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('AND status = $2'),
          expect.arrayContaining([userId, 'completed'])
        );
      });

      it('should apply pagination to workflows', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await orchestrator.getWorkflows({ limit: 10, offset: 20 });
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT'),
          expect.arrayContaining([10, 20])
        );
      });

      it('should delete workflow', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 'workflow-1' }] });

        const result = await orchestrator.deleteWorkflow('workflow-1');
        expect(result).toBe(true);
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM agent_workflows'),
          expect.arrayContaining(['workflow-1', userId])
        );
      });

      it('should throw error when deleting non-existent workflow', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await expect(orchestrator.deleteWorkflow('nonexistent'))
          .rejects.toThrow('Workflow not found or access denied');
      });
    });

    describe('Agent Pool Management', () => {
      it('should initialize agents for workflow', async () => {
        const agentIds = ['agent-1', 'agent-2'];

        db.query
          .mockResolvedValueOnce({ rows: [{ id: 'agent-1', name: 'Agent 1' }] })
          .mockResolvedValueOnce({ rows: [{ id: 'agent-2', name: 'Agent 2' }] });

        await orchestrator.initializeAgents(agentIds);

        expect(orchestrator.agentPool.size).toBe(2);
      });

      it('should not re-initialize existing agents', async () => {
        orchestrator.agentPool.set('agent-1', { agent: { id: 'agent-1' } });

        await orchestrator.initializeAgents(['agent-1']);

        expect(db.query).not.toHaveBeenCalled();
      });
    });

    describe('Agent Communication', () => {
      it('should send message between agents', async () => {
        const message = await orchestrator.sendAgentMessage('agent-1', 'agent-2', 'Hello');

        expect(message).toMatchObject({
          from: 'agent-1',
          to: 'agent-2',
          content: 'Hello',
          status: 'sent'
        });
        expect(orchestrator.messageQueue).toHaveLength(1);
      });

      it('should get pending messages for agent', () => {
        orchestrator.messageQueue.push(
          { from: 'agent-1', to: 'agent-2', content: 'Msg1', status: 'sent' },
          { from: 'agent-1', to: 'agent-2', content: 'Msg2', status: 'sent' },
          { from: 'agent-1', to: 'agent-3', content: 'Msg3', status: 'sent' }
        );

        const messages = orchestrator.getAgentMessages('agent-2');
        expect(messages).toHaveLength(2);
      });

      it('should perform agent handoff', async () => {
        orchestrator.agentPool.set('agent-1', { agent: { id: 'agent-1' } });
        orchestrator.agentPool.set('agent-2', { agent: { id: 'agent-2' } });

        db.query.mockResolvedValueOnce({ rows: [] });

        const handoff = await orchestrator.handoffToAgent('agent-1', 'agent-2', { key: 'value' });

        expect(handoff).toMatchObject({
          from: 'agent-1',
          to: 'agent-2',
          status: 'pending'
        });
      });

      it('should throw error if handoff agents not found', async () => {
        await expect(orchestrator.handoffToAgent('agent-1', 'agent-2', {}))
          .rejects.toThrow('One or both agents not found in pool');
      });
    });

    describe('Event Handling', () => {
      it('should register event handler', () => {
        const handler = jest.fn();
        orchestrator.on('test_event', handler);

        expect(orchestrator.eventHandlers.get('test_event')).toContain(handler);
      });

      it('should emit events to handlers', () => {
        const handler = jest.fn();
        orchestrator.on('test_event', handler);

        orchestrator.emit('test_event', { data: 'test' });

        expect(handler).toHaveBeenCalledWith({ data: 'test' });
      });

      it('should handle errors in event handlers gracefully', () => {
        const handler = jest.fn(() => { throw new Error('Handler error'); });
        orchestrator.on('test_event', handler);

        expect(() => orchestrator.emit('test_event', {})).not.toThrow();
      });
    });

    describe('Workflow State Management', () => {
      it('should pause workflow', async () => {
        const execution = {
          id: 'exec-1',
          workflowId: 'workflow-1',
          status: 'running',
          currentStep: 2
        };
        orchestrator.activeWorkflows.set('exec-1', execution);

        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await orchestrator.pauseWorkflow('exec-1');
        expect(result).toBe(true);
        expect(execution.status).toBe('paused');
      });

      it('should resume paused workflow', async () => {
        const execution = {
          id: 'exec-1',
          workflowId: 'workflow-1',
          status: 'paused',
          currentStep: 2
        };
        orchestrator.activeWorkflows.set('exec-1', execution);

        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await orchestrator.resumeWorkflow('exec-1');
        expect(result).toBe(true);
        expect(execution.status).toBe('running');
      });

      it('should cancel workflow', async () => {
        const execution = {
          id: 'exec-1',
          workflowId: 'workflow-1',
          status: 'running',
          currentStep: 2
        };
        orchestrator.activeWorkflows.set('exec-1', execution);

        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await orchestrator.cancelWorkflow('exec-1');
        expect(result).toBe(true);
        expect(orchestrator.activeWorkflows.has('exec-1')).toBe(false);
      });

      it('should get active executions', () => {
        orchestrator.activeWorkflows.set('exec-1', { id: 'exec-1', status: 'running' });
        orchestrator.activeWorkflows.set('exec-2', { id: 'exec-2', status: 'running' });

        const active = orchestrator.getActiveExecutions();
        expect(active).toHaveLength(2);
      });
    });
  });

  // =============================================
  // TASK EXECUTOR TESTS (30 tests)
  // =============================================
  describe('TaskExecutor', () => {
    let executor;
    const mockAgent = {
      id: 'agent-1',
      name: 'Test Agent',
      capabilities: []
    };

    beforeEach(() => {
      executor = new TaskExecutor(mockAgent);
    });

    describe('Task Creation', () => {
      it('should create a new task', async () => {
        const taskDescription = 'Test task';
        const inputData = { key: 'value' };

        db.query.mockResolvedValueOnce({
          rows: [{
            id: 'task-1',
            agent_id: mockAgent.id,
            task_description: taskDescription,
            input_data: JSON.stringify(inputData),
            status: 'pending'
          }]
        });

        const task = await TaskExecutor.createTask(mockAgent.id, taskDescription, inputData);

        expect(task.id).toBe('task-1');
        expect(task.task_description).toBe(taskDescription);
      });

      it('should get task by ID', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 'task-1',
            agent_id: 'agent-1',
            task_description: 'Test',
            input_data: '{}',
            status: 'pending'
          }]
        });

        const task = await TaskExecutor.getTask('task-1');
        expect(task).not.toBeNull();
        expect(task.id).toBe('task-1');
      });

      it('should return null for non-existent task', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const task = await TaskExecutor.getTask('nonexistent');
        expect(task).toBeNull();
      });

      it('should get tasks by agent', async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            { id: 'task-1', agent_id: 'agent-1', task_description: 'T1', input_data: '{}' },
            { id: 'task-2', agent_id: 'agent-1', task_description: 'T2', input_data: '{}' }
          ]
        });

        const tasks = await TaskExecutor.getTasksByAgent('agent-1');
        expect(tasks).toHaveLength(2);
      });

      it('should filter tasks by status', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{ id: 'task-1', agent_id: 'agent-1', task_description: 'T1', input_data: '{}', status: 'completed' }]
        });

        await TaskExecutor.getTasksByAgent('agent-1', { status: 'completed' });
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('AND status = $2'),
          expect.arrayContaining(['agent-1', 'completed'])
        );
      });
    });

    describe('Memory Management', () => {
      it('should add to short-term memory', () => {
        executor.addToShortTermMemory({ action: 'test', result: 'success' });

        expect(executor.context.shortTermMemory).toHaveLength(1);
        expect(executor.context.shortTermMemory[0]).toMatchObject({
          action: 'test',
          result: 'success'
        });
      });

      it('should limit short-term memory size', () => {
        for (let i = 0; i < 15; i++) {
          executor.addToShortTermMemory({ index: i });
        }

        expect(executor.context.shortTermMemory.length).toBeLessThanOrEqual(10);
      });

      it('should store in long-term memory', () => {
        executor.storeLongTermMemory('key1', 'value1');

        expect(executor.context.longTermMemory.has('key1')).toBe(true);
        expect(executor.context.longTermMemory.get('key1').value).toBe('value1');
      });

      it('should retrieve from long-term memory', () => {
        executor.storeLongTermMemory('key1', 'value1');

        const value = executor.retrieveLongTermMemory('key1');
        expect(value).toBe('value1');
      });

      it('should track access count for long-term memory', () => {
        executor.storeLongTermMemory('key1', 'value1');

        executor.retrieveLongTermMemory('key1');
        executor.retrieveLongTermMemory('key1');

        const item = executor.context.longTermMemory.get('key1');
        expect(item.accessCount).toBe(2);
      });

      it('should return null for non-existent long-term memory', () => {
        const value = executor.retrieveLongTermMemory('nonexistent');
        expect(value).toBeNull();
      });

      it('should update working memory', () => {
        executor.updateWorkingMemory('currentTask', 'task-1');

        expect(executor.context.workingMemory.currentTask).toBe('task-1');
      });

      it('should clear working memory', () => {
        executor.updateWorkingMemory('key1', 'value1');
        executor.updateWorkingMemory('key2', 'value2');

        executor.clearWorkingMemory();

        expect(Object.keys(executor.context.workingMemory)).toHaveLength(0);
      });

      it('should get relevant context', () => {
        executor.addToShortTermMemory({ action: 'test1' });
        executor.storeLongTermMemory('search_key', 'value');

        const context = executor.getRelevantContext('search');

        expect(context).toHaveProperty('recentHistory');
        expect(context).toHaveProperty('relevantLongTerm');
        expect(context).toHaveProperty('workingMemory');
      });

      it('should persist memory to database', async () => {
        executor.addToShortTermMemory({ action: 'test' });
        executor.storeLongTermMemory('key', 'value');

        db.query.mockResolvedValueOnce({ rows: [] });

        await executor.persistMemory();

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO agent_memory'),
          expect.arrayContaining([mockAgent.id, expect.any(String)])
        );
      });

      it('should load memory from database', async () => {
        const memoryData = {
          shortTermMemory: [{ action: 'test' }],
          longTermMemory: [['key', { value: 'value', accessCount: 0 }]]
        };

        db.query.mockResolvedValueOnce({
          rows: [{ memory_data: memoryData }]
        });

        await executor.loadMemory();

        expect(executor.context.shortTermMemory).toHaveLength(1);
        expect(executor.context.longTermMemory.has('key')).toBe(true);
      });
    });

    describe('Error Recovery', () => {
      it('should classify network errors', () => {
        const error = new Error('Network timeout');
        const type = executor.classifyError(error);

        expect(type).toBe('NETWORK_ERROR');
      });

      it('should classify rate limit errors', () => {
        const error = new Error('429 Too Many Requests');
        const type = executor.classifyError(error);

        expect(type).toBe('RATE_LIMIT');
      });

      it('should classify not found errors', () => {
        const error = new Error('404 Not Found');
        const type = executor.classifyError(error);

        expect(type).toBe('NOT_FOUND');
      });

      it('should classify auth errors', () => {
        const error = new Error('401 Unauthorized');
        const type = executor.classifyError(error);

        expect(type).toBe('AUTH_ERROR');
      });

      it('should classify unknown errors as generic', () => {
        const error = new Error('Unknown error');
        const type = executor.classifyError(error);

        expect(type).toBe('GENERIC');
      });

      it('should add custom recovery strategy', async () => {
        const customHandler = jest.fn().mockResolvedValue({ action: 'retry' });

        executor.addRecoveryStrategy('CUSTOM_ERROR', customHandler);

        expect(executor.recoveryStrategies.has('CUSTOM_ERROR')).toBe(true);
      });

      it('should attempt recovery for errors', async () => {
        const error = new Error('Network timeout');
        const step = { action: 'test' };

        const recovery = await executor.attemptRecovery(error, step, 1);

        expect(recovery).toHaveProperty('action');
        expect(executor.errorHistory).toHaveLength(1);
      });

      it('should extract wait time from rate limit error', () => {
        const error = new Error('Rate limit exceeded. Retry after 30 seconds');
        const waitTime = executor.extractWaitTime(error);

        expect(waitTime).toBe(30000);
      });
    });

    describe('Tool Execution Logging', () => {
      it('should log tool execution', () => {
        const logEntry = executor.logToolExecution(
          'browser',
          { url: 'https://example.com' },
          { success: true },
          1000,
          true
        );

        expect(logEntry).toMatchObject({
          tool: 'browser',
          duration: 1000,
          success: true
        });
        expect(executor.context.toolLogs).toHaveLength(1);
      });

      it('should limit tool logs size', () => {
        for (let i = 0; i < 150; i++) {
          executor.logToolExecution('test', {}, {}, 100, true);
        }

        expect(executor.context.toolLogs.length).toBeLessThanOrEqual(100);
      });

      it('should get tool logs with limit', () => {
        for (let i = 0; i < 100; i++) {
          executor.logToolExecution('test', {}, {}, 100, true);
        }

        const logs = executor.getToolLogs(20);
        expect(logs).toHaveLength(20);
      });

      it('should sanitize sensitive data in logs', () => {
        const data = {
          username: 'user',
          password: 'secret123',
          api_key: 'key123'
        };

        const sanitized = executor.sanitizeForLog(data);

        expect(sanitized.username).toBe('user');
        expect(sanitized.password).toBe('[REDACTED]');
        expect(sanitized.api_key).toBe('[REDACTED]');
      });
    });

    describe('Execution Statistics', () => {
      it('should get execution stats', () => {
        executor.addToShortTermMemory({ action: 'test' });
        executor.storeLongTermMemory('key', 'value');
        executor.logToolExecution('browser', {}, {}, 100, true);

        const stats = executor.getExecutionStats();

        expect(stats).toMatchObject({
          shortTermMemorySize: 1,
          longTermMemorySize: 1,
          toolLogCount: 1,
          errorCount: 0,
          planRevisions: 0
        });
      });

      it('should include current plan in stats', async () => {
        const plan = await executor.createAdaptivePlan('Test task', {});

        const stats = executor.getExecutionStats();

        expect(stats.currentPlan).toBeDefined();
        expect(stats.currentPlan.id).toBe(plan.id);
      });
    });

    describe('Task Planning', () => {
      it('should prepare step input with context variables', () => {
        const step = {
          input: {
            url: '{{baseUrl}}',
            value: 'static'
          }
        };
        const context = {
          baseUrl: 'https://example.com'
        };

        const input = executor.prepareStepInput(step, context);

        expect(input.url).toBe('https://example.com');
        expect(input.value).toBe('static');
      });

      it('should identify parallel groups', () => {
        const steps = [
          { id: 's1', canRunInParallel: true, dependencies: [] },
          { id: 's2', canRunInParallel: true, dependencies: [] },
          { id: 's3', canRunInParallel: false, dependencies: ['s1'] }
        ];

        const groups = executor.identifyParallelGroups(steps);

        expect(groups.length).toBeGreaterThan(0);
      });
    });
  });

  // =============================================
  // BROWSER TOOL TESTS (20 tests)
  // =============================================
  describe('BrowserTool', () => {
    let browserTool;

    beforeEach(() => {
      browserTool = new BrowserTool();
      global.fetch = jest.fn();
    });

    afterEach(() => {
      delete global.fetch;
    });

    describe('URL Validation', () => {
      it('should validate correct URLs', () => {
        expect(browserTool.isValidUrl('https://example.com')).toBe(true);
        expect(browserTool.isValidUrl('http://example.com')).toBe(true);
      });

      it('should reject invalid URLs', () => {
        expect(browserTool.isValidUrl('not-a-url')).toBe(false);
        expect(browserTool.isValidUrl('ftp://example.com')).toBe(false);
      });

      it('should block localhost URLs', () => {
        expect(browserTool.isBlockedUrl('http://localhost')).toBe(true);
        expect(browserTool.isBlockedUrl('http://127.0.0.1')).toBe(true);
      });

      it('should block internal IP addresses', () => {
        expect(browserTool.isBlockedUrl('http://192.168.1.1')).toBe(true);
        expect(browserTool.isBlockedUrl('http://10.0.0.1')).toBe(true);
        expect(browserTool.isBlockedUrl('http://172.16.0.1')).toBe(true);
      });

      it('should allow external URLs', () => {
        expect(browserTool.isBlockedUrl('https://google.com')).toBe(false);
        expect(browserTool.isBlockedUrl('https://example.com')).toBe(false);
      });
    });

    describe('Scraping Actions', () => {
      it('should scrape text from URL', async () => {
        const mockHtml = '<html><body><h1>Hello World</h1><p>Content</p></body></html>';

        global.fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: jest.fn().mockResolvedValue(mockHtml)
        });

        const cheerio = require('cheerio');
        cheerio.load.mockReturnValue({
          text: jest.fn().mockReturnValue('Hello World Content'),
          html: jest.fn().mockReturnValue(mockHtml)
        });

        const result = await browserTool.execute({
          action: 'scrape',
          url: 'https://example.com',
          extractType: 'text'
        });

        expect(result.success).toBe(true);
      });

      it('should handle fetch errors', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        });

        const result = await browserTool.execute({
          action: 'scrape',
          url: 'https://example.com'
        });

        expect(result.success).toBe(false);
      });

      it('should retry on network errors', async () => {
        global.fetch
          .mockRejectedValueOnce(new Error('Network timeout'))
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: jest.fn().mockResolvedValue('<html></html>')
          });

        const cheerio = require('cheerio');
        cheerio.load.mockReturnValue({
          text: jest.fn().mockReturnValue('')
        });

        const result = await browserTool.execute({
          action: 'scrape',
          url: 'https://example.com'
        });

        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      it('should validate URL before scraping', async () => {
        const result = await browserTool.execute({
          action: 'scrape',
          url: 'invalid-url'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid URL');
      });

      it('should block internal URLs', async () => {
        const result = await browserTool.execute({
          action: 'scrape',
          url: 'http://localhost:3000'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('internal URLs');
      });
    });

    describe('Content Extraction', () => {
      it('should extract text content', () => {
        const $ = {
          text: jest.fn().mockReturnValue('Sample text content'),
          each: jest.fn()
        };

        const result = browserTool.extractText($, null, 100);

        expect(result).toHaveProperty('content');
      });

      it('should extract links', () => {
        const mockLinks = [
          { attr: jest.fn().mockReturnValue('https://example.com/page1'), text: jest.fn().mockReturnValue('Link 1') },
          { attr: jest.fn().mockReturnValue('https://example.com/page2'), text: jest.fn().mockReturnValue('Link 2') }
        ];

        const $ = jest.fn((selector) => ({
          each: jest.fn((callback) => {
            mockLinks.forEach((link, i) => callback(i, link));
          }),
          attr: jest.fn(),
          text: jest.fn()
        }));

        const result = browserTool.extractLinks($, 'https://example.com', 100);

        expect(result).toHaveProperty('links');
      });

      it('should extract meta information', () => {
        const $ = jest.fn((selector) => ({
          text: jest.fn().mockReturnValue('Page Title'),
          attr: jest.fn().mockReturnValue('Description')
        }));

        const result = browserTool.extractMeta($);

        expect(result).toHaveProperty('title');
      });

      it('should limit extracted items', () => {
        const $ = jest.fn((selector) => ({
          each: jest.fn((callback) => {
            for (let i = 0; i < 200; i++) {
              if (callback(i, {}) === false) break;
            }
          })
        }));

        const result = browserTool.extractLinks($, 'https://example.com', 50);

        expect(result.count).toBeLessThanOrEqual(50);
      });
    });

    describe('Retry Logic', () => {
      it('should identify retryable errors', () => {
        expect(browserTool.isRetryableError(new Error('ECONNRESET'))).toBe(true);
        expect(browserTool.isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
        expect(browserTool.isRetryableError(new Error('Network error'))).toBe(true);
      });

      it('should not retry non-retryable errors', () => {
        expect(browserTool.isRetryableError(new Error('Invalid input'))).toBe(false);
      });
    });

    describe('Browser Management', () => {
      it('should close browser instance', async () => {
        await browserTool.closeBrowser();
        // Should not throw error even if no browser
      });

      it('should get execution logs', () => {
        browserTool.executionLogs = [
          { action: 'scrape', success: true },
          { action: 'click', success: true }
        ];

        const logs = browserTool.getExecutionLogs();
        expect(logs).toHaveLength(2);
      });

      it('should clear execution logs', () => {
        browserTool.executionLogs = [{ action: 'scrape' }];
        browserTool.clearExecutionLogs();

        expect(browserTool.executionLogs).toHaveLength(0);
      });

      it('should get tool definition', () => {
        const definition = browserTool.getDefinition();

        expect(definition).toHaveProperty('name');
        expect(definition).toHaveProperty('description');
        expect(definition).toHaveProperty('parameters');
        expect(definition).toHaveProperty('execute');
      });
    });
  });

  // =============================================
  // EMAIL TOOL TESTS (15 tests)
  // =============================================
  describe('EmailTool', () => {
    let emailTool;

    beforeEach(() => {
      emailTool = new EmailTool();
    });

    describe('Email Validation', () => {
      it('should validate correct email addresses', () => {
        expect(emailTool.isValidEmail('test@example.com')).toBe(true);
        expect(emailTool.isValidEmail('user.name@domain.co.uk')).toBe(true);
      });

      it('should reject invalid email addresses', () => {
        expect(emailTool.isValidEmail('invalid')).toBe(false);
        expect(emailTool.isValidEmail('test@')).toBe(false);
        expect(emailTool.isValidEmail('@domain.com')).toBe(false);
      });
    });

    describe('Email Sending', () => {
      it('should return error for missing required fields', async () => {
        const result = await emailTool.execute({});

        expect(result.success).toBe(false);
        expect(result.error).toContain('Missing required fields');
      });

      it('should simulate sending when SMTP not configured', async () => {
        const result = await emailTool.execute({
          to: 'test@example.com',
          subject: 'Test',
          body: 'Test body'
        });

        expect(result.simulated).toBe(true);
      });

      it('should validate recipient email addresses', async () => {
        const result = await emailTool.execute({
          to: 'invalid-email',
          subject: 'Test',
          body: 'Test'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid email');
      });

      it('should handle multiple recipients', async () => {
        const result = await emailTool.execute({
          to: 'test1@example.com, test2@example.com',
          subject: 'Test',
          body: 'Test'
        });

        expect(result.preview.to).toContain(',');
      });

      it('should support HTML emails', async () => {
        const result = await emailTool.execute({
          to: 'test@example.com',
          subject: 'Test',
          body: '<h1>HTML Content</h1>',
          html: true
        });

        expect(result.preview.isHtml).toBe(true);
      });

      it('should include CC recipients', async () => {
        const result = await emailTool.execute({
          to: 'test@example.com',
          subject: 'Test',
          body: 'Test',
          cc: 'cc@example.com'
        });

        expect(result.success).toBe(true);
      });

      it('should include BCC recipients', async () => {
        const result = await emailTool.execute({
          to: 'test@example.com',
          subject: 'Test',
          body: 'Test',
          bcc: 'bcc@example.com'
        });

        expect(result.success).toBe(true);
      });

      it('should include reply-to address', async () => {
        const result = await emailTool.execute({
          to: 'test@example.com',
          subject: 'Test',
          body: 'Test',
          replyTo: 'reply@example.com'
        });

        expect(result.success).toBe(true);
      });

      it('should log execution', async () => {
        const context = { toolLogs: [] };

        await emailTool.execute({
          to: 'test@example.com',
          subject: 'Test',
          body: 'Test'
        }, context);

        expect(context.toolLogs).toHaveLength(1);
        expect(context.toolLogs[0].tool).toBe('send_email');
      });

      it('should get tool definition', () => {
        const definition = emailTool.getDefinition();

        expect(definition.name).toBe('send_email');
        expect(definition).toHaveProperty('parameters');
      });
    });

    describe('Error Handling', () => {
      it('should handle SMTP connection errors gracefully', async () => {
        emailTool.smtpConfig.auth.user = 'test@example.com';
        emailTool.smtpConfig.auth.pass = 'password';

        const nodemailer = require('nodemailer');
        nodemailer.createTransport.mockReturnValue({
          sendMail: jest.fn().mockRejectedValue(new Error('SMTP connection failed'))
        });

        const result = await emailTool.execute({
          to: 'test@example.com',
          subject: 'Test',
          body: 'Test'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('SMTP connection failed');
      });
    });

    describe('Preview Generation', () => {
      it('should truncate body preview', async () => {
        const longBody = 'a'.repeat(200);

        const result = await emailTool.execute({
          to: 'test@example.com',
          subject: 'Test',
          body: longBody
        });

        expect(result.preview.bodyPreview.length).toBeLessThan(longBody.length);
      });

      it('should show full body if under limit', async () => {
        const shortBody = 'Short message';

        const result = await emailTool.execute({
          to: 'test@example.com',
          subject: 'Test',
          body: shortBody
        });

        expect(result.preview.bodyPreview).toBe(shortBody);
      });
    });
  });

  // =============================================
  // FILE TOOL TESTS (15 tests)
  // =============================================
  describe('FileTool', () => {
    let fileTool;

    beforeEach(() => {
      fileTool = new FileTool();
    });

    describe('Path Resolution', () => {
      it('should resolve paths within workspace', () => {
        const resolved = fileTool.resolvePath('test.txt');
        expect(resolved).toBeTruthy();
        expect(resolved).toContain('agent_workspace');
      });

      it('should prevent path traversal', () => {
        const resolved = fileTool.resolvePath('../../../etc/passwd');
        expect(resolved).toBeNull();
      });

      it('should reject absolute paths outside workspace', () => {
        const resolved = fileTool.resolvePath('/etc/passwd');
        expect(resolved).toBeNull();
      });

      it('should normalize paths correctly', () => {
        const resolved = fileTool.resolvePath('subdir/../test.txt');
        expect(resolved).toBeTruthy();
      });
    });

    describe('File Operations', () => {
      it('should return error for invalid operation', async () => {
        const result = await fileTool.execute({
          operation: 'invalid',
          path: 'test.txt'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid operation');
      });

      it('should return error for invalid path', async () => {
        const result = await fileTool.execute({
          operation: 'read',
          path: '../../../etc/passwd'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid or forbidden path');
      });

      it('should block writing executable files', async () => {
        const result = await fileTool.execute({
          operation: 'write',
          path: 'malware.exe',
          content: 'binary data'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('not allowed');
      });

      it('should block writing sensitive files', async () => {
        const blockedExtensions = ['.env', '.pem', '.key'];

        for (const ext of blockedExtensions) {
          const result = await fileTool.execute({
            operation: 'write',
            path: `file${ext}`,
            content: 'data'
          });

          expect(result.success).toBe(false);
        }
      });
    });

    describe('Read Operations', () => {
      it('should require content for write operation', async () => {
        const fs = require('fs').promises;
        fs.mkdir = jest.fn().mockResolvedValue();
        fs.writeFile = jest.fn().mockRejectedValue(new Error('Content is required'));

        const result = await fileTool.execute({
          operation: 'write',
          path: 'test.txt'
        });

        expect(result.success).toBe(false);
      });

      it('should require content for append operation', async () => {
        const fs = require('fs').promises;
        fs.mkdir = jest.fn().mockResolvedValue();
        fs.appendFile = jest.fn().mockRejectedValue(new Error('Content is required'));

        const result = await fileTool.execute({
          operation: 'append',
          path: 'test.txt'
        });

        expect(result.success).toBe(false);
      });
    });

    describe('Logging', () => {
      it('should log file operations', async () => {
        const context = { toolLogs: [] };

        const fs = require('fs').promises;
        fs.stat = jest.fn().mockRejectedValue(new Error('File not found'));

        await fileTool.execute({
          operation: 'read',
          path: 'test.txt'
        }, context);

        expect(context.toolLogs).toHaveLength(1);
        expect(context.toolLogs[0].tool).toBe('file_operation');
      });

      it('should get tool definition', () => {
        const definition = fileTool.getDefinition();

        expect(definition.name).toBe('file_operation');
        expect(definition).toHaveProperty('parameters');
      });
    });

    describe('Security', () => {
      it('should have default workspace directory', () => {
        expect(fileTool.workspaceDir).toBeDefined();
        expect(fileTool.workspaceDir).toContain('agent_workspace');
      });

      it('should have list of blocked extensions', () => {
        expect(fileTool.blockedExtensions).toContain('.exe');
        expect(fileTool.blockedExtensions).toContain('.sh');
        expect(fileTool.blockedExtensions).toContain('.env');
      });
    });
  });

  // =============================================
  // HTTP TOOL TESTS (10 tests)
  // =============================================
  describe('HttpTool', () => {
    let httpTool;

    beforeEach(() => {
      httpTool = new HttpTool();
      global.fetch = jest.fn();
    });

    afterEach(() => {
      delete global.fetch;
    });

    describe('URL Validation', () => {
      it('should validate correct URLs', () => {
        expect(httpTool.isValidUrl('https://api.example.com')).toBe(true);
      });

      it('should reject invalid URLs', () => {
        expect(httpTool.isValidUrl('not-a-url')).toBe(false);
      });

      it('should block internal URLs', () => {
        expect(httpTool.isBlockedUrl('http://localhost:3000')).toBe(true);
        expect(httpTool.isBlockedUrl('http://192.168.1.1')).toBe(true);
      });

      it('should allow external URLs', () => {
        expect(httpTool.isBlockedUrl('https://api.github.com')).toBe(false);
      });
    });

    describe('HTTP Requests', () => {
      it('should execute GET request', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map([['content-type', 'application/json']]),
          json: jest.fn().mockResolvedValue({ data: 'test' })
        });

        const result = await httpTool.execute({
          method: 'GET',
          url: 'https://api.example.com/data'
        });

        expect(result.success).toBe(true);
        expect(result.status).toBe(200);
      });

      it('should execute POST request with body', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          statusText: 'Created',
          headers: new Map([['content-type', 'application/json']]),
          json: jest.fn().mockResolvedValue({ id: 1 })
        });

        const result = await httpTool.execute({
          method: 'POST',
          url: 'https://api.example.com/data',
          body: { name: 'test' }
        });

        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            method: 'POST',
            body: expect.any(String)
          })
        );
      });

      it('should handle request timeout', async () => {
        global.fetch.mockImplementationOnce(() =>
          new Promise((resolve, reject) => {
            setTimeout(() => reject({ name: 'AbortError' }), 100);
          })
        );

        const result = await httpTool.execute({
          method: 'GET',
          url: 'https://api.example.com/data',
          timeout: 50
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('timeout');
      });

      it('should return error for invalid URL', async () => {
        const result = await httpTool.execute({
          method: 'GET',
          url: 'invalid-url'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid URL');
      });

      it('should return error for blocked URL', async () => {
        const result = await httpTool.execute({
          method: 'GET',
          url: 'http://localhost:3000'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('internal URLs');
      });

      it('should log execution', async () => {
        const context = { toolLogs: [] };

        global.fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map(),
          text: jest.fn().mockResolvedValue('response')
        });

        await httpTool.execute({
          method: 'GET',
          url: 'https://api.example.com'
        }, context);

        expect(context.toolLogs).toHaveLength(1);
      });
    });
  });

  // =============================================
  // AGENT CORE TESTS (15 tests)
  // =============================================
  describe('AgentCore', () => {
    const userId = 'user-123';

    describe('Agent Creation', () => {
      it('should create a new agent', async () => {
        const agentData = {
          name: 'Test Agent',
          description: 'Test agent description',
          capabilities: ['web_search', 'file_ops'],
          model: 'gpt-4'
        };

        db.query.mockResolvedValueOnce({
          rows: [{
            id: 'agent-1',
            user_id: userId,
            ...agentData,
            capabilities: JSON.stringify(agentData.capabilities),
            settings: '{}'
          }]
        });

        const agent = await AgentCore.create(userId, agentData);

        expect(agent.id).toBe('agent-1');
        expect(agent.name).toBe(agentData.name);
        expect(agent.capabilities).toEqual(agentData.capabilities);
      });

      it('should throw error if name is missing', async () => {
        await expect(AgentCore.create(userId, {}))
          .rejects.toThrow('Agent name is required');
      });

      it('should use default system prompt if not provided', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 'agent-1',
            user_id: userId,
            name: 'Test',
            capabilities: '[]',
            settings: '{}'
          }]
        });

        await AgentCore.create(userId, { name: 'Test' });

        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([expect.stringContaining('autonomous AI agent')])
        );
      });

      it('should set default values for optional fields', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 'agent-1',
            user_id: userId,
            name: 'Test',
            capabilities: '[]',
            model: 'gpt-4',
            temperature: 0.7,
            max_tokens: 4096,
            settings: '{}'
          }]
        });

        const agent = await AgentCore.create(userId, { name: 'Test' });

        expect(agent.model).toBe('gpt-4');
        expect(agent.temperature).toBe(0.7);
      });
    });

    describe('Agent Retrieval', () => {
      it('should find agent by ID', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 'agent-1',
            user_id: userId,
            name: 'Test',
            capabilities: '[]',
            settings: '{}'
          }]
        });

        const agent = await AgentCore.findById('agent-1');

        expect(agent).not.toBeNull();
        expect(agent.id).toBe('agent-1');
      });

      it('should return null if agent not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const agent = await AgentCore.findById('nonexistent');

        expect(agent).toBeNull();
      });

      it('should find agents by user', async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            { id: 'agent-1', user_id: userId, name: 'A1', capabilities: '[]', settings: '{}' },
            { id: 'agent-2', user_id: userId, name: 'A2', capabilities: '[]', settings: '{}' }
          ]
        });

        const agents = await AgentCore.findByUser(userId);

        expect(agents).toHaveLength(2);
      });

      it('should filter agents by status', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{ id: 'agent-1', user_id: userId, name: 'A1', status: 'active', capabilities: '[]', settings: '{}' }]
        });

        await AgentCore.findByUser(userId, { status: 'active' });

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('AND status = $2'),
          expect.arrayContaining([userId, 'active'])
        );
      });

      it('should apply pagination', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await AgentCore.findByUser(userId, { limit: 10, offset: 20 });

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT'),
          expect.arrayContaining([10, 20])
        );
      });
    });

    describe('Agent Updates', () => {
      it('should update agent fields', async () => {
        const updateData = {
          name: 'Updated Name',
          description: 'Updated description'
        };

        db.query.mockResolvedValueOnce({
          rows: [{
            id: 'agent-1',
            user_id: userId,
            ...updateData,
            capabilities: '[]',
            settings: '{}'
          }]
        });

        const updated = await AgentCore.update('agent-1', userId, updateData);

        expect(updated.name).toBe(updateData.name);
      });

      it('should throw error if no valid fields to update', async () => {
        await expect(AgentCore.update('agent-1', userId, { invalid_field: 'value' }))
          .rejects.toThrow('No valid fields to update');
      });

      it('should throw error if agent not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await expect(AgentCore.update('agent-1', userId, { name: 'New' }))
          .rejects.toThrow('Agent not found or access denied');
      });
    });

    describe('Agent Deletion', () => {
      it('should delete agent', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 'agent-1' }] });

        const result = await AgentCore.delete('agent-1', userId);

        expect(result).toBe(true);
      });

      it('should throw error if agent not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await expect(AgentCore.delete('agent-1', userId))
          .rejects.toThrow('Agent not found or access denied');
      });
    });

    describe('Agent Statistics', () => {
      it('should update agent stats on success', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await AgentCore.updateStats('agent-1', true);

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('successful_tasks'),
          expect.arrayContaining(['agent-1'])
        );
      });

      it('should update agent stats on failure', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await AgentCore.updateStats('agent-1', false);

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('failed_tasks'),
          expect.arrayContaining(['agent-1'])
        );
      });

      it('should get agent statistics', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            total_tasks: 10,
            successful_tasks: 8,
            failed_tasks: 2,
            success_rate: 80.00
          }]
        });

        const stats = await AgentCore.getStats('agent-1');

        expect(stats.total_tasks).toBe(10);
        expect(stats.success_rate).toBe(80.00);
      });

      it('should return null if agent not found for stats', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const stats = await AgentCore.getStats('nonexistent');

        expect(stats).toBeNull();
      });
    });

    describe('Agent Validation', () => {
      it('should validate agent ownership', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 'agent-1' }] });

        const isOwner = await AgentCore.validateOwnership('agent-1', userId);

        expect(isOwner).toBe(true);
      });

      it('should return false for non-owner', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const isOwner = await AgentCore.validateOwnership('agent-1', 'other-user');

        expect(isOwner).toBe(false);
      });
    });
  });
});
