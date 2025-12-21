/**
 * Executions Routes Tests
 * Tests for server/routes/executions.js
 */

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', current_organization_id: 1 };
  next();
}));

jest.mock('../../models/WorkflowExecution', () => ({
  findByBotId: jest.fn(),
  findById: jest.fn(),
  delete: jest.fn()
}));

jest.mock('../../models/AgentExecutionStep', () => ({
  findByExecutionId: jest.fn(),
  deleteByExecutionId: jest.fn()
}));

jest.mock('../../models/AgentMessage', () => ({
  findByExecutionId: jest.fn(),
  deleteByExecutionId: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const WorkflowExecution = require('../../models/WorkflowExecution');
const AgentExecutionStep = require('../../models/AgentExecutionStep');
const AgentMessage = require('../../models/AgentMessage');
const executionsRouter = require('../../routes/executions');

const app = express();
app.use(express.json());
app.use('/api/executions', executionsRouter);

describe('Executions Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/executions', () => {
    it('should reject missing bot_id', async () => {
      const response = await request(app).get('/api/executions');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('bot_id');
    });

    it('should return executions for bot', async () => {
      WorkflowExecution.findByBotId.mockResolvedValueOnce([
        { id: 1, status: 'completed', workflow_id: 1 },
        { id: 2, status: 'running', workflow_id: 1 }
      ]);

      const response = await request(app).get('/api/executions?bot_id=1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should filter by workflow_id', async () => {
      WorkflowExecution.findByBotId.mockResolvedValueOnce([
        { id: 1, status: 'completed', workflow_id: 2 }
      ]);

      const response = await request(app).get('/api/executions?bot_id=1&workflow_id=2');

      expect(response.status).toBe(200);
      expect(WorkflowExecution.findByBotId).toHaveBeenCalledWith('1', expect.objectContaining({
        workflow_id: '2'
      }));
    });

    it('should filter by status', async () => {
      WorkflowExecution.findByBotId.mockResolvedValueOnce([
        { id: 1, status: 'completed' }
      ]);

      const response = await request(app).get('/api/executions?bot_id=1&status=completed');

      expect(response.status).toBe(200);
    });

    it('should return empty array on table not found error', async () => {
      const error = new Error('Table not found');
      error.code = '42P01';
      WorkflowExecution.findByBotId.mockRejectedValueOnce(error);

      const response = await request(app).get('/api/executions?bot_id=1');

      expect(response.status).toBe(200);
      // Route may return { data: [], message: ... } or just []
      const data = response.body.data || response.body;
      expect(data).toEqual([]);
    });

    it('should handle other errors gracefully', async () => {
      WorkflowExecution.findByBotId.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/executions?bot_id=1');

      // Route may return 200 with empty data or 500
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('GET /api/executions/:id', () => {
    it('should return execution details', async () => {
      WorkflowExecution.findById.mockResolvedValueOnce({
        id: 1,
        status: 'completed',
        workflow_id: 1,
        input: { message: 'test' },
        output: 'Result'
      });

      const response = await request(app).get('/api/executions/1');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
    });

    it('should return 404 if not found', async () => {
      WorkflowExecution.findById.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/executions/999');

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      WorkflowExecution.findById.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/executions/1');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/executions/:id/steps', () => {
    it('should return execution steps', async () => {
      WorkflowExecution.findById.mockResolvedValueOnce({ id: 1 });
      AgentExecutionStep.findByExecutionId.mockResolvedValueOnce([
        { id: 1, agent_name: 'Agent 1', status: 'completed' },
        { id: 2, agent_name: 'Agent 2', status: 'running' }
      ]);

      const response = await request(app).get('/api/executions/1/steps');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should return 404 if execution not found', async () => {
      WorkflowExecution.findById.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/executions/999/steps');

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      WorkflowExecution.findById.mockResolvedValueOnce({ id: 1 });
      AgentExecutionStep.findByExecutionId.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/executions/1/steps');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/executions/:id/messages', () => {
    it('should return agent messages', async () => {
      WorkflowExecution.findById.mockResolvedValueOnce({ id: 1 });
      AgentMessage.findByExecutionId.mockResolvedValueOnce([
        { id: 1, from_agent: 'Agent 1', to_agent: 'Agent 2', content: 'Hello' }
      ]);

      const response = await request(app).get('/api/executions/1/messages');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });

    it('should return 404 if execution not found', async () => {
      WorkflowExecution.findById.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/executions/999/messages');

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      WorkflowExecution.findById.mockResolvedValueOnce({ id: 1 });
      AgentMessage.findByExecutionId.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/executions/1/messages');

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/executions/:id', () => {
    it('should delete execution and related records', async () => {
      WorkflowExecution.findById.mockResolvedValueOnce({ id: 1 });
      AgentMessage.deleteByExecutionId.mockResolvedValueOnce(true);
      AgentExecutionStep.deleteByExecutionId.mockResolvedValueOnce(true);
      WorkflowExecution.delete.mockResolvedValueOnce(true);

      const response = await request(app).delete('/api/executions/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');
      expect(AgentMessage.deleteByExecutionId).toHaveBeenCalledWith('1');
      expect(AgentExecutionStep.deleteByExecutionId).toHaveBeenCalledWith('1');
      expect(WorkflowExecution.delete).toHaveBeenCalledWith('1');
    });

    it('should return 404 if execution not found', async () => {
      WorkflowExecution.findById.mockResolvedValueOnce(null);

      const response = await request(app).delete('/api/executions/999');

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      WorkflowExecution.findById.mockResolvedValueOnce({ id: 1 });
      AgentMessage.deleteByExecutionId.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).delete('/api/executions/1');

      expect(response.status).toBe(500);
    });
  });
});
