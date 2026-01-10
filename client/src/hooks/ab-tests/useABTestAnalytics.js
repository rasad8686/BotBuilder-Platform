import { useQuery } from '@tanstack/react-query';
import useApi from '../useApi';

const AB_TESTS_KEY = 'ab-tests';
const ANALYTICS_KEY = 'analytics';

/**
 * Fetch overall analytics for an A/B test
 */
export function useABTestAnalyticsQuery(testId, options = {}) {
  const api = useApi();

  return useQuery({
    queryKey: [AB_TESTS_KEY, testId, ANALYTICS_KEY],
    queryFn: () => api.get(`/api/ab-tests/${testId}/analytics`),
    enabled: !!testId,
    ...options
  });
}

/**
 * Fetch time series data for conversion rates
 */
export function useConversionTimeSeriesQuery(testId, options = {}) {
  const api = useApi();
  const { dateRange = '7d', ...queryOptions } = options;

  return useQuery({
    queryKey: [AB_TESTS_KEY, testId, ANALYTICS_KEY, 'time-series', dateRange],
    queryFn: () => api.get(`/api/ab-tests/${testId}/analytics/time-series`, {
      params: { range: dateRange }
    }),
    enabled: !!testId,
    ...queryOptions
  });
}

/**
 * Fetch statistical significance data
 */
export function useStatisticalSignificanceQuery(testId, options = {}) {
  const api = useApi();

  return useQuery({
    queryKey: [AB_TESTS_KEY, testId, ANALYTICS_KEY, 'significance'],
    queryFn: () => api.get(`/api/ab-tests/${testId}/analytics/significance`),
    enabled: !!testId,
    ...options
  });
}

/**
 * Fetch funnel data for variants
 */
export function useFunnelDataQuery(testId, options = {}) {
  const api = useApi();

  return useQuery({
    queryKey: [AB_TESTS_KEY, testId, ANALYTICS_KEY, 'funnel'],
    queryFn: () => api.get(`/api/ab-tests/${testId}/analytics/funnel`),
    enabled: !!testId,
    ...options
  });
}

/**
 * Fetch variant comparison data
 */
export function useVariantComparisonQuery(testId, options = {}) {
  const api = useApi();

  return useQuery({
    queryKey: [AB_TESTS_KEY, testId, ANALYTICS_KEY, 'comparison'],
    queryFn: () => api.get(`/api/ab-tests/${testId}/analytics/comparison`),
    enabled: !!testId,
    ...options
  });
}

/**
 * Fetch segment breakdown (device, location, etc.)
 */
export function useSegmentBreakdownQuery(testId, segment, options = {}) {
  const api = useApi();

  return useQuery({
    queryKey: [AB_TESTS_KEY, testId, ANALYTICS_KEY, 'segments', segment],
    queryFn: () => api.get(`/api/ab-tests/${testId}/analytics/segments/${segment}`),
    enabled: !!testId && !!segment,
    ...options
  });
}

/**
 * Fetch revenue impact data
 */
export function useRevenueImpactQuery(testId, options = {}) {
  const api = useApi();

  return useQuery({
    queryKey: [AB_TESTS_KEY, testId, ANALYTICS_KEY, 'revenue'],
    queryFn: () => api.get(`/api/ab-tests/${testId}/analytics/revenue`),
    enabled: !!testId,
    ...options
  });
}

/**
 * Custom hook for real-time analytics with polling
 */
export function useRealTimeAnalytics(testId, pollInterval = 30000) {
  return useABTestAnalyticsQuery(testId, {
    refetchInterval: pollInterval,
    refetchIntervalInBackground: false
  });
}

// Default export
export default {
  useABTestAnalyticsQuery,
  useConversionTimeSeriesQuery,
  useStatisticalSignificanceQuery,
  useFunnelDataQuery,
  useVariantComparisonQuery,
  useSegmentBreakdownQuery,
  useRevenueImpactQuery,
  useRealTimeAnalytics
};
