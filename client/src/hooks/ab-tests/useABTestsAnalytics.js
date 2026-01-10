/**
 * useABTestsAnalytics Hook
 * Fetches workspace-wide A/B test analytics
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import useApi from '../useApi';

/**
 * useABTestsAnalytics - Fetch analytics for all A/B tests in workspace
 * @param {Object} options
 * @param {string} options.workspaceId - Workspace ID
 * @param {string} options.period - Time period ('7d', '30d', '90d', 'custom')
 * @param {Date} options.startDate - Custom start date
 * @param {Date} options.endDate - Custom end date
 * @param {string} options.status - Filter by status ('all', 'running', 'completed', 'paused')
 */
export function useABTestsAnalytics({
  workspaceId,
  period = '30d',
  startDate,
  endDate,
  status = 'all'
} = {}) {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    if (!workspaceId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        period,
        status
      });

      if (period === 'custom' && startDate && endDate) {
        params.append('startDate', startDate.toISOString());
        params.append('endDate', endDate.toISOString());
      }

      const response = await api.get(
        `/api/workspaces/${workspaceId}/ab-tests/analytics?${params}`
      );

      setData(response.data);
    } catch (err) {
      console.error('Error fetching AB tests analytics:', err);
      setError(err.message || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [api, workspaceId, period, startDate, endDate, status]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Summary stats
  const summary = useMemo(() => {
    if (!data) return null;

    return {
      totalTests: data.totalTests || 0,
      runningTests: data.runningTests || 0,
      completedTests: data.completedTests || 0,
      totalImpressions: data.totalImpressions || 0,
      totalConversions: data.totalConversions || 0,
      avgConversionRate: data.avgConversionRate || 0,
      testsWithWinners: data.testsWithWinners || 0,
      avgLift: data.avgLift || 0
    };
  }, [data]);

  // Period comparison
  const comparison = useMemo(() => {
    if (!data?.comparison) return null;

    const current = data.comparison.current || {};
    const previous = data.comparison.previous || {};

    const calcChange = (curr, prev) => {
      if (!prev || prev === 0) return 0;
      return ((curr - prev) / prev) * 100;
    };

    return {
      impressions: {
        current: current.impressions || 0,
        previous: previous.impressions || 0,
        change: calcChange(current.impressions, previous.impressions)
      },
      conversions: {
        current: current.conversions || 0,
        previous: previous.conversions || 0,
        change: calcChange(current.conversions, previous.conversions)
      },
      conversionRate: {
        current: current.conversionRate || 0,
        previous: previous.conversionRate || 0,
        change: calcChange(current.conversionRate, previous.conversionRate)
      },
      testsCreated: {
        current: current.testsCreated || 0,
        previous: previous.testsCreated || 0,
        change: calcChange(current.testsCreated, previous.testsCreated)
      }
    };
  }, [data]);

  return {
    data,
    summary,
    comparison,
    tests: data?.tests || [],
    timeline: data?.timeline || [],
    loading,
    error,
    refetch: fetchAnalytics
  };
}

/**
 * useABTestAnalytics - Fetch analytics for a single A/B test
 * @param {Object} options
 * @param {string} options.testId - A/B test ID
 * @param {string} options.period - Time period
 */
export function useABTestAnalytics({
  testId,
  period = '30d',
  startDate,
  endDate
} = {}) {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    if (!testId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ period });

      if (period === 'custom' && startDate && endDate) {
        params.append('startDate', startDate.toISOString());
        params.append('endDate', endDate.toISOString());
      }

      const response = await api.get(
        `/api/ab-tests/${testId}/analytics?${params}`
      );

      setData(response.data);
    } catch (err) {
      console.error('Error fetching AB test analytics:', err);
      setError(err.message || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [api, testId, period, startDate, endDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Variants data
  const variants = useMemo(() => {
    if (!data?.variants) return [];
    return data.variants;
  }, [data]);

  // Find control variant
  const controlVariant = useMemo(() => {
    return variants.find(v => v.isControl) || variants[0];
  }, [variants]);

  // Find winner
  const winner = useMemo(() => {
    if (!data?.winner) return null;
    return variants.find(v => (v.name || v.variantName) === data.winner);
  }, [data, variants]);

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!data) return null;

    return {
      confidence: data.confidence || 0,
      isSignificant: data.confidence >= 95,
      lift: data.lift || 0,
      sampleSize: data.sampleSize || 0,
      recommendedSampleSize: data.recommendedSampleSize || 0,
      dailyRate: data.dailyRate || 0
    };
  }, [data]);

  return {
    data,
    variants,
    controlVariant,
    winner,
    statistics,
    timeline: data?.timeline || [],
    hourlyData: data?.hourlyData || [],
    funnelData: data?.funnelData || [],
    loading,
    error,
    refetch: fetchAnalytics
  };
}

/**
 * useABTestVariantComparison - Compare specific variants
 */
export function useABTestVariantComparison({
  testId,
  variantA,
  variantB
} = {}) {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const compare = useCallback(async () => {
    if (!testId || !variantA || !variantB) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(
        `/api/ab-tests/${testId}/compare?variantA=${variantA}&variantB=${variantB}`
      );

      setData(response.data);
    } catch (err) {
      console.error('Error comparing variants:', err);
      setError(err.message || 'Failed to compare variants');
    } finally {
      setLoading(false);
    }
  }, [api, testId, variantA, variantB]);

  useEffect(() => {
    compare();
  }, [compare]);

  return {
    data,
    loading,
    error,
    refetch: compare
  };
}

export default useABTestsAnalytics;
