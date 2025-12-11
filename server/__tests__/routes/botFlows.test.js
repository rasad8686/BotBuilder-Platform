/**
 * BotFlows Routes Tests
 * Tests for server/routes/botFlows.js
 */

jest.mock('../../db', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn()
  };
  return {
    query: jest.fn(),
    pool: {
      connect: jest.fn().mockResolvedValue(mockClient)
    }
  };
});

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
}));

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: jest.fn((req, res, next) => {
    req.organization = { id: 1, name: 'Test Org' };
    next();
  }),
  requireOrganization: jest.fn((req, res, next) => next())
}));

jest.mock('../../middleware/checkPermission', () => ({
  checkPermission: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const db = require('../../db');
const botFlowsRouter = require('../../routes/botFlows');

const app = express();
app.use(express.json());
app.use('/api/bot-flows', botFlowsRouter);

describe('BotFlows Routes', () => {
  let mockClient;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockClient = await db.pool.connect();
    mockClient.query.mockReset();
  });

  describe('POST /:botId/flow', () => {
    it('should create flow successfully', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Bot verification

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ next_version: 1 }] }) // Get next version
        .mockResolvedValueOnce({ rows: [] }) // Deactivate previous
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          bot_id: 1,
          flow_data: { nodes: [], edges: [] },
          version: 1,
          is_active: true
        }] }) // Insert
        .mockResolvedValueOnce({}); // COMMIT

      const response = await request(app)
        .post('/api/bot-flows/1/flow')
        .send({ flowData: { nodes: [], edges: [] } });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid botId', async () => {
      const response = await request(app)
        .post('/api/bot-flows/abc/flow')
        .send({ flowData: { nodes: [] } });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid bot ID');
    });

    it('should reject missing flowData', async () => {
      const response = await request(app)
        .post('/api/bot-flows/1/flow')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Flow data is required');
    });

    it('should reject non-object flowData', async () => {
      const response = await request(app)
        .post('/api/bot-flows/1/flow')
        .send({ flowData: 'not an object' });

      expect(response.status).toBe(400);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/bot-flows/999/flow')
        .send({ flowData: { nodes: [] } });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /:botId/flow', () => {
    it('should return active flow', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Bot verification
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          bot_id: 1,
          flow_data: { nodes: [], edges: [] },
          version: 1,
          is_active: true
        }] });

      const response = await request(app).get('/api/bot-flows/1/flow');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.is_active).toBe(true);
    });

    it('should return null if no active flow', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/bot-flows/1/flow');

      expect(response.status).toBe(200);
      expect(response.body.data).toBeNull();
    });

    it('should reject invalid botId', async () => {
      const response = await request(app).get('/api/bot-flows/abc/flow');

      expect(response.status).toBe(400);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/bot-flows/999/flow');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /:botId/flow/:flowId', () => {
    it('should update flow', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Bot verification

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, version: 1 }] }) // Check flow exists
        .mockResolvedValueOnce({ rows: [{ next_version: 2 }] }) // Get next version
        .mockResolvedValueOnce({ rows: [] }) // Deactivate previous
        .mockResolvedValueOnce({ rows: [{
          id: 2,
          bot_id: 1,
          flow_data: { nodes: [{ id: 'new' }] },
          version: 2,
          is_active: true
        }] }) // Insert new version
        .mockResolvedValueOnce({}); // COMMIT

      const response = await request(app)
        .put('/api/bot-flows/1/flow/1')
        .send({ flowData: { nodes: [{ id: 'new' }] } });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid IDs', async () => {
      const response = await request(app)
        .put('/api/bot-flows/abc/flow/1')
        .send({ flowData: { nodes: [] } });

      expect(response.status).toBe(400);
    });

    it('should reject missing flowData', async () => {
      const response = await request(app)
        .put('/api/bot-flows/1/flow/1')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 404 if flow not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Flow not found
        .mockResolvedValueOnce({}); // ROLLBACK

      const response = await request(app)
        .put('/api/bot-flows/1/flow/999')
        .send({ flowData: { nodes: [] } });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /:botId/flow/history', () => {
    it('should return flow history', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Bot verification
        .mockResolvedValueOnce({ rows: [
          { id: 2, version: 2, is_active: true },
          { id: 1, version: 1, is_active: false }
        ] });

      const response = await request(app).get('/api/bot-flows/1/flow/history');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it('should reject invalid botId', async () => {
      const response = await request(app).get('/api/bot-flows/abc/flow/history');

      expect(response.status).toBe(400);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/bot-flows/999/flow/history');

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/bot-flows/1/flow/history');

      expect(response.status).toBe(500);
    });
  });
});
