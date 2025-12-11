/**
 * AI Routes Tests
 * Tests for server/routes/ai.js
 */

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', current_organization_id: 1 };
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

jest.mock('../../controllers/aiController', () => ({
  getProviders: jest.fn((req, res) => res.json({ providers: ['openai', 'claude'] })),
  getModels: jest.fn((req, res) => res.json({ models: ['gpt-4', 'gpt-3.5-turbo'] })),
  getAIConfig: jest.fn((req, res) => res.json({ config: { provider: 'openai' } })),
  configureAI: jest.fn((req, res) => res.status(201).json({ success: true })),
  deleteAIConfig: jest.fn((req, res) => res.json({ message: 'Deleted' })),
  testAIConnection: jest.fn((req, res) => res.json({ success: true, message: 'Connection successful' })),
  sendChat: jest.fn((req, res) => res.json({ response: 'Hello!' })),
  sendChatStream: jest.fn((req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.write('data: {"type":"done"}\n\n');
    res.end();
  }),
  getAIUsage: jest.fn((req, res) => res.json({ usage: { totalTokens: 1000 } })),
  getOrganizationAIBilling: jest.fn((req, res) => res.json({ billing: { total: 10.50 } }))
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const aiController = require('../../controllers/aiController');
const aiRouter = require('../../routes/ai');

const app = express();
app.use(express.json());
app.use('/api/ai', aiRouter);

describe('AI Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Public Routes', () => {
    describe('GET /api/ai/providers', () => {
      it('should return available providers', async () => {
        const response = await request(app).get('/api/ai/providers');

        expect(response.status).toBe(200);
        expect(response.body.providers).toBeDefined();
        expect(aiController.getProviders).toHaveBeenCalled();
      });
    });

    describe('GET /api/ai/models/:provider', () => {
      it('should return models for provider', async () => {
        const response = await request(app).get('/api/ai/models/openai');

        expect(response.status).toBe(200);
        expect(response.body.models).toBeDefined();
        expect(aiController.getModels).toHaveBeenCalled();
      });
    });
  });

  describe('Bot AI Configuration', () => {
    describe('GET /api/ai/:botId/ai/configure', () => {
      it('should return AI config for bot', async () => {
        const response = await request(app).get('/api/ai/1/ai/configure');

        expect(response.status).toBe(200);
        expect(response.body.config).toBeDefined();
        expect(aiController.getAIConfig).toHaveBeenCalled();
      });
    });

    describe('POST /api/ai/:botId/ai/configure', () => {
      it('should configure AI for bot', async () => {
        const response = await request(app)
          .post('/api/ai/1/ai/configure')
          .send({
            provider: 'openai',
            model: 'gpt-4',
            api_key: 'sk-test-key'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(aiController.configureAI).toHaveBeenCalled();
      });
    });

    describe('DELETE /api/ai/:botId/ai/configure', () => {
      it('should delete AI config', async () => {
        const response = await request(app).delete('/api/ai/1/ai/configure');

        expect(response.status).toBe(200);
        expect(aiController.deleteAIConfig).toHaveBeenCalled();
      });
    });

    describe('POST /api/ai/:botId/ai/test', () => {
      it('should test AI connection', async () => {
        const response = await request(app)
          .post('/api/ai/1/ai/test')
          .send({});

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(aiController.testAIConnection).toHaveBeenCalled();
      });
    });
  });

  describe('AI Chat', () => {
    describe('POST /api/ai/:botId/ai/chat', () => {
      it('should send chat message', async () => {
        const response = await request(app)
          .post('/api/ai/1/ai/chat')
          .send({
            message: 'Hello',
            sessionId: 'session-123'
          });

        expect(response.status).toBe(200);
        expect(response.body.response).toBeDefined();
        expect(aiController.sendChat).toHaveBeenCalled();
      });
    });

    describe('POST /api/ai/:botId/ai/chat/stream', () => {
      it('should stream chat response', async () => {
        const response = await request(app)
          .post('/api/ai/1/ai/chat/stream')
          .send({
            message: 'Hello',
            sessionId: 'session-123'
          });

        expect(response.status).toBe(200);
        expect(aiController.sendChatStream).toHaveBeenCalled();
      });
    });
  });

  describe('AI Usage & Billing', () => {
    describe('GET /api/ai/:botId/ai/usage', () => {
      it('should return usage statistics', async () => {
        const response = await request(app).get('/api/ai/1/ai/usage');

        expect(response.status).toBe(200);
        expect(response.body.usage).toBeDefined();
        expect(aiController.getAIUsage).toHaveBeenCalled();
      });
    });

    describe('GET /api/ai/organizations/:orgId/ai/billing', () => {
      it('should return organization billing', async () => {
        const response = await request(app).get('/api/ai/organizations/1/ai/billing');

        expect(response.status).toBe(200);
        expect(response.body.billing).toBeDefined();
        expect(aiController.getOrganizationAIBilling).toHaveBeenCalled();
      });
    });
  });
});
