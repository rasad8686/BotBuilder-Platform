/**
 * Enhanced OpenAI Provider Tests
 * Comprehensive tests for OpenAI API interactions, error handling, retry logic, and rate limiting
 */

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }));
});

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const OpenAI = require('openai');
const OpenAIService = require('../../../services/ai/openaiService');
const logger = require('../../../utils/logger');

describe('OpenAIService - Enhanced Tests', () => {
  let service;
  let mockCompletionsCreate;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCompletionsCreate = jest.fn();
    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCompletionsCreate
        }
      }
    }));
    service = new OpenAIService('sk-test-key-123', 'gpt-4o');
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with full API key', () => {
      const key = 'sk-proj-1234567890abcdefghijklmnopqrstuvwxyz';
      const svc = new OpenAIService(key, 'gpt-4o');
      expect(svc.model).toBe('gpt-4o');
    });

    it('should handle API keys with special characters', () => {
      expect(() => new OpenAIService('sk-test_key-123.abc', 'gpt-4o')).not.toThrow();
    });

    it('should reject whitespace-only API key', () => {
      expect(() => new OpenAIService('   ', 'gpt-4o')).toThrow('OpenAI API key is required');
    });

    it('should initialize client with correct configuration', () => {
      new OpenAIService('sk-test');
      expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'sk-test' });
    });

    it('should set default model when not provided', () => {
      const svc = new OpenAIService('sk-test');
      expect(svc.model).toBe('gpt-4o-mini');
    });

    it('should accept all valid OpenAI models', () => {
      const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
      models.forEach(model => {
        const svc = new OpenAIService('sk-test', model);
        expect(svc.model).toBe(model);
      });
    });
  });

  describe('Chat Completion - Success Scenarios', () => {
    it('should handle simple chat completion', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: 'Hello!', role: 'assistant' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      });

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Hi' }]
      });

      expect(result.content).toBe('Hello!');
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4o');
    });

    it('should handle multi-turn conversations', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: 'Response', role: 'assistant' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 }
      });

      const result = await service.chat({
        messages: [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' },
          { role: 'user', content: 'Second message' }
        ]
      });

      expect(result.content).toBe('Response');
      expect(mockCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'user', content: 'First message' },
            { role: 'assistant', content: 'First response' },
            { role: 'user', content: 'Second message' }
          ])
        })
      );
    });

    it('should handle system messages', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: 'Acknowledged', role: 'assistant' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 15, completion_tokens: 3, total_tokens: 18 }
      });

      await service.chat({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello' }
        ]
      });

      expect(mockCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'system', content: 'You are a helpful assistant.' }
          ])
        })
      );
    });

    it('should respect custom temperature setting', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      });

      await service.chat({
        messages: [{ role: 'user', content: 'Test' }],
        temperature: 0.9
      });

      expect(mockCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.9 })
      );
    });

    it('should respect custom maxTokens setting', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      });

      await service.chat({
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 2000
      });

      expect(mockCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 2000 })
      );
    });

    it('should include accurate token usage', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      });

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(result.usage.promptTokens).toBe(100);
      expect(result.usage.completionTokens).toBe(50);
      expect(result.usage.totalTokens).toBe(150);
    });

    it('should measure response time', async () => {
      mockCompletionsCreate.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          choices: [{ message: { content: 'OK', role: 'assistant' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
        };
      });

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(result.responseTime).toBeGreaterThanOrEqual(100);
    });

    it('should include raw response', async () => {
      const rawResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [{ message: { content: 'OK', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      };

      mockCompletionsCreate.mockResolvedValueOnce(rawResponse);

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(result.rawResponse).toEqual(rawResponse);
      expect(result.rawResponse.id).toBe('chatcmpl-123');
    });
  });

  describe('Chat Completion - Finish Reasons', () => {
    it('should handle finish_reason: stop', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Done', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      });

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(result.finishReason).toBe('stop');
    });

    it('should handle finish_reason: length', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: 'Truncated...', role: 'assistant' },
          finish_reason: 'length'
        }],
        usage: { prompt_tokens: 5, completion_tokens: 100, total_tokens: 105 }
      });

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Write a long story' }],
        maxTokens: 100
      });

      expect(result.finishReason).toBe('length');
    });

    it('should handle finish_reason: content_filter', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: '', role: 'assistant' },
          finish_reason: 'content_filter'
        }],
        usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 }
      });

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Inappropriate content' }]
      });

      expect(result.finishReason).toBe('content_filter');
    });
  });

  describe('Chat Completion - Error Handling', () => {
    it('should handle rate limit errors (429)', async () => {
      const error = new Error('Rate limit exceeded');
      error.response = {
        data: { error: { message: 'Rate limit exceeded', type: 'rate_limit_error' } },
        status: 429
      };
      mockCompletionsCreate.mockRejectedValueOnce(error);

      await expect(service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toMatchObject({
        provider: 'openai',
        message: 'Rate limit exceeded',
        type: 'rate_limit_error',
        statusCode: 429
      });

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle authentication errors (401)', async () => {
      const error = new Error('Invalid API key');
      error.response = {
        data: { error: { message: 'Invalid API key', type: 'invalid_api_key' } },
        status: 401
      };
      mockCompletionsCreate.mockRejectedValueOnce(error);

      await expect(service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toMatchObject({
        provider: 'openai',
        statusCode: 401,
        type: 'invalid_api_key'
      });
    });

    it('should handle insufficient quota errors (429)', async () => {
      const error = new Error('Insufficient quota');
      error.response = {
        data: { error: { message: 'Insufficient quota', type: 'insufficient_quota' } },
        status: 429
      };
      mockCompletionsCreate.mockRejectedValueOnce(error);

      await expect(service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toMatchObject({
        provider: 'openai',
        type: 'insufficient_quota',
        statusCode: 429
      });
    });

    it('should handle invalid request errors (400)', async () => {
      const error = new Error('Invalid request');
      error.response = {
        data: { error: { message: 'Invalid request parameters', type: 'invalid_request_error' } },
        status: 400
      };
      mockCompletionsCreate.mockRejectedValueOnce(error);

      await expect(service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toMatchObject({
        provider: 'openai',
        statusCode: 400,
        type: 'invalid_request_error'
      });
    });

    it('should handle server errors (500)', async () => {
      const error = new Error('Internal server error');
      error.response = {
        data: { error: { message: 'Internal server error', type: 'server_error' } },
        status: 500
      };
      mockCompletionsCreate.mockRejectedValueOnce(error);

      await expect(service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toMatchObject({
        provider: 'openai',
        statusCode: 500
      });
    });

    it('should handle network errors without response', async () => {
      const error = new Error('Network connection failed');
      mockCompletionsCreate.mockRejectedValueOnce(error);

      await expect(service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toMatchObject({
        provider: 'openai',
        message: 'Network connection failed',
        type: 'unknown_error',
        statusCode: 500
      });
    });

    it('should handle timeout errors', async () => {
      const error = new Error('Request timeout');
      error.code = 'ETIMEDOUT';
      mockCompletionsCreate.mockRejectedValueOnce(error);

      await expect(service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toMatchObject({
        provider: 'openai',
        message: 'Request timeout'
      });
    });

    it('should preserve original error in thrown error', async () => {
      const originalError = new Error('Original error');
      mockCompletionsCreate.mockRejectedValueOnce(originalError);

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
    it('should handle basic streaming', async () => {
      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Hello' } }] };
          yield { choices: [{ delta: { content: ' world' } }] };
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        }
      };
      mockCompletionsCreate.mockResolvedValueOnce(mockStream);

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
          yield { choices: [{ delta: { content: 'First' } }] };
          yield { choices: [{ delta: { content: ' second' } }] };
          yield { choices: [{ delta: { content: ' third' } }] };
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        }
      };
      mockCompletionsCreate.mockResolvedValueOnce(mockStream);

      await service.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        onChunk
      );

      expect(chunks[0].fullContent).toBe('First');
      expect(chunks[1].fullContent).toBe('First second');
      expect(chunks[2].fullContent).toBe('First second third');
    });

    it('should pass individual chunks correctly', async () => {
      const chunks = [];
      const onChunk = (chunk) => chunks.push(chunk.content);

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'A' } }] };
          yield { choices: [{ delta: { content: 'B' } }] };
          yield { choices: [{ delta: { content: 'C' } }] };
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        }
      };
      mockCompletionsCreate.mockResolvedValueOnce(mockStream);

      await service.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        onChunk
      );

      expect(chunks).toEqual(['A', 'B', 'C']);
    });

    it('should mark chunks as incomplete', async () => {
      const chunks = [];
      const onChunk = (chunk) => chunks.push(chunk.isComplete);

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Test' } }] };
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        }
      };
      mockCompletionsCreate.mockResolvedValueOnce(mockStream);

      await service.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        onChunk
      );

      expect(chunks[0]).toBe(false);
    });

    it('should provide complete data in onComplete callback', async () => {
      const onComplete = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Complete message' } }] };
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        }
      };
      mockCompletionsCreate.mockResolvedValueOnce(mockStream);

      await service.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        null,
        onComplete
      );

      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          model: 'gpt-4o',
          content: 'Complete message',
          finishReason: 'stop',
          usage: expect.any(Object),
          responseTime: expect.any(Number)
        })
      );
    });

    it('should estimate token usage for streaming', async () => {
      const onComplete = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Test response' } }] };
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        }
      };
      mockCompletionsCreate.mockResolvedValueOnce(mockStream);

      await service.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        null,
        onComplete
      );

      const usage = onComplete.mock.calls[0][0].usage;
      expect(usage.promptTokens).toBeGreaterThan(0);
      expect(usage.completionTokens).toBeGreaterThan(0);
      expect(usage.totalTokens).toBe(usage.promptTokens + usage.completionTokens);
    });

    it('should handle streaming errors', async () => {
      const onError = jest.fn();

      mockCompletionsCreate.mockRejectedValueOnce(new Error('Stream failed'));

      await service.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        null,
        null,
        onError
      );

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          message: 'Stream failed'
        })
      );
    });

    it('should work without callbacks', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Test' } }] };
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        }
      };
      mockCompletionsCreate.mockResolvedValueOnce(mockStream);

      await expect(service.chatStream({
        messages: [{ role: 'user', content: 'Test' }]
      })).resolves.toBeUndefined();
    });

    it('should handle empty delta content gracefully', async () => {
      const onChunk = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: '' } }] };
          yield { choices: [{ delta: {} }] };
          yield { choices: [{ delta: { content: 'Real content' } }] };
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        }
      };
      mockCompletionsCreate.mockResolvedValueOnce(mockStream);

      await service.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        onChunk
      );

      expect(onChunk).toHaveBeenCalledTimes(1);
      expect(onChunk).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Real content' })
      );
    });

    it('should set stream parameter to true', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        }
      };
      mockCompletionsCreate.mockResolvedValueOnce(mockStream);

      await service.chatStream({
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(mockCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ stream: true })
      );
    });
  });

  describe('Connection Testing', () => {
    it('should return success on valid connection', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      });

      const result = await service.testConnection();

      expect(result.success).toBe(true);
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4o');
      expect(result.message).toBe('Connection successful');
    });

    it('should include test response in successful result', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK, connection works!', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
      });

      const result = await service.testConnection();

      expect(result.testResponse).toBe('OK, connection works!');
    });

    it('should return failure on connection error', async () => {
      mockCompletionsCreate.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.provider).toBe('openai');
      expect(result.message).toBe('Connection failed');
    });

    it('should include error message in failed result', async () => {
      mockCompletionsCreate.mockRejectedValueOnce(new Error('Invalid API key'));

      const result = await service.testConnection();

      expect(result.error).toBe('Invalid API key');
    });

    it('should use minimal tokens for test', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      });

      await service.testConnection();

      expect(mockCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 10,
          temperature: 0
        })
      );
    });
  });
});
