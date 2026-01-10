import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';

// Query Keys
const AUTOMATION_KEYS = {
  all: ['automations'],
  lists: () => [...AUTOMATION_KEYS.all, 'list'],
  list: (filters) => [...AUTOMATION_KEYS.lists(), filters],
  details: () => [...AUTOMATION_KEYS.all, 'detail'],
  detail: (id) => [...AUTOMATION_KEYS.details(), id],
  report: (id) => [...AUTOMATION_KEYS.all, 'report', id],
  enrollments: (id) => [...AUTOMATION_KEYS.all, 'enrollments', id]
};

// Get all automations
export const useAutomationsQuery = (filters = {}) => {
  return useQuery({
    queryKey: AUTOMATION_KEYS.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);

      const response = await api.get(`/api/email/automations?${params}`);
      return response.data;
    },
    select: (data) => data?.automations || []
  });
};

// Get single automation
export const useAutomationQuery = (id) => {
  return useQuery({
    queryKey: AUTOMATION_KEYS.detail(id),
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get(`/api/email/automations/${id}`);
      return response.data;
    },
    enabled: !!id
  });
};

// Create automation
export const useCreateAutomationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/api/email/automations', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTOMATION_KEYS.lists() });
    }
  });
};

// Update automation
export const useUpdateAutomationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const response = await api.put(`/api/email/automations/${id}`, data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: AUTOMATION_KEYS.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: AUTOMATION_KEYS.lists() });
    }
  });
};

// Delete automation
export const useDeleteAutomationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/api/email/automations/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTOMATION_KEYS.lists() });
    }
  });
};

// Activate automation
export const useActivateAutomationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const response = await api.post(`/api/email/automations/${id}/activate`);
      return response.data;
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: AUTOMATION_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: AUTOMATION_KEYS.lists() });
    }
  });
};

// Pause automation
export const usePauseAutomationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const response = await api.post(`/api/email/automations/${id}/pause`);
      return response.data;
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: AUTOMATION_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: AUTOMATION_KEYS.lists() });
    }
  });
};

// Get automation report
export const useAutomationReportQuery = (id) => {
  return useQuery({
    queryKey: AUTOMATION_KEYS.report(id),
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get(`/api/email/automations/${id}/report`);
      return response.data;
    },
    enabled: !!id
  });
};

// Get automation enrollments
export const useAutomationEnrollmentsQuery = (id, options = {}) => {
  return useQuery({
    queryKey: AUTOMATION_KEYS.enrollments(id),
    queryFn: async () => {
      if (!id) return [];
      const params = new URLSearchParams();
      if (options.status) params.append('status', options.status);
      if (options.page) params.append('page', options.page);
      if (options.limit) params.append('limit', options.limit);

      const response = await api.get(`/api/email/automations/${id}/enrollments?${params}`);
      return response.data;
    },
    enabled: !!id
  });
};

// Enroll contact in automation
export const useEnrollContactMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ automationId, contactId }) => {
      const response = await api.post(`/api/email/automations/${automationId}/enroll`, {
        contact_id: contactId
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: AUTOMATION_KEYS.enrollments(variables.automationId) });
      queryClient.invalidateQueries({ queryKey: AUTOMATION_KEYS.report(variables.automationId) });
    }
  });
};

// Remove enrollment
export const useRemoveEnrollmentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ automationId, enrollmentId }) => {
      const response = await api.delete(`/api/email/automations/${automationId}/enrollments/${enrollmentId}`);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: AUTOMATION_KEYS.enrollments(variables.automationId) });
      queryClient.invalidateQueries({ queryKey: AUTOMATION_KEYS.report(variables.automationId) });
    }
  });
};

export default {
  useAutomationsQuery,
  useAutomationQuery,
  useCreateAutomationMutation,
  useUpdateAutomationMutation,
  useDeleteAutomationMutation,
  useActivateAutomationMutation,
  usePauseAutomationMutation,
  useAutomationReportQuery,
  useAutomationEnrollmentsQuery,
  useEnrollContactMutation,
  useRemoveEnrollmentMutation
};
