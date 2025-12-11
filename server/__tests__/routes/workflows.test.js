/**
 * Workflows Routes Tests
 * Tests for server/routes/workflows.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', current_organization_id: 1 };
  next();
}));

jest.mock('../../models/AgentWorkflow', () => ({
  create: jest.fn(),
  findByBotId: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
}));

jest.mock('../../models/WorkflowExecution', () => ({
  create: jest.fn(),
  findByWorkflowId: jest.fn(),
  complete: jest.fn(),
  fail: jest.fn()
}));

jest.mock('../../models/Agent', () => ({
  findById: jest.fn()
}));

jest.mock('../../agents', () => ({
  AgentOrchestrator: jest.fn().mockImplementation(() => ({
    loadAgent: jest.fn(),
    getAgent: jest.fn()
  })),
  Agent: jest.fn()
}));

jest.mock('../../websocket', () => ({
  getExecutionSocket: jest.fn(() => ({
    emitExecutionStart: jest.fn(),
    emitStepStart: jest.fn(),
    emitStepComplete: jest.fn(),
    emitStepFailed: jest.fn(),
    emitExecutionComplete: jest.fn(),
    emitExecutionError: jest.fn(),
    emitAgentMessage: jest.fn()
  }))
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const AgentWorkflow = require('../../models/AgentWorkflow');
const WorkflowExecution = require('../../models/WorkflowExecution');
const AgentModel = require('../../models/Agent');
const workflowsRouter = require('../../routes/workflows');

const app = express();
app.use(express.json());
app.use('/api/workflows', workflowsRouter);

describe('Workflows Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.pendingExecutions = new Map();
  });

  describe('POST /api/workflows', () => {
    it('should create workflow successfully', async () => {
      AgentWorkflow.create.mockResolvedValueOnce({
        id: 1,
        bot_id: 1,
        name: 'Test Workflow',
        workflow_type: 'sequential'
      });

      const response = await request(app)
        .post('/api/workflows')
        .send({
          bot_id: 1,
          name: 'Test Workflow',
          workflow_type: 'sequential'
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Test Workflow');
    });

    it('should reject missing bot_id', async () => {
      const response = await request(app)
        .post('/api/workflows')
        .send({ name: 'Test Workflow' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('bot_id and name');
    });

    it('should reject missing name', async () => {
      const response = await request(app)
        .post('/api/workflows')
        .send({ bot_id: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('bot_id and name');
    });

    it('should handle database errors', async () => {
      AgentWorkflow.create.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .post('/api/workflows')
        .send({ bot_id: 1, name: 'Test' });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/workflows', () => {
    it('should return empty array if no bot_id', async () => {
      const response = await request(app).get('/api/workflows');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return workflows for bot_id', async () => {
      AgentWorkflow.findByBotId.mockResolvedValueOnce([
        { id: 1, name: 'Workflow 1' },
        { id: 2, name: 'Workflow 2' }
      ]);

      const response = await request(app).get('/api/workflows?bot_id=1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should handle errors', async () => {
      AgentWorkflow.findByBotId.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/workflows?bot_id=1');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/workflows/bot/:botId', () => {
    it('should return workflows for bot', async () => {
      AgentWorkflow.findByBotId.mockResolvedValueOnce([
        { id: 1, name: 'Workflow 1', bot_id: 1 }
      ]);

      const response = await request(app).get('/api/workflows/bot/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });

    it('should handle errors', async () => {
      AgentWorkflow.findByBotId.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/workflows/bot/1');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/workflows/:id', () => {
    it('should return single workflow', async () => {
      AgentWorkflow.findById.mockResolvedValueOnce({
        id: 1,
        name: 'Test Workflow',
        bot_id: 1
      });

      const response = await request(app).get('/api/workflows/1');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Test Workflow');
    });

    it('should return 404 if not found', async () => {
      AgentWorkflow.findById.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/workflows/999');

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      AgentWorkflow.findById.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/workflows/1');

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/workflows/:id', () => {
    it('should update workflow', async () => {
      AgentWorkflow.findById.mockResolvedValueOnce({ id: 1, name: 'Old Name' });
      AgentWorkflow.update.mockResolvedValueOnce({ id: 1, name: 'New Name' });

      const response = await request(app)
        .put('/api/workflows/1')
        .send({ name: 'New Name' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('New Name');
    });

    it('should return 404 if not found', async () => {
      AgentWorkflow.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .put('/api/workflows/999')
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      AgentWorkflow.findById.mockResolvedValueOnce({ id: 1 });
      AgentWorkflow.update.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app)
        .put('/api/workflows/1')
        .send({ name: 'New Name' });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/workflows/:id', () => {
    it('should delete workflow', async () => {
      AgentWorkflow.findById.mockResolvedValueOnce({ id: 1 });
      AgentWorkflow.delete.mockResolvedValueOnce(true);

      const response = await request(app).delete('/api/workflows/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');
    });

    it('should return 404 if not found', async () => {
      AgentWorkflow.findById.mockResolvedValueOnce(null);

      const response = await request(app).delete('/api/workflows/999');

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      AgentWorkflow.findById.mockResolvedValueOnce({ id: 1 });
      AgentWorkflow.delete.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).delete('/api/workflows/1');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/workflows/:id/execute', () => {
    it('should start workflow execution', async () => {
      AgentWorkflow.findById.mockResolvedValueOnce({
        id: 1,
        name: 'Test Workflow',
        bot_id: 1,
        agents_config: []
      });
      WorkflowExecution.create.mockResolvedValueOnce({
        id: 1,
        workflow_id: 1,
        status: 'running'
      });

      const response = await request(app)
        .post('/api/workflows/1/execute')
        .send({ input: { message: 'Hello' } });

      expect(response.status).toBe(200);
      expect(response.body.executionId).toBe(1);
      expect(response.body.status).toBe('pending');
    });

    it('should reject missing input', async () => {
      const response = await request(app)
        .post('/api/workflows/1/execute')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('input');
    });

    it('should return 404 if workflow not found', async () => {
      AgentWorkflow.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/workflows/999/execute')
        .send({ input: { message: 'Hello' } });

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      AgentWorkflow.findById.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app)
        .post('/api/workflows/1/execute')
        .send({ input: { message: 'Hello' } });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/workflows/:workflowId/executions/:executionId/ready', () => {
    it('should return 404 if execution not found', async () => {
      const response = await request(app)
        .post('/api/workflows/1/executions/999/ready')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should execute pending workflow', async () => {
      // Setup pending execution
      const mockExecuteWithUpdates = jest.fn().mockResolvedValue({
        status: 'completed',
        output: 'Test output',
        totalTokens: 100,
        totalDuration: 1000
      });

      global.pendingExecutions.set(1, {
        executeWithUpdates: mockExecuteWithUpdates,
        execution: { id: 1 },
        workflow: { id: 1, name: 'Test' }
      });

      WorkflowExecution.complete.mockResolvedValueOnce(true);

      const response = await request(app)
        .post('/api/workflows/1/executions/1/ready')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
    });

    it('should handle execution failure', async () => {
      const mockExecuteWithUpdates = jest.fn().mockResolvedValue({
        status: 'failed',
        error: 'Test error',
        totalDuration: 500
      });

      global.pendingExecutions.set(2, {
        executeWithUpdates: mockExecuteWithUpdates,
        execution: { id: 2 },
        workflow: { id: 1, name: 'Test' }
      });

      WorkflowExecution.fail.mockResolvedValueOnce(true);

      const response = await request(app)
        .post('/api/workflows/1/executions/2/ready')
        .send({});

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/workflows/:id/executions', () => {
    it('should return execution history', async () => {
      AgentWorkflow.findById.mockResolvedValueOnce({ id: 1 });
      WorkflowExecution.findByWorkflowId.mockResolvedValueOnce([
        { id: 1, status: 'completed' },
        { id: 2, status: 'running' }
      ]);

      const response = await request(app).get('/api/workflows/1/executions');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should return 404 if workflow not found', async () => {
      AgentWorkflow.findById.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/workflows/999/executions');

      expect(response.status).toBe(404);
    });

    it('should support custom limit', async () => {
      AgentWorkflow.findById.mockResolvedValueOnce({ id: 1 });
      WorkflowExecution.findByWorkflowId.mockResolvedValueOnce([]);

      await request(app).get('/api/workflows/1/executions?limit=10');

      expect(WorkflowExecution.findByWorkflowId).toHaveBeenCalledWith('1', 10);
    });

    it('should handle errors', async () => {
      AgentWorkflow.findById.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/workflows/1/executions');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/workflows/:id/execute with agents', () => {
    it('should load agents from config', async () => {
      AgentWorkflow.findById.mockResolvedValueOnce({
        id: 1,
        name: 'Test Workflow',
        bot_id: 1,
        agents_config: [
          { agentId: 1 },
          { agentId: 2 }
        ]
      });
      AgentModel.findById
        .mockResolvedValueOnce({
          id: 1,
          name: 'Agent 1',
          role: 'processor',
          system_prompt: 'Test',
          model_provider: 'openai',
          model_name: 'gpt-4'
        })
        .mockResolvedValueOnce({
          id: 2,
          name: 'Agent 2',
          role: 'processor',
          system_prompt: 'Test'
        });
      WorkflowExecution.create.mockResolvedValueOnce({
        id: 1,
        workflow_id: 1,
        status: 'running'
      });

      const response = await request(app)
        .post('/api/workflows/1/execute')
        .send({ input: { message: 'Hello' } });

      expect(response.status).toBe(200);
      expect(AgentModel.findById).toHaveBeenCalledTimes(2);
    });

    it('should handle config with id instead of agentId', async () => {
      AgentWorkflow.findById.mockResolvedValueOnce({
        id: 1,
        name: 'Test Workflow',
        bot_id: 1,
        agents_config: [{ id: 3 }]
      });
      AgentModel.findById.mockResolvedValueOnce({
        id: 3,
        name: 'Agent 3',
        role: 'processor'
      });
      WorkflowExecution.create.mockResolvedValueOnce({
        id: 2,
        workflow_id: 1,
        status: 'running'
      });

      const response = await request(app)
        .post('/api/workflows/1/execute')
        .send({ input: { message: 'Test' } });

      expect(response.status).toBe(200);
    });

    it('should skip non-existent agents in config', async () => {
      AgentWorkflow.findById.mockResolvedValueOnce({
        id: 1,
        name: 'Test Workflow',
        bot_id: 1,
        agents_config: [{ agentId: 999 }]
      });
      AgentModel.findById.mockResolvedValueOnce(null);
      WorkflowExecution.create.mockResolvedValueOnce({
        id: 3,
        workflow_id: 1,
        status: 'running'
      });

      const response = await request(app)
        .post('/api/workflows/1/execute')
        .send({ input: { message: 'Test' } });

      expect(response.status).toBe(200);
    });
  });

  describe('execution ready with errors', () => {
    it('should handle execute function throwing error', async () => {
      const mockExecuteWithUpdates = jest.fn().mockRejectedValue(new Error('Execution failed'));

      global.pendingExecutions.set(10, {
        executeWithUpdates: mockExecuteWithUpdates,
        execution: { id: 10 },
        workflow: { id: 1, name: 'Test' }
      });

      const response = await request(app)
        .post('/api/workflows/1/executions/10/ready')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed to execute');
    });
  });

  describe('workflow creation edge cases', () => {
    it('should create workflow with all options', async () => {
      AgentWorkflow.create.mockResolvedValueOnce({
        id: 1,
        bot_id: 1,
        name: 'Full Workflow',
        workflow_type: 'parallel',
        agents_config: [{ agentId: 1 }],
        flow_config: { parallel: true },
        entry_agent_id: 1,
        is_default: true
      });

      const response = await request(app)
        .post('/api/workflows')
        .send({
          bot_id: 1,
          name: 'Full Workflow',
          workflow_type: 'parallel',
          agents_config: [{ agentId: 1 }],
          flow_config: { parallel: true },
          entry_agent_id: 1,
          is_default: true
        });

      expect(response.status).toBe(201);
      expect(response.body.workflow_type).toBe('parallel');
    });
  });

  describe('workflow update edge cases', () => {
    it('should update workflow with multiple fields', async () => {
      AgentWorkflow.findById.mockResolvedValueOnce({ id: 1 });
      AgentWorkflow.update.mockResolvedValueOnce({
        id: 1,
        name: 'Updated Name',
        workflow_type: 'conditional',
        is_active: false
      });

      const response = await request(app)
        .put('/api/workflows/1')
        .send({
          name: 'Updated Name',
          workflow_type: 'conditional',
          is_active: false
        });

      expect(response.status).toBe(200);
      expect(response.body.workflow_type).toBe('conditional');
    });
  });

  describe('execution with socket events', () => {
    it('should emit socket events during execution', async () => {
      const mockExecuteWithUpdates = jest.fn().mockResolvedValue({
        status: 'completed',
        output: 'Test output',
        totalTokens: 200,
        totalDuration: 2000
      });

      global.pendingExecutions.set(20, {
        executeWithUpdates: mockExecuteWithUpdates,
        execution: { id: 20 },
        workflow: { id: 1, name: 'Socket Test' }
      });

      WorkflowExecution.complete.mockResolvedValueOnce(true);

      const response = await request(app)
        .post('/api/workflows/1/executions/20/ready')
        .send({});

      expect(response.status).toBe(200);
      expect(mockExecuteWithUpdates).toHaveBeenCalled();
    });
  });

  describe('workflow list with bot param', () => {
    it('should return empty array for empty result', async () => {
      AgentWorkflow.findByBotId.mockResolvedValueOnce([]);

      const response = await request(app).get('/api/workflows?bot_id=999');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('execution history with limit', () => {
    it('should use default limit', async () => {
      AgentWorkflow.findById.mockResolvedValueOnce({ id: 1 });
      WorkflowExecution.findByWorkflowId.mockResolvedValueOnce([]);

      await request(app).get('/api/workflows/1/executions');

      expect(WorkflowExecution.findByWorkflowId).toHaveBeenCalledWith('1', 50);
    });
  });
});
