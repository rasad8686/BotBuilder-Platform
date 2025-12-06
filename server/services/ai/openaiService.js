const OpenAI = require('openai');
const log = require('./../../utils/logger');

/**
 * OpenAI Service
 * Handles communication with OpenAI API
 */
class OpenAIService {
  /**
   * @param {string} apiKey - OpenAI API key
   * @param {string} model - Model identifier (e.g., 'gpt-4o')
   */
  constructor(apiKey, model) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: apiKey
    });

    this.model = model || 'gpt-4o-mini';
  }

  /**
   * Send chat completion request
   * @param {Object} params - Request parameters
   * @param {Array} params.messages - Array of message objects
   * @param {number} params.temperature - Temperature (0-2)
   * @param {number} params.maxTokens - Maximum tokens to generate
   * @param {boolean} params.stream - Enable streaming
   * @returns {Promise<Object>} Chat completion response
   */
  async chat(params) {
    const {
      messages,
      temperature = 0.7,
      maxTokens = 1000,
      stream = false
    } = params;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages array is required');
    }

    try {
      const startTime = Date.now();

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens,
        stream: stream
      });

      const responseTime = Date.now() - startTime;

      // For non-streaming responses
      if (!stream) {
        return {
          provider: 'openai',
          model: this.model,
          content: response.choices[0].message.content,
          role: response.choices[0].message.role,
          finishReason: response.choices[0].finish_reason,
          usage: {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens
          },
          responseTime: responseTime,
          rawResponse: response
        };
      }

      // For streaming, return the stream
      return response;

    } catch (error) {
      log.error('OpenAI API error:', { error: error.message, model: this.model });

      // Enhance error message
      const errorMessage = error.response?.data?.error?.message || error.message;
      const errorType = error.response?.data?.error?.type || 'unknown_error';
      const statusCode = error.response?.status || 500;

      throw {
        provider: 'openai',
        message: errorMessage,
        type: errorType,
        statusCode: statusCode,
        originalError: error
      };
    }
  }

  /**
   * Send streaming chat completion request
   * @param {Object} params - Request parameters
   * @param {Function} onChunk - Callback for each chunk
   * @param {Function} onComplete - Callback when complete
   * @param {Function} onError - Error callback
   */
  async chatStream(params, onChunk, onComplete, onError) {
    const {
      messages,
      temperature = 0.7,
      maxTokens = 1000
    } = params;

    try {
      const startTime = Date.now();
      let fullContent = '';
      let promptTokens = 0;
      let completionTokens = 0;

      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';

        if (content) {
          fullContent += content;

          // Call chunk callback
          if (onChunk) {
            onChunk({
              content: content,
              fullContent: fullContent,
              isComplete: false
            });
          }
        }

        // Check if streaming is done
        if (chunk.choices[0]?.finish_reason) {
          const responseTime = Date.now() - startTime;

          // Estimate tokens (rough approximation)
          promptTokens = Math.ceil(JSON.stringify(messages).length / 4);
          completionTokens = Math.ceil(fullContent.length / 4);

          if (onComplete) {
            onComplete({
              provider: 'openai',
              model: this.model,
              content: fullContent,
              finishReason: chunk.choices[0].finish_reason,
              usage: {
                promptTokens: promptTokens,
                completionTokens: completionTokens,
                totalTokens: promptTokens + completionTokens
              },
              responseTime: responseTime
            });
          }
        }
      }

    } catch (error) {
      log.error('OpenAI streaming error:', { error: error.message, model: this.model });

      if (onError) {
        onError({
          provider: 'openai',
          message: error.message,
          originalError: error
        });
      }
    }
  }

  /**
   * Test connection to OpenAI API
   * @returns {Promise<Object>} Test result
   */
  async testConnection() {
    try {
      const response = await this.chat({
        messages: [
          { role: 'user', content: 'Hello! Please respond with "OK" if you receive this message.' }
        ],
        maxTokens: 10,
        temperature: 0
      });

      return {
        success: true,
        provider: 'openai',
        model: this.model,
        message: 'Connection successful',
        testResponse: response.content
      };
    } catch (error) {
      return {
        success: false,
        provider: 'openai',
        model: this.model,
        message: 'Connection failed',
        error: error.message
      };
    }
  }
}

module.exports = OpenAIService;
