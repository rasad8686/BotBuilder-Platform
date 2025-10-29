import axiosInstance from './axios';

/**
 * Bot Management API
 * All bot-related API calls with authentication
 */

const botApi = {
  /**
   * Create a new bot
   * @param {Object} botData - { name, platform, description?, webhook_url? }
   * @returns {Promise} Bot creation response
   */
  createBot: async (botData) => {
    const response = await axiosInstance.post('/api/bots', botData);
    return response.data;
  },

  /**
   * Get all bots for authenticated user
   * @returns {Promise} Array of bots
   */
  getBots: async () => {
    const response = await axiosInstance.get('/api/bots');
    return response.data;
  },

  /**
   * Get single bot by ID
   * @param {number} botId - Bot ID
   * @returns {Promise} Bot object
   */
  getBot: async (botId) => {
    const response = await axiosInstance.get(`/api/bots/${botId}`);
    return response.data;
  },

  /**
   * Update bot
   * @param {number} botId - Bot ID
   * @param {Object} botData - Fields to update
   * @returns {Promise} Updated bot object
   */
  updateBot: async (botId, botData) => {
    const response = await axiosInstance.put(`/api/bots/${botId}`, botData);
    return response.data;
  },

  /**
   * Delete bot
   * @param {number} botId - Bot ID
   * @returns {Promise} Deletion confirmation
   */
  deleteBot: async (botId) => {
    const response = await axiosInstance.delete(`/api/bots/${botId}`);
    return response.data;
  }
};

export default botApi;
