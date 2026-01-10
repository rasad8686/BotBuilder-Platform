/**
 * Autonomous Routes Comprehensive Integration Tests
 * Covers: Agents, Tasks, Tools, Templates, Scheduling, Analytics, Memory, Workflows
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
});

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock AgentCore
const mockAgentCore = {
  create: jest.fn(),
  findByUser: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getStats: jest.fn(),
  validateOwnership: jest.fn()
};
jest.mock('../../services/autonomous/AgentCore', () => mockAgentCore);

// Mock TaskExecutor
const mockExecute = jest.fn().mockResolvedValue({ result: 'done' });
const MockTaskExecutor = jest.fn().mockImplementation(() => ({
  execute: mockExecute
}));
MockTaskExecutor.createTask = jest.fn();
MockTaskExecutor.getTasksByAgent = jest.fn();
MockTaskExecutor.getTask = jest.fn();
MockTaskExecutor.getTaskSteps = jest.fn();
MockTaskExecutor.cancelTask = jest.fn();
MockTaskExecutor.retryTask = jest.fn();
jest.mock('../../services/autonomous/TaskExecutor', () => MockTaskExecutor);

// Mock ToolRegistry
const mockToolRegistry = {
  getAll: jest.fn().mockReturnValue([
    { name: 'web_scraper', description: 'Scrape web pages', parameters: {} },
    { name: 'api_call', description: 'Make API calls', parameters: {} }
  ])
};
jest.mock('../../services/autonomous/ToolRegistry', () => mockToolRegistry);

// Mock AgentOrchestrator
const MockAgentOrchestrator = jest.fn().mockImplementation(() => ({
  createWorkflow: jest.fn().mockResolvedValue({ id: 1, name: 'Workflow' }),
  getWorkflows: jest.fn().mockResolvedValue([{ id: 1, name: 'Workflow' }]),
  getWorkflow: jest.fn(),
  executeWorkflow: jest.fn().mockResolvedValue({ result: 'done' }),
  deleteWorkflow: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../services/autonomous/AgentOrchestrator', () => MockAgentOrchestrator);

// Mock AgentMemory
const MockAgentMemory = jest.fn().mockImplementation(() => ({
  store: jest.fn().mockResolvedValue({ id: 1 }),
  retrieve: jest.fn().mockResolvedValue([]),
  getStats: jest.fn().mockResolvedValue({ totalMemories: 100 }),
  loadShortTermMemory: jest.fn().mockResolvedValue(true),
  consolidate: jest.fn().mockResolvedValue(10)
}));
jest.mock('../../services/autonomous/AgentMemory', () => MockAgentMemory);

// Mock AgentScheduler
const mockSchedulerInstance = {
  createSchedule: jest.fn(),
  getUserSchedules: jest.fn(),
  getUpcoming: jest.fn(),
  trigger: jest.fn(),
  pauseSchedule: jest.fn(),
  resumeSchedule: jest.fn(),
  deleteSchedule: jest.fn()
};
jest.mock('../../services/autonomous/AgentScheduler', () => ({
  instance: mockSchedulerInstance
}));

// Mock AgentAnalytics
const mockAnalyticsInstance = {
  getAgentPerformance: jest.fn().mockResolvedValue({}),
  getExecutionTrends: jest.fn().mockResolvedValue([]),
  getToolStats: jest.fn().mockResolvedValue({}),
  getErrorAnalysis: jest.fn().mockResolvedValue([]),
  getAlerts: jest.fn().mockResolvedValue([]),
  generateReport: jest.fn().mockResolvedValue({}),
  getRealTimeMetrics: jest.fn().mockResolvedValue({}),
  getSuggestions: jest.fn().mockResolvedValue([])
};
jest.mock('../../services/autonomous/AgentAnalytics', () => ({
  instance: mockAnalyticsInstance
}));

// Mock AgentTemplates
const mockAgentTemplates = {
  getAll: jest.fn().mockReturnValue([{ id: 'research', name: 'Research Agent' }]),
  getById: jest.fn(),
  getByCategory: jest.fn().mockReturnValue([]),
  search: jest.fn().mockReturnValue([]),
  getCategories: jest.fn().mockReturnValue(['productivity', 'research']),
  createAgentConfig: jest.fn().mockReturnValue({ name: 'Agent', description: 'Created from template' }),
  getWorkflowTemplates: jest.fn().mockReturnValue([])
};
jest.mock('../../services/autonomous/AgentTemplates', () => mockAgentTemplates);

const autonomousRouter = require('../../routes/autonomous');

describe('Autonomous Routes Comprehensive Tests', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/autonomous', autonomousRouter);

    // Reset default mock implementations
    mockAgentCore.findById.mockResolvedValue({ id: 1, name: 'Test Agent', user_id: 1 });
    mockAgentCore.validateOwnership.mockResolvedValue(true);
    mockAgentCore.getStats.mockResolvedValue({ totalTasks: 10, successRate: 0.9 });
    mockAgentCore.create.mockResolvedValue({ id: 1, name: 'Test Agent' });
    mockAgentCore.findByUser.mockResolvedValue([{ id: 1, name: 'Agent 1' }]);
    mockAgentCore.update.mockResolvedValue({ id: 1, name: 'Updated Agent' });
    mockAgentCore.delete.mockResolvedValue(true);

    MockTaskExecutor.createTask.mockResolvedValue({ id: 1, status: 'pending' });
    MockTaskExecutor.getTasksByAgent.mockResolvedValue([{ id: 1, status: 'completed' }]);
    MockTaskExecutor.getTask.mockResolvedValue({ id: 1, agent_id: 1, status: 'completed' });
    MockTaskExecutor.getTaskSteps.mockResolvedValue([{ id: 1, step_number: 1 }]);
  });

  // ==========================================
  // AGENT CRUD - Extended Tests
  // ==========================================
  describe('Agent CRUD - Extended', () => {
    describe('POST /api/autonomous/agents', () => {
      it('should create agent with all fields', async () => {
        mockAgentCore.create.mockResolvedValueOnce({
          id: 1,
          name: 'Full Agent',
          description: 'Description',
          capabilities: ['web', 'api'],
          model: 'gpt-4',
          temperature: 0.7
        });

        const res = await request(app)
          .post('/api/autonomous/agents')
          .send({
            name: 'Full Agent',
            description: 'Description',
            capabilities: ['web', 'api'],
            model: 'gpt-4',
            temperature: 0.7,
            max_tokens: 2000,
            system_prompt: 'You are a helpful agent',
            settings: { autoRetry: true }
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(mockAgentCore.create).toHaveBeenCalledWith(1, expect.objectContaining({
          name: 'Full Agent',
          description: 'Description'
        }));
      });

      it('should require name', async () => {
        const res = await request(app)
          .post('/api/autonomous/agents')
          .send({ description: 'No name' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('name');
      });

      it('should handle creation error', async () => {
        mockAgentCore.create.mockRejectedValueOnce(new Error('DB error'));

        const res = await request(app)
          .post('/api/autonomous/agents')
          .send({ name: 'Test' });

        expect(res.status).toBe(500);
      });
    });

    describe('GET /api/autonomous/agents', () => {
      it('should return agents with pagination', async () => {
        mockAgentCore.findByUser.mockResolvedValueOnce([
          { id: 1, name: 'Agent 1' },
          { id: 2, name: 'Agent 2' }
        ]);

        const res = await request(app).get('/api/autonomous/agents?limit=10&offset=0&status=active');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.agents).toHaveLength(2);
        expect(res.body.count).toBe(2);
      });

      it('should handle database error', async () => {
        mockAgentCore.findByUser.mockRejectedValueOnce(new Error('DB error'));

        const res = await request(app).get('/api/autonomous/agents');

        expect(res.status).toBe(500);
      });
    });

    describe('GET /api/autonomous/agents/:id', () => {
      it('should return agent with stats', async () => {
        const res = await request(app).get('/api/autonomous/agents/1');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.agent).toBeDefined();
        expect(res.body.agent.stats).toBeDefined();
      });

      it('should return 404 for non-existent agent', async () => {
        mockAgentCore.findById.mockResolvedValueOnce(null);

        const res = await request(app).get('/api/autonomous/agents/999');

        expect(res.status).toBe(404);
      });

      it('should return 403 for non-owner', async () => {
        mockAgentCore.findById.mockResolvedValueOnce({ id: 1, user_id: 999 });

        const res = await request(app).get('/api/autonomous/agents/1');

        expect(res.status).toBe(403);
      });

      it('should handle database error', async () => {
        mockAgentCore.findById.mockRejectedValueOnce(new Error('DB error'));

        const res = await request(app).get('/api/autonomous/agents/1');

        expect(res.status).toBe(500);
      });
    });

    describe('PUT /api/autonomous/agents/:id', () => {
      it('should update agent', async () => {
        const res = await request(app)
          .put('/api/autonomous/agents/1')
          .send({ name: 'Updated Name', description: 'Updated description' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mockAgentCore.update).toHaveBeenCalledWith(1, 1, expect.objectContaining({
          name: 'Updated Name'
        }));
      });

      it('should handle update error', async () => {
        mockAgentCore.update.mockRejectedValueOnce(new Error('Update failed'));

        const res = await request(app)
          .put('/api/autonomous/agents/1')
          .send({ name: 'Updated' });

        expect(res.status).toBe(500);
      });
    });

    describe('DELETE /api/autonomous/agents/:id', () => {
      it('should delete agent', async () => {
        const res = await request(app).delete('/api/autonomous/agents/1');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('deleted');
      });

      it('should handle delete error', async () => {
        mockAgentCore.delete.mockRejectedValueOnce(new Error('Delete failed'));

        const res = await request(app).delete('/api/autonomous/agents/1');

        expect(res.status).toBe(500);
      });
    });
  });

  // ==========================================
  // TASKS - Extended Tests
  // ==========================================
  describe('Tasks - Extended', () => {
    describe('POST /api/autonomous/agents/:id/tasks', () => {
      it('should create and execute task immediately', async () => {
        const res = await request(app)
          .post('/api/autonomous/agents/1/tasks')
          .send({ task_description: 'Do something', input_data: { key: 'value' } });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.task.status).toBe('running');
        expect(res.body.message).toContain('execution started');
      });

      it('should create task without execution', async () => {
        const res = await request(app)
          .post('/api/autonomous/agents/1/tasks')
          .send({ task_description: 'Do something', execute_now: false });

        expect(res.status).toBe(201);
        expect(res.body.message).toContain('not executed');
      });

      it('should require task_description', async () => {
        const res = await request(app)
          .post('/api/autonomous/agents/1/tasks')
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Task description');
      });

      it('should return 404 for non-existent agent', async () => {
        mockAgentCore.findById.mockResolvedValueOnce(null);

        const res = await request(app)
          .post('/api/autonomous/agents/999/tasks')
          .send({ task_description: 'Test' });

        expect(res.status).toBe(404);
      });

      it('should return 403 for non-owner', async () => {
        mockAgentCore.findById.mockResolvedValueOnce({ id: 1, user_id: 999 });

        const res = await request(app)
          .post('/api/autonomous/agents/1/tasks')
          .send({ task_description: 'Test' });

        expect(res.status).toBe(403);
      });

      it('should handle task creation error', async () => {
        MockTaskExecutor.createTask.mockRejectedValueOnce(new Error('Task creation failed'));

        const res = await request(app)
          .post('/api/autonomous/agents/1/tasks')
          .send({ task_description: 'Test' });

        expect(res.status).toBe(500);
      });
    });

    describe('GET /api/autonomous/agents/:id/tasks', () => {
      it('should return tasks with filters', async () => {
        MockTaskExecutor.getTasksByAgent.mockResolvedValueOnce([
          { id: 1, status: 'completed' },
          { id: 2, status: 'completed' }
        ]);

        const res = await request(app).get('/api/autonomous/agents/1/tasks?status=completed&limit=10&offset=0');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.tasks).toHaveLength(2);
      });

      it('should return 403 if not owner', async () => {
        mockAgentCore.validateOwnership.mockResolvedValueOnce(false);

        const res = await request(app).get('/api/autonomous/agents/1/tasks');

        expect(res.status).toBe(403);
      });

      it('should handle database error', async () => {
        MockTaskExecutor.getTasksByAgent.mockRejectedValueOnce(new Error('DB error'));

        const res = await request(app).get('/api/autonomous/agents/1/tasks');

        expect(res.status).toBe(500);
      });
    });

    describe('GET /api/autonomous/tasks/:id', () => {
      it('should return task details', async () => {
        const res = await request(app).get('/api/autonomous/tasks/1');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.task).toBeDefined();
      });

      it('should return 404 for non-existent task', async () => {
        MockTaskExecutor.getTask.mockResolvedValueOnce(null);

        const res = await request(app).get('/api/autonomous/tasks/999');

        expect(res.status).toBe(404);
      });

      it('should return 403 if not owner', async () => {
        MockTaskExecutor.getTask.mockResolvedValueOnce({ id: 1, agent_id: 1 });
        mockAgentCore.validateOwnership.mockResolvedValueOnce(false);

        const res = await request(app).get('/api/autonomous/tasks/1');

        expect(res.status).toBe(403);
      });
    });

    describe('GET /api/autonomous/tasks/:id/steps', () => {
      it('should return task steps', async () => {
        MockTaskExecutor.getTask.mockResolvedValueOnce({ id: 1, agent_id: 1, status: 'completed' });
        MockTaskExecutor.getTaskSteps.mockResolvedValueOnce([
          { id: 1, step_number: 1, action: 'fetch' },
          { id: 2, step_number: 2, action: 'process' }
        ]);

        const res = await request(app).get('/api/autonomous/tasks/1/steps');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.steps).toHaveLength(2);
        expect(res.body.task_status).toBe('completed');
      });

      it('should return 404 for non-existent task', async () => {
        MockTaskExecutor.getTask.mockResolvedValueOnce(null);

        const res = await request(app).get('/api/autonomous/tasks/999/steps');

        expect(res.status).toBe(404);
      });
    });

    describe('POST /api/autonomous/tasks/:id/execute', () => {
      it('should execute pending task', async () => {
        MockTaskExecutor.getTask.mockResolvedValueOnce({ id: 1, agent_id: 1, status: 'pending' });

        const res = await request(app).post('/api/autonomous/tasks/1/execute');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('execution started');
      });

      it('should return 404 for non-existent task', async () => {
        MockTaskExecutor.getTask.mockResolvedValueOnce(null);

        const res = await request(app).post('/api/autonomous/tasks/999/execute');

        expect(res.status).toBe(404);
      });

      it('should reject non-pending task', async () => {
        MockTaskExecutor.getTask.mockResolvedValueOnce({ id: 1, agent_id: 1, status: 'completed' });

        const res = await request(app).post('/api/autonomous/tasks/1/execute');

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('cannot be executed');
      });
    });
  });

  // ==========================================
  // TOOLS
  // ==========================================
  describe('Tools', () => {
    describe('GET /api/autonomous/tools', () => {
      it('should return available tools', async () => {
        const res = await request(app).get('/api/autonomous/tools');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.tools).toHaveLength(2);
        expect(res.body.count).toBe(2);
      });

      it('should handle error', async () => {
        mockToolRegistry.getAll.mockImplementationOnce(() => { throw new Error('Error'); });

        const res = await request(app).get('/api/autonomous/tools');

        expect(res.status).toBe(500);
      });
    });
  });

  // ==========================================
  // TEMPLATES
  // ==========================================
  describe('Templates', () => {
    describe('GET /api/autonomous/templates', () => {
      it('should return all templates', async () => {
        const res = await request(app).get('/api/autonomous/templates');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.templates).toBeDefined();
        expect(res.body.categories).toBeDefined();
      });

      it('should filter by category', async () => {
        mockAgentTemplates.getByCategory.mockReturnValueOnce([{ id: 'research', name: 'Research' }]);

        const res = await request(app).get('/api/autonomous/templates?category=research');

        expect(res.status).toBe(200);
        expect(mockAgentTemplates.getByCategory).toHaveBeenCalledWith('research');
      });

      it('should search templates', async () => {
        mockAgentTemplates.search.mockReturnValueOnce([{ id: 'web', name: 'Web Scraper' }]);

        const res = await request(app).get('/api/autonomous/templates?search=web');

        expect(res.status).toBe(200);
        expect(mockAgentTemplates.search).toHaveBeenCalledWith('web');
      });
    });

    describe('GET /api/autonomous/templates/:id', () => {
      it('should return template', async () => {
        mockAgentTemplates.getById.mockReturnValueOnce({ id: 'research', name: 'Research Agent' });

        const res = await request(app).get('/api/autonomous/templates/research');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.template).toBeDefined();
      });

      it('should return 404 for non-existent template', async () => {
        mockAgentTemplates.getById.mockReturnValueOnce(null);

        const res = await request(app).get('/api/autonomous/templates/nonexistent');

        expect(res.status).toBe(404);
      });
    });

    describe('POST /api/autonomous/templates/:id/create', () => {
      it('should create agent from template', async () => {
        mockAgentTemplates.getById.mockReturnValueOnce({ id: 'research', name: 'Research' });
        mockAgentCore.create.mockResolvedValueOnce({ id: 1, name: 'My Research Agent' });

        const res = await request(app)
          .post('/api/autonomous/templates/research/create')
          .send({ name: 'My Research Agent' });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('template');
      });

      it('should handle template not found', async () => {
        mockAgentTemplates.createAgentConfig.mockImplementationOnce(() => {
          throw new Error('Template not found');
        });

        const res = await request(app)
          .post('/api/autonomous/templates/nonexistent/create')
          .send({});

        expect(res.status).toBe(500);
      });
    });

    describe('GET /api/autonomous/templates/workflows', () => {
      it('should return workflow templates', async () => {
        mockAgentTemplates.getWorkflowTemplates.mockReturnValueOnce([
          { id: 'pipeline', name: 'Data Pipeline' }
        ]);

        const res = await request(app).get('/api/autonomous/templates/workflows');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.workflows).toBeDefined();
      });
    });
  });

  // ==========================================
  // SCHEDULING
  // ==========================================
  describe('Scheduling', () => {
    describe('POST /api/autonomous/schedules', () => {
      it('should create schedule', async () => {
        mockSchedulerInstance.createSchedule.mockResolvedValueOnce({
          id: 1,
          cron: '0 * * * *'
        });

        const res = await request(app)
          .post('/api/autonomous/schedules')
          .send({
            agentId: 1,
            taskDescription: 'Hourly task',
            scheduleType: 'cron',
            scheduleConfig: { cron: '0 * * * *' }
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
      });

      it('should require agentId and taskDescription', async () => {
        const res = await request(app)
          .post('/api/autonomous/schedules')
          .send({});

        expect(res.status).toBe(400);
      });

      it('should validate ownership', async () => {
        mockAgentCore.validateOwnership.mockResolvedValueOnce(false);

        const res = await request(app)
          .post('/api/autonomous/schedules')
          .send({ agentId: 1, taskDescription: 'Task' });

        expect(res.status).toBe(403);
      });
    });

    describe('GET /api/autonomous/schedules', () => {
      it('should return user schedules', async () => {
        mockSchedulerInstance.getUserSchedules.mockResolvedValueOnce([
          { id: 1, cron: '0 * * * *' }
        ]);

        const res = await request(app).get('/api/autonomous/schedules?status=active&limit=20');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.schedules).toBeDefined();
      });
    });

    describe('GET /api/autonomous/schedules/upcoming', () => {
      it('should return upcoming schedules', async () => {
        mockSchedulerInstance.getUpcoming.mockResolvedValueOnce([
          { id: 1, nextRun: new Date() }
        ]);

        const res = await request(app).get('/api/autonomous/schedules/upcoming?limit=5');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });
    });

    describe('POST /api/autonomous/schedules/:id/trigger', () => {
      it('should trigger schedule', async () => {
        mockSchedulerInstance.trigger.mockResolvedValueOnce({ id: 1 });

        const res = await request(app)
          .post('/api/autonomous/schedules/1/trigger')
          .send({ additionalData: 'value' });

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('triggered');
      });
    });

    describe('PUT /api/autonomous/schedules/:id/pause', () => {
      it('should pause schedule', async () => {
        mockSchedulerInstance.pauseSchedule.mockResolvedValueOnce({ id: 1, is_active: false });

        const res = await request(app).put('/api/autonomous/schedules/1/pause');

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('paused');
      });
    });

    describe('PUT /api/autonomous/schedules/:id/resume', () => {
      it('should resume schedule', async () => {
        mockSchedulerInstance.resumeSchedule.mockResolvedValueOnce({ id: 1, is_active: true });

        const res = await request(app).put('/api/autonomous/schedules/1/resume');

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('resumed');
      });
    });

    describe('DELETE /api/autonomous/schedules/:id', () => {
      it('should delete schedule', async () => {
        mockSchedulerInstance.deleteSchedule.mockResolvedValueOnce(true);

        const res = await request(app).delete('/api/autonomous/schedules/1');

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('deleted');
      });
    });
  });

  // ==========================================
  // ANALYTICS
  // ==========================================
  describe('Analytics', () => {
    describe('GET /api/autonomous/agents/:id/analytics', () => {
      it('should return agent analytics', async () => {
        const res = await request(app).get('/api/autonomous/agents/1/analytics?days=30');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.analytics).toBeDefined();
        expect(res.body.analytics.performance).toBeDefined();
        expect(res.body.analytics.trends).toBeDefined();
        expect(res.body.analytics.tools).toBeDefined();
        expect(res.body.analytics.errors).toBeDefined();
        expect(res.body.analytics.alerts).toBeDefined();
      });

      it('should return 403 if not owner', async () => {
        mockAgentCore.validateOwnership.mockResolvedValueOnce(false);

        const res = await request(app).get('/api/autonomous/agents/1/analytics');

        expect(res.status).toBe(403);
      });
    });

    describe('GET /api/autonomous/agents/:id/analytics/report', () => {
      it('should generate report', async () => {
        const res = await request(app).get('/api/autonomous/agents/1/analytics/report?days=7');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.report).toBeDefined();
      });
    });

    describe('GET /api/autonomous/agents/:id/analytics/realtime', () => {
      it('should return realtime metrics', async () => {
        const res = await request(app).get('/api/autonomous/agents/1/analytics/realtime');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.metrics).toBeDefined();
      });
    });

    describe('GET /api/autonomous/agents/:id/suggestions', () => {
      it('should return optimization suggestions', async () => {
        mockAnalyticsInstance.getSuggestions.mockResolvedValueOnce([
          { type: 'performance', message: 'Consider reducing timeout' }
        ]);

        const res = await request(app).get('/api/autonomous/agents/1/suggestions');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.suggestions).toBeDefined();
      });
    });
  });

  // ==========================================
  // MEMORY
  // ==========================================
  describe('Memory', () => {
    describe('GET /api/autonomous/agents/:id/memory', () => {
      it('should return memory stats and recent', async () => {
        const res = await request(app).get('/api/autonomous/agents/1/memory');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.stats).toBeDefined();
        expect(res.body.recent).toBeDefined();
      });

      it('should return 403 if not owner', async () => {
        mockAgentCore.validateOwnership.mockResolvedValueOnce(false);

        const res = await request(app).get('/api/autonomous/agents/1/memory');

        expect(res.status).toBe(403);
      });
    });

    describe('POST /api/autonomous/agents/:id/memory', () => {
      it('should store memory', async () => {
        const res = await request(app)
          .post('/api/autonomous/agents/1/memory')
          .send({
            content: 'Important fact',
            type: 'fact',
            importance: 0.8,
            tags: ['important'],
            metadata: { source: 'user' }
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.memory).toBeDefined();
      });

      it('should require content', async () => {
        const res = await request(app)
          .post('/api/autonomous/agents/1/memory')
          .send({});

        expect(res.status).toBe(400);
      });
    });

    describe('GET /api/autonomous/agents/:id/memory/search', () => {
      it('should search memories', async () => {
        const memoryInstance = new MockAgentMemory();
        memoryInstance.retrieve.mockResolvedValueOnce([
          { id: 1, content: 'Found memory' }
        ]);

        const res = await request(app).get('/api/autonomous/agents/1/memory/search?query=test&type=fact&limit=10&tags=important,urgent');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.memories).toBeDefined();
      });
    });

    describe('POST /api/autonomous/agents/:id/memory/consolidate', () => {
      it('should consolidate memory', async () => {
        const res = await request(app).post('/api/autonomous/agents/1/memory/consolidate');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('Consolidated');
      });
    });
  });

  // ==========================================
  // WORKFLOWS
  // ==========================================
  describe('Workflows', () => {
    describe('POST /api/autonomous/workflows', () => {
      it('should create workflow', async () => {
        const res = await request(app)
          .post('/api/autonomous/workflows')
          .send({
            name: 'My Workflow',
            description: 'A test workflow',
            agents: [1, 2],
            steps: [{ type: 'sequence', agents: [1, 2] }],
            settings: { timeout: 3600 }
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.workflow).toBeDefined();
      });

      it('should require name', async () => {
        const res = await request(app)
          .post('/api/autonomous/workflows')
          .send({});

        expect(res.status).toBe(400);
      });
    });

    describe('GET /api/autonomous/workflows', () => {
      it('should return workflows', async () => {
        const res = await request(app).get('/api/autonomous/workflows?status=active&limit=20');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.workflows).toBeDefined();
      });
    });

    describe('GET /api/autonomous/workflows/:id', () => {
      it('should return workflow', async () => {
        const orchestrator = new MockAgentOrchestrator();
        orchestrator.getWorkflow.mockResolvedValueOnce({ id: 1, name: 'Workflow' });

        const res = await request(app).get('/api/autonomous/workflows/1');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should return 404 for non-existent workflow', async () => {
        const orchestrator = new MockAgentOrchestrator();
        orchestrator.getWorkflow.mockResolvedValueOnce(null);

        const res = await request(app).get('/api/autonomous/workflows/999');

        expect(res.status).toBe(404);
      });
    });

    describe('POST /api/autonomous/workflows/:id/execute', () => {
      it('should execute workflow', async () => {
        const res = await request(app)
          .post('/api/autonomous/workflows/1/execute')
          .send({ inputData: { key: 'value' } });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('execution started');
      });
    });

    describe('DELETE /api/autonomous/workflows/:id', () => {
      it('should delete workflow', async () => {
        const res = await request(app).delete('/api/autonomous/workflows/1');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('deleted');
      });
    });
  });

  // ==========================================
  // LOGS
  // ==========================================
  describe('Logs', () => {
    describe('GET /api/autonomous/agents/:id/logs', () => {
      it('should return execution logs', async () => {
        MockTaskExecutor.getTasksByAgent.mockResolvedValueOnce([
          { id: 1, status: 'completed' },
          { id: 2, status: 'failed' }
        ]);
        MockTaskExecutor.getTaskSteps.mockResolvedValue([
          { id: 1, step_number: 1 }
        ]);

        const res = await request(app).get('/api/autonomous/agents/1/logs?limit=50&offset=0');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.logs).toBeDefined();
        expect(res.body.taskCount).toBeDefined();
      });

      it('should return 403 if not owner', async () => {
        mockAgentCore.validateOwnership.mockResolvedValueOnce(false);

        const res = await request(app).get('/api/autonomous/agents/1/logs');

        expect(res.status).toBe(403);
      });
    });
  });
});
