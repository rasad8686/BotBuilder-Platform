/**
 * Agents Resource
 * Manage autonomous AI agents via the BotBuilder API
 */

const { buildQueryString } = require('../utils/request');

class Agents {
  constructor(client) {
    this._client = client;
  }

  /**
   * List all agents
   * @param {Object} [params] - Query parameters
   * @returns {Promise<Object>} List of agents
   *
   * @example
   * const agents = await client.agents.list();
   */
  async list(params = {}) {
    const query = buildQueryString(params);
    return this._client.get(`/api/agents${query}`);
  }

  /**
   * Get an agent by ID
   * @param {number} id - Agent ID
   * @returns {Promise<Object>} Agent details
   */
  async get(id) {
    const response = await this._client.get(`/api/agents/${id}`);
    return response.agent || response;
  }

  /**
   * Create a new autonomous agent
   * @param {Object} data - Agent data
   * @param {string} data.name - Agent name
   * @param {string} [data.description] - Agent description
   * @param {string} [data.model='gpt-4o-mini'] - AI model
   * @param {string[]} [data.tools] - Available tools
   * @param {Object} [data.constraints] - Agent constraints
   * @returns {Promise<Object>} Created agent
   *
   * @example
   * const agent = await client.agents.create({
   *   name: 'Research Agent',
   *   model: 'gpt-4o',
   *   tools: ['web_search', 'web_scrape', 'summarize']
   * });
   */
  async create(data) {
    const response = await this._client.post('/api/agents', data);
    return response.agent || response;
  }

  /**
   * Update an agent
   * @param {number} id - Agent ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated agent
   */
  async update(id, data) {
    const response = await this._client.put(`/api/agents/${id}`, data);
    return response.agent || response;
  }

  /**
   * Delete an agent
   * @param {number} id - Agent ID
   * @returns {Promise<Object>} Deletion result
   */
  async delete(id) {
    return this._client.delete(`/api/agents/${id}`);
  }

  /**
   * Execute an agent task
   * @param {number} id - Agent ID
   * @param {Object} data - Execution data
   * @param {string} data.goal - Task goal
   * @param {Object} [data.context] - Additional context
   * @param {number} [data.maxSteps] - Maximum steps
   * @param {number} [data.timeout] - Timeout in seconds
   * @returns {Promise<Object>} Execution result
   *
   * @example
   * const result = await client.agents.execute(123, {
   *   goal: 'Research AI trends and summarize findings',
   *   context: { topic: 'chatbots' },
   *   maxSteps: 10
   * });
   */
  async execute(id, data) {
    return this._client.post(`/api/agents/${id}/execute`, data);
  }

  /**
   * Get execution status
   * @param {string} executionId - Execution ID
   * @returns {Promise<Object>} Execution status
   */
  async getExecution(executionId) {
    return this._client.get(`/api/executions/${executionId}`);
  }

  /**
   * Cancel an execution
   * @param {string} executionId - Execution ID
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelExecution(executionId) {
    return this._client.post(`/api/executions/${executionId}/cancel`);
  }

  /**
   * List available tools
   * @returns {Promise<Object>} Available tools
   */
  async listTools() {
    return this._client.get('/api/tools');
  }
}

module.exports = Agents;
