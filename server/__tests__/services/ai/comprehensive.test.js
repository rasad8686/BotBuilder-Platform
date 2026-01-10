/**
 * Comprehensive AI Services Tests
 * Extensive tests for all AI-related services with focus on:
 * - Provider initialization and selection
 * - Message processing and handling
 * - Context management and conversation history
 * - Token counting and cost calculation
 * - Error handling and retry logic
 * - Rate limiting
 * - Prompt building and formatting
 */

// Mock dependencies
jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }))
  };
}, { virtual: true });

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn()
    }
  }));
}, { virtual: true });

const db = require('../../../db');
const logger = require('../../../utils/logger');
const AIProviderFactory = require('../../../services/ai/aiProviderFactory');
const AIMessageHandler = require('../../../services/ai/aiMessageHandler');
const AICostCalculator = require('../../../services/ai/aiCostCalculator');
const OpenAIService = require('../../../services/ai/openaiService');
const ClaudeService = require('../../../services/ai/claudeService');

describe('Comprehensive AI Services Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // PROVIDER FACTORY TESTS (30 tests)
  // ============================================================================

  describe('AIProviderFactory - Provider Selection and Initialization', () => {
    describe('getProvider - Basic Provider Creation', () => {
      it('should create OpenAI provider with valid config', () => {
        const config = {
          provider: 'openai',
          apiKey: 'sk-test-openai-key-12345',
          model: 'gpt-4o'
        };

        const provider = AIProviderFactory.getProvider(config);

        expect(provider).toBeDefined();
        expect(provider.model).toBe('gpt-4o');
      });

      it('should create Claude provider with valid config', () => {
        const config = {
          provider: 'claude',
          apiKey: 'sk-ant-test-key-12345',
          model: 'claude-sonnet-4-5'
        };

        const provider = AIProviderFactory.getProvider(config);

        expect(provider).toBeDefined();
        expect(provider.model).toBe('claude-sonnet-4-5');
      });

      it('should handle uppercase provider names', () => {
        const config = {
          provider: 'OPENAI',
          apiKey: 'sk-test-key',
          model: 'gpt-4o'
        };

        expect(() => AIProviderFactory.getProvider(config)).not.toThrow();
      });

      it('should handle mixed case provider names', () => {
        const config = {
          provider: 'ClAuDe',
          apiKey: 'sk-ant-key',
          model: 'claude-haiku-4-5'
        };

        expect(() => AIProviderFactory.getProvider(config)).not.toThrow();
      });

      it('should throw error for null provider', () => {
        expect(() => AIProviderFactory.getProvider({
          provider: null,
          apiKey: 'sk-test',
          model: 'gpt-4o'
        })).toThrow('AI provider is required');
      });

      it('should throw error for undefined provider', () => {
        expect(() => AIProviderFactory.getProvider({
          apiKey: 'sk-test',
          model: 'gpt-4o'
        })).toThrow('AI provider is required');
      });

      it('should throw error for empty string provider', () => {
        expect(() => AIProviderFactory.getProvider({
          provider: '',
          apiKey: 'sk-test',
          model: 'gpt-4o'
        })).toThrow('AI provider is required');
      });

      it('should throw error for unsupported provider (gemini)', () => {
        expect(() => AIProviderFactory.getProvider({
          provider: 'gemini',
          apiKey: 'test-key',
          model: 'gemini-pro'
        })).toThrow('Unsupported AI provider: gemini');
      });

      it('should throw error for unsupported provider (grok)', () => {
        expect(() => AIProviderFactory.getProvider({
          provider: 'grok',
          apiKey: 'test-key',
          model: 'grok-1'
        })).toThrow('Unsupported AI provider: grok');
      });

      it('should throw error for missing API key', () => {
        expect(() => AIProviderFactory.getProvider({
          provider: 'openai',
          model: 'gpt-4o'
        })).toThrow('API key is required');
      });

      it('should throw error for null API key', () => {
        expect(() => AIProviderFactory.getProvider({
          provider: 'openai',
          apiKey: null,
          model: 'gpt-4o'
        })).toThrow('API key is required');
      });

      it('should throw error for empty API key', () => {
        expect(() => AIProviderFactory.getProvider({
          provider: 'openai',
          apiKey: '',
          model: 'gpt-4o'
        })).toThrow('API key is required');
      });

      it('should throw error for missing model', () => {
        expect(() => AIProviderFactory.getProvider({
          provider: 'openai',
          apiKey: 'sk-test-key'
        })).toThrow('Model is required');
      });

      it('should throw error for null model', () => {
        expect(() => AIProviderFactory.getProvider({
          provider: 'openai',
          apiKey: 'sk-test-key',
          model: null
        })).toThrow('Model is required');
      });

      it('should throw error for empty model', () => {
        expect(() => AIProviderFactory.getProvider({
          provider: 'openai',
          apiKey: 'sk-test-key',
          model: ''
        })).toThrow('Model is required');
      });
    });

    describe('getSupportedProviders - Provider Listing', () => {
      it('should return array of supported providers', () => {
        const providers = AIProviderFactory.getSupportedProviders();

        expect(Array.isArray(providers)).toBe(true);
        expect(providers.length).toBeGreaterThan(0);
      });

      it('should include openai in supported providers', () => {
        const providers = AIProviderFactory.getSupportedProviders();
        expect(providers).toContain('openai');
      });

      it('should include claude in supported providers', () => {
        const providers = AIProviderFactory.getSupportedProviders();
        expect(providers).toContain('claude');
      });

      it('should return exactly 2 supported providers', () => {
        const providers = AIProviderFactory.getSupportedProviders();
        expect(providers.length).toBe(2);
      });

      it('should return lowercase provider names', () => {
        const providers = AIProviderFactory.getSupportedProviders();
        providers.forEach(provider => {
          expect(provider).toBe(provider.toLowerCase());
        });
      });
    });

    describe('getModelsForProvider - Model Listing', () => {
      it('should return OpenAI models with proper structure', () => {
        const models = AIProviderFactory.getModelsForProvider('openai');

        expect(Array.isArray(models)).toBe(true);
        expect(models.length).toBeGreaterThan(0);
        expect(models[0]).toHaveProperty('id');
        expect(models[0]).toHaveProperty('name');
        expect(models[0]).toHaveProperty('description');
        expect(models[0]).toHaveProperty('contextWindow');
        expect(models[0]).toHaveProperty('maxTokens');
        expect(models[0]).toHaveProperty('pricing');
      });

      it('should return Claude models with proper structure', () => {
        const models = AIProviderFactory.getModelsForProvider('claude');

        expect(Array.isArray(models)).toBe(true);
        expect(models.length).toBeGreaterThan(0);
        expect(models[0]).toHaveProperty('id');
        expect(models[0]).toHaveProperty('pricing');
      });

      it('should return pricing with input and output costs', () => {
        const models = AIProviderFactory.getModelsForProvider('openai');

        expect(models[0].pricing).toHaveProperty('input');
        expect(models[0].pricing).toHaveProperty('output');
        expect(typeof models[0].pricing.input).toBe('number');
        expect(typeof models[0].pricing.output).toBe('number');
      });

      it('should handle case-insensitive provider names for models', () => {
        const models1 = AIProviderFactory.getModelsForProvider('openai');
        const models2 = AIProviderFactory.getModelsForProvider('OPENAI');

        expect(models1).toEqual(models2);
      });

      it('should return empty array for unknown provider', () => {
        const models = AIProviderFactory.getModelsForProvider('unknown-provider');
        expect(models).toEqual([]);
      });

      it('should include gpt-4o in OpenAI models', () => {
        const models = AIProviderFactory.getModelsForProvider('openai');
        const gpt4o = models.find(m => m.id === 'gpt-4o');

        expect(gpt4o).toBeDefined();
        expect(gpt4o.name).toBe('GPT-4o');
      });

      it('should include gpt-4o-mini in OpenAI models', () => {
        const models = AIProviderFactory.getModelsForProvider('openai');
        const gpt4oMini = models.find(m => m.id === 'gpt-4o-mini');

        expect(gpt4oMini).toBeDefined();
        expect(gpt4oMini.name).toBe('GPT-4o Mini');
      });

      it('should have cheaper pricing for mini models', () => {
        const models = AIProviderFactory.getModelsForProvider('openai');
        const gpt4o = models.find(m => m.id === 'gpt-4o');
        const gpt4oMini = models.find(m => m.id === 'gpt-4o-mini');

        expect(gpt4oMini.pricing.input).toBeLessThan(gpt4o.pricing.input);
        expect(gpt4oMini.pricing.output).toBeLessThan(gpt4o.pricing.output);
      });

      it('should return models with valid context window sizes', () => {
        const models = AIProviderFactory.getModelsForProvider('openai');

        models.forEach(model => {
          expect(model.contextWindow).toBeGreaterThan(0);
          expect(typeof model.contextWindow).toBe('number');
        });
      });

      it('should return models with valid max token values', () => {
        const models = AIProviderFactory.getModelsForProvider('claude');

        models.forEach(model => {
          expect(model.maxTokens).toBeGreaterThan(0);
          expect(typeof model.maxTokens).toBe('number');
        });
      });
    });
  });

  // ============================================================================
  // MESSAGE HANDLER TESTS (35 tests)
  // ============================================================================

  describe('AIMessageHandler - Message Processing and Context', () => {
    describe('buildMessagesWithContext - Context Building', () => {
      it('should build basic messages with system prompt and user message', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const messages = await AIMessageHandler.buildMessagesWithContext({
          botId: 1,
          sessionId: 'test-session-123',
          userMessage: 'Hello, how are you?',
          systemPrompt: 'You are a helpful assistant.'
        });

        expect(messages).toHaveLength(2);
        expect(messages[0].role).toBe('system');
        expect(messages[0].content).toBe('You are a helpful assistant.');
        expect(messages[1].role).toBe('user');
        expect(messages[1].content).toBe('Hello, how are you?');
      });

      it('should use default system prompt when not provided', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const messages = await AIMessageHandler.buildMessagesWithContext({
          botId: 1,
          sessionId: 'test-session',
          userMessage: 'Test'
        });

        expect(messages[0].content).toBe('You are a helpful assistant.');
      });

      it('should include conversation history when available', async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            { role: 'assistant', content: 'Hi there!', created_at: new Date() },
            { role: 'user', content: 'Hello', created_at: new Date() }
          ]
        });

        const messages = await AIMessageHandler.buildMessagesWithContext({
          botId: 1,
          sessionId: 'test-session',
          userMessage: 'How are you?',
          contextWindow: 10
        });

        expect(messages).toHaveLength(4); // system + 2 history + current
        expect(messages[1].role).toBe('user');
        expect(messages[1].content).toBe('Hello');
        expect(messages[2].role).toBe('assistant');
        expect(messages[2].content).toBe('Hi there!');
      });

      it('should respect contextWindow limit', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await AIMessageHandler.buildMessagesWithContext({
          botId: 1,
          sessionId: 'test-session',
          userMessage: 'Test',
          contextWindow: 5
        });

        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          [1, 'test-session', 5]
        );
      });

      it('should skip history fetch when contextWindow is 0', async () => {
        const messages = await AIMessageHandler.buildMessagesWithContext({
          botId: 1,
          sessionId: 'test-session',
          userMessage: 'Test',
          contextWindow: 0
        });

        expect(db.query).not.toHaveBeenCalled();
        expect(messages).toHaveLength(2);
      });

      it('should skip history fetch when no sessionId provided', async () => {
        const messages = await AIMessageHandler.buildMessagesWithContext({
          botId: 1,
          userMessage: 'Test',
          contextWindow: 10
        });

        expect(db.query).not.toHaveBeenCalled();
      });

      it('should handle database errors gracefully', async () => {
        db.query.mockRejectedValueOnce(new Error('Database connection failed'));

        const messages = await AIMessageHandler.buildMessagesWithContext({
          botId: 1,
          sessionId: 'test-session',
          userMessage: 'Test',
          contextWindow: 5
        });

        expect(messages).toHaveLength(2);
        expect(logger.error).toHaveBeenCalled();
      });

      it('should reverse history order to chronological', async () => {
        const now = new Date();
        const earlier = new Date(now.getTime() - 60000);

        db.query.mockResolvedValueOnce({
          rows: [
            { role: 'assistant', content: 'Response 2', created_at: now },
            { role: 'user', content: 'Message 2', created_at: earlier }
          ]
        });

        const messages = await AIMessageHandler.buildMessagesWithContext({
          botId: 1,
          sessionId: 'test-session',
          userMessage: 'Message 3',
          contextWindow: 10
        });

        expect(messages[1].content).toBe('Message 2');
        expect(messages[2].content).toBe('Response 2');
      });

      it('should handle empty history result', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const messages = await AIMessageHandler.buildMessagesWithContext({
          botId: 1,
          sessionId: 'test-session',
          userMessage: 'First message',
          contextWindow: 10
        });

        expect(messages).toHaveLength(2);
      });

      it('should handle large context windows', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await AIMessageHandler.buildMessagesWithContext({
          botId: 1,
          sessionId: 'test-session',
          userMessage: 'Test',
          contextWindow: 100
        });

        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          [1, 'test-session', 100]
        );
      });

      it('should use default contextWindow of 10', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await AIMessageHandler.buildMessagesWithContext({
          botId: 1,
          sessionId: 'test-session',
          userMessage: 'Test'
        });

        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([10])
        );
      });
    });

    describe('saveMessage - Message Persistence', () => {
      it('should save user message successfully', async () => {
        const savedMessage = {
          id: 1,
          bot_id: 1,
          session_id: 'session-123',
          role: 'user',
          content: 'Hello',
          created_at: new Date()
        };

        db.query.mockResolvedValueOnce({ rows: [savedMessage] });

        const result = await AIMessageHandler.saveMessage({
          botId: 1,
          sessionId: 'session-123',
          role: 'user',
          content: 'Hello'
        });

        expect(result.id).toBe(1);
        expect(result.role).toBe('user');
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO ai_conversations'),
          [1, 'session-123', 'user', 'Hello']
        );
      });

      it('should save assistant message successfully', async () => {
        const savedMessage = {
          id: 2,
          bot_id: 1,
          session_id: 'session-123',
          role: 'assistant',
          content: 'Hi there!'
        };

        db.query.mockResolvedValueOnce({ rows: [savedMessage] });

        const result = await AIMessageHandler.saveMessage({
          botId: 1,
          sessionId: 'session-123',
          role: 'assistant',
          content: 'Hi there!'
        });

        expect(result.role).toBe('assistant');
      });

      it('should throw error when botId is missing', async () => {
        await expect(AIMessageHandler.saveMessage({
          sessionId: 'session-123',
          role: 'user',
          content: 'Hello'
        })).rejects.toThrow('botId, sessionId, role, and content are required');
      });

      it('should throw error when sessionId is missing', async () => {
        await expect(AIMessageHandler.saveMessage({
          botId: 1,
          role: 'user',
          content: 'Hello'
        })).rejects.toThrow('botId, sessionId, role, and content are required');
      });

      it('should throw error when role is missing', async () => {
        await expect(AIMessageHandler.saveMessage({
          botId: 1,
          sessionId: 'session-123',
          content: 'Hello'
        })).rejects.toThrow('botId, sessionId, role, and content are required');
      });

      it('should throw error when content is missing', async () => {
        await expect(AIMessageHandler.saveMessage({
          botId: 1,
          sessionId: 'session-123',
          role: 'user'
        })).rejects.toThrow('botId, sessionId, role, and content are required');
      });

      it('should handle database errors during save', async () => {
        db.query.mockRejectedValueOnce(new Error('Insert failed'));

        await expect(AIMessageHandler.saveMessage({
          botId: 1,
          sessionId: 'session-123',
          role: 'user',
          content: 'Hello'
        })).rejects.toThrow('Insert failed');

        expect(logger.error).toHaveBeenCalled();
      });

      it('should save long messages', async () => {
        const longContent = 'A'.repeat(10000);
        db.query.mockResolvedValueOnce({
          rows: [{ id: 1, content: longContent }]
        });

        const result = await AIMessageHandler.saveMessage({
          botId: 1,
          sessionId: 'session-123',
          role: 'user',
          content: longContent
        });

        expect(result.content).toBe(longContent);
      });

      it('should save messages with special characters', async () => {
        const specialContent = 'Hello! @#$%^&*() "quotes" \'apostrophes\'';
        db.query.mockResolvedValueOnce({
          rows: [{ id: 1, content: specialContent }]
        });

        await AIMessageHandler.saveMessage({
          botId: 1,
          sessionId: 'session-123',
          role: 'user',
          content: specialContent
        });

        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([specialContent])
        );
      });
    });

    describe('clearConversation - Conversation Cleanup', () => {
      it('should clear conversation and return count', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 15 });

        const count = await AIMessageHandler.clearConversation(1, 'session-123');

        expect(count).toBe(15);
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM ai_conversations'),
          [1, 'session-123']
        );
      });

      it('should return 0 when no messages to delete', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 0 });

        const count = await AIMessageHandler.clearConversation(1, 'new-session');

        expect(count).toBe(0);
      });

      it('should handle database errors during clear', async () => {
        db.query.mockRejectedValueOnce(new Error('Delete failed'));

        await expect(
          AIMessageHandler.clearConversation(1, 'session-123')
        ).rejects.toThrow('Delete failed');

        expect(logger.error).toHaveBeenCalled();
      });
    });

    describe('getConversationHistory - History Retrieval', () => {
      it('should retrieve conversation history', async () => {
        const history = [
          { id: 2, role: 'assistant', content: 'Hi!', created_at: new Date() },
          { id: 1, role: 'user', content: 'Hello', created_at: new Date() }
        ];

        db.query.mockResolvedValueOnce({ rows: history });

        const result = await AIMessageHandler.getConversationHistory(1, 'session-123');

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe(2);
      });

      it('should use default limit of 50', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await AIMessageHandler.getConversationHistory(1, 'session-123');

        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          [1, 'session-123', 50]
        );
      });

      it('should use custom limit', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await AIMessageHandler.getConversationHistory(1, 'session-123', 100);

        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          [1, 'session-123', 100]
        );
      });

      it('should handle database errors', async () => {
        db.query.mockRejectedValueOnce(new Error('Query failed'));

        await expect(
          AIMessageHandler.getConversationHistory(1, 'session-123')
        ).rejects.toThrow('Query failed');
      });
    });

    describe('Message Validation and Formatting', () => {
      it('should validate valid message', () => {
        const result = AIMessageHandler.validateMessage('Hello, world!');

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should fail validation for empty message', () => {
        const result = AIMessageHandler.validateMessage('');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('required');
      });

      it('should allow empty message when configured', () => {
        const result = AIMessageHandler.validateMessage('', { allowEmpty: true });

        expect(result.valid).toBe(true);
      });

      it('should fail validation for message too short', () => {
        const result = AIMessageHandler.validateMessage('Hi', { minLength: 10 });

        expect(result.valid).toBe(false);
        expect(result.error).toContain('at least 10 characters');
      });

      it('should fail validation for message too long', () => {
        const result = AIMessageHandler.validateMessage('Hello world', { maxLength: 5 });

        expect(result.valid).toBe(false);
        expect(result.error).toContain('cannot exceed 5 characters');
      });

      it('should format message by trimming whitespace', () => {
        const formatted = AIMessageHandler.formatMessage('  Hello  ');
        expect(formatted).toBe('Hello');
      });

      it('should truncate long messages', () => {
        const longMessage = 'A'.repeat(200);
        const formatted = AIMessageHandler.formatMessage(longMessage, 50);

        expect(formatted).toBe('A'.repeat(50) + '...');
      });

      it('should handle null/undefined in formatting', () => {
        expect(AIMessageHandler.formatMessage(null)).toBe('');
        expect(AIMessageHandler.formatMessage(undefined)).toBe('');
      });
    });
  });

  // ============================================================================
  // COST CALCULATOR TESTS (30 tests)
  // ============================================================================

  describe('AICostCalculator - Token Counting and Cost Calculation', () => {
    describe('calculateCost - Basic Cost Calculation', () => {
      it('should calculate cost for OpenAI GPT-4o', () => {
        const cost = AICostCalculator.calculateCost({
          provider: 'openai',
          model: 'gpt-4o',
          promptTokens: 1000,
          completionTokens: 500
        });

        // 1000/1M * 2.50 + 500/1M * 10.00 = 0.0025 + 0.005 = 0.0075
        expect(cost).toBeCloseTo(0.0075, 6);
      });

      it('should calculate cost for OpenAI GPT-4o-mini', () => {
        const cost = AICostCalculator.calculateCost({
          provider: 'openai',
          model: 'gpt-4o-mini',
          promptTokens: 1000,
          completionTokens: 500
        });

        // 1000/1M * 0.150 + 500/1M * 0.600 = 0.00015 + 0.0003 = 0.00045
        expect(cost).toBeCloseTo(0.00045, 6);
      });

      it('should calculate cost for Claude Sonnet', () => {
        const cost = AICostCalculator.calculateCost({
          provider: 'claude',
          model: 'claude-3-5-sonnet-20241022',
          promptTokens: 1000,
          completionTokens: 500
        });

        // 1000/1M * 3.00 + 500/1M * 15.00 = 0.003 + 0.0075 = 0.0105
        expect(cost).toBeCloseTo(0.0105, 6);
      });

      it('should calculate cost for Claude Haiku', () => {
        const cost = AICostCalculator.calculateCost({
          provider: 'claude',
          model: 'claude-3-5-haiku-20241022',
          promptTokens: 1000,
          completionTokens: 500
        });

        // 1000/1M * 0.80 + 500/1M * 4.00 = 0.0008 + 0.002 = 0.0028
        expect(cost).toBeCloseTo(0.0028, 6);
      });

      it('should handle case-insensitive provider names', () => {
        const cost = AICostCalculator.calculateCost({
          provider: 'OPENAI',
          model: 'gpt-4o',
          promptTokens: 1000,
          completionTokens: 500
        });

        expect(cost).toBeGreaterThan(0);
      });

      it('should return 0 for unknown provider', () => {
        const cost = AICostCalculator.calculateCost({
          provider: 'unknown-provider',
          model: 'test-model',
          promptTokens: 1000,
          completionTokens: 500
        });

        expect(cost).toBe(0);
        expect(logger.warn).toHaveBeenCalled();
      });

      it('should return 0 for missing provider', () => {
        const cost = AICostCalculator.calculateCost({
          model: 'gpt-4o',
          promptTokens: 1000,
          completionTokens: 500
        });

        expect(cost).toBe(0);
      });

      it('should estimate cost for unknown model', () => {
        const cost = AICostCalculator.calculateCost({
          provider: 'openai',
          model: 'unknown-model',
          promptTokens: 1000,
          completionTokens: 500
        });

        expect(cost).toBeGreaterThan(0);
        expect(logger.warn).toHaveBeenCalled();
      });

      it('should handle zero tokens', () => {
        const cost = AICostCalculator.calculateCost({
          provider: 'openai',
          model: 'gpt-4o',
          promptTokens: 0,
          completionTokens: 0
        });

        expect(cost).toBe(0);
      });

      it('should calculate cost for large token counts', () => {
        const cost = AICostCalculator.calculateCost({
          provider: 'openai',
          model: 'gpt-4o',
          promptTokens: 100000,
          completionTokens: 50000
        });

        expect(cost).toBeGreaterThan(0);
        expect(cost).toBeCloseTo(0.75, 2);
      });

      it('should handle very small token counts', () => {
        const cost = AICostCalculator.calculateCost({
          provider: 'openai',
          model: 'gpt-4o-mini',
          promptTokens: 10,
          completionTokens: 5
        });

        expect(cost).toBeGreaterThan(0);
        expect(cost).toBeLessThan(0.0001);
      });
    });

    describe('estimateTokens - Token Estimation', () => {
      it('should estimate tokens for short text', () => {
        const tokens = AICostCalculator.estimateTokens('Hello world');

        expect(tokens).toBeGreaterThan(0);
        expect(tokens).toBeLessThan(20);
      });

      it('should estimate tokens for medium text', () => {
        const text = 'This is a medium length text that should result in a reasonable token estimate.';
        const tokens = AICostCalculator.estimateTokens(text);

        expect(tokens).toBeGreaterThan(10);
        expect(tokens).toBeLessThan(50);
      });

      it('should estimate tokens for long text', () => {
        const text = 'A'.repeat(1000);
        const tokens = AICostCalculator.estimateTokens(text);

        expect(tokens).toBeGreaterThan(200);
      });

      it('should return 0 for empty string', () => {
        const tokens = AICostCalculator.estimateTokens('');
        expect(tokens).toBe(0);
      });

      it('should return 0 for null', () => {
        const tokens = AICostCalculator.estimateTokens(null);
        expect(tokens).toBe(0);
      });

      it('should return 0 for undefined', () => {
        const tokens = AICostCalculator.estimateTokens(undefined);
        expect(tokens).toBe(0);
      });

      it('should estimate tokens using 4 chars per token rule', () => {
        const text = 'A'.repeat(400);
        const tokens = AICostCalculator.estimateTokens(text);

        expect(tokens).toBe(100);
      });

      it('should round up token estimates', () => {
        const text = 'A'.repeat(50);
        const tokens = AICostCalculator.estimateTokens(text);

        expect(tokens).toBe(13); // ceil(50/4)
      });
    });

    describe('estimateRequestCost - Request Cost Estimation', () => {
      it('should estimate request cost with prompt text', () => {
        const estimate = AICostCalculator.estimateRequestCost({
          provider: 'openai',
          model: 'gpt-4o',
          promptText: 'Hello world, how are you today?',
          estimatedResponseTokens: 100
        });

        expect(estimate).toHaveProperty('estimatedPromptTokens');
        expect(estimate).toHaveProperty('estimatedCompletionTokens');
        expect(estimate).toHaveProperty('estimatedTotalTokens');
        expect(estimate).toHaveProperty('estimatedCost');
        expect(estimate).toHaveProperty('formattedCost');
        expect(estimate.estimatedCompletionTokens).toBe(100);
      });

      it('should use default response tokens if not provided', () => {
        const estimate = AICostCalculator.estimateRequestCost({
          provider: 'openai',
          model: 'gpt-4o',
          promptText: 'Test prompt'
        });

        expect(estimate.estimatedCompletionTokens).toBe(500);
      });

      it('should format cost with dollar sign', () => {
        const estimate = AICostCalculator.estimateRequestCost({
          provider: 'openai',
          model: 'gpt-4o-mini',
          promptText: 'Test',
          estimatedResponseTokens: 50
        });

        expect(estimate.formattedCost).toMatch(/^\$/);
      });

      it('should calculate total tokens correctly', () => {
        const estimate = AICostCalculator.estimateRequestCost({
          provider: 'openai',
          model: 'gpt-4o',
          promptText: 'A'.repeat(400), // 100 tokens
          estimatedResponseTokens: 200
        });

        expect(estimate.estimatedTotalTokens).toBe(300);
      });
    });

    describe('calculateTotalCost - Aggregated Cost Calculation', () => {
      it('should calculate total cost from usage logs', () => {
        const logs = [
          { cost_usd: 0.001, total_tokens: 100, prompt_tokens: 50, completion_tokens: 50, provider: 'openai' },
          { cost_usd: 0.002, total_tokens: 200, prompt_tokens: 100, completion_tokens: 100, provider: 'claude' },
          { cost_usd: 0.003, total_tokens: 300, prompt_tokens: 150, completion_tokens: 150, provider: 'openai' }
        ];

        const result = AICostCalculator.calculateTotalCost(logs);

        expect(result.totalCost).toBe(0.006);
        expect(result.totalTokens).toBe(600);
        expect(result.totalPromptTokens).toBe(300);
        expect(result.totalCompletionTokens).toBe(300);
      });

      it('should calculate breakdown by provider', () => {
        const logs = [
          { cost_usd: 0.001, total_tokens: 100, prompt_tokens: 50, completion_tokens: 50, provider: 'openai' },
          { cost_usd: 0.002, total_tokens: 200, prompt_tokens: 100, completion_tokens: 100, provider: 'openai' },
          { cost_usd: 0.003, total_tokens: 300, prompt_tokens: 150, completion_tokens: 150, provider: 'claude' }
        ];

        const result = AICostCalculator.calculateTotalCost(logs);

        expect(result.breakdown.openai).toBe(0.003);
        expect(result.breakdown.claude).toBe(0.003);
      });

      it('should calculate average cost per request', () => {
        const logs = [
          { cost_usd: 0.001, total_tokens: 100, prompt_tokens: 50, completion_tokens: 50, provider: 'openai' },
          { cost_usd: 0.003, total_tokens: 200, prompt_tokens: 100, completion_tokens: 100, provider: 'openai' }
        ];

        const result = AICostCalculator.calculateTotalCost(logs);

        expect(result.averageCostPerRequest).toBe(0.002);
      });

      it('should handle empty usage logs', () => {
        const result = AICostCalculator.calculateTotalCost([]);

        expect(result.totalCost).toBe(0);
        expect(result.averageCostPerRequest).toBe(0);
      });

      it('should handle logs with missing cost_usd', () => {
        const logs = [
          { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50, provider: 'openai' }
        ];

        const result = AICostCalculator.calculateTotalCost(logs);

        expect(result.totalCost).toBe(0);
      });
    });

    describe('formatCost - Cost Formatting', () => {
      it('should format cost with currency symbol', () => {
        const formatted = AICostCalculator.formatCost(0.123456, true);

        expect(formatted).toBe('$0.123456');
      });

      it('should format cost without currency symbol', () => {
        const formatted = AICostCalculator.formatCost(0.123456, false);

        expect(formatted).toBe('0.123456');
      });

      it('should format to 6 decimal places', () => {
        const formatted = AICostCalculator.formatCost(0.1);

        expect(formatted).toBe('$0.100000');
      });

      it('should handle very small costs', () => {
        const formatted = AICostCalculator.formatCost(0.000001);

        expect(formatted).toBe('$0.000001');
      });

      it('should handle large costs', () => {
        const formatted = AICostCalculator.formatCost(123.456789);

        expect(formatted).toBe('$123.456789');
      });
    });

    describe('getPricing - Pricing Information', () => {
      it('should get pricing for valid model', () => {
        const pricing = AICostCalculator.getPricing('openai', 'gpt-4o');

        expect(pricing).not.toBeNull();
        expect(pricing).toHaveProperty('input');
        expect(pricing).toHaveProperty('output');
      });

      it('should return null for invalid provider', () => {
        const pricing = AICostCalculator.getPricing('invalid', 'gpt-4o');

        expect(pricing).toBeNull();
      });

      it('should return null for invalid model', () => {
        const pricing = AICostCalculator.getPricing('openai', 'invalid-model');

        expect(pricing).toBeNull();
      });
    });
  });

  // ============================================================================
  // OPENAI SERVICE TESTS (15 tests)
  // ============================================================================

  describe('OpenAIService - OpenAI Provider Implementation', () => {
    describe('Constructor and Initialization', () => {
      it('should initialize with API key and model', () => {
        const service = new OpenAIService('sk-test-key', 'gpt-4o');

        expect(service.model).toBe('gpt-4o');
        expect(service.client).toBeDefined();
      });

      it('should use default model when not provided', () => {
        const service = new OpenAIService('sk-test-key');

        expect(service.model).toBe('gpt-4o-mini');
      });

      it('should throw error for missing API key', () => {
        expect(() => new OpenAIService()).toThrow('OpenAI API key is required');
      });

      it('should throw error for null API key', () => {
        expect(() => new OpenAIService(null, 'gpt-4o')).toThrow('OpenAI API key is required');
      });

      it('should throw error for empty API key', () => {
        expect(() => new OpenAIService('', 'gpt-4o')).toThrow('OpenAI API key is required');
      });
    });

    describe('chat - Message Processing', () => {
      it('should throw error for missing messages', async () => {
        const service = new OpenAIService('sk-test-key', 'gpt-4o');

        await expect(service.chat({})).rejects.toThrow('Messages array is required');
      });

      it('should throw error for null messages', async () => {
        const service = new OpenAIService('sk-test-key', 'gpt-4o');

        await expect(service.chat({ messages: null })).rejects.toThrow('Messages array is required');
      });

      it('should throw error for empty messages array', async () => {
        const service = new OpenAIService('sk-test-key', 'gpt-4o');

        await expect(service.chat({ messages: [] })).rejects.toThrow('Messages array is required');
      });

      it('should throw error for non-array messages', async () => {
        const service = new OpenAIService('sk-test-key', 'gpt-4o');

        await expect(service.chat({ messages: 'not an array' })).rejects.toThrow('Messages array is required');
      });

      it('should use default temperature when not provided', async () => {
        const service = new OpenAIService('sk-test-key', 'gpt-4o');
        const mockCreate = jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Response', role: 'assistant' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        });
        service.client.chat.completions.create = mockCreate;

        await service.chat({ messages: [{ role: 'user', content: 'Test' }] });

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ temperature: 0.7 })
        );
      });

      it('should use default maxTokens when not provided', async () => {
        const service = new OpenAIService('sk-test-key', 'gpt-4o');
        const mockCreate = jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Response', role: 'assistant' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        });
        service.client.chat.completions.create = mockCreate;

        await service.chat({ messages: [{ role: 'user', content: 'Test' }] });

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ max_tokens: 1000 })
        );
      });

      it('should use custom temperature when provided', async () => {
        const service = new OpenAIService('sk-test-key', 'gpt-4o');
        const mockCreate = jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Response', role: 'assistant' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        });
        service.client.chat.completions.create = mockCreate;

        await service.chat({
          messages: [{ role: 'user', content: 'Test' }],
          temperature: 0.9
        });

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ temperature: 0.9 })
        );
      });

      it('should set stream to false by default', async () => {
        const service = new OpenAIService('sk-test-key', 'gpt-4o');
        const mockCreate = jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Response', role: 'assistant' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        });
        service.client.chat.completions.create = mockCreate;

        await service.chat({ messages: [{ role: 'user', content: 'Test' }] });

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ stream: false })
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle API errors with proper structure', async () => {
        const service = new OpenAIService('sk-test-key', 'gpt-4o');
        const mockError = {
          response: {
            status: 401,
            data: {
              error: {
                message: 'Invalid API key',
                type: 'invalid_request_error'
              }
            }
          },
          message: 'Request failed'
        };

        service.client.chat.completions.create = jest.fn().mockRejectedValue(mockError);

        try {
          await service.chat({ messages: [{ role: 'user', content: 'Test' }] });
          fail('Should have thrown error');
        } catch (error) {
          expect(error.provider).toBe('openai');
          expect(error.statusCode).toBe(401);
          expect(error.message).toBe('Invalid API key');
        }
      });

      it('should handle errors without response data', async () => {
        const service = new OpenAIService('sk-test-key', 'gpt-4o');
        service.client.chat.completions.create = jest.fn().mockRejectedValue(
          new Error('Network error')
        );

        try {
          await service.chat({ messages: [{ role: 'user', content: 'Test' }] });
          fail('Should have thrown error');
        } catch (error) {
          expect(error.provider).toBe('openai');
          expect(error.message).toBe('Network error');
        }
      });
    });
  });

  // ============================================================================
  // CLAUDE SERVICE TESTS (10 tests)
  // ============================================================================

  describe('ClaudeService - Anthropic Provider Implementation', () => {
    describe('Constructor and Initialization', () => {
      it('should initialize with API key and model', () => {
        const service = new ClaudeService('sk-ant-test-key', 'claude-sonnet-4-5');

        expect(service.model).toBe('claude-sonnet-4-5');
        expect(service.client).toBeDefined();
      });

      it('should use default model when not provided', () => {
        const service = new ClaudeService('sk-ant-test-key');

        expect(service.model).toBe('claude-3-5-sonnet-20241022');
      });

      it('should trim whitespace from API key', () => {
        const service = new ClaudeService('  sk-ant-test-key  ', 'claude-sonnet-4-5');

        expect(service.client).toBeDefined();
        expect(logger.debug).toHaveBeenCalled();
      });

      it('should throw error for missing API key', () => {
        expect(() => new ClaudeService()).toThrow('Anthropic API key is required');
      });

      it('should throw error for null API key', () => {
        expect(() => new ClaudeService(null)).toThrow('Anthropic API key is required');
      });
    });

    describe('convertMessages - Message Format Conversion', () => {
      it('should extract system message from messages array', () => {
        const service = new ClaudeService('sk-ant-test-key');
        const messages = [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' }
        ];

        const result = service.convertMessages(messages);

        expect(result.system).toBe('You are helpful');
        expect(result.messages).toHaveLength(1);
        expect(result.messages[0].role).toBe('user');
      });

      it('should handle messages without system prompt', () => {
        const service = new ClaudeService('sk-ant-test-key');
        const messages = [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' }
        ];

        const result = service.convertMessages(messages);

        expect(result.system).toBe('');
        expect(result.messages).toHaveLength(2);
      });

      it('should convert assistant role correctly', () => {
        const service = new ClaudeService('sk-ant-test-key');
        const messages = [
          { role: 'assistant', content: 'Response' }
        ];

        const result = service.convertMessages(messages);

        expect(result.messages[0].role).toBe('assistant');
      });

      it('should handle multiple user messages', () => {
        const service = new ClaudeService('sk-ant-test-key');
        const messages = [
          { role: 'user', content: 'Message 1' },
          { role: 'user', content: 'Message 2' }
        ];

        const result = service.convertMessages(messages);

        expect(result.messages).toHaveLength(2);
        expect(result.messages[0].content).toBe('Message 1');
        expect(result.messages[1].content).toBe('Message 2');
      });

      it('should handle empty messages array', () => {
        const service = new ClaudeService('sk-ant-test-key');
        const result = service.convertMessages([]);

        expect(result.system).toBe('');
        expect(result.messages).toHaveLength(0);
      });
    });
  });
});
