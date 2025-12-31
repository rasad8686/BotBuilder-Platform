/**
 * Autonomous Routes Tests
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

jest.mock('../../services/autonomous/AgentCore', () => ({
  create: jest.fn().mockResolvedValue({ id: 1, name: 'Test Agent' }),
  findByUser: jest.fn().mockResolvedValue([{ id: 1, name: 'Agent 1' }]),
  findById: jest.fn().mockResolvedValue({ id: 1, name: 'Test Agent', user_id: 1 }),
  update: jest.fn().mockResolvedValue({ id: 1, name: 'Updated Agent' }),
  delete: jest.fn().mockResolvedValue(true),
  getStats: jest.fn().mockResolvedValue({ totalTasks: 10, successRate: 0.9 }),
  validateOwnership: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../services/autonomous/TaskExecutor', () => {
  const mockExecute = jest.fn().mockResolvedValue({ result: 'done' });
  const MockTaskExecutor = jest.fn().mockImplementation(() => ({
    execute: mockExecute
  }));
  MockTaskExecutor.createTask = jest.fn().mockResolvedValue({ id: 1, status: 'pending' });
  MockTaskExecutor.getTasksByAgent = jest.fn().mockResolvedValue([{ id: 1, status: 'completed' }]);
  MockTaskExecutor.getTask = jest.fn().mockResolvedValue({ id: 1, agent_id: 1, status: 'completed' });
  MockTaskExecutor.cancelTask = jest.fn().mockResolvedValue(true);
  MockTaskExecutor.retryTask = jest.fn().mockResolvedValue({ id: 1, status: 'pending' });
  return MockTaskExecutor;
});

jest.mock('../../services/autonomous/ToolRegistry', () => ({
  listTools: jest.fn().mockReturnValue([{ name: 'web_scraper' }, { name: 'api_call' }]),
  getToolInfo: jest.fn().mockReturnValue({ name: 'web_scraper', description: 'Scrapes web pages' }),
  getToolCategories: jest.fn().mockReturnValue(['web', 'data', 'file'])
}));

jest.mock('../../services/autonomous/AgentOrchestrator', () => ({
  createTeam: jest.fn().mockResolvedValue({ id: 1, name: 'Test Team' }),
  getTeams: jest.fn().mockResolvedValue([{ id: 1, name: 'Team 1' }]),
  getTeam: jest.fn().mockResolvedValue({ id: 1, name: 'Team 1', agents: [] }),
  updateTeam: jest.fn().mockResolvedValue({ id: 1, name: 'Updated Team' }),
  deleteTeam: jest.fn().mockResolvedValue(true),
  addAgentToTeam: jest.fn().mockResolvedValue({ id: 1, agents: [1] }),
  removeAgentFromTeam: jest.fn().mockResolvedValue({ id: 1, agents: [] }),
  executeTeamTask: jest.fn().mockResolvedValue({ taskId: 'task-1', status: 'running' })
}));

jest.mock('../../services/autonomous/AgentMemory', () => ({
  store: jest.fn().mockResolvedValue({ id: 1 }),
  query: jest.fn().mockResolvedValue([{ content: 'memory 1' }]),
  getConversationHistory: jest.fn().mockResolvedValue([{ role: 'user', content: 'hello' }]),
  clear: jest.fn().mockResolvedValue(true),
  getStats: jest.fn().mockResolvedValue({ totalMemories: 100 })
}));

jest.mock('../../services/autonomous/AgentScheduler', () => ({
  createSchedule: jest.fn().mockResolvedValue({ id: 1, cron: '0 * * * *' }),
  getSchedules: jest.fn().mockResolvedValue([{ id: 1, cron: '0 * * * *' }]),
  updateSchedule: jest.fn().mockResolvedValue({ id: 1, cron: '0 */2 * * *' }),
  deleteSchedule: jest.fn().mockResolvedValue(true),
  pauseSchedule: jest.fn().mockResolvedValue({ id: 1, is_active: false }),
  resumeSchedule: jest.fn().mockResolvedValue({ id: 1, is_active: true }),
  getScheduleHistory: jest.fn().mockResolvedValue([{ execution_time: new Date() }])
}));

jest.mock('../../services/autonomous/AgentAnalytics', () => ({
  getAgentAnalytics: jest.fn().mockResolvedValue({ successRate: 0.95, avgResponseTime: 200 }),
  getTaskAnalytics: jest.fn().mockResolvedValue({ totalTasks: 100, completed: 90 }),
  getUsageMetrics: jest.fn().mockResolvedValue({ tokensUsed: 50000, cost: 1.5 }),
  getPerformanceMetrics: jest.fn().mockResolvedValue({ latency: 150, throughput: 10 })
}));

jest.mock('../../services/autonomous/AgentTemplates', () => ({
  getTemplates: jest.fn().mockResolvedValue([{ id: 1, name: 'Research Agent' }]),
  getTemplate: jest.fn().mockResolvedValue({ id: 1, name: 'Research Agent', config: {} }),
  createFromTemplate: jest.fn().mockResolvedValue({ id: 1, name: 'New Agent' })
}));

const AgentCore = require('../../services/autonomous/AgentCore');
const TaskExecutor = require('../../services/autonomous/TaskExecutor');
const autonomousRouter = require('../../routes/autonomous');

describe('Autonomous Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/autonomous', autonomousRouter);
  });

  // ==========================================
  // AGENT CRUD
  // ==========================================

  describe('POST /api/autonomous/agents', () => {
    it('should create an agent', async () => {
      const res = await request(app)
        .post('/api/autonomous/agents')
        .send({ name: 'Test Agent', description: 'A test agent' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.agent).toBeDefined();
    });

    it('should require name', async () => {
      const res = await request(app)
        .post('/api/autonomous/agents')
        .send({ description: 'No name' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('name');
    });

    it('should handle creation error', async () => {
      AgentCore.create.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .post('/api/autonomous/agents')
        .send({ name: 'Test' });

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/autonomous/agents', () => {
    it('should return agents list', async () => {
      const res = await request(app).get('/api/autonomous/agents');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.agents).toBeDefined();
    });

    it('should handle query params', async () => {
      await request(app).get('/api/autonomous/agents?status=active&limit=10&offset=5');

      expect(AgentCore.findByUser).toHaveBeenCalledWith(1, {
        status: 'active',
        limit: 10,
        offset: 5
      });
    });
  });

  describe('GET /api/autonomous/agents/:id', () => {
    it('should return agent by ID', async () => {
      const res = await request(app).get('/api/autonomous/agents/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.agent).toBeDefined();
    });

    it('should return 404 if not found', async () => {
      AgentCore.findById.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/autonomous/agents/999');

      expect(res.status).toBe(404);
    });

    it('should return 403 if not owner', async () => {
      AgentCore.findById.mockResolvedValueOnce({ id: 1, user_id: 999 });

      const res = await request(app).get('/api/autonomous/agents/1');

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/autonomous/agents/:id', () => {
    it('should update agent', async () => {
      const res = await request(app)
        .put('/api/autonomous/agents/1')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/autonomous/agents/:id', () => {
    it('should delete agent', async () => {
      const res = await request(app).delete('/api/autonomous/agents/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted');
    });
  });

  // ==========================================
  // TASKS
  // ==========================================

  describe('POST /api/autonomous/agents/:id/tasks', () => {
    it('should create and execute task', async () => {
      const res = await request(app)
        .post('/api/autonomous/agents/1/tasks')
        .send({ task_description: 'Do something' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.task).toBeDefined();
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

    it('should return 404 if agent not found', async () => {
      AgentCore.findById.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/autonomous/agents/999/tasks')
        .send({ task_description: 'Test' });

      expect(res.status).toBe(404);
    });

    it('should return 403 if not owner', async () => {
      AgentCore.findById.mockResolvedValueOnce({ id: 1, user_id: 999 });

      const res = await request(app)
        .post('/api/autonomous/agents/1/tasks')
        .send({ task_description: 'Test' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/autonomous/agents/:id/tasks', () => {
    it('should return tasks for agent', async () => {
      const res = await request(app).get('/api/autonomous/agents/1/tasks');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tasks).toBeDefined();
    });

    it('should return 403 if not owner', async () => {
      AgentCore.validateOwnership.mockResolvedValueOnce(false);

      const res = await request(app).get('/api/autonomous/agents/1/tasks');

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/autonomous/tasks/:id', () => {
    it('should return task by ID', async () => {
      const res = await request(app).get('/api/autonomous/tasks/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.task).toBeDefined();
    });

    it('should return 404 if not found', async () => {
      TaskExecutor.getTask.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/autonomous/tasks/999');

      expect(res.status).toBe(404);
    });
  });

  // ==========================================
  // TOOLS
  // ==========================================

  describe('GET /api/autonomous/tools', () => {
    it('should return available tools', async () => {
      const res = await request(app).get('/api/autonomous/tools');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tools).toBeDefined();
    });
  });

  describe('GET /api/autonomous/tools/:name', () => {
    it('should return tool info', async () => {
      const res = await request(app).get('/api/autonomous/tools/web_scraper');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tool).toBeDefined();
    });
  });

  describe('GET /api/autonomous/tools/categories', () => {
    it('should return tool categories', async () => {
      const res = await request(app).get('/api/autonomous/tools/categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.categories).toBeDefined();
    });
  });

  // ==========================================
  // TEAMS
  // ==========================================

  describe('POST /api/autonomous/teams', () => {
    it('should create a team', async () => {
      const res = await request(app)
        .post('/api/autonomous/teams')
        .send({ name: 'Test Team' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/autonomous/teams', () => {
    it('should return teams list', async () => {
      const res = await request(app).get('/api/autonomous/teams');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/autonomous/teams/:id', () => {
    it('should return team by ID', async () => {
      const res = await request(app).get('/api/autonomous/teams/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('PUT /api/autonomous/teams/:id', () => {
    it('should update team', async () => {
      const res = await request(app)
        .put('/api/autonomous/teams/1')
        .send({ name: 'Updated Team' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/autonomous/teams/:id', () => {
    it('should delete team', async () => {
      const res = await request(app).delete('/api/autonomous/teams/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/autonomous/teams/:id/agents', () => {
    it('should add agent to team', async () => {
      const res = await request(app)
        .post('/api/autonomous/teams/1/agents')
        .send({ agentId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/autonomous/teams/:id/agents/:agentId', () => {
    it('should remove agent from team', async () => {
      const res = await request(app).delete('/api/autonomous/teams/1/agents/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/autonomous/teams/:id/tasks', () => {
    it('should execute team task', async () => {
      const res = await request(app)
        .post('/api/autonomous/teams/1/tasks')
        .send({ task_description: 'Team task' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================
  // MEMORY
  // ==========================================

  describe('POST /api/autonomous/agents/:id/memory', () => {
    it('should store memory', async () => {
      const res = await request(app)
        .post('/api/autonomous/agents/1/memory')
        .send({ content: 'Important fact', type: 'fact' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/autonomous/agents/:id/memory', () => {
    it('should query memory', async () => {
      const res = await request(app).get('/api/autonomous/agents/1/memory?query=test');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/autonomous/agents/:id/memory/conversation', () => {
    it('should get conversation history', async () => {
      const res = await request(app).get('/api/autonomous/agents/1/memory/conversation');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/autonomous/agents/:id/memory', () => {
    it('should clear memory', async () => {
      const res = await request(app).delete('/api/autonomous/agents/1/memory');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================
  // SCHEDULES
  // ==========================================

  describe('POST /api/autonomous/agents/:id/schedules', () => {
    it('should create schedule', async () => {
      const res = await request(app)
        .post('/api/autonomous/agents/1/schedules')
        .send({ cron: '0 * * * *', task_description: 'Hourly task' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/autonomous/agents/:id/schedules', () => {
    it('should return schedules', async () => {
      const res = await request(app).get('/api/autonomous/agents/1/schedules');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('PUT /api/autonomous/schedules/:id', () => {
    it('should update schedule', async () => {
      const res = await request(app)
        .put('/api/autonomous/schedules/1')
        .send({ cron: '0 */2 * * *' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/autonomous/schedules/:id', () => {
    it('should delete schedule', async () => {
      const res = await request(app).delete('/api/autonomous/schedules/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/autonomous/schedules/:id/pause', () => {
    it('should pause schedule', async () => {
      const res = await request(app).post('/api/autonomous/schedules/1/pause');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/autonomous/schedules/:id/resume', () => {
    it('should resume schedule', async () => {
      const res = await request(app).post('/api/autonomous/schedules/1/resume');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================
  // ANALYTICS
  // ==========================================

  describe('GET /api/autonomous/agents/:id/analytics', () => {
    it('should return agent analytics', async () => {
      const res = await request(app).get('/api/autonomous/agents/1/analytics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/autonomous/analytics/tasks', () => {
    it('should return task analytics', async () => {
      const res = await request(app).get('/api/autonomous/analytics/tasks');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/autonomous/analytics/usage', () => {
    it('should return usage metrics', async () => {
      const res = await request(app).get('/api/autonomous/analytics/usage');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================
  // TEMPLATES
  // ==========================================

  describe('GET /api/autonomous/templates', () => {
    it('should return templates', async () => {
      const res = await request(app).get('/api/autonomous/templates');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.templates).toBeDefined();
    });
  });

  describe('GET /api/autonomous/templates/:id', () => {
    it('should return template by ID', async () => {
      const res = await request(app).get('/api/autonomous/templates/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/autonomous/templates/:id/create', () => {
    it('should create agent from template', async () => {
      const res = await request(app)
        .post('/api/autonomous/templates/1/create')
        .send({ name: 'New Agent from Template' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });
});
