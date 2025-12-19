/**
 * useBots Hook
 * Custom hook for bot CRUD operations
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import botService from '../services/botService';

/**
 * Hook for managing bots list
 */
export const useBots = (options = {}) => {
  const { autoFetch = true, cacheEnabled = true } = options;

  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const mounted = useRef(true);

  // Fetch all bots
  const fetchBots = useCallback(async (forceRefresh = false) => {
    if (!mounted.current) return;

    setLoading(!forceRefresh);
    setRefreshing(forceRefresh);
    setError(null);

    const result = await botService.getBots({
      useCache: cacheEnabled,
      forceRefresh,
    });

    if (!mounted.current) return;

    setLoading(false);
    setRefreshing(false);

    if (result.success) {
      setBots(result.data);
    } else {
      setError(result.error);
    }

    return result;
  }, [cacheEnabled]);

  // Initial fetch
  useEffect(() => {
    mounted.current = true;

    if (autoFetch) {
      fetchBots();
    }

    return () => {
      mounted.current = false;
    };
  }, [autoFetch, fetchBots]);

  // Search bots
  const searchBots = useCallback((query) => {
    return botService.searchBots(query, bots);
  }, [bots]);

  // Filter bots by status
  const filterByStatus = useCallback((status) => {
    return botService.filterBotsByStatus(status, bots);
  }, [bots]);

  // Sort bots
  const sortBots = useCallback((field, order) => {
    return botService.sortBots(bots, field, order);
  }, [bots]);

  // Refresh handler
  const refresh = useCallback(() => {
    return fetchBots(true);
  }, [fetchBots]);

  return {
    bots,
    loading,
    refreshing,
    error,
    fetchBots,
    refresh,
    searchBots,
    filterByStatus,
    sortBots,
  };
};

/**
 * Hook for single bot operations
 */
export const useBot = (botId, options = {}) => {
  const { autoFetch = true } = options;

  const [bot, setBot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const mounted = useRef(true);

  // Fetch bot
  const fetchBot = useCallback(async () => {
    if (!botId || !mounted.current) return;

    setLoading(true);
    setError(null);

    const result = await botService.getBot(botId);

    if (!mounted.current) return;

    setLoading(false);

    if (result.success) {
      setBot(result.data);
    } else {
      setError(result.error);
    }

    return result;
  }, [botId]);

  // Initial fetch
  useEffect(() => {
    mounted.current = true;

    if (autoFetch && botId) {
      fetchBot();
    }

    return () => {
      mounted.current = false;
    };
  }, [autoFetch, botId, fetchBot]);

  // Update bot
  const updateBot = useCallback(async (updates) => {
    if (!botId || !mounted.current) return { success: false, error: 'No bot ID' };

    setSaving(true);
    setError(null);

    const result = await botService.updateBot(botId, updates);

    if (!mounted.current) return result;

    setSaving(false);

    if (result.success) {
      setBot(result.data);
    } else {
      setError(result.error);
    }

    return result;
  }, [botId]);

  // Delete bot
  const deleteBot = useCallback(async () => {
    if (!botId || !mounted.current) return { success: false, error: 'No bot ID' };

    setSaving(true);
    setError(null);

    const result = await botService.deleteBot(botId);

    if (!mounted.current) return result;

    setSaving(false);

    if (!result.success) {
      setError(result.error);
    }

    return result;
  }, [botId]);

  return {
    bot,
    loading,
    saving,
    error,
    fetchBot,
    updateBot,
    deleteBot,
    setBot,
  };
};

/**
 * Hook for creating a new bot
 */
export const useCreateBot = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createBot = useCallback(async (botData) => {
    setLoading(true);
    setError(null);

    const result = await botService.createBot(botData);

    setLoading(false);

    if (!result.success) {
      setError(result.error);
    }

    return result;
  }, []);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return {
    createBot,
    loading,
    error,
    reset,
  };
};

/**
 * Hook for bot statistics
 */
export const useBotStats = (botId) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mounted = useRef(true);

  const fetchStats = useCallback(async () => {
    if (!botId || !mounted.current) return;

    setLoading(true);
    setError(null);

    const result = await botService.getBotStats(botId);

    if (!mounted.current) return;

    setLoading(false);

    if (result.success) {
      setStats(result.data);
    } else {
      setError(result.error);
    }

    return result;
  }, [botId]);

  useEffect(() => {
    mounted.current = true;

    if (botId) {
      fetchStats();
    }

    return () => {
      mounted.current = false;
    };
  }, [botId, fetchStats]);

  return {
    stats,
    loading,
    error,
    refresh: fetchStats,
  };
};

export default {
  useBots,
  useBot,
  useCreateBot,
  useBotStats,
};
