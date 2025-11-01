import axiosInstance from './axios';

/**
 * AI API Service
 * Handles all AI-related API calls
 */

const aiApi = {
  /**
   * Get available AI providers
   * @returns {Promise} List of providers with models
   */
  getProviders: async () => {
    const response = await axiosInstance.get('/api/ai/providers');
    return response.data;
  },

  /**
   * Get models for a specific provider
   * @param {string} provider - Provider name ('openai' or 'claude')
   * @returns {Promise} List of models
   */
  getModels: async (provider) => {
    const response = await axiosInstance.get(`/api/ai/models/${provider}`);
    return response.data;
  },

  /**
   * Get AI configuration for a bot
   * @param {number} botId - Bot ID
   * @returns {Promise} AI configuration
   */
  getConfig: async (botId) => {
    const response = await axiosInstance.get(`/api/bots/${botId}/ai/configure`);
    return response.data;
  },

  /**
   * Create or update AI configuration
   * @param {number} botId - Bot ID
   * @param {Object} config - Configuration data
   * @returns {Promise} Updated configuration
   */
  configureAI: async (botId, config) => {
    const response = await axiosInstance.post(`/api/bots/${botId}/ai/configure`, config);
    return response.data;
  },

  /**
   * Delete AI configuration
   * @param {number} botId - Bot ID
   * @returns {Promise} Deletion confirmation
   */
  deleteConfig: async (botId) => {
    const response = await axiosInstance.delete(`/api/bots/${botId}/ai/configure`);
    return response.data;
  },

  /**
   * Test AI connection
   * @param {number} botId - Bot ID
   * @returns {Promise} Test result
   */
  testConnection: async (botId) => {
    const response = await axiosInstance.post(`/api/bots/${botId}/ai/test`);
    return response.data;
  },

  /**
   * Send chat message to AI
   * @param {number} botId - Bot ID
   * @param {Object} data - { message, sessionId }
   * @returns {Promise} AI response
   */
  sendChat: async (botId, data) => {
    const response = await axiosInstance.post(`/api/bots/${botId}/ai/chat`, data);
    return response.data;
  },

  /**
   * Get AI usage statistics for a bot
   * @param {number} botId - Bot ID
   * @param {Object} params - { startDate?, endDate?, limit? }
   * @returns {Promise} Usage statistics
   */
  getUsage: async (botId, params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.limit) queryParams.append('limit', params.limit);

    const url = queryParams.toString()
      ? `/api/bots/${botId}/ai/usage?${queryParams.toString()}`
      : `/api/bots/${botId}/ai/usage`;

    const response = await axiosInstance.get(url);
    return response.data;
  },

  /**
   * Get AI billing for organization
   * @param {number} orgId - Organization ID
   * @returns {Promise} Billing information
   */
  getOrganizationBilling: async (orgId) => {
    const response = await axiosInstance.get(`/api/organizations/${orgId}/ai/billing`);
    return response.data;
  }
};

export default aiApi;
