/**
 * Enhanced Anthropic/Claude Provider Tests
 * Comprehensive tests for Claude API interactions, error handling, and rate limiting
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
const logger = require('../../../utils/logger');

describe('ClaudeService - Enhanced Tests', () => {
  let service;
  let mockMessagesCreate;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMessagesCreate = jest.fn();
    Anthropic.mockImplementation(() => ({
      messages: {
        create: mockMessagesCreate
      }
    }));
    service = new ClaudeService('sk-ant-test-key', 'claude-sonnet-4-5');
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with full API key', () => {
      const key = 'sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz';
      const svc = new ClaudeService(key, 'claude-sonnet-4-5');
      expect(svc.model).toBe('claude-sonnet-4-5');
    });

    it('should trim whitespace from API key', () => {
      const key = '  sk-ant-test-key  ';
      expect(() => new ClaudeService(key, 'claude-sonnet-4-5')).not.toThrow();
    });

    it('should reject whitespace-only API key', () => {
      expect(() => new ClaudeService('   ', 'claude-sonnet-4-5')).toThrow('Anthropic API key is required');
    });

    it('should reject empty string API key', () => {
      expect(() => new ClaudeService('', 'claude-sonnet-4-5')).toThrow('Anthropic API key is required');
    });

    it('should use default model when not provided', () => {
      const svc = new ClaudeService('sk-ant-test');
      expect(svc.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should accept all valid Claude models', () => {
      const models = [
        'claude-sonnet-4-5',
        'claude-haiku-4-5',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022'
      ];
      models.forEach(model => {
        const svc = new ClaudeService('sk-ant-test', model);
        expect(svc.model).toBe(model);
      });
    });

    it('should log initialization details', () => {
      new ClaudeService('sk-ant-test-key-123', 'claude-sonnet-4-5');
      expect(logger.debug).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
    });

    it('should initialize client with trimmed API key', () => {
      new ClaudeService('  sk-ant-test  ', 'claude-sonnet-4-5');
      expect(Anthropic).toHaveBeenCalledWith({ apiKey: 'sk-ant-test' });
    });
  });

  describe('Message Format Conversion', () => {
    it('should extract system message correctly', () => {
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' }
      ];

      const result = service.convertMessages(messages);

      expect(result.system).toBe('You are a helpful assistant.');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('should handle multiple system messages by using last one', () => {
      const messages = [
        { role: 'system', content: 'First instruction' },
        { role: 'system', content: 'Second instruction' },
        { role: 'user', content: 'Hello' }
      ];

      const result = service.convertMessages(messages);

      expect(result.system).toBe('Second instruction');
    });

    it('should handle messages without system message', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];

      const result = service.convertMessages(messages);

      expect(result.system).toBe('');
      expect(result.messages).toHaveLength(2);
    });

    it('should preserve user and assistant roles', () => {
      const messages = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'First response' },
        { role: 'user', content: 'Second message' }
      ];

      const result = service.convertMessages(messages);

      expect(result.messages[0].role).toBe('user');
      expect(result.messages[1].role).toBe('assistant');
      expect(result.messages[2].role).toBe('user');
    });

    it('should handle empty messages array', () => {
      const result = service.convertMessages([]);

      expect(result.system).toBe('');
      expect(result.messages).toHaveLength(0);
    });

    it('should convert only system messages to system field', () => {
      const messages = [
        { role: 'system', content: 'Instructions' },
        { role: 'user', content: 'Query' }
      ];

      const result = service.convertMessages(messages);

      expect(result.messages.some(m => m.role === 'system')).toBe(false);
    });
  });

  describe('Chat Completion - Success Scenarios', () => {
    it('should handle simple chat completion', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ text: 'Hello! How can I assist you?' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 20 }
      });

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Hi' }]
      });

      expect(result.content).toBe('Hello! How can I assist you?');
      expect(result.provider).toBe('claude');
      expect(result.model).toBe('claude-sonnet-4-5');
    });

    it('should handle multi-turn conversations', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ text: 'Continuing the conversation' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 50, output_tokens: 15 }
      });

      await service.chat({
        messages: [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' },
          { role: 'user', content: 'Second message' }
        ]
      });

      const callArgs = mockMessagesCreate.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(3);
    });

    it('should include system message when present', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ text: 'Response' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 20, output_tokens: 10 }
      });

      await service.chat({
        messages: [
          { role: 'system', content: 'You are a poet.' },
          { role: 'user', content: 'Write a haiku' }
        ]
      });

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ system: 'You are a poet.' })
      );
    });

    it('should not include system field when no system message', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ text: 'Response' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      });

      await service.chat({
        messages: [{ role: 'user', content: 'Hello' }]
      });

      const callArgs = mockMessagesCreate.mock.calls[0][0];
      expect(callArgs.system).toBeUndefined();
    });

    it('should respect custom temperature', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ text: 'Response' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      });

      await service.chat({
        messages: [{ role: 'user', content: 'Test' }],
        temperature: 0.9
      });

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.9 })
      );
    });

    it('should respect custom maxTokens', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ text: 'Response' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      });

      await service.chat({
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 2000
      });

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 2000 })
      );
    });

    it('should calculate total tokens correctly', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ text: 'Response' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 }
      });

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(result.usage.totalTokens).toBe(150);
      expect(result.usage.promptTokens).toBe(100);
      expect(result.usage.completionTokens).toBe(50);
    });

    it('should measure response time', async () => {
      mockMessagesCreate.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          content: [{ text: 'Response' }],
          role: 'assistant',
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 }
        };
      });

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(result.responseTime).toBeGreaterThanOrEqual(100);
    });

    it('should include raw response', async () => {
      const rawResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ text: 'Response' }],
        model: 'claude-sonnet-4-5',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      };

      mockMessagesCreate.mockResolvedValueOnce(rawResponse);

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(result.rawResponse).toEqual(rawResponse);
      expect(result.rawResponse.id).toBe('msg_123');
    });
  });

  describe('Chat Completion - Error Handling', () => {
    it('should handle authentication errors (401)', async () => {
      const error = new Error('Invalid API key');
      error.status = 401;
      error.type = 'authentication_error';
      mockMessagesCreate.mockRejectedValueOnce(error);

      await expect(service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toMatchObject({
        provider: 'claude',
        type: 'authentication_error',
        statusCode: 401
      });

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('AUTHENTICATION FAILED'),
        expect.any(String)
      );
    });

    it('should provide helpful message for auth errors', async () => {
      const error = new Error('Invalid API key');
      error.status = 401;
      mockMessagesCreate.mockRejectedValueOnce(error);

      await expect(service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toMatchObject({
        message: expect.stringContaining('Invalid Anthropic API key')
      });
    });

    it('should handle rate limit errors (429)', async () => {
      const error = new Error('Rate limit exceeded');
      error.status = 429;
      error.type = 'rate_limit_error';
      mockMessagesCreate.mockRejectedValueOnce(error);

      await expect(service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toMatchObject({
        provider: 'claude',
        statusCode: 429,
        type: 'rate_limit_error'
      });
    });

    it('should handle overloaded errors (529)', async () => {
      const error = new Error('Service overloaded');
      error.status = 529;
      error.type = 'overloaded_error';
      mockMessagesCreate.mockRejectedValueOnce(error);

      await expect(service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toMatchObject({
        provider: 'claude',
        statusCode: 529
      });
    });

    it('should handle invalid request errors (400)', async () => {
      const error = new Error('Invalid request');
      error.status = 400;
      error.type = 'invalid_request_error';
      mockMessagesCreate.mockRejectedValueOnce(error);

      await expect(service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toMatchObject({
        provider: 'claude',
        statusCode: 400,
        type: 'invalid_request_error'
      });
    });

    it('should handle network errors without status', async () => {
      const error = new Error('Network error');
      mockMessagesCreate.mockRejectedValueOnce(error);

      await expect(service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toMatchObject({
        provider: 'claude',
        message: 'Network error',
        type: 'unknown_error',
        statusCode: 500
      });
    });

    it('should log detailed error information', async () => {
      const error = new Error('Test error');
      error.type = 'test_error';
      error.status = 400;
      error.error = { detail: 'Error details' };
      mockMessagesCreate.mockRejectedValueOnce(error);

      await expect(service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('API error'),
        expect.anything()
      );
    });

    it('should preserve original error', async () => {
      const originalError = new Error('Original');
      mockMessagesCreate.mockRejectedValueOnce(originalError);

      try {
        await service.chat({ messages: [{ role: 'user', content: 'Test' }] });
      } catch (error) {
        expect(error.originalError).toBe(originalError);
      }
    });
  });

  describe('Chat Completion - Input Validation', () => {
    it('should reject empty messages array', async () => {
      await expect(service.chat({ messages: [] }))
        .rejects.toThrow('Messages array is required');
    });

    it('should reject null messages', async () => {
      await expect(service.chat({ messages: null }))
        .rejects.toThrow('Messages array is required');
    });

    it('should reject undefined messages', async () => {
      await expect(service.chat({}))
        .rejects.toThrow('Messages array is required');
    });

    it('should reject non-array messages', async () => {
      await expect(service.chat({ messages: 'string' }))
        .rejects.toThrow('Messages array is required');
    });

    it('should reject object instead of array', async () => {
      await expect(service.chat({ messages: { role: 'user', content: 'Test' } }))
        .rejects.toThrow('Messages array is required');
    });
  });

  describe('Streaming Chat Completion', () => {
    it('should handle complete streaming flow', async () => {
      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'message_start', message: { usage: { input_tokens: 10 } } };
          yield { type: 'content_block_delta', delta: { text: 'Hello' } };
          yield { type: 'content_block_delta', delta: { text: ' world' } };
          yield { type: 'message_delta', usage: { output_tokens: 5 } };
          yield { type: 'message_stop' };
        }
      };
      mockMessagesCreate.mockResolvedValueOnce(mockStream);

      await service.chatStream(
        { messages: [{ role: 'user', content: 'Hi' }] },
        onChunk,
        onComplete,
        onError
      );

      expect(onChunk).toHaveBeenCalledTimes(2);
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });

    it('should accumulate content correctly', async () => {
      const chunks = [];
      const onChunk = (chunk) => chunks.push(chunk);

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { text: 'First' } };
          yield { type: 'content_block_delta', delta: { text: ' second' } };
          yield { type: 'content_block_delta', delta: { text: ' third' } };
          yield { type: 'message_stop' };
        }
      };
      mockMessagesCreate.mockResolvedValueOnce(mockStream);

      await service.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        onChunk
      );

      expect(chunks[0].fullContent).toBe('First');
      expect(chunks[1].fullContent).toBe('First second');
      expect(chunks[2].fullContent).toBe('First second third');
    });

    it('should track token usage from events', async () => {
      const onComplete = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'message_start', message: { usage: { input_tokens: 25 } } };
          yield { type: 'content_block_delta', delta: { text: 'Response' } };
          yield { type: 'message_delta', usage: { output_tokens: 15 } };
          yield { type: 'message_stop' };
        }
      };
      mockMessagesCreate.mockResolvedValueOnce(mockStream);

      await service.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        null,
        onComplete
      );

      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          usage: {
            promptTokens: 25,
            completionTokens: 15,
            totalTokens: 40
          }
        })
      );
    });

    it('should handle message_start event', async () => {
      let inputTokens = 0;
      const onComplete = jest.fn((data) => {
        inputTokens = data.usage.promptTokens;
      });

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'message_start', message: { usage: { input_tokens: 42 } } };
          yield { type: 'message_stop' };
        }
      };
      mockMessagesCreate.mockResolvedValueOnce(mockStream);

      await service.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        null,
        onComplete
      );

      expect(inputTokens).toBe(42);
    });

    it('should handle message_delta event', async () => {
      let outputTokens = 0;
      const onComplete = jest.fn((data) => {
        outputTokens = data.usage.completionTokens;
      });

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'message_delta', usage: { output_tokens: 33 } };
          yield { type: 'message_stop' };
        }
      };
      mockMessagesCreate.mockResolvedValueOnce(mockStream);

      await service.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        null,
        onComplete
      );

      expect(outputTokens).toBe(33);
    });

    it('should provide complete data on finish', async () => {
      const onComplete = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { text: 'Complete' } };
          yield { type: 'message_stop' };
        }
      };
      mockMessagesCreate.mockResolvedValueOnce(mockStream);

      await service.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        null,
        onComplete
      );

      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'claude',
          model: 'claude-sonnet-4-5',
          content: 'Complete',
          finishReason: 'end_turn',
          responseTime: expect.any(Number)
        })
      );
    });

    it('should handle streaming errors', async () => {
      const onError = jest.fn();

      mockMessagesCreate.mockRejectedValueOnce(new Error('Stream failed'));

      await service.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        null,
        null,
        onError
      );

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'claude',
          message: 'Stream failed'
        })
      );

      expect(logger.error).toHaveBeenCalled();
    });

    it('should work without callbacks', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { text: 'Test' } };
          yield { type: 'message_stop' };
        }
      };
      mockMessagesCreate.mockResolvedValueOnce(mockStream);

      await expect(service.chatStream({
        messages: [{ role: 'user', content: 'Test' }]
      })).resolves.toBeUndefined();
    });

    it('should handle empty delta text', async () => {
      const onChunk = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { text: '' } };
          yield { type: 'content_block_delta', delta: {} };
          yield { type: 'content_block_delta', delta: { text: 'Real' } };
          yield { type: 'message_stop' };
        }
      };
      mockMessagesCreate.mockResolvedValueOnce(mockStream);

      await service.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        onChunk
      );

      expect(onChunk).toHaveBeenCalledTimes(1);
    });

    it('should set stream parameter to true', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'message_stop' };
        }
      };
      mockMessagesCreate.mockResolvedValueOnce(mockStream);

      await service.chatStream({
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ stream: true })
      );
    });

    it('should include system message in streaming requests', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'message_stop' };
        }
      };
      mockMessagesCreate.mockResolvedValueOnce(mockStream);

      await service.chatStream({
        messages: [
          { role: 'system', content: 'Be concise.' },
          { role: 'user', content: 'Test' }
        ]
      });

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ system: 'Be concise.' })
      );
    });
  });

  describe('Connection Testing', () => {
    it('should return success on valid connection', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ text: 'OK' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 2 }
      });

      const result = await service.testConnection();

      expect(result.success).toBe(true);
      expect(result.provider).toBe('claude');
      expect(result.model).toBe('claude-sonnet-4-5');
      expect(result.message).toBe('Connection successful');
    });

    it('should include test response in result', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ text: 'OK, connection works!' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 5 }
      });

      const result = await service.testConnection();

      expect(result.testResponse).toBe('OK, connection works!');
    });

    it('should return failure on connection error', async () => {
      mockMessagesCreate.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.provider).toBe('claude');
      expect(result.message).toBe('Connection failed');
    });

    it('should include error message in failed result', async () => {
      mockMessagesCreate.mockRejectedValueOnce(new Error('Invalid API key'));

      const result = await service.testConnection();

      expect(result.error).toBe('Invalid API key');
    });

    it('should use minimal tokens for test', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ text: 'OK' }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 2 }
      });

      await service.testConnection();

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 10,
          temperature: 0
        })
      );
    });
  });
});
