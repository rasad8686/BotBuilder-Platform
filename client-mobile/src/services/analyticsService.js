/**
 * Analytics Service
 * Handles dashboard statistics and analytics data
 */
import { analyticsAPI } from './api';
import { storage } from '../utils/storage';
import { ANALYTICS_PERIODS } from '../config/constants';

const CACHE_KEY = 'analytics_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached analytics data
 */
const getCachedData = async (key) => {
  try {
    const cache = await storage.get(`${CACHE_KEY}_${key}`);
    if (!cache) return null;

    if (Date.now() - cache.timestamp > CACHE_DURATION) {
      await storage.remove(`${CACHE_KEY}_${key}`);
      return null;
    }

    return cache.data;
  } catch (error) {
    return null;
  }
};

/**
 * Set cached analytics data
 */
const setCachedData = async (key, data) => {
  try {
    await storage.set(`${CACHE_KEY}_${key}`, {
      data,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Cache set error:', error);
  }
};

/**
 * Get dashboard statistics
 */
export const getDashboardStats = async (options = {}) => {
  const { useCache = true, forceRefresh = false } = options;

  try {
    // Try cache first
    if (useCache && !forceRefresh) {
      const cached = await getCachedData('dashboard');
      if (cached) {
        return { success: true, data: cached, fromCache: true };
      }
    }

    const response = await analyticsAPI.getDashboard();
    const stats = response.data;

    // Cache results
    if (useCache) {
      await setCachedData('dashboard', stats);
    }

    return { success: true, data: stats, fromCache: false };
  } catch (error) {
    // Return cached data on error
    if (useCache) {
      const cached = await getCachedData('dashboard');
      if (cached) {
        return { success: true, data: cached, fromCache: true, error: error.message };
      }
    }

    return {
      success: false,
      error: error.message || 'Failed to fetch dashboard stats',
      data: null,
    };
  }
};

/**
 * Get bot-specific analytics
 */
export const getBotAnalytics = async (botId, period = '7d', options = {}) => {
  const { useCache = true, forceRefresh = false } = options;
  const cacheKey = `bot_${botId}_${period}`;

  try {
    // Try cache first
    if (useCache && !forceRefresh) {
      const cached = await getCachedData(cacheKey);
      if (cached) {
        return { success: true, data: cached, fromCache: true };
      }
    }

    const response = await analyticsAPI.getBotAnalytics(botId, period);
    const analytics = response.data;

    // Cache results
    if (useCache) {
      await setCachedData(cacheKey, analytics);
    }

    return { success: true, data: analytics, fromCache: false };
  } catch (error) {
    // Return cached data on error
    if (useCache) {
      const cached = await getCachedData(cacheKey);
      if (cached) {
        return { success: true, data: cached, fromCache: true, error: error.message };
      }
    }

    return {
      success: false,
      error: error.message || 'Failed to fetch bot analytics',
      data: null,
    };
  }
};

/**
 * Get usage history
 */
export const getUsageHistory = async (period = '30d', options = {}) => {
  const { useCache = true, forceRefresh = false } = options;
  const cacheKey = `usage_${period}`;

  try {
    // Try cache first
    if (useCache && !forceRefresh) {
      const cached = await getCachedData(cacheKey);
      if (cached) {
        return { success: true, data: cached, fromCache: true };
      }
    }

    const response = await analyticsAPI.getUsageHistory(period);
    const history = response.data;

    // Cache results
    if (useCache) {
      await setCachedData(cacheKey, history);
    }

    return { success: true, data: history, fromCache: false };
  } catch (error) {
    // Return cached data on error
    if (useCache) {
      const cached = await getCachedData(cacheKey);
      if (cached) {
        return { success: true, data: cached, fromCache: true, error: error.message };
      }
    }

    return {
      success: false,
      error: error.message || 'Failed to fetch usage history',
      data: null,
    };
  }
};

/**
 * Get conversation statistics
 */
export const getConversationStats = async (botId, period = '7d', options = {}) => {
  const { useCache = true, forceRefresh = false } = options;
  const cacheKey = `conversations_${botId}_${period}`;

  try {
    // Try cache first
    if (useCache && !forceRefresh) {
      const cached = await getCachedData(cacheKey);
      if (cached) {
        return { success: true, data: cached, fromCache: true };
      }
    }

    const response = await analyticsAPI.getConversationStats(botId, period);
    const stats = response.data;

    // Cache results
    if (useCache) {
      await setCachedData(cacheKey, stats);
    }

    return { success: true, data: stats, fromCache: false };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch conversation stats',
      data: null,
    };
  }
};

/**
 * Export analytics report
 */
export const exportReport = async (params) => {
  try {
    const response = await analyticsAPI.exportReport(params);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to export report',
      data: null,
    };
  }
};

/**
 * Calculate percentage change
 */
export const calculateChange = (current, previous) => {
  if (!previous || previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
};

/**
 * Format analytics data for charts
 */
export const formatChartData = (data, options = {}) => {
  const { labelKey = 'date', valueKey = 'value' } = options;

  if (!Array.isArray(data)) return [];

  return data.map(item => ({
    label: item[labelKey],
    value: item[valueKey],
  }));
};

/**
 * Aggregate data by period
 */
export const aggregateByPeriod = (data, period = 'day') => {
  if (!Array.isArray(data) || data.length === 0) return [];

  const aggregated = {};

  data.forEach(item => {
    const date = new Date(item.date || item.timestamp);
    let key;

    switch (period) {
      case 'hour':
        key = `${date.toDateString()} ${date.getHours()}:00`;
        break;
      case 'day':
        key = date.toDateString();
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toDateString();
        break;
      case 'month':
        key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        break;
      default:
        key = date.toDateString();
    }

    if (!aggregated[key]) {
      aggregated[key] = { count: 0, total: 0 };
    }

    aggregated[key].count++;
    aggregated[key].total += item.value || 1;
  });

  return Object.entries(aggregated).map(([key, value]) => ({
    period: key,
    count: value.count,
    total: value.total,
    average: value.total / value.count,
  }));
};

/**
 * Get available periods
 */
export const getAvailablePeriods = () => ANALYTICS_PERIODS;

/**
 * Clear analytics cache
 */
export const clearCache = async () => {
  try {
    const keys = await storage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_KEY));
    await storage.multiRemove(cacheKeys);
    return true;
  } catch (error) {
    console.error('Clear cache error:', error);
    return false;
  }
};

export default {
  getDashboardStats,
  getBotAnalytics,
  getUsageHistory,
  getConversationStats,
  exportReport,
  calculateChange,
  formatChartData,
  aggregateByPeriod,
  getAvailablePeriods,
  clearCache,
};
