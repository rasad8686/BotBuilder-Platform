import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';

// ==================== CAMPAIGNS ====================

/**
 * Fetch campaigns with filters
 */
export const useCampaignsQuery = (filters = {}) => {
  return useQuery({
    queryKey: ['email-campaigns', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, value);
        }
      });
      const { data } = await api.get(`/api/email/campaigns?${params.toString()}`);
      return data;
    },
    keepPreviousData: true
  });
};

/**
 * Fetch single campaign
 */
export const useCampaignQuery = (id) => {
  return useQuery({
    queryKey: ['email-campaign', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get(`/api/email/campaigns/${id}`);
      return data.campaign || data;
    },
    enabled: !!id
  });
};

/**
 * Create campaign mutation
 */
export const useCreateCampaignMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignData) => {
      const { data } = await api.post('/api/email/campaigns', campaignData);
      return data.campaign || data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['email-campaigns']);
    }
  });
};

/**
 * Update campaign mutation
 */
export const useUpdateCampaignMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data: campaignData }) => {
      const { data } = await api.put(`/api/email/campaigns/${id}`, campaignData);
      return data.campaign || data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['email-campaigns']);
      queryClient.invalidateQueries(['email-campaign', variables.id]);
    }
  });
};

/**
 * Delete campaign mutation
 */
export const useDeleteCampaignMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      await api.delete(`/api/email/campaigns/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['email-campaigns']);
    }
  });
};

/**
 * Duplicate campaign mutation
 */
export const useDuplicateCampaignMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.post(`/api/email/campaigns/${id}/duplicate`);
      return data.campaign || data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['email-campaigns']);
    }
  });
};

/**
 * Send campaign mutation
 */
export const useSendCampaignMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.post(`/api/email/campaigns/${id}/send`);
      return data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries(['email-campaigns']);
      queryClient.invalidateQueries(['email-campaign', id]);
    }
  });
};

/**
 * Schedule campaign mutation
 */
export const useScheduleCampaignMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, scheduled_at }) => {
      const { data } = await api.post(`/api/email/campaigns/${id}/schedule`, {
        scheduledAt: scheduled_at
      });
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries(['email-campaigns']);
      queryClient.invalidateQueries(['email-campaign', id]);
    }
  });
};

/**
 * Pause campaign mutation
 */
export const usePauseCampaignMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.post(`/api/email/campaigns/${id}/pause`);
      return data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries(['email-campaigns']);
      queryClient.invalidateQueries(['email-campaign', id]);
    }
  });
};

/**
 * Resume campaign mutation
 */
export const useResumeCampaignMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.post(`/api/email/campaigns/${id}/resume`);
      return data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries(['email-campaigns']);
      queryClient.invalidateQueries(['email-campaign', id]);
    }
  });
};

/**
 * Cancel campaign mutation
 */
export const useCancelCampaignMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.post(`/api/email/campaigns/${id}/cancel`);
      return data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries(['email-campaigns']);
      queryClient.invalidateQueries(['email-campaign', id]);
    }
  });
};

/**
 * Test send mutation
 */
export const useTestSendMutation = () => {
  return useMutation({
    mutationFn: async ({ id, email, subject, content_html, from_name, from_email }) => {
      if (id) {
        const { data } = await api.post(`/api/email/campaigns/${id}/test-send`, { email });
        return data;
      }
      // For preview without saved campaign
      const { data } = await api.post('/api/email/campaigns/test-send', {
        email,
        subject,
        content_html,
        from_name,
        from_email
      });
      return data;
    }
  });
};

/**
 * Fetch campaign preview
 */
export const useCampaignPreviewQuery = (id) => {
  return useQuery({
    queryKey: ['email-campaign-preview', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get(`/api/email/campaigns/${id}/preview`);
      return data;
    },
    enabled: !!id
  });
};

/**
 * Fetch campaign recipients
 */
export const useCampaignRecipientsQuery = (id, filters = {}) => {
  return useQuery({
    queryKey: ['email-campaign-recipients', id, filters],
    queryFn: async () => {
      if (!id) return null;
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, value);
        }
      });
      const { data } = await api.get(`/api/email/campaigns/${id}/recipients?${params.toString()}`);
      return data;
    },
    enabled: !!id
  });
};

/**
 * Fetch campaign report
 */
export const useCampaignReportQuery = (id) => {
  return useQuery({
    queryKey: ['email-campaign-report', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get(`/api/email/campaigns/${id}/report`);
      return data;
    },
    enabled: !!id,
    refetchInterval: 30000 // Refresh every 30 seconds
  });
};

// ==================== LISTS ====================

/**
 * Fetch email lists
 */
export const useEmailListsQuery = () => {
  return useQuery({
    queryKey: ['email-lists'],
    queryFn: async () => {
      const { data } = await api.get('/api/email/lists');
      return data;
    }
  });
};

/**
 * Fetch single list
 */
export const useEmailListQuery = (id) => {
  return useQuery({
    queryKey: ['email-list', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get(`/api/email/lists/${id}`);
      return data.list || data;
    },
    enabled: !!id
  });
};

// ==================== TEMPLATES ====================

/**
 * Fetch email templates
 */
export const useEmailTemplatesQuery = (category) => {
  return useQuery({
    queryKey: ['email-templates', category],
    queryFn: async () => {
      const params = category ? `?category=${category}` : '';
      const { data } = await api.get(`/api/email/templates${params}`);
      return data;
    }
  });
};

/**
 * Fetch single template
 */
export const useEmailTemplateQuery = (id) => {
  return useQuery({
    queryKey: ['email-template', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get(`/api/email/templates/${id}`);
      return data.template || data;
    },
    enabled: !!id
  });
};

// ==================== ANALYTICS ====================

/**
 * Fetch email analytics overview
 */
export const useEmailAnalyticsQuery = (dateRange = {}) => {
  return useQuery({
    queryKey: ['email-analytics', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.start) params.append('start', dateRange.start);
      if (dateRange.end) params.append('end', dateRange.end);
      const { data } = await api.get(`/api/email/analytics/overview?${params.toString()}`);
      return data;
    }
  });
};

// ==================== SETTINGS ====================

/**
 * Fetch email settings
 */
export const useEmailSettingsQuery = () => {
  return useQuery({
    queryKey: ['email-settings'],
    queryFn: async () => {
      const { data } = await api.get('/api/email/settings');
      return data.settings || data;
    }
  });
};

/**
 * Update email settings mutation
 */
export const useUpdateEmailSettingsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settingsData) => {
      const { data } = await api.put('/api/email/settings', settingsData);
      return data.settings || data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['email-settings']);
    }
  });
};

export default {
  useCampaignsQuery,
  useCampaignQuery,
  useCreateCampaignMutation,
  useUpdateCampaignMutation,
  useDeleteCampaignMutation,
  useDuplicateCampaignMutation,
  useSendCampaignMutation,
  useScheduleCampaignMutation,
  usePauseCampaignMutation,
  useResumeCampaignMutation,
  useCancelCampaignMutation,
  useTestSendMutation,
  useCampaignPreviewQuery,
  useCampaignRecipientsQuery,
  useCampaignReportQuery,
  useEmailListsQuery,
  useEmailListQuery,
  useEmailTemplatesQuery,
  useEmailTemplateQuery,
  useEmailAnalyticsQuery,
  useEmailSettingsQuery,
  useUpdateEmailSettingsMutation
};
