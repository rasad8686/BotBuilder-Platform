/**
 * Messages Resource
 * Manage messages and chat via the BotBuilder API
 */

const { buildQueryString } = require('../utils/request');

class Messages {
  constructor(client) {
    this._client = client;
  }

  /**
   * Send a message to a bot and get AI response
   * @param {number} botId - Bot ID
   * @param {Object} data - Message data
   * @param {string} data.message - Message text
   * @param {string} [data.sessionId] - Session ID for conversation continuity
   * @returns {Promise<Object>} AI response
   *
   * @example
   * const response = await client.messages.send(123, {
   *   message: 'Hello, how can you help me?',
   *   sessionId: 'session_abc'
   * });
   * console.log(response.message);
   */
  async send(botId, data) {
    return this._client.post(`/api/bots/${botId}/ai/chat`, data);
  }

  /**
   * Get message history for a bot
   * @param {number} botId - Bot ID
   * @param {Object} [params] - Query parameters
   * @param {string} [params.sessionId] - Filter by session ID
   * @param {number} [params.limit=50] - Number of messages
   * @returns {Promise<Object>} Message history
   *
   * @example
   * const history = await client.messages.list(123, {
   *   sessionId: 'session_abc',
   *   limit: 50
   * });
   */
  async list(botId, params = {}) {
    const query = buildQueryString(params);
    return this._client.get(`/api/messages/${botId}${query}`);
  }

  /**
   * Stream a message response (for real-time chat)
   * Note: Requires WebSocket connection
   * @param {number} botId - Bot ID
   * @param {Object} data - Message data
   * @returns {Promise<Object>} Stream info
   */
  async stream(botId, data) {
    return this._client.post(`/api/bots/${botId}/ai/stream`, data);
  }

  /**
   * Delete message history for a session
   * @param {number} botId - Bot ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Deletion result
   */
  async clearSession(botId, sessionId) {
    return this._client.delete(`/api/messages/${botId}/sessions/${sessionId}`);
  }
}

module.exports = Messages;
