/**
 * Widget Routes Tests
 * Tests for server/routes/widget.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', current_organization_id: 1 };
  next();
}));

jest.mock('../../services/ai', () => ({
  AIProviderFactory: {
    getProvider: jest.fn(() => ({
      chat: jest.fn().mockResolvedValue({ content: 'AI response' })
    }))
  },
  AIMessageHandler: {},
  EncryptionHelper: {
    decrypt: jest.fn((key) => 'decrypted-api-key')
  }
}));

jest.mock('../../services/ragService', () => ({
  getContextForQuery: jest.fn().mockResolvedValue({ hasContext: false }),
  buildRAGPrompt: jest.fn((prompt, context) => prompt)
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
const widgetRouter = require('../../routes/widget');

const app = express();
app.use(express.json());
app.use('/api/widget', widgetRouter);

describe('Widget Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/widget/:botId/config', () => {
    it('should return widget config', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot' }] }) // Bot check
        .mockResolvedValueOnce({ rows: [{ config: { theme: 'dark' } }] }); // Config

      const response = await request(app).get('/api/widget/1/config');

      expect(response.status).toBe(200);
      expect(response.body.config).toBeDefined();
    });

    it('should return empty config if none exists', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/widget/1/config');

      expect(response.status).toBe(200);
      expect(response.body.config).toEqual({});
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/widget/999/config');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/widget/:botId/config', () => {
    it('should save widget config', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Bot check
        .mockResolvedValueOnce({ rows: [{ config: { theme: 'light' } }] }); // Upsert

      const response = await request(app)
        .put('/api/widget/1/config')
        .send({ config: { theme: 'light' } });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/widget/999/config')
        .send({ config: {} });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/widget/:botId/public-config', () => {
    it('should return public config without auth', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Public Bot', system_prompt: 'Hello' }] })
        .mockResolvedValueOnce({ rows: [{ config: '{"welcome":"Hi!"}' }] });

      const response = await request(app).get('/api/widget/1/public-config');

      expect(response.status).toBe(200);
      expect(response.body.botId).toBe('1');
      expect(response.body.botName).toBe('Public Bot');
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/widget/999/public-config');

      expect(response.status).toBe(404);
    });

    it('should handle already parsed config', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot' }] })
        .mockResolvedValueOnce({ rows: [{ config: { theme: 'dark' } }] });

      const response = await request(app).get('/api/widget/1/public-config');

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/widget/:botId/message', () => {
    it('should process message and return AI response', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'en' }] }) // Bot check
        .mockResolvedValueOnce({ rows: [] }) // Store user message
        .mockResolvedValueOnce({ rows: [{ // AI config
          provider: 'openai',
          model: 'gpt-4',
          is_enabled: true,
          api_key_encrypted: 'encrypted-key',
          system_prompt: 'You are helpful',
          context_window: 10
        }] })
        .mockResolvedValueOnce({ rows: [] }) // History
        .mockResolvedValueOnce({ rows: [] }); // Store bot message

      const response = await request(app)
        .post('/api/widget/1/message')
        .send({ sessionId: 'session-123', message: 'Hello' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject missing sessionId', async () => {
      const response = await request(app)
        .post('/api/widget/1/message')
        .send({ message: 'Hello' });

      expect(response.status).toBe(400);
    });

    it('should reject missing message', async () => {
      const response = await request(app)
        .post('/api/widget/1/message')
        .send({ sessionId: 'session-123' });

      expect(response.status).toBe(400);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/widget/999/message')
        .send({ sessionId: 'session-123', message: 'Hello' });

      expect(response.status).toBe(404);
    });

    it('should handle bot without AI config', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] }) // Store message
        .mockResolvedValueOnce({ rows: [] }) // No AI config
        .mockResolvedValueOnce({ rows: [] }); // Store response

      const response = await request(app)
        .post('/api/widget/1/message')
        .send({ sessionId: 'session-123', message: 'Hello' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('AI is not configured');
    });
  });

  describe('GET /api/widget/:botId/history/:sessionId', () => {
    it('should return conversation history', async () => {
      db.query.mockResolvedValueOnce({ rows: [
        { id: 1, role: 'user', content: 'Hello', created_at: new Date() },
        { id: 2, role: 'assistant', content: 'Hi!', created_at: new Date() }
      ] });

      const response = await request(app).get('/api/widget/1/history/session-123');

      expect(response.status).toBe(200);
      expect(response.body.messages).toHaveLength(2);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/widget/1/history/session-123');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/widget/upload', () => {
    it('should return error when no file uploaded', async () => {
      const response = await request(app)
        .post('/api/widget/upload')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('No file');
    });
  });

  describe('GET /api/widget/:botId/analytics', () => {
    it('should return widget analytics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ user_messages: '100', bot_messages: '100', sessions: '50' }] })
        .mockResolvedValueOnce({ rows: [
          { date: '2024-01-01', count: 20 },
          { date: '2024-01-02', count: 30 }
        ] });

      const response = await request(app).get('/api/widget/1/analytics');

      expect(response.status).toBe(200);
      expect(response.body.totals).toBeDefined();
      expect(response.body.daily).toBeDefined();
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/widget/1/analytics');

      expect(response.status).toBe(500);
    });
  });

  describe('OPTIONS (CORS preflight)', () => {
    it('should handle preflight requests', async () => {
      const response = await request(app).options('/api/widget/1/public-config');

      expect(response.status).toBe(200);
    });
  });
});
