import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useApi from '../useApi';

const AB_TESTS_KEY = 'ab-tests';

// ============ Queries ============

/**
 * Fetch all A/B tests
 */
export function useABTestsQuery(options = {}) {
  const api = useApi();

  return useQuery({
    queryKey: [AB_TESTS_KEY],
    queryFn: () => api.get('/ab-tests'),
    ...options
  });
}

/**
 * Fetch a single A/B test by ID
 */
export function useABTestQuery(id, options = {}) {
  const api = useApi();

  return useQuery({
    queryKey: [AB_TESTS_KEY, id],
    queryFn: () => api.get(`/ab-tests/${id}`),
    enabled: !!id,
    ...options
  });
}

/**
 * Fetch A/B test results/analytics
 */
export function useABTestResultsQuery(id, options = {}) {
  const api = useApi();

  return useQuery({
    queryKey: [AB_TESTS_KEY, id, 'results'],
    queryFn: () => api.get(`/api/ab-tests/${id}/results`),
    enabled: !!id,
    ...options
  });
}

// ============ Mutations ============

/**
 * Create a new A/B test
 */
export function useCreateABTestMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => api.post('/ab-tests', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY] });
    }
  });
}

/**
 * Update an existing A/B test
 */
export function useUpdateABTestMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/ab-tests/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY, variables.id] });
    }
  });
}

/**
 * Delete an A/B test
 */
export function useDeleteABTestMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => api.delete(`/ab-tests/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY] });
    }
  });
}

/**
 * Duplicate an A/B test
 */
export function useDuplicateABTestMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => api.post(`/ab-tests/${id}/duplicate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY] });
    }
  });
}

/**
 * Start an A/B test
 */
export function useStartTestMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => api.post(`/ab-tests/${id}/start`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY, id] });
    }
  });
}

/**
 * Pause an A/B test
 */
export function usePauseTestMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => api.post(`/ab-tests/${id}/pause`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY, id] });
    }
  });
}

/**
 * Complete an A/B test
 */
export function useCompleteTestMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => api.post(`/ab-tests/${id}/complete`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY, id] });
    }
  });
}

/**
 * Declare a winner for an A/B test
 */
export function useDeclareWinnerMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ testId, variantId }) =>
      api.post(`/ab-tests/${testId}/declare-winner`, { variant_id: variantId }),
    onSuccess: (_, { testId }) => {
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY, testId] });
      queryClient.invalidateQueries({ queryKey: [AB_TESTS_KEY, testId, 'results'] });
    }
  });
}

// Default export for backwards compatibility
export default {
  useABTestsQuery,
  useABTestQuery,
  useABTestResultsQuery,
  useCreateABTestMutation,
  useUpdateABTestMutation,
  useDeleteABTestMutation,
  useDuplicateABTestMutation,
  useStartTestMutation,
  usePauseTestMutation,
  useCompleteTestMutation,
  useDeclareWinnerMutation
};
