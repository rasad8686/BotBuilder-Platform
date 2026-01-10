import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/email';

// Fetch functions
const fetchTemplates = async (category) => {
  const url = category
    ? `${API_BASE}/templates?category=${category}`
    : `${API_BASE}/templates`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch templates');
  return response.json();
};

const fetchTemplate = async (id) => {
  const response = await fetch(`${API_BASE}/templates/${id}`);
  if (!response.ok) throw new Error('Failed to fetch template');
  return response.json();
};

const fetchSystemTemplates = async () => {
  const response = await fetch(`${API_BASE}/templates/system`);
  if (!response.ok) throw new Error('Failed to fetch system templates');
  return response.json();
};

const createTemplate = async (data) => {
  const response = await fetch(`${API_BASE}/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to create template');
  return response.json();
};

const updateTemplate = async ({ id, ...data }) => {
  const response = await fetch(`${API_BASE}/templates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to update template');
  return response.json();
};

const deleteTemplate = async (id) => {
  const response = await fetch(`${API_BASE}/templates/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete template');
  return response.json();
};

const duplicateTemplate = async (id) => {
  const response = await fetch(`${API_BASE}/templates/${id}/duplicate`, {
    method: 'POST'
  });
  if (!response.ok) throw new Error('Failed to duplicate template');
  return response.json();
};

const sendTestEmail = async ({ templateId, email, blocks, subject, previewText }) => {
  const response = await fetch(`${API_BASE}/templates/${templateId}/test-send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, blocks, subject, previewText })
  });
  if (!response.ok) throw new Error('Failed to send test email');
  return response.json();
};

// Query Hooks
export const useTemplatesQuery = (category) => {
  return useQuery({
    queryKey: ['email-templates', category],
    queryFn: () => fetchTemplates(category),
    select: (data) => data?.templates || [],
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};

export const useTemplateQuery = (id) => {
  return useQuery({
    queryKey: ['email-template', id],
    queryFn: () => fetchTemplate(id),
    enabled: !!id && id !== 'new' && id !== 'undefined' && id !== undefined,
    staleTime: 5 * 60 * 1000
  });
};

export const useSystemTemplatesQuery = () => {
  return useQuery({
    queryKey: ['email-templates-system'],
    queryFn: fetchSystemTemplates,
    select: (data) => data?.templates || [],
    staleTime: 30 * 60 * 1000 // 30 minutes (system templates rarely change)
  });
};

// Mutation Hooks
export const useCreateTemplateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    }
  });
};

export const useUpdateTemplateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTemplate,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      queryClient.invalidateQueries({ queryKey: ['email-template', variables.id] });
    }
  });
};

export const useDeleteTemplateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    }
  });
};

export const useDuplicateTemplateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: duplicateTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    }
  });
};

export const useSendTestEmailMutation = () => {
  return useMutation({
    mutationFn: sendTestEmail
  });
};

export default {
  useTemplatesQuery,
  useTemplateQuery,
  useSystemTemplatesQuery,
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
  useDuplicateTemplateMutation,
  useSendTestEmailMutation
};
