import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/tickets/canned-responses';

// Fetch all canned responses
export function useCannedResponsesQuery(filters = {}) {
  const queryParams = new URLSearchParams();

  if (filters.category) queryParams.append('category', filters.category);
  if (filters.search) queryParams.append('search', filters.search);

  return useQuery({
    queryKey: ['canned-responses', filters],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch canned responses');
      return response.json();
    }
  });
}

// Fetch single canned response
export function useCannedResponseQuery(responseId) {
  return useQuery({
    queryKey: ['canned-response', responseId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/${responseId}`);
      if (!response.ok) throw new Error('Failed to fetch canned response');
      return response.json();
    },
    enabled: !!responseId
  });
}

// Create canned response
export function useCreateCannedResponseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (responseData) => {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(responseData)
      });
      if (!response.ok) throw new Error('Failed to create canned response');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] });
    }
  });
}

// Update canned response
export function useUpdateCannedResponseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ responseId, data }) => {
      const response = await fetch(`${API_BASE}/${responseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update canned response');
      return response.json();
    },
    onSuccess: (_, { responseId }) => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] });
      queryClient.invalidateQueries({ queryKey: ['canned-response', responseId] });
    }
  });
}

// Delete canned response
export function useDeleteCannedResponseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (responseId) => {
      const response = await fetch(`${API_BASE}/${responseId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete canned response');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] });
    }
  });
}

// Track canned response usage
export function useTrackCannedResponseUsageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (responseId) => {
      const response = await fetch(`${API_BASE}/${responseId}/usage`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to track usage');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] });
    }
  });
}

// Get canned response categories
export function useCannedResponseCategoriesQuery() {
  return useQuery({
    queryKey: ['canned-response-categories'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/categories`);
      if (!response.ok) throw new Error('Failed to fetch categories');
      return response.json();
    }
  });
}
