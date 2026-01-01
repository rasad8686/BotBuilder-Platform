/**
 * AI Provider Integration Tests
 * Tests for provider switching, failover, and cross-provider compatibility
 */

jest.mock('openai');
jest.mock('@anthropic-ai/sdk');
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const AIProviderFactory = require('../../../services/ai/aiProviderFactory');
const OpenAIService = require('../../../services/ai/openaiService');
const ClaudeService = require('../../../services/ai/claudeService');

describe('AI Provider Integration Tests', () => {
  let mockOpenAICreate;
  let mockClaudeCreate;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOpenAICreate = jest.fn();
    mockClaudeCreate = jest.fn();

    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockOpenAICreate
        }
      }
    }));

    Anthropic.mockImplementation(() => ({
      messages: {
        create: mockClaudeCreate
      }
    }));
  });

  describe('Provider Switching', () => {
    it('should switch from OpenAI to Claude seamlessly', async () => {
      // Start with OpenAI
      const openaiProvider = AIProviderFactory.getProvider({
        provider: 'openai',
        apiKey: 'sk-openai-key',
        model: 'gpt-4o'
      });

      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OpenAI response', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });

      const openaiResult = await openaiProvider.chat({
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(openaiResult.provider).toBe('openai');
      expect(openaiResult.content).toBe('OpenAI response');

      // Switch to Claude
      const claudeProvider = AIProviderFactory.getProvider({
        provider: 'claude',
        apiKey: 'sk-ant-key',
        model: 'claude-sonnet-4-5'
      });

      mockClaudeCreate.mockResolvedValueOnce({
        content: [{ text: 'Claude response' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      });

      const claudeResult = await claudeProvider.chat({
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(claudeResult.provider).toBe('claude');
      expect(claudeResult.content).toBe('Claude response');
    });

    it('should maintain conversation context when switching providers', async () => {
      const conversationHistory = [
        { role: 'user', content: 'What is AI?' },
        { role: 'assistant', content: 'AI stands for Artificial Intelligence.' },
        { role: 'user', content: 'Tell me more' }
      ];

      // OpenAI with conversation
      const openaiProvider = new OpenAIService('sk-test', 'gpt-4o');
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OpenAI continuation', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 }
      });

      await openaiProvider.chat({ messages: conversationHistory });

      // Claude with same conversation
      const claudeProvider = new ClaudeService('sk-ant-test', 'claude-sonnet-4-5');
      mockClaudeCreate.mockResolvedValueOnce({
        content: [{ text: 'Claude continuation' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 20, output_tokens: 10 }
      });

      await claudeProvider.chat({ messages: conversationHistory });

      // Both should receive the same conversation history
      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ content: 'What is AI?' })
          ])
        })
      );

      expect(mockClaudeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ content: 'What is AI?' })
          ])
        })
      );
    });

    it('should allow switching models within same provider', async () => {
      // GPT-4o
      const gpt4o = new OpenAIService('sk-test', 'gpt-4o');
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'GPT-4o response', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });

      const result1 = await gpt4o.chat({
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(result1.model).toBe('gpt-4o');

      // GPT-4o-mini
      const gpt4oMini = new OpenAIService('sk-test', 'gpt-4o-mini');
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'GPT-4o-mini response', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });

      const result2 = await gpt4oMini.chat({
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(result2.model).toBe('gpt-4o-mini');
    });
  });

  describe('Response Format Normalization', () => {
    it('should normalize OpenAI response to common format', async () => {
      const provider = new OpenAIService('sk-test', 'gpt-4o');

      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Response', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });

      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('usage');
      expect(result).toHaveProperty('responseTime');
      expect(result.usage).toHaveProperty('promptTokens');
      expect(result.usage).toHaveProperty('completionTokens');
      expect(result.usage).toHaveProperty('totalTokens');
    });

    it('should normalize Claude response to common format', async () => {
      const provider = new ClaudeService('sk-ant-test', 'claude-sonnet-4-5');

      mockClaudeCreate.mockResolvedValueOnce({
        content: [{ text: 'Response' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      });

      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('usage');
      expect(result).toHaveProperty('responseTime');
      expect(result.usage).toHaveProperty('promptTokens');
      expect(result.usage).toHaveProperty('completionTokens');
      expect(result.usage).toHaveProperty('totalTokens');
    });

    it('should have consistent usage token naming across providers', async () => {
      // OpenAI
      const openai = new OpenAIService('sk-test', 'gpt-4o');
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Test', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });

      const openaiResult = await openai.chat({
        messages: [{ role: 'user', content: 'Test' }]
      });

      // Claude
      const claude = new ClaudeService('sk-ant-test', 'claude-sonnet-4-5');
      mockClaudeCreate.mockResolvedValueOnce({
        content: [{ text: 'Test' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      });

      const claudeResult = await claude.chat({
        messages: [{ role: 'user', content: 'Test' }]
      });

      // Both should use same field names
      expect(openaiResult.usage.promptTokens).toBe(10);
      expect(claudeResult.usage.promptTokens).toBe(10);
      expect(openaiResult.usage.completionTokens).toBe(5);
      expect(claudeResult.usage.completionTokens).toBe(5);
    });
  });

  describe('Error Handling Consistency', () => {
    it('should have consistent error format across providers', async () => {
      // OpenAI error
      const openai = new OpenAIService('sk-test', 'gpt-4o');
      const openaiError = new Error('Rate limit');
      openaiError.response = { status: 429, data: { error: { message: 'Rate limit', type: 'rate_limit' } } };
      mockOpenAICreate.mockRejectedValueOnce(openaiError);

      let openaiErrorResult;
      try {
        await openai.chat({ messages: [{ role: 'user', content: 'Test' }] });
      } catch (error) {
        openaiErrorResult = error;
      }

      // Claude error
      const claude = new ClaudeService('sk-ant-test', 'claude-sonnet-4-5');
      const claudeError = new Error('Rate limit');
      claudeError.status = 429;
      claudeError.type = 'rate_limit_error';
      mockClaudeCreate.mockRejectedValueOnce(claudeError);

      let claudeErrorResult;
      try {
        await claude.chat({ messages: [{ role: 'user', content: 'Test' }] });
      } catch (error) {
        claudeErrorResult = error;
      }

      // Both should have consistent error structure
      expect(openaiErrorResult).toHaveProperty('provider');
      expect(claudeErrorResult).toHaveProperty('provider');
      expect(openaiErrorResult).toHaveProperty('statusCode');
      expect(claudeErrorResult).toHaveProperty('statusCode');
      expect(openaiErrorResult.statusCode).toBe(429);
      expect(claudeErrorResult.statusCode).toBe(429);
    });

    it('should handle authentication errors consistently', async () => {
      // OpenAI auth error
      const openai = new OpenAIService('invalid-key', 'gpt-4o');
      const openaiError = new Error('Invalid API key');
      openaiError.response = { status: 401, data: { error: { type: 'invalid_api_key' } } };
      mockOpenAICreate.mockRejectedValueOnce(openaiError);

      // Claude auth error
      const claude = new ClaudeService('invalid-key', 'claude-sonnet-4-5');
      const claudeError = new Error('Invalid API key');
      claudeError.status = 401;
      mockClaudeCreate.mockRejectedValueOnce(claudeError);

      await expect(openai.chat({ messages: [{ role: 'user', content: 'Test' }] }))
        .rejects.toHaveProperty('statusCode', 401);

      await expect(claude.chat({ messages: [{ role: 'user', content: 'Test' }] }))
        .rejects.toHaveProperty('statusCode', 401);
    });
  });

  describe('Connection Testing Across Providers', () => {
    it('should test OpenAI connection', async () => {
      const provider = new OpenAIService('sk-test', 'gpt-4o');

      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      });

      const result = await provider.testConnection();

      expect(result.success).toBe(true);
      expect(result.provider).toBe('openai');
    });

    it('should test Claude connection', async () => {
      const provider = new ClaudeService('sk-ant-test', 'claude-sonnet-4-5');

      mockClaudeCreate.mockResolvedValueOnce({
        content: [{ text: 'OK' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 2 }
      });

      const result = await provider.testConnection();

      expect(result.success).toBe(true);
      expect(result.provider).toBe('claude');
    });

    it('should have consistent connection test response format', async () => {
      // OpenAI
      const openai = new OpenAIService('sk-test', 'gpt-4o');
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      });

      const openaiResult = await openai.testConnection();

      // Claude
      const claude = new ClaudeService('sk-ant-test', 'claude-sonnet-4-5');
      mockClaudeCreate.mockResolvedValueOnce({
        content: [{ text: 'OK' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 2 }
      });

      const claudeResult = await claude.testConnection();

      // Both should have same structure
      expect(openaiResult).toHaveProperty('success');
      expect(claudeResult).toHaveProperty('success');
      expect(openaiResult).toHaveProperty('provider');
      expect(claudeResult).toHaveProperty('provider');
      expect(openaiResult).toHaveProperty('message');
      expect(claudeResult).toHaveProperty('message');
    });
  });

  describe('Streaming Compatibility', () => {
    it('should handle OpenAI streaming', async () => {
      const provider = new OpenAIService('sk-test', 'gpt-4o');
      const onChunk = jest.fn();
      const onComplete = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'test' } }] };
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        }
      };

      mockOpenAICreate.mockResolvedValueOnce(mockStream);

      await provider.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        onChunk,
        onComplete
      );

      expect(onChunk).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
    });

    it('should handle Claude streaming', async () => {
      const provider = new ClaudeService('sk-ant-test', 'claude-sonnet-4-5');
      const onChunk = jest.fn();
      const onComplete = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { text: 'test' } };
          yield { type: 'message_stop' };
        }
      };

      mockClaudeCreate.mockResolvedValueOnce(mockStream);

      await provider.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        onChunk,
        onComplete
      );

      expect(onChunk).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
    });

    it('should provide consistent chunk format across providers', async () => {
      // OpenAI
      const openai = new OpenAIService('sk-test', 'gpt-4o');
      let openaiChunk;
      const onOpenAIChunk = (chunk) => { openaiChunk = chunk; };

      const openaiStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'content' } }] };
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        }
      };

      mockOpenAICreate.mockResolvedValueOnce(openaiStream);
      await openai.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        onOpenAIChunk
      );

      // Claude
      const claude = new ClaudeService('sk-ant-test', 'claude-sonnet-4-5');
      let claudeChunk;
      const onClaudeChunk = (chunk) => { claudeChunk = chunk; };

      const claudeStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { text: 'content' } };
          yield { type: 'message_stop' };
        }
      };

      mockClaudeCreate.mockResolvedValueOnce(claudeStream);
      await claude.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        onClaudeChunk
      );

      // Both should have similar chunk structure
      expect(openaiChunk).toHaveProperty('content');
      expect(claudeChunk).toHaveProperty('content');
      expect(openaiChunk).toHaveProperty('fullContent');
      expect(claudeChunk).toHaveProperty('fullContent');
      expect(openaiChunk).toHaveProperty('isComplete');
      expect(claudeChunk).toHaveProperty('isComplete');
    });
  });

  describe('Factory Pattern Usage', () => {
    it('should create providers through factory consistently', () => {
      const providers = ['openai', 'claude'];

      providers.forEach(providerName => {
        const provider = AIProviderFactory.getProvider({
          provider: providerName,
          apiKey: 'test-key',
          model: providerName === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-5'
        });

        expect(provider).toBeDefined();
        expect(provider).toHaveProperty('chat');
        expect(provider).toHaveProperty('chatStream');
        expect(provider).toHaveProperty('testConnection');
      });
    });

    it('should validate all providers consistently', () => {
      const providers = ['openai', 'claude'];

      providers.forEach(provider => {
        const result = AIProviderFactory.validateConfig({
          provider,
          model: provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-5',
          temperature: 0.7
        });

        expect(result.valid).toBe(true);
      });
    });

    it('should reject invalid configurations for all providers', () => {
      const providers = ['openai', 'claude'];

      providers.forEach(provider => {
        const result = AIProviderFactory.validateConfig({
          provider,
          model: 'invalid-model',
          temperature: 3.0
        });

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Multi-Provider Scenarios', () => {
    it('should support parallel requests to different providers', async () => {
      const openai = new OpenAIService('sk-test', 'gpt-4o');
      const claude = new ClaudeService('sk-ant-test', 'claude-sonnet-4-5');

      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OpenAI', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      });

      mockClaudeCreate.mockResolvedValueOnce({
        content: [{ text: 'Claude' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 2 }
      });

      const [openaiResult, claudeResult] = await Promise.all([
        openai.chat({ messages: [{ role: 'user', content: 'Test' }] }),
        claude.chat({ messages: [{ role: 'user', content: 'Test' }] })
      ]);

      expect(openaiResult.content).toBe('OpenAI');
      expect(claudeResult.content).toBe('Claude');
    });

    it('should handle failover between providers', async () => {
      const openai = new OpenAIService('sk-test', 'gpt-4o');

      // OpenAI fails
      mockOpenAICreate.mockRejectedValueOnce(new Error('OpenAI unavailable'));

      let openaiError = null;
      try {
        await openai.chat({ messages: [{ role: 'user', content: 'Test' }] });
      } catch (error) {
        openaiError = error;
      }

      expect(openaiError).not.toBeNull();

      // Failover to Claude
      const claude = new ClaudeService('sk-ant-test', 'claude-sonnet-4-5');
      mockClaudeCreate.mockResolvedValueOnce({
        content: [{ text: 'Claude response' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      });

      const result = await claude.chat({ messages: [{ role: 'user', content: 'Test' }] });

      expect(result.content).toBe('Claude response');
    });
  });
});
