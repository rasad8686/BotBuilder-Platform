/**
 * @fileoverview Bot operations hook for managing chatbots
 * @module hooks/useBots
 */

import { useState, useCallback, useEffect } from 'react';

/**
 * Bot object type
 * @typedef {Object} Bot
 * @property {string} id - Bot unique identifier
 * @property {string} name - Bot name
 * @property {string} description - Bot description
 * @property {string} status - Bot status (active, inactive, draft)
 * @property {Object} settings - Bot configuration settings
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * Custom hook for managing bot CRUD operations
 * @param {Object} options - Configuration options
 * @param {boolean} options.autoFetch - Auto-fetch bots on mount (default: true)
 * @param {string} options.apiUrl - API base URL (default: '/api')
 * @returns {Object} Bot state and operations
 * @property {Bot[]} bots - Array of bots
 * @property {Bot|null} selectedBot - Currently selected bot
 * @property {boolean} loading - Loading state
 * @property {string|null} error - Error message
 * @property {Function} fetchBots - Fetch all bots
 * @property {Function} fetchBot - Fetch single bot by ID
 * @property {Function} createBot - Create a new bot
 * @property {Function} updateBot - Update existing bot
 * @property {Function} deleteBot - Delete a bot
 * @property {Function} duplicateBot - Duplicate a bot
 * @property {Function} selectBot - Select a bot
 * @property {Function} clearSelection - Clear bot selection
 *
 * @example
 * const {
 *   bots,
 *   loading,
 *   error,
 *   createBot,
 *   updateBot,
 *   deleteBot,
 *   selectBot,
 *   selectedBot
 * } = useBots();
 *
 * // Create a new bot
 * const newBot = await createBot({ name: 'Support Bot', description: 'Customer support' });
 *
 * // Update a bot
 * await updateBot(bot.id, { name: 'Updated Name' });
 *
 * // Delete a bot
 * await deleteBot(bot.id);
 */
const useBots = (options = {}) => {
  const {
    autoFetch = true,
    apiUrl = '/api'
  } = options;

  const [bots, setBots] = useState([]);
  const [selectedBot, setSelectedBot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Get auth headers for API requests
   * @returns {Object} Headers object
   */
  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }, []);

  /**
   * Handle API errors
   * @param {Response} response - Fetch response
   */
  const handleError = useCallback(async (response) => {
    const data = await response.json().catch(() => ({}));
    const message = data.message || data.error || `Request failed with status ${response.status}`;
    throw new Error(message);
  }, []);

  /**
   * Fetch all bots
   * @returns {Promise<Bot[]>} Array of bots
   */
  const fetchBots = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/bots`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        await handleError(response);
      }

      const data = await response.json();
      const botsList = data.bots || data.data || data || [];
      setBots(botsList);
      return botsList;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiUrl, getHeaders, handleError]);

  /**
   * Fetch a single bot by ID
   * @param {string} id - Bot ID
   * @returns {Promise<Bot>} Bot object
   */
  const fetchBot = useCallback(async (id) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/bots/${id}`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        await handleError(response);
      }

      const data = await response.json();
      const bot = data.bot || data;
      setSelectedBot(bot);
      return bot;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiUrl, getHeaders, handleError]);

  /**
   * Create a new bot
   * @param {Object} botData - Bot creation data
   * @param {string} botData.name - Bot name
   * @param {string} botData.description - Bot description
   * @param {Object} botData.settings - Bot settings
   * @returns {Promise<Bot>} Created bot
   */
  const createBot = useCallback(async (botData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/bots`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(botData)
      });

      if (!response.ok) {
        await handleError(response);
      }

      const data = await response.json();
      const newBot = data.bot || data;

      setBots(prev => [...prev, newBot]);
      return newBot;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiUrl, getHeaders, handleError]);

  /**
   * Update an existing bot
   * @param {string} id - Bot ID
   * @param {Object} updates - Bot updates
   * @returns {Promise<Bot>} Updated bot
   */
  const updateBot = useCallback(async (id, updates) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/bots/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        await handleError(response);
      }

      const data = await response.json();
      const updatedBot = data.bot || data;

      setBots(prev => prev.map(bot =>
        bot.id === id ? updatedBot : bot
      ));

      if (selectedBot?.id === id) {
        setSelectedBot(updatedBot);
      }

      return updatedBot;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiUrl, getHeaders, handleError, selectedBot]);

  /**
   * Delete a bot
   * @param {string} id - Bot ID
   * @returns {Promise<void>}
   */
  const deleteBot = useCallback(async (id) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/bots/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (!response.ok) {
        await handleError(response);
      }

      setBots(prev => prev.filter(bot => bot.id !== id));

      if (selectedBot?.id === id) {
        setSelectedBot(null);
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiUrl, getHeaders, handleError, selectedBot]);

  /**
   * Duplicate a bot
   * @param {string} id - Bot ID to duplicate
   * @param {Object} overrides - Override values for the duplicate
   * @returns {Promise<Bot>} Duplicated bot
   */
  const duplicateBot = useCallback(async (id, overrides = {}) => {
    const originalBot = bots.find(bot => bot.id === id);

    if (!originalBot) {
      throw new Error('Bot not found');
    }

    const duplicateData = {
      ...originalBot,
      name: `${originalBot.name} (Copy)`,
      ...overrides
    };

    // Remove ID and timestamps
    delete duplicateData.id;
    delete duplicateData.createdAt;
    delete duplicateData.updatedAt;

    return createBot(duplicateData);
  }, [bots, createBot]);

  /**
   * Toggle bot status (active/inactive)
   * @param {string} id - Bot ID
   * @returns {Promise<Bot>} Updated bot
   */
  const toggleBotStatus = useCallback(async (id) => {
    const bot = bots.find(b => b.id === id);
    if (!bot) {
      throw new Error('Bot not found');
    }

    const newStatus = bot.status === 'active' ? 'inactive' : 'active';
    return updateBot(id, { status: newStatus });
  }, [bots, updateBot]);

  /**
   * Select a bot
   * @param {Bot|string} botOrId - Bot object or ID
   */
  const selectBot = useCallback((botOrId) => {
    if (typeof botOrId === 'string') {
      const bot = bots.find(b => b.id === botOrId);
      setSelectedBot(bot || null);
    } else {
      setSelectedBot(botOrId);
    }
  }, [bots]);

  /**
   * Clear bot selection
   */
  const clearSelection = useCallback(() => {
    setSelectedBot(null);
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Refresh bots list
   */
  const refresh = useCallback(() => {
    return fetchBots();
  }, [fetchBots]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchBots();
    }
  }, [autoFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // State
    bots,
    selectedBot,
    loading,
    error,

    // CRUD operations
    fetchBots,
    fetchBot,
    createBot,
    updateBot,
    deleteBot,
    duplicateBot,
    toggleBotStatus,

    // Selection
    selectBot,
    clearSelection,

    // Utils
    clearError,
    refresh,

    // Computed
    botCount: bots.length,
    activeBots: bots.filter(bot => bot.status === 'active'),
    inactiveBots: bots.filter(bot => bot.status !== 'active')
  };
};

export default useBots;
