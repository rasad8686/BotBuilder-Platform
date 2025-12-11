/**
 * Orchestrations Routes Tests
 * Tests for server/routes/orchestrations.js
 */

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', current_organization_id: 1 };
  next();
}));

jest.mock('../../services/OrchestrationManager', () => ({
  listOrchestrations: jest.fn(),
  createOrchestration: jest.fn(),
  getOrchestration: jest.fn(),
  updateOrchestration: jest.fn(),
  deleteOrchestration: jest.fn(),
  getTransitions: jest.fn(),
  addTransition: jest.fn(),
  removeTransition: jest.fn(),
  getVariables: jest.fn(),
  addVariable: jest.fn(),
  executeOrchestration: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const OrchestrationManager = require('../../services/OrchestrationManager');
const orchestrationsRouter = require('../../routes/orchestrations');

const app = express();
app.use(express.json());
app.use('/api/orchestrations', orchestrationsRouter);

describe('Orchestrations Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/orchestrations', () => {
    it('should list orchestrations for bot', async () => {
      OrchestrationManager.listOrchestrations.mockResolvedValueOnce([
        { id: 1, name: 'Main Flow', bot_id: 1 },
        { id: 2, name: 'Support Flow', bot_id: 1 }
      ]);

      const response = await request(app).get('/api/orchestrations?bot_id=1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should reject missing bot_id', async () => {
      const response = await request(app).get('/api/orchestrations');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('bot_id is required');
    });

    it('should handle errors', async () => {
      OrchestrationManager.listOrchestrations.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/orchestrations?bot_id=1');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/orchestrations', () => {
    it('should create orchestration', async () => {
      OrchestrationManager.createOrchestration.mockResolvedValueOnce({
        id: 1,
        bot_id: 1,
        name: 'New Flow'
      });

      const response = await request(app)
        .post('/api/orchestrations')
        .send({ bot_id: 1, name: 'New Flow', description: 'Test' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/orchestrations')
        .send({ bot_id: 1 });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('bot_id and name are required');
    });

    it('should handle errors', async () => {
      OrchestrationManager.createOrchestration.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app)
        .post('/api/orchestrations')
        .send({ bot_id: 1, name: 'Test' });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/orchestrations/:id', () => {
    it('should return orchestration', async () => {
      OrchestrationManager.getOrchestration.mockResolvedValueOnce({
        id: 1,
        name: 'Main Flow'
      });

      const response = await request(app).get('/api/orchestrations/1');

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Main Flow');
    });

    it('should return 404 if not found', async () => {
      OrchestrationManager.getOrchestration.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/orchestrations/999');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/orchestrations/:id', () => {
    it('should update orchestration', async () => {
      OrchestrationManager.updateOrchestration.mockResolvedValueOnce({
        id: 1,
        name: 'Updated Flow'
      });

      const response = await request(app)
        .put('/api/orchestrations/1')
        .send({ name: 'Updated Flow' });

      expect(response.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      OrchestrationManager.updateOrchestration.mockResolvedValueOnce(null);

      const response = await request(app)
        .put('/api/orchestrations/999')
        .send({ name: 'Test' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/orchestrations/:id', () => {
    it('should delete orchestration', async () => {
      OrchestrationManager.deleteOrchestration.mockResolvedValueOnce(true);

      const response = await request(app).delete('/api/orchestrations/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');
    });

    it('should return 404 if not found', async () => {
      OrchestrationManager.deleteOrchestration.mockResolvedValueOnce(false);

      const response = await request(app).delete('/api/orchestrations/999');

      expect(response.status).toBe(404);
    });
  });

  describe('Transitions', () => {
    describe('GET /api/orchestrations/:id/transitions', () => {
      it('should return transitions', async () => {
        OrchestrationManager.getTransitions.mockResolvedValueOnce([
          { id: 1, from_flow_id: 1, to_flow_id: 2 }
        ]);

        const response = await request(app).get('/api/orchestrations/1/transitions');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
      });
    });

    describe('POST /api/orchestrations/:id/transitions', () => {
      it('should add transition', async () => {
        OrchestrationManager.addTransition.mockResolvedValueOnce({
          id: 1,
          from_flow_id: 1,
          to_flow_id: 2
        });

        const response = await request(app)
          .post('/api/orchestrations/1/transitions')
          .send({
            from_flow_id: 1,
            to_flow_id: 2,
            trigger_type: 'condition'
          });

        expect(response.status).toBe(201);
      });

      it('should reject missing fields', async () => {
        const response = await request(app)
          .post('/api/orchestrations/1/transitions')
          .send({ from_flow_id: 1 });

        expect(response.status).toBe(400);
      });
    });

    describe('DELETE /api/orchestrations/:id/transitions/:transitionId', () => {
      it('should remove transition', async () => {
        OrchestrationManager.removeTransition.mockResolvedValueOnce(true);

        const response = await request(app).delete('/api/orchestrations/1/transitions/1');

        expect(response.status).toBe(200);
      });

      it('should return 404 if not found', async () => {
        OrchestrationManager.removeTransition.mockResolvedValueOnce(false);

        const response = await request(app).delete('/api/orchestrations/1/transitions/999');

        expect(response.status).toBe(404);
      });
    });
  });

  describe('Variables', () => {
    describe('GET /api/orchestrations/:id/variables', () => {
      it('should return variables', async () => {
        OrchestrationManager.getVariables.mockResolvedValueOnce([
          { id: 1, name: 'userName', type: 'string' }
        ]);

        const response = await request(app).get('/api/orchestrations/1/variables');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
      });
    });

    describe('POST /api/orchestrations/:id/variables', () => {
      it('should add variable', async () => {
        OrchestrationManager.addVariable.mockResolvedValueOnce({
          id: 1,
          name: 'counter',
          type: 'number'
        });

        const response = await request(app)
          .post('/api/orchestrations/1/variables')
          .send({ name: 'counter', type: 'number' });

        expect(response.status).toBe(201);
      });

      it('should reject missing name', async () => {
        const response = await request(app)
          .post('/api/orchestrations/1/variables')
          .send({ type: 'string' });

        expect(response.status).toBe(400);
      });
    });
  });

  describe('Execution', () => {
    describe('POST /api/orchestrations/:id/execute', () => {
      it('should execute orchestration', async () => {
        OrchestrationManager.executeOrchestration.mockResolvedValueOnce({
          output: 'Hello!',
          nextFlow: 2
        });

        const response = await request(app)
          .post('/api/orchestrations/1/execute')
          .send({ session_id: 'session-123', input: 'hello' });

        expect(response.status).toBe(200);
        expect(response.body.data.output).toBe('Hello!');
      });

      it('should reject missing session_id', async () => {
        const response = await request(app)
          .post('/api/orchestrations/1/execute')
          .send({ input: 'hello' });

        expect(response.status).toBe(400);
      });
    });
  });
});
