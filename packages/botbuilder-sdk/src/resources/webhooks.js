/**
 * Webhooks Resource
 * Manage webhooks via the BotBuilder API
 */

const { buildQueryString } = require('../utils/request');

class Webhooks {
  constructor(client) {
    this._client = client;
  }

  /**
   * List all webhooks
   * @param {Object} [params] - Query parameters
   * @returns {Promise<Object>} List of webhooks
   *
   * @example
   * const webhooks = await client.webhooks.list();
   */
  async list(params = {}) {
    const query = buildQueryString(params);
    return this._client.get(`/api/webhooks${query}`);
  }

  /**
   * Get a webhook by ID
   * @param {number} id - Webhook ID
   * @returns {Promise<Object>} Webhook details
   */
  async get(id) {
    const response = await this._client.get(`/api/webhooks/${id}`);
    return response.webhook || response;
  }

  /**
   * Create a new webhook
   * @param {Object} data - Webhook data
   * @param {string} data.url - Webhook URL
   * @param {string[]} data.events - Events to subscribe to
   * @returns {Promise<Object>} Created webhook
   *
   * @example
   * const webhook = await client.webhooks.create({
   *   url: 'https://your-server.com/webhook',
   *   events: ['bot.created', 'message.received', 'agent.completed']
   * });
   */
  async create(data) {
    const response = await this._client.post('/api/webhooks', data);
    return response.webhook || response;
  }

  /**
   * Update a webhook
   * @param {number} id - Webhook ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated webhook
   */
  async update(id, data) {
    const response = await this._client.put(`/api/webhooks/${id}`, data);
    return response.webhook || response;
  }

  /**
   * Delete a webhook
   * @param {number} id - Webhook ID
   * @returns {Promise<Object>} Deletion result
   */
  async delete(id) {
    return this._client.delete(`/api/webhooks/${id}`);
  }

  /**
   * Test a webhook (send test payload)
   * @param {number} id - Webhook ID
   * @returns {Promise<Object>} Test result
   */
  async test(id) {
    return this._client.post(`/api/webhooks/${id}/test`);
  }

  /**
   * Get webhook delivery history
   * @param {number} id - Webhook ID
   * @param {Object} [params] - Query parameters
   * @returns {Promise<Object>} Delivery history
   */
  async getDeliveries(id, params = {}) {
    const query = buildQueryString(params);
    return this._client.get(`/api/webhooks/${id}/deliveries${query}`);
  }

  /**
   * Retry a failed delivery
   * @param {number} id - Webhook ID
   * @param {string} deliveryId - Delivery ID
   * @returns {Promise<Object>} Retry result
   */
  async retryDelivery(id, deliveryId) {
    return this._client.post(`/api/webhooks/${id}/deliveries/${deliveryId}/retry`);
  }

  /**
   * Get available webhook events
   * @returns {Promise<Object>} Available events
   */
  async getAvailableEvents() {
    return this._client.get('/api/webhooks/events');
  }
}

module.exports = Webhooks;
