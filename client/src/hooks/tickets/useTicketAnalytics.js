/**
 * Ticket Analytics Hooks
 * React Query hooks for ticket analytics data
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../utils/api';

/**
 * Hook for overview statistics with trends
 */
export const useTicketAnalyticsOverview = (dateRange = {}) => {
  const { period = '30d', startDate, endDate } = dateRange;

  return useQuery({
    queryKey: ['ticket-analytics', 'overview', period, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const { data } = await api.get(`/api/tickets/analytics/detailed?${params}`);
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook for ticket volume over time
 */
export const useTicketVolumeQuery = (dateRange = {}, groupBy = 'day') => {
  const { period = '30d', startDate, endDate } = dateRange;

  return useQuery({
    queryKey: ['ticket-analytics', 'volume', period, startDate, endDate, groupBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (groupBy) params.append('groupBy', groupBy);

      const { data } = await api.get(`/api/tickets/analytics/volume?${params}`);
      return data.volume;
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook for ticket distribution by dimension
 */
export const useTicketDistributionQuery = (dateRange = {}, dimension = 'status') => {
  const { period = '30d', startDate, endDate } = dateRange;

  return useQuery({
    queryKey: ['ticket-analytics', 'distribution', dimension, period, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('dimension', dimension);

      const { data } = await api.get(`/api/tickets/analytics/distribution?${params}`);
      return data.distribution;
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook for all agents performance
 */
export const useAgentPerformanceQuery = (dateRange = {}) => {
  const { period = '30d', startDate, endDate } = dateRange;

  return useQuery({
    queryKey: ['ticket-analytics', 'agents', 'performance', period, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const { data } = await api.get(`/api/tickets/analytics/agents/performance?${params}`);
      return data.agents;
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook for single agent performance
 */
export const useAgentPerformanceByIdQuery = (agentId, dateRange = {}) => {
  const { period = '30d', startDate, endDate } = dateRange;

  return useQuery({
    queryKey: ['ticket-analytics', 'agents', agentId, period, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const { data } = await api.get(`/api/tickets/analytics/agents/${agentId}?${params}`);
      return data;
    },
    enabled: !!agentId,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook for SLA performance metrics
 */
export const useSLAPerformanceQuery = (dateRange = {}) => {
  const { period = '30d', startDate, endDate } = dateRange;

  return useQuery({
    queryKey: ['ticket-analytics', 'sla', period, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const { data } = await api.get(`/api/tickets/analytics/sla/detailed?${params}`);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook for CSAT metrics
 */
export const useCSATQuery = (dateRange = {}) => {
  const { period = '30d', startDate, endDate } = dateRange;

  return useQuery({
    queryKey: ['ticket-analytics', 'csat', period, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const { data } = await api.get(`/api/tickets/analytics/csat?${params}`);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook for peak hours heatmap
 */
export const usePeakHoursQuery = (dateRange = {}) => {
  const { period = '30d', startDate, endDate } = dateRange;

  return useQuery({
    queryKey: ['ticket-analytics', 'peak-hours', period, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const { data } = await api.get(`/api/tickets/analytics/peak-hours?${params}`);
      return data.heatmap;
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook for response time histogram
 */
export const useResponseTimeHistogramQuery = (dateRange = {}) => {
  const { period = '30d', startDate, endDate } = dateRange;

  return useQuery({
    queryKey: ['ticket-analytics', 'response-time', period, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const { data } = await api.get(`/api/tickets/analytics/response-time?${params}`);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook for exporting analytics
 */
export const useAnalyticsExport = () => {
  return useMutation({
    mutationFn: async ({ dateRange = {}, format = 'csv' }) => {
      const params = new URLSearchParams();
      if (dateRange.period) params.append('period', dateRange.period);
      if (dateRange.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange.endDate) params.append('endDate', dateRange.endDate);
      params.append('format', format);

      if (format === 'csv') {
        const response = await api.get(`/api/tickets/analytics/export?${params}`, {
          responseType: 'blob'
        });

        // Create download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `ticket-analytics-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        return { success: true };
      } else {
        const { data } = await api.get(`/api/tickets/analytics/export?${params}`);
        return data;
      }
    }
  });
};

/**
 * Combined hook for all analytics data
 */
export const useTicketAnalytics = (dateRange = {}) => {
  const overview = useTicketAnalyticsOverview(dateRange);
  const volume = useTicketVolumeQuery(dateRange);
  const statusDist = useTicketDistributionQuery(dateRange, 'status');
  const priorityDist = useTicketDistributionQuery(dateRange, 'priority');
  const agents = useAgentPerformanceQuery(dateRange);
  const sla = useSLAPerformanceQuery(dateRange);
  const csat = useCSATQuery(dateRange);

  return {
    overview: overview.data,
    volume: volume.data,
    statusDistribution: statusDist.data,
    priorityDistribution: priorityDist.data,
    agents: agents.data,
    sla: sla.data,
    csat: csat.data,
    isLoading: overview.isLoading || volume.isLoading || statusDist.isLoading ||
               priorityDist.isLoading || agents.isLoading || sla.isLoading || csat.isLoading,
    isError: overview.isError || volume.isError || statusDist.isError ||
             priorityDist.isError || agents.isError || sla.isError || csat.isError,
    refetch: () => {
      overview.refetch();
      volume.refetch();
      statusDist.refetch();
      priorityDist.refetch();
      agents.refetch();
      sla.refetch();
      csat.refetch();
    }
  };
};

export default useTicketAnalytics;
