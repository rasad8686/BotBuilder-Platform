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
   * Send streaming chat message to AI
   * Uses Server-Sent Events for real-time responses
   * @param {number} botId - Bot ID
   * @param {Object} data - { message, sessionId }
   * @param {Function} onChunk - Callback for each text chunk
   * @param {Function} onComplete - Callback when streaming completes
   * @param {Function} onError - Callback for errors
   * @returns {Function} Abort function to cancel the stream
   */
  sendChatStream: (botId, data, onChunk, onComplete, onError) => {
    const token = localStorage.getItem('token');
    const organizationId = localStorage.getItem('currentOrganizationId');

    // Get API URL from config
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    const controller = new AbortController();

    fetch(`${apiUrl}/api/bots/${botId}/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        'X-Organization-ID': organizationId || ''
      },
      body: JSON.stringify(data),
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Streaming request failed');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process SSE events from buffer
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || ''; // Keep incomplete event in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6); // Remove 'data: ' prefix
                const event = JSON.parse(jsonStr);

                if (event.type === 'chunk') {
                  onChunk && onChunk(event);
                } else if (event.type === 'done') {
                  onComplete && onComplete(event);
                } else if (event.type === 'error') {
                  onError && onError(new Error(event.message));
                }
              } catch (e) {
                // Failed to parse SSE event
              }
            }
          }
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          onError && onError(error);
        }
      });

    // Return abort function
    return () => controller.abort();
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
