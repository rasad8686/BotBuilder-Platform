/**
 * Entities Routes Tests
 * Tests for server/routes/entities.js
 */

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', current_organization_id: 1 };
  next();
}));

jest.mock('../../services/IntentEntityManager', () => {
  return jest.fn().mockImplementation(() => ({
    getEntities: jest.fn(),
    createEntity: jest.fn(),
    getEntity: jest.fn(),
    updateEntity: jest.fn(),
    deleteEntity: jest.fn(),
    getValues: jest.fn(),
    addValue: jest.fn(),
    deleteValue: jest.fn()
  }));
});

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const IntentEntityManager = require('../../services/IntentEntityManager');
const entitiesRouter = require('../../routes/entities');

const app = express();
app.use(express.json());
app.use('/api/entities', entitiesRouter);

// Get the mocked manager instance
const mockManager = IntentEntityManager.mock.results[0]?.value || new IntentEntityManager();

describe('Entities Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/entities', () => {
    it('should return empty array if no bot_id', async () => {
      const response = await request(app).get('/api/entities');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return entities for bot', async () => {
      mockManager.getEntities.mockResolvedValueOnce([
        { id: 1, name: 'color', displayName: 'Color' },
        { id: 2, name: 'size', displayName: 'Size' }
      ]);

      const response = await request(app).get('/api/entities?bot_id=1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should handle errors', async () => {
      mockManager.getEntities.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/entities?bot_id=1');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/entities', () => {
    it('should create entity', async () => {
      mockManager.createEntity.mockResolvedValueOnce({
        id: 1,
        bot_id: 1,
        name: 'color',
        displayName: 'Color',
        type: 'list'
      });

      const response = await request(app)
        .post('/api/entities')
        .send({
          bot_id: 1,
          name: 'color',
          displayName: 'Color',
          type: 'list'
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('color');
    });

    it('should reject missing bot_id', async () => {
      const response = await request(app)
        .post('/api/entities')
        .send({ name: 'color' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('bot_id and name');
    });

    it('should reject missing name', async () => {
      const response = await request(app)
        .post('/api/entities')
        .send({ bot_id: 1 });

      expect(response.status).toBe(400);
    });

    it('should handle errors', async () => {
      mockManager.createEntity.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app)
        .post('/api/entities')
        .send({ bot_id: 1, name: 'test' });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/entities/:id', () => {
    it('should return single entity', async () => {
      mockManager.getEntity.mockResolvedValueOnce({
        id: 1,
        name: 'color',
        displayName: 'Color'
      });

      const response = await request(app).get('/api/entities/1');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('color');
    });

    it('should return 404 if not found', async () => {
      mockManager.getEntity.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/entities/999');

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      mockManager.getEntity.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/entities/1');

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/entities/:id', () => {
    it('should update entity', async () => {
      mockManager.updateEntity.mockResolvedValueOnce({
        id: 1,
        name: 'color',
        displayName: 'Updated Color'
      });

      const response = await request(app)
        .put('/api/entities/1')
        .send({ displayName: 'Updated Color' });

      expect(response.status).toBe(200);
      expect(response.body.displayName).toBe('Updated Color');
    });

    it('should return 404 if not found', async () => {
      mockManager.updateEntity.mockResolvedValueOnce(null);

      const response = await request(app)
        .put('/api/entities/999')
        .send({ displayName: 'Test' });

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      mockManager.updateEntity.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app)
        .put('/api/entities/1')
        .send({ displayName: 'Test' });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/entities/:id', () => {
    it('should delete entity', async () => {
      mockManager.deleteEntity.mockResolvedValueOnce(true);

      const response = await request(app).delete('/api/entities/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 if not found or system entity', async () => {
      mockManager.deleteEntity.mockResolvedValueOnce(false);

      const response = await request(app).delete('/api/entities/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should handle errors', async () => {
      mockManager.deleteEntity.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).delete('/api/entities/1');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/entities/:id/values', () => {
    it('should return entity values', async () => {
      mockManager.getValues.mockResolvedValueOnce([
        { id: 1, value: 'red', synonyms: ['crimson', 'scarlet'] },
        { id: 2, value: 'blue', synonyms: ['navy'] }
      ]);

      const response = await request(app).get('/api/entities/1/values');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should handle errors', async () => {
      mockManager.getValues.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/entities/1/values');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/entities/:id/values', () => {
    it('should add value', async () => {
      mockManager.addValue.mockResolvedValueOnce({
        id: 1,
        value: 'red',
        synonyms: ['crimson']
      });

      const response = await request(app)
        .post('/api/entities/1/values')
        .send({ value: 'red', synonyms: ['crimson'] });

      expect(response.status).toBe(201);
      expect(response.body.value).toBe('red');
    });

    it('should reject missing value', async () => {
      const response = await request(app)
        .post('/api/entities/1/values')
        .send({ synonyms: ['test'] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('value is required');
    });

    it('should handle errors', async () => {
      mockManager.addValue.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app)
        .post('/api/entities/1/values')
        .send({ value: 'red' });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/entities/:id/values/:valueId', () => {
    it('should delete value', async () => {
      mockManager.deleteValue.mockResolvedValueOnce(true);

      const response = await request(app).delete('/api/entities/1/values/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      mockManager.deleteValue.mockResolvedValueOnce(false);

      const response = await request(app).delete('/api/entities/1/values/999');

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      mockManager.deleteValue.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).delete('/api/entities/1/values/1');

      expect(response.status).toBe(500);
    });
  });
});
