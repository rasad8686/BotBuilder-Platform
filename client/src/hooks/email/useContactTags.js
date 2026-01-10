/**
 * @fileoverview Contact tags hooks for email marketing
 * @module hooks/email/useContactTags
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Get auth headers
 */
const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

/**
 * Fetch all unique tags
 */
const fetchTags = async () => {
  const response = await fetch(`${API_URL}/api/email/contacts/tags`, {
    headers: getHeaders()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch tags');
  }

  return response.json();
};

/**
 * Add tags to contacts
 */
const addTags = async ({ contactIds, tags }) => {
  const response = await fetch(`${API_URL}/api/email/contacts/bulk-tag`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ contactIds, tags, action: 'add' })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to add tags');
  }

  return response.json();
};

/**
 * Remove tags from contacts
 */
const removeTags = async ({ contactIds, tags }) => {
  const response = await fetch(`${API_URL}/api/email/contacts/bulk-tag`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ contactIds, tags, action: 'remove' })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to remove tags');
  }

  return response.json();
};

// ============================================
// React Query Hooks
// ============================================

/**
 * Hook to fetch all unique tags
 */
export const useTagsQuery = (options = {}) => {
  return useQuery({
    queryKey: ['email-tags'],
    queryFn: fetchTags,
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...options
  });
};

/**
 * Hook to add tags to contacts
 */
export const useAddTagsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addTags,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['email-tags'] });
    }
  });
};

/**
 * Hook to remove tags from contacts
 */
export const useRemoveTagsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeTags,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['email-tags'] });
    }
  });
};

export default {
  useTagsQuery,
  useAddTagsMutation,
  useRemoveTagsMutation
};
