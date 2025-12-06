/**
 * AIPlugin - Base class for AI model integration plugins
 * Supports custom AI models, embeddings, and training
 */

const BasePlugin = require('./BasePlugin');
const log = require('../../utils/logger');

class AIPlugin extends BasePlugin {
  constructor(config = {}) {
    super(config);
    this.modelProvider = config.modelProvider || 'custom';
    this.modelName = config.modelName || 'default';
    this.apiKey = config.apiKey || null;
    this.baseUrl = config.baseUrl || null;
    this.maxTokens = config.maxTokens || 4096;
    this.temperature = config.temperature || 0.7;
    this.client = null;
  }

  /**
   * Get plugin type
   * @returns {string}
   */
  getType() {
    return 'ai';
  }

  /**
   * Generate a response from the AI model
   * @param {string|Array} messages - Input message(s)
   * @param {object} options - Generation options
   * @returns {Promise<object>}
   */
  async generateResponse(messages, options = {}) {
    if (!this.isEnabled()) {
      throw new Error('Plugin is not enabled');
    }

    const normalizedMessages = this.normalizeMessages(messages);

    const params = {
      model: options.model || this.modelName,
      messages: normalizedMessages,
      maxTokens: options.maxTokens || this.maxTokens,
      temperature: options.temperature || this.temperature,
      topP: options.topP || 1,
      frequencyPenalty: options.frequencyPenalty || 0,
      presencePenalty: options.presencePenalty || 0,
      stop: options.stop || null
    };

    try {
      const startTime = Date.now();
      const result = await this.doGenerate(params);
      const duration = Date.now() - startTime;

      return {
        success: true,
        content: result.content,
        model: result.model || this.modelName,
        usage: result.usage || {},
        duration,
        finishReason: result.finishReason || 'stop'
      };
    } catch (error) {
      log.error(`[${this.name}] Generation error:`, error.message);
      throw error;
    }
  }

  /**
   * Train or fine-tune the model
   * @param {Array} trainingData - Training examples
   * @param {object} options - Training options
   * @returns {Promise<object>}
   */
  async trainModel(trainingData, options = {}) {
    if (!this.isEnabled()) {
      throw new Error('Plugin is not enabled');
    }

    if (!trainingData || trainingData.length === 0) {
      throw new Error('Training data is required');
    }

    const formattedData = await this.formatTrainingData(trainingData);

    try {
      const result = await this.doTrain(formattedData, options);

      return {
        success: true,
        jobId: result.jobId,
        status: result.status || 'started',
        estimatedTime: result.estimatedTime,
        metadata: result.metadata || {}
      };
    } catch (error) {
      log.error(`[${this.name}] Training error:`, error.message);
      throw error;
    }
  }

  /**
   * Generate embeddings for text
   * @param {string|Array} texts - Input text(s)
   * @param {object} options - Embedding options
   * @returns {Promise<object>}
   */
  async embeddings(texts, options = {}) {
    if (!this.isEnabled()) {
      throw new Error('Plugin is not enabled');
    }

    const inputTexts = Array.isArray(texts) ? texts : [texts];

    try {
      const result = await this.doEmbeddings(inputTexts, options);

      return {
        success: true,
        embeddings: result.embeddings,
        model: result.model || this.modelName,
        dimensions: result.dimensions || result.embeddings[0]?.length,
        usage: result.usage || {}
      };
    } catch (error) {
      log.error(`[${this.name}] Embeddings error:`, error.message);
      throw error;
    }
  }

  /**
   * Normalize messages to standard format
   * @param {string|Array} messages
   * @returns {Array}
   */
  normalizeMessages(messages) {
    if (typeof messages === 'string') {
      return [{ role: 'user', content: messages }];
    }

    return messages.map(msg => {
      if (typeof msg === 'string') {
        return { role: 'user', content: msg };
      }
      return {
        role: msg.role || 'user',
        content: msg.content || msg.text || ''
      };
    });
  }

  /**
   * Format training data
   * @param {Array} data
   * @returns {Promise<Array>}
   */
  async formatTrainingData(data) {
    // Override in subclass for model-specific format
    return data.map(item => ({
      messages: item.messages || [
        { role: 'user', content: item.input || item.prompt },
        { role: 'assistant', content: item.output || item.completion }
      ]
    }));
  }

  /**
   * Actually generate response (implement in subclass)
   * @param {object} params
   * @returns {Promise<object>}
   */
  async doGenerate(params) {
    throw new Error('doGenerate must be implemented in subclass');
  }

  /**
   * Actually train model (implement in subclass)
   * @param {Array} data
   * @param {object} options
   * @returns {Promise<object>}
   */
  async doTrain(data, options) {
    throw new Error('doTrain must be implemented in subclass');
  }

  /**
   * Actually generate embeddings (implement in subclass)
   * @param {Array} texts
   * @param {object} options
   * @returns {Promise<object>}
   */
  async doEmbeddings(texts, options) {
    throw new Error('doEmbeddings must be implemented in subclass');
  }

  /**
   * Get available models
   * @returns {Promise<Array>}
   */
  async getAvailableModels() {
    return [];
  }

  /**
   * Get model capabilities
   * @returns {object}
   */
  getCapabilities() {
    return {
      chat: true,
      completion: false,
      embeddings: false,
      training: false,
      streaming: false,
      functionCalling: false,
      vision: false,
      audio: false
    };
  }

  /**
   * Get settings schema
   * @returns {object}
   */
  getSettingsSchema() {
    return {
      apiKey: {
        type: 'password',
        label: 'API Key',
        required: true
      },
      modelName: {
        type: 'select',
        label: 'Model',
        required: true
      },
      temperature: {
        type: 'slider',
        label: 'Temperature',
        min: 0,
        max: 2,
        step: 0.1,
        default: 0.7
      },
      maxTokens: {
        type: 'number',
        label: 'Max Tokens',
        min: 1,
        max: 128000,
        default: 4096
      }
    };
  }
}

module.exports = AIPlugin;
