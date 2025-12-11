/**
 * Intents Routes Tests
 * Tests for server/routes/intents.js
 */

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', current_organization_id: 1 };
  next();
}));

jest.mock('../../services/IntentEntityManager', () => {
  return jest.fn().mockImplementation(() => ({
    getIntents: jest.fn(),
    createIntent: jest.fn(),
    getIntent: jest.fn(),
    updateIntent: jest.fn(),
    deleteIntent: jest.fn(),
    getExamples: jest.fn(),
    addExample: jest.fn(),
    bulkAddExamples: jest.fn(),
    deleteExample: jest.fn()
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
const intentsRouter = require('../../routes/intents');

const app = express();
app.use(express.json());
app.use('/api/intents', intentsRouter);

// Get the mocked manager instance
const mockManager = IntentEntityManager.mock.results[0]?.value || new IntentEntityManager();

describe('Intents Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/intents', () => {
    it('should return empty array if no bot_id', async () => {
      const response = await request(app).get('/api/intents');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return intents for bot', async () => {
      mockManager.getIntents.mockResolvedValueOnce([
        { id: 1, name: 'greeting', displayName: 'Greeting' },
        { id: 2, name: 'farewell', displayName: 'Farewell' }
      ]);

      const response = await request(app).get('/api/intents?bot_id=1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should handle errors', async () => {
      mockManager.getIntents.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/intents?bot_id=1');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/intents', () => {
    it('should create intent', async () => {
      mockManager.createIntent.mockResolvedValueOnce({
        id: 1,
        bot_id: 1,
        name: 'greeting',
        displayName: 'Greeting'
      });

      const response = await request(app)
        .post('/api/intents')
        .send({
          bot_id: 1,
          name: 'greeting',
          displayName: 'Greeting'
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('greeting');
    });

    it('should reject missing bot_id', async () => {
      const response = await request(app)
        .post('/api/intents')
        .send({ name: 'greeting' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('bot_id and name');
    });

    it('should reject missing name', async () => {
      const response = await request(app)
        .post('/api/intents')
        .send({ bot_id: 1 });

      expect(response.status).toBe(400);
    });

    it('should handle errors', async () => {
      mockManager.createIntent.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app)
        .post('/api/intents')
        .send({ bot_id: 1, name: 'test' });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/intents/:id', () => {
    it('should return single intent', async () => {
      mockManager.getIntent.mockResolvedValueOnce({
        id: 1,
        name: 'greeting',
        displayName: 'Greeting'
      });

      const response = await request(app).get('/api/intents/1');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('greeting');
    });

    it('should return 404 if not found', async () => {
      mockManager.getIntent.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/intents/999');

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      mockManager.getIntent.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/intents/1');

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/intents/:id', () => {
    it('should update intent', async () => {
      mockManager.updateIntent.mockResolvedValueOnce({
        id: 1,
        name: 'greeting',
        displayName: 'Updated Greeting'
      });

      const response = await request(app)
        .put('/api/intents/1')
        .send({ displayName: 'Updated Greeting' });

      expect(response.status).toBe(200);
      expect(response.body.displayName).toBe('Updated Greeting');
    });

    it('should return 404 if not found', async () => {
      mockManager.updateIntent.mockResolvedValueOnce(null);

      const response = await request(app)
        .put('/api/intents/999')
        .send({ displayName: 'Test' });

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      mockManager.updateIntent.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app)
        .put('/api/intents/1')
        .send({ displayName: 'Test' });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/intents/:id', () => {
    it('should delete intent', async () => {
      mockManager.deleteIntent.mockResolvedValueOnce(true);

      const response = await request(app).delete('/api/intents/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      mockManager.deleteIntent.mockResolvedValueOnce(false);

      const response = await request(app).delete('/api/intents/999');

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      mockManager.deleteIntent.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).delete('/api/intents/1');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/intents/:id/examples', () => {
    it('should return examples', async () => {
      mockManager.getExamples.mockResolvedValueOnce([
        { id: 1, text: 'hello', language: 'en' },
        { id: 2, text: 'hi there', language: 'en' }
      ]);

      const response = await request(app).get('/api/intents/1/examples');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should handle errors', async () => {
      mockManager.getExamples.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/intents/1/examples');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/intents/:id/examples', () => {
    it('should add example', async () => {
      mockManager.addExample.mockResolvedValueOnce({
        id: 1,
        text: 'hello',
        language: 'en'
      });

      const response = await request(app)
        .post('/api/intents/1/examples')
        .send({ text: 'hello', language: 'en' });

      expect(response.status).toBe(201);
      expect(response.body.text).toBe('hello');
    });

    it('should reject missing text', async () => {
      const response = await request(app)
        .post('/api/intents/1/examples')
        .send({ language: 'en' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('text is required');
    });

    it('should handle errors', async () => {
      mockManager.addExample.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app)
        .post('/api/intents/1/examples')
        .send({ text: 'hello' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/intents/:id/examples/bulk', () => {
    it('should bulk add examples', async () => {
      mockManager.bulkAddExamples.mockResolvedValueOnce([
        { id: 1, text: 'hello' },
        { id: 2, text: 'hi' }
      ]);

      const response = await request(app)
        .post('/api/intents/1/examples/bulk')
        .send({ examples: [{ text: 'hello' }, { text: 'hi' }] });

      expect(response.status).toBe(201);
      expect(response.body).toHaveLength(2);
    });

    it('should reject missing examples array', async () => {
      const response = await request(app)
        .post('/api/intents/1/examples/bulk')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('examples array');
    });

    it('should reject non-array examples', async () => {
      const response = await request(app)
        .post('/api/intents/1/examples/bulk')
        .send({ examples: 'not an array' });

      expect(response.status).toBe(400);
    });

    it('should handle errors', async () => {
      mockManager.bulkAddExamples.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app)
        .post('/api/intents/1/examples/bulk')
        .send({ examples: [{ text: 'hello' }] });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/intents/:id/examples/:exampleId', () => {
    it('should delete example', async () => {
      mockManager.deleteExample.mockResolvedValueOnce(true);

      const response = await request(app).delete('/api/intents/1/examples/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      mockManager.deleteExample.mockResolvedValueOnce(false);

      const response = await request(app).delete('/api/intents/1/examples/999');

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      mockManager.deleteExample.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).delete('/api/intents/1/examples/1');

      expect(response.status).toBe(500);
    });
  });
});
