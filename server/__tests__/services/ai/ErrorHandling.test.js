/**
 * AI Services Error Handling and Edge Cases Tests
 * Comprehensive tests for error scenarios, retry logic, and edge cases
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
const OpenAIService = require('../../../services/ai/openaiService');
const ClaudeService = require('../../../services/ai/claudeService');
const logger = require('../../../utils/logger');

describe('AI Services - Error Handling and Edge Cases', () => {
  let mockOpenAICreate;
  let mockClaudeCreate;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOpenAICreate = jest.fn();
    mockClaudeCreate = jest.fn();

    OpenAI.mockImplementation(() => ({
      chat: { completions: { create: mockOpenAICreate } }
    }));

    Anthropic.mockImplementation(() => ({
      messages: { create: mockClaudeCreate }
    }));
  });

  describe('Network and Connection Errors', () => {
    it('should handle ECONNREFUSED error', async () => {
      const service = new OpenAIService('sk-test', 'gpt-4o');
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      mockOpenAICreate.mockRejectedValueOnce(error);

      await expect(service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toMatchObject({
        provider: 'openai',
        message: 'Connection refused'
      });
    });

    it('should handle ETIMEDOUT error', async () => {
      const service = new OpenAIService('sk-test', 'gpt-4o');
      const error = new Error('Request timeout');
      error.code = 'ETIMEDOUT';
      mockOpenAICreate.mockRejectedValueOnce(error);

      await expect(service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toMatchObject({
        provider: 'openai',
        message: 'Request timeout'
      });
    });

    it('should handle ENOTFOUND error', async () => {
      const service = new OpenAIService('sk-test', 'gpt-4o');
      const error = new Error('DNS lookup failed');
      error.code = 'ENOTFOUND';
      mockOpenAICreate.mockRejectedValueOnce(error);

      await expect(service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toMatchObject({
        provider: 'openai'
      });
    });

    it('should handle network errors for Claude', async () => {
      const service = new ClaudeService('sk-ant-test', 'claude-sonnet-4-5');
      const error = new Error('Network error');
      error.code = 'ENETUNREACH';
      mockClaudeCreate.mockRejectedValueOnce(error);

      await expect(service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toMatchObject({
        provider: 'claude'
      });
    });
  });

  describe('HTTP Status Code Errors', () => {
    describe('OpenAI Error Codes', () => {
      it('should handle 400 Bad Request', async () => {
        const service = new OpenAIService('sk-test', 'gpt-4o');
        const error = new Error('Bad request');
        error.response = {
          status: 400,
          data: { error: { message: 'Invalid parameters', type: 'invalid_request_error' } }
        };
        mockOpenAICreate.mockRejectedValueOnce(error);

        await expect(service.chat({
          messages: [{ role: 'user', content: 'Test' }]
        })).rejects.toMatchObject({
          statusCode: 400,
          type: 'invalid_request_error'
        });
      });

      it('should handle 401 Unauthorized', async () => {
        const service = new OpenAIService('invalid-key', 'gpt-4o');
        const error = new Error('Unauthorized');
        error.response = {
          status: 401,
          data: { error: { message: 'Invalid API key', type: 'invalid_api_key' } }
        };
        mockOpenAICreate.mockRejectedValueOnce(error);

        await expect(service.chat({
          messages: [{ role: 'user', content: 'Test' }]
        })).rejects.toMatchObject({
          statusCode: 401,
          type: 'invalid_api_key'
        });
      });

      it('should handle 403 Forbidden', async () => {
        const service = new OpenAIService('sk-test', 'gpt-4o');
        const error = new Error('Forbidden');
        error.response = {
          status: 403,
          data: { error: { message: 'Access denied', type: 'permission_error' } }
        };
        mockOpenAICreate.mockRejectedValueOnce(error);

        await expect(service.chat({
          messages: [{ role: 'user', content: 'Test' }]
        })).rejects.toMatchObject({
          statusCode: 403
        });
      });

      it('should handle 404 Not Found', async () => {
        const service = new OpenAIService('sk-test', 'invalid-model');
        const error = new Error('Not found');
        error.response = {
          status: 404,
          data: { error: { message: 'Model not found', type: 'not_found_error' } }
        };
        mockOpenAICreate.mockRejectedValueOnce(error);

        await expect(service.chat({
          messages: [{ role: 'user', content: 'Test' }]
        })).rejects.toMatchObject({
          statusCode: 404
        });
      });

      it('should handle 429 Rate Limit', async () => {
        const service = new OpenAIService('sk-test', 'gpt-4o');
        const error = new Error('Rate limit exceeded');
        error.response = {
          status: 429,
          data: { error: { message: 'Rate limit exceeded', type: 'rate_limit_error' } }
        };
        mockOpenAICreate.mockRejectedValueOnce(error);

        await expect(service.chat({
          messages: [{ role: 'user', content: 'Test' }]
        })).rejects.toMatchObject({
          statusCode: 429,
          type: 'rate_limit_error'
        });
      });

      it('should handle 500 Internal Server Error', async () => {
        const service = new OpenAIService('sk-test', 'gpt-4o');
        const error = new Error('Internal server error');
        error.response = {
          status: 500,
          data: { error: { message: 'Server error', type: 'server_error' } }
        };
        mockOpenAICreate.mockRejectedValueOnce(error);

        await expect(service.chat({
          messages: [{ role: 'user', content: 'Test' }]
        })).rejects.toMatchObject({
          statusCode: 500
        });
      });

      it('should handle 502 Bad Gateway', async () => {
        const service = new OpenAIService('sk-test', 'gpt-4o');
        const error = new Error('Bad gateway');
        error.response = {
          status: 502,
          data: { error: { message: 'Bad gateway', type: 'server_error' } }
        };
        mockOpenAICreate.mockRejectedValueOnce(error);

        await expect(service.chat({
          messages: [{ role: 'user', content: 'Test' }]
        })).rejects.toMatchObject({
          statusCode: 502
        });
      });

      it('should handle 503 Service Unavailable', async () => {
        const service = new OpenAIService('sk-test', 'gpt-4o');
        const error = new Error('Service unavailable');
        error.response = {
          status: 503,
          data: { error: { message: 'Service unavailable', type: 'server_error' } }
        };
        mockOpenAICreate.mockRejectedValueOnce(error);

        await expect(service.chat({
          messages: [{ role: 'user', content: 'Test' }]
        })).rejects.toMatchObject({
          statusCode: 503
        });
      });
    });

    describe('Claude Error Codes', () => {
      it('should handle 400 Invalid Request', async () => {
        const service = new ClaudeService('sk-ant-test', 'claude-sonnet-4-5');
        const error = new Error('Invalid request');
        error.status = 400;
        error.type = 'invalid_request_error';
        mockClaudeCreate.mockRejectedValueOnce(error);

        await expect(service.chat({
          messages: [{ role: 'user', content: 'Test' }]
        })).rejects.toMatchObject({
          statusCode: 400,
          type: 'invalid_request_error'
        });
      });

      it('should handle 401 Authentication Error', async () => {
        const service = new ClaudeService('invalid-key', 'claude-sonnet-4-5');
        const error = new Error('Invalid API key');
        error.status = 401;
        error.type = 'authentication_error';
        mockClaudeCreate.mockRejectedValueOnce(error);

        await expect(service.chat({
          messages: [{ role: 'user', content: 'Test' }]
        })).rejects.toMatchObject({
          statusCode: 401,
          type: 'authentication_error',
          message: expect.stringContaining('Invalid Anthropic API key')
        });
      });

      it('should handle 429 Rate Limit Error', async () => {
        const service = new ClaudeService('sk-ant-test', 'claude-sonnet-4-5');
        const error = new Error('Rate limit');
        error.status = 429;
        error.type = 'rate_limit_error';
        mockClaudeCreate.mockRejectedValueOnce(error);

        await expect(service.chat({
          messages: [{ role: 'user', content: 'Test' }]
        })).rejects.toMatchObject({
          statusCode: 429,
          type: 'rate_limit_error'
        });
      });

      it('should handle 529 Overloaded Error', async () => {
        const service = new ClaudeService('sk-ant-test', 'claude-sonnet-4-5');
        const error = new Error('Service overloaded');
        error.status = 529;
        error.type = 'overloaded_error';
        mockClaudeCreate.mockRejectedValueOnce(error);

        await expect(service.chat({
          messages: [{ role: 'user', content: 'Test' }]
        })).rejects.toMatchObject({
          statusCode: 529
        });
      });
    });
  });

  describe('Message Validation Edge Cases', () => {
    it('should handle very long messages', async () => {
      const service = new OpenAIService('sk-test', 'gpt-4o');
      const longMessage = 'x'.repeat(100000);

      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Response', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 25000, completion_tokens: 100, total_tokens: 25100 }
      });

      const result = await service.chat({
        messages: [{ role: 'user', content: longMessage }]
      });

      expect(result.content).toBe('Response');
    });

    it('should handle messages with special characters', async () => {
      const service = new OpenAIService('sk-test', 'gpt-4o');
      const specialMessage = '!@#$%^&*(){}[]|\\:";\'<>?,./`~\n\t\r';

      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Handled', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });

      const result = await service.chat({
        messages: [{ role: 'user', content: specialMessage }]
      });

      expect(result).toBeDefined();
    });

    it('should handle messages with unicode characters', async () => {
      const service = new OpenAIService('sk-test', 'gpt-4o');
      const unicodeMessage = '你好 مرحبا שלום привет 🎉🚀🌟';

      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Response', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 15, completion_tokens: 5, total_tokens: 20 }
      });

      const result = await service.chat({
        messages: [{ role: 'user', content: unicodeMessage }]
      });

      expect(result).toBeDefined();
    });

    it('should handle messages with only whitespace', async () => {
      const service = new OpenAIService('sk-test', 'gpt-4o');

      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Response', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
      });

      const result = await service.chat({
        messages: [{ role: 'user', content: '     ' }]
      });

      expect(result).toBeDefined();
    });

    it('should handle messages with newlines and tabs', async () => {
      const service = new OpenAIService('sk-test', 'gpt-4o');
      const message = 'Line 1\n\nLine 2\tTabbed\rCarriage';

      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Response', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });

      const result = await service.chat({
        messages: [{ role: 'user', content: message }]
      });

      expect(result).toBeDefined();
    });
  });

  describe('Streaming Error Scenarios', () => {
    it('should handle stream interruption', async () => {
      const service = new OpenAIService('sk-test', 'gpt-4o');
      const onError = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Start' } }] };
          throw new Error('Stream interrupted');
        }
      };

      mockOpenAICreate.mockResolvedValueOnce(mockStream);

      await service.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        null,
        null,
        onError
      );

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          message: 'Stream interrupted'
        })
      );
    });

    it('should handle malformed stream chunks', async () => {
      const service = new OpenAIService('sk-test', 'gpt-4o');
      const onChunk = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: null }] }; // Malformed
          yield { choices: [{ delta: { content: 'Valid' } }] };
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        }
      };

      mockOpenAICreate.mockResolvedValueOnce(mockStream);

      await service.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        onChunk
      );

      // Should only get valid chunk
      expect(onChunk).toHaveBeenCalledTimes(1);
    });

    it('should handle Claude stream with missing events', async () => {
      const service = new ClaudeService('sk-ant-test', 'claude-sonnet-4-5');
      const onComplete = jest.fn();

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          // Missing message_start
          yield { type: 'content_block_delta', delta: { text: 'Content' } };
          yield { type: 'message_stop' };
        }
      };

      mockClaudeCreate.mockResolvedValueOnce(mockStream);

      await service.chatStream(
        { messages: [{ role: 'user', content: 'Test' }] },
        null,
        onComplete
      );

      expect(onComplete).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle zero-token response', async () => {
      const service = new OpenAIService('sk-test', 'gpt-4o');

      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: '', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 }
      });

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(result.content).toBe('');
      expect(result.usage.completionTokens).toBe(0);
    });

    it('should handle maximum token response', async () => {
      const service = new OpenAIService('sk-test', 'gpt-4o');

      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{
          message: { content: 'x'.repeat(16384), role: 'assistant' },
          finish_reason: 'length'
        }],
        usage: { prompt_tokens: 100, completion_tokens: 16384, total_tokens: 16484 }
      });

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Generate max tokens' }],
        maxTokens: 16384
      });

      expect(result.finishReason).toBe('length');
      expect(result.usage.completionTokens).toBe(16384);
    });

    it('should handle temperature edge cases', async () => {
      const service = new OpenAIService('sk-test', 'gpt-4o');

      // Temperature = 0
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Deterministic', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
      });

      await service.chat({
        messages: [{ role: 'user', content: 'Test' }],
        temperature: 0
      });

      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0 })
      );

      // Temperature = 2
      mockOpenAICreate.mockClear();
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Random', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
      });

      await service.chat({
        messages: [{ role: 'user', content: 'Test' }],
        temperature: 2
      });

      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 2 })
      );
    });

    it('should handle single message conversation', async () => {
      const service = new OpenAIService('sk-test', 'gpt-4o');

      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Response', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
      });

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Single message' }]
      });

      expect(result).toBeDefined();
      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'Single message' }]
        })
      );
    });

    it('should handle very long conversation history', async () => {
      const service = new OpenAIService('sk-test', 'gpt-4o');
      const longHistory = [];

      // Create 100 message history
      for (let i = 0; i < 100; i++) {
        longHistory.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `Message ${i}` });
      }

      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Response', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5000, completion_tokens: 100, total_tokens: 5100 }
      });

      const result = await service.chat({ messages: longHistory });

      expect(result).toBeDefined();
      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ content: 'Message 0' })
          ])
        })
      );
    });
  });

  describe('Logging and Debugging', () => {
    it('should log errors for OpenAI failures', async () => {
      const service = new OpenAIService('sk-test', 'gpt-4o');
      mockOpenAICreate.mockRejectedValueOnce(new Error('Test error'));

      try {
        await service.chat({ messages: [{ role: 'user', content: 'Test' }] });
      } catch (error) {
        // Error expected
      }

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('OpenAI API error'),
        expect.anything()
      );
    });

    it('should log errors for Claude failures', async () => {
      const service = new ClaudeService('sk-ant-test', 'claude-sonnet-4-5');
      mockClaudeCreate.mockRejectedValueOnce(new Error('Test error'));

      try {
        await service.chat({ messages: [{ role: 'user', content: 'Test' }] });
      } catch (error) {
        // Error expected
      }

      expect(logger.error).toHaveBeenCalled();
    });

    it('should log authentication errors specially for Claude', async () => {
      const service = new ClaudeService('invalid', 'claude-sonnet-4-5');
      const error = new Error('Auth failed');
      error.status = 401;
      mockClaudeCreate.mockRejectedValueOnce(error);

      try {
        await service.chat({ messages: [{ role: 'user', content: 'Test' }] });
      } catch (err) {
        // Error expected
      }

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('AUTHENTICATION FAILED'),
        expect.any(String)
      );
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent requests', async () => {
      const service = new OpenAIService('sk-test', 'gpt-4o');

      mockOpenAICreate
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Response 1', role: 'assistant' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Response 2', role: 'assistant' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Response 3', role: 'assistant' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
        });

      const results = await Promise.all([
        service.chat({ messages: [{ role: 'user', content: 'Test 1' }] }),
        service.chat({ messages: [{ role: 'user', content: 'Test 2' }] }),
        service.chat({ messages: [{ role: 'user', content: 'Test 3' }] })
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].content).toBe('Response 1');
      expect(results[1].content).toBe('Response 2');
      expect(results[2].content).toBe('Response 3');
    });

    it('should handle mixed success and failure in concurrent requests', async () => {
      const service = new OpenAIService('sk-test', 'gpt-4o');

      mockOpenAICreate
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Success', role: 'assistant' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
        })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Success', role: 'assistant' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
        });

      const results = await Promise.allSettled([
        service.chat({ messages: [{ role: 'user', content: 'Test 1' }] }),
        service.chat({ messages: [{ role: 'user', content: 'Test 2' }] }),
        service.chat({ messages: [{ role: 'user', content: 'Test 3' }] })
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });
});
