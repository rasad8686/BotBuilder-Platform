/**
 * Bots Resource
 * Manage bots via the BotBuilder API
 */

const { buildQueryString } = require('../utils/request');

class Bots {
  constructor(client) {
    this._client = client;
  }

  /**
   * List all bots
   * @param {Object} [params] - Query parameters
   * @param {number} [params.page=1] - Page number
   * @param {number} [params.limit=10] - Items per page
   * @returns {Promise<Object>} List of bots with pagination
   *
   * @example
   * const result = await client.bots.list({ page: 1, limit: 10 });
   * console.log(result.bots);
   */
  async list(params = {}) {
    const query = buildQueryString(params);
    return this._client.get(`/api/bots${query}`);
  }

  /**
   * Get a bot by ID
   * @param {number} id - Bot ID
   * @returns {Promise<Object>} Bot details
   *
   * @example
   * const bot = await client.bots.get(123);
   */
  async get(id) {
    const response = await this._client.get(`/api/bots/${id}`);
    return response.bot || response;
  }

  /**
   * Create a new bot
   * @param {Object} data - Bot data
   * @param {string} data.name - Bot name
   * @param {string} data.platform - Platform (telegram, whatsapp, discord, slack, web)
   * @param {string} [data.language='en'] - Bot language
   * @param {string} [data.description] - Bot description
   * @param {string} [data.webhook_url] - Webhook URL
   * @returns {Promise<Object>} Created bot
   *
   * @example
   * const bot = await client.bots.create({
   *   name: 'Customer Support Bot',
   *   platform: 'telegram',
   *   language: 'en'
   * });
   */
  async create(data) {
    const response = await this._client.post('/api/bots', data);
    return response.bot || response;
  }

  /**
   * Update a bot
   * @param {number} id - Bot ID
   * @param {Object} data - Update data
   * @param {string} [data.name] - Bot name
   * @param {string} [data.description] - Bot description
   * @param {string} [data.platform] - Platform
   * @param {string} [data.language] - Language
   * @param {string} [data.webhook_url] - Webhook URL
   * @param {boolean} [data.is_active] - Active status
   * @returns {Promise<Object>} Updated bot
   *
   * @example
   * const bot = await client.bots.update(123, { name: 'New Name' });
   */
  async update(id, data) {
    const response = await this._client.put(`/api/bots/${id}`, data);
    return response.bot || response;
  }

  /**
   * Delete a bot
   * @param {number} id - Bot ID
   * @returns {Promise<Object>} Deletion result
   *
   * @example
   * await client.bots.delete(123);
   */
  async delete(id) {
    return this._client.delete(`/api/bots/${id}`);
  }

  /**
   * Get bot AI configuration
   * @param {number} id - Bot ID
   * @returns {Promise<Object>} AI configuration
   */
  async getAIConfig(id) {
    const response = await this._client.get(`/api/bots/${id}/ai/config`);
    return response.config || response;
  }

  /**
   * Update bot AI configuration
   * @param {number} id - Bot ID
   * @param {Object} config - AI configuration
   * @param {string} [config.provider] - AI provider (openai, claude)
   * @param {string} [config.model] - Model name
   * @param {number} [config.temperature] - Temperature (0-2)
   * @param {number} [config.max_tokens] - Max tokens
   * @param {string} [config.system_prompt] - System prompt
   * @returns {Promise<Object>} Updated configuration
   */
  async updateAIConfig(id, config) {
    const response = await this._client.put(`/api/bots/${id}/ai/config`, config);
    return response.config || response;
  }
}

module.exports = Bots;
