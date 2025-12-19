/**
 * Bot Service
 * Handles all bot-related API operations with caching
 */
import { botsAPI } from './api';
import { setBotsCache, getBotsCache, clearBotsCache } from '../utils/storage';

/**
 * Get all bots with optional caching
 */
export const getBots = async (options = {}) => {
  const { useCache = true, forceRefresh = false, ...params } = options;

  try {
    // Try cache first if not forcing refresh
    if (useCache && !forceRefresh) {
      const cached = await getBotsCache();
      if (cached) {
        return { success: true, data: cached, fromCache: true };
      }
    }

    const response = await botsAPI.getAll(params);
    const bots = response.data.bots || response.data;

    // Cache the results
    if (useCache) {
      await setBotsCache(bots);
    }

    return { success: true, data: bots, fromCache: false };
  } catch (error) {
    // Return cached data if available on error
    if (useCache) {
      const cached = await getBotsCache();
      if (cached) {
        return { success: true, data: cached, fromCache: true, error: error.message };
      }
    }

    return {
      success: false,
      error: error.message || 'Failed to fetch bots',
      data: [],
    };
  }
};

/**
 * Get single bot by ID
 */
export const getBot = async (botId) => {
  try {
    const response = await botsAPI.getById(botId);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch bot',
      data: null,
    };
  }
};

/**
 * Create a new bot
 */
export const createBot = async (botData) => {
  try {
    const response = await botsAPI.create(botData);

    // Clear cache to force refresh
    await clearBotsCache();

    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to create bot',
      data: null,
    };
  }
};

/**
 * Update an existing bot
 */
export const updateBot = async (botId, updates) => {
  try {
    const response = await botsAPI.update(botId, updates);

    // Clear cache to force refresh
    await clearBotsCache();

    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to update bot',
      data: null,
    };
  }
};

/**
 * Delete a bot
 */
export const deleteBot = async (botId) => {
  try {
    await botsAPI.delete(botId);

    // Clear cache to force refresh
    await clearBotsCache();

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to delete bot',
    };
  }
};

/**
 * Get bot statistics
 */
export const getBotStats = async (botId) => {
  try {
    const response = await botsAPI.getStats(botId);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch bot stats',
      data: null,
    };
  }
};

/**
 * Get bot flow/configuration
 */
export const getBotFlow = async (botId) => {
  try {
    const response = await botsAPI.getFlow(botId);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch bot flow',
      data: null,
    };
  }
};

/**
 * Update bot flow/configuration
 */
export const updateBotFlow = async (botId, flow) => {
  try {
    const response = await botsAPI.updateFlow(botId, flow);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to update bot flow',
      data: null,
    };
  }
};

/**
 * Duplicate a bot
 */
export const duplicateBot = async (botId) => {
  try {
    const response = await botsAPI.duplicate(botId);

    // Clear cache to force refresh
    await clearBotsCache();

    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to duplicate bot',
      data: null,
    };
  }
};

/**
 * Export bot configuration
 */
export const exportBot = async (botId) => {
  try {
    const response = await botsAPI.export(botId);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to export bot',
      data: null,
    };
  }
};

/**
 * Import bot configuration
 */
export const importBot = async (botData) => {
  try {
    const response = await botsAPI.import(botData);

    // Clear cache to force refresh
    await clearBotsCache();

    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to import bot',
      data: null,
    };
  }
};

/**
 * Search bots by query
 */
export const searchBots = async (query, bots = []) => {
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) return bots;

  return bots.filter(bot =>
    bot.name.toLowerCase().includes(lowerQuery) ||
    bot.description?.toLowerCase().includes(lowerQuery)
  );
};

/**
 * Filter bots by status
 */
export const filterBotsByStatus = (status, bots = []) => {
  if (status === 'all') return bots;
  return bots.filter(bot => bot.status === status);
};

/**
 * Sort bots by field
 */
export const sortBots = (bots = [], field = 'createdAt', order = 'desc') => {
  return [...bots].sort((a, b) => {
    let valueA = a[field];
    let valueB = b[field];

    // Handle dates
    if (field.includes('At') || field.includes('Date')) {
      valueA = new Date(valueA).getTime();
      valueB = new Date(valueB).getTime();
    }

    // Handle strings
    if (typeof valueA === 'string') {
      valueA = valueA.toLowerCase();
      valueB = valueB.toLowerCase();
    }

    if (order === 'asc') {
      return valueA > valueB ? 1 : -1;
    }
    return valueA < valueB ? 1 : -1;
  });
};

export default {
  getBots,
  getBot,
  createBot,
  updateBot,
  deleteBot,
  getBotStats,
  getBotFlow,
  updateBotFlow,
  duplicateBot,
  exportBot,
  importBot,
  searchBots,
  filterBotsByStatus,
  sortBots,
};
