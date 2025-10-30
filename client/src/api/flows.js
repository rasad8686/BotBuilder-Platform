import axiosInstance from './axios';

/**
 * Bot Flows API
 * All flow-related API calls for the visual flow builder
 */

const flowsApi = {
  /**
   * Save/Create a new flow for a bot
   * @param {number} botId - Bot ID
   * @param {Object} flowData - { nodes, edges }
   * @returns {Promise} Flow creation response
   */
  saveFlow: async (botId, flowData) => {
    const response = await axiosInstance.post(`/api/bots/${botId}/flow`, {
      flowData
    });
    return response.data;
  },

  /**
   * Get active flow for a bot
   * @param {number} botId - Bot ID
   * @returns {Promise} Active flow data
   */
  getFlow: async (botId) => {
    const response = await axiosInstance.get(`/api/bots/${botId}/flow`);
    return response.data;
  },

  /**
   * Update an existing flow (creates new version)
   * @param {number} botId - Bot ID
   * @param {number} flowId - Flow ID
   * @param {Object} flowData - { nodes, edges }
   * @returns {Promise} Flow update response
   */
  updateFlow: async (botId, flowId, flowData) => {
    const response = await axiosInstance.put(`/api/bots/${botId}/flow/${flowId}`, {
      flowData
    });
    return response.data;
  },

  /**
   * Get flow history for a bot
   * @param {number} botId - Bot ID
   * @returns {Promise} Array of all flow versions
   */
  getFlowHistory: async (botId) => {
    const response = await axiosInstance.get(`/api/bots/${botId}/flow/history`);
    return response.data;
  }
};

export default flowsApi;
