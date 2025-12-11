/**
 * Agents API Tests - Real Route Coverage
 * Tests for /api/agents endpoints: CRUD, testing, tools assignment
 * Uses actual route handlers for code coverage
 */

const request = require('supertest');
const express = require('express');

// ========================================
// MOCKS - Must be defined BEFORE imports
// ========================================

// Mock the database
jest.mock('../db', () => ({
  query: jest.fn(),
  pool: { query: jest.fn() }
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  http: jest.fn()
}));

// Mock Agent model
jest.mock('../models/Agent', () => ({
  findByTenant: jest.fn(),
  findByBotId: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
}));

// Mock Agent class
jest.mock('../agents', () => ({
  Agent: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({
      success: true,
      output: 'Test output',
      tokensUsed: 100,
      durationMs: 500
    })
  }))
}));

// Mock authentication middleware
jest.mock('../middleware/auth', () => {
  return jest.fn((req, res, next) => {
    req.user = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      current_organization_id: 1,
      organization_id: 1
    };
    next();
  });
});

// ========================================
// NOW import the actual routes
// ========================================
const db = require('../db');
const AgentModel = require('../models/Agent');
const { Agent } = require('../agents');
const agentsRouter = require('../routes/agents');

// Create test app with REAL routes
const app = express();
app.use(express.json());
app.use('/api/agents', agentsRouter);

// ========================================
// TEST SUITES
// ========================================

describe('Agents API - Real Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // GET /api/agents - List all agents
  // ========================================
  describe('GET /api/agents', () => {
    it('should return all agents for tenant', async () => {
      const mockAgents = [
        { id: 1, name: 'Agent 1', role: 'assistant' },
        { id: 2, name: 'Agent 2', role: 'specialist' }
      ];
      AgentModel.findByTenant.mockResolvedValueOnce(mockAgents);

      const res = await request(app).get('/api/agents');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(AgentModel.findByTenant).toHaveBeenCalledWith(1);
    });

    it('should return empty array if no agents', async () => {
      AgentModel.findByTenant.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/agents');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should handle database error', async () => {
      AgentModel.findByTenant.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/agents');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch agents');
    });
  });

  // ========================================
  // GET /api/agents/bot/:botId - List agents by bot
  // ========================================
  describe('GET /api/agents/bot/:botId', () => {
    it('should return agents for specific bot', async () => {
      const mockAgents = [{ id: 1, bot_id: 5, name: 'Bot Agent' }];
      AgentModel.findByBotId.mockResolvedValueOnce(mockAgents);

      const res = await request(app).get('/api/agents/bot/5');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(AgentModel.findByBotId).toHaveBeenCalledWith('5');
    });

    it('should return empty array if bot has no agents', async () => {
      AgentModel.findByBotId.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/agents/bot/999');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should handle database error', async () => {
      AgentModel.findByBotId.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/agents/bot/5');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch agents');
    });
  });

  // ========================================
  // GET /api/agents/:id - Get single agent
  // ========================================
  describe('GET /api/agents/:id', () => {
    it('should return agent by ID', async () => {
      const mockAgent = { id: 1, name: 'Test Agent', role: 'assistant' };
      AgentModel.findById.mockResolvedValueOnce(mockAgent);

      const res = await request(app).get('/api/agents/1');

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Test Agent');
      expect(AgentModel.findById).toHaveBeenCalledWith('1');
    });

    it('should return 404 if agent not found', async () => {
      AgentModel.findById.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/agents/999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Agent not found');
    });

    it('should handle database error', async () => {
      AgentModel.findById.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/agents/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch agent');
    });
  });

  // ========================================
  // POST /api/agents - Create agent
  // ========================================
  describe('POST /api/agents', () => {
    it('should create agent successfully', async () => {
      const newAgent = { id: 1, name: 'New Agent', role: 'assistant' };
      AgentModel.create.mockResolvedValueOnce(newAgent);

      const res = await request(app)
        .post('/api/agents')
        .send({
          bot_id: 5,
          name: 'New Agent',
          role: 'assistant',
          system_prompt: 'You are a helpful assistant'
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Agent');
    });

    it('should return 400 if bot_id is missing', async () => {
      const res = await request(app)
        .post('/api/agents')
        .send({
          name: 'New Agent',
          role: 'assistant',
          system_prompt: 'Test'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('bot_id');
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(app)
        .post('/api/agents')
        .send({
          bot_id: 5,
          role: 'assistant',
          system_prompt: 'Test'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('name');
    });

    it('should return 400 if role is missing', async () => {
      const res = await request(app)
        .post('/api/agents')
        .send({
          bot_id: 5,
          name: 'Agent',
          system_prompt: 'Test'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('role');
    });

    it('should return 400 if system_prompt is missing', async () => {
      const res = await request(app)
        .post('/api/agents')
        .send({
          bot_id: 5,
          name: 'Agent',
          role: 'assistant'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('system_prompt');
    });

    it('should handle database error', async () => {
      AgentModel.create.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/agents')
        .send({
          bot_id: 5,
          name: 'Agent',
          role: 'assistant',
          system_prompt: 'Test'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create agent');
    });

    it('should accept optional model parameters', async () => {
      const newAgent = {
        id: 1,
        name: 'Agent',
        model_provider: 'anthropic',
        model_name: 'claude-3-sonnet',
        temperature: 0.5,
        max_tokens: 4000
      };
      AgentModel.create.mockResolvedValueOnce(newAgent);

      const res = await request(app)
        .post('/api/agents')
        .send({
          bot_id: 5,
          name: 'Agent',
          role: 'assistant',
          system_prompt: 'Test',
          model_provider: 'anthropic',
          model_name: 'claude-3-sonnet',
          temperature: 0.5,
          max_tokens: 4000
        });

      expect(res.status).toBe(201);
    });
  });

  // ========================================
  // PUT /api/agents/:id - Update agent
  // ========================================
  describe('PUT /api/agents/:id', () => {
    it('should update agent successfully', async () => {
      const existingAgent = { id: 1, name: 'Old Name' };
      const updatedAgent = { id: 1, name: 'Updated Agent' };

      AgentModel.findById.mockResolvedValueOnce(existingAgent);
      AgentModel.update.mockResolvedValueOnce(updatedAgent);

      const res = await request(app)
        .put('/api/agents/1')
        .send({ name: 'Updated Agent' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Agent');
    });

    it('should return 404 if agent not found', async () => {
      AgentModel.findById.mockResolvedValueOnce(null);

      const res = await request(app)
        .put('/api/agents/999')
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Agent not found');
    });

    it('should handle database error', async () => {
      AgentModel.findById.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .put('/api/agents/1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to update agent');
    });

    it('should update multiple fields', async () => {
      const existingAgent = { id: 1 };
      const updatedAgent = { id: 1, name: 'Updated', role: 'specialist', temperature: 0.5 };

      AgentModel.findById.mockResolvedValueOnce(existingAgent);
      AgentModel.update.mockResolvedValueOnce(updatedAgent);

      const res = await request(app)
        .put('/api/agents/1')
        .send({ name: 'Updated', role: 'specialist', temperature: 0.5 });

      expect(res.status).toBe(200);
      expect(AgentModel.update).toHaveBeenCalledWith('1', expect.objectContaining({
        name: 'Updated',
        role: 'specialist',
        temperature: 0.5
      }));
    });
  });

  // ========================================
  // DELETE /api/agents/:id - Delete agent
  // ========================================
  describe('DELETE /api/agents/:id', () => {
    it('should delete agent successfully', async () => {
      const existingAgent = { id: 1, name: 'Test Agent' };

      AgentModel.findById.mockResolvedValueOnce(existingAgent);
      AgentModel.delete.mockResolvedValueOnce(true);

      const res = await request(app).delete('/api/agents/1');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Agent deleted successfully');
    });

    it('should return 404 if agent not found', async () => {
      AgentModel.findById.mockResolvedValueOnce(null);

      const res = await request(app).delete('/api/agents/999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Agent not found');
    });

    it('should handle database error', async () => {
      AgentModel.findById.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).delete('/api/agents/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to delete agent');
    });
  });

  // ========================================
  // POST /api/agents/:id/test - Test agent
  // ========================================
  describe('POST /api/agents/:id/test', () => {
    it('should test agent successfully', async () => {
      const mockAgent = {
        id: 1,
        name: 'Test Agent',
        role: 'assistant',
        system_prompt: 'You are helpful',
        model_provider: 'openai',
        model_name: 'gpt-4o',
        temperature: 0.7,
        max_tokens: 2000,
        capabilities: [],
        tools: []
      };

      AgentModel.findById.mockResolvedValueOnce(mockAgent);

      const res = await request(app)
        .post('/api/agents/1/test')
        .send({ input: 'Hello, how are you?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.output).toBeDefined();
    });

    it('should return 400 if input is missing', async () => {
      const res = await request(app)
        .post('/api/agents/1/test')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('input');
    });

    it('should return 404 if agent not found', async () => {
      AgentModel.findById.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/agents/999/test')
        .send({ input: 'Test' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Agent not found');
    });

    it('should handle execution error', async () => {
      const mockAgent = {
        id: 1,
        name: 'Test Agent',
        role: 'assistant',
        system_prompt: 'You are helpful',
        model_provider: 'openai',
        model_name: 'gpt-4o'
      };

      AgentModel.findById.mockResolvedValueOnce(mockAgent);
      Agent.mockImplementationOnce(() => ({
        execute: jest.fn().mockRejectedValue(new Error('Execution failed'))
      }));

      const res = await request(app)
        .post('/api/agents/1/test')
        .send({ input: 'Test' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to test agent');
    });
  });
});

// ========================================
// EDGE CASES
// ========================================
describe('Agent Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Model Parameters', () => {
    it('should accept custom temperature', async () => {
      const newAgent = { id: 1, temperature: 0.2 };
      AgentModel.create.mockResolvedValueOnce(newAgent);

      const res = await request(app)
        .post('/api/agents')
        .send({
          bot_id: 5,
          name: 'Agent',
          role: 'assistant',
          system_prompt: 'Test',
          temperature: 0.2
        });

      expect(res.status).toBe(201);
    });

    it('should accept custom max_tokens', async () => {
      const newAgent = { id: 1, max_tokens: 4000 };
      AgentModel.create.mockResolvedValueOnce(newAgent);

      const res = await request(app)
        .post('/api/agents')
        .send({
          bot_id: 5,
          name: 'Agent',
          role: 'assistant',
          system_prompt: 'Test',
          max_tokens: 4000
        });

      expect(res.status).toBe(201);
    });

    it('should accept different model providers', async () => {
      const newAgent = { id: 1, model_provider: 'anthropic' };
      AgentModel.create.mockResolvedValueOnce(newAgent);

      const res = await request(app)
        .post('/api/agents')
        .send({
          bot_id: 5,
          name: 'Agent',
          role: 'assistant',
          system_prompt: 'Test',
          model_provider: 'anthropic',
          model_name: 'claude-3-sonnet'
        });

      expect(res.status).toBe(201);
    });
  });

  describe('Capabilities and Tools', () => {
    it('should accept capabilities array', async () => {
      const newAgent = { id: 1, capabilities: ['web_search', 'code_execution'] };
      AgentModel.create.mockResolvedValueOnce(newAgent);

      const res = await request(app)
        .post('/api/agents')
        .send({
          bot_id: 5,
          name: 'Agent',
          role: 'assistant',
          system_prompt: 'Test',
          capabilities: ['web_search', 'code_execution']
        });

      expect(res.status).toBe(201);
    });

    it('should accept tools array', async () => {
      const newAgent = { id: 1, tools: ['calculator', 'weather'] };
      AgentModel.create.mockResolvedValueOnce(newAgent);

      const res = await request(app)
        .post('/api/agents')
        .send({
          bot_id: 5,
          name: 'Agent',
          role: 'assistant',
          system_prompt: 'Test',
          tools: ['calculator', 'weather']
        });

      expect(res.status).toBe(201);
    });
  });
});
