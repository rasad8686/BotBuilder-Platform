/**
 * ClaudeService Tests
 * Tests for server/services/ai/claudeService.js
 */

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn()
    }
  }));
});

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const Anthropic = require('@anthropic-ai/sdk');
const ClaudeService = require('../../../services/ai/claudeService');

describe('ClaudeService', () => {
  let claude;
  let mockMessagesCreate;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMessagesCreate = jest.fn();
    Anthropic.mockImplementation(() => ({
      messages: {
        create: mockMessagesCreate
      }
    }));
    claude = new ClaudeService('sk-ant-test-api-key', 'claude-3-5-sonnet-20241022');
  });

  describe('constructor', () => {
    it('should throw error if API key is not provided', () => {
      expect(() => new ClaudeService()).toThrow('Anthropic API key is required');
    });

    it('should throw error if API key is empty', () => {
      expect(() => new ClaudeService('')).toThrow('Anthropic API key is required');
    });

    it('should initialize with API key and model', () => {
      const service = new ClaudeService('sk-ant-test', 'claude-3-opus');
      expect(service.model).toBe('claude-3-opus');
    });

    it('should use default model if not specified', () => {
      const service = new ClaudeService('sk-ant-test');
      expect(service.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should trim whitespace from API key', () => {
      expect(() => new ClaudeService('  sk-ant-test  ')).not.toThrow();
    });
  });

  describe('convertMessages', () => {
    it('should extract system message separately', () => {
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' }
      ];

      const result = claude.convertMessages(messages);

      expect(result.system).toBe('You are a helpful assistant.');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
    });

    it('should convert user messages', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
        { role: 'user', content: 'How are you?' }
      ];

      const result = claude.convertMessages(messages);

      expect(result.system).toBe('');
      expect(result.messages).toHaveLength(3);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[1].role).toBe('assistant');
      expect(result.messages[2].role).toBe('user');
    });

    it('should handle empty messages array', () => {
      const result = claude.convertMessages([]);
      expect(result.system).toBe('');
      expect(result.messages).toHaveLength(0);
    });
  });

  describe('chat', () => {
    it('should send chat completion request', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ text: 'Hello! How can I help you?' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 20
        }
      });

      const result = await claude.chat({
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(result.provider).toBe('claude');
      expect(result.content).toBe('Hello! How can I help you?');
      expect(result.role).toBe('assistant');
      expect(result.usage.totalTokens).toBe(30);
    });

    it('should throw error if messages array is empty', async () => {
      await expect(claude.chat({ messages: [] })).rejects.toThrow('Messages array is required');
    });

    it('should throw error if messages is not provided', async () => {
      await expect(claude.chat({})).rejects.toThrow('Messages array is required');
    });

    it('should throw error if messages is not an array', async () => {
      await expect(claude.chat({ messages: 'invalid' })).rejects.toThrow('Messages array is required');
    });

    it('should use default parameters', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ text: 'OK' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 2 }
      });

      await claude.chat({
        messages: [{ role: 'user', content: 'Hi' }]
      });

      expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
        temperature: 0.7,
        max_tokens: 1000,
        stream: false
      }));
    });

    it('should use custom parameters', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ text: 'OK' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 2 }
      });

      await claude.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        temperature: 0.9,
        maxTokens: 500,
        stream: false
      });

      expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
        temperature: 0.9,
        max_tokens: 500
      }));
    });

    it('should add system message to request if present', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ text: 'OK' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 2 }
      });

      await claude.chat({
        messages: [
          { role: 'system', content: 'You are a poet.' },
          { role: 'user', content: 'Write a haiku' }
        ]
      });

      expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
        system: 'You are a poet.'
      }));
    });

    it('should return stream for streaming requests', async () => {
      const mockStream = { async *[Symbol.asyncIterator]() { yield { type: 'test' }; } };
      mockMessagesCreate.mockResolvedValueOnce(mockStream);

      const result = await claude.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        stream: true
      });

      expect(result).toBe(mockStream);
    });

    it('should handle API authentication error', async () => {
      const authError = new Error('Invalid API key');
      authError.status = 401;
      mockMessagesCreate.mockRejectedValueOnce(authError);

      await expect(claude.chat({
        messages: [{ role: 'user', content: 'Hi' }]
      })).rejects.toMatchObject({
        provider: 'claude',
        type: 'authentication_error',
        statusCode: 401
      });
    });

    it('should handle generic API errors', async () => {
      const error = new Error('Rate limit exceeded');
      error.status = 429;
      error.type = 'rate_limit_error';
      mockMessagesCreate.mockRejectedValueOnce(error);

      await expect(claude.chat({
        messages: [{ role: 'user', content: 'Hi' }]
      })).rejects.toMatchObject({
        provider: 'claude',
        statusCode: 429
      });
    });

    it('should include response time in result', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ text: 'OK' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 2 }
      });

      const result = await claude.chat({
        messages: [{ role: 'user', content: 'Hi' }]
      });

      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('chatStream', () => {
    it('should handle streaming messages', async () => {
      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'message_start', message: { usage: { input_tokens: 10 } } };
          yield { type: 'content_block_delta', delta: { text: 'Hello' } };
          yield { type: 'content_block_delta', delta: { text: ' World' } };
          yield { type: 'message_delta', usage: { output_tokens: 5 } };
          yield { type: 'message_stop' };
        }
      };
      mockMessagesCreate.mockResolvedValueOnce(mockStream);

      await claude.chatStream(
        { messages: [{ role: 'user', content: 'Hi' }] },
        onChunk,
        onComplete,
        onError
      );

      expect(onChunk).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle streaming errors', async () => {
      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      mockMessagesCreate.mockRejectedValueOnce(new Error('Stream error'));

      await claude.chatStream(
        { messages: [{ role: 'user', content: 'Hi' }] },
        onChunk,
        onComplete,
        onError
      );

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'claude',
        message: 'Stream error'
      }));
    });

    it('should accumulate full content during streaming', async () => {
      const chunks = [];
      const onChunk = (chunk) => chunks.push(chunk);
      const onComplete = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { text: 'A' } };
          yield { type: 'content_block_delta', delta: { text: 'B' } };
          yield { type: 'content_block_delta', delta: { text: 'C' } };
          yield { type: 'message_stop' };
        }
      };
      mockMessagesCreate.mockResolvedValueOnce(mockStream);

      await claude.chatStream(
        { messages: [{ role: 'user', content: 'Hi' }] },
        onChunk,
        onComplete
      );

      expect(chunks[2].fullContent).toBe('ABC');
    });

    it('should use default parameters for streaming', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'message_stop' };
        }
      };
      mockMessagesCreate.mockResolvedValueOnce(mockStream);

      await claude.chatStream(
        { messages: [{ role: 'user', content: 'Hi' }] },
        null,
        null
      );

      expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
        temperature: 0.7,
        max_tokens: 1000,
        stream: true
      }));
    });

    it('should handle empty delta text', async () => {
      const onChunk = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { text: '' } };
          yield { type: 'content_block_delta', delta: {} };
          yield { type: 'message_stop' };
        }
      };
      mockMessagesCreate.mockResolvedValueOnce(mockStream);

      await claude.chatStream(
        { messages: [{ role: 'user', content: 'Hi' }] },
        onChunk
      );

      expect(onChunk).not.toHaveBeenCalled();
    });
  });

  describe('testConnection', () => {
    it('should return success on successful connection', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ text: 'OK' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 2 }
      });

      const result = await claude.testConnection();

      expect(result.success).toBe(true);
      expect(result.provider).toBe('claude');
      expect(result.message).toBe('Connection successful');
    });

    it('should return failure on connection error', async () => {
      mockMessagesCreate.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await claude.testConnection();

      expect(result.success).toBe(false);
      expect(result.provider).toBe('claude');
      expect(result.message).toBe('Connection failed');
    });

    it('should include model in test result', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ text: 'OK' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 2 }
      });

      const result = await claude.testConnection();

      expect(result.model).toBe('claude-3-5-sonnet-20241022');
    });
  });
});
