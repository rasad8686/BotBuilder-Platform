const Anthropic = require('@anthropic-ai/sdk');

/**
 * Claude Service (Anthropic)
 * Handles communication with Anthropic Claude API
 */
class ClaudeService {
  /**
   * @param {string} apiKey - Anthropic API key
   * @param {string} model - Model identifier (e.g., 'claude-3-5-sonnet-20241022')
   */
  constructor(apiKey, model) {
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }

    // Trim whitespace from API key
    const cleanApiKey = apiKey.trim();

    // Debug logging (show first 15 chars only for security)
    console.log(`[ClaudeService] Initializing with API key: ${cleanApiKey.substring(0, 15)}...`);
    console.log(`[ClaudeService] API key length: ${cleanApiKey.length}`);
    console.log(`[ClaudeService] Model: ${model || 'claude-3-5-sonnet-20241022'}`);

    this.client = new Anthropic({
      apiKey: cleanApiKey
    });

    this.model = model || 'claude-3-5-sonnet-20241022';
  }

  /**
   * Convert OpenAI-style messages to Claude format
   * Claude requires system message separate from messages array
   * @param {Array} messages - OpenAI-style messages
   * @returns {Object} { system, messages }
   */
  convertMessages(messages) {
    let system = '';
    const claudeMessages = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = msg.content;
      } else {
        claudeMessages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      }
    }

    return { system, messages: claudeMessages };
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

      // Convert messages to Claude format
      const { system, messages: claudeMessages } = this.convertMessages(messages);

      const requestParams = {
        model: this.model,
        max_tokens: maxTokens,
        temperature: temperature,
        messages: claudeMessages,
        stream: stream
      };

      // Add system message if present
      if (system) {
        requestParams.system = system;
      }

      const response = await this.client.messages.create(requestParams);

      const responseTime = Date.now() - startTime;

      // For non-streaming responses
      if (!stream) {
        return {
          provider: 'claude',
          model: this.model,
          content: response.content[0].text,
          role: response.role,
          finishReason: response.stop_reason,
          usage: {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens
          },
          responseTime: responseTime,
          rawResponse: response
        };
      }

      // For streaming, return the stream
      return response;

    } catch (error) {
      console.error('❌ [ClaudeService] API error:', error);
      console.error('❌ [ClaudeService] Error type:', error.type);
      console.error('❌ [ClaudeService] Error status:', error.status);
      console.error('❌ [ClaudeService] Error message:', error.message);

      // Log full error details for debugging
      if (error.error) {
        console.error('❌ [ClaudeService] Error details:', JSON.stringify(error.error, null, 2));
      }

      // Enhance error message
      const errorMessage = error.message || 'Unknown error';
      const errorType = error.type || 'unknown_error';
      const statusCode = error.status || 500;

      // Specific error handling for authentication issues
      if (statusCode === 401) {
        console.error('❌ [ClaudeService] AUTHENTICATION FAILED - Invalid API key');
        throw {
          provider: 'claude',
          message: 'Invalid Anthropic API key. Please check your API key configuration.',
          type: 'authentication_error',
          statusCode: 401,
          originalError: error
        };
      }

      throw {
        provider: 'claude',
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
      let inputTokens = 0;
      let outputTokens = 0;

      // Convert messages to Claude format
      const { system, messages: claudeMessages } = this.convertMessages(messages);

      const requestParams = {
        model: this.model,
        max_tokens: maxTokens,
        temperature: temperature,
        messages: claudeMessages,
        stream: true
      };

      if (system) {
        requestParams.system = system;
      }

      const stream = await this.client.messages.create(requestParams);

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const content = event.delta.text || '';

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
        }

        if (event.type === 'message_delta') {
          // Update token usage
          if (event.usage) {
            outputTokens = event.usage.output_tokens;
          }
        }

        if (event.type === 'message_start') {
          // Get input tokens
          if (event.message && event.message.usage) {
            inputTokens = event.message.usage.input_tokens;
          }
        }

        // Check if streaming is done
        if (event.type === 'message_stop') {
          const responseTime = Date.now() - startTime;

          if (onComplete) {
            onComplete({
              provider: 'claude',
              model: this.model,
              content: fullContent,
              finishReason: 'end_turn',
              usage: {
                promptTokens: inputTokens,
                completionTokens: outputTokens,
                totalTokens: inputTokens + outputTokens
              },
              responseTime: responseTime
            });
          }
        }
      }

    } catch (error) {
      console.error('Claude streaming error:', error);

      if (onError) {
        onError({
          provider: 'claude',
          message: error.message,
          originalError: error
        });
      }
    }
  }

  /**
   * Test connection to Claude API
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
        provider: 'claude',
        model: this.model,
        message: 'Connection successful',
        testResponse: response.content
      };
    } catch (error) {
      return {
        success: false,
        provider: 'claude',
        model: this.model,
        message: 'Connection failed',
        error: error.message
      };
    }
  }
}

module.exports = ClaudeService;
