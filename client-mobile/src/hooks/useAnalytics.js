/**
 * useAnalytics Hook
 * Custom hook for analytics and statistics data
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import analyticsService from '../services/analyticsService';

/**
 * Hook for dashboard statistics
 */
export const useDashboardStats = (options = {}) => {
  const { autoFetch = true, cacheEnabled = true } = options;

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const mounted = useRef(true);

  const fetchStats = useCallback(async (forceRefresh = false) => {
    if (!mounted.current) return;

    setLoading(!forceRefresh);
    setRefreshing(forceRefresh);
    setError(null);

    const result = await analyticsService.getDashboardStats({
      useCache: cacheEnabled,
      forceRefresh,
    });

    if (!mounted.current) return;

    setLoading(false);
    setRefreshing(false);

    if (result.success) {
      setStats(result.data);
    } else {
      setError(result.error);
    }

    return result;
  }, [cacheEnabled]);

  useEffect(() => {
    mounted.current = true;

    if (autoFetch) {
      fetchStats();
    }

    return () => {
      mounted.current = false;
    };
  }, [autoFetch, fetchStats]);

  const refresh = useCallback(() => {
    return fetchStats(true);
  }, [fetchStats]);

  return {
    stats,
    loading,
    refreshing,
    error,
    fetchStats,
    refresh,
  };
};

/**
 * Hook for bot-specific analytics
 */
export const useBotAnalytics = (botId, options = {}) => {
  const { autoFetch = true, period = '7d', cacheEnabled = true } = options;

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const [error, setError] = useState(null);

  const mounted = useRef(true);

  const fetchAnalytics = useCallback(async (periodOverride) => {
    if (!botId || !mounted.current) return;

    const fetchPeriod = periodOverride || selectedPeriod;

    setLoading(true);
    setError(null);

    const result = await analyticsService.getBotAnalytics(botId, fetchPeriod, {
      useCache: cacheEnabled,
    });

    if (!mounted.current) return;

    setLoading(false);

    if (result.success) {
      setAnalytics(result.data);
    } else {
      setError(result.error);
    }

    return result;
  }, [botId, selectedPeriod, cacheEnabled]);

  useEffect(() => {
    mounted.current = true;

    if (autoFetch && botId) {
      fetchAnalytics();
    }

    return () => {
      mounted.current = false;
    };
  }, [autoFetch, botId, fetchAnalytics]);

  const changePeriod = useCallback((newPeriod) => {
    setSelectedPeriod(newPeriod);
    fetchAnalytics(newPeriod);
  }, [fetchAnalytics]);

  return {
    analytics,
    loading,
    error,
    period: selectedPeriod,
    changePeriod,
    refresh: fetchAnalytics,
    availablePeriods: analyticsService.getAvailablePeriods(),
  };
};

/**
 * Hook for usage history
 */
export const useUsageHistory = (options = {}) => {
  const { autoFetch = true, period = '30d', cacheEnabled = true } = options;

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const [error, setError] = useState(null);

  const mounted = useRef(true);

  const fetchHistory = useCallback(async (periodOverride) => {
    if (!mounted.current) return;

    const fetchPeriod = periodOverride || selectedPeriod;

    setLoading(true);
    setError(null);

    const result = await analyticsService.getUsageHistory(fetchPeriod, {
      useCache: cacheEnabled,
    });

    if (!mounted.current) return;

    setLoading(false);

    if (result.success) {
      setHistory(result.data);
    } else {
      setError(result.error);
    }

    return result;
  }, [selectedPeriod, cacheEnabled]);

  useEffect(() => {
    mounted.current = true;

    if (autoFetch) {
      fetchHistory();
    }

    return () => {
      mounted.current = false;
    };
  }, [autoFetch, fetchHistory]);

  const changePeriod = useCallback((newPeriod) => {
    setSelectedPeriod(newPeriod);
    fetchHistory(newPeriod);
  }, [fetchHistory]);

  // Format data for charts
  const chartData = analyticsService.formatChartData(history);

  return {
    history,
    chartData,
    loading,
    error,
    period: selectedPeriod,
    changePeriod,
    refresh: fetchHistory,
    availablePeriods: analyticsService.getAvailablePeriods(),
  };
};

/**
 * Hook for conversation statistics
 */
export const useConversationStats = (botId, options = {}) => {
  const { autoFetch = true, period = '7d' } = options;

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const [error, setError] = useState(null);

  const mounted = useRef(true);

  const fetchStats = useCallback(async (periodOverride) => {
    if (!botId || !mounted.current) return;

    const fetchPeriod = periodOverride || selectedPeriod;

    setLoading(true);
    setError(null);

    const result = await analyticsService.getConversationStats(botId, fetchPeriod);

    if (!mounted.current) return;

    setLoading(false);

    if (result.success) {
      setStats(result.data);
    } else {
      setError(result.error);
    }

    return result;
  }, [botId, selectedPeriod]);

  useEffect(() => {
    mounted.current = true;

    if (autoFetch && botId) {
      fetchStats();
    }

    return () => {
      mounted.current = false;
    };
  }, [autoFetch, botId, fetchStats]);

  const changePeriod = useCallback((newPeriod) => {
    setSelectedPeriod(newPeriod);
    fetchStats(newPeriod);
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    period: selectedPeriod,
    changePeriod,
    refresh: fetchStats,
  };
};

/**
 * Hook for aggregated analytics
 */
export const useAggregatedAnalytics = (data, options = {}) => {
  const { aggregateBy = 'day' } = options;

  const [aggregated, setAggregated] = useState([]);

  useEffect(() => {
    if (data && Array.isArray(data)) {
      const result = analyticsService.aggregateByPeriod(data, aggregateBy);
      setAggregated(result);
    }
  }, [data, aggregateBy]);

  const aggregate = useCallback((newPeriod) => {
    if (data && Array.isArray(data)) {
      return analyticsService.aggregateByPeriod(data, newPeriod);
    }
    return [];
  }, [data]);

  return {
    aggregated,
    aggregate,
  };
};

/**
 * Combined analytics hook for complete dashboard data
 */
export const useFullAnalytics = (botId = null, options = {}) => {
  const dashboard = useDashboardStats(options);
  const usage = useUsageHistory(options);
  const botAnalytics = useBotAnalytics(botId, { ...options, autoFetch: !!botId });

  const loading = dashboard.loading || usage.loading || botAnalytics.loading;
  const error = dashboard.error || usage.error || botAnalytics.error;

  const refreshAll = useCallback(async () => {
    await Promise.all([
      dashboard.refresh(),
      usage.refresh(),
      botId && botAnalytics.refresh(),
    ]);
  }, [dashboard, usage, botAnalytics, botId]);

  return {
    dashboard: dashboard.stats,
    usage: usage.history,
    usageChartData: usage.chartData,
    botAnalytics: botAnalytics.analytics,
    loading,
    error,
    refreshAll,
    dashboardHook: dashboard,
    usageHook: usage,
    botAnalyticsHook: botAnalytics,
  };
};

export default {
  useDashboardStats,
  useBotAnalytics,
  useUsageHistory,
  useConversationStats,
  useAggregatedAnalytics,
  useFullAnalytics,
};
