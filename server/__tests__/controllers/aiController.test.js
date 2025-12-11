/**
 * AI Controller Tests
 * Tests for server/controllers/aiController.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../services/ai', () => ({
  AIProviderFactory: {
    getSupportedProviders: jest.fn(() => ['openai', 'claude']),
    getModelsForProvider: jest.fn((provider) => {
      if (provider === 'openai') return ['gpt-4', 'gpt-3.5-turbo'];
      if (provider === 'claude') return ['claude-3-opus', 'claude-3-sonnet'];
      return [];
    }),
    validateConfig: jest.fn(() => ({ valid: true })),
    getProvider: jest.fn(() => ({
      chat: jest.fn().mockResolvedValue({
        content: 'AI response',
        usage: { promptTokens: 50, completionTokens: 50, totalTokens: 100 },
        responseTime: 500
      }),
      testConnection: jest.fn().mockResolvedValue({ success: true, latency: 100 })
    }))
  },
  AIMessageHandler: {
    buildMessagesWithContext: jest.fn().mockResolvedValue([
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello' }
    ]),
    saveMessage: jest.fn().mockResolvedValue(true)
  },
  AICostCalculator: {
    calculateCost: jest.fn(() => 0.01)
  },
  EncryptionHelper: {
    encrypt: jest.fn((key) => 'encrypted_' + key),
    decrypt: jest.fn(() => 'sk-test-key'),
    validateApiKeyFormat: jest.fn(() => ({ valid: true }))
  }
}));

jest.mock('../../services/webhookService', () => ({
  trigger: jest.fn().mockResolvedValue(true)
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

const db = require('../../db');
const {
  getAIConfig,
  configureAI,
  deleteAIConfig,
  sendChat,
  testAIConnection,
  getAIUsage,
  getProviders,
  getModels
} = require('../../controllers/aiController');

describe('AI Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      organization: { id: 1 },
      user: { id: 1 },
      params: { botId: 1 },
      body: {},
      query: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn()
    };
  });

  describe('getProviders', () => {
    it('should return available providers', () => {
      getProviders(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        providers: expect.any(Array)
      }));
    });
  });

  describe('getModels', () => {
    it('should return models for provider', () => {
      mockReq.params = { provider: 'openai' };

      getModels(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        provider: 'openai',
        models: expect.any(Array)
      }));
    });

    it('should return 404 for unknown provider', () => {
      mockReq.params = { provider: 'unknown' };

      getModels(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getAIConfig', () => {
    it('should return AI config for bot', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Bot check
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          bot_id: 1,
          provider: 'openai',
          model: 'gpt-4',
          has_custom_key: true
        }] });

      await getAIConfig(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        config: expect.any(Object)
      }));
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await getAIConfig(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 404 if config not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      await getAIConfig(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      await getAIConfig(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('configureAI', () => {
    it('should create AI config', async () => {
      mockReq.body = {
        provider: 'openai',
        model: 'gpt-4',
        api_key: 'sk-test-key'
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot' }] }) // Bot check
        .mockResolvedValueOnce({ rows: [] }) // No existing config
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Insert

      await configureAI(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should update existing AI config', async () => {
      mockReq.body = {
        provider: 'openai',
        model: 'gpt-4'
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Existing config
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Update

      await configureAI(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should reject missing provider', async () => {
      mockReq.body = { model: 'gpt-4' };

      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await configureAI(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if bot not found', async () => {
      mockReq.body = { provider: 'openai', model: 'gpt-4' };
      db.query.mockResolvedValueOnce({ rows: [] });

      await configureAI(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteAIConfig', () => {
    it('should delete AI config', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Bot check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Delete

      await deleteAIConfig(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await deleteAIConfig(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 404 if config not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      await deleteAIConfig(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('testAIConnection', () => {
    it('should test AI connection successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Bot check
        .mockResolvedValueOnce({ rows: [{
          provider: 'openai',
          model: 'gpt-4',
          api_key_encrypted: 'encrypted_key'
        }] });

      await testAIConnection(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });

    it('should return 400 if no config', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      await testAIConnection(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await testAIConnection(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('sendChat', () => {
    it('should send chat message', async () => {
      mockReq.body = { message: 'Hello', sessionId: 'session-123' };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, language: 'en' }] }) // Bot check
        .mockResolvedValueOnce({ rows: [{
          provider: 'openai',
          model: 'gpt-4',
          api_key_encrypted: 'encrypted_key',
          system_prompt: 'You are helpful',
          context_window: 10,
          is_enabled: true,
          temperature: 0.7,
          max_tokens: 1000
        }] }) // AI config
        .mockResolvedValueOnce({ rows: [] }); // Log usage

      await sendChat(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should reject missing message', async () => {
      mockReq.body = { sessionId: 'session-123' };

      await sendChat(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should reject missing sessionId', async () => {
      mockReq.body = { message: 'Hello' };

      await sendChat(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if bot not found', async () => {
      mockReq.body = { message: 'Hello', sessionId: 'session-123' };
      db.query.mockResolvedValueOnce({ rows: [] });

      await sendChat(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getAIUsage', () => {
    beforeEach(() => {
      db.query.mockReset();
    });

    it('should return AI usage statistics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Bot check
        .mockResolvedValueOnce({ rows: [
          { date: '2024-01-01', total_tokens: 1000, cost: 0.10 }
        ] }) // Usage logs
        .mockResolvedValueOnce({ rows: [{
          total_requests: '10',
          total_prompt_tokens: '500',
          total_completion_tokens: '500',
          total_tokens: '1000',
          total_cost: '0.10',
          avg_response_time: '500',
          successful_requests: '9',
          failed_requests: '1'
        }] }); // Summary

      await getAIUsage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        usage: expect.any(Array)
      }));
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await getAIUsage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      await getAIUsage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
