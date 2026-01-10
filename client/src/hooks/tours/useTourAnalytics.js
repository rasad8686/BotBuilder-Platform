/**
 * @fileoverview Hook for fetching detailed analytics for a single tour
 * @module hooks/tours/useTourAnalytics
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import useApi from '../useApi';

/**
 * Get date range parameters from preset
 * @param {string|Object} range - Date range preset or custom range
 * @returns {Object} { startDate, endDate }
 */
const getDateRange = (range) => {
  if (typeof range === 'object' && range.start && range.end) {
    return {
      startDate: range.start,
      endDate: range.end
    };
  }

  const end = new Date();
  const start = new Date();

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
 * Hook for fetching detailed analytics for a single tour
 * @param {string} tourId - Tour ID
 * @param {string|Object} dateRange - Date range preset or { start, end }
 * @returns {Object} { data, isLoading, error, refetch }
 */
export const useTourAnalytics = (tourId, dateRange = '30d') => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const api = useApi();

  // Calculate date range
  const dates = useMemo(() => getDateRange(dateRange), [dateRange]);

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
    if (!tourId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch current period analytics
      const currentParams = new URLSearchParams();
      currentParams.append('startDate', dates.startDate);
      currentParams.append('endDate', dates.endDate);

      const analyticsResponse = await api.get(`/tours/${tourId}/analytics?${currentParams.toString()}`);

      // Fetch funnel data
      const funnelResponse = await api.get(`/tours/analytics/funnel?tourId=${tourId}&startDate=${dates.startDate}&endDate=${dates.endDate}`);

      // Fetch step analytics
      const stepsResponse = await api.get(`/tours/analytics/steps?tourId=${tourId}&startDate=${dates.startDate}&endDate=${dates.endDate}`);

      // Fetch previous period for comparison
      const prevParams = new URLSearchParams();
      prevParams.append('startDate', previousDates.startDate);
      prevParams.append('endDate', previousDates.endDate);

      const prevAnalyticsResponse = await api.get(`/tours/${tourId}/analytics?${prevParams.toString()}`);

      // Process data
      const analytics = analyticsResponse.analytics || {};
      const prevAnalytics = prevAnalyticsResponse.analytics || {};
      const funnel = funnelResponse.funnel || {};
      const steps = stepsResponse.steps || [];

      // Calculate completion rate
      const impressions = analytics.totals?.impressions || 0;
      const starts = analytics.totals?.starts || 0;
      const completions = analytics.totals?.completions || 0;
      const rate = starts > 0 ? ((completions / starts) * 100).toFixed(1) : 0;

      // Calculate trends
      const calculateChange = (current, previous) => {
        if (!previous || previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous * 100).toFixed(1);
      };

      const prevImpressions = prevAnalytics.totals?.impressions || 0;
      const prevStarts = prevAnalytics.totals?.starts || 0;
      const prevCompletions = prevAnalytics.totals?.completions || 0;
      const prevRate = prevStarts > 0 ? ((prevCompletions / prevStarts) * 100).toFixed(1) : 0;

      setData({
        impressions,
        starts,
        completions,
        rate: parseFloat(rate),
        avgTimeSeconds: analytics.totals?.avgTimeSeconds || 0,
        dismissals: analytics.totals?.dismissals || 0,

        // Trends (comparison with previous period)
        trends: {
          impressions: parseFloat(calculateChange(impressions, prevImpressions)),
          starts: parseFloat(calculateChange(starts, prevStarts)),
          completions: parseFloat(calculateChange(completions, prevCompletions)),
          rate: parseFloat(calculateChange(rate, prevRate))
        },

        // Funnel data
        funnel: {
          impressions: funnel.impressions || impressions,
          started: funnel.started || starts,
          stepViews: funnel.stepViews || [],
          completed: funnel.completed || completions,
          dismissed: funnel.dismissed || analytics.totals?.dismissals || 0
        },

        // Step breakdown
        steps: steps.map((step, index) => ({
          stepId: step.stepId || step.id,
          stepOrder: step.stepOrder || index + 1,
          title: step.title || `Step ${index + 1}`,
          views: step.views || 0,
          completions: step.completions || 0,
          avgTime: step.avgTime || 0,
          dropOffRate: step.dropOffRate || 0
        })),

        // Daily timeline
        timeline: (analytics.daily || []).map(day => ({
          date: day.date,
          impressions: day.impressions || 0,
          starts: day.starts || 0,
          completions: day.completions || 0,
          dismissals: day.dismissals || 0
        }))
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [tourId, dates, previousDates]);

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

export default useTourAnalytics;
