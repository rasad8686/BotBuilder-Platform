/**
 * OpenAIService Tests
 * Tests for server/services/ai/openaiService.js
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

describe('OpenAIService', () => {
  let openai;
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
    openai = new OpenAIService('sk-test-api-key', 'gpt-4o-mini');
  });

  describe('constructor', () => {
    it('should throw error if API key is not provided', () => {
      expect(() => new OpenAIService()).toThrow('OpenAI API key is required');
    });

    it('should throw error if API key is empty', () => {
      expect(() => new OpenAIService('')).toThrow('OpenAI API key is required');
    });

    it('should initialize with API key and model', () => {
      const service = new OpenAIService('sk-test', 'gpt-4o');
      expect(service.model).toBe('gpt-4o');
    });

    it('should use default model if not specified', () => {
      const service = new OpenAIService('sk-test');
      expect(service.model).toBe('gpt-4o-mini');
    });

    it('should initialize OpenAI client', () => {
      new OpenAIService('sk-test-key');
      expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'sk-test-key' });
    });
  });

  describe('chat', () => {
    it('should send chat completion request', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: 'Hello! How can I help?', role: 'assistant' },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        }
      });

      const result = await openai.chat({
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(result.provider).toBe('openai');
      expect(result.content).toBe('Hello! How can I help?');
      expect(result.role).toBe('assistant');
      expect(result.usage.totalTokens).toBe(25);
    });

    it('should throw error if messages array is empty', async () => {
      await expect(openai.chat({ messages: [] })).rejects.toThrow('Messages array is required');
    });

    it('should throw error if messages is not provided', async () => {
      await expect(openai.chat({})).rejects.toThrow('Messages array is required');
    });

    it('should throw error if messages is not an array', async () => {
      await expect(openai.chat({ messages: 'invalid' })).rejects.toThrow('Messages array is required');
    });

    it('should use default parameters', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      });

      await openai.chat({
        messages: [{ role: 'user', content: 'Hi' }]
      });

      expect(mockCompletionsCreate).toHaveBeenCalledWith(expect.objectContaining({
        temperature: 0.7,
        max_tokens: 1000,
        stream: false
      }));
    });

    it('should use custom parameters', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      });

      await openai.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        temperature: 0.9,
        maxTokens: 500,
        stream: false
      });

      expect(mockCompletionsCreate).toHaveBeenCalledWith(expect.objectContaining({
        temperature: 0.9,
        max_tokens: 500
      }));
    });

    it('should return stream for streaming requests', async () => {
      const mockStream = { async *[Symbol.asyncIterator]() { yield { choices: [{ delta: { content: 'test' } }] }; } };
      mockCompletionsCreate.mockResolvedValueOnce(mockStream);

      const result = await openai.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        stream: true
      });

      expect(result).toBe(mockStream);
    });

    it('should include response time in result', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      });

      const result = await openai.chat({
        messages: [{ role: 'user', content: 'Hi' }]
      });

      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should include raw response in result', async () => {
      const rawResponse = {
        choices: [{ message: { content: 'OK', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      };
      mockCompletionsCreate.mockResolvedValueOnce(rawResponse);

      const result = await openai.chat({
        messages: [{ role: 'user', content: 'Hi' }]
      });

      expect(result.rawResponse).toEqual(rawResponse);
    });

    it('should handle API errors', async () => {
      const error = new Error('Rate limit exceeded');
      error.response = { data: { error: { message: 'Rate limit', type: 'rate_limit_error' } }, status: 429 };
      mockCompletionsCreate.mockRejectedValueOnce(error);

      await expect(openai.chat({
        messages: [{ role: 'user', content: 'Hi' }]
      })).rejects.toMatchObject({
        provider: 'openai',
        message: 'Rate limit',
        type: 'rate_limit_error',
        statusCode: 429
      });
    });

    it('should handle API error without response data', async () => {
      const error = new Error('Network error');
      mockCompletionsCreate.mockRejectedValueOnce(error);

      await expect(openai.chat({
        messages: [{ role: 'user', content: 'Hi' }]
      })).rejects.toMatchObject({
        provider: 'openai',
        message: 'Network error',
        type: 'unknown_error',
        statusCode: 500
      });
    });

    it('should include finish reason in response', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK', role: 'assistant' }, finish_reason: 'length' }],
        usage: { prompt_tokens: 5, completion_tokens: 100, total_tokens: 105 }
      });

      const result = await openai.chat({
        messages: [{ role: 'user', content: 'Write a long story' }]
      });

      expect(result.finishReason).toBe('length');
    });
  });

  describe('chatStream', () => {
    it('should handle streaming messages', async () => {
      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Hello' } }] };
          yield { choices: [{ delta: { content: ' World' } }] };
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        }
      };
      mockCompletionsCreate.mockResolvedValueOnce(mockStream);

      await openai.chatStream(
        { messages: [{ role: 'user', content: 'Hi' }] },
        onChunk,
        onComplete,
        onError
      );

      expect(onChunk).toHaveBeenCalledTimes(2);
      expect(onComplete).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle streaming errors', async () => {
      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      mockCompletionsCreate.mockRejectedValueOnce(new Error('Stream error'));

      await openai.chatStream(
        { messages: [{ role: 'user', content: 'Hi' }] },
        onChunk,
        onComplete,
        onError
      );

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'openai',
        message: 'Stream error'
      }));
    });

    it('should accumulate full content during streaming', async () => {
      const chunks = [];
      const onChunk = (chunk) => chunks.push(chunk);
      const onComplete = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'A' } }] };
          yield { choices: [{ delta: { content: 'B' } }] };
          yield { choices: [{ delta: { content: 'C' } }] };
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        }
      };
      mockCompletionsCreate.mockResolvedValueOnce(mockStream);

      await openai.chatStream(
        { messages: [{ role: 'user', content: 'Hi' }] },
        onChunk,
        onComplete
      );

      expect(chunks[2].fullContent).toBe('ABC');
    });

    it('should use default parameters for streaming', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        }
      };
      mockCompletionsCreate.mockResolvedValueOnce(mockStream);

      await openai.chatStream(
        { messages: [{ role: 'user', content: 'Hi' }] },
        null,
        null
      );

      expect(mockCompletionsCreate).toHaveBeenCalledWith(expect.objectContaining({
        temperature: 0.7,
        max_tokens: 1000,
        stream: true
      }));
    });

    it('should handle empty delta content', async () => {
      const onChunk = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: '' } }] };
          yield { choices: [{ delta: {} }] };
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        }
      };
      mockCompletionsCreate.mockResolvedValueOnce(mockStream);

      await openai.chatStream(
        { messages: [{ role: 'user', content: 'Hi' }] },
        onChunk
      );

      expect(onChunk).not.toHaveBeenCalled();
    });

    it('should estimate token usage', async () => {
      const onComplete = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Hello World' } }] };
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        }
      };
      mockCompletionsCreate.mockResolvedValueOnce(mockStream);

      await openai.chatStream(
        { messages: [{ role: 'user', content: 'Hi' }] },
        null,
        onComplete
      );

      expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
        usage: expect.objectContaining({
          promptTokens: expect.any(Number),
          completionTokens: expect.any(Number),
          totalTokens: expect.any(Number)
        })
      }));
    });

    it('should include response time in completion', async () => {
      const onComplete = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        }
      };
      mockCompletionsCreate.mockResolvedValueOnce(mockStream);

      await openai.chatStream(
        { messages: [{ role: 'user', content: 'Hi' }] },
        null,
        onComplete
      );

      expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
        responseTime: expect.any(Number)
      }));
    });

    it('should handle stream without callbacks', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Test' } }] };
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        }
      };
      mockCompletionsCreate.mockResolvedValueOnce(mockStream);

      // Should not throw
      await expect(openai.chatStream(
        { messages: [{ role: 'user', content: 'Hi' }] }
      )).resolves.toBeUndefined();
    });
  });

  describe('testConnection', () => {
    it('should return success on successful connection', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      });

      const result = await openai.testConnection();

      expect(result.success).toBe(true);
      expect(result.provider).toBe('openai');
      expect(result.message).toBe('Connection successful');
    });

    it('should return failure on connection error', async () => {
      mockCompletionsCreate.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await openai.testConnection();

      expect(result.success).toBe(false);
      expect(result.provider).toBe('openai');
      expect(result.message).toBe('Connection failed');
    });

    it('should include model in test result', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      });

      const result = await openai.testConnection();

      expect(result.model).toBe('gpt-4o-mini');
    });

    it('should include test response content', async () => {
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK, I received your message!', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
      });

      const result = await openai.testConnection();

      expect(result.testResponse).toBe('OK, I received your message!');
    });

    it('should include error message on failure', async () => {
      mockCompletionsCreate.mockRejectedValueOnce(new Error('Invalid API key'));

      const result = await openai.testConnection();

      expect(result.error).toBe('Invalid API key');
    });
  });
});
