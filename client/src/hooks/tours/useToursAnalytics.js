/**
 * @fileoverview Hook for fetching analytics for all tours in workspace
 * @module hooks/tours/useToursAnalytics
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import useApi from '../useApi';

/**
 * Get date range parameters from preset
 * @param {string} range - Date range preset ('7d', '30d', '90d', 'custom')
 * @param {Object} customRange - Custom date range { start, end }
 * @returns {Object} { startDate, endDate }
 */
const getDateRange = (range, customRange = null) => {
  const end = new Date();
  const start = new Date();

  if (range === 'custom' && customRange) {
    return {
      startDate: customRange.start,
      endDate: customRange.end
    };
  }

  switch (range) {
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
    default:
      start.setDate(start.getDate() - 7);
  }

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
};

/**
 * Hook for fetching analytics summary and data for all tours
 * @param {Object} options - Options
 * @param {string} options.workspaceId - Workspace ID
 * @param {Object} options.dateRange - Date range { start, end } or preset string
 * @param {string} options.tourId - Optional tour ID filter
 * @param {string} options.status - Optional status filter ('active', 'paused', 'all')
 * @returns {Object} { data, isLoading, error, refetch }
 */
export const useToursAnalytics = (options = {}) => {
  const {
    workspaceId,
    dateRange = '30d',
    tourId = null,
    status = 'all'
  } = options;

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const api = useApi();

  // Calculate date range
  const dates = useMemo(() => {
    if (typeof dateRange === 'object' && dateRange.start && dateRange.end) {
      return getDateRange('custom', dateRange);
    }
    return getDateRange(dateRange);
  }, [dateRange]);

  // Calculate previous period for comparison
  const previousDates = useMemo(() => {
    const start = new Date(dates.startDate);
    const end = new Date(dates.endDate);
    const diff = end - start;

    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setTime(prevStart.getTime() - diff);

    return {
      startDate: prevStart.toISOString().split('T')[0],
      endDate: prevEnd.toISOString().split('T')[0]
    };
  }, [dates]);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build query params
      const params = new URLSearchParams();
      params.append('startDate', dates.startDate);
      params.append('endDate', dates.endDate);
      if (status && status !== 'all') {
        params.append('status', status);
      }
      if (workspaceId) {
        params.append('workspace_id', workspaceId);
      }

      // Fetch current period summary
      const summaryResponse = await api.get(`/tours/analytics/summary?${params.toString()}`);

      // Fetch daily stats
      const dailyParams = new URLSearchParams(params);
      if (tourId) {
        dailyParams.append('tourId', tourId);
      }
      const dailyResponse = await api.get(`/tours/analytics/daily?${dailyParams.toString()}`);

      // Fetch top tours
      const topParams = new URLSearchParams(params);
      topParams.append('limit', '10');
      topParams.append('sortBy', 'completions');
      const topResponse = await api.get(`/tours/analytics/top?${topParams.toString()}`);

      // Fetch previous period for comparison
      const prevParams = new URLSearchParams();
      prevParams.append('startDate', previousDates.startDate);
      prevParams.append('endDate', previousDates.endDate);
      if (status && status !== 'all') {
        prevParams.append('status', status);
      }
      if (workspaceId) {
        prevParams.append('workspace_id', workspaceId);
      }
      const prevSummaryResponse = await api.get(`/tours/analytics/summary?${prevParams.toString()}`);

      // Calculate trends
      const summary = summaryResponse.summary || {};
      const prevSummary = prevSummaryResponse.summary || {};

      const calculateChange = (current, previous) => {
        if (!previous || previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous * 100).toFixed(1);
      };

      setData({
        summary: {
          totalTours: summary.totalTours || 0,
          totalImpressions: summary.totalImpressions || 0,
          avgCompletionRate: summary.avgCompletionRate || 0,
          totalCompletions: summary.totalCompletions || 0,
          trends: {
            tours: calculateChange(summary.totalTours, prevSummary.totalTours),
            impressions: calculateChange(summary.totalImpressions, prevSummary.totalImpressions),
            completionRate: calculateChange(summary.avgCompletionRate, prevSummary.avgCompletionRate),
            completions: calculateChange(summary.totalCompletions, prevSummary.totalCompletions)
          }
        },
        dailyStats: dailyResponse.data || [],
        topTours: topResponse.tours || [],
        stepBreakdown: summaryResponse.stepBreakdown || []
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [dates, previousDates, tourId, status, workspaceId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchAnalytics
  };
};

export default useToursAnalytics;
