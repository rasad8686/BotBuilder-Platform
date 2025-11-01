const OpenAIService = require('./openaiService');
const ClaudeService = require('./claudeService');

/**
 * AI Provider Factory
 * Creates appropriate AI service instance based on provider type
 */
class AIProviderFactory {
  /**
   * Get AI service instance for the specified provider
   * @param {Object} config - Provider configuration
   * @param {string} config.provider - 'openai' or 'claude'
   * @param {string} config.apiKey - API key for the provider
   * @param {string} config.model - Model identifier
   * @returns {OpenAIService|ClaudeService} AI service instance
   */
  static getProvider(config) {
    const { provider, apiKey, model } = config;

    if (!provider) {
      throw new Error('AI provider is required');
    }

    if (!apiKey) {
      throw new Error('API key is required');
    }

    if (!model) {
      throw new Error('Model is required');
    }

    switch(provider.toLowerCase()) {
      case 'openai':
        return new OpenAIService(apiKey, model);
      case 'claude':
        return new ClaudeService(apiKey, model);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  /**
   * Get list of supported providers
   * @returns {Array<string>} List of provider names
   */
  static getSupportedProviders() {
    return ['openai', 'claude'];
  }

  /**
   * Get available models for a provider
   * @param {string} provider - Provider name
   * @returns {Array<Object>} List of model configurations
   */
  static getModelsForProvider(provider) {
    switch(provider.toLowerCase()) {
      case 'openai':
        return [
          {
            id: 'gpt-4o',
            name: 'GPT-4o',
            description: 'Most capable model, best for complex tasks',
            contextWindow: 128000,
            maxTokens: 16384,
            pricing: {
              input: 2.50,  // per 1M tokens
              output: 10.00  // per 1M tokens
            }
          },
          {
            id: 'gpt-4o-mini',
            name: 'GPT-4o Mini',
            description: 'Fast and affordable, great for simple tasks',
            contextWindow: 128000,
            maxTokens: 16384,
            pricing: {
              input: 0.150,  // per 1M tokens
              output: 0.600  // per 1M tokens
            }
          },
          {
            id: 'gpt-4-turbo',
            name: 'GPT-4 Turbo',
            description: 'Previous generation flagship model',
            contextWindow: 128000,
            maxTokens: 4096,
            pricing: {
              input: 10.00,
              output: 30.00
            }
          }
        ];
      case 'claude':
        return [
          {
            id: 'claude-3-5-sonnet-20241022',
            name: 'Claude 3.5 Sonnet',
            description: 'Best model for most tasks, excellent reasoning',
            contextWindow: 200000,
            maxTokens: 8192,
            pricing: {
              input: 3.00,   // per 1M tokens
              output: 15.00  // per 1M tokens
            }
          },
          {
            id: 'claude-3-5-haiku-20241022',
            name: 'Claude 3.5 Haiku',
            description: 'Fastest model, ideal for quick responses',
            contextWindow: 200000,
            maxTokens: 8192,
            pricing: {
              input: 0.80,   // per 1M tokens
              output: 4.00   // per 1M tokens
            }
          },
          {
            id: 'claude-3-opus-20240229',
            name: 'Claude 3 Opus',
            description: 'Most powerful model for complex analysis',
            contextWindow: 200000,
            maxTokens: 4096,
            pricing: {
              input: 15.00,
              output: 75.00
            }
          }
        ];
      default:
        return [];
    }
  }

  /**
   * Get model configuration by ID
   * @param {string} provider - Provider name
   * @param {string} modelId - Model ID
   * @returns {Object|null} Model configuration or null
   */
  static getModelConfig(provider, modelId) {
    const models = this.getModelsForProvider(provider);
    return models.find(m => m.id === modelId) || null;
  }

  /**
   * Validate provider configuration
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result { valid: boolean, errors: Array }
   */
  static validateConfig(config) {
    const errors = [];

    if (!config.provider) {
      errors.push('Provider is required');
    } else if (!this.getSupportedProviders().includes(config.provider.toLowerCase())) {
      errors.push(`Invalid provider: ${config.provider}`);
    }

    if (!config.model) {
      errors.push('Model is required');
    } else if (config.provider) {
      const modelConfig = this.getModelConfig(config.provider, config.model);
      if (!modelConfig) {
        errors.push(`Invalid model for provider ${config.provider}: ${config.model}`);
      }
    }

    if (config.temperature !== undefined) {
      const temp = parseFloat(config.temperature);
      if (isNaN(temp) || temp < 0 || temp > 2.0) {
        errors.push('Temperature must be between 0 and 2.0');
      }
    }

    if (config.max_tokens !== undefined) {
      const tokens = parseInt(config.max_tokens);
      if (isNaN(tokens) || tokens < 1 || tokens > 100000) {
        errors.push('max_tokens must be between 1 and 100000');
      }
    }

    if (config.context_window !== undefined) {
      const context = parseInt(config.context_window);
      if (isNaN(context) || context < 0 || context > 100) {
        errors.push('context_window must be between 0 and 100');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = AIProviderFactory;
