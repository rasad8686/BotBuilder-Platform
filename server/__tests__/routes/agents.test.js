/**
 * Agents Routes Tests
 * Tests for server/routes/agents.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', current_organization_id: 1 };
  next();
}));

jest.mock('../../models/Agent', () => ({
  findByTenant: jest.fn(),
  findByBotId: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
}));

jest.mock('../../agents', () => ({
  Agent: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({
      success: true,
      output: 'Test response',
      tokensUsed: 100,
      durationMs: 500
    })
  }))
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const AgentModel = require('../../models/Agent');
const { Agent } = require('../../agents');
const agentsRouter = require('../../routes/agents');

const app = express();
app.use(express.json());
app.use('/api/agents', agentsRouter);

describe('Agents Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/agents', () => {
    it('should return all agents for tenant', async () => {
      AgentModel.findByTenant.mockResolvedValueOnce([
        { id: 1, name: 'Agent 1', role: 'assistant' },
        { id: 2, name: 'Agent 2', role: 'support' }
      ]);

      const response = await request(app).get('/api/agents');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(AgentModel.findByTenant).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      AgentModel.findByTenant.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/agents');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed');
    });
  });

  describe('POST /api/agents', () => {
    it('should create agent', async () => {
      AgentModel.create.mockResolvedValueOnce({
        id: 1,
        bot_id: 1,
        name: 'Test Agent',
        role: 'assistant',
        system_prompt: 'You are helpful'
      });

      const response = await request(app)
        .post('/api/agents')
        .send({
          bot_id: 1,
          name: 'Test Agent',
          role: 'assistant',
          system_prompt: 'You are helpful'
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Test Agent');
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/agents')
        .send({
          bot_id: 1,
          name: 'Test Agent'
          // Missing role and system_prompt
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should handle database errors', async () => {
      AgentModel.create.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .post('/api/agents')
        .send({
          bot_id: 1,
          name: 'Test Agent',
          role: 'assistant',
          system_prompt: 'You are helpful'
        });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/agents/bot/:botId', () => {
    it('should return agents for bot', async () => {
      AgentModel.findByBotId.mockResolvedValueOnce([
        { id: 1, bot_id: 1, name: 'Agent 1' }
      ]);

      const response = await request(app).get('/api/agents/bot/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(AgentModel.findByBotId).toHaveBeenCalledWith('1');
    });
  });

  describe('GET /api/agents/:id', () => {
    it('should return single agent', async () => {
      AgentModel.findById.mockResolvedValueOnce({
        id: 1,
        name: 'Test Agent',
        role: 'assistant'
      });

      const response = await request(app).get('/api/agents/1');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Test Agent');
    });

    it('should return 404 if not found', async () => {
      AgentModel.findById.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/agents/999');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/agents/:id', () => {
    it('should update agent', async () => {
      AgentModel.findById.mockResolvedValueOnce({ id: 1, name: 'Old Name' });
      AgentModel.update.mockResolvedValueOnce({ id: 1, name: 'New Name' });

      const response = await request(app)
        .put('/api/agents/1')
        .send({ name: 'New Name' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('New Name');
    });

    it('should return 404 if not found', async () => {
      AgentModel.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .put('/api/agents/999')
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/agents/:id', () => {
    it('should delete agent', async () => {
      AgentModel.findById.mockResolvedValueOnce({ id: 1 });
      AgentModel.delete.mockResolvedValueOnce(true);

      const response = await request(app).delete('/api/agents/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');
    });

    it('should return 404 if not found', async () => {
      AgentModel.findById.mockResolvedValueOnce(null);

      const response = await request(app).delete('/api/agents/999');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/agents/:id/test', () => {
    it('should test agent', async () => {
      AgentModel.findById.mockResolvedValueOnce({
        id: 1,
        name: 'Test Agent',
        role: 'assistant',
        system_prompt: 'You are helpful',
        model_provider: 'openai',
        model_name: 'gpt-4',
        temperature: 0.7,
        max_tokens: 1000,
        capabilities: [],
        tools: []
      });

      const response = await request(app)
        .post('/api/agents/1/test')
        .send({ input: 'Hello!' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.output).toBe('Test response');
    });

    it('should reject missing input', async () => {
      const response = await request(app)
        .post('/api/agents/1/test')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 404 if agent not found', async () => {
      AgentModel.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/agents/999/test')
        .send({ input: 'Hello!' });

      expect(response.status).toBe(404);
    });
  });
});
