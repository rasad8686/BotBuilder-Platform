import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../utils/api';

// Query Keys
const ANALYTICS_KEYS = {
  all: ['emailAnalytics'],
  overview: (dateRange) => [...ANALYTICS_KEYS.all, 'overview', dateRange],
  volume: (dateRange, groupBy) => [...ANALYTICS_KEYS.all, 'volume', dateRange, groupBy],
  topCampaigns: (dateRange) => [...ANALYTICS_KEYS.all, 'topCampaigns', dateRange],
  engagementByHour: (dateRange) => [...ANALYTICS_KEYS.all, 'engagementByHour', dateRange],
  contactGrowth: (dateRange) => [...ANALYTICS_KEYS.all, 'contactGrowth', dateRange],
  engagementSegments: () => [...ANALYTICS_KEYS.all, 'engagementSegments'],
  campaignReport: (id) => [...ANALYTICS_KEYS.all, 'campaignReport', id]
};

// Helper to format date range for API
const formatDateRange = (dateRange) => {
  if (!dateRange) return null;
  return {
    startDate: dateRange.startDate instanceof Date
      ? dateRange.startDate.toISOString()
      : dateRange.startDate,
    endDate: dateRange.endDate instanceof Date
      ? dateRange.endDate.toISOString()
      : dateRange.endDate
  };
};

// Get overview stats
export const useEmailOverviewQuery = (dateRange) => {
  const formattedRange = formatDateRange(dateRange);

  return useQuery({
    queryKey: ANALYTICS_KEYS.overview(formattedRange),
    queryFn: async () => {
      if (!formattedRange) return null;
      const params = new URLSearchParams({
        startDate: formattedRange.startDate,
        endDate: formattedRange.endDate
      });

      const response = await api.get(`/api/email/analytics/overview?${params}`);
      return response.data;
    },
    enabled: !!formattedRange
  });
};

// Get volume chart data
export const useEmailVolumeQuery = (dateRange, groupBy = 'day') => {
  const formattedRange = formatDateRange(dateRange);

  return useQuery({
    queryKey: ANALYTICS_KEYS.volume(formattedRange, groupBy),
    queryFn: async () => {
      if (!formattedRange) return [];
      const params = new URLSearchParams({
        startDate: formattedRange.startDate,
        endDate: formattedRange.endDate,
        groupBy
      });

      const response = await api.get(`/api/email/analytics/volume?${params}`);
      return response.data;
    },
    enabled: !!formattedRange
  });
};

// Get top campaigns
export const useTopCampaignsQuery = (dateRange, limit = 5) => {
  const formattedRange = formatDateRange(dateRange);

  return useQuery({
    queryKey: ANALYTICS_KEYS.topCampaigns(formattedRange),
    queryFn: async () => {
      if (!formattedRange) return [];
      const params = new URLSearchParams({
        startDate: formattedRange.startDate,
        endDate: formattedRange.endDate,
        limit: limit.toString()
      });

      const response = await api.get(`/api/email/analytics/top-campaigns?${params}`);
      return response.data;
    },
    enabled: !!formattedRange
  });
};

// Get engagement by hour
export const useEngagementByHourQuery = (dateRange) => {
  const formattedRange = formatDateRange(dateRange);

  return useQuery({
    queryKey: ANALYTICS_KEYS.engagementByHour(formattedRange),
    queryFn: async () => {
      if (!formattedRange) return null;
      const params = new URLSearchParams({
        startDate: formattedRange.startDate,
        endDate: formattedRange.endDate
      });

      const response = await api.get(`/api/email/analytics/engagement-by-hour?${params}`);
      return response.data;
    },
    enabled: !!formattedRange
  });
};

// Get contact growth
export const useContactGrowthQuery = (dateRange) => {
  const formattedRange = formatDateRange(dateRange);

  return useQuery({
    queryKey: ANALYTICS_KEYS.contactGrowth(formattedRange),
    queryFn: async () => {
      if (!formattedRange) return [];
      const params = new URLSearchParams({
        startDate: formattedRange.startDate,
        endDate: formattedRange.endDate
      });

      const response = await api.get(`/api/email/analytics/contact-growth?${params}`);
      return response.data;
    },
    enabled: !!formattedRange
  });
};

// Get engagement segments
export const useEngagementSegmentsQuery = () => {
  return useQuery({
    queryKey: ANALYTICS_KEYS.engagementSegments(),
    queryFn: async () => {
      const response = await api.get('/api/email/analytics/engagement-segments');
      return response.data;
    }
  });
};

// Get campaign report
export const useCampaignReportQuery = (campaignId) => {
  return useQuery({
    queryKey: ANALYTICS_KEYS.campaignReport(campaignId),
    queryFn: async () => {
      if (!campaignId) return null;
      const response = await api.get(`/api/email/analytics/campaigns/${campaignId}/report`);
      return response.data;
    },
    enabled: !!campaignId
  });
};

// Export report
export const useExportReportMutation = () => {
  return useMutation({
    mutationFn: async ({ dateRange, format = 'csv' }) => {
      const formattedRange = formatDateRange(dateRange);
      const params = new URLSearchParams({
        startDate: formattedRange.startDate,
        endDate: formattedRange.endDate,
        format
      });

      const response = await api.get(`/api/email/analytics/export?${params}`, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `email-analytics-report.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      return response.data;
    }
  });
};

export default {
  useEmailOverviewQuery,
  useEmailVolumeQuery,
  useTopCampaignsQuery,
  useEngagementByHourQuery,
  useContactGrowthQuery,
  useEngagementSegmentsQuery,
  useCampaignReportQuery,
  useExportReportMutation
};
