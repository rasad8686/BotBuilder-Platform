/**
 * @fileoverview Contact management hooks for email marketing
 * @module hooks/email/useContacts
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Get auth headers
 */
const getHeaders = () => {
  const token = localStorage.getItem('token');
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
    || localStorage.getItem('csrfToken')
    || document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='))?.split('=')[1];
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
  };
};

/**
 * Fetch contacts with filters
 */
const fetchContacts = async (filters = {}) => {
  const params = new URLSearchParams();

  if (filters.status?.length) params.set('status', filters.status.join(','));
  if (filters.tags?.length) params.set('tags', filters.tags.join(','));
  if (filters.lists?.length) params.set('lists', filters.lists.join(','));
  if (filters.source?.length) params.set('source', filters.source.join(','));
  if (filters.search) params.set('search', filters.search);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  if (filters.page) params.set('page', filters.page.toString());
  if (filters.pageSize) params.set('pageSize', filters.pageSize.toString());
  if (filters.excludeList) params.set('excludeList', filters.excludeList);
  if (filters.dateRange?.start) params.set('dateFrom', filters.dateRange.start);
  if (filters.dateRange?.end) params.set('dateTo', filters.dateRange.end);
  if (filters.rules?.length) params.set('rules', JSON.stringify(filters.rules));

  const response = await fetch(`${API_URL}/api/email/contacts?${params}`, {
    headers: getHeaders()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch contacts');
  }

  return response.json();
};

/**
 * Fetch single contact
 */
const fetchContact = async (id) => {
  const response = await fetch(`${API_URL}/api/email/contacts/${id}`, {
    headers: getHeaders()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch contact');
  }

  return response.json();
};

/**
 * Create contact
 */
const createContact = async (data) => {
  const response = await fetch(`${API_URL}/api/email/contacts`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create contact');
  }

  return response.json();
};

/**
 * Update contact
 */
const updateContact = async ({ id, ...data }) => {
  const response = await fetch(`${API_URL}/api/email/contacts/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update contact');
  }

  return response.json();
};

/**
 * Delete contact
 */
const deleteContact = async (id) => {
  const response = await fetch(`${API_URL}/api/email/contacts/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete contact');
  }

  return response.json();
};

/**
 * Bulk delete contacts
 */
const bulkDeleteContacts = async (ids) => {
  const response = await fetch(`${API_URL}/api/email/contacts/bulk-delete`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ ids })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete contacts');
  }

  return response.json();
};

/**
 * Bulk tag contacts
 */
const bulkTagContacts = async ({ contactIds, tags, action = 'add' }) => {
  const response = await fetch(`${API_URL}/api/email/contacts/bulk-tag`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ contactIds, tags, action })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update tags');
  }

  return response.json();
};

/**
 * Import contacts
 */
const importContacts = async ({ data, mapping, options, onProgress }) => {
  const response = await fetch(`${API_URL}/api/email/contacts/import`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ data, mapping, options })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to import contacts');
  }

  return response.json();
};

/**
 * Export contacts
 */
const exportContacts = async ({ contactIds, filters, format, fields, scope }) => {
  const response = await fetch(`${API_URL}/api/email/contacts/export`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ contactIds, filters, format, fields, scope })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to export contacts');
  }

  const contentType = response.headers.get('content-type');
  const contentDisposition = response.headers.get('content-disposition');
  const filename = contentDisposition
    ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
    : `contacts.${format === 'excel' ? 'xlsx' : 'csv'}`;

  const data = await response.blob();

  return { data, contentType, filename };
};

// ============================================
// React Query Hooks
// ============================================

/**
 * Hook to fetch contacts with filters
 */
export const useContactsQuery = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ['email-contacts', filters],
    queryFn: () => fetchContacts(filters),
    ...options
  });
};

/**
 * Hook to fetch single contact
 */
export const useContactQuery = (id, options = {}) => {
  return useQuery({
    queryKey: ['email-contact', id],
    queryFn: () => fetchContact(id),
    enabled: !!id,
    ...options
  });
};

/**
 * Hook to create contact
 */
export const useCreateContactMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-contacts'] });
    }
  });
};

/**
 * Hook to update contact
 */
export const useUpdateContactMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateContact,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['email-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['email-contact', variables.id] });
    }
  });
};

/**
 * Hook to delete contact
 */
export const useDeleteContactMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-contacts'] });
    }
  });
};

/**
 * Hook to bulk delete contacts
 */
export const useBulkDeleteContactsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkDeleteContacts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-contacts'] });
    }
  });
};

/**
 * Hook to bulk tag contacts
 */
export const useBulkTagContactsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkTagContacts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['email-tags'] });
    }
  });
};

/**
 * Hook to import contacts
 */
export const useImportContactsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: importContacts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-contacts'] });
    }
  });
};

/**
 * Hook to export contacts
 */
export const useExportContactsMutation = () => {
  return useMutation({
    mutationFn: exportContacts
  });
};

export default {
  useContactsQuery,
  useContactQuery,
  useCreateContactMutation,
  useUpdateContactMutation,
  useDeleteContactMutation,
  useBulkDeleteContactsMutation,
  useBulkTagContactsMutation,
  useImportContactsMutation,
  useExportContactsMutation
};
