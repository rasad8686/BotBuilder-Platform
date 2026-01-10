import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useApi from '../useApi';

const AB_TESTS_KEY = 'ab-tests';
const VARIANTS_KEY = 'variants';

/**
 * Fetch variants for a specific A/B test
 */
export function useABTestVariantsQuery(testId, options = {}) {
  const api = useApi();

  return useQuery({
    queryKey: [AB_TESTS_KEY, testId, VARIANTS_KEY],
    queryFn: () => api.get(`/api/ab-tests/${testId}/variants`),
    enabled: !!testId,
    ...options
  });
}

/**
 * Fetch a single variant by ID
 */
export function useVariantQuery(testId, variantId, options = {}) {
  const api = useApi();

  return useQuery({
    queryKey: [AB_TESTS_KEY, testId, VARIANTS_KEY, variantId],
    queryFn: () => api.get(`/api/ab-tests/${testId}/variants/${variantId}`),
    enabled: !!testId && !!variantId,
    ...options
  });
}

/**
 * Create a new variant
 */
export function useCreateVariantMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ testId, data }) =>
      api.post(`/api/ab-tests/${testId}/variants`, data),
    onSuccess: (_, { testId }) => {
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY, testId, VARIANTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY, testId] });
    }
  });
}

/**
 * Update a variant
 */
export function useUpdateVariantMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ testId, variantId, data }) =>
      api.put(`/api/ab-tests/${testId}/variants/${variantId}`, data),
    onSuccess: (_, { testId, variantId }) => {
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY, testId, VARIANTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY, testId, VARIANTS_KEY, variantId] });
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY, testId] });
    }
  });
}

/**
 * Delete a variant
 */
export function useDeleteVariantMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ testId, variantId }) =>
      api.delete(`/api/ab-tests/${testId}/variants/${variantId}`),
    onSuccess: (_, { testId }) => {
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY, testId, VARIANTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY, testId] });
    }
  });
}

/**
 * Update traffic split for all variants
 */
export function useUpdateTrafficSplitMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ testId, splits }) =>
      api.put(`/api/ab-tests/${testId}/traffic-split`, { splits }),
    onSuccess: (_, { testId }) => {
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY, testId, VARIANTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY, testId] });
    }
  });
}

/**
 * Set control variant
 */
export function useSetControlVariantMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ testId, variantId }) =>
      api.post(`/api/ab-tests/${testId}/variants/${variantId}/set-control`),
    onSuccess: (_, { testId }) => {
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY, testId, VARIANTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY, testId] });
    }
  });
}

// Default export
export default {
  useABTestVariantsQuery,
  useVariantQuery,
  useCreateVariantMutation,
  useUpdateVariantMutation,
  useDeleteVariantMutation,
  useUpdateTrafficSplitMutation,
  useSetControlVariantMutation
};
