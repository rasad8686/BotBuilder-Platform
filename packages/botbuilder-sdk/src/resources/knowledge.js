/**
 * Knowledge Resource
 * Manage knowledge base and RAG via the BotBuilder API
 */

const { buildQueryString } = require('../utils/request');

class Knowledge {
  constructor(client) {
    this._client = client;
  }

  /**
   * List documents in a bot's knowledge base
   * @param {number} botId - Bot ID
   * @param {Object} [params] - Query parameters
   * @returns {Promise<Object>} List of documents
   *
   * @example
   * const docs = await client.knowledge.listDocuments(123);
   */
  async listDocuments(botId, params = {}) {
    const query = buildQueryString(params);
    return this._client.get(`/api/knowledge/${botId}/documents${query}`);
  }

  /**
   * Get a document by ID
   * @param {number} botId - Bot ID
   * @param {number} documentId - Document ID
   * @returns {Promise<Object>} Document details
   */
  async getDocument(botId, documentId) {
    const response = await this._client.get(`/api/knowledge/${botId}/documents/${documentId}`);
    return response.document || response;
  }

  /**
   * Upload a document to the knowledge base
   * @param {number} botId - Bot ID
   * @param {Object} data - Document data
   * @param {string} data.title - Document title
   * @param {string} data.content - Document content
   * @param {string} [data.file_type] - File type
   * @returns {Promise<Object>} Uploaded document
   *
   * @example
   * const doc = await client.knowledge.uploadDocument(123, {
   *   title: 'FAQ Document',
   *   content: 'Your document content...'
   * });
   */
  async uploadDocument(botId, data) {
    const response = await this._client.post(`/api/knowledge/${botId}/documents`, data);
    return response.document || response;
  }

  /**
   * Delete a document
   * @param {number} botId - Bot ID
   * @param {number} documentId - Document ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteDocument(botId, documentId) {
    return this._client.delete(`/api/knowledge/${botId}/documents/${documentId}`);
  }

  /**
   * Query the knowledge base
   * @param {number} botId - Bot ID
   * @param {Object} data - Query data
   * @param {string} data.query - Search query
   * @param {number} [data.topK=5] - Number of results
   * @returns {Promise<Object>} Query results
   *
   * @example
   * const results = await client.knowledge.query(123, {
   *   query: 'How do I reset my password?',
   *   topK: 5
   * });
   */
  async query(botId, data) {
    return this._client.post(`/api/knowledge/${botId}/query`, data);
  }

  /**
   * Get knowledge base statistics
   * @param {number} botId - Bot ID
   * @returns {Promise<Object>} Statistics
   */
  async getStats(botId) {
    return this._client.get(`/api/knowledge/${botId}/stats`);
  }

  /**
   * Reprocess a document (re-chunk and re-embed)
   * @param {number} botId - Bot ID
   * @param {number} documentId - Document ID
   * @returns {Promise<Object>} Processing status
   */
  async reprocessDocument(botId, documentId) {
    return this._client.post(`/api/knowledge/${botId}/documents/${documentId}/reprocess`);
  }
}

module.exports = Knowledge;
