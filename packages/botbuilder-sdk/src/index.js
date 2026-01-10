/**
 * @botbuilder/sdk
 * Official JavaScript SDK for BotBuilder API
 */

const BotBuilderClient = require('./client');
const { BotBuilderError, AuthenticationError, NotFoundError, ValidationError, RateLimitError } = require('./utils/errors');

// Resource classes
const Bots = require('./resources/bots');
const Messages = require('./resources/messages');
const Agents = require('./resources/agents');
const Knowledge = require('./resources/knowledge');
const Webhooks = require('./resources/webhooks');

/**
 * BotBuilder SDK main class
 *
 * @example
 * const BotBuilder = require('@botbuilder/sdk');
 *
 * const client = new BotBuilder({
 *   apiKey: 'your-api-key'
 * });
 *
 * const bots = await client.bots.list();
 */
class BotBuilder {
  /**
   * Create a new BotBuilder client
   * @param {Object} options - Configuration options
   * @param {string} [options.apiKey] - API key for authentication
   * @param {string} [options.token] - JWT token for authentication
   * @param {string} [options.baseUrl='http://localhost:5000'] - API base URL
   * @param {number} [options.timeout=30000] - Request timeout in ms
   * @param {number} [options.retries=3] - Number of retry attempts
   * @param {boolean} [options.debug=false] - Enable debug logging
   */
  constructor(options = {}) {
    if (!options.apiKey && !options.token) {
      throw new Error('Either apiKey or token is required');
    }

    this._client = new BotBuilderClient(options);

    // Initialize resources
    this.bots = new Bots(this._client);
    this.messages = new Messages(this._client);
    this.agents = new Agents(this._client);
    this.knowledge = new Knowledge(this._client);
    this.webhooks = new Webhooks(this._client);
  }

  /**
   * Set authentication token
   * @param {string} token - JWT token
   */
  setToken(token) {
    this._client.setToken(token);
  }

  /**
   * Set API key
   * @param {string} apiKey - API key
   */
  setApiKey(apiKey) {
    this._client.setApiKey(apiKey);
  }

  /**
   * Get system status
   * @returns {Promise<Object>} System status
   */
  async getStatus() {
    return this._client.request('GET', '/api/status');
  }
}

// Export main class and utilities
module.exports = BotBuilder;
module.exports.default = BotBuilder;
module.exports.BotBuilder = BotBuilder;
module.exports.BotBuilderError = BotBuilderError;
module.exports.AuthenticationError = AuthenticationError;
module.exports.NotFoundError = NotFoundError;
module.exports.ValidationError = ValidationError;
module.exports.RateLimitError = RateLimitError;
