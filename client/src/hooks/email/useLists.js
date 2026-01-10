/**
 * @fileoverview List management hooks for email marketing
 * @module hooks/email/useLists
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
 * Fetch all lists
 */
const fetchLists = async () => {
  const response = await fetch(`${API_URL}/api/email/lists`, {
    headers: getHeaders()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch lists');
  }

  return response.json();
};

/**
 * Fetch single list
 */
const fetchList = async (id) => {
  const response = await fetch(`${API_URL}/api/email/lists/${id}`, {
    headers: getHeaders()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch list');
  }

  return response.json();
};

/**
 * Create list
 */
const createList = async (data) => {
  const response = await fetch(`${API_URL}/api/email/lists`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create list');
  }

  return response.json();
};

/**
 * Update list
 */
const updateList = async ({ id, ...data }) => {
  const response = await fetch(`${API_URL}/api/email/lists/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update list');
  }

  return response.json();
};

/**
 * Delete list
 */
const deleteList = async (id) => {
  const response = await fetch(`${API_URL}/api/email/lists/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete list');
  }

  return response.json();
};

/**
 * Duplicate list
 */
const duplicateList = async (id) => {
  const response = await fetch(`${API_URL}/api/email/lists/${id}/duplicate`, {
    method: 'POST',
    headers: getHeaders()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to duplicate list');
  }

  return response.json();
};

/**
 * Fetch contacts in a list
 */
const fetchListContacts = async (listId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.page) params.set('page', filters.page.toString());
  if (filters.pageSize) params.set('pageSize', filters.pageSize.toString());

  const response = await fetch(`${API_URL}/api/email/lists/${listId}/contacts?${params}`, {
    headers: getHeaders()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch list contacts');
  }

  return response.json();
};

/**
 * Add contacts to list
 */
const addContactsToList = async ({ listId, contactIds }) => {
  const response = await fetch(`${API_URL}/api/email/lists/${listId}/contacts`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ contactIds })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to add contacts to list');
  }

  return response.json();
};

/**
 * Remove contacts from list
 */
const removeContactsFromList = async ({ listId, contactIds }) => {
  const response = await fetch(`${API_URL}/api/email/lists/${listId}/contacts`, {
    method: 'DELETE',
    headers: getHeaders(),
    body: JSON.stringify({ contactIds })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to remove contacts from list');
  }

  return response.json();
};

// ============================================
// React Query Hooks
// ============================================

/**
 * Hook to fetch all lists
 */
export const useListsQuery = (options = {}) => {
  return useQuery({
    queryKey: ['email-lists'],
    queryFn: fetchLists,
    ...options
  });
};

/**
 * Hook to fetch single list
 */
export const useListQuery = (id, options = {}) => {
  return useQuery({
    queryKey: ['email-list', id],
    queryFn: () => fetchList(id),
    enabled: !!id,
    ...options
  });
};

/**
 * Hook to create list
 */
export const useCreateListMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-lists'] });
    }
  });
};

/**
 * Hook to update list
 */
export const useUpdateListMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateList,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['email-lists'] });
      queryClient.invalidateQueries({ queryKey: ['email-list', variables.id] });
    }
  });
};

/**
 * Hook to delete list
 */
export const useDeleteListMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-lists'] });
    }
  });
};

/**
 * Hook to duplicate list
 */
export const useDuplicateListMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: duplicateList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-lists'] });
    }
  });
};

/**
 * Hook to fetch list contacts
 */
export const useListContactsQuery = (listId, filters = {}, options = {}) => {
  return useQuery({
    queryKey: ['email-list-contacts', listId, filters],
    queryFn: () => fetchListContacts(listId, filters),
    enabled: !!listId,
    ...options
  });
};

/**
 * Hook to add contacts to list
 */
export const useAddContactsToListMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addContactsToList,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['email-lists'] });
      queryClient.invalidateQueries({ queryKey: ['email-list', variables.listId] });
      queryClient.invalidateQueries({ queryKey: ['email-list-contacts', variables.listId] });
      queryClient.invalidateQueries({ queryKey: ['email-contacts'] });
    }
  });
};

/**
 * Hook to remove contacts from list
 */
export const useRemoveContactsFromListMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeContactsFromList,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['email-lists'] });
      queryClient.invalidateQueries({ queryKey: ['email-list', variables.listId] });
      queryClient.invalidateQueries({ queryKey: ['email-list-contacts', variables.listId] });
      queryClient.invalidateQueries({ queryKey: ['email-contacts'] });
    }
  });
};

export default {
  useListsQuery,
  useListQuery,
  useCreateListMutation,
  useUpdateListMutation,
  useDeleteListMutation,
  useDuplicateListMutation,
  useListContactsQuery,
  useAddContactsToListMutation,
  useRemoveContactsFromListMutation
};
